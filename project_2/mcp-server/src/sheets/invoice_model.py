"""Invoice row model: read, write and enrich invoice rows.

`enrich_invoice()` is a line-for-line port of enrichInvoice() in
ESolution's src/lib/sheets.js. Derived fields (status, days_overdue,
penalty_amount, total_amount_due, final_amount) are NEVER trusted from
storage — they are recalculated on every read, exactly like the website
does, so both processes always report the same numbers.
"""

from __future__ import annotations

import math
import time
import uuid
from datetime import date, datetime, timedelta

from src.sheets.client import INVOICE_HEADERS, get_client

# Google Sheets date serials count days from this epoch (Lotus convention).
_SHEETS_EPOCH = date(1899, 12, 30)


def _parse_date(value) -> date | None:
    """Parse a sheet date cell.

    Handles 'YYYY-MM-DD' strings (what the apps write), ISO timestamps, and
    raw date serials (what UNFORMATTED_VALUE returns when someone typed a
    date into the cell by hand and Sheets converted it to a date type).
    """
    if value in (None, ""):
        return None
    if isinstance(value, (int, float)) or str(value).strip().isdigit():
        serial = int(float(value))
        if 20000 <= serial <= 80000:  # ≈ years 1954-2119
            return _SHEETS_EPOCH + timedelta(days=serial)
        return None
    text = str(value).strip()
    for fmt in ("%Y-%m-%d", "%Y-%m-%dT%H:%M:%S.%f%z", "%Y-%m-%dT%H:%M:%S"):
        try:
            return datetime.strptime(text[:26 if "T" in text else 10], fmt).date()
        except ValueError:
            continue
    try:
        return datetime.fromisoformat(text.replace("Z", "+00:00")).date()
    except ValueError:
        return None


def _num(value, default=0.0) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return float(default)


def enrich_invoice(row: dict) -> dict:
    """Recompute derived fields from a raw sheet row.

    Mirrors sheets.js enrichInvoice():
      status:      paid_date set -> "Paid"; today > due -> "Overdue"; else "Unpaid"
      days_overdue: only counted while status is "Overdue"
      penalty:      ceil(days_overdue / 7) * 2% * amount  (per started week)
      total_amount_due: amount + penalty  (on the ORIGINAL amount)
      final_amount: amount * (1 - discount_percent / 100)
    """
    today = date.today()
    due = _parse_date(row.get("due_date"))
    amount = _num(row.get("amount"))

    if row.get("paid_date"):
        status = "Paid"
    elif due is not None and today > due:
        status = "Overdue"
    else:
        status = "Unpaid"

    days_overdue = (today - due).days if (status == "Overdue" and due) else 0
    penalty = math.ceil(days_overdue / 7) * 0.02 * amount if days_overdue > 0 else 0.0
    total_due = amount + penalty

    discount_percent = _num(row.get("discount_percent"))
    final_amount = amount * (1 - discount_percent / 100)

    try:
        behavior_score = int(float(row.get("ai_behavior_score")))
    except (TypeError, ValueError):
        behavior_score = 50

    # Normalize date fields to ISO strings (raw cells may be date serials)
    paid = _parse_date(row.get("paid_date"))
    normalized_dates = {}
    if due is not None:
        normalized_dates["due_date"] = due.isoformat()
    if paid is not None:
        normalized_dates["paid_date"] = paid.isoformat()

    return {
        **row,
        **normalized_dates,
        "status": status,
        "days_overdue": days_overdue,
        "penalty_amount": round(penalty, 2),
        "total_amount_due": round(total_due, 2),
        "final_amount": round(final_amount, 2),
        "amount": amount,
        "ai_behavior_score": behavior_score,
    }


# ── reads ────────────────────────────────────────────────────────────────────

def get_invoices() -> list[dict]:
    return [enrich_invoice(row) for row in get_client().list_invoice_rows()]


def get_invoice_by_id(invoice_id: str) -> dict | None:
    for row in get_client().list_invoice_rows():
        if str(row.get("invoice_id")) == invoice_id:
            return enrich_invoice(row)
    return None


def get_unpaid_invoices() -> list[dict]:
    return [inv for inv in get_invoices() if inv["status"] != "Paid"]


def get_invoices_by_client(client_email: str) -> list[dict]:
    needle = (client_email or "").lower()
    return [
        inv for inv in get_invoices()
        if str(inv.get("client_email", "")).lower() == needle
    ]


def get_invoice_summary() -> dict:
    """Same aggregation as getInvoiceSummary() in sheets.js."""
    invoices = get_invoices()
    paid = [i for i in invoices if i["status"] == "Paid"]
    unpaid = [i for i in invoices if i["status"] == "Unpaid"]
    overdue = [i for i in invoices if i["status"] == "Overdue"]
    return {
        "total_invoices": len(invoices),
        "total_paid": len(paid),
        "total_unpaid": len(unpaid),
        "total_overdue": len(overdue),
        "total_revenue": round(sum(i["amount"] for i in paid), 2),
        "total_unpaid_amount": round(sum(i["amount"] for i in unpaid), 2),
        "total_overdue_amount": round(sum(i["total_amount_due"] for i in overdue), 2),
    }


# ── writes ───────────────────────────────────────────────────────────────────

def new_invoice_id() -> str:
    """inv_<unix-timestamp>_<first 5 uuid chars> — same shape as the website."""
    return f"inv_{int(time.time())}_{uuid.uuid4().hex[:5]}"


def create_invoice_row(
    client_name: str,
    client_email: str,
    amount: float,
    due_date: str,
    notes: str = "",
    discount_percent: float = 0.0,
) -> dict:
    """Build and append a new invoice row (no email / PDF side effects)."""
    invoice_id = new_invoice_id()
    portal_token = str(uuid.uuid4())
    final_amount = round(amount * (1 - discount_percent / 100), 2)

    row = {h: "" for h in INVOICE_HEADERS}
    row.update({
        "invoice_id": invoice_id,
        "client_name": client_name,
        "client_email": client_email,
        "amount": amount,
        "due_date": due_date,
        "status": "Unpaid",
        "discount_percent": discount_percent,
        "final_amount": final_amount,
        "reminder_count": 0,
        "penalty_amount": 0,
        "total_amount_due": final_amount,
        "ai_behavior_score": 50,
        "notes": notes or "",
        "created_at": datetime.now().isoformat(),
        "legal_notice_sent": "FALSE",
        "payment_method": "Bank/UPI",
        "portal_token": portal_token,
        "portal_viewed": "FALSE",
        "payment_claimed": "FALSE",
        "installment_requested": "FALSE",
    })
    get_client().append_invoice_row(row)
    return enrich_invoice(row)


def update_invoice_fields(invoice_id: str, updates: dict) -> None:
    """Write specific fields on one invoice row.

    Raises KeyError (from the client) when the invoice doesn't exist. No
    caller needs the updated row back, so we deliberately skip the full-sheet
    re-read that would otherwise cost an extra API round-trip per update —
    the bulk overdue sweep used to pay that once per reminder sent.
    """
    get_client().update_invoice_row(invoice_id, updates)

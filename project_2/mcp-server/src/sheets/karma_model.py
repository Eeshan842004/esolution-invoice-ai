"""KarmaDB model: client reputation stored in the KarmaDB tab.

Ports the logic of ESolution's karma-calculator.js, email-hasher.js and the
/api/karma/check + /api/karma/submit routes:

- Clients are keyed by md5(email.trim().lower()) + case-insensitive name.
- Payment timing maps to a label/points bucket:
    on_time (<=0d late) +10 | slightly_late (<=7d) +5 | late (<=14d) +2
    very_late (>14d) -5     | defaulter -10
- Score = ((avg points + 10) / 20) * 5, clamped to [0, 5], 1 decimal.
"""

from __future__ import annotations

import hashlib
from datetime import date

from src.sheets.client import get_client
from src.sheets.invoice_model import _parse_date, get_invoices_by_client

KARMA_LABELS = ("on_time", "slightly_late", "late", "very_late", "defaulter")


def hash_email(email: str) -> str:
    return hashlib.md5(email.strip().lower().encode()).hexdigest()


def karma_from_delay(due_date_diff_days: int) -> tuple[str, int]:
    """(label, points) for how late a payment was; negative = early."""
    if due_date_diff_days <= 0:
        return "on_time", 10
    if due_date_diff_days <= 7:
        return "slightly_late", 5
    if due_date_diff_days <= 14:
        return "late", 2
    return "very_late", -5


def karma_score(counts: dict) -> float:
    """Map average points in [-10, +10] onto a 0-5 star scale."""
    total = sum(int(counts.get(f"{label}_count", 0) or 0) for label in KARMA_LABELS)
    if total == 0:
        return 5.0  # no data = benefit of the doubt
    points = (
        int(counts.get("on_time_count", 0) or 0) * 10
        + int(counts.get("slightly_late_count", 0) or 0) * 5
        + int(counts.get("late_count", 0) or 0) * 2
        + int(counts.get("very_late_count", 0) or 0) * -5
        + int(counts.get("defaulter_count", 0) or 0) * -10
    )
    score = ((points / total + 10) / 20) * 5
    return round(max(0.0, min(5.0, score)), 1)


def karma_tier(score: float) -> str:
    if score >= 4.0:
        return "green"
    if score >= 2.5:
        return "yellow"
    return "red"


def karma_recommendation(score: float) -> str:
    if score >= 4.0:
        return "Reliable client — safe to extend credit"
    if score >= 3.0:
        return "Generally pays, occasional delays expected"
    if score >= 2.0:
        return "Ask for partial advance payment"
    return "High risk — ask for 50% advance before work"


def _int(value, default=0) -> int:
    try:
        return int(float(value))
    except (TypeError, ValueError):
        return default


def _find_karma_row(email_hash: str, client_name: str,
                    rows: list[dict] | None = None) -> dict | None:
    name_lower = client_name.lower().strip()
    if rows is None:
        rows = get_client().list_karma_rows()
    for row in rows:
        if (str(row.get("client_email_hash")) == email_hash
                and str(row.get("client_name", "")).lower().strip() == name_lower):
            return row
    return None


def get_karma(client_email: str, client_name: str,
              rows: list[dict] | None = None) -> dict:
    """Karma lookup — same shape as GET /api/karma/check.

    Pass preloaded KarmaDB `rows` when looking up many clients in one go
    (e.g. client_ranking) so the tab is fetched once, not once per client.
    """
    row = _find_karma_row(hash_email(client_email), client_name, rows)
    if row is None:
        return {"new_client": True,
                "message": "No payment history for this client yet."}
    score = float(row.get("karma_score") or 0)
    return {
        "new_client": False,
        "client_name": row.get("client_name"),
        "karma_score": score,
        "stars": score,
        "tier": karma_tier(score),
        "recommendation": karma_recommendation(score),
        "total_invoices": _int(row.get("total_invoices")),
        "on_time_count": _int(row.get("on_time_count")),
        "slightly_late_count": _int(row.get("slightly_late_count")),
        "late_count": _int(row.get("late_count")),
        "very_late_count": _int(row.get("very_late_count")),
        "defaulter_count": _int(row.get("defaulter_count")),
        "average_delay_days": _int(row.get("average_delay_days")),
        "last_updated": row.get("last_updated"),
    }


def submit_karma(client_email: str, client_name: str, due_date_diff: int) -> dict:
    """Record one payment outcome — same math as POST /api/karma/submit."""
    email_hash = hash_email(client_email)
    label, _points = karma_from_delay(due_date_diff)
    today = date.today().isoformat()
    existing = _find_karma_row(email_hash, client_name)

    if existing is not None:
        counts = {f"{name}_count": _int(existing.get(f"{name}_count"))
                  for name in KARMA_LABELS}
        counts[f"{label}_count"] += 1
        total = _int(existing.get("total_invoices")) + 1
        prev_avg = float(existing.get("average_delay_days") or 0)
        new_avg = round((prev_avg * (total - 1) + max(0, due_date_diff)) / total)
        score = karma_score(counts)
        get_client().update_karma_row(email_hash, {
            **counts,
            "total_invoices": total,
            "average_delay_days": new_avg,
            "karma_score": score,
            "last_updated": today,
        })
        return {"score": score, "label": label, "total_invoices": total}

    counts = {f"{name}_count": 1 if name == label else 0 for name in KARMA_LABELS}
    score = karma_score(counts)
    get_client().append_karma_row({
        "client_email_hash": email_hash,
        "client_name": client_name.strip(),
        "total_invoices": 1,
        **counts,
        "average_delay_days": max(0, due_date_diff),
        "karma_score": score,
        "user_count": 1,
        "last_updated": today,
    })
    return {"score": score, "label": label, "total_invoices": 1, "is_new": True}


def recalculate_karma(client_email: str, client_name: str) -> dict:
    """Rebuild the client's karma row from ALL their paid invoices."""
    paid = [inv for inv in get_invoices_by_client(client_email)
            if inv["status"] == "Paid"]
    counts = {f"{name}_count": 0 for name in KARMA_LABELS}
    delays = []
    for inv in paid:
        paid_date = _parse_date(inv.get("paid_date"))
        due = _parse_date(inv.get("due_date"))
        if paid_date is None or due is None:
            continue
        diff = (paid_date - due).days
        label, _pts = karma_from_delay(diff)
        counts[f"{label}_count"] += 1
        delays.append(max(0, diff))

    counted = sum(counts.values())
    score = karma_score(counts)
    avg_delay = round(sum(delays) / len(delays)) if delays else 0
    today = date.today().isoformat()
    email_hash = hash_email(client_email)

    row_data = {
        "total_invoices": counted,
        **counts,
        "average_delay_days": avg_delay,
        "karma_score": score,
        "last_updated": today,
    }
    if _find_karma_row(email_hash, client_name) is not None:
        get_client().update_karma_row(email_hash, row_data)
    else:
        get_client().append_karma_row({
            "client_email_hash": email_hash,
            "client_name": client_name.strip(),
            "user_count": 1,
            **row_data,
        })
    return {
        "new_stars": score,
        "new_tier": karma_tier(score),
        "invoices_counted": counted,
        "average_delay_days": avg_delay,
    }

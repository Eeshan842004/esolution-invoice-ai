"""Reminder tools (scope: reminder:send): tone-aware reminders, legal
notices, and the bulk overdue sweep that consolidates the old schedulers.
"""

from datetime import date

from fastmcp import FastMCP
from fastmcp.exceptions import ToolError

from src.config import settings
from src.sheets.invoice_model import (
    _parse_date,
    get_invoice_by_id,
    get_unpaid_invoices,
    update_invoice_fields,
)
from src.services import email_service, gemini_service
from src.security.input_validator import validate_invoice_id

LEGAL_NOTICE_MIN_DAYS = 30
REMINDER_THROTTLE_DAYS = 3


def _reminder_updates(invoice: dict, today: date) -> dict:
    """Sheet fields to write after a reminder goes out (same as /api/reminders)."""
    return {
        "last_reminder_date": today.isoformat(),
        "reminder_count": int(invoice.get("reminder_count") or 0) + 1,
        "penalty_amount": invoice["penalty_amount"],
        "total_amount_due": invoice["total_amount_due"],
        "status": "Overdue",
    }


def _skip_reason(invoice: dict, today: date) -> str | None:
    """Why a sweep would skip this invoice, or None to send.

    Mirrors /api/reminders: respect the emotion-analysis next_reminder_date
    when set; otherwise throttle to one reminder per 3 days.
    """
    next_date = _parse_date(invoice.get("next_reminder_date"))
    if next_date is not None:
        if today < next_date:
            return "emotion_wait"
        return None
    last = _parse_date(invoice.get("last_reminder_date"))
    if last is not None and (today - last).days < REMINDER_THROTTLE_DAYS:
        return "throttled"
    return None


def _sheet_tone(invoice: dict) -> str | None:
    tone = str(invoice.get("reminder_tone") or "").strip()
    return tone if tone in email_service.VALID_TONES else None


def register_reminder_tools(mcp: FastMCP) -> None:

    @mcp.tool()
    async def send_reminder(invoice_id: str) -> dict:
        """Send a payment reminder email for one overdue invoice.

        Validates the invoice is genuinely overdue (never trusts the caller).
        Tone: uses the sheet's emotion-analysis `reminder_tone` if set,
        otherwise picks by days overdue (gentle <7d, firm 7-13d,
        urgent 14-29d, legal-warning 30+).

        Args:
            invoice_id: e.g. "inv_1726123456_a3f9c".

        Returns:
            {sent, tone_used, days_overdue, next_reminder_date}
        """
        invoice_id = validate_invoice_id(invoice_id)
        invoice = get_invoice_by_id(invoice_id)
        if invoice is None:
            return {"error": f"Invoice {invoice_id} not found"}
        if invoice["status"] == "Paid":
            return {"error": f"Invoice {invoice_id} is already paid — no reminder sent"}
        if invoice["status"] != "Overdue":
            return {"error": f"Invoice {invoice_id} is not overdue yet "
                             f"(due {invoice.get('due_date')}) — no reminder sent"}

        result = email_service.send_reminder(invoice, _sheet_tone(invoice))
        if not result.get("success"):
            raise ToolError(f"Email send failed: {result.get('error')}")

        today = date.today()
        update_invoice_fields(invoice_id, _reminder_updates(invoice, today))
        return {
            "sent": True,
            "tone_used": result["tone_used"],
            "days_overdue": invoice["days_overdue"],
            "next_reminder_date": invoice.get("next_reminder_date") or None,
        }

    @mcp.tool()
    async def send_legal_notice(invoice_id: str) -> dict:
        """Draft (via Gemini) and email a formal legal demand letter.

        Gated: only allowed once an invoice is 30+ days overdue.

        Args:
            invoice_id: e.g. "inv_1726123456_a3f9c".

        Returns:
            {sent, days_overdue, notice_text_preview}
        """
        invoice_id = validate_invoice_id(invoice_id)
        invoice = get_invoice_by_id(invoice_id)
        if invoice is None:
            return {"error": f"Invoice {invoice_id} not found"}
        if invoice["status"] == "Paid":
            return {"error": f"Invoice {invoice_id} is already paid"}
        if invoice["days_overdue"] < LEGAL_NOTICE_MIN_DAYS:
            return {"error": f"Legal notice requires {LEGAL_NOTICE_MIN_DAYS}+ days "
                             f"overdue; this invoice is {invoice['days_overdue']} "
                             "days overdue. Send a firm reminder instead."}

        notice_text = await gemini_service.generate_legal_notice(
            invoice, settings.owner_name, settings.owner_email or settings.gmail_user)
        result = email_service.send_legal_notice_email(invoice, notice_text)
        if not result.get("success"):
            raise ToolError(f"Email send failed: {result.get('error')}")

        note = (str(invoice.get("notes") or "")
                + f"\n[System] Legal notice sent on {date.today().isoformat()}")
        update_invoice_fields(invoice_id, {
            "legal_notice_sent": "TRUE",
            "notes": note.strip(),
        })
        return {
            "sent": True,
            "days_overdue": invoice["days_overdue"],
            "notice_text_preview": notice_text[:400],
        }

    @mcp.tool()
    async def run_overdue_sweep() -> dict:
        """Send reminders for ALL overdue invoices in one pass.

        Respects the emotion-analysis `next_reminder_date` when set and a
        3-day throttle otherwise, exactly like the website's daily job.

        Returns:
            {invoices_checked, reminders_sent, skipped, results}
        """
        today = date.today()
        unpaid = get_unpaid_invoices()
        results = []
        skipped: dict[str, int] = {}
        sent = 0

        for invoice in unpaid:
            if invoice["status"] != "Overdue":
                continue
            reason = _skip_reason(invoice, today)
            if reason is not None:
                skipped[reason] = skipped.get(reason, 0) + 1
                results.append({"invoice_id": invoice["invoice_id"],
                                "status": f"skipped_{reason}"})
                continue

            result = email_service.send_reminder(invoice, _sheet_tone(invoice))
            if result.get("success"):
                update_invoice_fields(invoice["invoice_id"],
                                      _reminder_updates(invoice, today))
                sent += 1
                results.append({
                    "invoice_id": invoice["invoice_id"],
                    "client": invoice.get("client_name"),
                    "days_overdue": invoice["days_overdue"],
                    "status": "sent",
                    "tone_used": result["tone_used"],
                })
            else:
                skipped["email_failed"] = skipped.get("email_failed", 0) + 1
                results.append({"invoice_id": invoice["invoice_id"],
                                "status": "email_failed",
                                "error": result.get("error")})

        return {
            "invoices_checked": len(unpaid),
            "reminders_sent": sent,
            "skipped": skipped,
            "results": results,
        }

"""Read-only invoice tools (scope: invoice:read)."""

from fastmcp import FastMCP

from src.sheets.invoice_model import (
    get_invoice_by_id,
    get_invoice_summary,
    get_invoices,
)
from src.security.input_validator import (
    clamp_limit,
    sanitize_string,
    validate_invoice_id,
    validate_status,
)


def _mask_email(email: str) -> str:
    """r***@example.com — full addresses stay in the sheet, not in chat."""
    email = str(email or "")
    if "@" not in email:
        return email
    local, _, domain = email.partition("@")
    return f"{local[:1]}***@{domain}"


def _summary_row(inv: dict) -> dict:
    return {
        "invoice_id": inv.get("invoice_id"),
        "client_name": inv.get("client_name"),
        "client_email": _mask_email(inv.get("client_email")),
        "amount": inv.get("amount"),
        "final_amount": inv.get("final_amount"),
        "due_date": inv.get("due_date"),
        "status": inv.get("status"),
        "days_overdue": inv.get("days_overdue"),
        "penalty_amount": inv.get("penalty_amount"),
        "total_amount_due": inv.get("total_amount_due"),
    }


def register_invoice_read_tools(mcp: FastMCP) -> None:

    @mcp.tool()
    async def list_invoices(status: str = "", client_name: str = "",
                            limit: int = 20) -> list[dict]:
        """List invoices, optionally filtered by status and/or client name.

        Args:
            status: "Unpaid"/"Pending", "Overdue" or "Paid" (empty = all).
            client_name: Case-insensitive substring match on the client name.
            limit: Max results (1-50, default 20), newest first.

        Returns:
            Invoice summaries with recalculated status, days_overdue,
            penalty and total due. Client emails are masked for privacy.
        """
        limit = clamp_limit(limit)
        wanted = validate_status(status) if status else ""
        needle = sanitize_string(client_name, 100).lower() if client_name else ""

        invoices = get_invoices()
        if wanted:
            invoices = [i for i in invoices if i["status"] == wanted]
        if needle:
            invoices = [i for i in invoices
                        if needle in str(i.get("client_name", "")).lower()]
        invoices.sort(key=lambda i: str(i.get("created_at", "")), reverse=True)
        return [_summary_row(i) for i in invoices[:limit]]

    @mcp.tool()
    async def get_invoice(invoice_id: str) -> dict:
        """Get the full details of one invoice (all columns, enriched).

        Args:
            invoice_id: e.g. "inv_1726123456_a3f9c".

        Returns:
            The complete invoice row including AI behavior score, penalty,
            reminder history, portal status and emotion-analysis fields.
        """
        invoice_id = validate_invoice_id(invoice_id)
        invoice = get_invoice_by_id(invoice_id)
        if invoice is None:
            return {"error": f"Invoice {invoice_id} not found"}
        return invoice

    @mcp.tool()
    async def get_overdue_invoices() -> list[dict]:
        """All overdue invoices, most overdue first, with penalties calculated.

        Returns:
            Overdue invoice summaries sorted by days_overdue descending.
        """
        overdue = [i for i in get_invoices() if i["status"] == "Overdue"]
        overdue.sort(key=lambda i: i["days_overdue"], reverse=True)
        return [_summary_row(i) for i in overdue]

    @mcp.tool()
    async def get_business_summary() -> dict:
        """Aggregate business stats: revenue, outstanding, overdue, counts.

        Returns:
            total_invoices, counts by status, total_revenue (paid),
            total_unpaid_amount, total_overdue_amount (incl. penalties).
        """
        return get_invoice_summary()

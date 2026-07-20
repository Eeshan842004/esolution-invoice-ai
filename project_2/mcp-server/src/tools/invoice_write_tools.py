"""Invoice write tools: create, update notes, mark paid.

Scopes: create/update require invoice:write; mark_paid requires
payment:write + karma:write (it also rewrites the client's karma row).
"""

from datetime import date

from fastmcp import FastMCP

from src.config import settings
from src.sheets.invoice_model import (
    _parse_date,
    create_invoice_row,
    get_invoice_by_id,
    update_invoice_fields,
)
from src.sheets.karma_model import submit_karma
from src.security.input_validator import (
    ValidationError,
    sanitize_string,
    validate_amount,
    validate_date,
    validate_discount,
    validate_email,
    validate_invoice_id,
)


def register_invoice_write_tools(mcp: FastMCP) -> None:

    @mcp.tool()
    async def create_invoice(client_name: str, client_email: str, amount: float,
                             due_date: str, notes: str = "",
                             discount_percent: float = 0) -> dict:
        """Create a new invoice row in the shared Google Sheet.

        Does NOT send an email or generate a PDF — chain other tools for
        that. Consider check_karma first for clients with unknown history.

        Args:
            client_name: Client's full name.
            client_email: Client's email address.
            amount: Invoice amount in INR (positive).
            due_date: Due date as YYYY-MM-DD.
            notes: Optional project notes (stored on the invoice).
            discount_percent: Optional discount 0-100.

        Returns:
            {invoice_id, portal_token, portal_url, final_amount, due_date}
        """
        client_name = sanitize_string(client_name, 100)
        if not client_name:
            raise ValidationError("client_name must not be empty")
        client_email = validate_email(client_email)
        amount = validate_amount(amount)
        due_date = validate_date(due_date, "due_date")
        notes = sanitize_string(notes, 500) if notes else ""
        discount_percent = validate_discount(discount_percent)

        invoice = create_invoice_row(
            client_name=client_name,
            client_email=client_email,
            amount=amount,
            due_date=due_date,
            notes=notes,
            discount_percent=discount_percent,
        )
        portal_url = (f"{settings.next_public_base_url}/pay/"
                      f"{invoice['invoice_id']}?token={invoice['portal_token']}")
        return {
            "invoice_id": invoice["invoice_id"],
            "portal_token": invoice["portal_token"],
            "portal_url": portal_url,
            "final_amount": invoice["final_amount"],
            "due_date": due_date,
            "status": invoice["status"],
        }

    @mcp.tool()
    async def update_invoice_notes(invoice_id: str, notes: str) -> dict:
        """Update ONLY the notes field of an existing invoice.

        Deliberately narrow: cannot touch amount, status or payment fields.

        Args:
            invoice_id: e.g. "inv_1726123456_a3f9c".
            notes: New notes text (replaces the old notes).

        Returns:
            {success, invoice_id}
        """
        invoice_id = validate_invoice_id(invoice_id)
        notes = sanitize_string(notes, 500)
        if get_invoice_by_id(invoice_id) is None:
            return {"error": f"Invoice {invoice_id} not found"}
        update_invoice_fields(invoice_id, {"notes": notes})
        return {"success": True, "invoice_id": invoice_id}

    @mcp.tool()
    async def mark_paid(invoice_id: str, payment_method: str = "",
                        payment_reference: str = "") -> dict:
        """Mark an invoice as paid (today) and update the client's karma.

        Args:
            invoice_id: e.g. "inv_1726123456_a3f9c".
            payment_method: e.g. "UPI", "Bank Transfer" (optional).
            payment_reference: Transaction reference (optional).

        Returns:
            {success, invoice_id, paid_date, karma_updated, karma}
        """
        invoice_id = validate_invoice_id(invoice_id)
        invoice = get_invoice_by_id(invoice_id)
        if invoice is None:
            return {"error": f"Invoice {invoice_id} not found"}
        if invoice["status"] == "Paid":
            return {"error": f"Invoice {invoice_id} is already marked paid "
                             f"(paid_date {invoice.get('paid_date')})"}

        today = date.today()
        updates = {"status": "Paid", "paid_date": today.isoformat()}
        if payment_method:
            updates["payment_method"] = sanitize_string(payment_method, 50)
        if payment_reference:
            updates["payment_reference"] = sanitize_string(payment_reference, 100)
        update_invoice_fields(invoice_id, updates)

        # Karma: how late (or early) was this payment vs the due date?
        karma_result = None
        due = _parse_date(invoice.get("due_date"))
        if due is not None:
            karma_result = submit_karma(
                str(invoice.get("client_email", "")),
                str(invoice.get("client_name", "")),
                (today - due).days,
            )
        return {
            "success": True,
            "invoice_id": invoice_id,
            "paid_date": today.isoformat(),
            "karma_updated": karma_result is not None,
            "karma": karma_result,
        }

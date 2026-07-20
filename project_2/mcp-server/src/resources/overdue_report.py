"""Overdue-invoices report as an MCP resource."""

from fastmcp import FastMCP

from src.sheets.invoice_model import get_invoices


def register_overdue_report_resources(mcp: FastMCP) -> None:

    @mcp.resource("invoice://overdue-report")
    async def overdue_report() -> str:
        """All overdue invoices, most overdue first, with penalties."""
        overdue = sorted(
            (i for i in get_invoices() if i["status"] == "Overdue"),
            key=lambda i: i["days_overdue"], reverse=True,
        )
        if not overdue:
            return "No overdue invoices. The book is clean. 🎉"

        lines = ["ESolution — Overdue Report", ""]
        total = 0.0
        for inv in overdue:
            total += inv["total_amount_due"]
            lines.append(
                f"- {inv['invoice_id']} | {inv['client_name']} | "
                f"{inv['days_overdue']}d overdue | due {inv['due_date']} | "
                f"₹{inv['amount']:,.2f} + ₹{inv['penalty_amount']:,.2f} penalty "
                f"= ₹{inv['total_amount_due']:,.2f} | "
                f"reminders sent: {inv.get('reminder_count') or 0}"
            )
        lines += ["", f"TOTAL OVERDUE: ₹{total:,.2f} across {len(overdue)} invoices"]
        return "\n".join(lines)

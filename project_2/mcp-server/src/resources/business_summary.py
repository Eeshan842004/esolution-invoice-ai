"""Live business-summary MCP resource, read straight from the sheet."""

from fastmcp import FastMCP

from src.sheets.invoice_model import get_invoice_summary


def register_business_summary_resources(mcp: FastMCP) -> None:

    @mcp.resource("invoice://business-summary")
    async def business_summary() -> str:
        """Current snapshot of the freelancer's invoice book."""
        s = get_invoice_summary()
        return f"""ESolution — Business Summary

Invoices:      {s['total_invoices']} total
               {s['total_paid']} paid | {s['total_unpaid']} unpaid | {s['total_overdue']} overdue

Money:
  Revenue collected (paid invoices):  ₹{s['total_revenue']:,.2f}
  Outstanding (unpaid, not yet due):  ₹{s['total_unpaid_amount']:,.2f}
  Overdue incl. late penalties:       ₹{s['total_overdue_amount']:,.2f}

Late penalty policy: 2% of the invoice amount per started week overdue.
Legal notices become available at 30+ days overdue."""

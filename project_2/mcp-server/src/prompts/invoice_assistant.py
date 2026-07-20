"""Reusable prompt templates: everyday invoice management."""

from fastmcp import FastMCP


def register_invoice_assistant_prompts(mcp: FastMCP) -> None:

    @mcp.prompt()
    def morning_briefing() -> str:
        """Daily invoice briefing for the freelancer."""
        return """You are the freelancer's invoice assistant. Prepare a morning briefing:

1. `get_business_summary` — the headline numbers.
2. `get_overdue_invoices` — what needs chasing today.
3. `revenue_report` with period "this_month" — how the month is going.

Then report, in this order:
1. **Money on the table** — total overdue with penalties, worst offender first.
2. **Actions to take today** — which invoices to remind (respect reminder
   throttles), which are 30+ days overdue and ready for a legal notice.
3. **This month so far** — revenue collected vs outstanding.

Amounts in INR with Indian comma formatting (₹1,25,000). Be brief — the
freelancer reads this over coffee."""

    @mcp.prompt()
    def new_client_intake(client_name: str, client_email: str) -> str:
        """Pre-invoice due diligence on a client."""
        return f"""A new invoice is about to be raised for {client_name} ({client_email}).

1. `check_karma` with the client's email and name.
2. If they have history: summarize stars, tier and average delay, and quote
   the recommendation (e.g. ask for an advance when the tier is red).
3. If they are a new client: say so and suggest a modest first invoice or a
   partial advance until trust is established.

Keep it to a short risk assessment the freelancer can act on immediately."""

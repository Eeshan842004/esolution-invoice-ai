"""Reusable prompt templates: payment collection strategy."""

from fastmcp import FastMCP


def register_collection_advisor_prompts(mcp: FastMCP) -> None:

    @mcp.prompt()
    def collection_strategy(invoice_id: str) -> str:
        """Escalation plan for one overdue invoice."""
        return f"""You are a payment-collection advisor for an Indian freelancer.
Invoice {invoice_id} is overdue. Build an escalation plan:

1. `get_invoice` — days overdue, penalty, reminder count, client emotion
   fields (client_emotion, reminder_tone, next_reminder_date).
2. `check_karma` for this client — are they habitually late or is this new?

Recommend ONE next step, choosing the gentlest option likely to work:
- < 7 days overdue, good karma → wait or send a friendly reminder.
- 7-14 days → `send_reminder` (the tone comes from emotion analysis).
- 15-30 days, repeated reminders ignored → firm reminder + mention penalty.
- 30+ days → `send_legal_notice`, and say what it implies.

Respect the sheet's next_reminder_date — if the emotion analysis asked to
wait, say so instead of sending. Justify the choice with the data."""

    @mcp.prompt()
    def weekly_collections_review() -> str:
        """Weekly review of everything owed, with a chase plan."""
        return """Run the weekly collections review:

1. `get_overdue_invoices` — the full late list.
2. `client_ranking` — who owes the most and who pays slowest.
3. `run_overdue_sweep` ONLY if the user explicitly asked to send reminders;
   otherwise just report what a sweep would target.

Deliver:
1. Top 3 collection priorities (amount × days overdue × karma).
2. Anyone crossing the 30-day legal-notice line this week.
3. One-line strategy per priority client (reminder / call / legal notice /
   write-off consideration)."""

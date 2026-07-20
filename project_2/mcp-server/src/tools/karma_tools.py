"""Client reputation tools (scopes: karma:read / karma:write)."""

from fastmcp import FastMCP

from src.sheets import karma_model
from src.security.input_validator import (
    ValidationError,
    sanitize_string,
    validate_email,
)


def register_karma_tools(mcp: FastMCP) -> None:

    @mcp.tool()
    async def check_karma(client_email: str, client_name: str) -> dict:
        """Look up a client's payment reputation before doing business.

        Clients are stored privacy-first: keyed by md5(email) + name, the
        raw email never lives in the KarmaDB tab.

        Args:
            client_email: Client's email (hashed for the lookup).
            client_name: Client's name (must match the stored record).

        Returns:
            {stars 0-5, tier green/yellow/red, recommendation,
             total_invoices, payment history counts} or {new_client: true}.
        """
        client_email = validate_email(client_email)
        client_name = sanitize_string(client_name, 100)
        if not client_name:
            raise ValidationError("client_name must not be empty")
        return karma_model.get_karma(client_email, client_name)

    @mcp.tool()
    async def recalculate_karma(client_email: str, client_name: str) -> dict:
        """Rebuild a client's karma from ALL their paid invoices.

        Scoring per invoice: on time +10, ≤7d late +5, ≤14d late +2,
        later -5; the average maps onto a 0-5 star scale.

        Args:
            client_email: Client's email.
            client_name: Client's name.

        Returns:
            {new_stars, new_tier, invoices_counted, average_delay_days}
        """
        client_email = validate_email(client_email)
        client_name = sanitize_string(client_name, 100)
        if not client_name:
            raise ValidationError("client_name must not be empty")
        return karma_model.recalculate_karma(client_email, client_name)

"""Permission scopes and the tool -> required-scopes map.

A token must carry every scope listed for a tool to invoke it.
The `admin` scope implies all others.
"""

ALL_SCOPES = [
    "invoice:read",
    "invoice:write",
    "payment:write",
    "reminder:send",
    "karma:read",
    "karma:write",
    "analytics:read",
    "document:read",
    "admin",
]

ADMIN_SCOPE = "admin"

TOOL_SCOPES: dict[str, list[str]] = {
    # read tools
    "list_invoices": ["invoice:read"],
    "get_invoice": ["invoice:read"],
    "get_overdue_invoices": ["invoice:read"],
    "get_business_summary": ["invoice:read"],
    # write tools
    "create_invoice": ["invoice:write"],
    "update_invoice_notes": ["invoice:write"],
    # payment tools (mark_paid also rewrites karma, so it needs both)
    "mark_paid": ["payment:write", "karma:write"],
    # reminder tools
    "send_reminder": ["reminder:send"],
    "send_legal_notice": ["reminder:send"],
    "run_overdue_sweep": ["reminder:send"],
    # karma tools
    "check_karma": ["karma:read"],
    "recalculate_karma": ["karma:write"],
    # analytics tools
    "revenue_report": ["analytics:read"],
    "client_ranking": ["analytics:read"],
    # document tools
    "generate_linkedin_post": ["document:read"],
    "get_certificate_status": ["document:read"],
}


def required_scopes(tool_name: str) -> list[str]:
    """Scopes required for a tool. Unknown tools default to admin-only
    (deny-by-default: a tool someone forgot to register here must not be
    silently open)."""
    return TOOL_SCOPES.get(tool_name, [ADMIN_SCOPE])


def has_scopes(token_scopes: list[str], needed: list[str]) -> bool:
    if ADMIN_SCOPE in token_scopes:
        return True
    return all(scope in token_scopes for scope in needed)

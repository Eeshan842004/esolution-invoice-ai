"""Registered OAuth clients for the client-credentials grant.

This is a deliberately minimal in-memory client registry for the demo
deployment. Secrets are compared with `hmac.compare_digest` (constant time).
In production, replace with a real IdP (Keycloak, Auth0, Entra ID) or a
hashed-secret table.
"""

import hmac
from dataclasses import dataclass

from src.config import settings


@dataclass(frozen=True)
class RegisteredClient:
    client_id: str
    client_secret: str
    allowed_scopes: tuple[str, ...]
    description: str = ""

    def verify_secret(self, candidate: str) -> bool:
        return hmac.compare_digest(self.client_secret.encode(), candidate.encode())


REGISTERED_CLIENTS: dict[str, RegisteredClient] = {
    # The LangGraph agent: full invoice-domain access, but never `admin`.
    settings.oauth_client_id: RegisteredClient(
        client_id=settings.oauth_client_id,
        client_secret=settings.oauth_client_secret,
        allowed_scopes=(
            "invoice:read", "invoice:write", "payment:write",
            "reminder:send", "karma:read", "karma:write",
            "analytics:read", "document:read",
        ),
        description="ESolution AI assistant (LangGraph agent)",
    ),
    # Read-only client: dashboards / reporting integrations.
    "esolution-readonly": RegisteredClient(
        client_id="esolution-readonly",
        client_secret="readonly-secret-change-me",
        allowed_scopes=("invoice:read", "karma:read", "analytics:read"),
        description="Read-only reporting access",
    ),
    # Admin client for operations.
    "esolution-admin": RegisteredClient(
        client_id="esolution-admin",
        client_secret="admin-secret-change-me",
        allowed_scopes=("admin",),
        description="Administrative access (all scopes)",
    ),
}


def get_client(client_id: str) -> RegisteredClient | None:
    return REGISTERED_CLIENTS.get(client_id)

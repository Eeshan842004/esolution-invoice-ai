"""Minimal OAuth 2.1 token server (client-credentials grant).

Mounted alongside the MCP app so one process serves both:
    POST /oauth/token
    GET  /.well-known/oauth-authorization-server

A production deployment would replace this with a real IdP; the MCP server
itself only verifies tokens (public key) and never mints them.
"""

from fastapi import FastAPI, Form, HTTPException
from fastapi.responses import JSONResponse

from src.auth.jwt_handler import create_access_token
from src.auth.models import get_client
from src.auth.scopes import ALL_SCOPES
from src.config import settings
from src.security.audit_logger import log_auth_event
from src.security.rate_limiter import RateLimiter

auth_app = FastAPI(title="ESolution Auth Server", docs_url=None, redoc_url=None)

# Aggressive limiter on the token endpoint to slow credential stuffing.
_token_limiter = RateLimiter(rpm=30, burst=10)


@auth_app.post("/oauth/token")
async def token_endpoint(
    grant_type: str = Form(...),
    client_id: str = Form(...),
    client_secret: str = Form(...),
    scope: str = Form(""),
):
    """OAuth 2.1 Client Credentials Grant."""
    if not _token_limiter.allow(client_id):
        log_auth_event(client_id, "token_rate_limited")
        raise HTTPException(429, detail={"error": "slow_down"})

    if grant_type != "client_credentials":
        raise HTTPException(400, detail={"error": "unsupported_grant_type"})

    client = get_client(client_id)
    if client is None or not client.verify_secret(client_secret):
        log_auth_event(client_id, "invalid_client")
        # Identical error whether the id or the secret was wrong.
        raise HTTPException(
            401,
            detail={"error": "invalid_client"},
            headers={"WWW-Authenticate": "Basic"},
        )

    requested = scope.split() if scope else list(client.allowed_scopes)
    granted = [s for s in requested if s in client.allowed_scopes]
    if not granted:
        log_auth_event(client_id, "invalid_scope", detail=scope)
        raise HTTPException(400, detail={"error": "invalid_scope"})

    token = create_access_token(client_id, granted)
    log_auth_event(client_id, "token_issued", detail=" ".join(granted))
    return JSONResponse(
        {
            "access_token": token,
            "token_type": "bearer",
            "expires_in": settings.jwt_expiry_minutes * 60,
            "scope": " ".join(granted),
        },
        headers={"Cache-Control": "no-store", "Pragma": "no-cache"},
    )


@auth_app.get("/.well-known/oauth-authorization-server")
async def discovery():
    """OAuth authorization server metadata (RFC 8414)."""
    return {
        "issuer": settings.jwt_issuer,
        "token_endpoint": "/oauth/token",
        "grant_types_supported": ["client_credentials"],
        "token_endpoint_auth_methods_supported": ["client_secret_post"],
        "scopes_supported": ALL_SCOPES,
    }

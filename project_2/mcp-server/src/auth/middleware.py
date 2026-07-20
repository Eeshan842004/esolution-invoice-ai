"""FastMCP middleware: Bearer-JWT authentication, scope enforcement,
per-client rate limiting, and audit logging for every tool call.

Transport behavior:
- HTTP (streamable-http): the Authorization header is REQUIRED. Tokens are
  verified against the local public key with pinned algorithm, audience and
  issuer. Scopes gate each tool; every call is rate limited and audit logged.
- stdio: there is no HTTP request. stdio means the client launched this
  process locally (dev / MCP Inspector), so calls run as the implicit
  "local-stdio" principal with admin scope. Set ESOLUTION_REQUIRE_AUTH=1 to
  forbid unauthenticated stdio use entirely.
"""

import os
import time

import jwt as pyjwt
from fastmcp.exceptions import ToolError
from fastmcp.server.dependencies import get_http_headers
from fastmcp.server.middleware import Middleware, MiddlewareContext

from src.auth.jwt_handler import verify_token
from src.auth.scopes import has_scopes, required_scopes
from src.security.audit_logger import log_tool_call
from src.security.rate_limiter import rate_limiter

LOCAL_PRINCIPAL = {"sub": "local-stdio", "scopes": ["admin"]}


def _extract_bearer_token(headers: dict[str, str]) -> str | None:
    auth = headers.get("authorization", "")
    if auth.lower().startswith("bearer "):
        return auth[7:].strip()
    return None


def authenticate_request() -> dict:
    """Resolve the calling principal for the current request.

    Returns the verified JWT payload, or the local principal for stdio.
    Raises ToolError with a client-safe message on any auth failure
    (no stack traces, no internals).
    """
    # get_http_headers() strips 'authorization' by default (to avoid
    # forwarding it downstream); we explicitly include it because this IS the
    # server that must read the Bearer token.
    headers = get_http_headers(include={"authorization"})

    if not headers:  # stdio transport - no HTTP layer at all
        if os.environ.get("ESOLUTION_REQUIRE_AUTH") == "1":
            raise ToolError("Authentication required: stdio access is disabled.")
        return dict(LOCAL_PRINCIPAL)

    token = _extract_bearer_token(headers)
    if not token:
        raise ToolError(
            "Authentication required. Obtain a token from POST /oauth/token "
            "and send it as 'Authorization: Bearer <token>'."
        )

    try:
        return verify_token(token)
    except pyjwt.ExpiredSignatureError:
        raise ToolError("Token expired. Request a new one from /oauth/token.") from None
    except pyjwt.InvalidAudienceError:
        raise ToolError(
            "Token audience mismatch: this token was not issued for the "
            "ESolution MCP server."
        ) from None
    except pyjwt.InvalidTokenError:
        # Deliberately generic - never leak why verification failed.
        raise ToolError("Invalid token.") from None


class AuthMiddleware(Middleware):
    """Authenticates every tool call and enforces per-tool scopes."""

    async def on_call_tool(self, context: MiddlewareContext, call_next):
        tool_name = context.message.name
        arguments = context.message.arguments or {}
        started = time.perf_counter()

        principal = authenticate_request()  # raises ToolError on failure
        client_id = principal.get("sub", "unknown")
        token_scopes = principal.get("scopes", [])

        if not rate_limiter.allow(client_id):
            retry_after = rate_limiter.retry_after(client_id)
            log_tool_call(client_id, tool_name, arguments, "rate_limited",
                          (time.perf_counter() - started) * 1000)
            raise ToolError(
                f"Rate limit exceeded. Retry in {retry_after:.1f}s."
            )

        needed = required_scopes(tool_name)
        if not has_scopes(token_scopes, needed):
            log_tool_call(client_id, tool_name, arguments, "denied",
                          (time.perf_counter() - started) * 1000,
                          detail=f"missing scopes {needed}")
            raise ToolError(
                f"Insufficient scope. Tool '{tool_name}' requires "
                f"{needed}; your token has {token_scopes}."
            )

        try:
            result = await call_next(context)
        except Exception as exc:
            # ValidationError/SSRFError are ToolErrors: FastMCP has already
            # surfaced their message to the client unmasked. Everything else
            # was masked to a generic message. Either way, audit-log and
            # re-raise unchanged.
            log_tool_call(client_id, tool_name, arguments, "error",
                          (time.perf_counter() - started) * 1000,
                          detail=type(exc).__name__)
            raise

        log_tool_call(client_id, tool_name, arguments, "success",
                      (time.perf_counter() - started) * 1000)
        return result

    async def on_list_tools(self, context: MiddlewareContext, call_next):
        """Only advertise tools the caller's token can actually invoke."""
        tools = await call_next(context)
        try:
            principal = authenticate_request()
        except ToolError:
            return []  # unauthenticated discovery reveals nothing
        token_scopes = principal.get("scopes", [])
        return [t for t in tools if has_scopes(token_scopes, required_scopes(t.name))]

"""MCP client wiring: OAuth token acquisition + tool loading.

The agent authenticates to the ESolution MCP server exactly like any other
MCP client: it fetches a Bearer token via the client-credentials grant, then
connects over streamable HTTP with `Authorization: Bearer <token>`.
Tokens are cached until shortly before expiry and refreshed transparently.
"""

import time

import httpx
from langchain_core.tools import BaseTool
from langchain_mcp_adapters.client import MultiServerMCPClient

from src.config import settings

_token: str | None = None
_token_expiry: float = 0.0


async def get_access_token(force: bool = False) -> str:
    """Return a valid Bearer token, refreshing ~60s before expiry."""
    global _token, _token_expiry
    if not force and _token and time.monotonic() < _token_expiry - 60:
        return _token

    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.post(
            settings.auth_token_url,
            data={
                "grant_type": "client_credentials",
                "client_id": settings.oauth_client_id,
                "client_secret": settings.oauth_client_secret,
                "scope": settings.oauth_scope,
            },
        )
        resp.raise_for_status()
        payload = resp.json()

    _token = payload["access_token"]
    _token_expiry = time.monotonic() + int(payload.get("expires_in", 3600))
    return _token


async def load_mcp_tools() -> list[BaseTool]:
    """Connect to the ESolution MCP server and return its tools as LangChain tools."""
    token = await get_access_token()
    client = MultiServerMCPClient(
        {
            "esolution": {
                "url": settings.mcp_server_url,
                "transport": "streamable_http",
                "headers": {"Authorization": f"Bearer {token}"},
            }
        }
    )
    return await client.get_tools()

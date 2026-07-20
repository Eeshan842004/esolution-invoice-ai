"""Agent smoke tests.

These verify the MCP wiring (token acquisition, tool loading, graph shape)
against a live ESolution MCP server. They are skipped automatically when the
server is not reachable, so `pytest` stays green offline; run the stack first
to exercise them fully.
"""

import os

import httpx
import pytest

from src.config import settings
from src.mcp_client import get_access_token, load_mcp_tools


def _server_up() -> bool:
    base = settings.mcp_server_url.rsplit("/mcp", 1)[0]
    try:
        r = httpx.get(f"{base}/healthz", timeout=2.0)
        return r.status_code == 200
    except Exception:
        return False


pytestmark = pytest.mark.skipif(
    not _server_up(), reason="ESolution MCP server not running"
)


async def test_token_acquisition():
    token = await get_access_token(force=True)
    assert token and token.count(".") == 2  # a JWT


async def test_tool_loading():
    tools = await load_mcp_tools()
    names = {t.name for t in tools}
    # The agent's token carries all 8 invoice-domain scopes -> all 16 tools.
    assert "list_invoices" in names
    assert "create_invoice" in names
    assert "mark_paid" in names
    assert "run_overdue_sweep" in names
    assert len(names) == 16


@pytest.mark.skipif(
    not os.environ.get("GROQ_API_KEY") and not settings.groq_api_key,
    reason="GROQ_API_KEY not set (model construction requires it)",
)
async def test_graph_builds():
    from src.agent import build_agent

    graph = await build_agent()
    assert graph is not None
    # graph has the agent + tools nodes
    assert {"agent", "tools"} <= set(graph.get_graph().nodes)

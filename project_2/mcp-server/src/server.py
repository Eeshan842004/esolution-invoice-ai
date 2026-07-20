"""ESolution Invoice MCP server entry point.

Run modes:
    python -m src.server            # stdio (local dev, MCP Inspector, Claude Desktop)
    python -m src.server http       # streamable HTTP on one port (default 8811):
                                    #   /mcp                MCP endpoint (Bearer JWT required)
                                    #   /oauth/token        OAuth 2.1 token endpoint
                                    #   /.well-known/...    OAuth discovery metadata
                                    #   /healthz            liveness probe
"""

import sys

from fastmcp import FastMCP

from src.auth.middleware import AuthMiddleware
from src.config import settings
from src.prompts.collection_advisor import register_collection_advisor_prompts
from src.prompts.invoice_assistant import register_invoice_assistant_prompts
from src.resources.business_summary import register_business_summary_resources
from src.resources.overdue_report import register_overdue_report_resources
from src.tools.analytics_tools import register_analytics_tools
from src.tools.document_tools import register_document_tools
from src.tools.invoice_read_tools import register_invoice_read_tools
from src.tools.invoice_write_tools import register_invoice_write_tools
from src.tools.karma_tools import register_karma_tools
from src.tools.reminder_tools import register_reminder_tools

mcp = FastMCP(
    name="ESolution Invoice Server",
    instructions=(
        "Production MCP server for an Indian freelancer's invoicing system "
        "(ESolution). Exposes invoices, payments, reminders, client karma, "
        "analytics and documents, backed by the same Google Sheet the "
        "website uses. All tools are protected by OAuth 2.1 Bearer tokens "
        "with per-tool scopes; obtain a token from POST /oauth/token "
        "(client_credentials grant). Amounts are INR."
    ),
    middleware=[AuthMiddleware()],
    # Unexpected exceptions are masked so stack traces / credentials
    # never leak to clients. ToolError messages pass through untouched.
    mask_error_details=True,
)

register_invoice_read_tools(mcp)
register_invoice_write_tools(mcp)
register_reminder_tools(mcp)
register_karma_tools(mcp)
register_analytics_tools(mcp)
register_document_tools(mcp)
register_business_summary_resources(mcp)
register_overdue_report_resources(mcp)
register_invoice_assistant_prompts(mcp)
register_collection_advisor_prompts(mcp)


def create_http_app():
    """One ASGI app serving the MCP endpoint plus the OAuth token server."""
    from fastapi import FastAPI
    from fastapi.middleware.cors import CORSMiddleware
    from starlette.requests import Request

    from src.auth.oauth_server import auth_app

    mcp_app = mcp.http_app(path="/mcp")

    app = FastAPI(
        title="ESolution MCP",
        docs_url=None,
        redoc_url=None,
        lifespan=mcp_app.lifespan,  # propagate MCP session-manager lifespan
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.allowed_origins,
        allow_methods=["GET", "POST", "OPTIONS", "DELETE"],
        allow_headers=["Authorization", "Content-Type", "Mcp-Session-Id"],
        expose_headers=["Mcp-Session-Id"],
    )

    @app.middleware("http")
    async def security_headers(request: Request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "no-referrer"
        response.headers["Cache-Control"] = response.headers.get(
            "Cache-Control", "no-store")
        return response

    @app.get("/healthz")
    async def healthz():
        return {"status": "ok", "service": "esolution-mcp"}

    # Auth routes are registered before the catch-all mount so they win.
    app.include_router(auth_app.router)
    app.mount("/", mcp_app)
    return app


def main() -> None:
    transport = sys.argv[1] if len(sys.argv) > 1 else "stdio"
    if transport == "http":
        import uvicorn

        uvicorn.run(
            create_http_app(),
            host=settings.server_host,
            port=settings.server_port,
            log_level=settings.log_level.lower(),
        )
    else:
        mcp.run(transport="stdio")


if __name__ == "__main__":
    main()

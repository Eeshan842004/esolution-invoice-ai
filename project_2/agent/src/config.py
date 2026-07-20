"""Agent settings.

GROQ_API_KEY is shared with the ESolution website, so the repo-root
`.env.local` is read first; `agent/.env` can override anything locally.
"""

from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

AGENT_DIR = Path(__file__).resolve().parents[1]        # .../project_2/agent
REPO_ROOT = AGENT_DIR.parents[1]                       # .../invoice (ESolution root)


class Settings(BaseSettings):
    # MCP server + OAuth (port 8811: high port, Windows reserves low ranges)
    mcp_server_url: str = "http://localhost:8811/mcp"
    auth_token_url: str = "http://localhost:8811/oauth/token"
    oauth_client_id: str = "esolution-agent"
    oauth_client_secret: str = "change-me-in-production"
    oauth_scope: str = (
        "invoice:read invoice:write payment:write reminder:send "
        "karma:read karma:write analytics:read document:read"
    )

    # LLM: Groq Llama 3.3 70B (free tier; same key the website already uses)
    groq_api_key: str = ""
    agent_model: str = "llama-3.3-70b-versatile"

    # Agent API server
    agent_host: str = "0.0.0.0"
    agent_port: int = 8002
    allowed_origins: list[str] = ["http://localhost:3000"]

    model_config = SettingsConfigDict(
        # Later files win: local .env overrides the shared .env.local.
        env_file=(REPO_ROOT / ".env.local", AGENT_DIR / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()

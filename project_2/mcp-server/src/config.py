"""Application settings loaded from environment / .env via pydantic-settings.

Secrets are shared with the ESolution website: the repo-root `.env.local`
(Google Sheets service account, Gmail app password, Groq/Gemini keys,
owner payment details) is read first, then `mcp-server/.env` for
server-specific overrides (ports, JWT paths, OAuth client credentials).
"""

from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

MCP_DIR = Path(__file__).resolve().parents[1]          # .../project_2/mcp-server
PROJECT2_DIR = MCP_DIR.parent                          # .../project_2
REPO_ROOT = PROJECT2_DIR.parent                        # .../invoice (ESolution root)


class Settings(BaseSettings):
    debug: bool = False

    # Google Sheets (same spreadsheet + service account as the website)
    google_sheet_id: str = ""
    google_service_account_email: str = ""
    google_private_key: str = ""
    service_account_path: str = ""  # optional JSON-file alternative

    # Gmail (same app password the website uses via Nodemailer)
    gmail_user: str = ""
    gmail_app_password: str = ""
    owner_name: str = "ESolution"
    owner_email: str = ""
    owner_upi_id: str = ""
    owner_bank_account: str = ""
    owner_bank_ifsc: str = ""

    # LLM keys (reused from the website's .env.local)
    gemini_api_key: str = ""
    groq_api_key: str = ""
    groq_model: str = "llama-3.3-70b-versatile"

    # Portal links in tool responses point at the Next.js site
    next_public_base_url: str = "http://localhost:3000"

    # JWT / OAuth
    jwt_private_key_path: str = str(PROJECT2_DIR / "keys" / "private.pem")
    jwt_public_key_path: str = str(PROJECT2_DIR / "keys" / "public.pem")
    jwt_algorithm: str = "RS256"
    jwt_expiry_minutes: int = 60
    jwt_audience: str = "esolution-mcp"
    jwt_issuer: str = "esolution-auth"

    # Demo OAuth client credentials (a real deployment uses an external IdP)
    oauth_client_id: str = "esolution-agent"
    oauth_client_secret: str = "change-me-in-production"

    # Rate limiting
    rate_limit_rpm: int = 60
    rate_limit_burst: int = 10

    # Server (8811: high port — Windows reserves low ranges)
    server_host: str = "0.0.0.0"
    server_port: int = 8811
    allowed_origins: list[str] = ["http://localhost:3000"]

    # Logging
    log_level: str = "INFO"

    model_config = SettingsConfigDict(
        # Later files win: local .env overrides the shared .env.local.
        env_file=(REPO_ROOT / ".env.local", MCP_DIR / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()

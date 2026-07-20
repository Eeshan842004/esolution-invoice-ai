"""Structured audit logging for every MCP tool invocation.

Emits one JSON line per call with client identity, tool, redacted arguments,
outcome, and latency - the raw material for anomaly detection and compliance.
"""

import logging
from datetime import datetime, timezone

import structlog

from src.config import settings

SENSITIVE_KEY_MARKERS = ("password", "secret", "token", "key", "authorization", "credential")

structlog.configure(
    processors=[
        structlog.processors.add_log_level,
        structlog.processors.TimeStamper(fmt="iso", utc=True),
        structlog.processors.JSONRenderer(),
    ],
    wrapper_class=structlog.make_filtering_bound_logger(
        getattr(logging, settings.log_level.upper(), logging.INFO)
    ),
)

logger = structlog.get_logger("esolution.audit")


def _redact(args: dict) -> dict:
    redacted = {}
    for key, value in args.items():
        if any(marker in key.lower() for marker in SENSITIVE_KEY_MARKERS):
            redacted[key] = "[REDACTED]"
        elif isinstance(value, str) and len(value) > 300:
            redacted[key] = value[:300] + "...[truncated]"
        else:
            redacted[key] = value
    return redacted


def log_tool_call(
    client_id: str,
    tool_name: str,
    arguments: dict | None,
    status: str,  # "success" | "error" | "denied" | "rate_limited"
    latency_ms: float,
    detail: str = "",
) -> None:
    logger.info(
        "tool_call",
        client_id=client_id,
        tool=tool_name,
        args=_redact(arguments or {}),
        status=status,
        latency_ms=round(latency_ms, 2),
        detail=detail,
        ts=datetime.now(timezone.utc).isoformat(),
    )


def log_auth_event(client_id: str, action: str, detail: str = "") -> None:
    logger.info("auth_event", client_id=client_id, action=action, detail=detail)

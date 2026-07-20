"""JWT creation and validation (RS256, asymmetric).

The auth server signs with the private key; the MCP server only ever needs
the public key to verify. Audience + issuer are always validated - a token
minted for another service must never be accepted here (confused-deputy /
token-passthrough prevention).
"""

from datetime import datetime, timedelta, timezone
from functools import lru_cache
from pathlib import Path

import jwt

from src.config import settings


@lru_cache
def _private_key() -> str:
    return Path(settings.jwt_private_key_path).read_text()


@lru_cache
def _public_key() -> str:
    return Path(settings.jwt_public_key_path).read_text()


def create_access_token(
    client_id: str,
    scopes: list[str],
    expires_minutes: int | None = None,
) -> str:
    expires = expires_minutes if expires_minutes is not None else settings.jwt_expiry_minutes
    now = datetime.now(timezone.utc)
    payload = {
        "sub": client_id,
        "scopes": scopes,
        "aud": settings.jwt_audience,   # audience binding - CRITICAL
        "iss": settings.jwt_issuer,
        "iat": now,
        "nbf": now,
        "exp": now + timedelta(minutes=expires),
    }
    return jwt.encode(payload, _private_key(), algorithm=settings.jwt_algorithm)


def verify_token(token: str) -> dict:
    """Verify a JWT and return its payload.

    Raises jwt.InvalidTokenError (or a subclass such as ExpiredSignatureError,
    InvalidAudienceError, InvalidIssuerError) on any failure. The allowed
    algorithm list is pinned to prevent alg-confusion attacks (e.g. an
    attacker re-signing with HS256 using the public key as the HMAC secret).
    """
    return jwt.decode(
        token,
        _public_key(),
        algorithms=[settings.jwt_algorithm],  # pinned - never trust the header
        audience=settings.jwt_audience,
        issuer=settings.jwt_issuer,
        options={"require": ["exp", "iat", "aud", "iss", "sub"]},
    )

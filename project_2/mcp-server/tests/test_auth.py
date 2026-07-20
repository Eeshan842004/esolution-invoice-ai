"""JWT creation/verification and scope-model tests."""

from datetime import datetime, timedelta, timezone
from pathlib import Path

import jwt as pyjwt
import pytest

from src.auth.jwt_handler import create_access_token, verify_token
from src.auth.scopes import ADMIN_SCOPE, has_scopes, required_scopes
from src.config import settings


def _private_key() -> str:
    return Path(settings.jwt_private_key_path).read_text()


def test_create_and_verify_token():
    token = create_access_token("test-client", ["invoice:read"])
    payload = verify_token(token)
    assert payload["sub"] == "test-client"
    assert payload["scopes"] == ["invoice:read"]
    assert payload["aud"] == settings.jwt_audience
    assert payload["iss"] == settings.jwt_issuer


def test_expired_token_rejected():
    token = create_access_token("test-client", ["invoice:read"], expires_minutes=-5)
    with pytest.raises(pyjwt.ExpiredSignatureError):
        verify_token(token)


def test_wrong_audience_rejected():
    """A token minted for another service MUST be rejected (audience binding)."""
    now = datetime.now(timezone.utc)
    token = pyjwt.encode(
        {"sub": "evil", "scopes": ["admin"], "aud": "some-other-server",
         "iss": settings.jwt_issuer, "iat": now, "exp": now + timedelta(hours=1)},
        _private_key(), algorithm="RS256",
    )
    with pytest.raises(pyjwt.InvalidAudienceError):
        verify_token(token)


def test_wrong_issuer_rejected():
    now = datetime.now(timezone.utc)
    token = pyjwt.encode(
        {"sub": "evil", "scopes": ["admin"], "aud": settings.jwt_audience,
         "iss": "rogue-idp", "iat": now, "exp": now + timedelta(hours=1)},
        _private_key(), algorithm="RS256",
    )
    with pytest.raises(pyjwt.InvalidIssuerError):
        verify_token(token)


def test_tampered_token_rejected():
    token = create_access_token("test-client", ["invoice:read"])
    header, payload, sig = token.split(".")
    tampered = f"{header}.{payload}x.{sig}"
    with pytest.raises(pyjwt.InvalidTokenError):
        verify_token(tampered)


def test_hs256_alg_confusion_rejected():
    """A token signed with HS256 using the *public key* as the HMAC secret
    must be rejected because the verification algorithm list is pinned to
    RS256. (PyJWT's own encode() refuses to build such a token, so we craft
    it by hand to genuinely exercise the attack.)"""
    import base64
    import hashlib
    import hmac
    import json

    def b64(raw: bytes) -> bytes:
        return base64.urlsafe_b64encode(raw).rstrip(b"=")

    public_key = Path(settings.jwt_public_key_path).read_text().encode()
    now = int(datetime.now(timezone.utc).timestamp())
    header = b64(json.dumps({"alg": "HS256", "typ": "JWT"}).encode())
    payload = b64(json.dumps({
        "sub": "attacker", "scopes": ["admin"], "aud": settings.jwt_audience,
        "iss": settings.jwt_issuer, "iat": now, "exp": now + 3600,
    }).encode())
    signing_input = header + b"." + payload
    signature = b64(hmac.new(public_key, signing_input, hashlib.sha256).digest())
    forged = (signing_input + b"." + signature).decode()

    with pytest.raises(pyjwt.InvalidTokenError):
        verify_token(forged)


def test_missing_claims_rejected():
    now = datetime.now(timezone.utc)
    token = pyjwt.encode(  # no exp
        {"sub": "x", "scopes": [], "aud": settings.jwt_audience,
         "iss": settings.jwt_issuer, "iat": now},
        _private_key(), algorithm="RS256",
    )
    with pytest.raises(pyjwt.MissingRequiredClaimError):
        verify_token(token)


# ── Scope model ──────────────────────────────────────────────────────────────

def test_has_scopes_exact():
    assert has_scopes(["invoice:read", "karma:read"], ["invoice:read"])
    assert not has_scopes(["invoice:read"], ["payment:write"])


def test_admin_implies_everything():
    assert has_scopes([ADMIN_SCOPE], ["payment:write", "invoice:read"])


def test_unknown_tool_is_admin_only():
    """Deny-by-default: tools missing from the scope map need admin."""
    assert required_scopes("mystery_tool") == [ADMIN_SCOPE]
    assert not has_scopes(["invoice:read", "karma:read"],
                          required_scopes("mystery_tool"))


def test_multi_scope_tools_need_all():
    needed = required_scopes("mark_paid")  # payment:write + karma:write
    assert not has_scopes(["payment:write"], needed)
    assert has_scopes(["payment:write", "karma:write"], needed)


def test_read_scope_cannot_write():
    """A read-only token must never satisfy any write/send tool."""
    read_only = ["invoice:read", "karma:read", "analytics:read"]
    for tool in ("create_invoice", "mark_paid", "send_reminder",
                 "send_legal_notice", "run_overdue_sweep", "recalculate_karma"):
        assert not has_scopes(read_only, required_scopes(tool)), tool

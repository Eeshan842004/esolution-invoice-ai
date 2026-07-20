"""Input validation / sanitization tests."""

import pytest

from src.security.input_validator import (
    ValidationError,
    clamp_limit,
    escape_like,
    sanitize_string,
    validate_amount,
    validate_date,
    validate_discount,
    validate_email,
    validate_invoice_id,
    validate_status,
)


# ── invoice ids ──────────────────────────────────────────────────────────────

@pytest.mark.parametrize("raw,expected", [
    ("inv_1726123456_a3f9c", "inv_1726123456_a3f9c"),
    ("  inv_1726123456_a3f9c  ", "inv_1726123456_a3f9c"),  # trimmed
    ("inv_999999999_00abc", "inv_999999999_00abc"),
])
def test_valid_invoice_ids(raw, expected):
    assert validate_invoice_id(raw) == expected


@pytest.mark.parametrize("raw", [
    "",                                    # empty
    "inv_123_abc",                         # timestamp too short
    "inv_1726123456_xyz",                  # suffix too short / non-hex
    "inv_1726123456_a3f9cz",               # suffix too long
    "INV_1726123456_a3f9c",                # wrong prefix case
    "inv_1726123456_a3f9c; DROP TABLE--",  # injection attempt
    "inv_1726123456_a3f9c' OR '1'='1",
    "../../etc/passwd",
])
def test_invalid_invoice_ids(raw):
    with pytest.raises(ValidationError):
        validate_invoice_id(raw)


# ── emails / amounts / dates / enums ─────────────────────────────────────────

def test_email_validation():
    assert validate_email(" user@example.com ") == "user@example.com"
    for bad in ("", "plainaddress", "a@b", "a b@c.com", "x@y." + "z" * 260):
        with pytest.raises(ValidationError):
            validate_email(bad)


def test_amount_validation():
    assert validate_amount(500) == 500
    assert validate_amount("1234.567") == 1234.57  # rounded to paise
    for bad in (0, -1, "free", None, 10**10):
        with pytest.raises(ValidationError):
            validate_amount(bad)


def test_date_validation():
    assert validate_date("2026-07-15") == "2026-07-15"
    for bad in ("15-07-2026", "2026/07/15", "tomorrow", "2026-13-45", ""):
        with pytest.raises(ValidationError):
            validate_date(bad)


def test_status_validation():
    assert validate_status("paid") == "Paid"
    assert validate_status(" OVERDUE ") == "Overdue"
    # the master spec's "Pending" maps to the sheet's actual "Unpaid"
    assert validate_status("Pending") == "Unpaid"
    assert validate_status("unpaid") == "Unpaid"
    with pytest.raises(ValidationError):
        validate_status("cancelled")


def test_discount_validation():
    assert validate_discount(0) == 0
    assert validate_discount("12.5") == 12.5
    for bad in (-1, 101, "lots"):
        with pytest.raises(ValidationError):
            validate_discount(bad)


# ── sanitization ─────────────────────────────────────────────────────────────

def test_sanitize_escapes_html():
    assert "<script>" not in sanitize_string("<script>alert(1)</script>")


def test_sanitize_caps_length():
    assert len(sanitize_string("a" * 5000, max_length=200)) <= 200 * 6  # entities expand


def test_sanitize_strips_control_chars():
    assert sanitize_string("abc\x00\x1bdef") == "abcdef"


def test_escape_like_wildcards():
    assert escape_like("100%_done") == "100\\%\\_done"
    assert escape_like("back\\slash") == "back\\\\slash"


def test_clamp_limit():
    assert clamp_limit(10) == 10
    assert clamp_limit(0) == 1
    assert clamp_limit(9999) == 50
    assert clamp_limit("junk") == 20  # default on garbage

"""Input validation and sanitization helpers used by every tool.

The datastore is Google Sheets accessed through structured cell writes (no
query language), so injection is prevented structurally; these validators
exist to reject malformed identifiers early, cap lengths and ranges, and
keep stored/echoed strings free of markup.
"""

import html
import re
from datetime import datetime

from fastmcp.exceptions import ToolError

# inv_<unix seconds>_<first 5 hex chars of a uuid4>, e.g. inv_1726123456_a3f9c
INVOICE_ID_RE = re.compile(r"^inv_\d{9,12}_[0-9a-fA-F]{5}$")
EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")  # same as the website's check
DATE_FMT = "%Y-%m-%d"

STATUSES = {"unpaid": "Unpaid", "overdue": "Overdue", "paid": "Paid",
            # the master spec says "Pending"; the sheet stores "Unpaid"
            "pending": "Unpaid"}

MAX_AMOUNT = 1_000_000_000  # ₹100 crore — anything above is a typo or abuse


class ValidationError(ToolError, ValueError):
    """Raised when tool input fails validation.

    Subclasses ToolError so FastMCP surfaces the (safe, helpful) message to
    the client instead of masking it; still a ValueError for standalone use.
    """


def validate_invoice_id(invoice_id: str) -> str:
    cleaned = str(invoice_id).strip()
    if not INVOICE_ID_RE.match(cleaned):
        raise ValidationError(
            f"Invalid invoice id: {invoice_id!r}. "
            "Expected e.g. 'inv_1726123456_a3f9c'."
        )
    return cleaned


def validate_email(email: str) -> str:
    cleaned = str(email).strip()
    if len(cleaned) > 254 or not EMAIL_RE.match(cleaned):
        raise ValidationError(f"Invalid email address: {email!r}")
    return cleaned


def validate_amount(amount) -> float:
    try:
        value = float(amount)
    except (TypeError, ValueError):
        raise ValidationError(f"Amount must be a number, got {amount!r}") from None
    if not value > 0:
        raise ValidationError(f"Amount must be positive, got {value}")
    if value > MAX_AMOUNT:
        raise ValidationError(f"Amount {value} exceeds the maximum of {MAX_AMOUNT}")
    return round(value, 2)


def validate_date(value: str, field: str = "date") -> str:
    cleaned = str(value).strip()
    try:
        datetime.strptime(cleaned, DATE_FMT)
    except ValueError:
        raise ValidationError(
            f"Invalid {field}: {value!r}. Expected YYYY-MM-DD."
        ) from None
    return cleaned


def validate_status(status: str) -> str:
    cleaned = str(status).strip().lower()
    if cleaned not in STATUSES:
        raise ValidationError(
            f"Invalid status: {status!r}. Expected one of "
            "'Unpaid'/'Pending', 'Overdue', 'Paid'."
        )
    return STATUSES[cleaned]


def validate_discount(percent) -> float:
    try:
        value = float(percent)
    except (TypeError, ValueError):
        raise ValidationError(f"Discount must be a number, got {percent!r}") from None
    if not 0 <= value <= 100:
        raise ValidationError(f"Discount must be between 0 and 100, got {value}")
    return value


def clamp_limit(limit: int, lo: int = 1, hi: int = 50, default: int = 20) -> int:
    try:
        value = int(limit)
    except (TypeError, ValueError):
        return default
    return max(lo, min(value, hi))


def sanitize_string(value: str, max_length: int = 200) -> str:
    """Sanitize free-text input: cap length, strip control chars, escape HTML.

    Free text (names, notes, payment references) is stored in the sheet and
    echoed into web UIs and HTML emails; escaping here blocks stored-XSS
    style payloads at the door.
    """
    value = str(value)[:max_length]
    value = "".join(ch for ch in value if ch.isprintable())
    value = html.escape(value, quote=True)
    return value.strip()


def escape_like(value: str) -> str:
    """Escape SQL LIKE wildcards so user input matches literally.

    (Kept for API compatibility; Sheets filtering uses plain substring
    matching, but sanitized search terms still shouldn't smuggle wildcards
    into any future storage backend.)
    """
    return value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")

"""Shared fixtures: an in-memory fake of the Google Sheets client with a
small, known invoice book so the whole suite runs with zero external
services (no Google API, no SMTP, no LLM calls)."""

from datetime import date, timedelta

import pytest

from src.sheets import client as client_module
from src.sheets.client import INVOICE_HEADERS

TODAY = date.today()


def _iso(days_from_today: int) -> str:
    return (TODAY + timedelta(days=days_from_today)).isoformat()


def make_invoice(**overrides) -> dict:
    row = {h: "" for h in INVOICE_HEADERS}
    row.update({
        "invoice_id": "inv_1726000000_aaaaa",
        "client_name": "Test Client",
        "client_email": "client@example.com",
        "amount": 10000,
        "due_date": _iso(10),
        "status": "Unpaid",
        "discount_percent": 0,
        "reminder_count": 0,
        "ai_behavior_score": 50,
        "created_at": _iso(-5) + "T10:00:00",
        "legal_notice_sent": "FALSE",
        "payment_method": "Bank/UPI",
        "portal_token": "token-aaaaa",
    })
    row.update(overrides)
    return row


class FakeSheetsClient:
    """In-memory stand-in implementing the SheetsClient row-level API."""

    def __init__(self, invoices=None, karma=None):
        self.invoices: list[dict] = list(invoices or [])
        self.karma: list[dict] = list(karma or [])

    # invoice rows
    def list_invoice_rows(self):
        return [dict(r) for r in self.invoices]

    def append_invoice_row(self, data):
        self.invoices.append(dict(data))
        return data

    def update_invoice_row(self, invoice_id, updates):
        for row in self.invoices:
            if str(row.get("invoice_id")) == str(invoice_id):
                row.update({k: v for k, v in updates.items()
                            if k in INVOICE_HEADERS})
                return
        raise KeyError(f"Row with invoice_id={invoice_id!r} not found")

    # karma rows
    def list_karma_rows(self):
        return [dict(r) for r in self.karma]

    def append_karma_row(self, data):
        self.karma.append(dict(data))
        return data

    def update_karma_row(self, email_hash, updates):
        for row in self.karma:
            if str(row.get("client_email_hash")) == str(email_hash):
                row.update(updates)
                return
        raise KeyError(f"Row with client_email_hash={email_hash!r} not found")

    # helpers for assertions
    def invoice(self, invoice_id):
        for row in self.invoices:
            if row.get("invoice_id") == invoice_id:
                return row
        return None


@pytest.fixture
def sheets():
    """Fresh fake sheet per test, injected into the sheets client module.

    Book: 1 paid, 1 unpaid (future due), 1 overdue 10d, 1 overdue 45d.
    """
    fake = FakeSheetsClient(invoices=[
        make_invoice(
            invoice_id="inv_1726000001_aaaaa",
            client_name="Rahul Sharma", client_email="rahul@example.com",
            amount=50000, due_date=_iso(-20), paid_date=_iso(-22),
            status="Paid", payment_method="UPI", certificate_id="cert_123",
        ),
        make_invoice(
            invoice_id="inv_1726000002_bbbbb",
            client_name="Wayne Enterprises", client_email="bruce@wayne.com",
            amount=125000, due_date=_iso(15),
        ),
        make_invoice(
            invoice_id="inv_1726000003_ccccc",
            client_name="Acme Corp", client_email="finance@acme.com",
            amount=30000, due_date=_iso(-10),
        ),
        make_invoice(
            invoice_id="inv_1726000004_ddddd",
            client_name="Slow Payers Ltd", client_email="ap@slowpayers.com",
            amount=80000, due_date=_iso(-45), reminder_count=3,
            last_reminder_date=_iso(-10),
        ),
    ])
    client_module.set_client(fake)
    yield fake
    client_module.set_client(None)


@pytest.fixture
def outbox(monkeypatch):
    """Capture outbound email instead of talking to Gmail."""
    from src.services import email_service

    sent: list[dict] = []

    def fake_send_email(to, subject, html, text=""):
        sent.append({"to": to, "subject": subject, "html": html, "text": text})
        return {"success": True}

    monkeypatch.setattr(email_service, "send_email", fake_send_email)
    return sent


@pytest.fixture
def fake_llms(monkeypatch):
    """Stub Gemini + Groq so document/legal tools never hit the network."""
    from src.services import gemini_service, groq_service

    async def fake_notice(invoice, name, email):
        return (f"LEGAL DEMAND: pay ₹{invoice.get('total_amount_due')} "
                f"for {invoice.get('invoice_id')} within 7 days.")

    async def fake_post(invoice, description=""):
        return (f"🚀 Delivered a great project for {invoice.get('client_name')}! "
                "#freelance #india #webdev #invoice #done")

    monkeypatch.setattr(gemini_service, "generate_legal_notice", fake_notice)
    monkeypatch.setattr(groq_service, "generate_linkedin_post", fake_post)


@pytest.fixture(autouse=True)
def reset_rate_limiter():
    """The rate limiter is a module-level singleton; clear its buckets before
    each test so calls from one test don't exhaust another's budget."""
    from src.security.rate_limiter import rate_limiter

    rate_limiter._buckets.clear()
    yield
    rate_limiter._buckets.clear()


@pytest.fixture
async def mcp_client(sheets):
    """In-process FastMCP client wired to the real server instance."""
    from fastmcp import Client

    from src.server import mcp

    async with Client(mcp) as client:
        yield client

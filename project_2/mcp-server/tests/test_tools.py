"""End-to-end tool tests through the real FastMCP server (in-process),
backed by the fake sheet from conftest.py. The client speaks actual MCP
(tool discovery, JSON schema validation, middleware) on every call."""

import json
from datetime import date, timedelta

import pytest

from src.sheets.karma_model import hash_email

TODAY = date.today()


def _iso(days: int) -> str:
    return (TODAY + timedelta(days=days)).isoformat()


def _data(result):
    """Structured content of a fastmcp CallToolResult."""
    if result.structured_content is not None:
        data = result.structured_content
        # FastMCP wraps list results as {"result": [...]}
        if isinstance(data, dict) and set(data) == {"result"}:
            return data["result"]
        return data
    return json.loads(result.content[0].text)


# ── read tools ───────────────────────────────────────────────────────────────

async def test_list_invoices_all(mcp_client):
    rows = _data(await mcp_client.call_tool("list_invoices", {}))
    assert len(rows) == 4
    by_id = {r["invoice_id"]: r for r in rows}
    assert by_id["inv_1726000001_aaaaa"]["status"] == "Paid"
    assert by_id["inv_1726000002_bbbbb"]["status"] == "Unpaid"
    assert by_id["inv_1726000003_ccccc"]["status"] == "Overdue"


async def test_list_invoices_filters(mcp_client):
    overdue = _data(await mcp_client.call_tool("list_invoices", {"status": "Overdue"}))
    assert {r["invoice_id"] for r in overdue} == {
        "inv_1726000003_ccccc", "inv_1726000004_ddddd"}

    # "Pending" is accepted as an alias for the sheet's "Unpaid"
    pending = _data(await mcp_client.call_tool("list_invoices", {"status": "Pending"}))
    assert [r["invoice_id"] for r in pending] == ["inv_1726000002_bbbbb"]

    acme = _data(await mcp_client.call_tool("list_invoices", {"client_name": "acme"}))
    assert len(acme) == 1 and acme[0]["client_name"] == "Acme Corp"


async def test_list_invoices_masks_emails(mcp_client):
    rows = _data(await mcp_client.call_tool("list_invoices", {}))
    for row in rows:
        assert "***@" in row["client_email"]


async def test_get_invoice_full_details(mcp_client):
    inv = _data(await mcp_client.call_tool(
        "get_invoice", {"invoice_id": "inv_1726000003_ccccc"}))
    assert inv["status"] == "Overdue"
    assert inv["days_overdue"] == 10
    # ceil(10/7) = 2 started weeks * 2% * 30000 = 1200
    assert inv["penalty_amount"] == 1200
    assert inv["total_amount_due"] == 31200


async def test_get_invoice_invalid_id_rejected(mcp_client):
    with pytest.raises(Exception, match="Invalid invoice id"):
        await mcp_client.call_tool("get_invoice", {"invoice_id": "1 OR 1=1"})


async def test_get_overdue_sorted_desc(mcp_client):
    rows = _data(await mcp_client.call_tool("get_overdue_invoices", {}))
    assert [r["invoice_id"] for r in rows] == [
        "inv_1726000004_ddddd", "inv_1726000003_ccccc"]
    assert rows[0]["days_overdue"] == 45


async def test_business_summary(mcp_client):
    s = _data(await mcp_client.call_tool("get_business_summary", {}))
    assert s["total_invoices"] == 4
    assert s["total_paid"] == 1
    assert s["total_unpaid"] == 1
    assert s["total_overdue"] == 2
    assert s["total_revenue"] == 50000
    assert s["total_unpaid_amount"] == 125000


# ── write tools ──────────────────────────────────────────────────────────────

async def test_create_invoice_writes_row(mcp_client, sheets):
    out = _data(await mcp_client.call_tool("create_invoice", {
        "client_name": "New Client", "client_email": "new@client.in",
        "amount": 75000, "due_date": _iso(14), "discount_percent": 10,
    }))
    assert out["invoice_id"].startswith("inv_")
    assert out["final_amount"] == 67500
    assert out["portal_url"].endswith(f"?token={out['portal_token']}")

    row = sheets.invoice(out["invoice_id"])
    assert row is not None
    assert row["status"] == "Unpaid"
    assert row["portal_token"] == out["portal_token"]
    assert row["legal_notice_sent"] == "FALSE"


@pytest.mark.parametrize("bad", [
    {"client_email": "not-an-email"},
    {"amount": -5},
    {"amount": 0},
    {"due_date": "15-07-2026"},
    {"discount_percent": 150},
])
async def test_create_invoice_validation(mcp_client, bad):
    args = {"client_name": "X", "client_email": "x@y.com",
            "amount": 100, "due_date": _iso(5), **bad}
    with pytest.raises(Exception):
        await mcp_client.call_tool("create_invoice", args)


async def test_update_notes_only_touches_notes(mcp_client, sheets):
    before = dict(sheets.invoice("inv_1726000002_bbbbb"))
    out = _data(await mcp_client.call_tool("update_invoice_notes", {
        "invoice_id": "inv_1726000002_bbbbb", "notes": "Batcave retainer"}))
    assert out["success"] is True
    after = sheets.invoice("inv_1726000002_bbbbb")
    assert after["notes"] == "Batcave retainer"
    assert after["amount"] == before["amount"]
    assert after["status"] == before["status"]


async def test_mark_paid_updates_sheet_and_karma(mcp_client, sheets):
    out = _data(await mcp_client.call_tool("mark_paid", {
        "invoice_id": "inv_1726000003_ccccc",
        "payment_method": "UPI", "payment_reference": "UPI-42"}))
    assert out["success"] is True
    assert out["paid_date"] == TODAY.isoformat()
    assert out["karma_updated"] is True

    row = sheets.invoice("inv_1726000003_ccccc")
    assert row["status"] == "Paid"
    assert row["payment_method"] == "UPI"

    # 10 days late -> "late" bucket in a fresh karma row
    karma = sheets.karma[0]
    assert karma["client_email_hash"] == hash_email("finance@acme.com")
    assert karma["late_count"] == 1
    assert karma["total_invoices"] == 1


async def test_mark_paid_twice_rejected(mcp_client):
    out = _data(await mcp_client.call_tool(
        "mark_paid", {"invoice_id": "inv_1726000001_aaaaa"}))
    assert "already" in out["error"]


# ── reminder tools ───────────────────────────────────────────────────────────

async def test_send_reminder_overdue(mcp_client, sheets, outbox):
    out = _data(await mcp_client.call_tool(
        "send_reminder", {"invoice_id": "inv_1726000003_ccccc"}))
    assert out["sent"] is True
    assert out["tone_used"] == "firm"  # 10 days -> Firm tier
    assert len(outbox) == 1
    assert outbox[0]["to"] == "finance@acme.com"

    row = sheets.invoice("inv_1726000003_ccccc")
    assert row["reminder_count"] == 1
    assert row["last_reminder_date"] == TODAY.isoformat()


async def test_send_reminder_uses_sheet_tone(mcp_client, sheets, outbox):
    sheets.invoice("inv_1726000003_ccccc")["reminder_tone"] = "friendly_hindi"
    out = _data(await mcp_client.call_tool(
        "send_reminder", {"invoice_id": "inv_1726000003_ccccc"}))
    assert out["tone_used"] == "friendly_hindi"
    assert "tension nahi" in outbox[0]["text"]


async def test_send_reminder_refuses_not_overdue(mcp_client, outbox):
    out = _data(await mcp_client.call_tool(
        "send_reminder", {"invoice_id": "inv_1726000002_bbbbb"}))
    assert "not overdue" in out["error"]
    out = _data(await mcp_client.call_tool(
        "send_reminder", {"invoice_id": "inv_1726000001_aaaaa"}))
    assert "already paid" in out["error"]
    assert outbox == []


async def test_legal_notice_gated_at_30_days(mcp_client, fake_llms, outbox):
    out = _data(await mcp_client.call_tool(
        "send_legal_notice", {"invoice_id": "inv_1726000003_ccccc"}))
    assert "30+" in out["error"]
    assert outbox == []


async def test_legal_notice_sends_when_eligible(mcp_client, sheets, fake_llms, outbox):
    out = _data(await mcp_client.call_tool(
        "send_legal_notice", {"invoice_id": "inv_1726000004_ddddd"}))
    assert out["sent"] is True
    assert "LEGAL DEMAND" in out["notice_text_preview"]
    assert len(outbox) == 1

    row = sheets.invoice("inv_1726000004_ddddd")
    assert row["legal_notice_sent"] == "TRUE"
    assert "Legal notice sent" in row["notes"]


async def test_overdue_sweep_respects_throttle_and_emotion(mcp_client, sheets, outbox):
    # ddddd was reminded 10 days ago -> due for another reminder
    # ccccc gets an emotion wait date in the future -> skipped
    sheets.invoice("inv_1726000003_ccccc")["next_reminder_date"] = _iso(3)
    out = _data(await mcp_client.call_tool("run_overdue_sweep", {}))
    assert out["reminders_sent"] == 1
    assert out["skipped"] == {"emotion_wait": 1}
    assert len(outbox) == 1

    # Run again immediately: ddddd is now throttled (reminded today)
    out2 = _data(await mcp_client.call_tool("run_overdue_sweep", {}))
    assert out2["reminders_sent"] == 0
    assert out2["skipped"] == {"emotion_wait": 1, "throttled": 1}


# ── karma tools ──────────────────────────────────────────────────────────────

async def test_check_karma_new_client(mcp_client):
    out = _data(await mcp_client.call_tool("check_karma", {
        "client_email": "stranger@nowhere.com", "client_name": "Stranger"}))
    assert out["new_client"] is True


async def test_recalculate_then_check_karma(mcp_client, sheets):
    out = _data(await mcp_client.call_tool("recalculate_karma", {
        "client_email": "rahul@example.com", "client_name": "Rahul Sharma"}))
    # One paid invoice, paid 2 days before due -> on_time -> 5.0 stars
    assert out["invoices_counted"] == 1
    assert out["new_stars"] == 5.0
    assert out["new_tier"] == "green"

    check = _data(await mcp_client.call_tool("check_karma", {
        "client_email": "rahul@example.com", "client_name": "Rahul Sharma"}))
    assert check["new_client"] is False
    assert check["stars"] == 5.0
    assert check["recommendation"].startswith("Reliable")


# ── analytics tools ──────────────────────────────────────────────────────────

async def test_revenue_report_all_time(mcp_client):
    out = _data(await mcp_client.call_tool("revenue_report", {}))
    assert out["total_revenue"] == 50000
    assert out["outstanding_amount"] == 125000
    assert out["overdue_count"] == 2
    assert out["invoice_count"] == 4


async def test_revenue_report_bad_period(mcp_client):
    with pytest.raises(Exception, match="Invalid period"):
        await mcp_client.call_tool("revenue_report", {"period": "yesterday"})


async def test_client_ranking(mcp_client):
    rows = _data(await mcp_client.call_tool("client_ranking", {}))
    assert rows[0]["client_name"] == "Wayne Enterprises"  # biggest book
    assert rows[0]["total_invoiced"] == 125000
    for row in rows:
        assert row["client_email"] is None  # never leak emails in rankings


# ── document tools ───────────────────────────────────────────────────────────

async def test_linkedin_post_only_for_paid(mcp_client, fake_llms):
    out = _data(await mcp_client.call_tool("generate_linkedin_post", {
        "invoice_id": "inv_1726000003_ccccc"}))
    assert "only generated for paid" in out["error"]

    out = _data(await mcp_client.call_tool("generate_linkedin_post", {
        "invoice_id": "inv_1726000001_aaaaa"}))
    assert "Rahul Sharma" in out["post_text"]
    assert "#freelance" in out["hashtags"]


async def test_certificate_status(mcp_client):
    existing = _data(await mcp_client.call_tool("get_certificate_status", {
        "invoice_id": "inv_1726000001_aaaaa"}))
    assert existing["exists"] is True
    assert existing["certificate_id"] == "cert_123"

    missing = _data(await mcp_client.call_tool("get_certificate_status", {
        "invoice_id": "inv_1726000002_bbbbb"}))
    assert missing["exists"] is False

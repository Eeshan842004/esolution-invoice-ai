"""Parity tests: the Python sheet models must produce EXACTLY the same
derived values as ESolution's sheets.js / karma-calculator.js, since both
processes read and write the same spreadsheet."""

from datetime import date, timedelta

import pytest

from src.sheets.invoice_model import enrich_invoice
from src.sheets.karma_model import (
    hash_email,
    karma_from_delay,
    karma_recommendation,
    karma_score,
    karma_tier,
)

TODAY = date.today()


def _iso(days: int) -> str:
    return (TODAY + timedelta(days=days)).isoformat()


# ── enrich_invoice: status ───────────────────────────────────────────────────

def test_paid_date_wins_over_everything():
    inv = enrich_invoice({"amount": 1000, "due_date": _iso(-100),
                          "paid_date": _iso(-90), "status": "Overdue"})
    assert inv["status"] == "Paid"
    assert inv["days_overdue"] == 0
    assert inv["penalty_amount"] == 0


def test_due_today_is_not_overdue():
    # sheets.js: overdue only when today > dueDate (strictly after)
    inv = enrich_invoice({"amount": 1000, "due_date": _iso(0), "paid_date": ""})
    assert inv["status"] == "Unpaid"
    assert inv["days_overdue"] == 0


def test_one_day_late_is_overdue():
    inv = enrich_invoice({"amount": 1000, "due_date": _iso(-1), "paid_date": ""})
    assert inv["status"] == "Overdue"
    assert inv["days_overdue"] == 1


def test_stored_status_is_never_trusted():
    inv = enrich_invoice({"amount": 1000, "due_date": _iso(-5),
                          "paid_date": "", "status": "Paid"})
    assert inv["status"] == "Overdue"  # recalculated, not read


# ── enrich_invoice: penalty math (2% per started week) ───────────────────────

@pytest.mark.parametrize("days_late,weeks", [
    (1, 1), (7, 1), (8, 2), (10, 2), (14, 2), (15, 3), (45, 7),
])
def test_penalty_per_started_week(days_late, weeks):
    amount = 10000
    inv = enrich_invoice({"amount": amount, "due_date": _iso(-days_late),
                          "paid_date": ""})
    expected = round(weeks * 0.02 * amount, 2)
    assert inv["penalty_amount"] == expected
    # total is amount + penalty (on the ORIGINAL amount, like sheets.js)
    assert inv["total_amount_due"] == round(amount + expected, 2)


def test_discount_final_amount():
    inv = enrich_invoice({"amount": 20000, "discount_percent": 15,
                          "due_date": _iso(5), "paid_date": ""})
    assert inv["final_amount"] == 17000
    assert inv["amount"] == 20000


def test_date_serial_cells_are_understood():
    # A hand-edited due date becomes a date-typed cell; UNFORMATTED_VALUE
    # returns the Google serial (days since 1899-12-30). 46086 = 2026-03-05.
    inv = enrich_invoice({"amount": 5000, "due_date": 46086,
                          "paid_date": 46080})
    assert inv["due_date"] == "2026-03-05"
    assert inv["paid_date"] == "2026-02-27"
    assert inv["status"] == "Paid"


def test_behavior_score_defaults_to_50():
    inv = enrich_invoice({"amount": 100, "due_date": _iso(5),
                          "paid_date": "", "ai_behavior_score": ""})
    assert inv["ai_behavior_score"] == 50
    inv = enrich_invoice({"amount": 100, "due_date": _iso(5),
                          "paid_date": "", "ai_behavior_score": "72"})
    assert inv["ai_behavior_score"] == 72


# ── karma math ───────────────────────────────────────────────────────────────

@pytest.mark.parametrize("delay,label,points", [
    (-5, "on_time", 10), (0, "on_time", 10),
    (1, "slightly_late", 5), (7, "slightly_late", 5),
    (8, "late", 2), (14, "late", 2),
    (15, "very_late", -5), (100, "very_late", -5),
])
def test_karma_buckets(delay, label, points):
    assert karma_from_delay(delay) == (label, points)


def test_karma_score_formula():
    # all on-time -> avg +10 -> ((10+10)/20)*5 = 5.0
    assert karma_score({"on_time_count": 3}) == 5.0
    # all very_late -> avg -5 -> ((-5+10)/20)*5 = 1.2 (rounded 1 decimal)
    assert karma_score({"very_late_count": 2}) == 1.2
    # no data = benefit of the doubt
    assert karma_score({}) == 5.0
    # mixed: (10 + 5) / 2 = 7.5 -> ((7.5+10)/20)*5 = 4.4 (1 decimal)
    assert karma_score({"on_time_count": 1, "slightly_late_count": 1}) == 4.4


def test_karma_tiers_and_recommendations():
    assert karma_tier(4.5) == "green"
    assert karma_tier(4.0) == "green"
    assert karma_tier(3.0) == "yellow"
    assert karma_tier(2.5) == "yellow"
    assert karma_tier(2.4) == "red"
    assert karma_recommendation(1.5).startswith("High risk")
    assert karma_recommendation(4.2).startswith("Reliable")


def test_hash_email_matches_email_hasher_js():
    # md5 of trimmed, lowercased email — must match hashEmail() in JS
    assert hash_email("  Test@Example.COM  ") == \
        hash_email("test@example.com")
    assert hash_email("test@example.com") == "55502f40dc8b7c769880b10874abc9d0"

"""Analytics tools (scope: analytics:read): revenue and client rankings."""

from datetime import date

from fastmcp import FastMCP

from src.sheets.client import get_client
from src.sheets.invoice_model import _parse_date, get_invoices
from src.sheets.karma_model import get_karma
from src.security.input_validator import ValidationError

PERIODS = ("this_month", "last_month", "this_quarter", "all_time")


def _period_bounds(period: str, today: date) -> tuple[date | None, date | None]:
    if period == "this_month":
        return today.replace(day=1), None
    if period == "last_month":
        first_this = today.replace(day=1)
        last_prev = first_this.toordinal() - 1
        first_prev = date.fromordinal(last_prev).replace(day=1)
        return first_prev, first_this
    if period == "this_quarter":
        quarter_month = 3 * ((today.month - 1) // 3) + 1
        return today.replace(month=quarter_month, day=1), None
    return None, None  # all_time


def register_analytics_tools(mcp: FastMCP) -> None:

    @mcp.tool()
    async def revenue_report(period: str = "all_time") -> dict:
        """Revenue breakdown for a period: paid vs outstanding vs overdue.

        Args:
            period: "this_month", "last_month", "this_quarter" or
                "all_time" (default).

        Returns:
            {total_revenue, outstanding_amount, overdue_amount,
             avg_payment_delay_days, paid_count, invoice_count}
            Revenue counts invoices PAID within the period; outstanding and
            overdue reflect the current state of the book.
        """
        period = str(period).strip().lower() or "all_time"
        if period not in PERIODS:
            raise ValidationError(
                f"Invalid period: {period!r}. Expected one of {', '.join(PERIODS)}.")

        today = date.today()
        start, end = _period_bounds(period, today)
        invoices = get_invoices()

        paid_in_period, delays = [], []
        for inv in invoices:
            if inv["status"] != "Paid":
                continue
            paid_on = _parse_date(inv.get("paid_date"))
            if paid_on is None:
                continue
            if start and paid_on < start:
                continue
            if end and paid_on >= end:
                continue
            paid_in_period.append(inv)
            due = _parse_date(inv.get("due_date"))
            if due is not None:
                delays.append((paid_on - due).days)

        unpaid = [i for i in invoices if i["status"] == "Unpaid"]
        overdue = [i for i in invoices if i["status"] == "Overdue"]
        return {
            "period": period,
            "total_revenue": round(sum(i["amount"] for i in paid_in_period), 2),
            "paid_count": len(paid_in_period),
            "outstanding_amount": round(sum(i["amount"] for i in unpaid), 2),
            "overdue_amount": round(sum(i["total_amount_due"] for i in overdue), 2),
            "overdue_count": len(overdue),
            "avg_payment_delay_days": (round(sum(delays) / len(delays), 1)
                                       if delays else 0),
            "invoice_count": len(invoices),
        }

    @mcp.tool()
    async def client_ranking() -> list[dict]:
        """Rank clients by total business, payment speed and karma.

        Returns:
            Clients sorted by total invoiced amount (desc), each with
            total_invoiced, paid/unpaid/overdue counts, avg_days_to_pay
            (negative = pays early) and karma stars/tier when available.
        """
        groups: dict[str, dict] = {}
        for inv in get_invoices():
            email = str(inv.get("client_email", "")).lower()
            name = str(inv.get("client_name", ""))
            key = email or name.lower()
            group = groups.setdefault(key, {
                "client_name": name, "client_email": email,
                "total_invoiced": 0.0, "invoice_count": 0,
                "paid_count": 0, "overdue_count": 0, "delays": [],
            })
            group["total_invoiced"] += inv["amount"]
            group["invoice_count"] += 1
            if inv["status"] == "Paid":
                group["paid_count"] += 1
                paid_on = _parse_date(inv.get("paid_date"))
                due = _parse_date(inv.get("due_date"))
                if paid_on and due:
                    group["delays"].append((paid_on - due).days)
            elif inv["status"] == "Overdue":
                group["overdue_count"] += 1

        # One KarmaDB fetch for the whole ranking (was one per client).
        karma_rows = get_client().list_karma_rows()
        ranking = []
        for group in groups.values():
            delays = group.pop("delays")
            karma = (get_karma(group["client_email"], group["client_name"],
                               rows=karma_rows)
                     if group["client_email"] else {"new_client": True})
            ranking.append({
                **group,
                "client_email": None,  # privacy: names only in rankings
                "total_invoiced": round(group["total_invoiced"], 2),
                "avg_days_to_pay": (round(sum(delays) / len(delays), 1)
                                    if delays else None),
                "karma_stars": karma.get("karma_score"),
                "karma_tier": karma.get("tier"),
            })
        ranking.sort(key=lambda c: c["total_invoiced"], reverse=True)
        return ranking

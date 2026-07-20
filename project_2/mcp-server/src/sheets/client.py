"""gspread-backed access to the shared ESolution spreadsheet.

Design notes:
- Credentials come from the SAME env vars the Next.js app uses
  (GOOGLE_SERVICE_ACCOUNT_EMAIL + GOOGLE_PRIVATE_KEY), so there is exactly
  one identity writing to the sheet. A service-account JSON file is also
  supported (SERVICE_ACCOUNT_PATH) for parity with standard gspread setups.
- The Invoices tab is the FIRST worksheet by index — sheets.js does
  `doc.sheetsByIndex[0]`, so we must too. KarmaDB is found by title and
  created on demand, exactly like /api/karma/submit does.
- Tools never touch gspread directly; they go through the narrow row-level
  API below (list/append/update), which the test-suite swaps for an
  in-memory fake via `set_client()`.
"""

from __future__ import annotations

import threading

from src.config import settings

SCOPES = [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive",
]

INVOICE_HEADERS = [
    "invoice_id",
    "client_name",
    "client_email",
    "amount",
    "due_date",
    "status",
    "discount_percent",
    "final_amount",
    "last_reminder_date",
    "reminder_count",
    "paid_date",
    "penalty_amount",
    "total_amount_due",
    "ai_behavior_score",
    "notes",
    "created_at",
    "legal_notice_sent",
    "payment_method",
    "payment_reference",
    "portal_token",
    "portal_viewed",
    "payment_claimed",
    "client_message",
    "installment_requested",
    "partial_amount_proposed",
    "last_client_reply",
    "client_emotion",
    "emotion_score",
    "reminder_tone",
    "next_reminder_date",
    "certificate_id",
]

KARMA_HEADERS = [
    "client_email_hash",
    "client_name",
    "total_invoices",
    "on_time_count",
    "slightly_late_count",
    "late_count",
    "very_late_count",
    "defaulter_count",
    "average_delay_days",
    "karma_score",
    "user_count",
    "last_updated",
]

KARMA_SHEET_NAME = "KarmaDB"


def gutils_a1(row: int, col: int) -> str:
    """A1 notation for (row, col); lazy import keeps gspread optional in tests."""
    from gspread.utils import rowcol_to_a1

    return rowcol_to_a1(row, col)


class SheetsClient:
    """Thin row-level wrapper around the shared spreadsheet."""

    def __init__(self):
        import gspread
        from google.oauth2.service_account import Credentials

        if settings.service_account_path:
            creds = Credentials.from_service_account_file(
                settings.service_account_path, scopes=SCOPES
            )
        else:
            if not (settings.google_service_account_email and settings.google_private_key):
                raise RuntimeError(
                    "Google Sheets credentials missing: set GOOGLE_SERVICE_ACCOUNT_EMAIL "
                    "and GOOGLE_PRIVATE_KEY (or SERVICE_ACCOUNT_PATH)."
                )
            creds = Credentials.from_service_account_info(
                {
                    "type": "service_account",
                    "client_email": settings.google_service_account_email,
                    # .env stores the key with literal \n, same as sheets.js
                    "private_key": settings.google_private_key.replace("\\n", "\n"),
                    "token_uri": "https://oauth2.googleapis.com/token",
                },
                scopes=SCOPES,
            )
        if not settings.google_sheet_id:
            raise RuntimeError("GOOGLE_SHEET_ID is not set.")
        self._gc = gspread.authorize(creds)
        self.spreadsheet = self._gc.open_by_key(settings.google_sheet_id)
        # Worksheet handles and healed header rows are cached: fetching them
        # is one HTTP round-trip each, and they don't change at runtime.
        self._invoices_ws = None
        self._karma_ws = None
        self._headers_cache: dict[int, list[str]] = {}

    # ── worksheets (cached — metadata fetch costs a round-trip) ─────────────

    @property
    def invoices_sheet(self):
        if self._invoices_ws is None:
            # First tab by index — same as sheets.js `doc.sheetsByIndex[0]`.
            self._invoices_ws = self.spreadsheet.get_worksheet(0)
        return self._invoices_ws

    @property
    def karma_sheet(self):
        import gspread

        if self._karma_ws is None:
            try:
                self._karma_ws = self.spreadsheet.worksheet(KARMA_SHEET_NAME)
            except gspread.exceptions.WorksheetNotFound:
                sheet = self.spreadsheet.add_worksheet(
                    KARMA_SHEET_NAME, rows=100, cols=len(KARMA_HEADERS)
                )
                sheet.append_row(KARMA_HEADERS, value_input_option="RAW")
                self._karma_ws = sheet
        return self._karma_ws

    # ── header healing ──────────────────────────────────────────────────────
    #
    # Real-world sheets often predate newer feature columns (portal, emotion,
    # certificate...). The website tolerates that: addRow() drops unknown
    # fields and enrichInvoice() recomputes derived values on read. We go one
    # step further and heal the header row ADDITIVELY — existing columns and
    # their order are never touched; missing canonical headers are appended
    # at the end, so both processes can persist every field from then on.

    def _ensure_headers(self, sheet, canonical: list[str]) -> list[str]:
        cached = self._headers_cache.get(sheet.id)
        if cached is not None:
            return cached

        actual = [h.strip() for h in sheet.row_values(1)]
        while actual and actual[-1] == "":
            actual.pop()
        if not actual:  # brand-new/empty tab: write the full canonical row
            new_headers = list(canonical)
        else:
            missing = [h for h in canonical if h not in actual]
            if not missing:
                self._headers_cache[sheet.id] = actual
                return actual
            new_headers = actual + missing
        if sheet.col_count < len(new_headers):
            sheet.add_cols(len(new_headers) - sheet.col_count)
        sheet.update(
            values=[new_headers],
            range_name=f"A1:{gutils_a1(1, len(new_headers))}",
            value_input_option="RAW",
        )
        self._headers_cache[sheet.id] = new_headers
        return new_headers

    # ── invoice rows ────────────────────────────────────────────────────────

    def list_invoice_rows(self) -> list[dict]:
        return self._list_rows(self.invoices_sheet, INVOICE_HEADERS)

    def append_invoice_row(self, data: dict) -> dict:
        self._append_row(self.invoices_sheet, INVOICE_HEADERS, data)
        return data

    def update_invoice_row(self, invoice_id: str, updates: dict) -> None:
        self._update_row(self.invoices_sheet, INVOICE_HEADERS,
                         "invoice_id", invoice_id, updates)

    # ── karma rows ──────────────────────────────────────────────────────────

    def list_karma_rows(self) -> list[dict]:
        return self._list_rows(self.karma_sheet, KARMA_HEADERS)

    def append_karma_row(self, data: dict) -> dict:
        self._append_row(self.karma_sheet, KARMA_HEADERS, data)
        return data

    def update_karma_row(self, email_hash: str, updates: dict) -> None:
        self._update_row(self.karma_sheet, KARMA_HEADERS,
                         "client_email_hash", email_hash, updates)

    # ── shared row helpers (aligned to the sheet's ACTUAL headers) ──────────

    def _list_rows(self, sheet, canonical: list[str]) -> list[dict]:
        from gspread.utils import ValueRenderOption

        values = sheet.get_all_values(
            value_render_option=ValueRenderOption.unformatted)
        if not values:
            self._ensure_headers(sheet, canonical)
            return []
        headers = [str(h).strip() for h in values[0]]
        rows = []
        for raw in values[1:]:
            if not any(str(cell).strip() for cell in raw):
                continue  # skip blank lines
            row = {h: "" for h in canonical}
            for i, header in enumerate(headers):
                if header:
                    row[header] = raw[i] if i < len(raw) else ""
            rows.append(row)
        return rows

    def _append_row(self, sheet, canonical: list[str], data: dict) -> None:
        headers = self._ensure_headers(sheet, canonical)
        sheet.append_row([data.get(h, "") for h in headers],
                         value_input_option="RAW")

    def _update_row(self, sheet, canonical: list[str], key_header: str,
                    key_value: str, updates: dict) -> None:
        headers = self._ensure_headers(sheet, canonical)
        key_col = headers.index(key_header) + 1
        cell = sheet.find(str(key_value), in_column=key_col)
        if cell is None:
            raise KeyError(f"Row with {key_header}={key_value!r} not found")
        payload = []
        for field, value in updates.items():
            if field not in headers:
                continue  # never invent columns beyond the healed schema
            payload.append({
                "range": gutils_a1(cell.row, headers.index(field) + 1),
                "values": [[value]],
            })
        if payload:
            sheet.batch_update(payload, value_input_option="RAW")


_client: SheetsClient | None = None
_lock = threading.Lock()


def get_client() -> SheetsClient:
    """Lazily-created singleton, shared across all tools."""
    global _client
    if _client is None:
        with _lock:
            if _client is None:
                _client = SheetsClient()
    return _client


def set_client(client) -> None:
    """Inject a replacement client (tests use an in-memory fake)."""
    global _client
    _client = client

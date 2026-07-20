# ESolution × MCP — Architecture

An AI assistant integrated into a production invoicing app: the ESolution
website (Next.js) keeps working exactly as before, while a LangGraph agent
gains read/write control of the same data through a security-hardened MCP
server. Seven manual clicks become one sentence.

## System diagram

```
┌──────────────────────────────────────────────────────────┐
│                    ESolution Website                      │
│                   (Next.js, port 3000)                    │
│                                                          │
│  ┌──────────┐  ┌────────────┐  ┌────────────────────┐    │
│  │Dashboard │  │ Invoices   │  │  /ai-assistant      │    │
│  │          │  │ /new, /[id]│  │  (chat page)        │    │
│  └────┬─────┘  └─────┬──────┘  └─────────┬──────────┘    │
│       │   existing   │                   │ SSE stream    │
│       └──────┬───────┘                   │               │
│              ▼                           ▼               │
│  ┌───────────────────┐     ┌─────────────────────┐      │
│  │  22 existing API  │     │  /api/mcp-chat       │      │
│  │  routes (unchanged)│     │  (relay route)       │      │
│  └─────────┬─────────┘     └─────────┬───────────┘      │
└────────────┼─────────────────────────┼───────────────────┘
             │ both read/write         │ forwards to agent
             │ the same Sheet          ▼
             ▼               ┌──────────────────┐
    ┌──────────────┐         │  LangGraph Agent  │
    │ Google Sheets │◀────────│  (Groq Llama 3.3) │
    │  (Invoices +  │  writes │  port 8002 (SSE)  │
    │   KarmaDB)    │         └────────┬──────────┘
    └──────▲───────┘                   │ MCP protocol
           │                           │ (streamable HTTP + Bearer JWT)
           │                           ▼
           │                 ┌──────────────────┐
           └─────────────────│   MCP Server      │
             gspread         │  (FastMCP Python)  │
                             │  port 8811         │
                             │  OAuth + JWT +     │
                             │  scopes + rate     │
                             │  limit + audit     │
                             └──────────────────┘
```

## Key design decisions

### The MCP server talks to Google Sheets directly
The Next.js API routes require browser session cookies (NextAuth), so the MCP
server does NOT call them. Instead it uses `gspread` with the **same service
account** the website uses (`GOOGLE_SERVICE_ACCOUNT_EMAIL` +
`GOOGLE_PRIVATE_KEY` from the repo-root `.env.local`). Website and MCP server
are co-tenants of one spreadsheet:

- **Invoices tab** (first worksheet, 31 columns) — mirrored exactly by
  `src/sheets/client.py::INVOICE_HEADERS`.
- **KarmaDB tab** (12 columns) — client reputation, keyed by
  `md5(email.trim().lower())` + name; created on demand.

### Derived fields are recomputed, never stored-trusted
`src/sheets/invoice_model.py::enrich_invoice()` is a line-for-line port of
`enrichInvoice()` in the website's `src/lib/sheets.js`:

- `status`: `paid_date` set → **Paid**; `today > due_date` → **Overdue**;
  else **Unpaid** (note: the sheet's real vocabulary — not "Pending").
- `penalty_amount` = `ceil(days_overdue / 7) × 2% × amount` (per started week).
- `total_amount_due` = `amount + penalty` (on the original amount).
- `final_amount` = `amount × (1 − discount_percent/100)`.

Parity is locked by tests (`tests/test_sheets_models.py`) so both processes
always report identical numbers.

### One process = MCP endpoint + OAuth server
`python -m src.server http` serves `/mcp` (streamable HTTP), `/oauth/token`
(client-credentials grant), OAuth discovery metadata and `/healthz` on port
**8811** (a high port — Windows reserves low ranges). The agent fetches a
token, then connects like any external MCP client. The auth middleware chain
runs on **every** tool call:

```
authenticate (RS256 JWT) → rate-limit → scope-check → execute → audit-log
```

### The agent is Groq-powered (free)
`agent/src/agent.py` builds a LangGraph ReAct loop with **Groq Llama 3.3 70B**
(`langchain-groq`) — the same `GROQ_API_KEY` the website already uses for
voice/emotion/LinkedIn. Tools are loaded over MCP via
`langchain-mcp-adapters`; tokens auto-refresh ~60s before expiry
(`agent/src/mcp_client.py`). FastAPI exposes `POST /api/chat` as an SSE
stream on port **8002**.

### The chat UI lives inside ESolution
`/ai-assistant` is a normal page in the existing app (same NextAuth guard,
same Sidebar, same dark theme). `src/components/ChatInterface.js` streams the
SSE events; every tool invocation renders as a collapsible
`ToolCallCard` (name → input → result), so the demo shows exactly what the
agent did to the real system. The relay route `/api/mcp-chat` checks the
NextAuth session, then pipes the agent's SSE stream through unchanged.

## The 16 tools

| Scope | Tools |
|-------|-------|
| `invoice:read` | `list_invoices`, `get_invoice`, `get_overdue_invoices`, `get_business_summary` |
| `invoice:write` | `create_invoice`, `update_invoice_notes` |
| `payment:write` + `karma:write` | `mark_paid` (auto-updates karma) |
| `reminder:send` | `send_reminder`, `send_legal_notice` (30+ days gate), `run_overdue_sweep` |
| `karma:read` / `karma:write` | `check_karma` / `recalculate_karma` |
| `analytics:read` | `revenue_report`, `client_ranking` |
| `document:read` | `generate_linkedin_post` (paid-only), `get_certificate_status` |

Plus 2 resources (`invoice://business-summary`, `invoice://overdue-report`)
and 4 prompts (morning briefing, new-client intake, collection strategy,
weekly collections review).

## Outbound integrations (server-side)

| Service | How | Reused credential |
|---------|-----|-------------------|
| Google Sheets | `gspread` + `google-auth` | same service account as `sheets.js` |
| Gmail | `smtplib` SSL :465 | same `GMAIL_APP_PASSWORD` as Nodemailer |
| Gemini 2.0 Flash | REST via `httpx` | same `GEMINI_API_KEY` (legal notices) |
| Groq Llama 3.3 | REST via `httpx` | same `GROQ_API_KEY` (LinkedIn posts) |

## Ports & processes

| Process | Port | Start command |
|---------|------|---------------|
| ESolution website | 3000 | `npm run dev` (repo root) |
| MCP server | 8811 | `..\.venv\Scripts\python -m src.server http` (cwd `project_2/mcp-server/`) |
| LangGraph agent | 8002 | `..\.venv\Scripts\python -m uvicorn src.api:app --port 8002` (cwd `project_2/agent/`) |

## What was deliberately NOT changed

- All 22 existing API routes, the model layer (`sheets.js`), auth, emails,
  PDF/certificate generation — untouched.
- The only website changes: the new `/ai-assistant` page + components, the
  `/api/mcp-chat` relay, and one Sidebar link.
- The entire `auth/` and `security/` infrastructure from the original MCP
  server (UniGate) — kept as-is; only scopes, validators and branding were
  re-themed to the invoice domain.

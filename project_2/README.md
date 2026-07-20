# ESolution MCP — AI control plane for a real invoicing system

**A production-grade, OAuth-secured MCP server wired into ESolution**, a live
Next.js invoicing app for Indian freelancers — paired with a Groq-powered
LangGraph agent and a chat page inside the existing website. Seven manual
clicks become one sentence: *"Create an invoice for Rahul, ₹50,000, due in 15
days"*.

Most MCP servers are weekend toys with zero auth. This one is built like a
real service: OAuth 2.1 + RS256 JWTs, 8 per-tool permission scopes
(deny-by-default), SSRF protection, per-client rate limiting, input
validation, structured audit logging, and a **118-test** suite — controlling
**real data** (Google Sheets) with **real side effects** (Gmail reminders,
legal notices, payments, karma scores).

```
ESolution UI (/ai-assistant)  ──▶  LangGraph Agent  ──▶  MCP Server        ──▶  Google Sheets
  :3000 (Next.js, existing app)     :8002 (Groq, SSE)     :8811 (MCP + OAuth)     (Invoices + KarmaDB)
```

- **16 tools · 2 resources · 4 prompts** over invoices, payments, reminders,
  client karma, analytics and documents.
- Every tool call is **authenticated, authorized, rate-limited, validated,
  and audited**. See [docs/SECURITY_WRITEUP.md](docs/SECURITY_WRITEUP.md).
- The MCP server and the website are **co-tenants of the same Google Sheet** —
  the Python enrichment math is a tested, exact port of the site's
  `sheets.js`.

## Quick start (local)

Prerequisites: Python 3.11+, the ESolution repo-root `.env.local` already
configured (Google Sheets service account, Gmail app password, `GROQ_API_KEY`,
`GEMINI_API_KEY` — the MCP server and agent reuse those automatically).

```bash
# 0. one-time: RSA key pair for JWT signing (already in keys/ if generated)
bash scripts/generate_keys.sh

# 1. install into the shared venv
python -m venv .venv
.venv/Scripts/pip install -e mcp-server -e agent      # (.venv/bin/pip on Unix)

# 2. MCP server  → http://localhost:8811  (MCP at /mcp, OAuth at /oauth/token)
cd mcp-server
../.venv/Scripts/python -m src.server http

# 3. Agent (new terminal)  → http://localhost:8002
cd agent
../.venv/Scripts/python -m uvicorn src.api:app --port 8002

# 4. Website (new terminal, repo root)  → http://localhost:3000/ai-assistant
npm run dev
```

> **Windows note:** the MCP server defaults to port **8811** because low
> ports (8000/8001) often sit in a Windows reserved range.

## Try it without the LLM

The MCP server is fully functional on its own:

```bash
# stdio + MCP Inspector
cd mcp-server && ../.venv/Scripts/python -m fastmcp dev src/server.py

# or over HTTP with a token
curl -X POST http://localhost:8811/oauth/token \
  -d "grant_type=client_credentials&client_id=esolution-agent&client_secret=change-me-in-production"
```

## Testing

```bash
cd mcp-server && ../.venv/Scripts/python -m pytest tests/ -v     # 118 tests, no network needed
cd agent && ../.venv/Scripts/python -m pytest tests/ -v          # integration (needs server up)
```

## Project layout

```
project_2/
├── mcp-server/     FastMCP server: 16 invoice tools, resources, prompts,
│                   auth (OAuth/JWT/scopes), security (SSRF/rate-limit/audit),
│                   sheets/ (gspread models mirroring the site's sheets.js),
│                   services/ (Gmail smtplib, Gemini, Groq)
├── agent/          LangGraph agent (Groq Llama 3.3 70B) + FastAPI SSE API
├── start.sh        runs both Python services (Render deploy)
├── render.yaml     Render blueprint
├── scripts/        generate_keys.sh
├── docs/           ARCHITECTURE, SECURITY_WRITEUP, API_REFERENCE
└── keys/           RSA key pair (git-ignored)
```

The website-side integration lives in the ESolution repo root:
`src/app/ai-assistant/` (chat page), `src/components/ChatInterface.js` +
`ToolCallCard.js`, and `src/app/api/mcp-chat/route.js` (session-guarded SSE
relay to the agent).

## Documentation

- [Architecture](docs/ARCHITECTURE.md) — components, data flow, design decisions.
- [Security write-up](docs/SECURITY_WRITEUP.md) — threat model + controls.
- [API reference](docs/API_REFERENCE.md) — tools, scopes, and endpoints.

## Configuration

Settings come from the repo-root `.env.local` (shared with the website) plus
optional `mcp-server/.env` / `agent/.env` overrides — see
[.env.example](.env.example). Key ones: `GROQ_API_KEY`, `GOOGLE_SHEET_ID`,
`GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_PRIVATE_KEY`, `GMAIL_APP_PASSWORD`,
`OAUTH_CLIENT_SECRET`, `RATE_LIMIT_RPM`, `JWT_EXPIRY_MINUTES`.

## License

MIT (portfolio / educational project).

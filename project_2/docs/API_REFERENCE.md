# ESolution MCP — API Reference

## OAuth token endpoint

```
POST /oauth/token          (application/x-www-form-urlencoded)
  grant_type=client_credentials
  client_id=<id>
  client_secret=<secret>
  scope=<space-separated scopes>      # optional; defaults to the client's full set

→ 200 { "access_token": "<jwt>", "token_type": "bearer",
        "expires_in": 3600, "scope": "invoice:read payment:write ..." }
```

Discovery: `GET /.well-known/oauth-authorization-server` (RFC 8414 metadata).

### Demo clients

| client_id | secret | scopes |
|-----------|--------|--------|
| `esolution-agent` | `change-me-in-production` | all 8 invoice-domain scopes (never `admin`) |
| `esolution-readonly` | `readonly-secret-change-me` | `invoice:read`, `karma:read`, `analytics:read` |
| `esolution-admin` | `admin-secret-change-me` | `admin` (all) |

## Scopes

`invoice:read`, `invoice:write`, `payment:write`, `reminder:send`,
`karma:read`, `karma:write`, `analytics:read`, `document:read`,
`admin` (implies all).

## Calling tools

MCP endpoint: `POST /mcp` (Streamable HTTP) on port **8811**, header
`Authorization: Bearer <jwt>` and `Accept: application/json, text/event-stream`.
Use an MCP client (FastMCP `Client`, Claude Desktop, `langchain-mcp-adapters`),
or the MCP Inspector (`fastmcp dev src/server.py`).

---

## Tools (16)

Identifier formats: invoice id `inv_1726123456_a3f9c`, dates `YYYY-MM-DD`,
statuses `Unpaid`/`Pending` (alias), `Overdue`, `Paid`; amounts in INR.

### Invoices — read
| Tool | Params | Scopes | Returns |
|------|--------|--------|---------|
| `list_invoices` | `status?`, `client_name?`, `limit?` | `invoice:read` | Filtered summaries (emails masked), newest first. |
| `get_invoice` | `invoice_id` | `invoice:read` | Full row, all 31 columns, enriched (status/penalty recomputed). |
| `get_overdue_invoices` | — | `invoice:read` | Overdue list, most overdue first, penalties calculated. |
| `get_business_summary` | — | `invoice:read` | Counts by status + revenue / unpaid / overdue totals. |

### Invoices — write
| Tool | Params | Scopes | Returns |
|------|--------|--------|---------|
| `create_invoice` | `client_name`, `client_email`, `amount`, `due_date`, `notes?`, `discount_percent?` | `invoice:write` | `{invoice_id, portal_token, portal_url, final_amount}`. No email/PDF side effects. |
| `update_invoice_notes` | `invoice_id`, `notes` | `invoice:write` | `{success}` — cannot touch money/status fields. |

### Payments
| Tool | Params | Scopes | Returns |
|------|--------|--------|---------|
| `mark_paid` | `invoice_id`, `payment_method?`, `payment_reference?` | `payment:write`, `karma:write` | `{success, paid_date, karma_updated, karma}` — auto-updates the client's KarmaDB row. |

### Reminders
| Tool | Params | Scopes | Returns |
|------|--------|--------|---------|
| `send_reminder` | `invoice_id` | `reminder:send` | `{sent, tone_used, days_overdue}` — validates the invoice is genuinely overdue; tone from the sheet's emotion analysis, else day-tiered. |
| `send_legal_notice` | `invoice_id` | `reminder:send` | `{sent, notice_text_preview}` — Gemini-drafted demand letter; **gated to 30+ days overdue**. |
| `run_overdue_sweep` | — | `reminder:send` | `{invoices_checked, reminders_sent, skipped}` — bulk pass respecting `next_reminder_date` and the 3-day throttle. |

### Karma
| Tool | Params | Scopes | Returns |
|------|--------|--------|---------|
| `check_karma` | `client_email`, `client_name` | `karma:read` | `{stars 0-5, tier, recommendation, history counts}` or `{new_client: true}`. |
| `recalculate_karma` | `client_email`, `client_name` | `karma:write` | `{new_stars, new_tier, invoices_counted}` — rebuilt from all paid invoices. |

### Analytics
| Tool | Params | Scopes | Returns |
|------|--------|--------|---------|
| `revenue_report` | `period?` (`this_month`/`last_month`/`this_quarter`/`all_time`) | `analytics:read` | Revenue in period + current outstanding/overdue + avg payment delay. |
| `client_ranking` | — | `analytics:read` | Clients by total business, payment speed, karma stars (emails omitted). |

### Documents
| Tool | Params | Scopes | Returns |
|------|--------|--------|---------|
| `generate_linkedin_post` | `invoice_id`, `project_description?` | `document:read` | `{post_text, hashtags}` via Groq — **paid invoices only**. |
| `get_certificate_status` | `invoice_id` | `document:read` | `{exists, certificate_id, download_url}`. |

---

## Resources (2)

| URI | Description |
|-----|-------------|
| `invoice://business-summary` | Live snapshot: counts by status, revenue, outstanding, overdue. |
| `invoice://overdue-report` | All overdue invoices with penalties, most overdue first. |

## Prompts (4)

| Name | Params | Purpose |
|------|--------|---------|
| `morning_briefing` | — | Daily money-on-the-table briefing. |
| `new_client_intake` | `client_name`, `client_email` | Karma-based due diligence before invoicing. |
| `collection_strategy` | `invoice_id` | Escalation plan for one overdue invoice. |
| `weekly_collections_review` | — | Weekly chase-list with priorities. |

---

## Agent API (port 8002)

| Method / Path | Body | Response |
|---------------|------|----------|
| `GET /health` | — | `{ "status": "ok" }` |
| `GET /api/tools` | — | `{ "tools": [ { "name", "description" } ] }` |
| `POST /api/chat` | `{ "message": "..." }` | SSE stream of `text` / `tool_call` / `tool_result` / `error` events, terminated by `[DONE]`. |

The website relays to this via `POST /api/mcp-chat` (NextAuth-session-guarded).

### Example (curl)

```bash
# 1. Get a token
TOKEN=$(curl -s -X POST http://localhost:8811/oauth/token \
  -d "grant_type=client_credentials&client_id=esolution-agent&client_secret=change-me-in-production&scope=invoice:read analytics:read" \
  | python -c "import sys,json;print(json.load(sys.stdin)['access_token'])")

# 2. List tools over MCP
curl http://localhost:8811/mcp \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","method":"tools/list","id":1}'

# 3. Ask the agent (needs the agent running on :8002)
curl -N -X POST http://localhost:8002/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"list my overdue invoices"}'
```

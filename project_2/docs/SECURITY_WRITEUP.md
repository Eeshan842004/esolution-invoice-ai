# ESolution MCP — Security Write-up

Most of the 22,000+ public MCP servers ship with no authentication, no
authorization, and no input validation. This one is built the other way:
every tool call is authenticated, authorized, rate-limited, validated, and
audited — and it isn't a demo: the tools create real invoices, send real
emails and mark real payments in a production invoicing system used by a
freelancer (the ESolution Next.js app, sharing the same Google Sheet).

---

## 1. Threat model (OWASP-aligned, MCP-specific)

| # | Risk | Control |
|---|------|---------|
| 1 | **Unauthenticated tool access** | OAuth 2.1 Bearer JWT required on every HTTP tool call; unauthenticated discovery returns an empty tool list. |
| 2 | **Broken authorization / privilege escalation** | Per-tool permission scopes, deny-by-default for unregistered tools, `admin` as the only implicit super-scope. |
| 3 | **Confused-deputy / token passthrough** | JWT audience + issuer are validated on every request; the server never forwards its received token to Google Sheets, Gmail, Groq or Gemini — each downstream uses its own credential. |
| 4 | **Algorithm-confusion attacks** | Verification algorithm is pinned to RS256; HS256-forged tokens signed with the public key are rejected. |
| 5 | **Injection into the datastore** | Google Sheets is written through structured cell updates only (no query language); identifiers (`inv_*` ids, emails, dates, statuses) are regex-validated; free text is sanitized before storage. |
| 6 | **SSRF** | `ssrf_guard` blocks private/loopback/link-local ranges, cloud-metadata endpoints, non-HTTP schemes, and credential-bearing URLs, with optional DNS-resolution checks. |
| 7 | **Denial of service / abuse** | Per-client token-bucket rate limiting on tools and on the token endpoint. Matters more here than in a demo: several tools send email — an unthrottled agent loop could spam real clients. |
| 8 | **Information disclosure via errors** | `mask_error_details=True` hides stack traces, credentials, and internal paths; only safe validation messages reach clients. |
| 9 | **PII leakage in logs** | Audit logger redacts any argument whose key looks sensitive (token/secret/password/key) and truncates long values. Client emails never enter the KarmaDB tab at all — clients are keyed by `md5(email)`. |
| 10 | **Cross-origin abuse** | CORS restricted to the ESolution origin; security headers (`X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`) on every response. |
| 11 | **Credential brute-force** | Constant-time secret comparison; a stricter rate limit on `/oauth/token`; identical error for bad id vs. bad secret. |
| 12 | **Agent over-reach (real-world side effects)** | Business-rule gates inside tools: reminders only for genuinely overdue invoices (recomputed, never trusted from the caller), legal notices only at 30+ days overdue, LinkedIn posts only for paid invoices, sweep respects per-invoice reminder throttles, `update_invoice_notes` cannot touch money fields. |

---

## 2. Authentication architecture

- **Grant:** OAuth 2.1 **client-credentials**. Clients exchange
  `client_id` + `client_secret` at `POST /oauth/token` for a short-lived JWT.
- **Signing:** **RS256** (asymmetric). The auth server signs with the private
  key; the MCP server verifies with the **public key only** — the resource
  server never holds signing material.
- **Claims validated on every call** (`src/auth/jwt_handler.py`):
  - `aud` = `esolution-mcp` (audience binding — a token minted for another
    service is rejected).
  - `iss` = `esolution-auth`.
  - `exp`, `iat`, `nbf`, and the presence of `sub`, `aud`, `iss` are required.
  - `algorithms=["RS256"]` is pinned so the header's `alg` is never trusted.

```python
jwt.decode(
    token, public_key,
    algorithms=["RS256"],          # pinned — blocks alg-confusion
    audience="esolution-mcp",      # blocks confused-deputy / token reuse
    issuer="esolution-auth",
    options={"require": ["exp", "iat", "aud", "iss", "sub"]},
)
```

- **Client secrets** are compared with `hmac.compare_digest` (constant time).
  The demo registry is in-memory; a production deployment swaps in a real IdP
  (Keycloak / Auth0 / Entra ID) or a hashed-secret table.

---

## 3. Authorization (scopes)

Each tool declares the scopes it requires (`src/auth/scopes.py`). The token's
scopes must be a superset. The invoice domain uses 8 scopes:

```
invoice:read    invoice:write    payment:write    reminder:send
karma:read      karma:write      analytics:read   document:read
```

- **Deny-by-default:** a tool missing from the scope map requires `admin`, so a
  newly added tool can't be silently world-callable.
- **Multi-scope tools:** `mark_paid` needs both `payment:write` **and**
  `karma:write`, because recording a payment also rewrites the client's
  reputation row.
- **Write separation:** a read-only client (`esolution-readonly`) can list and
  analyze invoices but can never create one, mark one paid, or email a client.
- **Scoped discovery:** `on_list_tools` filters the advertised tool set to what
  the caller's token can actually invoke — clients don't even see tools they
  can't use.

---

## 4. SSRF prevention

`src/security/ssrf_guard.py` validates any outbound URL:

- **Scheme allowlist:** only `http`/`https`.
- **Blocked IP ranges:** loopback, RFC1918 private, link-local
  (`169.254.0.0/16`, incl. `169.254.169.254` cloud metadata), CGNAT,
  IPv6 loopback/ULA/link-local, and IPv4-mapped IPv6 (blocks the
  `::ffff:127.0.0.1` bypass).
- **Blocked hostnames:** `localhost`, `metadata.google.internal`, etc.,
  case-insensitive and trailing-dot-normalized.
- **No embedded credentials** (`user:pass@host`).
- **Optional DNS resolution** to catch hostnames pointing at private addresses.

The server's own outbound calls go only to pinned hosts (Google Sheets API,
Gmail SMTP, Groq, Gemini) — no tool ever fetches a caller-supplied URL.

---

## 5. Input validation

- **Identifier validation** (`src/security/input_validator.py`): invoice ids
  must match `inv_<timestamp>_<5 hex>`; emails, ISO dates, statuses, amounts
  (positive, capped) and discounts (0-100) are all checked and normalized
  before use; malformed input is rejected with a clear message.
- **Amount bounds:** positive, rounded to paise, capped at ₹10⁹ — a prompt-
  injected "create an invoice for ₹999999999999" fails validation.
- **Sanitization:** free text (names, notes, references) is length-capped,
  stripped of control characters, and HTML-escaped before it can be stored in
  the sheet or echoed into HTML emails (stored-XSS prevention).
- **Derived fields are never trusted:** status, days overdue and penalties are
  recomputed from raw dates on every read — a tampered `status` cell cannot
  make a paid invoice look overdue or vice versa.
- **Client-safe errors:** validation exceptions subclass FastMCP's `ToolError`,
  so their (safe) messages reach the client while everything else is masked.

---

## 6. Rate limiting

Token-bucket per `client_id` (`src/security/rate_limiter.py`): `burst` capacity
refilled at `rpm/60` tokens per second. Applied to every tool call and, more
strictly, to the token endpoint to slow credential stuffing. In-memory by
design — swap for a Redis-backed bucket in a multi-replica deployment.

---

## 7. Audit trail

Every tool call emits one structured JSON log line
(`src/security/audit_logger.py`): `client_id`, `tool`, redacted `args`, `status`
(`success` / `error` / `denied` / `rate_limited`), `latency_ms`, and timestamp.
Auth events (token issued, invalid client, rate-limited) are logged too. For a
system that emails real clients and marks real payments, this is the
accountability layer: who asked the agent to do what, and when.

---

## 8. Error handling

`mask_error_details=True` on the FastMCP server converts unexpected exceptions
into a generic `Error calling tool <name>` — no stack traces, no service-account
keys, no file paths. Validation and SSRF errors are the deliberate exception:
they subclass `ToolError`, so their actionable messages pass through unmasked.

---

## 9. How this compares

| Feature | Typical MCP server | ESolution MCP |
|---------|--------------------|---------------|
| Auth | none / static API key | OAuth 2.1 + RS256 JWT + audience binding |
| Authorization | none | 8 per-tool scopes, deny-by-default |
| SSRF protection | none | IP/host/scheme blocklist + DNS checks |
| Rate limiting | none | Token bucket per client |
| Input validation | none | Regex + sanitization + amount caps |
| Side-effect gates | none | Overdue/paid/30-day business rules in-tool |
| PII handling | raw everywhere | md5-hashed emails in KarmaDB, masked emails in listings, redacted logs |
| Audit logging | none | Structured per-call logs |
| Token passthrough | common | Explicitly forbidden |
| Error handling | stack traces leaked | Masked, with safe validation messages |

---

## 10. Testing

The controls are covered by an automated suite (`mcp-server/tests/`,
**118 tests**): JWT create/verify, expiry, wrong-audience, wrong-issuer,
tampered-token, HS256 alg-confusion, missing-claims; scope-model checks
including read-only tokens being unable to reach any write/send tool; SSRF
blocked/allowed cases incl. IPv4-mapped and metadata endpoints; rate-limit
burst/refill/isolation; input-validation and injection-attempt rejection;
sheet-model parity tests locking the Python enrichment math to sheets.js; and
end-to-end tool tests through a real in-process MCP client (middleware
included) covering reminder gating, legal-notice gating, throttled sweeps,
karma math and email capture.

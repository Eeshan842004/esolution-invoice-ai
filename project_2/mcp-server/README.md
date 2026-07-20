# UniGate MCP Server

The secure, OAuth-protected FastMCP server at the heart of UniGate. Exposes the
university academic database as **19 tools, 4 resources, and 4 prompts**, with
authentication, per-tool scopes, rate limiting, SSRF protection, input
validation, and audit logging on every call.

See the [repository README](../README.md) and
[docs/](../docs) for the full picture.

## Run

```bash
pip install -e .

# stdio (local dev / MCP Inspector / Claude Desktop)
python -m src.server

# streamable HTTP (MCP at /mcp, OAuth at /oauth/token) on port 8000
python -m src.server http
```

Set `DATABASE_URL` (PostgreSQL or `sqlite+aiosqlite:///./unigate.db`). Seed with
`python -m src.db.seed`. Configuration is via environment / `.env` — see
`src/config.py`.

## Test

```bash
pytest tests/ -v     # 82 tests, in-memory SQLite, no external services
```

## Layout

```
src/
├── server.py          FastMCP + FastAPI entry point (stdio / http)
├── config.py          pydantic-settings
├── auth/              JWT (RS256), OAuth token server, scopes, middleware
├── security/          rate limiter, SSRF guard, input validator, audit logger
├── db/                async SQLAlchemy models, engine, seed
├── tools/             student/course/grade/attendance/faculty/timetable/analytics
├── resources/         department, calendar, syllabus
└── prompts/           advisor, report generator
```

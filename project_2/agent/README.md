# UniGate Agent

A LangGraph agent that connects to the UniGate MCP server as an
OAuth-authenticated client, using **Claude Opus 4.8** via `langchain-anthropic`
and bridging MCP tools through `langchain-mcp-adapters`. Exposes a FastAPI SSE
chat endpoint for the Next.js UI.

See the [repository README](../README.md) for the full stack.

## Run

```bash
pip install -e .
ANTHROPIC_API_KEY=sk-ant-... uvicorn src.api:app --host 0.0.0.0 --port 8002
```

Requires the MCP server to be reachable (`MCP_SERVER_URL`, `AUTH_TOKEN_URL`).
The agent fetches a read-only Bearer token via the client-credentials grant and
refreshes it automatically.

## Endpoints

| Method / Path | Purpose |
|---------------|---------|
| `GET /health` | Liveness. |
| `GET /api/tools` | MCP tools available to the agent (for the UI sidebar). |
| `POST /api/chat` | Stream the agent's response as Server-Sent Events. |

## Test

```bash
pytest tests/ -v     # integration tests; skip automatically if the MCP server is down
```

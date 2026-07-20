#!/usr/bin/env bash
# Render / any-host start script for the Python side of ESolution.
#
# Runs BOTH Python processes in one service:
#   - MCP server  → internal, port 8811 (serves /mcp + /oauth/token)
#   - LangGraph agent → public, binds to $PORT (what the website's
#     /api/mcp-chat relay calls)
# The agent reaches the MCP server over localhost, so only the agent's
# port is exposed to the internet.
set -euo pipefail
cd "$(dirname "$0")"

# RSA keys for JWT signing. The same process signs (/oauth/token) and
# verifies (/mcp), so freshly generated keys per deploy are fine.
if [ ! -f keys/private.pem ]; then
  echo "Generating RSA key pair..."
  mkdir -p keys
  openssl genpkey -algorithm RSA -out keys/private.pem -pkeyopt rsa_keygen_bits:2048
  openssl rsa -pubout -in keys/private.pem -out keys/public.pem
fi

# 1. MCP server in the background on 8811 (internal only)
( cd mcp-server && python -m src.server http ) &

# 2. Wait for it to accept connections before the agent tries to load tools
for i in $(seq 1 30); do
  if curl -sf http://localhost:8811/healthz >/dev/null 2>&1; then
    echo "MCP server is up."
    break
  fi
  sleep 1
done

# 3. Agent in the foreground on the platform-assigned $PORT
cd agent
exec python -m uvicorn src.api:app --host 0.0.0.0 --port "${PORT:-8002}"

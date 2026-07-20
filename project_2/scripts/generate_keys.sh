#!/usr/bin/env bash
# Generate the RSA key pair used to sign/verify JWTs.
# Usage: ./scripts/generate_keys.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
KEYS_DIR="$ROOT/keys"
mkdir -p "$KEYS_DIR"

if [[ -f "$KEYS_DIR/private.pem" ]]; then
  echo "keys/private.pem already exists — refusing to overwrite. Delete it first to regenerate."
  exit 0
fi

openssl genrsa -out "$KEYS_DIR/private.pem" 2048
openssl rsa -in "$KEYS_DIR/private.pem" -pubout -out "$KEYS_DIR/public.pem"

# The MCP server image expects the keys under mcp-server/keys when run outside Docker.
mkdir -p "$ROOT/mcp-server/keys"
cp "$KEYS_DIR/private.pem" "$KEYS_DIR/public.pem" "$ROOT/mcp-server/keys/"

echo "Generated RSA key pair in keys/ (and copied to mcp-server/keys/)."

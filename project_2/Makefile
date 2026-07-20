# ESolution MCP — developer convenience targets.
# Cross-platform note: the venv python lives at .venv/Scripts/python on Windows
# and .venv/bin/python on Unix. Override with `make PY=... <target>` if needed.

PY ?= .venv/Scripts/python
PIP = $(PY) -m pip

.PHONY: help keys venv install-server install-agent test \
        run-server run-agent run-website inspector

help:
	@echo "ESolution MCP make targets:"
	@echo "  keys            Generate RSA JWT key pair (keys/)"
	@echo "  venv            Create a Python virtualenv (.venv)"
	@echo "  install-server  Install MCP server deps into the venv"
	@echo "  install-agent   Install agent deps into the venv"
	@echo "  test            Run the MCP server test suite (118 tests)"
	@echo "  run-server      Run the MCP server over HTTP (:8811)"
	@echo "  run-agent       Run the LangGraph agent API (:8002)"
	@echo "  run-website     Run the ESolution Next.js dev server (:3000)"
	@echo "  inspector       Open the MCP Inspector against the server (stdio)"

keys:
	bash scripts/generate_keys.sh

venv:
	python -m venv .venv

install-server:
	$(PIP) install -e mcp-server

install-agent:
	$(PIP) install -e agent

test:
	cd mcp-server && ../$(PY) -m pytest tests/ -v

run-server:
	cd mcp-server && ../$(PY) -m src.server http

run-agent:
	cd agent && ../$(PY) -m uvicorn src.api:app --host 0.0.0.0 --port 8002

run-website:
	cd .. && npm run dev

inspector:
	cd mcp-server && ../$(PY) -m fastmcp dev src/server.py

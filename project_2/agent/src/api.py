"""FastAPI server exposing the ESolution agent over an SSE chat endpoint.

Endpoints:
    GET  /health           liveness
    GET  /api/tools        list the MCP tools the agent has (for the UI sidebar)
    POST /api/chat         stream the agent's response as Server-Sent Events

SSE event payloads (each `data:` line is a JSON object with a `type`):
    {"type":"text","content":"..."}                 assistant text delta
    {"type":"tool_call","name":"...","input":{...}} a tool is being invoked
    {"type":"tool_result","name":"...","output":"..."}  tool returned
    {"type":"error","content":"..."}                error
    [DONE]                                          stream complete
"""

import json
import uuid

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from langchain_core.messages import HumanMessage
from pydantic import BaseModel

from src.agent import get_agent
from src.config import settings
from src.mcp_client import load_mcp_tools

app = FastAPI(title="ESolution Agent API", docs_url="/docs")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type"],
)


class ChatRequest(BaseModel):
    message: str
    conversation_id: str = ""


@app.get("/health")
async def health():
    return {"status": "ok", "service": "esolution-agent"}


@app.get("/api/tools")
async def list_tools():
    """Expose available MCP tools for the UI sidebar."""
    try:
        tools = await load_mcp_tools()
        return {
            "tools": [
                {"name": t.name, "description": (t.description or "").split("\n")[0]}
                for t in tools
            ]
        }
    except Exception as exc:  # MCP server unreachable / auth failed
        return {"tools": [], "error": str(exc)}


def _sse(obj: dict) -> str:
    return f"data: {json.dumps(obj)}\n\n"


@app.post("/api/chat")
async def chat(request: ChatRequest):
    async def stream():
        try:
            agent = await get_agent()
        except Exception as exc:
            yield _sse({"type": "error",
                        "content": f"Could not reach the ESolution MCP server: {exc}"})
            yield "data: [DONE]\n\n"
            return

        inputs = {"messages": [HumanMessage(content=request.message)]}
        # Each conversation_id is a checkpointer thread: prior turns are
        # restored automatically, enabling multi-turn detail gathering.
        config = {"configurable": {
            "thread_id": request.conversation_id or uuid.uuid4().hex}}
        try:
            async for event in agent.astream_events(inputs, version="v2",
                                                    config=config):
                kind = event["event"]
                if kind == "on_chat_model_stream":
                    chunk = event["data"]["chunk"]
                    text = _text_of(chunk)
                    if text:
                        yield _sse({"type": "text", "content": text})
                elif kind == "on_tool_start":
                    yield _sse({
                        "type": "tool_call",
                        "name": event["name"],
                        "input": event["data"].get("input", {}),
                    })
                elif kind == "on_tool_end":
                    output = event["data"].get("output")
                    yield _sse({
                        "type": "tool_result",
                        "name": event["name"],
                        "output": _stringify(output)[:1500],
                    })
        except Exception as exc:
            yield _sse({"type": "error", "content": str(exc)})
        yield "data: [DONE]\n\n"

    return StreamingResponse(
        stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no",
                 "Connection": "keep-alive"},
    )


def _text_of(chunk) -> str:
    """Extract plain text from an AIMessageChunk, ignoring tool-call parts."""
    content = getattr(chunk, "content", "")
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts = []
        for block in content:
            if isinstance(block, dict) and block.get("type") == "text":
                parts.append(block.get("text", ""))
            elif isinstance(block, str):
                parts.append(block)
        return "".join(parts)
    return ""


def _stringify(output) -> str:
    """Best-effort string form of a ToolNode/tool output for the UI."""
    content = getattr(output, "content", None)
    if content is not None:
        return content if isinstance(content, str) else json.dumps(content, default=str)
    return str(output)

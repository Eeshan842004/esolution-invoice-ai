"""LangGraph agent: an explicit StateGraph wiring Kie.ai's Gemini 2.5 Flash
to the ESolution MCP tools with a standard agent/tools loop.

Kie.ai exposes an OpenAI-compatible /v1/chat/completions endpoint, so the
model is wired via langchain_openai.ChatOpenAI pointed at Kie.ai's base_url
rather than a dedicated LangChain integration. Kie.ai selects the model via
the URL path (https://api.kie.ai/<model>/v1), not the "model" body field —
ChatOpenAI still has to send SOME model string in the body (the OpenAI SDK
requires one), so `model=settings.agent_model` is passed too; Kie.ai is
expected to ignore it in favor of the path segment.

The graph is compiled once and cached, with an in-memory checkpointer so
each conversation_id (thread) keeps its history across requests — required
for multi-turn flows like "create an invoice" -> "what's the email?" ->
"rahul@x.com". Memory is per-process by design; restart clears it.
"""

from datetime import date

from langchain_core.messages import SystemMessage
from langchain_openai import ChatOpenAI
from langgraph.checkpoint.memory import InMemorySaver
from langgraph.graph import START, StateGraph
from langgraph.prebuilt import ToolNode, tools_condition

from src.config import settings
from src.mcp_client import load_mcp_tools
from src.prompts import SYSTEM_PROMPT
from src.state import AgentState

_graph = None


async def build_agent():
    """Build and compile the agent graph (loads MCP tools once)."""
    tools = await load_mcp_tools()

    # Only pass api_key explicitly if configured; otherwise ChatOpenAI reads
    # OPENAI_API_KEY from the environment (passing None overrides that) —
    # we don't want that fallback here since this is a Kie.ai key.
    model_kwargs = {
        "model": settings.agent_model,
        "base_url": f"https://api.kie.ai/{settings.agent_model}/v1",
        "temperature": 0, "max_tokens": 4096, "timeout": 120,
    }
    if settings.kie_api_key:
        model_kwargs["api_key"] = settings.kie_api_key
    model = ChatOpenAI(**model_kwargs).bind_tools(tools)

    async def call_model(state: AgentState):
        # Rebuilt per call so long-lived processes don't serve a stale date.
        system = SystemMessage(
            content=SYSTEM_PROMPT.replace("{today}", date.today().isoformat()))
        response = await model.ainvoke([system, *state["messages"]])
        return {"messages": [response]}

    builder = StateGraph(AgentState)
    builder.add_node("agent", call_model)
    builder.add_node("tools", ToolNode(tools))
    builder.add_edge(START, "agent")
    # tools_condition routes "agent" -> "tools" (if a tool was called) or -> END.
    builder.add_conditional_edges("agent", tools_condition)
    builder.add_edge("tools", "agent")
    return builder.compile(checkpointer=InMemorySaver())


async def get_agent():
    """Return the compiled agent, building it on first call."""
    global _graph
    if _graph is None:
        _graph = await build_agent()
    return _graph

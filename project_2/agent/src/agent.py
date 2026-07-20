"""LangGraph agent: an explicit StateGraph wiring Groq Llama 3.3 70B to the
ESolution MCP tools with a standard agent/tools loop.

The graph is compiled once and cached, with an in-memory checkpointer so
each conversation_id (thread) keeps its history across requests — required
for multi-turn flows like "create an invoice" -> "what's the email?" ->
"rahul@x.com". Memory is per-process by design; restart clears it.
"""

from datetime import date

from langchain_core.messages import SystemMessage
from langchain_groq import ChatGroq
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

    # Only pass api_key explicitly if configured; otherwise ChatGroq reads
    # GROQ_API_KEY from the environment (passing None overrides that).
    model_kwargs = {"model": settings.agent_model, "temperature": 0,
                    "max_tokens": 4096, "timeout": 120}
    if settings.groq_api_key:
        model_kwargs["api_key"] = settings.groq_api_key
    model = ChatGroq(**model_kwargs).bind_tools(tools)

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

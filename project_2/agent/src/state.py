"""Agent state schema.

We use LangGraph's prebuilt MessagesState shape (a `messages` list with an
add-messages reducer), re-exported here so the rest of the package has a
single import point and room to extend later.
"""

from langgraph.graph import MessagesState


class AgentState(MessagesState):
    """Conversation state: just the running message list for now."""

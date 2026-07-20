import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

const AGENT_URL = process.env.AGENT_URL || "http://localhost:8002";

/**
 * POST /api/mcp-chat — Relay a chat message to the LangGraph agent
 * (port 8002) and stream its SSE response back to the browser.
 *
 * The agent itself authenticates to the MCP server (port 8811) with its
 * own OAuth client-credentials token; this route only guards the browser
 * side with the same NextAuth session the dashboard uses.
 */
export async function POST(request) {
    const session = await getServerSession(authOptions);
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let message, conversation_id;
    try {
        ({ message, conversation_id } = await request.json());
    } catch {
        return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    if (!message || typeof message !== "string") {
        return NextResponse.json({ error: "message is required" }, { status: 400 });
    }

    let agentResponse;
    try {
        agentResponse = await fetch(`${AGENT_URL}/api/chat`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                message,
                conversation_id: typeof conversation_id === "string" ? conversation_id : "",
            }),
        });
    } catch (err) {
        return NextResponse.json(
            {
                error: "AI agent is not running",
                detail: `Could not reach ${AGENT_URL} — start it with: python -m uvicorn src.api:app --port 8002 (in project_2/agent)`,
            },
            { status: 503 }
        );
    }

    if (!agentResponse.ok || !agentResponse.body) {
        return NextResponse.json(
            { error: `Agent error (${agentResponse.status})` },
            { status: 502 }
        );
    }

    // Forward the SSE stream untouched
    return new Response(agentResponse.body, {
        headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache, no-transform",
            Connection: "keep-alive",
            "X-Accel-Buffering": "no",
        },
    });
}

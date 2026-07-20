import { NextRequest } from "next/server";

// Proxy the chat request to the agent API and forward its SSE stream verbatim.
// Runs on the Node runtime so we can stream a fetch body through unchanged.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const AGENT_API_URL = process.env.AGENT_API_URL || "http://localhost:8002";

export async function POST(request: NextRequest) {
  const body = await request.text();

  const upstream = await fetch(`${AGENT_API_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });

  if (!upstream.body) {
    return new Response("data: " + JSON.stringify({ type: "error", content: "Agent API unavailable" }) + "\n\n", {
      status: 502,
      headers: { "Content-Type": "text/event-stream" },
    });
  }

  return new Response(upstream.body, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const AGENT_API_URL = process.env.AGENT_API_URL || "http://localhost:8002";

export async function GET() {
  try {
    const res = await fetch(`${AGENT_API_URL}/api/tools`, {
      cache: "no-store",
    });
    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { tools: [], error: `Agent API unavailable: ${String(err)}` },
      { status: 200 },
    );
  }
}

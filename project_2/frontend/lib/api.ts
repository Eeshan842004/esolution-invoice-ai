// Client-side helpers for talking to the Next.js API routes (which proxy the
// agent). Keeping the SSE parsing here keeps the components lean.

export type StreamEvent =
  | { type: "text"; content: string }
  | { type: "tool_call"; name: string; input: Record<string, unknown> }
  | { type: "tool_result"; name: string; output: string }
  | { type: "error"; content: string };

export interface ToolInfo {
  name: string;
  description: string;
}

export async function fetchTools(): Promise<ToolInfo[]> {
  try {
    const res = await fetch("/api/tools");
    if (!res.ok) return [];
    const data = await res.json();
    return data.tools ?? [];
  } catch {
    return [];
  }
}

/**
 * POST a message and yield parsed SSE events as they arrive.
 */
export async function* streamChat(
  message: string,
  signal?: AbortSignal,
): AsyncGenerator<StreamEvent> {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message }),
    signal,
  });

  if (!res.ok || !res.body) {
    yield { type: "error", content: `Request failed (${res.status})` };
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    // SSE frames are separated by a blank line.
    const frames = buffer.split("\n\n");
    buffer = frames.pop() ?? "";

    for (const frame of frames) {
      const line = frame.split("\n").find((l) => l.startsWith("data:"));
      if (!line) continue;
      const payload = line.slice(5).trim();
      if (payload === "[DONE]") return;
      try {
        yield JSON.parse(payload) as StreamEvent;
      } catch {
        // ignore malformed frames
      }
    }
  }
}

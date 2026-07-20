"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { streamChat } from "@/lib/api";
import MessageBubble, { type ChatMessage } from "./MessageBubble";
import type { ToolCall } from "./ToolCallDisplay";
import Sidebar from "./Sidebar";

function uid() {
  return Math.random().toString(36).slice(2);
}

export default function ChatInterface() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages]);

  const send = useCallback(
    async (text: string) => {
      if (!text.trim() || busy) return;
      setBusy(true);
      setInput("");

      const userMsg: ChatMessage = { id: uid(), role: "user", text };
      const assistantId = uid();
      const assistantMsg: ChatMessage = {
        id: assistantId,
        role: "assistant",
        text: "",
        toolCalls: [],
      };
      setMessages((m) => [...m, userMsg, assistantMsg]);

      const patch = (fn: (msg: ChatMessage) => ChatMessage) =>
        setMessages((m) => m.map((x) => (x.id === assistantId ? fn(x) : x)));

      try {
        for await (const ev of streamChat(text)) {
          if (ev.type === "text") {
            patch((x) => ({ ...x, text: x.text + ev.content }));
          } else if (ev.type === "tool_call") {
            patch((x) => ({
              ...x,
              toolCalls: [
                ...(x.toolCalls ?? []),
                { name: ev.name, input: ev.input } as ToolCall,
              ],
            }));
          } else if (ev.type === "tool_result") {
            patch((x) => {
              const calls = [...(x.toolCalls ?? [])];
              // attach output to the most recent matching call awaiting a result
              for (let i = calls.length - 1; i >= 0; i--) {
                if (calls[i].name === ev.name && calls[i].output === undefined) {
                  calls[i] = { ...calls[i], output: ev.output };
                  break;
                }
              }
              return { ...x, toolCalls: calls };
            });
          } else if (ev.type === "error") {
            patch((x) => ({ ...x, error: ev.content }));
          }
        }
      } catch (err) {
        patch((x) => ({ ...x, error: String(err) }));
      } finally {
        setBusy(false);
      }
    },
    [busy],
  );

  return (
    <div className="flex flex-1 overflow-hidden">
      <Sidebar onPick={(p) => send(p)} />

      <main className="flex flex-1 flex-col">
        <div ref={scrollRef} className="flex-1 overflow-y-auto scroll-thin p-6">
          {messages.length === 0 ? (
            <div className="mx-auto mt-16 max-w-md text-center">
              <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-brand-600 text-xl font-bold text-white">
                UG
              </div>
              <h2 className="mt-4 text-lg font-semibold">
                Ask about students, courses, grades & analytics
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                The assistant answers using live database tools over a secure,
                OAuth-protected MCP server. Pick a sample prompt on the left or
                type your own.
              </p>
            </div>
          ) : (
            <div className="mx-auto max-w-3xl space-y-5">
              {messages.map((m) => (
                <MessageBubble key={m.id} message={m} />
              ))}
              {busy && (
                <div className="ml-11 flex gap-1 text-slate-400">
                  <span className="typing-dot">●</span>
                  <span className="typing-dot">●</span>
                  <span className="typing-dot">●</span>
                </div>
              )}
            </div>
          )}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
          className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4"
        >
          <div className="mx-auto flex max-w-3xl items-end gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send(input);
                }
              }}
              rows={1}
              placeholder="Ask about a student, course, or department…"
              className="min-h-[44px] max-h-40 flex-1 resize-none rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-4 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:focus:ring-brand-900"
            />
            <button
              type="submit"
              disabled={busy || !input.trim()}
              className="grid h-11 w-11 place-items-center rounded-xl bg-brand-600 text-white transition-colors hover:bg-brand-700 disabled:opacity-40"
              aria-label="Send"
            >
              ↑
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}

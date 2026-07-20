"use client";

import ToolCallDisplay, { type ToolCall } from "./ToolCallDisplay";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  toolCalls?: ToolCall[];
  error?: string;
}

export default function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";

  return (
    <div className={`flex gap-3 ${isUser ? "justify-end" : "justify-start"}`}>
      {!isUser && (
        <div className="mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand-600 text-xs font-bold text-white">
          UG
        </div>
      )}
      <div className={`max-w-[80%] ${isUser ? "order-1" : ""}`}>
        {/* Tool calls render above the assistant text */}
        {message.toolCalls?.map((call, i) => (
          <ToolCallDisplay key={`${call.name}-${i}`} call={call} />
        ))}

        {message.text && (
          <div
            className={`whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
              isUser
                ? "bg-brand-600 text-white"
                : "bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700"
            }`}
          >
            {message.text}
          </div>
        )}

        {message.error && (
          <div className="rounded-2xl border border-red-300 bg-red-50 dark:bg-red-950/40 px-4 py-2.5 text-sm text-red-700 dark:text-red-300">
            {message.error}
          </div>
        )}
      </div>
      {isUser && (
        <div className="mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-slate-300 dark:bg-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200">
          You
        </div>
      )}
    </div>
  );
}

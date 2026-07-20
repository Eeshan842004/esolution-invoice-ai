"use client";

import { useState } from "react";

export interface ToolCall {
  name: string;
  input: Record<string, unknown>;
  output?: string;
}

export default function ToolCallDisplay({ call }: { call: ToolCall }) {
  const [open, setOpen] = useState(false);
  const done = call.output !== undefined;

  return (
    <div className="my-2 overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-sm">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left"
      >
        <span
          className={`inline-block h-2 w-2 rounded-full ${
            done ? "bg-emerald-500" : "bg-amber-400 typing-dot"
          }`}
        />
        <span className="font-mono text-xs font-medium text-brand-700 dark:text-brand-100">
          {call.name}
        </span>
        <span className="text-xs text-slate-400">
          {done ? "completed" : "running…"}
        </span>
        <span className="ml-auto text-slate-400">{open ? "▾" : "▸"}</span>
      </button>

      {open && (
        <div className="border-t border-slate-200 dark:border-slate-700 px-3 py-2 space-y-2">
          <div>
            <div className="text-[10px] font-semibold uppercase text-slate-400">
              Input
            </div>
            <pre className="mt-1 overflow-x-auto rounded bg-white dark:bg-slate-900 p-2 text-xs">
              {JSON.stringify(call.input, null, 2)}
            </pre>
          </div>
          {done && (
            <div>
              <div className="text-[10px] font-semibold uppercase text-slate-400">
                Output
              </div>
              <pre className="mt-1 max-h-60 overflow-auto rounded bg-white dark:bg-slate-900 p-2 text-xs">
                {call.output}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { fetchTools, type ToolInfo } from "@/lib/api";

const SAMPLE_PROMPTS = [
  "What's the GPA for student 21CSE001?",
  "Show enrollment stats for the CSE department.",
  "Which CSE students are at risk (CGPA below 6)?",
  "Grade distribution for course CS101.",
  "Attendance summary for 21CSE001 in CS101.",
];

export default function Sidebar({
  onPick,
}: {
  onPick: (prompt: string) => void;
}) {
  const [tools, setTools] = useState<ToolInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTools().then((t) => {
      setTools(t);
      setLoading(false);
    });
  }, []);

  return (
    <aside className="hidden md:flex w-72 shrink-0 flex-col border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
      <div className="p-4">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Try asking
        </h2>
        <div className="mt-2 space-y-1.5">
          {SAMPLE_PROMPTS.map((p) => (
            <button
              key={p}
              onClick={() => onPick(p)}
              className="block w-full rounded-md border border-slate-200 dark:border-slate-700 px-3 py-2 text-left text-sm text-slate-700 dark:text-slate-300 hover:border-brand-500 hover:bg-brand-50 dark:hover:bg-slate-800 transition-colors"
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-2 flex-1 overflow-y-auto scroll-thin p-4">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Available tools{" "}
          <span className="ml-1 rounded bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-500">
            {tools.length}
          </span>
        </h2>
        {loading ? (
          <p className="mt-2 text-sm text-slate-400">Loading…</p>
        ) : tools.length === 0 ? (
          <p className="mt-2 text-sm text-amber-600 dark:text-amber-400">
            No tools — is the agent + MCP server running?
          </p>
        ) : (
          <ul className="mt-2 space-y-1">
            {tools.map((t) => (
              <li
                key={t.name}
                className="rounded-md px-2 py-1.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-800"
                title={t.description}
              >
                <span className="font-mono text-xs text-brand-600 dark:text-brand-100">
                  {t.name}
                </span>
                <p className="truncate text-xs text-slate-500">{t.description}</p>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="border-t border-slate-200 dark:border-slate-800 p-4 text-[11px] leading-relaxed text-slate-400">
        Read-only agent token. Grade-write and admin tools are enforced
        server-side and never exposed here.
      </div>
    </aside>
  );
}

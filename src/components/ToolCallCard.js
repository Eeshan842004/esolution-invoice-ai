"use client";

import { useState } from "react";
import { Check, ChevronRight, Loader2, Wrench } from "lucide-react";

/**
 * Collapsible card showing one MCP tool execution:
 * tool name, input params, and (once available) the result.
 */
export default function ToolCallCard({ name, input, output, done }) {
    const [open, setOpen] = useState(false);

    const pretty = (value) => {
        if (value == null) return "";
        if (typeof value === "string") {
            try {
                return JSON.stringify(JSON.parse(value), null, 2);
            } catch {
                return value;
            }
        }
        return JSON.stringify(value, null, 2);
    };

    return (
        <div className={`tool-card ${done ? "is-done" : "is-running"}`}>
            <button className="tool-header" onClick={() => setOpen(!open)}>
                <span className="tool-icon">
                    <Wrench size={12} />
                </span>
                <span className="tool-name">{name}</span>
                <span className={`tool-badge ${done ? "ok" : "run"}`}>
                    {done ? (
                        <>
                            <Check size={11} /> done
                        </>
                    ) : (
                        <>
                            <Loader2 size={11} className="spin" /> running
                        </>
                    )}
                </span>
                <ChevronRight size={14} className={`chev ${open ? "open" : ""}`} />
            </button>

            {open && (
                <div className="tool-body">
                    <div className="tool-section">
                        <div className="tool-section-label">Input</div>
                        <pre>{pretty(input) || "{}"}</pre>
                    </div>
                    {done && (
                        <div className="tool-section">
                            <div className="tool-section-label">Result</div>
                            <pre>{pretty(output)}</pre>
                        </div>
                    )}
                </div>
            )}

            <style jsx>{`
                .tool-card {
                    background: rgba(255, 255, 255, 0.02);
                    border: 1px solid var(--border-subtle, #242424);
                    border-radius: 11px;
                    margin: 6px 0;
                    overflow: hidden;
                    max-width: 100%;
                    transition: border-color 0.2s ease;
                }
                .tool-card.is-running {
                    border-color: rgba(91, 140, 247, 0.35);
                }
                .tool-header {
                    display: flex;
                    align-items: center;
                    gap: 9px;
                    width: 100%;
                    padding: 9px 12px;
                    background: transparent;
                    border: none;
                    color: var(--text-secondary, #999);
                    font-size: 12.5px;
                    cursor: pointer;
                    text-align: left;
                }
                .tool-header:hover {
                    background: rgba(255, 255, 255, 0.025);
                }
                .tool-icon {
                    width: 22px;
                    height: 22px;
                    border-radius: 7px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    flex-shrink: 0;
                    color: #8ab0ff;
                    background: rgba(59, 130, 246, 0.13);
                }
                .tool-name {
                    flex: 1;
                    font-family: ui-monospace, monospace;
                    font-weight: 600;
                    font-size: 12px;
                    color: #9db9ff;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }
                .tool-badge {
                    display: flex;
                    align-items: center;
                    gap: 4px;
                    padding: 2.5px 9px;
                    border-radius: 999px;
                    font-size: 10.5px;
                    font-weight: 600;
                    letter-spacing: 0.2px;
                    flex-shrink: 0;
                }
                .tool-badge.ok {
                    color: #4ade80;
                    background: rgba(34, 197, 94, 0.1);
                    border: 1px solid rgba(34, 197, 94, 0.25);
                }
                .tool-badge.run {
                    color: #93b4ff;
                    background: rgba(59, 130, 246, 0.1);
                    border: 1px solid rgba(59, 130, 246, 0.3);
                }
                .tool-header :global(.chev) {
                    transition: transform 0.18s ease;
                    color: #555;
                    flex-shrink: 0;
                }
                .tool-header :global(.chev.open) {
                    transform: rotate(90deg);
                }
                .tool-header :global(.spin) {
                    animation: spin 1s linear infinite;
                }
                .tool-body {
                    border-top: 1px solid var(--border-subtle, #242424);
                    padding: 10px 12px;
                }
                .tool-section {
                    margin-bottom: 8px;
                }
                .tool-section:last-child {
                    margin-bottom: 0;
                }
                .tool-section-label {
                    font-size: 10px;
                    text-transform: uppercase;
                    letter-spacing: 1.2px;
                    font-weight: 700;
                    color: var(--text-muted, #5c5c5c);
                    margin-bottom: 5px;
                }
                pre {
                    margin: 0;
                    padding: 9px 11px;
                    background: #0d0d0d;
                    border: 1px solid #1e1e1e;
                    border-radius: 8px;
                    font-size: 11.5px;
                    line-height: 1.55;
                    color: #b9c2d0;
                    white-space: pre-wrap;
                    word-break: break-word;
                    max-height: 230px;
                    overflow-y: auto;
                }
                @keyframes spin {
                    to {
                        transform: rotate(360deg);
                    }
                }
            `}</style>
        </div>
    );
}

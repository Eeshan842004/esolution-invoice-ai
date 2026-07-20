"use client";

import { useEffect, useRef, useState } from "react";
import {
    AlertTriangle,
    ArrowUp,
    Bot,
    IndianRupee,
    ListChecks,
    RotateCcw,
    Send,
    Sparkles,
    Trophy,
} from "lucide-react";
import ToolCallCard from "@/components/ToolCallCard";

const STORAGE_KEY = "esolution-ai-chat-v1";

const SUGGESTIONS = [
    { icon: IndianRupee, text: "How much money is outstanding right now?" },
    { icon: ListChecks, text: "List my overdue invoices" },
    { icon: AlertTriangle, text: "Follow up on everything overdue" },
    { icon: Trophy, text: "Who are my best and worst clients?" },
];

const newId = () =>
    typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

/** Minimal inline markdown: **bold**, `code`, clickable URLs. */
const INLINE_RE = /(\*\*[^*\n]+\*\*|`[^`\n]+`|https?:\/\/[^\s)]+)/g;
function renderInline(text) {
    return String(text)
        .split(INLINE_RE)
        .map((part, i) => {
            if (!part) return null;
            if (part.startsWith("**") && part.endsWith("**"))
                return <strong key={i}>{part.slice(2, -2)}</strong>;
            if (part.startsWith("`") && part.endsWith("`"))
                return <code key={i}>{part.slice(1, -1)}</code>;
            if (/^https?:\/\//.test(part))
                return (
                    <a key={i} href={part} target="_blank" rel="noreferrer">
                        {part}
                    </a>
                );
            return part;
        });
}

/**
 * Chat UI for the ESolution AI assistant.
 *
 * - Streams SSE from /api/mcp-chat (text deltas, tool_call, tool_result).
 * - History + conversation id persist in localStorage, so navigating to the
 *   dashboard and back keeps the whole conversation; the id is also the
 *   agent-side memory thread, so follow-up answers stay in context.
 */
export default function ChatInterface() {
    const [messages, setMessages] = useState([]);
    const [conversationId, setConversationId] = useState("");
    const [loaded, setLoaded] = useState(false);
    const [input, setInput] = useState("");
    const [busy, setBusy] = useState(false);
    const scrollRef = useRef(null);
    const inputRef = useRef(null);

    // Restore history after mount (avoids SSR/localStorage hydration mismatch)
    useEffect(() => {
        try {
            const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
            if (saved?.messages?.length) setMessages(saved.messages);
            setConversationId(saved?.conversationId || newId());
        } catch {
            setConversationId(newId());
        }
        setLoaded(true);
    }, []);

    // Persist when a turn completes (not per streamed token)
    useEffect(() => {
        if (!loaded || busy) return;
        try {
            localStorage.setItem(
                STORAGE_KEY,
                JSON.stringify({ conversationId, messages })
            );
        } catch {
            /* storage full/blocked — chat still works, just not persisted */
        }
    }, [messages, busy, loaded, conversationId]);

    useEffect(() => {
        scrollRef.current?.scrollTo({
            top: scrollRef.current.scrollHeight,
            behavior: "smooth",
        });
    }, [messages, busy]);

    const clearChat = () => {
        if (busy) return;
        setMessages([]);
        setConversationId(newId()); // fresh agent memory thread too
        try {
            localStorage.removeItem(STORAGE_KEY);
        } catch {}
        inputRef.current?.focus();
    };

    const appendPart = (part) => {
        setMessages((prev) => {
            const next = [...prev];
            const last = next[next.length - 1];
            if (!last || last.role !== "assistant") {
                next.push({ role: "assistant", parts: [part] });
                return next;
            }
            const parts = [...last.parts];
            const tail = parts[parts.length - 1];
            if (part.type === "text" && tail?.type === "text") {
                parts[parts.length - 1] = {
                    ...tail,
                    content: tail.content + part.content,
                };
            } else if (part.type === "tool_result") {
                for (let i = parts.length - 1; i >= 0; i--) {
                    if (
                        parts[i].type === "tool" &&
                        parts[i].name === part.name &&
                        !parts[i].done
                    ) {
                        parts[i] = { ...parts[i], output: part.output, done: true };
                        break;
                    }
                }
            } else {
                parts.push(part);
            }
            next[next.length - 1] = { ...last, parts };
            return next;
        });
    };

    const send = async (text) => {
        const message = (text ?? input).trim();
        if (!message || busy || !loaded) return;
        setInput("");
        setBusy(true);
        setMessages((prev) => [...prev, { role: "user", content: message }]);

        try {
            const res = await fetch("/api/mcp-chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ message, conversation_id: conversationId }),
            });

            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                appendPart({
                    type: "error",
                    content: err.detail || err.error || `Request failed (${res.status})`,
                });
                return;
            }

            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            let buffer = "";

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });

                const events = buffer.split("\n\n");
                buffer = events.pop();

                for (const event of events) {
                    for (const line of event.split("\n")) {
                        if (!line.startsWith("data: ")) continue;
                        const payload = line.slice(6).trim();
                        if (payload === "[DONE]") continue;
                        let data;
                        try {
                            data = JSON.parse(payload);
                        } catch {
                            continue;
                        }
                        if (data.type === "text") {
                            appendPart({ type: "text", content: data.content });
                        } else if (data.type === "tool_call") {
                            appendPart({
                                type: "tool",
                                name: data.name,
                                input: data.input,
                                output: null,
                                done: false,
                            });
                        } else if (data.type === "tool_result") {
                            appendPart({
                                type: "tool_result",
                                name: data.name,
                                output: data.output,
                            });
                        } else if (data.type === "error") {
                            appendPart({ type: "error", content: data.content });
                        }
                    }
                }
            }
        } catch (err) {
            appendPart({ type: "error", content: `Connection lost: ${err.message}` });
        } finally {
            setBusy(false);
        }
    };

    const lastMsg = messages[messages.length - 1];
    const waitingForFirstToken =
        busy &&
        (lastMsg?.role === "user" ||
            (lastMsg?.role === "assistant" &&
                !lastMsg.parts.some((p) => p.type === "text" && p.content)));

    return (
        <div className="chat-shell">
            {/* Header */}
            <div className="chat-head">
                <div className="chat-head-id">
                    <div className="chat-head-avatar">
                        <Bot size={17} />
                    </div>
                    <div>
                        <div className="chat-head-name">ESolution AI</div>
                        <div className="chat-head-status">
                            <span className="dot" /> connected · 16 tools
                        </div>
                    </div>
                </div>
                <button
                    className="chat-clear"
                    onClick={clearChat}
                    disabled={busy || messages.length === 0}
                    title="Start a new conversation"
                >
                    <RotateCcw size={13} />
                    <span>New chat</span>
                </button>
            </div>

            {/* Messages */}
            <div className="chat-scroll" ref={scrollRef}>
                {loaded && messages.length === 0 && (
                    <div className="chat-empty">
                        <div className="chat-empty-icon">
                            <Sparkles size={26} />
                        </div>
                        <h2>What can I do for you?</h2>
                        <p>
                            Create invoices, chase payments, check client karma, pull
                            reports — in plain language.
                        </p>
                        <div className="chat-suggestions">
                            {SUGGESTIONS.map(({ icon: Icon, text }) => (
                                <button key={text} onClick={() => send(text)} disabled={busy}>
                                    <Icon size={15} />
                                    <span>{text}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {messages.map((msg, idx) =>
                    msg.role === "user" ? (
                        <div key={idx} className="row user-row">
                            <div className="bubble user-bubble">{msg.content}</div>
                        </div>
                    ) : (
                        <div key={idx} className="row ai-row">
                            <div className="ai-avatar">
                                <Bot size={14} />
                            </div>
                            <div className="ai-parts">
                                {msg.parts.map((part, j) =>
                                    part.type === "text" ? (
                                        <div key={j} className="bubble ai-bubble">
                                            {renderInline(part.content)}
                                        </div>
                                    ) : part.type === "tool" ? (
                                        <ToolCallCard
                                            key={j}
                                            name={part.name}
                                            input={part.input}
                                            output={part.output}
                                            done={part.done}
                                        />
                                    ) : (
                                        <div key={j} className="bubble error-bubble">
                                            ⚠️ {part.content}
                                        </div>
                                    )
                                )}
                            </div>
                        </div>
                    )
                )}

                {waitingForFirstToken && (
                    <div className="row ai-row">
                        <div className="ai-avatar">
                            <Bot size={14} />
                        </div>
                        <div className="typing">
                            <span />
                            <span />
                            <span />
                        </div>
                    </div>
                )}
            </div>

            {/* Input */}
            <div className="chat-input-bar">
                <div className="composer">
                    <input
                        ref={inputRef}
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && send()}
                        placeholder='Try: "Create an invoice for Rahul, ₹50,000, due in 15 days"'
                        disabled={busy}
                    />
                    <button
                        className="send-btn"
                        onClick={() => send()}
                        disabled={busy || !input.trim()}
                        aria-label="Send"
                    >
                        {busy ? (
                            <Send size={15} className="pulse" />
                        ) : (
                            <ArrowUp size={17} />
                        )}
                    </button>
                </div>
                <div className="composer-hint">
                    Enter to send · client emails are masked in summaries
                </div>
            </div>

            <style jsx>{`
                .chat-shell {
                    display: flex;
                    flex-direction: column;
                    height: calc(100vh - 150px);
                    max-width: 880px;
                    margin: 0 auto;
                    background: var(--bg-card, #131313);
                    border: 1px solid var(--border-subtle, #222);
                    border-radius: 18px;
                    overflow: hidden;
                    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.35);
                }

                /* ── header ─────────────────────────────── */
                .chat-head {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 12px 18px;
                    border-bottom: 1px solid var(--border-subtle, #222);
                    background: rgba(255, 255, 255, 0.015);
                }
                .chat-head-id {
                    display: flex;
                    align-items: center;
                    gap: 11px;
                }
                .chat-head-avatar {
                    width: 34px;
                    height: 34px;
                    border-radius: 11px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: #fff;
                    background: linear-gradient(135deg, #3b82f6, #6366f1);
                    box-shadow: 0 3px 12px rgba(79, 108, 241, 0.35);
                }
                .chat-head-name {
                    font-size: 14px;
                    font-weight: 700;
                    color: var(--text-primary, #fff);
                    letter-spacing: -0.2px;
                }
                .chat-head-status {
                    display: flex;
                    align-items: center;
                    gap: 5px;
                    font-size: 11px;
                    color: var(--text-muted, #666);
                    margin-top: 1px;
                }
                .dot {
                    width: 6px;
                    height: 6px;
                    border-radius: 50%;
                    background: #22c55e;
                    box-shadow: 0 0 6px rgba(34, 197, 94, 0.7);
                }
                .chat-clear {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    padding: 7px 12px;
                    border-radius: 9px;
                    border: 1px solid var(--border-default, #2c2c2c);
                    background: transparent;
                    color: var(--text-secondary, #999);
                    font-size: 12px;
                    cursor: pointer;
                    transition: all 0.15s ease;
                }
                .chat-clear:hover:not(:disabled) {
                    color: #fff;
                    border-color: #3b82f6;
                    background: rgba(59, 130, 246, 0.08);
                }
                .chat-clear:disabled {
                    opacity: 0.35;
                    cursor: default;
                }

                /* ── scroll area ────────────────────────── */
                .chat-scroll {
                    flex: 1;
                    overflow-y: auto;
                    padding: 20px 22px 10px;
                    scrollbar-width: thin;
                    scrollbar-color: #2a2a2a transparent;
                }

                /* ── empty state ────────────────────────── */
                .chat-empty {
                    text-align: center;
                    margin-top: 8vh;
                    animation: rise 0.35s ease;
                }
                .chat-empty-icon {
                    width: 58px;
                    height: 58px;
                    margin: 0 auto 18px;
                    border-radius: 18px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: #8ab0ff;
                    background: linear-gradient(
                        135deg,
                        rgba(59, 130, 246, 0.18),
                        rgba(99, 102, 241, 0.12)
                    );
                    border: 1px solid rgba(99, 130, 246, 0.25);
                    box-shadow: 0 0 34px rgba(70, 110, 245, 0.18);
                }
                .chat-empty h2 {
                    color: var(--text-primary, #fff);
                    margin: 0 0 8px;
                    font-size: 21px;
                    font-weight: 700;
                    letter-spacing: -0.4px;
                }
                .chat-empty p {
                    color: var(--text-secondary, #888);
                    font-size: 13.5px;
                    max-width: 400px;
                    margin: 0 auto 26px;
                    line-height: 1.6;
                }
                .chat-suggestions {
                    display: grid;
                    grid-template-columns: repeat(2, minmax(0, 1fr));
                    gap: 10px;
                    max-width: 560px;
                    margin: 0 auto;
                }
                .chat-suggestions button {
                    display: flex;
                    align-items: center;
                    gap: 9px;
                    text-align: left;
                    background: var(--bg-elevated, #191919);
                    border: 1px solid var(--border-default, #2a2a2a);
                    color: var(--text-secondary, #a5a5a5);
                    border-radius: 12px;
                    padding: 12px 14px;
                    font-size: 12.5px;
                    cursor: pointer;
                    transition: all 0.15s ease;
                }
                .chat-suggestions button :global(svg) {
                    color: #5b8cf7;
                    flex-shrink: 0;
                }
                .chat-suggestions button:hover {
                    border-color: rgba(91, 140, 247, 0.55);
                    color: #fff;
                    transform: translateY(-1px);
                    background: rgba(59, 130, 246, 0.06);
                }

                /* ── message rows ───────────────────────── */
                .row {
                    display: flex;
                    gap: 10px;
                    margin: 16px 0;
                    align-items: flex-start;
                    animation: rise 0.25s ease;
                }
                .user-row {
                    justify-content: flex-end;
                }
                .ai-avatar {
                    width: 28px;
                    height: 28px;
                    border-radius: 9px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    flex-shrink: 0;
                    margin-top: 3px;
                    color: #8ab0ff;
                    background: rgba(59, 130, 246, 0.13);
                    border: 1px solid rgba(99, 130, 246, 0.22);
                }
                .ai-parts {
                    max-width: 82%;
                    min-width: 0;
                }
                .bubble {
                    padding: 11px 15px;
                    border-radius: 15px;
                    font-size: 14px;
                    line-height: 1.7;
                    white-space: pre-wrap;
                    word-break: break-word;
                }
                .user-bubble {
                    background: linear-gradient(135deg, #3b82f6, #5b5ef0);
                    color: #fff;
                    border-bottom-right-radius: 5px;
                    max-width: 72%;
                    box-shadow: 0 4px 16px rgba(70, 100, 243, 0.25);
                }
                .ai-bubble {
                    background: var(--bg-elevated, #1a1a1a);
                    border: 1px solid var(--border-subtle, #242424);
                    color: #e8e8e8;
                    border-bottom-left-radius: 5px;
                    margin: 4px 0;
                }
                .ai-bubble :global(a) {
                    color: #7aa5ff;
                    text-decoration: underline;
                    text-underline-offset: 3px;
                    word-break: break-all;
                }
                .ai-bubble :global(code) {
                    background: rgba(255, 255, 255, 0.07);
                    border: 1px solid rgba(255, 255, 255, 0.08);
                    border-radius: 5px;
                    padding: 1px 6px;
                    font-size: 12.5px;
                    font-family: ui-monospace, monospace;
                    color: #a5c2ff;
                }
                .ai-bubble :global(strong) {
                    color: #fff;
                }
                .error-bubble {
                    background: rgba(239, 68, 68, 0.09);
                    border: 1px solid rgba(239, 68, 68, 0.45);
                    color: #f87171;
                    margin: 4px 0;
                    font-size: 13px;
                }

                /* ── typing dots ────────────────────────── */
                .typing {
                    display: flex;
                    gap: 5px;
                    padding: 14px 16px;
                    background: var(--bg-elevated, #1a1a1a);
                    border: 1px solid var(--border-subtle, #242424);
                    border-radius: 15px;
                    border-bottom-left-radius: 5px;
                }
                .typing span {
                    width: 7px;
                    height: 7px;
                    border-radius: 50%;
                    background: #5b8cf7;
                    animation: bounce 1.2s infinite ease-in-out;
                }
                .typing span:nth-child(2) {
                    animation-delay: 0.15s;
                }
                .typing span:nth-child(3) {
                    animation-delay: 0.3s;
                }

                /* ── input bar / composer ───────────────── */
                .chat-input-bar {
                    padding: 14px 16px 12px;
                    border-top: 1px solid var(--border-subtle, #222);
                    background: rgba(255, 255, 255, 0.015);
                }
                .composer {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    background: var(--bg-input, #1c1c1c);
                    border: 1px solid var(--border-default, #2e2e2e);
                    border-radius: 15px;
                    padding: 6px 6px 6px 8px;
                    transition: border-color 0.15s ease, box-shadow 0.15s ease;
                }
                .composer:focus-within {
                    border-color: #3b82f6;
                    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.14);
                }
                .composer input {
                    flex: 1;
                    background: transparent;
                    border: none;
                    padding: 10px 10px;
                    color: var(--text-primary, #fff);
                    font-size: 14px;
                    outline: none;
                }
                .composer input::placeholder {
                    color: #565660;
                }
                .send-btn {
                    width: 40px;
                    height: 40px;
                    border-radius: 11px;
                    border: none;
                    flex-shrink: 0;
                    background: linear-gradient(135deg, #3b82f6, #5b5ef0);
                    color: #fff;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: all 0.15s ease;
                    box-shadow: 0 4px 14px rgba(70, 100, 243, 0.3);
                }
                .send-btn:hover:not(:disabled) {
                    transform: translateY(-1px);
                    box-shadow: 0 6px 18px rgba(70, 100, 243, 0.45);
                }
                .send-btn:disabled {
                    opacity: 0.3;
                    cursor: default;
                    box-shadow: none;
                    background: #2e2e2e;
                }
                .send-btn :global(.pulse) {
                    animation: pulseOp 1.1s infinite ease-in-out;
                }
                .composer-hint {
                    text-align: center;
                    font-size: 10.5px;
                    color: #4a4a54;
                    margin-top: 8px;
                    letter-spacing: 0.2px;
                }

                @keyframes rise {
                    from {
                        opacity: 0;
                        transform: translateY(6px);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }
                @keyframes bounce {
                    0%, 60%, 100% {
                        transform: translateY(0);
                        opacity: 0.45;
                    }
                    30% {
                        transform: translateY(-5px);
                        opacity: 1;
                    }
                }
                @keyframes pulseOp {
                    0%, 100% {
                        opacity: 0.5;
                    }
                    50% {
                        opacity: 1;
                    }
                }

                @media (max-width: 640px) {
                    .chat-shell {
                        height: calc(100vh - 110px);
                        border-radius: 14px;
                    }
                    .chat-suggestions {
                        grid-template-columns: 1fr;
                    }
                    .ai-parts {
                        max-width: 90%;
                    }
                    .user-bubble {
                        max-width: 86%;
                    }
                    .chat-clear span {
                        display: none;
                    }
                }
            `}</style>
        </div>
    );
}

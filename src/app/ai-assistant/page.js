"use client";

import { ShieldCheck, Wrench, Zap } from "lucide-react";
import ChatInterface from "@/components/ChatInterface";

export default function AiAssistantPage() {
    return (
        <div className="ai-assistant-page">
            <div className="ai-page-header">
                <div>
                    <h1>AI Assistant</h1>
                    <p>Natural-language control of your invoices.</p>
                </div>
                <div className="ai-pills">
                    <span className="pill">
                        <ShieldCheck size={12} /> OAuth 2.1
                    </span>
                    <span className="pill">
                        <Wrench size={12} /> 16 MCP tools
                    </span>
                    <span className="pill">
                        <Zap size={12} /> Groq Llama 3.3
                    </span>
                </div>
            </div>
            <ChatInterface />

            <style jsx>{`
                .ai-assistant-page {
                    padding: 22px 32px 26px;
                }
                .ai-page-header {
                    display: flex;
                    align-items: flex-end;
                    justify-content: space-between;
                    gap: 16px;
                    flex-wrap: wrap;
                    max-width: 880px;
                    margin: 0 auto 14px;
                }
                .ai-page-header h1 {
                    color: var(--text-primary, #fff);
                    font-size: 25px;
                    font-weight: 800;
                    margin: 0 0 3px;
                    letter-spacing: -0.5px;
                }
                .ai-page-header p {
                    color: var(--text-secondary, #888);
                    font-size: 13px;
                    margin: 0;
                }
                .ai-pills {
                    display: flex;
                    gap: 8px;
                    flex-wrap: wrap;
                }
                .pill {
                    display: flex;
                    align-items: center;
                    gap: 5px;
                    padding: 5px 11px;
                    border-radius: 999px;
                    font-size: 11px;
                    font-weight: 600;
                    color: var(--text-secondary, #9a9a9a);
                    background: rgba(255, 255, 255, 0.03);
                    border: 1px solid var(--border-subtle, #262626);
                }
                .pill :global(svg) {
                    color: #5b8cf7;
                }
                @media (max-width: 640px) {
                    .ai-assistant-page {
                        padding: 14px 14px 18px;
                    }
                    .ai-pills {
                        display: none;
                    }
                }
            `}</style>
        </div>
    );
}

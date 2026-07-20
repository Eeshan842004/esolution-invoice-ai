"use client";

import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";

function AnimatedNumber({ value, duration = 1200, formatFunction }) {
    const [display, setDisplay] = useState(0);
    const ref = useRef(null);

    useEffect(() => {
        const target = parseFloat(value);
        if (isNaN(target) || target === 0) {
            setDisplay(0);
            return;
        }
        let start = 0;
        const startTime = performance.now();
        const animate = (now) => {
            const elapsed = now - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            setDisplay(Math.floor(eased * target));
            if (progress < 1) ref.current = requestAnimationFrame(animate);
        };
        ref.current = requestAnimationFrame(animate);
        return () => cancelAnimationFrame(ref.current);
    }, [value, duration]);

    return formatFunction ? formatFunction(display) : display;
}

export default function StatsCards({ summary }) {
    const formatCurrency = (amount) => {
        if (isNaN(amount)) amount = 0;
        return new Intl.NumberFormat("en-IN", {
            style: "currency",
            currency: "INR",
            maximumFractionDigits: 0,
        }).format(amount);
    };

    const cards = [
        {
            label: "Total Outstanding",
            value: summary?.total_unpaid_amount ? parseFloat(summary.total_unpaid_amount) : 0,
            sub: `${summary?.total_unpaid || 0} invoices pending`,
            colorClass: "outstanding",
            pulse: false,
            icon: (
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
            ),
        },
        {
            label: "Overdue Amount",
            value: summary?.total_overdue_amount ? parseFloat(summary.total_overdue_amount) : 0,
            sub: `${summary?.total_overdue || 0} invoices overdue`,
            colorClass: "overdue",
            pulse: (summary?.total_overdue || 0) > 0,
            icon: (
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
            ),
        },
        {
            label: "Total Revenue",
            value: summary?.total_revenue ? parseFloat(summary.total_revenue) : 0,
            sub: `${summary?.total_paid || 0} invoices paid`,
            colorClass: "revenue",
            pulse: false,
            icon: (
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 11.08V12a10 10 0 11-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
                </svg>
            ),
        },
    ];

    return (
        <div className="stats-grid">
            {cards.map((card, i) => (
                <motion.div
                    key={i}
                    className={`stats-card-new color-${card.colorClass} ${card.pulse ? 'pulse-card' : ''}`}
                    initial={{ opacity: 0, scale: 0.95 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true, margin: "-50px" }}
                    transition={{ duration: 0.3, delay: i * 0.1 }}
                    whileHover={{
                        y: -4,
                        transition: { duration: 0.2, ease: "easeOut" }
                    }}
                >
                    <div className="stats-card-glow" />
                    <div className="stats-card-top">
                        <span className="stats-card-label">{card.label}</span>
                        <div className="stats-card-icon">{card.icon}</div>
                    </div>
                    <div className="stats-card-value">
                        <AnimatedNumber value={card.value} formatFunction={formatCurrency} />
                    </div>
                    <p className="stats-card-sub">{card.sub}</p>
                </motion.div>
            ))}
            <style jsx>{`
                .stats-grid {
                    display: grid;
                    grid-template-columns: repeat(3, 1fr);
                    gap: 18px;
                    margin-bottom: 34px;
                }
                .stats-card-new {
                    min-height: 148px;
                    padding: 22px 24px;
                    border-radius: 18px;
                    display: flex;
                    flex-direction: column;
                    position: relative;
                    overflow: hidden;
                    transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
                    background: #131316;
                    border: 1px solid rgba(255, 255, 255, 0.07);
                }
                .stats-card-glow {
                    position: absolute;
                    top: -40px;
                    right: -40px;
                    width: 130px;
                    height: 130px;
                    border-radius: 50%;
                    filter: blur(30px);
                    opacity: 0.5;
                    pointer-events: none;
                    transition: opacity 0.25s ease;
                }
                .stats-card-new:hover .stats-card-glow {
                    opacity: 0.85;
                }

                /* --- Card 1: TOTAL OUTSTANDING --- */
                .color-outstanding .stats-card-glow {
                    background: #6366f1;
                }
                .color-outstanding .stats-card-icon {
                    background: rgba(99, 102, 241, 0.14);
                    color: #818cf8;
                    box-shadow: inset 0 0 0 1px rgba(99, 102, 241, 0.25);
                }
                .color-outstanding .stats-card-value {
                    color: #ffffff;
                }
                .color-outstanding:hover {
                    border-color: rgba(99, 102, 241, 0.45);
                    box-shadow: 0 12px 34px rgba(99, 102, 241, 0.18);
                    transform: translateY(-4px);
                }

                /* --- Card 2: OVERDUE AMOUNT --- */
                .color-overdue .stats-card-glow {
                    background: #ef4444;
                }
                .color-overdue .stats-card-icon {
                    background: rgba(239, 68, 68, 0.14);
                    color: #f87171;
                    box-shadow: inset 0 0 0 1px rgba(239, 68, 68, 0.25);
                }
                .color-overdue .stats-card-value {
                    color: #f87171;
                }
                .color-overdue:hover {
                    border-color: rgba(239, 68, 68, 0.45);
                    box-shadow: 0 12px 34px rgba(239, 68, 68, 0.18);
                    transform: translateY(-4px);
                }

                /* --- Card 3: TOTAL REVENUE --- */
                .color-revenue .stats-card-glow {
                    background: #22c55e;
                }
                .color-revenue .stats-card-icon {
                    background: rgba(34, 197, 94, 0.14);
                    color: #4ade80;
                    box-shadow: inset 0 0 0 1px rgba(34, 197, 94, 0.25);
                }
                .color-revenue .stats-card-value {
                    color: #4ade80;
                }
                .color-revenue:hover {
                    border-color: rgba(34, 197, 94, 0.45);
                    box-shadow: 0 12px 34px rgba(34, 197, 94, 0.18);
                    transform: translateY(-4px);
                }

                .stats-card-top {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    margin-bottom: 18px;
                    position: relative;
                    z-index: 1;
                }
                .stats-card-label {
                    font-size: 11.5px;
                    font-weight: 600;
                    color: #7a7a86;
                    text-transform: uppercase;
                    letter-spacing: 0.8px;
                }
                .stats-card-icon {
                    width: 38px;
                    height: 38px;
                    border-radius: 11px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    flex-shrink: 0;
                }
                .stats-card-icon :global(svg) {
                    width: 17px;
                    height: 17px;
                }
                .stats-card-value {
                    font-size: 32px;
                    font-weight: 800;
                    margin-bottom: 6px;
                    letter-spacing: -1px;
                    position: relative;
                    z-index: 1;
                }
                .stats-card-sub {
                    font-size: 12.5px;
                    color: #5f5f6b;
                    position: relative;
                    z-index: 1;
                }
                .pulse-card {
                    animation: pulseGlow 2s infinite;
                }
                @media (max-width: 900px) {
                    .stats-grid {
                        grid-template-columns: 1fr;
                    }
                }
            `}</style>
        </div>
    );
}

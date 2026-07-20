"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import KarmaScore from "@/components/KarmaScore";
import LinkedInModal from "@/components/LinkedInModal";
import { Bell, CheckCircle, ExternalLink, ScrollText } from "lucide-react";

export default function InvoiceCard({ invoice, onRefresh, index = 0 }) {
    const [loading, setLoading] = useState(false);
    const [showLinkedIn, setShowLinkedIn] = useState(false);
    const [actionSuccess, setActionSuccess] = useState("");

    const handleMarkPaid = async () => {
        const invoiceId = invoice.invoice_id;
        console.log("Marking paid:", invoiceId);

        try {
            setLoading(true);
            const res = await fetch(`/api/invoices/${invoiceId}/pay`, { method: 'POST' });
            const data = await res.json();
            console.log("Pay response:", data);

            if (res.ok) {
                setActionSuccess("pay");
                setTimeout(() => window.location.reload(), 1000);
            } else {
                console.error("Pay failed:", data);
                alert("Failed: " + data.error);
            }
        } catch (err) {
            console.error("Pay error:", err);
            alert("Network error");
        } finally {
            setLoading(false);
        }
    };

    const handleRemind = async () => {
        const invoiceId = invoice.invoice_id;
        console.log("Sending reminder:", invoiceId);

        try {
            setLoading(true);
            const res = await fetch(`/api/invoices/${invoiceId}/remind`, { method: 'POST' });
            const data = await res.json();
            console.log("Remind response:", data);

            if (res.ok) {
                setActionSuccess("remind");
                alert("Reminder sent successfully!");
                setTimeout(() => setActionSuccess(""), 2000);
            } else {
                console.error("Remind failed:", data);
                alert("Failed: " + data.error);
            }
        } catch (err) {
            console.error("Remind error:", err);
            alert("Network error");
        } finally {
            setLoading(false);
        }
    };

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat("en-IN", {
            style: "currency", currency: "INR", maximumFractionDigits: 0,
        }).format(amount || 0);
    };

    const formatDate = (dateStr) => {
        if (!dateStr) return "—";
        const date = new Date(dateStr);

        // If date is invalid or has a crazy year (like user typed 60225), fallback to raw string
        if (isNaN(date.getTime()) || date.getFullYear() > 2100 || date.getFullYear() < 2000) {
            return String(dateStr).substring(0, 10); // cap string length
        }

        return date.toLocaleDateString("en-IN", {
            day: "numeric", month: "short", year: "numeric",
        });
    };

    const isPaid = invoice.status === "Paid";
    const isOverdue = invoice.status === "Overdue";
    const statusClass = invoice.status?.toLowerCase() || '';

    return (
        <>
            <motion.div
                className="ic-card"
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ duration: 0.4, delay: Math.min(index * 0.1, 0.5) }}
                whileHover={{
                    scale: 1.02,
                    y: -4,
                    boxShadow: "0 20px 40px rgba(0,0,0,0.4)",
                    borderColor: "#333",
                    transition: { duration: 0.2 }
                }}
            >
                {/* Row 1: Client Name + Status Badge */}
                <div className="ic-row-header">
                    <h4 className="ic-client">{invoice.client_name}</h4>
                    <span className={`ic-badge badge-${statusClass}`}>
                        <span className="ic-dot" /> {invoice.status}
                    </span>
                </div>

                {/* Row 2: Invoice ID */}
                <div className="ic-id">#{invoice.invoice_id}</div>

                {/* Divider */}
                <div className="ic-divider" />

                {/* Row 3: Amount */}
                <div className="ic-row">
                    <span className="ic-label">Amount</span>
                    <span className="ic-val">{formatCurrency(invoice.amount)}</span>
                </div>

                {/* Row 4: Penalty */}
                {invoice.penalty_amount > 0 && (
                    <div className="ic-row penalty">
                        <span className="ic-label">Penalty</span>
                        <span className="ic-val">+ {formatCurrency(invoice.penalty_amount)}</span>
                    </div>
                )}

                {/* Row 5: Total Due */}
                <div className="ic-row total-row">
                    <span className="ic-label">Total Due</span>
                    <span className="ic-val ic-total">{formatCurrency(invoice.total_amount_due || invoice.amount)}</span>
                </div>

                {/* Row 6: Due Date */}
                <div className="ic-row">
                    <span className="ic-label">Due Date</span>
                    <span className="ic-val">{formatDate(invoice.due_date)}</span>
                </div>

                {/* Row 7: AI Score */}
                {invoice.ai_behavior_score && (
                    <div className="ic-row">
                        <span className="ic-label">AI Score</span>
                        <span className="ic-val ic-ai-score">[{invoice.ai_behavior_score}/100]</span>
                    </div>
                )}

                {/* Divider */}
                <div className="ic-divider" />

                {/* Row 8: Action Buttons */}
                <div className="ic-actions">
                    <Link href={`/invoices/${invoice.invoice_id}`} className="ic-btn btn-view">
                        <ExternalLink size={14} /> View
                    </Link>

                    {!isPaid && (
                        <button
                            className={`ic-btn btn-pay ${actionSuccess === 'pay' ? 'success' : ''}`}
                            onClick={handleMarkPaid}
                            disabled={loading}
                        >
                            {actionSuccess === "pay" ? <CheckCircle size={14} /> : "Mark Paid"}
                        </button>
                    )}

                    {!isPaid && (
                        <button
                            className={`ic-btn btn-remind ${actionSuccess === 'remind' ? 'success' : ''}`}
                            onClick={handleRemind}
                            disabled={loading}
                        >
                            {actionSuccess === "remind" ? <CheckCircle size={14} /> : <Bell size={14} className="bell-icon" />}
                            Remind
                        </button>
                    )}
                </div>

                {/* LinkedIn button full width for paid */}
                {isPaid && (
                    <button className="ic-btn btn-linkedin" onClick={() => setShowLinkedIn(true)} style={{ width: '100%', marginTop: 8 }}>
                        Post to LinkedIn
                    </button>
                )}

                {invoice.legal_notice_sent === "TRUE" && (
                    <div className="ic-corner-badge badge-danger">⚖️ Notice Sent</div>
                )}
            </motion.div>

            {showLinkedIn && <LinkedInModal invoice={invoice} onClose={() => setShowLinkedIn(false)} />}

            <style jsx>{`
                .ic-card {
                    background: #161616;
                    border: 1px solid #222222;
                    border-radius: 12px;
                    padding: 24px;
                    display: flex;
                    flex-direction: column;
                    position: relative;
                }

                .ic-row-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 4px;
                }
                .ic-client {
                    font-size: 16px;
                    font-weight: 700;
                    color: white;
                    margin: 0;
                }

                .ic-badge {
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                    padding: 3px 10px;
                    border-radius: 20px;
                    font-size: 11px;
                    font-weight: 600;
                    text-transform: uppercase;
                    border: 1px solid transparent;
                }
                .ic-dot { width: 6px; height: 6px; border-radius: 50%; background: currentColor; }
                .badge-paid { background: #14532d; color: #86efac; border-color: #166534; }
                .badge-unpaid { background: #451a03; color: #fcd34d; border-color: #92400e; }
                .badge-overdue { background: #7f1d1d; color: #fca5a5; border-color: #991b1b; }

                .ic-id {
                    font-size: 12px;
                    color: #444444;
                    font-family: monospace;
                    font-weight: 600;
                    margin-bottom: 12px;
                }

                .ic-divider {
                    width: 100%;
                    height: 1px;
                    border-top: 1px dashed #333333;
                    margin: 12px 0;
                }

                .ic-row {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 8px;
                }
                .ic-label { color: #666666; font-size: 13px; }
                .ic-val { color: white; font-size: 14px; font-weight: 500; }

                .penalty .ic-label { color: #ef4444; }
                .penalty .ic-val { color: #ef4444; }

                .ic-total { font-weight: 700; font-size: 15px; }

                .ic-ai-score { color: #888888; font-family: monospace; }

                /* Actions */
                .ic-actions {
                    display: flex;
                    gap: 8px;
                    margin-top: 16px;
                    width: 100%;
                }
                .ic-btn {
                    flex: 1;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    gap: 6px;
                    height: 38px;
                    border-radius: 8px;
                    font-size: 13px;
                    font-weight: 600;
                    border: none;
                    cursor: pointer;
                    transition: all 0.15s ease;
                }
                .ic-btn:disabled { opacity: 0.6; cursor: not-allowed; }

                .btn-view { background: transparent; border: 1px solid #2a2a2a; color: #888888; }
                .btn-view:hover { border-color: #444444; color: white; }

                .btn-pay { background: #15803d; color: white; }
                .btn-pay:hover { background: #16a34a; transform: scale(1.03); }
                .btn-pay.success { background: #22c55e; }

                .btn-remind { background: transparent; border: 1px solid #1d4ed8; color: #3b82f6; }
                .btn-remind:hover { background: rgba(59, 130, 246, 0.1); }
                .btn-remind:active .bell-icon { animation: bellShake 0.4s ease; }
                .btn-remind.success { background: #1a1a1a; color: #4ade80; border-color: #1a1a1a; }

                .btn-linkedin { background: #0077b5; color: white; flex: none; }
                .btn-linkedin:hover { background: #005885; }

                .btn-danger { background: rgba(239,68,68,0.1); color: #ef4444; border: 1px solid rgba(239,68,68,0.2); }
                .btn-danger:hover { background: rgba(239,68,68,0.2); }

                .checkmark-anim { animation: checkmarkDraw 0.4s ease-out forwards; }

                .ic-corner-badge {
                    position: absolute;
                    top: -10px;
                    left: 20px;
                    padding: 4px 10px;
                    border-radius: 100px;
                    font-size: 10px;
                    font-weight: 700;
                    text-transform: uppercase;
                    background: #111111;
                    border: 1px solid #333333;
                }
                .badge-danger { color: #fca5a5; border-color: #ef4444; }
            `}</style>
        </>
    );
}

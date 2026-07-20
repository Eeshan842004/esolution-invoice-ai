"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

export default function InvoiceDetailPage() {
    const { id } = useParams();
    const router = useRouter();
    const { data: session } = useSession();
    const [invoice, setInvoice] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [aiSuggestion, setAiSuggestion] = useState(null);
    const [loadingSuggestion, setLoadingSuggestion] = useState(false);
    const [emailData, setEmailData] = useState(null);
    const [markingPaid, setMarkingPaid] = useState(false);
    const [paymentRef, setPaymentRef] = useState("");
    const [showPayModal, setShowPayModal] = useState(false);
    const [toast, setToast] = useState(null);

    useEffect(() => {
        fetchInvoice();
    }, [id]);

    const fetchInvoice = async () => {
        try {
            setLoading(true);
            const res = await fetch(`/api/invoices/${id}`);
            if (!res.ok) throw new Error("Invoice not found");
            const data = await res.json();
            setInvoice(data.invoice);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const showToast = (message, type = "success") => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 4000);
    };

    const getAiSuggestion = async () => {
        try {
            setLoadingSuggestion(true);
            const res = await fetch(`/api/invoices/${id}/suggest`, { method: "POST" });
            const data = await res.json();
            setAiSuggestion(data.suggestion);
        } catch (err) {
            showToast("Failed to get AI suggestion", "error");
        } finally {
            setLoadingSuggestion(false);
        }
    };

    const sendPaymentEmail = async () => {
        try {
            const res = await fetch(`/api/invoices/${id}/send-email`, { method: "POST" });
            const data = await res.json();
            if (data.mailto_link) {
                setEmailData(data.email);
                window.open(data.mailto_link, "_blank");
                showToast("Email client opened! Send the payment request.");
            }
        } catch (err) {
            showToast("Failed to generate email", "error");
        }
    };

    const sendReminder = async () => {
        try {
            const res = await fetch(`/api/invoices/${id}/remind`, { method: "POST" });
            const data = await res.json();
            if (data.success) {
                showToast(`Reminder #${data.reminder_count} sent!`);
                fetchInvoice(); // Refresh to update reminder count
            } else {
                showToast(data.error || "Failed to send reminder", "error");
            }
        } catch (err) {
            showToast("Failed to send reminder", "error");
        }
    };

    const markAsPaid = async () => {
        try {
            setMarkingPaid(true);
            const res = await fetch(`/api/invoices/${id}/pay`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ payment_reference: paymentRef }),
            });
            if (res.ok) {
                showToast("Invoice marked as paid! 🎉");
                setShowPayModal(false);
                fetchInvoice();
            }
        } catch (err) {
            showToast("Failed to mark as paid", "error");
        } finally {
            setMarkingPaid(false);
        }
    };

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat("en-IN", {
            style: "currency",
            currency: "INR",
            maximumFractionDigits: 0,
        }).format(amount || 0);
    };

    const formatDate = (dateStr) => {
        if (!dateStr) return "—";
        return new Date(dateStr).toLocaleDateString("en-IN", {
            day: "numeric",
            month: "long",
            year: "numeric",
        });
    };

    if (loading) {
        return (
            <div className="dashboard-loading">
                <div className="spinner"></div>
                <p>Loading invoice...</p>
            </div>
        );
    }

    if (error || !invoice) {
        return (
            <div className="dashboard">
                <div className="empty-state">
                    <h4>Invoice Not Found</h4>
                    <p>The invoice you're looking for doesn't exist or has been removed.</p>
                    <Link href="/dashboard" className="btn btn-primary">Back to Dashboard</Link>
                </div>
            </div>
        );
    }

    return (
        <div className="dashboard">
            {/* Toast Notification */}
            {toast && (
                <div className={`toast toast-${toast.type}`}>
                    {toast.type === "success" ? "✅" : "❌"} {toast.message}
                </div>
            )}

            {/* Pay Modal */}
            {showPayModal && (
                <div className="modal-overlay" onClick={() => setShowPayModal(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>Mark Invoice as Paid</h3>
                            <button className="btn btn-ghost btn-icon" onClick={() => setShowPayModal(false)}>
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="18" y1="6" x2="6" y2="18" />
                                    <line x1="6" y1="6" x2="18" y2="18" />
                                </svg>
                            </button>
                        </div>
                        <div className="modal-body">
                            <p>
                                Confirming payment of <strong>{formatCurrency(invoice.amount)}</strong> from{" "}
                                <strong>{invoice.client_name}</strong>.
                            </p>
                            <div className="form-group" style={{ marginTop: "16px" }}>
                                <label className="form-label">Payment Reference (Optional)</label>
                                <input
                                    type="text"
                                    value={paymentRef}
                                    onChange={(e) => setPaymentRef(e.target.value)}
                                    className="form-input"
                                    placeholder="e.g. UTR number, transaction ID..."
                                />
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-ghost" onClick={() => setShowPayModal(false)}>
                                Cancel
                            </button>
                            <button
                                className="btn btn-primary"
                                onClick={markAsPaid}
                                disabled={markingPaid}
                            >
                                {markingPaid ? "Processing..." : "Confirm Payment"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Header */}
            <div className="page-header">
                <Link href="/dashboard" className="back-link">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="15 18 9 12 15 6" />
                    </svg>
                    Back to Dashboard
                </Link>
                <div className="page-header-row">
                    <div>
                        <h2>Invoice {invoice.invoice_id}</h2>
                        <p>Created for {invoice.client_name}</p>
                    </div>
                    <span className={`status-badge status-badge-lg ${invoice.status?.toLowerCase()}`}>
                        <span className="status-dot"></span>
                        {invoice.status}
                    </span>
                </div>
            </div>

            <div className="detail-layout">
                {/* Main Detail Card */}
                <div className="detail-main">
                    <div className="card">
                        <div className="card-header">
                            <h3 className="card-title">Invoice Details</h3>
                        </div>

                        <div className="detail-grid">
                            <div className="detail-item">
                                <span className="detail-label">Client Name</span>
                                <span className="detail-value">{invoice.client_name}</span>
                            </div>
                            <div className="detail-item">
                                <span className="detail-label">Client Email</span>
                                <span className="detail-value">{invoice.client_email}</span>
                            </div>
                            <div className="detail-item">
                                <span className="detail-label">Amount</span>
                                <span className="detail-value detail-amount">{formatCurrency(invoice.amount)}</span>
                            </div>
                            <div className="detail-item">
                                <span className="detail-label">Due Date</span>
                                <span className="detail-value">{formatDate(invoice.due_date)}</span>
                            </div>
                            {invoice.discount_percentage > 0 && (
                                <>
                                    <div className="detail-item">
                                        <span className="detail-label">Discount</span>
                                        <span className="detail-value" style={{ color: "var(--status-paid)" }}>
                                            {invoice.discount_percentage}%
                                        </span>
                                    </div>
                                    <div className="detail-item">
                                        <span className="detail-label">Discounted Amount</span>
                                        <span className="detail-value">{formatCurrency(invoice.discounted_amount)}</span>
                                    </div>
                                </>
                            )}
                            {invoice.days_overdue > 0 && (
                                <>
                                    <div className="detail-item">
                                        <span className="detail-label">Days Overdue</span>
                                        <span className="detail-value" style={{ color: "var(--status-overdue)" }}>
                                            {invoice.days_overdue} days
                                        </span>
                                    </div>
                                    <div className="detail-item">
                                        <span className="detail-label">Penalty</span>
                                        <span className="detail-value" style={{ color: "var(--status-overdue)" }}>
                                            {formatCurrency(invoice.penalty_amount)}
                                        </span>
                                    </div>
                                    <div className="detail-item">
                                        <span className="detail-label">Total Due (with Penalty)</span>
                                        <span className="detail-value detail-amount" style={{ color: "var(--status-overdue)" }}>
                                            {formatCurrency(invoice.total_amount_due)}
                                        </span>
                                    </div>
                                </>
                            )}
                            {invoice.paid_date && (
                                <div className="detail-item">
                                    <span className="detail-label">Paid Date</span>
                                    <span className="detail-value" style={{ color: "var(--status-paid)" }}>
                                        {formatDate(invoice.paid_date)}
                                    </span>
                                </div>
                            )}
                            {invoice.payment_reference && (
                                <div className="detail-item">
                                    <span className="detail-label">Payment Reference</span>
                                    <span className="detail-value">{invoice.payment_reference}</span>
                                </div>
                            )}
                            <div className="detail-item">
                                <span className="detail-label">Reminders Sent</span>
                                <span className="detail-value">{invoice.reminder_count || 0}</span>
                            </div>
                            {invoice.notes && (
                                <div className="detail-item detail-full">
                                    <span className="detail-label">Notes</span>
                                    <span className="detail-value">{invoice.notes}</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Actions */}
                    {invoice.status !== "Paid" && (
                        <div className="card action-card">
                            <h3 className="card-title" style={{ marginBottom: "16px" }}>Actions</h3>
                            <div className="action-grid">
                                <button className="action-btn" onClick={sendPaymentEmail}>
                                    <div className="action-btn-icon email-icon">
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                                            <polyline points="22,6 12,13 2,6" />
                                        </svg>
                                    </div>
                                    <div>
                                        <strong>Send Payment Request</strong>
                                        <span>Email client with bank/UPI details</span>
                                    </div>
                                </button>

                                <button className="action-btn" onClick={() => setShowPayModal(true)}>
                                    <div className="action-btn-icon paid-icon">
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
                                            <polyline points="22 4 12 14.01 9 11.01" />
                                        </svg>
                                    </div>
                                    <div>
                                        <strong>Mark as Paid</strong>
                                        <span>Confirm payment received</span>
                                    </div>
                                </button>

                                {(invoice.status === "Overdue" || invoice.days_overdue > 0) && (
                                    <button className="action-btn" onClick={sendReminder}>
                                        <div className="action-btn-icon reminder-icon">
                                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
                                                <path d="M13.73 21a2 2 0 01-3.46 0" />
                                            </svg>
                                        </div>
                                        <div>
                                            <strong>Send Reminder</strong>
                                            <span>AI-generated overdue reminder</span>
                                        </div>
                                    </button>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Sidebar */}
                <div className="detail-sidebar">
                    {/* AI Insight */}
                    <div className="card ai-panel">
                        <div className="card-header">
                            <h3 className="card-title">AI Insight</h3>
                            <div className="ai-badge">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M12 2L2 7l10 5 10-5-10-5z" />
                                    <path d="M2 17l10 5 10-5" />
                                    <path d="M2 12l10 5 10-5" />
                                </svg>
                                Gemini
                            </div>
                        </div>

                        {/* Score gauge */}
                        <div className="score-section">
                            <div className="score-gauge">
                                <svg width="80" height="80" viewBox="0 0 80 80">
                                    <circle className="bg" cx="40" cy="40" r="35" />
                                    <circle
                                        className="fill"
                                        cx="40"
                                        cy="40"
                                        r="35"
                                        strokeDasharray={`${2 * Math.PI * 35}`}
                                        strokeDashoffset={`${2 * Math.PI * 35 * (1 - (invoice.payment_behavior_score || 50) / 100)}`}
                                        style={{
                                            stroke:
                                                (invoice.payment_behavior_score || 50) >= 70
                                                    ? "var(--status-paid)"
                                                    : (invoice.payment_behavior_score || 50) >= 40
                                                        ? "var(--status-unpaid)"
                                                        : "var(--status-overdue)",
                                        }}
                                    />
                                </svg>
                                <div className="score-value">{invoice.payment_behavior_score || 50}</div>
                            </div>
                            <p className="score-label">Payment Behavior Score</p>
                        </div>

                        {/* AI Suggestion */}
                        {!aiSuggestion ? (
                            <button
                                className="btn btn-secondary"
                                onClick={getAiSuggestion}
                                disabled={loadingSuggestion}
                                style={{ width: "100%", marginTop: "12px" }}
                            >
                                {loadingSuggestion ? (
                                    <>
                                        <span className="spinner-small"></span>
                                        Analyzing...
                                    </>
                                ) : (
                                    "Get AI Suggestion"
                                )}
                            </button>
                        ) : (
                            <div className="ai-suggestion">
                                <div className="ai-suggestion-header">
                                    <span className={`ai-action ai-action-${aiSuggestion.action}`}>
                                        {aiSuggestion.action?.replace("_", " ")}
                                    </span>
                                    <span className={`ai-tone ai-tone-${aiSuggestion.tone}`}>
                                        {aiSuggestion.tone}
                                    </span>
                                </div>
                                <p className="ai-suggestion-text">{aiSuggestion.message}</p>
                                {aiSuggestion.wait_days > 0 && (
                                    <p className="ai-wait-days">Wait {aiSuggestion.wait_days} days</p>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Payment Info */}
                    <div className="card">
                        <h3 className="card-title" style={{ marginBottom: "12px" }}>Payment Details</h3>
                        <div className="payment-info">
                            <div className="payment-info-row">
                                <span>Method</span>
                                <strong>Bank / UPI</strong>
                            </div>
                            <div className="payment-info-row">
                                <span>Status</span>
                                <span className={`status-badge ${invoice.status?.toLowerCase()}`}>
                                    <span className="status-dot"></span>
                                    {invoice.status}
                                </span>
                            </div>
                            {invoice.last_reminder_date && (
                                <div className="payment-info-row">
                                    <span>Last Reminder</span>
                                    <strong>{formatDate(invoice.last_reminder_date)}</strong>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";

export default function ClientPortalPage() {
    const params = useParams();
    const searchParams = useSearchParams();
    const invoiceId = params.invoiceId;
    const token = searchParams.get("token");

    const [invoice, setInvoice] = useState(null);
    const [payment, setPayment] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [qrDataUrl, setQrDataUrl] = useState(null);
    const [activePanel, setActivePanel] = useState(null); // "pay" | "partial" | "installment" | "dispute"
    const [actionLoading, setActionLoading] = useState(false);
    const [actionResult, setActionResult] = useState(null);
    const [partialAmount, setPartialAmount] = useState("");
    const [clientMessage, setClientMessage] = useState("");

    useEffect(() => {
        if (!invoiceId || !token) {
            setError("Invalid or missing invoice link.");
            setLoading(false);
            return;
        }
        fetchInvoice();
    }, [invoiceId, token]);

    async function fetchInvoice() {
        try {
            const res = await fetch(`/api/invoices/${invoiceId}/portal?token=${token}`);
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Failed to load invoice");
            setInvoice(data.invoice);
            setPayment(data.payment);

            // Generate QR code client-side
            if (data.payment.upi_id) {
                const QRCode = (await import("qrcode")).default;
                const upiStr = `upi://pay?pa=${encodeURIComponent(data.payment.upi_id)}&pn=${encodeURIComponent(data.payment.owner_name)}&am=${data.invoice.final_amount || data.invoice.amount}&cu=INR`;
                const url = await QRCode.toDataURL(upiStr, { width: 240, margin: 2, color: { dark: "#1a3b7d" } });
                setQrDataUrl(url);
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }

    async function handleAction(action) {
        setActionLoading(true);
        setActionResult(null);
        try {
            const res = await fetch(`/api/invoices/${invoiceId}/actions`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    token,
                    action,
                    message: clientMessage,
                    amount: partialAmount,
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Action failed");
            setActionResult({ success: true, message: data.message });
            setActivePanel(null);
            fetchInvoice(); // Refresh data
        } catch (err) {
            setActionResult({ success: false, message: err.message });
        } finally {
            setActionLoading(false);
        }
    }

    if (loading) {
        return (
            <div style={styles.loadingContainer}>
                <div style={styles.spinner}></div>
                <p style={{ color: "#64748b", marginTop: 16 }}>Loading invoice...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div style={styles.loadingContainer}>
                <div style={{ fontSize: 48, marginBottom: 16 }}>🔒</div>
                <h2 style={{ color: "#dc2626", marginBottom: 8 }}>Access Denied</h2>
                <p style={{ color: "#64748b" }}>{error}</p>
            </div>
        );
    }

    const amount = parseFloat(invoice.amount) || 0;
    const finalAmount = parseFloat(invoice.final_amount) || amount;
    const daysOverdue = parseInt(invoice.days_overdue) || 0;
    const isOverdue = invoice.status === "Overdue";
    const isPaid = invoice.status === "Paid";
    const isClaimed = invoice.payment_claimed === "TRUE";

    // Calculate due countdown
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dueDate = new Date(invoice.due_date);
    dueDate.setHours(0, 0, 0, 0);
    const daysUntilDue = Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24));

    return (
        <div style={styles.pageWrapper}>
            {/* Header */}
            <header style={styles.header}>
                <div style={styles.headerInner}>
                    <div style={styles.logo}>
                        <div style={styles.logoIcon}>E</div>
                        <div>
                            <div style={styles.logoText}>ESolution</div>
                            <div style={styles.logoSub}>Invoice Portal</div>
                        </div>
                    </div>
                </div>
            </header>

            <main style={styles.main}>
                {/* Status Banner */}
                {isPaid && (
                    <div style={{ ...styles.banner, background: "linear-gradient(135deg,#059669,#10b981)" }}>
                        ✅ This invoice has been paid. Thank you!
                    </div>
                )}
                {isClaimed && !isPaid && (
                    <div style={{ ...styles.banner, background: "linear-gradient(135deg,#d97706,#f59e0b)" }}>
                        ⏳ Payment claimed — awaiting verification from the business owner.
                    </div>
                )}
                {isOverdue && !isPaid && !isClaimed && (
                    <div style={{ ...styles.banner, background: "linear-gradient(135deg,#dc2626,#ef4444)" }}>
                        ⚠️ This invoice is {daysOverdue} days overdue!
                    </div>
                )}
                {!isOverdue && !isPaid && !isClaimed && daysUntilDue >= 0 && (
                    <div style={{ ...styles.banner, background: "linear-gradient(135deg,#2563eb,#3b82f6)" }}>
                        📅 Payment due in {daysUntilDue} day{daysUntilDue !== 1 ? "s" : ""}
                    </div>
                )}

                {/* Action Result */}
                {actionResult && (
                    <div style={{
                        ...styles.banner,
                        background: actionResult.success
                            ? "linear-gradient(135deg,#059669,#10b981)"
                            : "linear-gradient(135deg,#dc2626,#ef4444)",
                        marginBottom: 0,
                    }}>
                        {actionResult.message}
                    </div>
                )}

                {/* Invoice Card */}
                <div style={styles.card}>
                    <div style={styles.cardHeader}>
                        <h2 style={styles.cardTitle}>Invoice Details</h2>
                        <a
                            href={`/api/invoices/${invoiceId}/pdf`}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={styles.downloadBtn}
                        >
                            📥 Download PDF
                        </a>
                    </div>

                    <div style={styles.detailsGrid}>
                        <div style={styles.detailItem}>
                            <span style={styles.detailLabel}>Invoice #</span>
                            <span style={styles.detailValue}>{invoice.invoice_id}</span>
                        </div>
                        <div style={styles.detailItem}>
                            <span style={styles.detailLabel}>Client</span>
                            <span style={styles.detailValue}>{invoice.client_name}</span>
                        </div>
                        <div style={styles.detailItem}>
                            <span style={styles.detailLabel}>Due Date</span>
                            <span style={{ ...styles.detailValue, color: isOverdue ? "#dc2626" : "#1e293b" }}>{invoice.due_date}</span>
                        </div>
                        <div style={styles.detailItem}>
                            <span style={styles.detailLabel}>Status</span>
                            <span style={{
                                ...styles.statusBadge,
                                background: isPaid ? "#dcfce7" : isOverdue ? "#fef2f2" : "#fff7ed",
                                color: isPaid ? "#166534" : isOverdue ? "#991b1b" : "#9a3412",
                            }}>
                                {invoice.status}
                            </span>
                        </div>
                    </div>

                    {/* Amount Summary */}
                    <div style={styles.amountBox}>
                        <div style={styles.amountRow}>
                            <span>Amount</span>
                            <span>₹{amount.toLocaleString("en-IN")}</span>
                        </div>
                        {parseFloat(invoice.discount_percent) > 0 && (
                            <div style={{ ...styles.amountRow, color: "#16a34a" }}>
                                <span>Discount ({invoice.discount_percent}%)</span>
                                <span>-₹{(amount - finalAmount).toLocaleString("en-IN")}</span>
                            </div>
                        )}
                        {parseFloat(invoice.penalty_amount) > 0 && (
                            <div style={{ ...styles.amountRow, color: "#dc2626" }}>
                                <span>Late Penalty</span>
                                <span>+₹{parseFloat(invoice.penalty_amount).toLocaleString("en-IN")}</span>
                            </div>
                        )}
                        <div style={styles.totalRow}>
                            <span>Balance Due</span>
                            <span>₹{(parseFloat(invoice.total_amount_due) || finalAmount).toLocaleString("en-IN")}</span>
                        </div>
                    </div>

                    {invoice.notes && (
                        <div style={styles.notesBox}>
                            <strong>Notes:</strong> {invoice.notes}
                        </div>
                    )}
                </div>

                {/* Payment Section */}
                {!isPaid && !isClaimed && (
                    <div style={styles.card}>
                        <h2 style={styles.cardTitle}>Make Payment</h2>

                        <div style={styles.paymentGrid}>
                            {/* QR Code */}
                            {qrDataUrl && (
                                <div style={styles.qrSection}>
                                    <p style={styles.qrLabel}>Scan to Pay via UPI</p>
                                    <img src={qrDataUrl} alt="UPI QR Code" style={styles.qrImg} />
                                    <p style={styles.upiId}>{payment.upi_id}</p>
                                </div>
                            )}

                            {/* Bank Details */}
                            <div style={styles.bankSection}>
                                <h3 style={styles.bankTitle}>🏦 Bank Transfer</h3>
                                {payment.bank_account && (
                                    <div style={styles.bankRow}>
                                        <span style={styles.bankLabel}>Account</span>
                                        <span style={styles.bankValue}>{payment.bank_account}</span>
                                    </div>
                                )}
                                {payment.bank_ifsc && (
                                    <div style={styles.bankRow}>
                                        <span style={styles.bankLabel}>IFSC</span>
                                        <span style={styles.bankValue}>{payment.bank_ifsc}</span>
                                    </div>
                                )}
                                {payment.upi_id && (
                                    <div style={styles.bankRow}>
                                        <span style={styles.bankLabel}>UPI ID</span>
                                        <span style={styles.bankValue}>{payment.upi_id}</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Action Buttons */}
                        <div style={styles.actionGrid}>
                            <button style={styles.payBtn} onClick={() => handleAction("payment_claimed")} disabled={actionLoading}>
                                {actionLoading ? "Processing..." : "✅ I Have Paid"}
                            </button>
                            <button style={styles.partialBtn} onClick={() => setActivePanel(activePanel === "partial" ? null : "partial")}>
                                📊 Propose Partial Payment
                            </button>
                            <button style={styles.installBtn} onClick={() => setActivePanel(activePanel === "installment" ? null : "installment")}>
                                📋 Request Installments
                            </button>
                        </div>

                        {/* Partial Payment Panel */}
                        {activePanel === "partial" && (
                            <div style={styles.panel}>
                                <h3 style={styles.panelTitle}>Propose Partial Payment</h3>
                                <input
                                    type="number"
                                    placeholder="Amount you can pay now (₹)"
                                    value={partialAmount}
                                    onChange={(e) => setPartialAmount(e.target.value)}
                                    style={styles.input}
                                />
                                <textarea
                                    placeholder="Message (optional)"
                                    value={clientMessage}
                                    onChange={(e) => setClientMessage(e.target.value)}
                                    style={styles.textarea}
                                />
                                <button style={styles.submitBtn} onClick={() => handleAction("partial_payment")} disabled={actionLoading}>
                                    {actionLoading ? "Sending..." : "Send Proposal"}
                                </button>
                            </div>
                        )}

                        {/* Installment Panel */}
                        {activePanel === "installment" && (
                            <div style={styles.panel}>
                                <h3 style={styles.panelTitle}>Request Installment Plan</h3>
                                <textarea
                                    placeholder="Describe your preferred installment schedule (e.g., 3 monthly payments)..."
                                    value={clientMessage}
                                    onChange={(e) => setClientMessage(e.target.value)}
                                    style={styles.textarea}
                                />
                                <button style={styles.submitBtn} onClick={() => handleAction("installment")} disabled={actionLoading}>
                                    {actionLoading ? "Sending..." : "Send Request"}
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {/* Dispute / Contact Section */}
                {!isPaid && (
                    <div style={styles.card}>
                        <h2 style={styles.cardTitle}>Have an Issue?</h2>
                        <textarea
                            placeholder="Describe your concern or question..."
                            value={clientMessage}
                            onChange={(e) => setClientMessage(e.target.value)}
                            style={styles.textarea}
                        />
                        <button style={styles.disputeBtn} onClick={() => handleAction("dispute")} disabled={actionLoading || !clientMessage}>
                            {actionLoading ? "Sending..." : "Send Message"}
                        </button>
                    </div>
                )}

                {/* WhatsApp Share (for the business owner link in emails, not shown to client) */}
            </main>

            {/* Footer */}
            <footer style={styles.footer}>
                <p>ESolution Invoice System — Powered by AI</p>
                <p style={{ fontSize: 12, marginTop: 4 }}>This is a secure payment portal. Your invoice link is unique to you.</p>
            </footer>
        </div>
    );
}

const styles = {
    pageWrapper: { minHeight: "100vh", background: "#f0f2f5", fontFamily: "'Segoe UI', Arial, sans-serif" },
    loadingContainer: { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", background: "#f0f2f5" },
    spinner: { width: 40, height: 40, border: "4px solid #e2e8f0", borderTop: "4px solid #2563eb", borderRadius: "50%", animation: "spin 0.8s linear infinite" },

    header: { background: "linear-gradient(135deg, #0f172a, #1e293b)", padding: "20px 0", boxShadow: "0 2px 12px rgba(0,0,0,0.15)" },
    headerInner: { maxWidth: 800, margin: "0 auto", padding: "0 24px", display: "flex", alignItems: "center" },
    logo: { display: "flex", alignItems: "center", gap: 12 },
    logoIcon: { width: 42, height: 42, borderRadius: 10, background: "linear-gradient(135deg,#6366f1,#8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontWeight: 800, fontSize: 20 },
    logoText: { color: "white", fontSize: 22, fontWeight: 700, letterSpacing: 0.5 },
    logoSub: { color: "#94a3b8", fontSize: 12 },

    main: { maxWidth: 800, margin: "0 auto", padding: "24px 24px 40px" },

    banner: { color: "white", padding: "14px 20px", borderRadius: 12, fontSize: 15, fontWeight: 600, marginBottom: 20, textAlign: "center" },

    card: { background: "white", borderRadius: 16, padding: "28px 32px", marginBottom: 20, boxShadow: "0 1px 8px rgba(0,0,0,0.06)" },
    cardHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 },
    cardTitle: { fontSize: 20, fontWeight: 700, color: "#1e293b", margin: 0, marginBottom: 16 },
    downloadBtn: { background: "#f1f5f9", color: "#1e293b", padding: "10px 20px", borderRadius: 8, textDecoration: "none", fontSize: 14, fontWeight: 600, border: "1px solid #e2e8f0" },

    detailsGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 },
    detailItem: { display: "flex", flexDirection: "column", gap: 4 },
    detailLabel: { fontSize: 12, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 1 },
    detailValue: { fontSize: 15, fontWeight: 600, color: "#1e293b" },
    statusBadge: { display: "inline-block", padding: "4px 12px", borderRadius: 20, fontSize: 13, fontWeight: 600, width: "fit-content" },

    amountBox: { background: "#f8fafc", borderRadius: 12, padding: 20, border: "1px solid #e2e8f0" },
    amountRow: { display: "flex", justifyContent: "space-between", padding: "8px 0", fontSize: 15, color: "#475569" },
    totalRow: { display: "flex", justifyContent: "space-between", padding: "12px 0 0", fontSize: 20, fontWeight: 800, color: "#1a3b7d", borderTop: "2px solid #e2e8f0", marginTop: 8 },

    notesBox: { marginTop: 16, padding: "12px 16px", background: "#fffbeb", borderRadius: 8, fontSize: 14, color: "#92400e", border: "1px solid #fde68a" },

    paymentGrid: { display: "flex", gap: 24, flexWrap: "wrap", marginBottom: 24 },
    qrSection: { flex: 1, minWidth: 200, textAlign: "center", padding: 20, background: "#f8fafc", borderRadius: 12, border: "1px solid #e2e8f0" },
    qrLabel: { fontSize: 14, color: "#64748b", marginBottom: 12 },
    qrImg: { borderRadius: 8 },
    upiId: { marginTop: 8, fontSize: 14, fontWeight: 700, color: "#1a3b7d" },

    bankSection: { flex: 1, minWidth: 250, padding: 20, background: "#eff6ff", borderRadius: 12, border: "1px solid #bfdbfe" },
    bankTitle: { fontSize: 16, fontWeight: 700, color: "#1e3a8a", marginTop: 0, marginBottom: 16 },
    bankRow: { display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: 14 },
    bankLabel: { color: "#64748b" },
    bankValue: { fontWeight: 600, color: "#1e293b" },

    actionGrid: { display: "flex", gap: 12, flexWrap: "wrap" },
    payBtn: { flex: 1, minWidth: 160, padding: "14px 20px", background: "linear-gradient(135deg,#059669,#10b981)", color: "white", border: "none", borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: "pointer" },
    partialBtn: { flex: 1, minWidth: 160, padding: "14px 20px", background: "linear-gradient(135deg,#2563eb,#3b82f6)", color: "white", border: "none", borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: "pointer" },
    installBtn: { flex: 1, minWidth: 160, padding: "14px 20px", background: "linear-gradient(135deg,#7c3aed,#8b5cf6)", color: "white", border: "none", borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: "pointer" },

    panel: { marginTop: 20, padding: 20, background: "#f8fafc", borderRadius: 12, border: "1px solid #e2e8f0" },
    panelTitle: { fontSize: 16, fontWeight: 700, color: "#1e293b", marginTop: 0, marginBottom: 12 },
    input: { width: "100%", padding: "12px 16px", border: "1px solid #cbd5e1", borderRadius: 8, fontSize: 15, marginBottom: 12, boxSizing: "border-box" },
    textarea: { width: "100%", padding: "12px 16px", border: "1px solid #cbd5e1", borderRadius: 8, fontSize: 14, minHeight: 80, resize: "vertical", marginBottom: 12, boxSizing: "border-box" },
    submitBtn: { padding: "12px 28px", background: "linear-gradient(135deg,#2563eb,#1d4ed8)", color: "white", border: "none", borderRadius: 8, fontSize: 15, fontWeight: 700, cursor: "pointer" },
    disputeBtn: { padding: "12px 28px", background: "#f1f5f9", color: "#475569", border: "1px solid #cbd5e1", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer" },

    footer: { textAlign: "center", padding: "24px", color: "#94a3b8", fontSize: 13, background: "#f8fafc", borderTop: "1px solid #e2e8f0" },
};

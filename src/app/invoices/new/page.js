"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import VoiceMicButton from "@/components/VoiceMicButton";
import KarmaBadge from "@/components/KarmaBadge";
import { ArrowLeft, CheckCircle2, Sparkles } from "lucide-react";

export default function NewInvoicePage() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);
    const [karma, setKarma] = useState(null);
    const [karmaLoading, setKarmaLoading] = useState(false);
    const [phase, setPhase] = useState('idle'); // idle | stretch | rumble | launch | done
    const [flashField, setFlashField] = useState(null);

    const [form, setForm] = useState({
        client_name: "",
        client_email: "",
        amount: "",
        due_date: "",
        discount_percentage: "",
        notes: "",
    });



    const checkKarma = async (email, name) => {
        if (!email || !name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            setKarma(null);
            return;
        }
        setKarmaLoading(true);
        try {
            const res = await fetch(`/api/karma/check?email=${encodeURIComponent(email)}&name=${encodeURIComponent(name)}`);
            const data = await res.json();
            setKarma(data);
        } catch (e) {
            console.warn("Karma check failed:", e.message);
            setKarma(null);
        } finally {
            setKarmaLoading(false);
        }
    };

    // Use effect to check karma when both fields are filled
    useEffect(() => {
        const timeoutId = setTimeout(() => {
            if (form.client_email && form.client_name) {
                checkKarma(form.client_email, form.client_name);
            } else {
                setKarma(null);
            }
        }, 500);
        return () => clearTimeout(timeoutId);
    }, [form.client_email, form.client_name]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setForm({ ...form, [name]: value });
        setError(null);
        // Flash preview value
        setFlashField(name);
        setTimeout(() => setFlashField(null), 300);
    };

    const calculatedAmount = () => {
        const amt = parseFloat(form.amount) || 0;
        const disc = parseFloat(form.discount_percentage) || 0;
        return Math.round(amt * (1 - disc / 100) * 100) / 100;
    };

    const isFormReady = form.client_name && form.client_email && form.amount && form.due_date;

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        // Phase 1: Stretch
        setPhase('stretch');

        await new Promise(r => setTimeout(r, 200));

        // Phase 2: Rumble
        setPhase('rumble');

        try {
            const res = await fetch("/api/invoices/create", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    ...form,
                    amount: parseFloat(form.amount),
                    discount_percentage: parseFloat(form.discount_percentage) || 0,
                }),
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.detail || data.error || "Failed to create invoice");
            }

            // Phase 3: Launch
            setPhase('launch');
            await new Promise(r => setTimeout(r, 400));

            setPhase('done');
            setSuccess(data.invoice);
            setLoading(false);
        } catch (err) {
            setPhase('idle');
            setError(err.message);
            setLoading(false);
        }
    };

    const handleVoiceFill = (fields) => {
        setForm((prev) => ({
            ...prev,
            client_name: fields.clientName || prev.client_name,
            client_email: fields.clientEmail || prev.client_email,
            amount: fields.amount != null ? String(fields.amount) : prev.amount,
            due_date: fields.dueDate || prev.due_date,
            discount_percentage: fields.discount != null ? String(fields.discount) : prev.discount_percentage,
            notes: fields.notes || prev.notes,
        }));
    };

    const getTomorrow = () => {
        const d = new Date();
        d.setDate(d.getDate() + 1);
        return d.toISOString().split("T")[0];
    };

    if (success) {
        return (
            <div className="dashboard-container">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    className="success-page-new"
                >
                    <div className="success-icon-anim text-green">
                        <CheckCircle2 size={80} style={{ animation: "breathe 3s infinite" }} />
                    </div>
                    <h2>Invoice Created! 🎉</h2>
                    <p className="success-id-new">ID: {success.invoice_id}</p>
                    <div className="success-details-grid">
                        <div className="grid-item">
                            <span>Client</span>
                            <strong>{success.client_name}</strong>
                        </div>
                        <div className="grid-item">
                            <span>Amount</span>
                            <strong>₹{success.amount?.toLocaleString("en-IN")}</strong>
                        </div>
                        <div className="grid-item">
                            <span>Due Date</span>
                            <strong>{success.due_date}</strong>
                        </div>
                        <div className="grid-item">
                            <span>AI Score</span>
                            <strong className="text-indigo">{success.payment_behavior_score}/100</strong>
                        </div>
                    </div>
                    <div className="success-actions-new">
                        <Link href={`/invoices/${success.invoice_id}`} className="btn-main-new">
                            View Invoice
                        </Link>
                        <button
                            className="btn-sec-new"
                            onClick={() => {
                                setSuccess(null);
                                setPhase('idle');
                                setForm({
                                    client_name: "", client_email: "", amount: "", due_date: "", discount_percentage: "", notes: "",
                                });
                            }}
                        >
                            Create Another
                        </button>
                        <Link href="/dashboard" className="btn-ghost-new">
                            <span className="back-arrow">←</span> Back to Dashboard
                        </Link>
                    </div>
                </motion.div>
                <style jsx>{`
                    .success-page-new {
                        max-width: 600px;
                        margin: 40px auto;
                        background: #161616;
                        border: 1px solid #222222;
                        border-radius: 20px;
                        padding: 40px;
                        text-align: center;
                    }
                    .text-green { color: #22c55e; }
                    .text-indigo { color: #6366f1; }
                    .success-icon-anim { margin-bottom: 24px; display: flex; justify-content: center;}
                    @keyframes breathe { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.1); } }
                    .success-page-new h2 { font-size: 28px; font-weight: 700; color: white; margin-bottom: 8px; }
                    .success-id-new { color: #777; font-family: monospace; font-size: 14px; margin-bottom: 32px; background: #1a1a1a; display: inline-block; padding: 4px 12px; border-radius: 100px; }
                    .success-details-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; text-align: left; margin-bottom: 40px; }
                    .grid-item { background: #1a1a1a; padding: 16px; border-radius: 12px; border: 1px solid #222222; }
                    .grid-item span { display: block; font-size: 12px; color: #777; margin-bottom: 4px; text-transform: uppercase; letter-spacing: 0.5px; }
                    .grid-item strong { display: block; font-size: 16px; font-weight: 600; color: white; }
                    
                    .success-actions-new { 
                        display: flex; 
                        flex-direction: column; 
                        gap: 12px; 
                        width: 100%; 
                        max-width: 400px; 
                        margin: 0 auto; 
                    }
                    
                    @keyframes subtleShake {
                        0%, 100% { transform: scale(1.03) rotate(0deg); }
                        25% { transform: scale(1.03) rotate(-0.5deg); }
                        75% { transform: scale(1.03) rotate(0.5deg); }
                    }

                    .btn-main-new, .btn-sec-new, .btn-ghost-new { 
                        display: flex; 
                        width: 100%; 
                        align-items: center; 
                        justify-content: center;
                        border-radius: 10px; 
                        cursor: pointer; 
                        transition: all 0.2s ease; 
                        text-decoration: none;
                        font-family: inherit;
                        outline: none;
                    }

                    .btn-main-new { 
                        background: linear-gradient(135deg, #6366f1, #4f46e5); 
                        color: white; 
                        height: 52px; 
                        font-size: 15px; 
                        font-weight: 600; 
                        border: none; 
                    }
                    .btn-main-new:hover {
                        transform: scale(1.03);
                        box-shadow: 0 0 20px rgba(99,102,241,0.4);
                        animation: subtleShake 0.3s ease;
                    }
                    .btn-main-new:active {
                        transform: scale(0.97);
                    }

                    .btn-sec-new { 
                        background: transparent; 
                        color: #888; 
                        height: 52px; 
                        font-size: 15px; 
                        font-weight: 500; 
                        border: 1px solid #333; 
                    }
                    .btn-sec-new:hover { 
                        border-color: #555; 
                        color: white; 
                        transform: scale(1.02); 
                    }
                    .btn-sec-new:active {
                        transform: scale(0.97);
                    }

                    .btn-ghost-new { 
                        background: transparent; 
                        color: #555; 
                        border: none; 
                        font-size: 14px; 
                        gap: 6px; 
                        padding: 8px 0; 
                    }
                    .btn-ghost-new:hover { 
                        color: #888; 
                    }
                    .btn-ghost-new .back-arrow {
                        transition: transform 0.2s ease;
                    }
                    .btn-ghost-new:hover .back-arrow {
                        transform: translateX(-3px);
                    }
                `}</style>
            </div>
        );
    }

    return (
        <motion.div
            className="dashboard-container form-container-new"
            animate={phase === 'launch' ? { y: '-100vh', opacity: 0 } : { y: 0, opacity: 1 }}
            transition={phase === 'launch' ? { duration: 0.4, ease: 'easeIn' } : { duration: 0.3 }}
        >
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="page-header"
                style={{ marginBottom: 40 }}
            >
                <motion.div whileHover={{ x: -3 }} transition={{ duration: 0.15 }}>
                    <Link href="/dashboard" className="back-link">
                        <ArrowLeft size={16} /> Back to Dashboard
                    </Link>
                </motion.div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <h2>Create New Invoice</h2>
                        <p style={{ maxWidth: 500 }}>Fill in the details below to generate a new invoice and send payment instructions.</p>
                    </div>
                </div>
            </motion.div>

            <div className="form-layout-new">
                <motion.div
                    initial={{ opacity: 0, x: -30 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.1 }}
                    className="form-main-area"
                >
                    <form onSubmit={handleSubmit} className="invoice-form-new">
                        <AnimatePresence>
                            {error && (
                                <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: "auto" }}
                                    exit={{ opacity: 0, height: 0 }}
                                    className="alert-error-new"
                                >
                                    <div className="ae-content">
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" /></svg>
                                        {error}
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* CLIENT DETAILS */}
                        <motion.div
                            className="fieldset-new"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.1 }}
                        >
                            <h3 className="fieldset-title">Client Details</h3>
                            <div className="form-row-new">
                                <div className={`form-group-float ${form.client_name ? "has-value" : ""}`}>
                                    <input type="text" name="client_name" id="client_name" value={form.client_name} onChange={handleChange} className="float-input" required />
                                    <label htmlFor="client_name" className="float-label">Client Name *</label>
                                </div>
                            </div>

                            <div className="form-row-new">
                                <div className={`form-group-float ${form.client_email ? "has-value" : ""}`}>
                                    <input type="email" name="client_email" id="client_email" value={form.client_email} onChange={handleChange} className="float-input" required />
                                    <label htmlFor="client_email" className="float-label">Client Email *</label>
                                </div>
                                {/* FIX 2: Karma badge BELOW the email input, not overlapping */}
                                <div className="karma-container">
                                    <KarmaBadge karma={karma} loading={karmaLoading} />
                                </div>
                            </div>
                        </motion.div>

                        {/* INVOICE DETAILS */}
                        <motion.div
                            className="fieldset-new"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.2 }}
                        >
                            <h3 className="fieldset-title">Invoice Details</h3>
                            <div className="form-row-new-split">
                                <div className={`form-group-float ${form.amount ? "has-value" : ""}`}>
                                    <input type="number" name="amount" id="amount" value={form.amount} onChange={handleChange} className="float-input" min="1" step="0.01" required />
                                    <label htmlFor="amount" className="float-label">Amount (₹) *</label>
                                </div>
                                <div className={`form-group-float ${form.due_date ? "has-value" : ""}`}>
                                    <input type="date" name="due_date" id="due_date" value={form.due_date} onChange={handleChange} className="float-input" min={getTomorrow()} required />
                                    <label htmlFor="due_date" className="float-label">Due Date *</label>
                                </div>
                            </div>

                            <div className="form-row-new">
                                <div className={`form-group-float ${form.discount_percentage ? "has-value" : ""}`}>
                                    <input type="number" name="discount_percentage" id="discount_percentage" value={form.discount_percentage} onChange={handleChange} className="float-input" min="0" max="100" />
                                    <label htmlFor="discount_percentage" className="float-label">Discount (%)</label>
                                </div>
                            </div>
                        </motion.div>

                        {/* NOTES */}
                        <motion.div
                            className="fieldset-new"
                            style={{ borderBottom: 'none' }}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.3 }}
                        >
                            <div className={`form-group-float ${form.notes ? "has-value" : ""}`}>
                                <textarea name="notes" id="notes" value={form.notes} onChange={handleChange} className="float-textarea" rows="3" />
                                <label htmlFor="notes" className="float-label">Additional Notes (Optional)</label>
                            </div>
                        </motion.div>

                        {/* SUBMIT BUTTON */}
                        <motion.div
                            className="form-submit-area"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.4 }}
                        >
                            <motion.button
                                whileHover={{ scale: 1.03, boxShadow: '0 0 30px rgba(99,102,241,0.5)', filter: 'brightness(1.1)' }}
                                whileTap={{ scale: 0.97 }}
                                type="submit"
                                disabled={loading}
                                style={{
                                    width: '100%',
                                    height: '52px',
                                    background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '10px',
                                    fontSize: '16px',
                                    fontWeight: '600',
                                    cursor: loading ? 'not-allowed' : 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '10px',
                                    position: 'relative',
                                    overflow: 'hidden',
                                    transition: 'all 0.2s ease',
                                    opacity: loading ? 0.85 : 1,
                                }}
                            >
                                {loading && <div className="btn-shimmer"></div>}
                                {loading ? "Creating..." : "Create Invoice"}
                            </motion.button>
                        </motion.div>
                    </form>
                </motion.div>

                {/* Sticky Preview Sidebar */}
                <motion.div
                    initial={{ opacity: 0, x: 30 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.2 }}
                    className="form-sidebar-sticky"
                >
                    <div className={`preview-card-new ${isFormReady ? 'preview-ready' : ''}`}>
                        <div className="preview-header-new">
                            <h3 className="card-title">Live Preview</h3>
                            <div className="ai-badge-new"><Sparkles size={12} /> AI-Powered</div>
                        </div>

                        <div className="preview-content-new">
                            <div className="preview-item-new">
                                <span className="p-label">Client</span>
                                <span className={`p-value ${flashField === 'client_name' ? 'flash' : ''}`}>
                                    {form.client_name || "—"}
                                </span>
                            </div>
                            <div className="preview-item-new">
                                <span className="p-label">Email</span>
                                <span className={`p-value email-clamp ${flashField === 'client_email' ? 'flash' : ''}`} title={form.client_email}>
                                    {form.client_email || "—"}
                                </span>
                            </div>
                            <div className="preview-divider-new" />
                            <div className="preview-item-new align-items-center">
                                <span className="p-label">Amount</span>
                                <span className={`p-value amount-text ${flashField === 'amount' ? 'flash' : ''}`}>
                                    ₹{parseFloat(form.amount || 0).toLocaleString("en-IN")}
                                </span>
                            </div>
                            {parseFloat(form.discount_percentage) > 0 && (
                                <>
                                    <div className="preview-item-new">
                                        <span className="p-label">Discount</span>
                                        <span className="p-value discount-text">
                                            −{form.discount_percentage}%
                                        </span>
                                    </div>
                                    <div className="preview-item-new">
                                        <span className="p-label">Final Amount</span>
                                        <span className="p-value final-amount-text">
                                            ₹{calculatedAmount().toLocaleString("en-IN")}
                                        </span>
                                    </div>
                                </>
                            )}
                            <div className="preview-item-new" style={{ marginTop: 12 }}>
                                <span className="p-label">Due Date</span>
                                <span className={`p-value ${flashField === 'due_date' ? 'flash' : ''}`}>
                                    {form.due_date
                                        ? new Date(form.due_date).toLocaleDateString("en-IN", {
                                            day: "numeric", month: "short", year: "numeric",
                                        })
                                        : "—"}
                                </span>
                            </div>
                        </div>

                        {isFormReady && (
                            <motion.div
                                className="preview-ready-badge"
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.3 }}
                            >
                                ✅ Ready to send!
                            </motion.div>
                        )}
                    </div>
                </motion.div>
            </div>



            {/* Voice Invoice Mic Button */}
            <VoiceMicButton
                onFill={handleVoiceFill}
                currentValues={{
                    clientName: form.client_name,
                    clientEmail: form.client_email,
                    amount: form.amount,
                    dueDate: form.due_date,
                    discount: form.discount_percentage,
                    notes: form.notes,
                }}
            />

            <style jsx>{`
                .form-layout-new {
                    display: grid;
                    grid-template-columns: 3fr 2fr;
                    gap: 32px;
                    align-items: start;
                }

                @media (max-width: 1024px) {
                    .form-layout-new { grid-template-columns: 1fr; }
                    .form-sidebar-sticky { position: static !important; }
                }

                .form-main-area {
                    background: #161616;
                    border: 1px solid #222222;
                    border-radius: 20px;
                    padding: 32px;
                }

                .alert-error-new { overflow: hidden; margin-bottom: 24px; }
                .ae-content {
                    background: rgba(239, 68, 68, 0.1);
                    color: #ef4444;
                    padding: 16px;
                    border-radius: 12px;
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    font-size: 14px;
                    font-weight: 500;
                    border: 1px solid rgba(239, 68, 68, 0.2);
                }

                .fieldset-new {
                    border-bottom: 1px solid #222222;
                    padding-bottom: 24px;
                    margin-bottom: 24px;
                }
                .fieldset-title {
                    font-size: 13px;
                    font-weight: 600;
                    color: #777;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                    margin-bottom: 20px;
                }

                .form-row-new { margin-bottom: 20px; }
                .form-row-new-split { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px; }

                /* FIX 2: Karma container below input */
                .karma-container {
                    position: relative;
                    margin-top: 8px;
                }

                /* Floating Labels */
                .form-group-float {
                    position: relative;
                    width: 100%;
                }

                .float-input, .float-textarea {
                    width: 100%;
                    background: #1a1a1a;
                    border: 1px solid #2a2a2a;
                    border-radius: 12px;
                    color: white;
                    font-size: 15px;
                    padding: 24px 16px 8px 16px;
                    height: 52px;
                    outline: none;
                    transition: all 0.15s ease;
                    font-family: inherit;
                }
                
                .float-textarea {
                    height: 120px;
                    resize: vertical;
                }

                .float-input:focus, .float-textarea:focus {
                    border-color: #6366f1;
                    box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
                    background: #141414;
                }

                .float-label {
                    position: absolute;
                    left: 16px;
                    top: 16px;
                    color: #777;
                    font-size: 15px;
                    pointer-events: none;
                    transition: all 0.15s cubic-bezier(0.4, 0, 0.2, 1);
                }

                .float-input:focus ~ .float-label,
                .float-textarea:focus ~ .float-label,
                .form-group-float.has-value .float-label,
                .float-input[type="date"] ~ .float-label {
                    top: 6px;
                    font-size: 11px;
                    color: #6366f1;
                    font-weight: 600;
                }
                
                .form-group-float.has-value .float-label { color: #777; }
                .float-input:focus ~ .float-label { color: #6366f1; }

                /* FIX 1: Submit Button - Indigo Gradient */
                .form-submit-area { margin-top: 32px; }
                
                .btn-submit-huge {
                    width: 100%;
                    height: 52px;
                    background: linear-gradient(135deg, #6366f1, #4f46e5);
                    color: white;
                    border: none;
                    border-radius: 10px;
                    font-size: 16px;
                    font-weight: 600;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 10px;
                    position: relative;
                    overflow: hidden;
                    transition: all 0.2s ease;
                }

                .btn-submit-huge:disabled {
                    cursor: not-allowed;
                    opacity: 0.85;
                }
                
                .btn-shimmer {
                    position: absolute;
                    top: 0; left: 0; right: 0; bottom: 0;
                    background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent);
                    width: 200%;
                    animation: btn-shimmer 1.5s infinite linear;
                }
                
                @keyframes btn-shimmer {
                    0% { transform: translateX(-100%); }
                    100% { transform: translateX(50%); }
                }

                /* Sticky Preview */
                .form-sidebar-sticky {
                    position: sticky;
                    top: 24px;
                }

                .preview-card-new {
                    background: #161616;
                    border: 1px solid #222222;
                    border-radius: 20px;
                    padding: 32px;
                    transition: all 0.3s ease;
                }

                .preview-card-new.preview-ready {
                    border-color: #22c55e;
                    box-shadow: 0 0 20px rgba(34, 197, 94, 0.1);
                }

                .preview-header-new {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 24px;
                }

                .card-title { font-size: 16px; font-weight: 700; color: white; }
                
                .ai-badge-new {
                    background: rgba(99, 102, 241, 0.1);
                    color: #6366f1;
                    padding: 4px 10px;
                    border-radius: 100px;
                    font-size: 11px;
                    font-weight: 700;
                    border: 1px solid rgba(99, 102, 241, 0.2);
                    display: flex;
                    align-items: center;
                    gap: 4px;
                }

                .preview-content-new { display: flex; flex-direction: column; gap: 16px; }
                .preview-item-new { display: flex; justify-content: space-between; align-items: baseline; }
                .p-label { font-size: 13px; color: #777; }
                .p-value { font-size: 14px; font-weight: 500; color: white; text-align: right; transition: opacity 0.3s ease; }
                .email-clamp { max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
                
                .preview-divider-new { height: 1px; background: #222222; margin: 8px 0; }
                
                /* FIX 3: Amount = white, discount = red, final amount = green */
                .amount-text { font-size: 20px; font-weight: 700; color: #ffffff; }
                .discount-text { color: #ef4444; font-weight: 600; }
                .final-amount-text { font-size: 20px; font-weight: 700; color: #22c55e; }

                /* Flash animation for preview values */
                .flash { animation: valueFlash 0.3s ease; }
                @keyframes valueFlash {
                    0% { opacity: 0.3; }
                    100% { opacity: 1; }
                }

                .preview-ready-badge {
                    margin-top: 20px;
                    text-align: center;
                    font-size: 13px;
                    font-weight: 600;
                    color: #22c55e;
                    background: rgba(34, 197, 94, 0.08);
                    border: 1px solid rgba(34, 197, 94, 0.2);
                    border-radius: 8px;
                    padding: 8px 16px;
                }



                /* Back link hover */
                .back-link {
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                    color: #777;
                    font-size: 14px;
                    transition: all 0.15s;
                    margin-bottom: 16px;
                }
                .back-link:hover {
                    color: white;
                    transform: translateX(-3px);
                }
            `}</style>
        </motion.div>
    );
}

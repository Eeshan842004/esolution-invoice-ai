"use client";

import { useState, useRef, useCallback, useEffect } from "react";

export default function LinkedInModal({ invoice, onClose }) {
    const [step, setStep] = useState(1);
    const [image, setImage] = useState(null);
    const [imagePreview, setImagePreview] = useState(null);
    const [description, setDescription] = useState("");
    const [postText, setPostText] = useState("");
    const [copied, setCopied] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [isListening, setIsListening] = useState(false);
    const [transcript, setTranscript] = useState("");
    const [visible, setVisible] = useState(false);
    const [isDragOver, setIsDragOver] = useState(false);

    const fileInputRef = useRef(null);
    const recognitionRef = useRef(null);

    useEffect(() => {
        requestAnimationFrame(() => setVisible(true));
        return () => {
            if (recognitionRef.current) recognitionRef.current.stop();
        };
    }, []);

    const handleClose = () => {
        setVisible(false);
        setTimeout(onClose, 300);
    };

    // ── Image handling ──
    const handleImageSelect = (file) => {
        if (!file) return;
        if (!file.type.startsWith("image/")) { setError("Please select an image file"); return; }
        if (file.size > 5 * 1024 * 1024) { setError("Image must be under 5MB"); return; }
        setError("");
        setImage(file);
        const reader = new FileReader();
        reader.onload = (e) => setImagePreview(e.target.result);
        reader.readAsDataURL(file);
    };

    const handleDrop = useCallback((e) => {
        e.preventDefault();
        setIsDragOver(false);
        const file = e.dataTransfer?.files?.[0];
        if (file) handleImageSelect(file);
    }, []);

    // ── Voice ──
    const startListening = () => {
        const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SR) { setError("Voice not supported. Please type instead."); return; }
        setIsListening(true);
        setTranscript("");
        setError("");
        const recognition = new SR();
        recognition.lang = "en-IN";
        recognition.interimResults = true;
        recognition.continuous = true;
        let finalText = "";
        recognition.onresult = (event) => {
            let interim = "";
            finalText = "";
            for (let i = 0; i < event.results.length; i++) {
                const t = event.results[i][0].transcript;
                if (event.results[i].isFinal) finalText += t + " ";
                else interim = t;
            }
            setTranscript((finalText + interim).trim());
        };
        recognition.onerror = () => { setIsListening(false); };
        recognition.onend = () => { setIsListening(false); };
        recognitionRef.current = recognition;
        recognition.start();
        setTimeout(() => { if (recognitionRef.current) { recognitionRef.current.stop(); recognitionRef.current = null; } }, 20000);
    };

    const stopListening = () => {
        if (recognitionRef.current) { recognitionRef.current.stop(); recognitionRef.current = null; }
        setIsListening(false);
        if (transcript) setDescription(transcript);
    };

    // ── Generate post ──
    const generatePost = async () => {
        setLoading(true);
        setError("");
        try {
            const res = await fetch("/api/linkedin/generate-post", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    clientName: invoice.client_name,
                    amount: invoice.amount,
                    paidDate: invoice.paid_date || new Date().toISOString(),
                    invoiceNotes: invoice.notes,
                    voiceDescription: description || transcript,
                }),
            });
            const data = await res.json();
            if (!res.ok || !data.success) throw new Error(data.error || "Failed");
            setPostText(data.postText);
            setStep(3);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    // ── LinkedIn share (offsite URL) ──
    const openLinkedIn = () => {
        const url = `https://www.linkedin.com/sharing/share-offsite/?mini=true&text=${encodeURIComponent(postText)}`;
        window.open(url, "_blank");
    };

    const copyPost = () => {
        navigator.clipboard.writeText(postText);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <>
            <style>{`
                @keyframes linkedinSlideUp {
                    from { transform: translateY(40px) scale(0.96); opacity: 0; }
                    to { transform: translateY(0) scale(1); opacity: 1; }
                }
                @keyframes linkedinSlideDown {
                    from { transform: translateY(0) scale(1); opacity: 1; }
                    to { transform: translateY(40px) scale(0.96); opacity: 0; }
                }
                @keyframes linkedinBackdropIn {
                    from { opacity: 0; backdrop-filter: blur(0px); }
                    to { opacity: 1; backdrop-filter: blur(16px); }
                }
                @keyframes linkedinBackdropOut {
                    from { opacity: 1; }
                    to { opacity: 0; }
                }
                @keyframes dashBorder {
                    0% { background-position: 0 0, 100% 0, 100% 100%, 0 100%; }
                    100% { background-position: 100% 0, 100% 100%, 0 100%, 0 0; }
                }
                @keyframes micPulse {
                    0%, 100% { box-shadow: 0 0 0 0 rgba(139, 92, 246, 0.6); }
                    50% { box-shadow: 0 0 0 16px rgba(139, 92, 246, 0); }
                }
                @keyframes liveDot {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.3; }
                }
                .li-backdrop {
                    position: fixed; inset: 0; background: rgba(0,0,0,0.65);
                    display: flex; align-items: center; justify-content: center;
                    z-index: 9999;
                    animation: linkedinBackdropIn 0.3s ease forwards;
                    backdrop-filter: blur(16px);
                }
                .li-backdrop.closing {
                    animation: linkedinBackdropOut 0.3s ease forwards;
                }
                .li-modal {
                    width: 92%; max-width: 540px; max-height: 90vh; overflow-y: auto;
                    background: rgba(15, 23, 42, 0.92);
                    backdrop-filter: blur(24px);
                    border-radius: 20px;
                    border: 1px solid rgba(139, 92, 246, 0.3);
                    box-shadow: 0 0 60px rgba(99, 102, 241, 0.15), 0 0 0 1px rgba(139, 92, 246, 0.1);
                    animation: linkedinSlideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
                    position: relative;
                }
                .li-modal.closing {
                    animation: linkedinSlideDown 0.3s ease forwards;
                }
                .li-modal::before {
                    content: ''; position: absolute; inset: -1px; border-radius: 20px; padding: 1px;
                    background: linear-gradient(135deg, #8b5cf6, #3b82f6, #8b5cf6);
                    -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
                    -webkit-mask-composite: xor; mask-composite: exclude;
                    pointer-events: none; opacity: 0.5;
                }
                .li-header {
                    display: flex; justify-content: space-between; align-items: center;
                    padding: 22px 26px 14px; border-bottom: 1px solid rgba(255,255,255,0.06);
                }
                .li-header-left { display: flex; align-items: center; gap: 14px; }
                .li-header-icon {
                    width: 44px; height: 44px; border-radius: 12px;
                    background: linear-gradient(135deg, #8b5cf6, #6366f1);
                    display: flex; align-items: center; justify-content: center;
                    font-size: 20px; box-shadow: 0 4px 16px rgba(139, 92, 246, 0.3);
                }
                .li-title { color: #f1f5f9; font-size: 17px; font-weight: 700; margin: 0; }
                .li-subtitle { color: #64748b; font-size: 12px; margin: 0; }
                .li-close {
                    background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.08);
                    color: #94a3b8; width: 34px; height: 34px; border-radius: 10px;
                    display: flex; align-items: center; justify-content: center;
                    font-size: 16px; cursor: pointer; transition: all 0.2s;
                }
                .li-close:hover { background: rgba(239, 68, 68, 0.15); color: #f87171; border-color: rgba(239,68,68,0.3); }
                .li-steps {
                    display: flex; justify-content: center; gap: 10px; padding: 16px 0;
                }
                .li-step {
                    width: 30px; height: 30px; border-radius: 50%;
                    display: flex; align-items: center; justify-content: center;
                    font-size: 12px; font-weight: 700; transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
                }
                .li-step.active {
                    background: linear-gradient(135deg, #8b5cf6, #6366f1);
                    color: white; box-shadow: 0 0 16px rgba(139, 92, 246, 0.4);
                }
                .li-step.done {
                    background: linear-gradient(135deg, #10b981, #059669);
                    color: white; box-shadow: 0 0 12px rgba(16, 185, 129, 0.3);
                }
                .li-step.pending { background: rgba(255,255,255,0.06); color: #475569; }
                .li-error {
                    margin: 0 22px; padding: 10px 14px; border-radius: 10px;
                    font-size: 13px; text-align: center;
                    background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.25);
                    color: #fca5a5;
                }
                .li-error.success { background: rgba(16, 185, 129, 0.1); border-color: rgba(16,185,129,0.25); color: #6ee7b7; }
                .li-body { padding: 18px 26px 26px; display: flex; flex-direction: column; gap: 16px; }
                .li-label { color: #94a3b8; font-size: 14px; font-weight: 500; margin: 0; }

                /* Drop zone */
                .li-dropzone {
                    border: 2px dashed rgba(139, 92, 246, 0.3);
                    border-radius: 14px; padding: 32px 20px; text-align: center;
                    cursor: pointer; transition: all 0.3s; min-height: 180px;
                    display: flex; align-items: center; justify-content: center;
                    background: rgba(139, 92, 246, 0.03);
                    position: relative;
                }
                .li-dropzone:hover, .li-dropzone.dragover {
                    border-color: rgba(139, 92, 246, 0.6);
                    background: rgba(139, 92, 246, 0.06);
                    box-shadow: 0 0 30px rgba(139, 92, 246, 0.1);
                }
                .li-dropzone.has-image {
                    border-color: rgba(16, 185, 129, 0.4);
                    background: rgba(16, 185, 129, 0.03);
                }
                .li-drop-content { display: flex; flex-direction: column; align-items: center; gap: 8px; }
                .li-drop-icon { font-size: 44px; filter: drop-shadow(0 4px 12px rgba(139,92,246,0.3)); }
                .li-drop-text { color: #cbd5e1; font-size: 14px; font-weight: 500; }
                .li-drop-sub { color: #475569; font-size: 12px; }
                .li-preview-img { max-width: 100%; max-height: 200px; border-radius: 10px; object-fit: contain; }

                /* Buttons */
                .li-btn-row { display: flex; gap: 10px; justify-content: flex-end; margin-top: 4px; }
                .li-btn-primary {
                    background: linear-gradient(135deg, #8b5cf6, #6366f1);
                    color: white; border: none; border-radius: 10px;
                    padding: 11px 24px; font-size: 14px; font-weight: 700;
                    cursor: pointer; transition: all 0.3s; font-family: inherit;
                    box-shadow: 0 4px 16px rgba(139, 92, 246, 0.3);
                }
                .li-btn-primary:hover:not(:disabled) {
                    transform: scale(1.04); box-shadow: 0 6px 24px rgba(139, 92, 246, 0.45);
                }
                .li-btn-primary:active { transform: scale(0.97); }
                .li-btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
                .li-btn-ghost {
                    background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);
                    color: #94a3b8; border-radius: 10px; padding: 11px 20px;
                    font-size: 13px; cursor: pointer; transition: all 0.2s; font-family: inherit;
                }
                .li-btn-ghost:hover { background: rgba(255,255,255,0.08); color: #e2e8f0; }
                .li-btn-linkedin {
                    background: linear-gradient(135deg, #6366f1, #3b82f6);
                    color: white; border: none; border-radius: 10px;
                    padding: 12px 26px; font-size: 14px; font-weight: 700;
                    cursor: pointer; transition: all 0.3s; font-family: inherit;
                    box-shadow: 0 4px 20px rgba(59, 130, 246, 0.35);
                }
                .li-btn-linkedin:hover {
                    transform: scale(1.05); box-shadow: 0 8px 30px rgba(59, 130, 246, 0.5);
                }
                .li-btn-linkedin:active { transform: scale(0.97); }
                .li-btn-copy {
                    background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1);
                    color: #e2e8f0; border-radius: 10px; padding: 11px 18px;
                    font-size: 13px; font-weight: 600; cursor: pointer;
                    transition: all 0.2s; font-family: inherit;
                }
                .li-btn-copy:hover { background: rgba(255,255,255,0.1); }

                /* Mic */
                .li-mic-row { display: flex; align-items: center; gap: 14px; }
                .li-mic-btn {
                    width: 56px; height: 56px; border-radius: 50%; border: none;
                    background: linear-gradient(135deg, #8b5cf6, #7c3aed);
                    color: white; font-size: 22px; cursor: pointer;
                    transition: all 0.3s; display: flex; align-items: center; justify-content: center;
                    box-shadow: 0 4px 20px rgba(139, 92, 246, 0.4);
                }
                .li-mic-btn:hover { transform: scale(1.08); box-shadow: 0 6px 28px rgba(139, 92, 246, 0.55); }
                .li-mic-btn.active {
                    background: linear-gradient(135deg, #ef4444, #dc2626);
                    animation: micPulse 1.5s infinite;
                    box-shadow: 0 4px 20px rgba(239, 68, 68, 0.4);
                }
                .li-live {
                    display: flex; align-items: center; gap: 8px;
                    color: #ef4444; font-size: 13px; font-weight: 600;
                }
                .li-live-dot {
                    width: 8px; height: 8px; border-radius: 50%;
                    background: #ef4444; animation: liveDot 1s infinite;
                }
                .li-transcript {
                    background: rgba(139, 92, 246, 0.06); border: 1px solid rgba(139, 92, 246, 0.15);
                    border-radius: 10px; padding: 12px 16px;
                }
                .li-transcript-label { color: #64748b; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; }
                .li-transcript-text { color: #e2e8f0; font-size: 14px; margin: 4px 0 0; line-height: 1.5; }

                /* Textarea */
                .li-textarea {
                    background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08);
                    border-radius: 10px; color: #e2e8f0; padding: 14px 16px;
                    font-size: 14px; resize: vertical; outline: none; font-family: inherit;
                    line-height: 1.6; transition: all 0.3s;
                }
                .li-textarea:focus {
                    border-color: rgba(139, 92, 246, 0.4);
                    box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.1), 0 0 20px rgba(139, 92, 246, 0.08);
                }
                .li-post-textarea {
                    background: rgba(139, 92, 246, 0.04);
                    border: 1px solid rgba(139, 92, 246, 0.2);
                    border-radius: 12px; color: #f1f5f9; padding: 16px 18px;
                    font-size: 14px; resize: vertical; outline: none;
                    font-family: inherit; line-height: 1.7; transition: all 0.3s;
                }
                .li-post-textarea:focus {
                    border-color: rgba(139, 92, 246, 0.5);
                    box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.12), 0 0 24px rgba(139, 92, 246, 0.1);
                }

                /* Small preview */
                .li-small-preview {
                    display: flex; align-items: center; gap: 12px;
                    background: rgba(16, 185, 129, 0.06); border: 1px solid rgba(16, 185, 129, 0.15);
                    border-radius: 10px; padding: 10px 14px;
                }
                .li-small-img { width: 40px; height: 40px; border-radius: 8px; object-fit: cover; }
                .li-small-label { color: #10b981; font-size: 13px; font-weight: 600; }

                /* Cert link */
                .li-cert-link {
                    display: block; text-align: center; color: #f59e0b; font-size: 13px;
                    font-weight: 600; text-decoration: none; padding: 10px 14px;
                    background: rgba(245, 158, 11, 0.06); border: 1px solid rgba(245, 158, 11, 0.15);
                    border-radius: 10px; transition: all 0.2s;
                }
                .li-cert-link:hover { background: rgba(245, 158, 11, 0.1); }

                .li-image-reminder {
                    display: flex; align-items: center; gap: 12px;
                    background: rgba(59, 130, 246, 0.06); border: 1px solid rgba(59, 130, 246, 0.15);
                    border-radius: 10px; padding: 10px 14px;
                }
                .li-reminder-img { width: 36px; height: 36px; border-radius: 8px; object-fit: cover; }
                .li-reminder-text { color: #94a3b8; font-size: 12px; }
            `}</style>

            <div className={`li-backdrop ${!visible ? 'closing' : ''}`} onClick={handleClose}>
                <div className={`li-modal ${!visible ? 'closing' : ''}`} onClick={(e) => e.stopPropagation()}>

                    {/* Header */}
                    <div className="li-header">
                        <div className="li-header-left">
                            <div className="li-header-icon">🚀</div>
                            <div>
                                <h2 className="li-title">
                                    {step === 1 ? "Upload Project Image" : step === 2 ? "Describe Your Project" : "Your LinkedIn Post"}
                                </h2>
                                <p className="li-subtitle">Share your achievement on LinkedIn</p>
                            </div>
                        </div>
                        <button className="li-close" onClick={handleClose}>✕</button>
                    </div>

                    {/* Steps */}
                    <div className="li-steps">
                        {[1, 2, 3].map((s) => (
                            <div key={s} className={`li-step ${step === s ? 'active' : step > s ? 'done' : 'pending'}`}>
                                {step > s ? "✓" : s}
                            </div>
                        ))}
                    </div>

                    {/* Error */}
                    {error && <div className={`li-error ${error.startsWith("✅") ? 'success' : ''}`}>{error}</div>}

                    {/* ── STEP 1 ── */}
                    {step === 1 && (
                        <div className="li-body">
                            <p className="li-label">Drop your project screenshot here 📸</p>
                            <div
                                className={`li-dropzone ${isDragOver ? 'dragover' : ''} ${imagePreview ? 'has-image' : ''}`}
                                onDrop={handleDrop}
                                onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                                onDragLeave={() => setIsDragOver(false)}
                                onClick={() => fileInputRef.current?.click()}
                            >
                                {imagePreview ? (
                                    <img src={imagePreview} alt="Preview" className="li-preview-img" />
                                ) : (
                                    <div className="li-drop-content">
                                        <span className="li-drop-icon">📸</span>
                                        <span className="li-drop-text">Drag & drop or click to browse</span>
                                        <span className="li-drop-sub">JPG, PNG • Max 5MB</span>
                                    </div>
                                )}
                                <input ref={fileInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => handleImageSelect(e.target.files?.[0])} />
                            </div>
                            <div className="li-btn-row">
                                <button className="li-btn-ghost" onClick={() => setStep(2)}>Skip →</button>
                                <button className="li-btn-primary" disabled={!imagePreview} onClick={() => setStep(2)}>Next →</button>
                            </div>
                        </div>
                    )}

                    {/* ── STEP 2 ── */}
                    {step === 2 && (
                        <div className="li-body">
                            {imagePreview && (
                                <div className="li-small-preview">
                                    <img src={imagePreview} alt="Selected" className="li-small-img" />
                                    <span className="li-small-label">Image ready ✓</span>
                                </div>
                            )}
                            <p className="li-label">Tell us about this project 🎤</p>
                            <div className="li-mic-row">
                                <button className={`li-mic-btn ${isListening ? 'active' : ''}`} onClick={isListening ? stopListening : startListening}>
                                    {isListening ? "⏹" : "🎤"}
                                </button>
                                {isListening && (
                                    <div className="li-live">
                                        <div className="li-live-dot" />
                                        <span>Listening...</span>
                                    </div>
                                )}
                                {!isListening && <span style={{ color: "#64748b", fontSize: 13 }}>Click to speak or type below</span>}
                            </div>
                            {transcript && !description && (
                                <div className="li-transcript">
                                    <span className="li-transcript-label">Live transcript</span>
                                    <p className="li-transcript-text">{transcript}</p>
                                </div>
                            )}
                            <textarea
                                className="li-textarea"
                                placeholder="Or type your project description here..."
                                value={description || transcript}
                                onChange={(e) => setDescription(e.target.value)}
                                rows={4}
                            />
                            <div className="li-btn-row">
                                <button className="li-btn-ghost" onClick={() => setStep(1)}>← Back</button>
                                <button className="li-btn-primary" onClick={generatePost} disabled={loading}>
                                    {loading ? "✨ Generating..." : "✨ Generate Post"}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* ── STEP 3 ── */}
                    {step === 3 && (
                        <div className="li-body">
                            <p className="li-label">Edit & share your post ✨</p>
                            <textarea
                                className="li-post-textarea"
                                value={postText}
                                onChange={(e) => setPostText(e.target.value)}
                                rows={10}
                            />
                            <p style={{ fontSize: 12, color: "#666", marginTop: 8, marginBottom: 8, textAlign: "center" }}>
                                📋 Copy the post → Open LinkedIn → Paste and Post!
                            </p>
                            {imagePreview && (
                                <div className="li-image-reminder">
                                    <img src={imagePreview} alt="Attach" className="li-reminder-img" />
                                    <span className="li-reminder-text">📎 Attach this image when posting on LinkedIn</span>
                                </div>
                            )}
                            <a href={`/api/certificate/generate?id=${invoice.invoice_id}&format=png`} target="_blank" className="li-cert-link">
                                🏆 Download Certificate
                            </a>
                            <div className="li-btn-row">
                                <button className="li-btn-ghost" onClick={() => setStep(2)}>← Edit</button>
                                <button
                                    className="li-btn-copy"
                                    onClick={copyPost}
                                    style={copied ? { background: "rgba(16, 185, 129, 0.2)", color: "#10b981", borderColor: "rgba(16, 185, 129, 0.5)" } : {}}
                                >
                                    {copied ? "Copied! ✓" : "📋 Copy"}
                                </button>
                                <button className="li-btn-linkedin" onClick={openLinkedIn}>🔗 Open LinkedIn →</button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}

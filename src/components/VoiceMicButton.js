"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import VoiceWaveVisualizer from "./VoiceWaveVisualizer";

/**
 * Floating Voice Mic Button for creating invoices by voice.
 * Uses Web Speech API for speech-to-text, then Gemini AI to extract fields.
 *
 * Props:
 *   onFill(fields) — called when AI extracts fields. fields = { clientName, clientEmail, amount, dueDate, notes, confidence }
 */
export default function VoiceMicButton({ onFill, currentValues }) {
    // States: idle | listening | processing | success | error | unsupported
    const [state, setState] = useState("idle");
    const [transcript, setTranscript] = useState("");
    const [errorMsg, setErrorMsg] = useState("");
    const [fields, setFields] = useState(null);
    const [isEditMode, setIsEditMode] = useState(false);
    const recognitionRef = useRef(null);
    const timeoutRef = useRef(null);

    // Check browser support on mount
    useEffect(() => {
        const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SR) {
            setState("unsupported");
        }
        return () => {
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
        };
    }, []);

    // Start re-edit listening (called by Re-listen button)
    const startReEdit = useCallback(() => {
        setIsEditMode(true);
        setTranscript("");
        setErrorMsg("");
        // Don't clear fields — keep them for display
        startListening();
    }, []);

    const startListening = useCallback(() => {
        const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SR) { setState("unsupported"); return; }

        setTranscript("");
        setErrorMsg("");
        if (!isEditMode) setFields(null);
        setState("listening");

        const recognition = new SR();
        recognition.lang = "en-IN"; // English (India) - captures English speech correctly
        recognition.interimResults = true;
        recognition.continuous = true;
        recognition.maxAlternatives = 1;

        recognition.onresult = (event) => {
            let interim = "";
            let final = "";
            for (let i = 0; i < event.results.length; i++) {
                const t = event.results[i][0].transcript;
                if (event.results[i].isFinal) {
                    final += t + " ";
                } else {
                    interim = t;
                }
            }
            setTranscript((final + interim).trim());
        };

        recognition.onerror = (event) => {
            console.error("Speech error:", event.error);
            if (event.error === "not-allowed") {
                setErrorMsg("Please allow microphone access in your browser settings.");
            } else if (event.error === "no-speech") {
                setErrorMsg("No speech detected. Please try again.");
            } else {
                setErrorMsg(`Speech error: ${event.error}`);
            }
            setState("error");
        };

        recognition.onend = () => {
            // Only process if we were listening (not manually stopped to error)
            if (recognitionRef.current) {
                recognitionRef.current = null;
            }
        };

        recognitionRef.current = recognition;
        recognition.start();

        // Auto-stop after 15 seconds
        timeoutRef.current = setTimeout(() => {
            stopAndProcess();
        }, 15000);
    }, []);

    const stopAndProcess = useCallback(async () => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);

        if (recognitionRef.current) {
            recognitionRef.current.stop();
            recognitionRef.current = null;
        }

        // Use the latest transcript from the ref
        setTranscript((currentTranscript) => {
            if (!currentTranscript || currentTranscript.trim().length === 0) {
                setErrorMsg("Didn't catch that. Please try again.");
                setState("error");
                return currentTranscript;
            }

            console.log("🎤 Transcript captured:", currentTranscript);
            setState("processing");
            processTranscript(currentTranscript);
            return currentTranscript;
        });
    }, []);

    async function processTranscript(text) {
        try {
            const body = { transcript: text };

            // If re-editing, send current form values so AI updates only changed fields
            if (isEditMode && currentValues) {
                body.mode = "edit";
                body.currentValues = currentValues;
                console.log("📡 Calling API (EDIT mode):", body);
            } else {
                console.log("📡 Calling API (NEW mode):", text);
            }

            const res = await fetch("/api/voice/process", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });

            const data = await res.json();
            console.log("📡 API response:", data);

            if (!res.ok) {
                throw new Error(data.error || "Processing failed");
            }

            setFields(data.fields);
            setState("success");

            // Call parent callback to fill form
            if (onFill && data.fields) {
                console.log(isEditMode ? "✏️ Updating form with:" : "✅ Filling form with:", data.fields);
                onFill(data.fields);
            }

            // Reset edit mode after successful processing
            setIsEditMode(false);
        } catch (err) {
            console.error("❌ Voice processing error:", err.message);
            setErrorMsg(err.message || "AI processing failed. Please fill manually.");
            setState("error");
            setIsEditMode(false);
        }
    }

    const handleClick = () => {
        if (state === "listening") {
            stopAndProcess();
        } else if (state === "idle" || state === "error" || state === "success") {
            startListening();
        }
    };

    const reset = () => {
        setState("idle");
        setTranscript("");
        setErrorMsg("");
        setFields(null);
        setIsEditMode(false);
    };

    // Don't render if unsupported
    if (state === "unsupported") {
        return (
            <div style={styles.floatingContainer}>
                <div style={styles.unsupportedBadge}>
                    🎤 Voice works best on Chrome
                </div>
            </div>
        );
    }

    return (
        <div style={styles.floatingContainer}>
            {/* Transcript/Status Overlay */}
            {(state === "listening" || state === "processing" || state === "success" || state === "error") && (
                <div style={styles.overlay}>
                    {/* Close button */}
                    <button style={styles.closeBtn} onClick={reset}>✕</button>

                    {state === "listening" && (
                        <div style={styles.overlayContent}>
                            <VoiceWaveVisualizer active={true} />
                            <p style={styles.statusText}>Listening... speak your invoice details</p>
                            {transcript && (
                                <div style={styles.transcriptBox}>
                                    <p style={styles.transcriptLabel}>Live transcript:</p>
                                    <p style={styles.transcriptText}>{transcript}</p>
                                </div>
                            )}
                            <button style={styles.stopBtn} onClick={stopAndProcess}>
                                Done Speaking →
                            </button>
                        </div>
                    )}

                    {state === "processing" && (
                        <div style={styles.overlayContent}>
                            <div style={styles.processingSpinner}>
                                <div style={styles.spinnerRing}></div>
                            </div>
                            <p style={styles.statusText}>Understanding your voice... 🎤</p>
                            <p style={styles.transcriptSmall}>"{transcript}"</p>
                        </div>
                    )}

                    {state === "success" && fields && (
                        <div style={styles.overlayContent}>
                            <div style={styles.successIcon}>✅</div>
                            <p style={styles.statusText}>
                                {fields._edited ? "Updated! ✅" : "Invoice ready! ✅"}
                            </p>
                            <div style={styles.fieldsList}>
                                {fields.clientName && (
                                    <FieldTag label="Client" value={fields.clientName} />
                                )}
                                {fields.clientEmail && (
                                    <FieldTag label="Email" value={fields.clientEmail} />
                                )}
                                {fields.amount != null && (
                                    <FieldTag label="Amount" value={`₹${Number(fields.amount).toLocaleString("en-IN")}`} />
                                )}
                                {fields.dueDate && (
                                    <FieldTag label="Due" value={fields.dueDate} />
                                )}
                                {fields.discount != null && Number(fields.discount) > 0 && (
                                    <FieldTag label="Discount" value={`${fields.discount}%`} />
                                )}
                                {fields.notes && (
                                    <FieldTag label="Notes" value={fields.notes} />
                                )}
                            </div>
                            <button style={styles.retryBtn} onClick={startReEdit}>
                                🎤 Re-listen to change
                            </button>
                        </div>
                    )}

                    {state === "error" && (
                        <div style={styles.overlayContent}>
                            <div style={{ fontSize: 32, marginBottom: 8 }}>😕</div>
                            <p style={styles.errorText}>{errorMsg || "Something went wrong"}</p>
                            <button style={styles.retryBtn} onClick={startListening}>
                                🎤 Try Again
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* Main Mic Button */}
            <button
                style={{
                    ...styles.micBtn,
                    ...(state === "listening" ? styles.micBtnRecording : {}),
                }}
                onClick={handleClick}
                title="Create invoice with your voice 🎤"
            >
                {state === "listening" ? (
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="6" y="6" width="12" height="12" rx="2" />
                    </svg>
                ) : (
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                        <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                        <line x1="12" y1="19" x2="12" y2="23" />
                        <line x1="8" y1="23" x2="16" y2="23" />
                    </svg>
                )}

                {/* Pulse rings */}
                {state === "idle" && <div style={styles.pulse1}></div>}
                {state === "idle" && <div style={styles.pulse2}></div>}
                {state === "listening" && <div style={styles.recordPulse}></div>}

                <style jsx>{`
                    @keyframes micPulse1 {
                        0% { transform: scale(1); opacity: 0.4; }
                        100% { transform: scale(1.8); opacity: 0; }
                    }
                    @keyframes micPulse2 {
                        0% { transform: scale(1); opacity: 0.3; }
                        100% { transform: scale(2.2); opacity: 0; }
                    }
                    @keyframes recordPulse {
                        0% { transform: scale(1); opacity: 0.6; }
                        50% { transform: scale(1.5); opacity: 0.2; }
                        100% { transform: scale(1); opacity: 0.6; }
                    }
                    @keyframes spinGradient {
                        0% { transform: rotate(0deg); }
                        100% { transform: rotate(360deg); }
                    }
                `}</style>
            </button>
        </div>
    );
}

/** Small tag showing confidence level for a field */
function FieldTag({ label, value, confidence }) {
    const colors = {
        high: { bg: "#dcfce7", text: "#166534", border: "#86efac" },
        medium: { bg: "#fef9c3", text: "#854d0e", border: "#fde047" },
        low: { bg: "#fee2e2", text: "#991b1b", border: "#fca5a5" },
    };
    const c = colors[confidence] || colors.medium;

    return (
        <div style={{
            display: "flex", alignItems: "center", gap: 8,
            background: c.bg, border: `1px solid ${c.border}`,
            borderRadius: 8, padding: "6px 12px", fontSize: 13,
        }}>
            <span style={{ color: "#64748b", fontWeight: 500 }}>{label}:</span>
            <span style={{ color: c.text, fontWeight: 700 }}>{value}</span>
        </div>
    );
}

const styles = {
    floatingContainer: {
        position: "fixed",
        bottom: 40,
        right: 40,
        zIndex: 1000,
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-end",
        gap: 16,
    },

    micBtn: {
        width: 64,
        height: 64,
        borderRadius: "50%",
        background: "linear-gradient(135deg, #2563eb, #3b82f6)",
        border: "none",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        boxShadow: "0 8px 32px rgba(59, 130, 246, 0.4)",
        position: "relative",
        transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
    },
    micBtnRecording: {
        background: "linear-gradient(135deg, #ef4444, #f87171)",
        boxShadow: "0 8px 32px rgba(239, 68, 68, 0.5)",
        transform: "scale(1.05)",
    },

    pulse1: {
        position: "absolute", inset: 0, borderRadius: "50%",
        border: "2px solid #3b82f6",
        animation: "micPulse1 2s ease-out infinite",
        pointerEvents: "none",
    },
    pulse2: {
        position: "absolute", inset: 0, borderRadius: "50%",
        border: "2px solid #60a5fa",
        animation: "micPulse2 2s ease-out infinite 0.5s",
        pointerEvents: "none",
    },
    recordPulse: {
        position: "absolute", inset: -8, borderRadius: "50%",
        background: "rgba(239, 68, 68, 0.25)",
        animation: "recordPulse 1.5s ease-in-out infinite",
        pointerEvents: "none",
    },

    overlay: {
        background: "rgba(20, 20, 20, 0.95)",
        backdropFilter: "blur(16px)",
        borderRadius: 20,
        padding: "24px",
        width: 340,
        boxShadow: "0 16px 48px rgba(0,0,0,0.4)",
        border: "1px solid #333333",
        position: "relative",
    },
    closeBtn: {
        position: "absolute", top: 12, right: 16,
        background: "none", border: "none", color: "#666666",
        fontSize: 20, cursor: "pointer", transition: "color 0.2s",
    },
    overlayContent: {
        display: "flex", flexDirection: "column", alignItems: "center", gap: 16,
    },

    statusText: {
        color: "white", fontSize: 16, fontWeight: 600, textAlign: "center", margin: 0,
    },
    transcriptBox: {
        width: "100%", background: "#1a1a1a", border: "1px solid #222222",
        borderRadius: 12, padding: "12px 16px",
    },
    transcriptLabel: {
        color: "#666666", fontSize: 11, textTransform: "uppercase", letterSpacing: 1, margin: "0 0 6px", fontWeight: 600,
    },
    transcriptText: {
        color: "#f1f5f9", fontSize: 14, margin: 0, lineHeight: 1.5,
    },
    transcriptSmall: {
        color: "#888888", fontSize: 13, fontStyle: "italic", margin: 0, textAlign: "center",
    },

    stopBtn: {
        background: "#1a1a1a", border: "1px solid #333333",
        color: "white", borderRadius: 10,
        padding: "12px 24px", fontSize: 14, fontWeight: 600,
        cursor: "pointer", width: "100%", transition: "all 0.2s",
    },
    retryBtn: {
        background: "transparent",
        color: "#a5b4fc", border: "1px solid rgba(99,102,241,0.3)",
        borderRadius: 10, padding: "10px 20px", fontSize: 14,
        fontWeight: 600, cursor: "pointer", marginTop: 8, width: "100%", transition: "all 0.2s",
    },

    errorText: {
        color: "#fca5a5", fontSize: 14, textAlign: "center", margin: 0,
    },
    successIcon: { fontSize: 40 },

    fieldsList: {
        display: "flex", flexDirection: "column", gap: 8, width: "100%",
    },

    processingSpinner: {
        width: 56, height: 56, position: "relative",
    },
    spinnerRing: {
        width: 56, height: 56, borderRadius: "50%",
        border: "4px solid #222222",
        borderTop: "4px solid #3b82f6",
        animation: "spinGradient 0.8s linear infinite",
    },

    unsupportedBadge: {
        background: "#141414", border: "1px solid #333333",
        color: "#fbbf24", padding: "12px 20px",
        borderRadius: 12, fontSize: 14, fontWeight: 600,
        boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
    },
};

"use client";

import { useState } from "react";

/**
 * CertificatePreview — Shows a certificate preview card with download buttons.
 * Used on the invoice detail page or as part of the LinkedIn flow.
 *
 * Props:
 *   invoiceId — the invoice ID to generate certificate for
 *   certId — optional existing certificate ID
 */
export default function CertificatePreview({ invoiceId, certId }) {
    const [loading, setLoading] = useState(false);
    const [previewUrl, setPreviewUrl] = useState(null);
    const [error, setError] = useState("");

    const generatePreview = async () => {
        setLoading(true);
        setError("");
        try {
            // Load PNG preview
            const url = `/api/certificate/generate?id=${invoiceId}&format=png`;
            const res = await fetch(url);
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || "Failed to generate certificate");
            }
            const blob = await res.blob();
            setPreviewUrl(URL.createObjectURL(blob));
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const downloadPDF = () => {
        const url = `/api/certificate/generate?id=${invoiceId}&format=pdf`;
        window.open(url, "_blank");
    };

    const downloadPNG = () => {
        const url = `/api/certificate/generate?id=${invoiceId}&format=png`;
        const a = document.createElement("a");
        a.href = url;
        a.download = `certificate-${invoiceId}.png`;
        a.click();
    };

    return (
        <div style={styles.container}>
            <div style={styles.header}>
                <span style={styles.icon}>🏆</span>
                <div>
                    <h3 style={styles.title}>Work Certificate</h3>
                    {certId && <span style={styles.certId}>{certId}</span>}
                </div>
            </div>

            {previewUrl ? (
                <div style={styles.previewWrap}>
                    <img src={previewUrl} alt="Certificate" style={styles.previewImg} />
                </div>
            ) : (
                <div style={styles.placeholder}>
                    <span style={{ fontSize: 48, marginBottom: 8 }}>📜</span>
                    <p style={styles.placeholderText}>
                        Generate your project completion certificate
                    </p>
                </div>
            )}

            {error && <p style={styles.error}>{error}</p>}

            <div style={styles.actions}>
                {!previewUrl ? (
                    <button
                        style={{ ...styles.btn, ...styles.btnPrimary }}
                        onClick={generatePreview}
                        disabled={loading}
                    >
                        {loading ? "Generating..." : "🏆 Generate Certificate"}
                    </button>
                ) : (
                    <>
                        <button style={{ ...styles.btn, ...styles.btnOutline }} onClick={downloadPNG}>
                            📥 PNG
                        </button>
                        <button style={{ ...styles.btn, ...styles.btnOutline }} onClick={downloadPDF}>
                            📄 PDF
                        </button>
                        <button
                            style={{ ...styles.btn, ...styles.btnPrimary }}
                            onClick={generatePreview}
                            disabled={loading}
                        >
                            {loading ? "..." : "🔄"}
                        </button>
                    </>
                )}
            </div>
        </div>
    );
}

const styles = {
    container: {
        background: "linear-gradient(145deg, #1e293b, #0f172a)",
        borderRadius: 12,
        border: "1px solid rgba(245, 158, 11, 0.15)",
        padding: 20,
        marginTop: 16,
    },
    header: {
        display: "flex",
        alignItems: "center",
        gap: 10,
        marginBottom: 16,
    },
    icon: { fontSize: 24 },
    title: {
        color: "#f1f5f9",
        fontSize: 16,
        fontWeight: 700,
        margin: 0,
    },
    certId: {
        color: "#f59e0b",
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: 1,
    },

    previewWrap: {
        borderRadius: 8,
        overflow: "hidden",
        marginBottom: 12,
        border: "1px solid rgba(255,255,255,0.06)",
    },
    previewImg: {
        width: "100%",
        display: "block",
    },

    placeholder: {
        background: "rgba(255,255,255,0.03)",
        borderRadius: 8,
        padding: "30px 20px",
        textAlign: "center",
        marginBottom: 12,
    },
    placeholderText: {
        color: "#64748b",
        fontSize: 14,
        margin: 0,
    },

    error: {
        color: "#fca5a5",
        fontSize: 13,
        textAlign: "center",
        marginBottom: 8,
    },

    actions: {
        display: "flex",
        gap: 8,
    },
    btn: {
        flex: 1,
        padding: "10px 16px",
        borderRadius: 8,
        fontSize: 13,
        fontWeight: 700,
        cursor: "pointer",
        border: "none",
        textAlign: "center",
    },
    btnPrimary: {
        background: "linear-gradient(135deg, #f59e0b, #d97706)",
        color: "#0f172a",
    },
    btnOutline: {
        background: "rgba(255,255,255,0.06)",
        color: "#e2e8f0",
        border: "1px solid #334155",
    },
};

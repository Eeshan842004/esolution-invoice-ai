"use client";

/**
 * KarmaScore — small inline badge for invoice cards.
 * Shows ⭐ X.X next to client name.
 */
export default function KarmaScore({ score }) {
    if (score === null || score === undefined) return null;

    const numScore = parseFloat(score);
    if (isNaN(numScore)) return null;

    let bg, color;
    if (numScore >= 4.0) {
        bg = "rgba(34, 197, 94, 0.15)";
        color = "#86efac";
    } else if (numScore >= 2.5) {
        bg = "rgba(234, 179, 8, 0.15)";
        color = "#fde047";
    } else {
        bg = "rgba(239, 68, 68, 0.15)";
        color = "#fca5a5";
    }

    return (
        <span
            style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "3px",
                padding: "2px 8px",
                borderRadius: "12px",
                fontSize: "11px",
                fontWeight: 600,
                background: bg,
                color: color,
                marginLeft: "8px",
                whiteSpace: "nowrap",
            }}
            title={`Client Karma Score: ${numScore}/5`}
        >
            ⭐ {numScore.toFixed(1)}
        </span>
    );
}

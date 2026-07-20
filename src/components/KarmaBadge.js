"use client";

/**
 * KarmaBadge — shows karma warning below the email field on new invoice form.
 * Props: { karma } — the response object from /api/karma/check
 */
export default function KarmaBadge({ karma, loading }) {
    if (loading) {
        return (
            <div className="karma-badge karma-loading">
                <span className="karma-spinner">⏳</span> Checking client history...
            </div>
        );
    }

    if (!karma) return null;

    // New client
    if (karma.newClient) {
        return (
            <div className="karma-badge karma-new">
                <span className="karma-icon">👋</span>
                <div className="karma-text">
                    <strong>New client</strong> — No karma data yet. First time in ESolution network.
                </div>
            </div>
        );
    }

    // Determine tier styling
    const tierConfig = {
        green: {
            icon: "✅",
            className: "karma-green",
            title: "Reliable client",
        },
        yellow: {
            icon: "⚠️",
            className: "karma-yellow",
            title: "Moderate client",
        },
        red: {
            icon: "🚨",
            className: "karma-red",
            title: "RISKY CLIENT",
        },
    };

    const config = tierConfig[karma.tier] || tierConfig.yellow;

    return (
        <div className={`karma-badge ${config.className}`}>
            <div className="karma-header">
                <span className="karma-icon">{config.icon}</span>
                <strong>{config.title} — Karma {karma.karmaScore}/5</strong>
            </div>
            <div className="karma-details">
                {karma.onTimeCount > 0 && <span>✅ On time: {karma.onTimeCount}</span>}
                {karma.slightlyLateCount > 0 && <span>⏰ Late 1-7d: {karma.slightlyLateCount}</span>}
                {karma.lateCount > 0 && <span>⚠️ Late 8-14d: {karma.lateCount}</span>}
                {karma.veryLateCount > 0 && <span>❌ Very late 14+d: {karma.veryLateCount}</span>}
                {karma.defaulterCount > 0 && <span>🚫 Defaulted: {karma.defaulterCount}</span>}
                {karma.averageDelayDays > 0 && <span>📊 Avg delay: {karma.averageDelayDays}d</span>}
                {karma.userCount > 1 && <span>👥 {karma.userCount} ESolution users worked with this client</span>}
            </div>
            <div className="karma-recommendation">
                💡 {karma.recommendation}
            </div>

            <style jsx>{`
                .karma-badge {
                    margin-top: 8px;
                    padding: 12px 16px;
                    border-radius: 10px;
                    font-size: 13px;
                    line-height: 1.5;
                    animation: karmaSlide 0.3s ease-out;
                }
                @keyframes karmaSlide {
                    from { opacity: 0; transform: translateY(-8px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .karma-loading {
                    background: rgba(255,255,255,0.05);
                    color: #999;
                    border: 1px dashed #333;
                }
                .karma-spinner { animation: spin 1s linear infinite; display: inline-block; }
                @keyframes spin { to { transform: rotate(360deg); } }
                .karma-new {
                    background: rgba(99, 102, 241, 0.1);
                    border: 1px solid rgba(99, 102, 241, 0.3);
                    color: #a5b4fc;
                    display: flex;
                    align-items: center;
                    gap: 10px;
                }
                .karma-green {
                    background: rgba(34, 197, 94, 0.1);
                    border: 1px solid rgba(34, 197, 94, 0.3);
                    color: #86efac;
                }
                .karma-yellow {
                    background: rgba(234, 179, 8, 0.1);
                    border: 1px solid rgba(234, 179, 8, 0.3);
                    color: #fde047;
                }
                .karma-red {
                    background: rgba(239, 68, 68, 0.1);
                    border: 1px solid rgba(239, 68, 68, 0.3);
                    color: #fca5a5;
                }
                .karma-header {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    margin-bottom: 6px;
                    font-size: 14px;
                }
                .karma-details {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 8px 16px;
                    margin: 6px 0;
                    font-size: 12px;
                    opacity: 0.85;
                }
                .karma-recommendation {
                    margin-top: 6px;
                    font-size: 12px;
                    font-style: italic;
                    opacity: 0.75;
                }
            `}</style>
        </div>
    );
}

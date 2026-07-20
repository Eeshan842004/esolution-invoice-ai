"use client";

/**
 * Animated sound wave visualizer bars during voice recording.
 * Shows 5 animated bars that bounce at different speeds.
 */
export default function VoiceWaveVisualizer({ active }) {
    if (!active) return null;

    return (
        <div style={styles.container}>
            {[0, 1, 2, 3, 4].map((i) => (
                <div
                    key={i}
                    style={{
                        ...styles.bar,
                        animationDelay: `${i * 0.12}s`,
                        animationDuration: `${0.5 + i * 0.1}s`,
                    }}
                />
            ))}
            <style jsx>{`
                @keyframes voiceWave {
                    0%, 100% { height: 8px; }
                    50% { height: 28px; }
                }
            `}</style>
        </div>
    );
}

const styles = {
    container: {
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 4,
        height: 36,
    },
    bar: {
        width: 4,
        height: 8,
        borderRadius: 2,
        background: "white",
        animation: "voiceWave 0.6s ease-in-out infinite",
    },
};

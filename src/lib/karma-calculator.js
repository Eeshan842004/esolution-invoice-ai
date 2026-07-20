/**
 * Karma Calculator — determines karma label, points, and final score.
 */

/**
 * Calculate karma label and points from payment timing.
 * @param {number} dueDateDiffDays - days late (negative = early, 0 = on time, positive = late)
 * @returns {{ label: string, points: number }}
 */
export function calculateKarmaFromDelay(dueDateDiffDays) {
    if (dueDateDiffDays <= 0) {
        return { label: "on_time", points: 10 };
    } else if (dueDateDiffDays <= 7) {
        return { label: "slightly_late", points: 5 };
    } else if (dueDateDiffDays <= 14) {
        return { label: "late", points: 2 };
    } else {
        return { label: "very_late", points: -5 };
    }
}

/**
 * Calculate final karma score on 0-5 scale from counts.
 * Formula: (total_points / total_invoices + 10) / 20 * 5
 *   → maps range [-10, +10] to [0, 5]
 */
export function calculateKarmaScore(counts) {
    const {
        on_time_count = 0,
        slightly_late_count = 0,
        late_count = 0,
        very_late_count = 0,
        defaulter_count = 0,
    } = counts;

    const totalInvoices =
        on_time_count + slightly_late_count + late_count + very_late_count + defaulter_count;

    if (totalInvoices === 0) return 5.0; // No data = benefit of doubt

    const totalPoints =
        on_time_count * 10 +
        slightly_late_count * 5 +
        late_count * 2 +
        very_late_count * -5 +
        defaulter_count * -10;

    const avgPoints = totalPoints / totalInvoices;
    // Map [-10, +10] → [0, 5]
    const score = ((avgPoints + 10) / 20) * 5;
    return Math.round(Math.max(0, Math.min(5, score)) * 10) / 10; // clamp 0-5, 1 decimal
}

/**
 * Get recommendation text based on karma score.
 */
export function getKarmaRecommendation(score) {
    if (score >= 4.0) return "Reliable client — safe to extend credit";
    if (score >= 3.0) return "Generally pays, occasional delays expected";
    if (score >= 2.0) return "Ask for partial advance payment";
    return "High risk — ask for 50% advance before work";
}

/**
 * Get karma badge color tier.
 */
export function getKarmaTier(score) {
    if (score >= 4.0) return "green";
    if (score >= 2.5) return "yellow";
    return "red";
}

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { GoogleSpreadsheet } from "google-spreadsheet";
import { JWT } from "google-auth-library";
import { hashEmail, getFirstName } from "@/lib/email-hasher";
import { calculateKarmaFromDelay, calculateKarmaScore } from "@/lib/karma-calculator";

const KARMA_SHEET_NAME = "KarmaDB";

/**
 * Get or create the karma sheet inside the SAME spreadsheet.
 * Uses a separate tab called "KarmaDB".
 */
async function getKarmaSheet() {
    const serviceAccountAuth = new JWT({
        email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
        scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });

    const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEET_ID, serviceAccountAuth);
    await doc.loadInfo();

    // Try to find existing KarmaDB tab
    let sheet = doc.sheetsByTitle[KARMA_SHEET_NAME];

    if (!sheet) {
        // Create the tab with headers
        sheet = await doc.addSheet({
            title: KARMA_SHEET_NAME,
            headerValues: [
                "client_email_hash",
                "client_name",
                "total_invoices",
                "on_time_count",
                "slightly_late_count",
                "late_count",
                "very_late_count",
                "defaulter_count",
                "average_delay_days",
                "karma_score",
                "user_count",
                "last_updated",
            ],
        });
        console.log("✅ [Karma] Created KarmaDB sheet tab");
    }

    return sheet;
}

/**
 * POST /api/karma/submit
 * Called after invoice marked as paid — calculates and saves karma.
 */
export async function POST(request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { clientEmail, clientName, daysToPay, dueDateDiff } = await request.json();

        if (!clientEmail || !clientName) {
            return NextResponse.json({ error: "clientEmail and clientName are required" }, { status: 400 });
        }

        const emailHash = hashEmail(clientEmail);
        const nameLower = clientName.toLowerCase().trim();
        const { label, points } = calculateKarmaFromDelay(dueDateDiff);

        console.log(`🔮 [Karma] Submitting for ${clientName} (${label}, ${points} pts, ${dueDateDiff}d late)`);

        const sheet = await getKarmaSheet();
        const rows = await sheet.getRows();

        // Find existing row by email hash and name
        let existingRow = rows.find((r) =>
            r.get("client_email_hash") === emailHash &&
            r.get("client_name")?.toLowerCase().trim() === nameLower
        );

        if (existingRow) {
            // Update existing record
            const currentCount = parseInt(existingRow.get(label + "_count")) || 0;
            existingRow.set(label + "_count", currentCount + 1);

            const totalInvoices = (parseInt(existingRow.get("total_invoices")) || 0) + 1;
            existingRow.set("total_invoices", totalInvoices);

            // Recalculate average delay
            const prevAvg = parseFloat(existingRow.get("average_delay_days")) || 0;
            const newAvg = Math.round(((prevAvg * (totalInvoices - 1)) + Math.max(0, dueDateDiff)) / totalInvoices);
            existingRow.set("average_delay_days", newAvg);

            // Recalculate karma score
            const counts = {
                on_time_count: parseInt(existingRow.get("on_time_count")) || 0,
                slightly_late_count: parseInt(existingRow.get("slightly_late_count")) || 0,
                late_count: parseInt(existingRow.get("late_count")) || 0,
                very_late_count: parseInt(existingRow.get("very_late_count")) || 0,
                defaulter_count: parseInt(existingRow.get("defaulter_count")) || 0,
            };
            const karmaScore = calculateKarmaScore(counts);
            existingRow.set("karma_score", karmaScore);

            // Increment user_count only (simplified — in production, track unique users)
            existingRow.set("last_updated", new Date().toISOString().split("T")[0]);

            await existingRow.save();
            console.log(`✅ [Karma] Updated ${clientName}: score=${karmaScore}, total=${totalInvoices}`);

            return NextResponse.json({
                success: true,
                karma: { score: karmaScore, label, totalInvoices },
            });
        } else {
            // Create new record
            const counts = {
                on_time_count: label === "on_time" ? 1 : 0,
                slightly_late_count: label === "slightly_late" ? 1 : 0,
                late_count: label === "late" ? 1 : 0,
                very_late_count: label === "very_late" ? 1 : 0,
                defaulter_count: label === "defaulter" ? 1 : 0,
            };
            const karmaScore = calculateKarmaScore(counts);

            await sheet.addRow({
                client_email_hash: emailHash,
                client_name: clientName.trim(),
                total_invoices: 1,
                ...counts,
                average_delay_days: Math.max(0, dueDateDiff),
                karma_score: karmaScore,
                user_count: 1,
                last_updated: new Date().toISOString().split("T")[0],
            });

            console.log(`✅ [Karma] New record for ${clientName}: score=${karmaScore}`);

            return NextResponse.json({
                success: true,
                karma: { score: karmaScore, label, totalInvoices: 1, isNew: true },
            });
        }
    } catch (error) {
        console.error("❌ [Karma] Submit error:", error.message);
        return NextResponse.json(
            { error: "Failed to submit karma", detail: error.message },
            { status: 500 }
        );
    }
}

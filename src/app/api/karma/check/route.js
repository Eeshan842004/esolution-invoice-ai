import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { GoogleSpreadsheet } from "google-spreadsheet";
import { JWT } from "google-auth-library";
import { hashEmail } from "@/lib/email-hasher";
import { getKarmaRecommendation, getKarmaTier } from "@/lib/karma-calculator";

/**
 * GET /api/karma/check?email={email}
 * Lookup karma data for a client email (hashed for privacy).
 */
export async function GET(request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const email = searchParams.get("email");
        const name = searchParams.get("name");

        if (!email || !name) {
            return NextResponse.json({ error: "email and name params are required" }, { status: 400 });
        }

        const emailHash = hashEmail(email);

        // Connect to spreadsheet
        const serviceAccountAuth = new JWT({
            email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
            key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
            scopes: ["https://www.googleapis.com/auth/spreadsheets"],
        });

        const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEET_ID, serviceAccountAuth);
        await doc.loadInfo();

        const sheet = doc.sheetsByTitle["KarmaDB"];
        if (!sheet) {
            // KarmaDB tab doesn't exist yet — no data
            return NextResponse.json({ newClient: true });
        }

        const rows = await sheet.getRows();
        const nameLower = name.toLowerCase().trim();
        const match = rows.find((r) => r.get("client_email_hash") === emailHash && r.get("client_name")?.toLowerCase().trim() === nameLower);

        if (!match) {
            return NextResponse.json({ newClient: true });
        }

        const score = parseFloat(match.get("karma_score")) || 0;
        const data = {
            newClient: false,
            clientName: match.get("client_name"),
            karmaScore: score,
            tier: getKarmaTier(score),
            recommendation: getKarmaRecommendation(score),
            totalInvoices: parseInt(match.get("total_invoices")) || 0,
            onTimeCount: parseInt(match.get("on_time_count")) || 0,
            slightlyLateCount: parseInt(match.get("slightly_late_count")) || 0,
            lateCount: parseInt(match.get("late_count")) || 0,
            veryLateCount: parseInt(match.get("very_late_count")) || 0,
            defaulterCount: parseInt(match.get("defaulter_count")) || 0,
            averageDelayDays: parseInt(match.get("average_delay_days")) || 0,
            userCount: parseInt(match.get("user_count")) || 1,
            lastUpdated: match.get("last_updated"),
        };

        return NextResponse.json(data);
    } catch (error) {
        console.error("❌ [Karma] Check error:", error.message);
        return NextResponse.json(
            { error: "Failed to check karma", detail: error.message },
            { status: 500 }
        );
    }
}

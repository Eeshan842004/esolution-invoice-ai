import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getDoc } from "@/lib/sheets";

/**
 * GET /api/debug — Test Google Sheets connection + env vars
 * Returns detailed status of all integrations.
 */
export async function GET() {
    try {
        const session = await getServerSession(authOptions);
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const results = {};

        // 1. Check env vars
        results.env = {
            GOOGLE_SHEET_ID: !!process.env.GOOGLE_SHEET_ID,
            GOOGLE_SERVICE_ACCOUNT_EMAIL: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || "MISSING",
            GOOGLE_PRIVATE_KEY: process.env.GOOGLE_PRIVATE_KEY ? "SET (" + process.env.GOOGLE_PRIVATE_KEY.length + " chars)" : "MISSING",
            GEMINI_API_KEY: !!process.env.GEMINI_API_KEY,
            GMAIL_USER: process.env.GMAIL_USER || "MISSING",
            GMAIL_APP_PASSWORD: process.env.GMAIL_APP_PASSWORD && process.env.GMAIL_APP_PASSWORD !== "your_16_char_app_password_here" ? "SET" : "NOT SET — update .env.local",
            OWNER_EMAIL: process.env.OWNER_EMAIL || "MISSING",
            OWNER_UPI_ID: process.env.OWNER_UPI_ID || "MISSING",
        };

        // 2. Test Google Sheets connection
        try {
            const doc = await getDoc();
            results.sheets = {
                ok: true,
                title: doc.title,
                sheetCount: doc.sheetCount,
                sheets: Object.keys(doc.sheetsByTitle),
            };
        } catch (err) {
            results.sheets = { ok: false, error: err.message };
        }

        // 3. Test Gemini API
        try {
            const { GoogleGenerativeAI } = await import("@google/generative-ai");
            const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
            const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
            const r = await model.generateContent("Say: OK");
            results.gemini = { ok: true, response: r.response.text().trim() };
        } catch (err) {
            results.gemini = { ok: false, error: err.message };
        }

        return NextResponse.json({ success: true, results });
    } catch (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

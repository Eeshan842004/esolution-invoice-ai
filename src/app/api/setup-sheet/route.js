import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { initializeSheetHeaders } from "@/lib/sheets";

/**
 * POST /api/setup-sheet — Initialize Google Sheet with proper headers
 * One-time setup route
 */
export async function POST() {
    try {
        const session = await getServerSession(authOptions);
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const result = await initializeSheetHeaders();

        return NextResponse.json({
            success: true,
            message: "Sheet headers initialized successfully",
            headers: result.headers,
        });
    } catch (error) {
        console.error("Sheet setup error:", error);
        return NextResponse.json(
            { error: "Failed to set up sheet: " + error.message },
            { status: 500 }
        );
    }
}

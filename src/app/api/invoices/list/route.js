import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
    getInvoices,
    getInvoiceSummary,
} from "@/lib/sheets";

/**
 * GET /api/invoices/list — List all invoices with summary
 */
export async function GET() {
    try {
        const session = await getServerSession(authOptions);
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const [invoices, summary] = await Promise.all([
            getInvoices(),
            getInvoiceSummary(),
        ]);

        // Sort: Overdue first (descending days_overdue), then Due Soon, then others
        invoices.sort((a, b) => {
            if (a.status === "Overdue" && b.status !== "Overdue") return -1;
            if (a.status !== "Overdue" && b.status === "Overdue") return 1;
            if (a.status === "Overdue" && b.status === "Overdue") return b.days_overdue - a.days_overdue;
            return new Date(a.due_date) - new Date(b.due_date);
        });

        return NextResponse.json({ invoices, summary });
    } catch (error) {
        console.error("GET /api/invoices/list error:", error);
        return NextResponse.json(
            { error: "Failed to fetch invoices", detail: error.message },
            { status: 500 }
        );
    }
}

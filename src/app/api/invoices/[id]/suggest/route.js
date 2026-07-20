import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getInvoiceById } from "@/lib/sheets";
import { generateFollowUpSuggestion } from "@/lib/gemini";

/**
 * POST /api/invoices/[id]/suggest — Get AI follow-up suggestion
 */
export async function POST(request, { params }) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { id } = await params;
        const invoice = await getInvoiceById(id);

        if (!invoice) {
            return NextResponse.json(
                { error: "Invoice not found" },
                { status: 404 }
            );
        }

        const suggestion = await generateFollowUpSuggestion(invoice);
        return NextResponse.json({ suggestion });
    } catch (error) {
        console.error("AI suggestion error:", error);
        return NextResponse.json(
            { error: "Failed to generate suggestion" },
            { status: 500 }
        );
    }
}

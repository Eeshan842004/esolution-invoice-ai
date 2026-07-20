import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getInvoiceById } from "@/lib/sheets";
import { generateFollowUpSuggestion } from "@/lib/gemini";

/**
 * GET /api/invoices/[id] — Get single invoice details
 */
export async function GET(request, { params }) {
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

        return NextResponse.json({ invoice });
    } catch (error) {
        console.error(`GET /api/invoices/${(await params).id} error:`, error);
        return NextResponse.json(
            { error: "Failed to fetch invoice" },
            { status: 500 }
        );
    }
}

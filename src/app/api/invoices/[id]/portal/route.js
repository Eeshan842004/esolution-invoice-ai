import { NextResponse } from "next/server";
import { getInvoiceById, updateInvoiceField } from "@/lib/sheets";

/**
 * GET /api/invoices/[id]/portal?token=xxx — Get invoice data for client portal (no auth needed)
 */
export async function GET(request, { params }) {
    try {
        const { id } = await params;
        const { searchParams } = new URL(request.url);
        const token = searchParams.get("token");

        if (!token) {
            return NextResponse.json({ error: "Missing token" }, { status: 400 });
        }

        const invoice = await getInvoiceById(id);

        if (!invoice) {
            return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
        }

        // Validate token
        if (invoice.portal_token !== token) {
            return NextResponse.json({ error: "Invalid or expired link" }, { status: 403 });
        }

        // Track portal view
        try {
            await updateInvoiceField(id, { portal_viewed: "TRUE" });
        } catch (e) {
            console.warn("Could not update portal_viewed:", e.message);
        }

        // Return safe data (no token or internal fields)
        const ownerUPI = process.env.OWNER_UPI_ID || "";
        const ownerName = process.env.OWNER_NAME || "ESolution";
        const ownerBank = process.env.OWNER_BANK_ACCOUNT || "";
        const ownerIFSC = process.env.OWNER_BANK_IFSC || "";

        return NextResponse.json({
            invoice: {
                invoice_id: invoice.invoice_id,
                client_name: invoice.client_name,
                client_email: invoice.client_email,
                amount: invoice.amount,
                due_date: invoice.due_date,
                status: invoice.status,
                discount_percent: invoice.discount_percent,
                final_amount: invoice.final_amount,
                penalty_amount: invoice.penalty_amount,
                total_amount_due: invoice.total_amount_due,
                days_overdue: invoice.days_overdue,
                notes: invoice.notes,
                created_at: invoice.created_at,
                payment_claimed: invoice.payment_claimed,
            },
            payment: {
                upi_id: ownerUPI,
                owner_name: ownerName,
                bank_account: ownerBank,
                bank_ifsc: ownerIFSC,
            },
        });
    } catch (error) {
        console.error("Portal data error:", error);
        return NextResponse.json(
            { error: "Failed to load invoice", detail: error.message },
            { status: 500 }
        );
    }
}

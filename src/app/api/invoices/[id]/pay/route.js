import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { markInvoicePaid, getInvoiceById } from "@/lib/sheets";

/**
 * POST /api/invoices/[id]/pay — Mark invoice as paid manually
 */
export async function POST(request, { params }) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { id } = await params;

        let payment_reference = "Manual";
        try {
            const body = await request.json();
            payment_reference = body.payment_reference || "Manual";
        } catch (e) {
            // No body provided, use default
        }

        // Verify invoice exists
        const invoice = await getInvoiceById(id);
        if (!invoice) {
            return NextResponse.json(
                { error: "Invoice not found" },
                { status: 404 }
            );
        }

        if (invoice.status === "Paid") {
            return NextResponse.json(
                { error: "Invoice is already paid" },
                { status: 400 }
            );
        }

        // Mark as paid
        const updated = await markInvoicePaid(id, payment_reference || "Manual");

        // Submit karma score
        try {
            const paidDate = new Date();
            const createdAt = new Date(invoice.created_at || invoice.due_date);
            const dueDate = new Date(invoice.due_date);
            const daysToPay = Math.floor((paidDate - createdAt) / (1000 * 60 * 60 * 24));
            const dueDateDiff = Math.floor((paidDate - dueDate) / (1000 * 60 * 60 * 24));

            const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
            await fetch(`${baseUrl}/api/karma/submit`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Cookie: request.headers.get("cookie") || ""
                },
                body: JSON.stringify({
                    clientEmail: invoice.client_email,
                    clientName: invoice.client_name,
                    daysToPay,
                    dueDateDiff,
                }),
            }).then(res => {
                if (!res.ok) console.warn("Karma submit failed with status:", res.status);
                else console.log("✅ Karma submitted successfully.");
            }).catch((e) => console.warn("Karma submit skipped:", e.message));
        } catch (karmaErr) {
            console.warn("Karma calculation skipped:", karmaErr.message);
        }

        // Trigger certificate generation
        try {
            const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
            await fetch(`${baseUrl}/api/certificate/generate?id=${id}&format=png`, {
                headers: { Cookie: request.headers.get("cookie") || "" }
            })
                .then(res => {
                    if (!res.ok) console.warn("Certificate failed with status:", res.status);
                    else console.log(`🏆 [Pay] Certificate triggered for ${id}`);
                })
                .catch((e) => console.warn("Certificate generation skipped:", e.message));
        } catch (certErr) {
            console.warn("Certificate trigger skipped:", certErr.message);
        }

        return NextResponse.json({
            success: true,
            message: `Invoice ${id} marked as paid`,
            invoice: updated,
        });
    } catch (error) {
        console.error("Mark paid error:", error);
        return NextResponse.json(
            { error: "Failed to mark invoice as paid" },
            { status: 500 }
        );
    }
}

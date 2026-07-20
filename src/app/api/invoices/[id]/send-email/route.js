import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getInvoiceById } from "@/lib/sheets";
import { generatePaymentEmail, buildMailtoLink } from "@/lib/email";

/**
 * POST /api/invoices/[id]/send-email — Generate payment request email
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

        // Generate AI-powered payment request email
        const emailData = await generatePaymentEmail(invoice);
        const mailtoLink = buildMailtoLink(emailData);

        return NextResponse.json({
            success: true,
            email: emailData,
            mailto_link: mailtoLink,
        });
    } catch (error) {
        console.error("Email generation error:", error);
        return NextResponse.json(
            { error: "Failed to generate email" },
            { status: 500 }
        );
    }
}

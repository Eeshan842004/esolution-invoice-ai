import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getInvoiceById, updateInvoiceField } from "@/lib/sheets";
import { generateLegalNotice } from "@/lib/gemini";
import { sendEmail } from "@/lib/email";

/**
 * POST /api/invoices/[id]/legal — Generate legal notice via AI and send it
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

        if ((invoice.days_overdue || 0) < 30) {
            return NextResponse.json(
                { error: "Legal notice is recommended only after 30 days overdue" },
                { status: 400 }
            );
        }

        const freelancerInfo = {
            name: session.user.name,
            email: session.user.email,
        };

        // Generate the notice content
        const noticeText = await generateLegalNotice(invoice, freelancerInfo);

        // Send email
        const emailResult = await sendEmail({
            to: invoice.client_email,
            subject: `FINAL LEGAL NOTICE: Overdue Payment for Invoice ${invoice.invoice_id}`,
            text: noticeText,
            html: `<div style="font-family: monospace; white-space: pre-wrap;">${noticeText}</div>`,
        });

        if (!emailResult.success) {
            throw new Error(`Failed to send email: ${emailResult.error}`);
        }

        // Update sheet
        await updateInvoiceField(id, {
            legal_notice_sent: "TRUE",
            notes: (invoice.notes || "") + "\n[System] Legal notice sent on " + new Date().toISOString().split("T")[0],
        });

        return NextResponse.json({
            success: true,
            legal_notice: noticeText,
            message: "Legal notice generated and sent to client."
        });
    } catch (error) {
        console.error("Legal notice error:", error);
        return NextResponse.json(
            { error: "Failed to process legal notice" },
            { status: 500 }
        );
    }
}

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getInvoiceById, updateInvoiceField } from "@/lib/sheets";
import { sendReminderEmail, sendToneBasedReminder } from "@/lib/email";

/**
 * POST /api/invoices/[id]/remind — Generate reminder email
 * Supports emotion-based tones from AI analysis.
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

        if (invoice.status === "Paid") {
            return NextResponse.json(
                { error: "Invoice is already paid, no reminder needed" },
                { status: 400 }
            );
        }

        // --- TONE-BASED SENDING ---
        let emailResult;
        const tone = invoice.reminder_tone;

        if (tone && ["friendly_hindi", "formal_english", "apologetic", "firm"].includes(tone)) {
            emailResult = await sendToneBasedReminder(invoice, tone);
            console.log(`🎯 [Remind] Sent ${tone} tone email for ${id}`);
        } else {
            emailResult = await sendReminderEmail(invoice);
        }

        // Update reminder tracking in sheet
        const currentCount = parseInt(invoice.reminder_count) || 0;
        await updateInvoiceField(id, {
            last_reminder_date: new Date().toISOString().split("T")[0],
            reminder_count: currentCount + 1,
        });

        return NextResponse.json({
            success: true,
            email_sent: emailResult.success,
            email_error: emailResult.success ? null : emailResult.error,
            reminder_count: currentCount + 1,
            tone_used: tone || "default",
        });
    } catch (error) {
        console.error("Reminder generation error:", error);
        return NextResponse.json(
            { error: "Failed to generate reminder" },
            { status: 500 }
        );
    }
}

import { NextResponse } from "next/server";
import { getUnpaidInvoices, updateInvoiceField } from "@/lib/sheets";
import { sendReminderEmail, sendToneBasedReminder } from "@/lib/email";

/**
 * GET /api/reminders — Auto-send reminders for all overdue invoices.
 * Call this daily via a cron job, or trigger manually.
 * Protected by CRON_SECRET env var.
 * 
 * Supports emotion-based tone:
 * If reminder_tone is set on invoice → uses that tone template
 * If next_reminder_date is set and is in future → skips (respects AI wait)
 */
export async function GET(request) {
    // Allow internal calls (from cron) or authenticated users
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const unpaid = await getUnpaidInvoices();
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const results = [];

        for (const invoice of unpaid) {
            const dueDate = new Date(invoice.due_date);
            dueDate.setHours(0, 0, 0, 0);

            // Only send reminder if overdue
            if (today <= dueDate) continue;

            const daysOverdue = Math.floor((today - dueDate) / (1000 * 60 * 60 * 24));

            // Respect AI-recommended next_reminder_date
            if (invoice.next_reminder_date) {
                const nextDate = new Date(invoice.next_reminder_date);
                nextDate.setHours(0, 0, 0, 0);
                if (today < nextDate) {
                    results.push({
                        invoice_id: invoice.invoice_id,
                        status: "skipped_emotion_wait",
                        next_reminder_date: invoice.next_reminder_date,
                    });
                    continue;
                }
            }

            // Throttle: only send once per 3 days (fallback if no emotion date)
            const lastReminder = invoice.last_reminder_date
                ? new Date(invoice.last_reminder_date)
                : null;
            if (lastReminder && !invoice.next_reminder_date) {
                const daysSinceLast = Math.floor((today - lastReminder) / (1000 * 60 * 60 * 24));
                if (daysSinceLast < 3) {
                    results.push({ invoice_id: invoice.invoice_id, status: "skipped_throttle", days_since_last: daysSinceLast });
                    continue;
                }
            }

            // Enrich invoice with daysOverdue
            const enrichedInvoice = {
                ...invoice,
                days_overdue: daysOverdue,
                penalty_amount: Math.ceil(daysOverdue / 7) * 0.02 * parseFloat(invoice.amount || 0),
                total_amount_due: parseFloat(invoice.amount || 0) + Math.ceil(daysOverdue / 7) * 0.02 * parseFloat(invoice.amount || 0),
            };

            // --- TONE-BASED SENDING ---
            let emailResult;
            const tone = invoice.reminder_tone;

            if (tone && ["friendly_hindi", "formal_english", "apologetic", "firm"].includes(tone)) {
                // Use AI-recommended tone template
                emailResult = await sendToneBasedReminder(enrichedInvoice, tone);
                console.log(`🎯 [Reminder] Sent ${tone} tone email for ${invoice.invoice_id}`);
            } else {
                // Default: tier-based by days overdue
                emailResult = await sendReminderEmail(enrichedInvoice);
            }

            // Update sheet
            const currentCount = parseInt(invoice.reminder_count) || 0;
            await updateInvoiceField(invoice.invoice_id, {
                last_reminder_date: today.toISOString().split("T")[0],
                reminder_count: currentCount + 1,
                days_overdue: daysOverdue,
                penalty_amount: enrichedInvoice.penalty_amount,
                total_amount_due: enrichedInvoice.total_amount_due,
                status: "Overdue",
            });

            results.push({
                invoice_id: invoice.invoice_id,
                client: invoice.client_name,
                days_overdue: daysOverdue,
                tone_used: tone || "default",
                email_sent: emailResult.success,
                email_error: emailResult.success ? null : emailResult.error,
            });
        }

        return NextResponse.json({
            success: true,
            processed: results.length,
            results,
            timestamp: new Date().toISOString(),
        });
    } catch (error) {
        console.error("Auto-reminder error:", error);
        return NextResponse.json(
            { error: "Reminder run failed", detail: error.message },
            { status: 500 }
        );
    }
}

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { v4 as uuidv4 } from "uuid";
import {
    appendInvoiceRow,
    getInvoicesByClient,
} from "@/lib/sheets";
import { predictPaymentBehavior } from "@/lib/gemini";
import { sendPaymentRequestEmail } from "@/lib/email";
import { sendPortalInvoiceEmail } from "@/lib/portal-email";
import { generateInvoicePDF } from "@/lib/pdf-generator";

/**
 * POST /api/invoices/create — Create a new invoice, write to Sheet, send email
 */
export async function POST(request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await request.json();
        const { client_name, client_email, amount, due_date, discount_percentage, notes } = body;

        // Validate required fields
        if (!client_name || !client_email || !amount || !due_date) {
            return NextResponse.json(
                { error: "Missing required fields: client_name, client_email, amount, due_date" },
                { status: 400 }
            );
        }

        // Validate email
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(client_email)) {
            return NextResponse.json(
                { error: "Invalid email address" },
                { status: 400 }
            );
        }

        // Validate amount
        if (parseFloat(amount) <= 0) {
            return NextResponse.json(
                { error: "Invoice amount must be positive" },
                { status: 400 }
            );
        }

        // Generate invoice ID
        const timestamp = Math.floor(Date.now() / 1000);
        const randomPart = uuidv4().slice(0, 5);
        const invoiceId = `inv_${timestamp}_${randomPart}`;

        // Get AI behavior prediction (non-blocking)
        let behaviorScore = 50;
        let aiPrediction = { score: 50, risk_level: "Unknown", prediction: "First invoice for this client." };
        try {
            const clientHistory = await getInvoicesByClient(client_email);
            if (clientHistory.length > 0) {
                aiPrediction = await predictPaymentBehavior(client_email, clientHistory);
                behaviorScore = aiPrediction.score;
            }
        } catch (aiError) {
            console.warn("AI prediction skipped:", aiError.message);
        }

        // Calculate fields based on user request
        const parsedAmount = parseFloat(amount);
        const discountPercent = parseFloat(discount_percentage) || 0;
        const discountedAmount = parsedAmount * (1 - discountPercent / 100);
        const dueDateObj = new Date(due_date);
        const today = new Date();
        const daysOverdue = Math.max(0, Math.floor((today - dueDateObj) / (1000 * 60 * 60 * 24)));
        const penaltyAmount = daysOverdue > 0 ? Math.ceil(daysOverdue / 7) * 0.02 * parsedAmount : 0;
        const totalAmountDue = discountedAmount + penaltyAmount;

        // Generate portal token for magic link
        const portalToken = uuidv4();
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
        const portalUrl = `${baseUrl}/pay/${invoiceId}?token=${portalToken}`;

        // Prepare row data for Google Sheets
        const rowData = {
            invoice_id: invoiceId,
            client_name,
            client_email,
            amount: parseFloat(amount),
            due_date,
            status: "Unpaid",
            payment_method: "Bank/UPI",
            last_reminder_date: "",
            reminder_count: 0,
            paid_date: "",
            payment_reference: "",
            days_overdue: daysOverdue,
            penalty_amount: penaltyAmount,
            total_amount_due: totalAmountDue,
            ai_behavior_score: behaviorScore,
            discount_percentage: discountPercent,
            discounted_amount: discountedAmount,
            legal_notice_sent: "FALSE",
            notes: notes || "",
            created_at: new Date().toISOString(),
            // Portal columns
            portal_token: portalToken,
            portal_viewed: "FALSE",
            payment_claimed: "FALSE",
            client_message: "",
            installment_requested: "FALSE",
            partial_amount_proposed: "",
        };

        // Write to Google Sheet (critical — fail loudly if this fails)
        await appendInvoiceRow(rowData);
        console.log("✅ Invoice written to Google Sheet:", invoiceId);

        // Generate PDF and send enhanced portal email (non-blocking)
        let emailResult = { success: false, error: "Email not configured" };
        let pdfBuffer = null;
        try {
            pdfBuffer = await generateInvoicePDF(rowData);
            console.log("✅ PDF generated for:", invoiceId);
        } catch (pdfErr) {
            console.warn("⚠️ PDF generation skipped:", pdfErr.message);
        }

        try {
            emailResult = await sendPortalInvoiceEmail(rowData, portalUrl, pdfBuffer);
            if (emailResult.success) {
                console.log("✅ Portal email sent to:", client_email);
            } else {
                console.warn("⚠️ Portal email failed, trying fallback...");
                emailResult = await sendPaymentRequestEmail({ ...rowData });
            }
        } catch (emailErr) {
            console.warn("⚠️ Email send error:", emailErr.message);
            emailResult = { success: false, error: emailErr.message };
        }

        return NextResponse.json({
            success: true,
            invoice: {
                invoice_id: invoiceId,
                status: "Unpaid",
                amount: parsedAmount,
                discounted_amount: discountedAmount,
                discount_percentage: discountPercent,
                client_name,
                client_email,
                due_date,
                notes: notes || "",
                payment_behavior_score: behaviorScore,
                ai_prediction: aiPrediction,
                email_sent: emailResult.success,
                email_error: emailResult.success ? null : emailResult.error,
                portal_url: portalUrl,
                payment_details: {
                    upi_id: process.env.OWNER_UPI_ID,
                    bank_account: process.env.OWNER_BANK_ACCOUNT,
                    bank_ifsc: process.env.OWNER_BANK_IFSC,
                },
            },
        });
    } catch (error) {
        console.error("POST /api/invoices/create error:", error);
        return NextResponse.json(
            { error: "Failed to create invoice", detail: error.message },
            { status: 500 }
        );
    }
}

import { NextResponse } from "next/server";
import { getInvoiceById, updateInvoiceField } from "@/lib/sheets";
import { sendOwnerNotification } from "@/lib/portal-email";

/**
 * POST /api/invoices/[id]/actions — Handle client portal actions
 * Body: { token, action, message?, amount? }
 * Actions: "payment_claimed", "partial_payment", "installment", "dispute"
 */
export async function POST(request, { params }) {
    try {
        const { id } = await params;
        const body = await request.json();
        const { token, action, message, amount } = body;

        if (!token || !action) {
            return NextResponse.json({ error: "Missing token or action" }, { status: 400 });
        }

        const invoice = await getInvoiceById(id);

        if (!invoice) {
            return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
        }

        // Validate token
        if (invoice.portal_token !== token) {
            return NextResponse.json({ error: "Invalid or expired link" }, { status: 403 });
        }

        let updates = {};
        let notifType = action;

        switch (action) {
            case "payment_claimed":
                updates = {
                    payment_claimed: "TRUE",
                    client_message: message || "Client marked as paid via portal",
                };
                break;

            case "partial_payment":
                if (!amount || parseFloat(amount) <= 0) {
                    return NextResponse.json({ error: "Invalid partial amount" }, { status: 400 });
                }
                updates = {
                    partial_amount_proposed: parseFloat(amount),
                    client_message: message || `Partial payment of ₹${amount} proposed`,
                };
                break;

            case "installment":
                updates = {
                    installment_requested: "TRUE",
                    client_message: message || "Installment plan requested",
                };
                break;

            case "dispute":
                updates = {
                    client_message: message || "Client raised a dispute",
                };
                notifType = "dispute";
                break;

            default:
                return NextResponse.json({ error: "Invalid action" }, { status: 400 });
        }

        // Update Google Sheet
        await updateInvoiceField(id, updates);
        console.log(`✅ [Portal] Action "${action}" for invoice ${id}`);

        // Notify owner via email
        try {
            await sendOwnerNotification({
                type: notifType,
                invoice,
                message: message || updates.client_message,
            });
            console.log(`✅ [Portal] Owner notified about "${action}"`);
        } catch (emailErr) {
            console.warn("Owner notification failed:", emailErr.message);
        }

        return NextResponse.json({
            success: true,
            message: getSuccessMessage(action),
        });
    } catch (error) {
        console.error("Portal action error:", error);
        return NextResponse.json(
            { error: "Action failed", detail: error.message },
            { status: 500 }
        );
    }
}

function getSuccessMessage(action) {
    switch (action) {
        case "payment_claimed": return "Thank you! The business owner has been notified and will verify your payment.";
        case "partial_payment": return "Your partial payment proposal has been sent. You'll hear back soon.";
        case "installment": return "Your installment request has been submitted. You'll hear back soon.";
        case "dispute": return "Your message has been sent to the business owner.";
        default: return "Action completed.";
    }
}

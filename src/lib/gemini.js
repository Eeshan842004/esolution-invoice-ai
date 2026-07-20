import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

/**
 * Predict payment behavior based on client history
 * Returns score 0-100, risk level, and prediction text
 */
export async function predictPaymentBehavior(clientEmail, invoiceHistory) {
    if (!invoiceHistory || invoiceHistory.length === 0) {
        return {
            score: 50,
            risk_level: "Unknown",
            prediction: "No payment history available. Default score assigned.",
        };
    }

    const historyText = invoiceHistory
        .map(
            (inv) =>
                `Invoice: ₹${inv.amount}, Due: ${inv.due_date}, Status: ${inv.status}, ` +
                `Paid: ${inv.paid_date || "N/A"}, Days Overdue: ${inv.days_overdue || 0}`
        )
        .join("\n");

    const prompt = `You are a payment behavior analyst. Based on this client's invoice history, predict their payment reliability.

Client: ${clientEmail}
History:
${historyText}

Respond ONLY in this exact JSON format (no markdown, no code blocks):
{"score": <0-100>, "risk_level": "<Low|Medium|High>", "prediction": "<one sentence prediction>"}

Score guide: 90-100 = always pays on time, 70-89 = usually pays, 50-69 = sometimes late, 30-49 = often late, 0-29 = rarely pays.`;

    try {
        const result = await model.generateContent(prompt);
        const text = result.response.text().trim();
        const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
        return JSON.parse(cleaned);
    } catch (error) {
        console.error("Gemini prediction error:", error);
        return {
            score: 50,
            risk_level: "Unknown",
            prediction: "Unable to generate prediction at this time.",
        };
    }
}

/**
 * Generate a smart follow-up suggestion
 */
export async function generateFollowUpSuggestion(invoiceDetails) {
    const prompt = `You are a freelance payment advisor. Based on this invoice, suggest the best follow-up action.

Invoice Details:
- Amount: ₹${invoiceDetails.amount}
- Due Date: ${invoiceDetails.due_date}
- Status: ${invoiceDetails.status}
- Days Overdue: ${invoiceDetails.days_overdue || 0}
- Reminders Sent: ${invoiceDetails.reminder_count || 0}
- Client: ${invoiceDetails.client_name}

Respond ONLY in this exact JSON format (no markdown, no code blocks):
{"action": "<send_now|wait|call|escalate>", "wait_days": <number or 0>, "tone": "<friendly|firm|urgent|legal>", "message": "<suggested follow-up message in 2-3 sentences>"}`;

    try {
        const result = await model.generateContent(prompt);
        const text = result.response.text().trim();
        const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
        return JSON.parse(cleaned);
    } catch (error) {
        console.error("Gemini suggestion error:", error);
        return {
            action: "wait",
            wait_days: 3,
            tone: "friendly",
            message: "Unable to generate suggestion. Try again later.",
        };
    }
}

/**
 * Generate a legal notice letter
 */
export async function generateLegalNotice(invoiceDetails, freelancerInfo) {
    const prompt = `Generate a professional legal demand letter for an overdue payment.

Freelancer: ${freelancerInfo.name} (${freelancerInfo.email})
Client: ${invoiceDetails.client_name} (${invoiceDetails.client_email})
Invoice ID: ${invoiceDetails.invoice_id}
Original Amount: ₹${invoiceDetails.amount}
Penalty: ₹${invoiceDetails.penalty_amount || 0}
Total Due: ₹${invoiceDetails.total_amount_due || invoiceDetails.amount}
Due Date: ${invoiceDetails.due_date}
Days Overdue: ${invoiceDetails.days_overdue}

Write a formal legal demand letter in plain text. Include:
1. Reference to the original invoice
2. Total amount including penalties
3. Demand for immediate payment within 7 days
4. Notice of potential legal proceedings
5. Professional but firm tone

Do NOT use markdown formatting. Write in plain text only.`;

    try {
        const result = await model.generateContent(prompt);
        return result.response.text().trim();
    } catch (error) {
        console.error("Gemini legal notice error:", error);
        return "Unable to generate legal notice at this time. Please try again.";
    }
}

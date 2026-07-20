import { NextResponse } from "next/server";
import { updateInvoiceField, getInvoiceById } from "@/lib/sheets";

/**
 * POST /api/emotion/analyze
 * Called by Google Apps Script when a client replies to an invoice email.
 * Uses Groq AI (Llama 3) to analyze emotional tone and recommend next action.
 *
 * Body: { invoiceId: string, replyText: string, clientEmail?: string }
 * Returns: { emotion, score, tone, waitDays, reasoning }
 */
export async function POST(request) {
    try {
        const { invoiceId, replyText, clientEmail } = await request.json();

        if (!invoiceId || !replyText) {
            return NextResponse.json(
                { error: "invoiceId and replyText are required" },
                { status: 400 }
            );
        }

        console.log(`🧠 [Emotion] Analyzing reply for ${invoiceId}: "${replyText.substring(0, 80)}..."`);

        // Get invoice details for context
        let daysOverdue = 0;
        try {
            const invoice = await getInvoiceById(invoiceId);
            if (invoice) {
                daysOverdue = invoice.days_overdue || 0;
            }
        } catch (e) {
            console.warn("⚠️ [Emotion] Could not fetch invoice for context:", e.message);
        }

        // --- Call Groq AI (Llama 3) ---
        const groqApiKey = process.env.GROQ_API_KEY;
        if (!groqApiKey) {
            throw new Error("GROQ_API_KEY is not set in environment variables");
        }

        const prompt = `Analyze this client reply to an invoice email.
Reply text: '${replyText}'
Invoice overdue by: ${daysOverdue} days

Return ONLY this JSON, no markdown, no explanation:
{
  "emotion": "stressed" or "angry" or "cooperative" or "corporate" or "ghosting",
  "score": number from -10 to +10,
  "tone": "friendly_hindi" or "formal_english" or "apologetic" or "firm",
  "waitDays": number of days to wait before next reminder,
  "reasoning": "one short sentence explanation"
}

Guidelines:
- If reply is in Hindi/Hinglish and asking for time → emotion=stressed, tone=friendly_hindi
- If reply is angry/rude → emotion=angry, tone=apologetic, waitDays=7+
- If reply is professional/corporat → emotion=corporate, tone=formal_english
- If reply says will pay/cooperative → emotion=cooperative, tone=friendly_hindi, waitDays=3-5
- If no real reply or vague → emotion=ghosting, tone=firm`;

        const groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${groqApiKey}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                model: "llama-3.3-70b-versatile",
                messages: [
                    {
                        role: "system",
                        content: "You are an emotion analysis expert for an Indian invoice/payment system. You understand Hindi, Hinglish, and English. Always respond with ONLY valid JSON."
                    },
                    {
                        role: "user",
                        content: prompt
                    }
                ],
                temperature: 0.3,
                max_tokens: 200,
            }),
        });

        if (!groqResponse.ok) {
            const errBody = await groqResponse.text();
            throw new Error(`Groq API error ${groqResponse.status}: ${errBody}`);
        }

        const groqData = await groqResponse.json();
        const rawText = groqData.choices?.[0]?.message?.content?.trim() || "";
        console.log("🧠 [Emotion] Raw Groq response:", rawText);

        const cleaned = rawText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
        const parsed = JSON.parse(cleaned);

        console.log(`✅ [Emotion] Result for ${invoiceId}: ${parsed.emotion} (score: ${parsed.score}), tone: ${parsed.tone}, wait: ${parsed.waitDays}d`);

        // --- Update Google Sheet with emotion data ---
        const today = new Date();
        const nextReminderDate = new Date(today);
        nextReminderDate.setDate(nextReminderDate.getDate() + (parsed.waitDays || 3));

        try {
            await updateInvoiceField(invoiceId, {
                last_client_reply: replyText.substring(0, 200),
                client_emotion: parsed.emotion,
                emotion_score: parsed.score,
                reminder_tone: parsed.tone,
                next_reminder_date: nextReminderDate.toISOString().split("T")[0],
            });
            console.log(`✅ [Emotion] Sheet updated for ${invoiceId}`);
        } catch (sheetError) {
            console.error("⚠️ [Emotion] Sheet update failed:", sheetError.message);
            // Still return the analysis even if sheet update fails
        }

        return NextResponse.json({
            success: true,
            invoiceId,
            emotion: parsed.emotion,
            score: parsed.score,
            tone: parsed.tone,
            waitDays: parsed.waitDays,
            reasoning: parsed.reasoning,
            next_reminder_date: nextReminderDate.toISOString().split("T")[0],
        });
    } catch (error) {
        console.error("❌ [Emotion] Analysis error:", error.message);

        // Return a safe default so Apps Script doesn't crash
        return NextResponse.json({
            success: false,
            error: error.message,
            emotion: "unknown",
            score: 0,
            tone: "formal_english",
            waitDays: 3,
            reasoning: "Could not analyze — defaulting to 3-day wait",
        });
    }
}

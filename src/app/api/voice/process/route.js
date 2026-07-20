import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import Groq from "groq-sdk";

const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY,
});

/**
 * POST /api/voice/process — Process voice transcript → extract invoice fields
 * Uses Groq (Llama3) instead of Gemini to avoid rate limits.
 * Body: { transcript: string }
 */
export async function POST(request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { transcript, mode, currentValues } = await request.json();

        if (!transcript || transcript.trim().length === 0) {
            return NextResponse.json(
                { error: "No transcript provided" },
                { status: 400 }
            );
        }

        const isEditMode = mode === "edit" && currentValues;
        console.log(`🎤 [Voice] ${isEditMode ? "EDIT" : "NEW"} mode — Transcript:`, transcript);

        const today = new Date().toISOString().split("T")[0];

        let prompt;

        if (isEditMode) {
            // EDIT MODE: User wants to change specific fields
            prompt = `You are editing an existing invoice. Here are the current values:
clientName: ${currentValues.clientName || ""}
clientEmail: ${currentValues.clientEmail || ""}
amount: ${currentValues.amount || "0"}
dueDate: ${currentValues.dueDate || ""}
discount: ${currentValues.discount || "0"}
notes: ${currentValues.notes || ""}

The user wants to make this change: '${transcript}'
Today's date: ${today}

Update ONLY the fields the user mentioned. Keep all other fields EXACTLY the same.

Return ONLY this JSON, nothing else:
{"clientName":"...","clientEmail":"...","amount":...,"dueDate":"...","discount":...,"notes":"..."}

Rules:
- 'kal' means tomorrow
- '5 hazar' means 5000, '50k' means 50000
- 'next week' means 7 days from today
- 'next month' means 30 days from today
- '10 percent' or '10%' means discount is 10
- If a month name is mentioned (e.g. 'March 10'), return full date in YYYY-MM-DD
- IMPORTANT: Do NOT change fields that the user did NOT mention`;
        } else {
            // NEW MODE: Extract all fields from scratch
            prompt = `Extract invoice details from this voice input.
Input: '${transcript}'
Today's date: ${today}

Return ONLY this JSON, nothing else:
{"clientName":null,"clientEmail":null,"amount":null,"dueDate":null,"discount":null,"notes":null}

Rules:
- 'kal' means tomorrow
- '5 hazar' means 5000
- '50k' means 50000
- 'next week' means 7 days from today
- 'next month' means 30 days from today
- '10 percent' or '10%' means discount is 10
- If a month name is mentioned (e.g. 'March 10'), return the full date in YYYY-MM-DD
- If anything unclear, return null for that field`;
        }

        console.log("🧠 [Voice] Sending to Groq (llama-3.3-70b-versatile)...");

        const MAX_RETRIES = 3;
        const RETRY_DELAY_MS = 2000;

        for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
            try {
                if (attempt > 1) {
                    console.log(`🔄 [Voice] Retry ${attempt}/${MAX_RETRIES}...`);
                    await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
                }

                const chatCompletion = await groq.chat.completions.create({
                    messages: [
                        {
                            role: "user",
                            content: prompt,
                        },
                    ],
                    model: "llama-3.3-70b-versatile",
                    temperature: 0.1,
                    max_tokens: 256,
                });

                const text = chatCompletion.choices[0]?.message?.content?.trim();
                console.log("🧠 [Voice] Groq raw response:", text);

                if (!text) {
                    throw new Error("Empty response from Groq");
                }

                // Strip markdown fences if present
                const cleaned = text
                    .replace(/```json\n?/g, "")
                    .replace(/```\n?/g, "")
                    .trim();

                const fields = JSON.parse(cleaned);
                if (isEditMode) fields._edited = true;
                console.log(`✅ [Voice] ${isEditMode ? "EDITED" : "NEW"} fields:`, JSON.stringify(fields));

                return NextResponse.json({
                    success: true,
                    fields,
                    status: isEditMode ? "Updated! ✅" : "Invoice ready! ✅",
                });
            } catch (err) {
                console.error(`❌ [Voice] Attempt ${attempt}/${MAX_RETRIES} error:`, err.message);

                const isRateLimit = err.message?.includes("429") || err.message?.includes("rate");

                if (isRateLimit && attempt < MAX_RETRIES) {
                    continue;
                }

                if (attempt === MAX_RETRIES) {
                    return NextResponse.json(
                        {
                            error: isRateLimit
                                ? "AI is busy. Please wait and try again."
                                : "Could not process voice input. Please try again.",
                            status: "Could not process, please try again",
                        },
                        { status: 422 }
                    );
                }
            }
        }
    } catch (error) {
        console.error("Voice processing error:", error);
        return NextResponse.json(
            {
                error: "Voice processing failed",
                detail: error.message,
                status: "Could not process, please try again",
            },
            { status: 500 }
        );
    }
}

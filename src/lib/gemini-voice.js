import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

const TIMEOUT_MS = 10000; // 10 second timeout
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2000; // 2 second wait between retries

/**
 * Race a promise against a timeout.
 */
function withTimeout(promise, ms) {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(
            () => reject(new Error("TIMEOUT")),
            ms
        );
        promise
            .then((val) => { clearTimeout(timer); resolve(val); })
            .catch((err) => { clearTimeout(timer); reject(err); });
    });
}

/**
 * Process voice transcript and extract invoice details using Gemini AI.
 * Supports English, Hindi, and Hinglish natural language.
 *
 * @param {string} transcript - Raw voice transcript text
 * @returns {object} { success, data?, error?, status? }
 */
export async function extractInvoiceFromVoice(transcript) {
    const today = new Date().toISOString().split("T")[0];

    const prompt = `Extract invoice details from this voice input.
Input: '${transcript}'
Today's date: ${today}

Return ONLY this JSON, nothing else:
{"clientName":null,"clientEmail":null,"amount":null,"dueDate":null,"notes":null}

Rules:
- 'kal' means tomorrow
- '5 hazar' means 5000
- '50k' means 50000
- 'next week' means 7 days from today
- 'next month' means 30 days from today
- If a month name is mentioned (e.g. 'March 10'), return the full date in YYYY-MM-DD
- If anything unclear, return null for that field`;

    console.log("🎤 [Gemini Voice] Transcript received:", transcript);
    console.log("🎤 [Gemini Voice] Sending to Gemini...");

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            if (attempt > 1) {
                console.log(`🔄 [Gemini Voice] Retry ${attempt}/${MAX_RETRIES}, waiting ${RETRY_DELAY_MS}ms...`);
                await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
            }

            const result = await withTimeout(
                model.generateContent(prompt),
                TIMEOUT_MS
            );

            const text = result.response.text().trim();
            console.log("🧠 [Gemini Voice] Raw AI response:", text);

            const cleaned = text
                .replace(/```json\n?/g, "")
                .replace(/```\n?/g, "")
                .trim();

            const parsed = JSON.parse(cleaned);
            console.log("✅ [Gemini Voice] Parsed fields:", JSON.stringify(parsed));

            return {
                success: true,
                data: parsed,
                status: "Invoice ready! ✅",
            };
        } catch (error) {
            console.error(`❌ [Gemini Voice] Attempt ${attempt}/${MAX_RETRIES} error:`, error.message);

            const isTimeout = error.message === "TIMEOUT";
            const isRateLimit =
                error.message?.includes("429") ||
                error.message?.includes("Resource has been exhausted") ||
                error.message?.includes("quota") ||
                error.message?.includes("Too Many Requests");
            const isRetryable = isTimeout || isRateLimit;

            if (isRetryable && attempt < MAX_RETRIES) {
                console.log(`⏳ [Gemini Voice] ${isTimeout ? "Timed out" : "Rate limited"}, will retry...`);
                continue;
            }

            let userMsg;
            if (isTimeout) {
                userMsg = "AI took too long to respond. Please try again.";
            } else if (isRateLimit) {
                userMsg = "AI is busy (rate limit). Please wait 30 seconds and try again.";
            } else {
                userMsg = "Could not process voice input. Please try again.";
            }

            return {
                success: false,
                error: userMsg,
                status: "Could not process, please try again",
            };
        }
    }

    return {
        success: false,
        error: "Could not process, please try again",
        status: "Could not process, please try again",
    };
}

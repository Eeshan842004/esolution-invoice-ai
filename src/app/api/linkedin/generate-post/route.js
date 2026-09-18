import { NextResponse } from "next/server";

/**
 * POST /api/linkedin/generate-post
 * Uses Kie.ai (Gemini 2.5 Flash) to generate a compelling LinkedIn post for a
 * completed project.
 *
 * Body: { clientName, amount, paidDate, invoiceNotes, voiceDescription, freelancerName }
 * Returns: { success, postText }
 */
export async function POST(request) {
    try {
        const body = await request.json();
        const {
            clientName,
            amount,
            paidDate,
            invoiceNotes,
            voiceDescription,
            freelancerName,
        } = body;

        if (!clientName) {
            return NextResponse.json(
                { error: "clientName is required" },
                { status: 400 }
            );
        }

        const kieApiKey = process.env.KIE_API_KEY;
        if (!kieApiKey) {
            throw new Error("KIE_API_KEY is not set");
        }

        const ownerName = freelancerName || process.env.OWNER_NAME || "ESolution";
        const formattedDate = paidDate
            ? new Date(paidDate).toLocaleDateString("en-IN", { month: "long", year: "numeric" })
            : new Date().toLocaleDateString("en-IN", { month: "long", year: "numeric" });

        const userVoiceText = (invoiceNotes || "") + " " + (voiceDescription || "");

        const prompt = `You are a professional LinkedIn ghostwriter for Indian freelancers.
Generate a compelling LinkedIn post based on:
Freelancer: ${ownerName}
Client: ${clientName}  
Amount: ₹${amount || "N/A"}
Project description: ${userVoiceText.trim() || clientName + " project"}
Completion date: ${formattedDate}

Rules:
- Start with strong hook (emoji + statement)
- 150-180 words only
- 3-4 bullet points of work done
- Personal learning/insight
- Call to action for new clients
- End with 5 relevant hashtags
- Tone: Professional but warm
- Sound like a real person, not AI
- Include specific details from description
- Use actual invoice notes if available
- Use voice description if provided
- If neither available, use client name + amount
- Always make it sound specific, not generic

Return ONLY the post text, nothing else.`;

        console.log("📝 [LinkedIn] Generating post with Kie.ai (Gemini 2.5 Flash)...");

        // Kie.ai's OpenAI-compatible endpoint selects the model via the URL
        // path, not a "model" body field.
        const kieResponse = await fetch("https://api.kie.ai/gemini-2.5-flash/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${kieApiKey}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                messages: [
                    {
                        role: "system",
                        content: "You are a professional LinkedIn content writer. Write engaging, authentic posts. Never use markdown formatting in the post."
                    },
                    { role: "user", content: prompt }
                ],
                temperature: 0.7,
                max_tokens: 500,
                stream: false,
            }),
        });

        if (!kieResponse.ok) {
            const errBody = await kieResponse.text();
            throw new Error(`Kie.ai API error ${kieResponse.status}: ${errBody}`);
        }

        const kieData = await kieResponse.json();
        const postText = kieData.choices?.[0]?.message?.content?.trim() || "";

        console.log("✅ [LinkedIn] Post generated successfully");

        return NextResponse.json({
            success: true,
            postText,
        });
    } catch (error) {
        console.error("❌ [LinkedIn] Post generation error:", error.message);
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}

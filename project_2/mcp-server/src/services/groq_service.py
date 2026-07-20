"""Groq Llama 3.3 70B via the OpenAI-compatible REST endpoint.

Same key, model and prompt as the website's /api/linkedin/generate-post
route (which also calls Groq with plain fetch).
"""

from __future__ import annotations

from datetime import datetime

import httpx

from src.config import settings

GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"


async def _chat(system: str, user: str, temperature: float = 0.7,
                max_tokens: int = 500) -> str:
    if not settings.groq_api_key:
        raise RuntimeError("GROQ_API_KEY is not configured")
    async with httpx.AsyncClient(timeout=60.0) as client:
        resp = await client.post(
            GROQ_URL,
            headers={"Authorization": f"Bearer {settings.groq_api_key}"},
            json={
                "model": settings.groq_model,
                "messages": [
                    {"role": "system", "content": system},
                    {"role": "user", "content": user},
                ],
                "temperature": temperature,
                "max_tokens": max_tokens,
            },
        )
        resp.raise_for_status()
        data = resp.json()
    return (data.get("choices") or [{}])[0].get("message", {}).get("content", "").strip()


async def generate_linkedin_post(invoice: dict, project_description: str = "") -> str:
    """Write a LinkedIn post about a completed (paid) project."""
    paid_date = invoice.get("paid_date") or ""
    try:
        formatted = datetime.strptime(str(paid_date)[:10], "%Y-%m-%d").strftime("%B %Y")
    except ValueError:
        formatted = datetime.now().strftime("%B %Y")
    description = (project_description or str(invoice.get("notes") or "")).strip()

    prompt = f"""You are a professional LinkedIn ghostwriter for Indian freelancers.
Generate a compelling LinkedIn post based on:
Freelancer: {settings.owner_name}
Client: {invoice.get('client_name')}
Amount: ₹{invoice.get('amount') or 'N/A'}
Project description: {description or str(invoice.get('client_name')) + ' project'}
Completion date: {formatted}

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
- Always make it sound specific, not generic

Return ONLY the post text, nothing else."""

    return await _chat(
        "You are a professional LinkedIn content writer. Write engaging, "
        "authentic posts. Never use markdown formatting in the post.",
        prompt,
    )

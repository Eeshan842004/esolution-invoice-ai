"""Gemini 2.0 Flash via the REST API (same key the website's gemini.js uses).

Called with plain httpx instead of the google-generativeai SDK to keep the
dependency surface small; the prompt is a port of generateLegalNotice().
"""

from __future__ import annotations

import httpx

from src.config import settings

GEMINI_URL = ("https://generativelanguage.googleapis.com/v1beta/models/"
              "gemini-2.0-flash:generateContent")


async def _generate(prompt: str) -> str:
    if not settings.gemini_api_key:
        raise RuntimeError("GEMINI_API_KEY is not configured")
    async with httpx.AsyncClient(timeout=60.0) as client:
        resp = await client.post(
            GEMINI_URL,
            params={"key": settings.gemini_api_key},
            json={"contents": [{"parts": [{"text": prompt}]}]},
        )
        resp.raise_for_status()
        data = resp.json()
    return data["candidates"][0]["content"]["parts"][0]["text"].strip()


async def generate_legal_notice(invoice: dict, freelancer_name: str,
                                freelancer_email: str) -> str:
    """Draft a formal demand letter — same prompt as gemini.js."""
    prompt = f"""Generate a professional legal demand letter for an overdue payment.

Freelancer: {freelancer_name} ({freelancer_email})
Client: {invoice.get('client_name')} ({invoice.get('client_email')})
Invoice ID: {invoice.get('invoice_id')}
Original Amount: ₹{invoice.get('amount')}
Penalty: ₹{invoice.get('penalty_amount') or 0}
Total Due: ₹{invoice.get('total_amount_due') or invoice.get('amount')}
Due Date: {invoice.get('due_date')}
Days Overdue: {invoice.get('days_overdue')}

Write a formal legal demand letter in plain text. Include:
1. Reference to the original invoice
2. Total amount including penalties
3. Demand for immediate payment within 7 days
4. Notice of potential legal proceedings
5. Professional but firm tone

Do NOT use markdown formatting. Write in plain text only."""
    return await _generate(prompt)

"""Document tools (scope: document:read): LinkedIn posts and certificates."""

import re

from fastmcp import FastMCP

from src.config import settings
from src.sheets.invoice_model import get_invoice_by_id
from src.services import groq_service
from src.security.input_validator import (
    sanitize_string,
    validate_invoice_id,
)


def register_document_tools(mcp: FastMCP) -> None:

    @mcp.tool()
    async def generate_linkedin_post(invoice_id: str,
                                     project_description: str = "") -> dict:
        """Write a LinkedIn post celebrating a completed (PAID) project.

        Uses Groq Llama 3.3 to draft a 150-180 word post with hashtags.
        Only works for paid invoices — never announce unpaid work.

        Args:
            invoice_id: e.g. "inv_1726123456_a3f9c".
            project_description: What was delivered (falls back to the
                invoice notes when omitted).

        Returns:
            {post_text, hashtags}
        """
        invoice_id = validate_invoice_id(invoice_id)
        invoice = get_invoice_by_id(invoice_id)
        if invoice is None:
            return {"error": f"Invoice {invoice_id} not found"}
        if invoice["status"] != "Paid":
            return {"error": f"Invoice {invoice_id} is {invoice['status']} — "
                             "LinkedIn posts are only generated for paid projects"}

        description = sanitize_string(project_description, 500)
        post_text = await groq_service.generate_linkedin_post(invoice, description)
        hashtags = re.findall(r"#\w+", post_text)
        return {"post_text": post_text, "hashtags": hashtags}

    @mcp.tool()
    async def get_certificate_status(invoice_id: str) -> dict:
        """Check whether a completion certificate exists for an invoice.

        Args:
            invoice_id: e.g. "inv_1726123456_a3f9c".

        Returns:
            {exists, certificate_id, download_url} — the URL serves the
            certificate from the ESolution site (PNG by default,
            &format=pdf for PDF).
        """
        invoice_id = validate_invoice_id(invoice_id)
        invoice = get_invoice_by_id(invoice_id)
        if invoice is None:
            return {"error": f"Invoice {invoice_id} not found"}

        certificate_id = str(invoice.get("certificate_id") or "").strip()
        base = settings.next_public_base_url
        if certificate_id:
            return {
                "exists": True,
                "certificate_id": certificate_id,
                "download_url": f"{base}/api/certificate/generate?id={invoice_id}",
            }
        return {
            "exists": False,
            "certificate_id": None,
            "invoice_status": invoice["status"],
            "hint": (f"Generate one at {base}/api/certificate/generate?id={invoice_id}"
                     if invoice["status"] == "Paid"
                     else "Certificates are issued after the invoice is paid."),
        }

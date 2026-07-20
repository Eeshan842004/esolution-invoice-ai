import { NextResponse } from "next/server";
import { getInvoiceById, updateInvoiceField } from "@/lib/sheets";
import { generateCertificate } from "@/lib/certificate-generator";

/**
 * GET /api/certificate/generate?id=inv_123&format=png|pdf
 * Generates a work completion certificate for a paid invoice.
 * Returns the certificate as PNG (default) or PDF.
 */
export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const invoiceId = searchParams.get("id");
        const format = searchParams.get("format") || "png";

        if (!invoiceId) {
            return NextResponse.json(
                { error: "Invoice ID is required. Use ?id=inv_xxx" },
                { status: 400 }
            );
        }

        const invoice = await getInvoiceById(invoiceId);
        if (!invoice) {
            return NextResponse.json(
                { error: "Invoice not found" },
                { status: 404 }
            );
        }

        if (invoice.status !== "Paid") {
            return NextResponse.json(
                { error: "Certificate can only be generated for paid invoices" },
                { status: 400 }
            );
        }

        console.log(`🏆 [Certificate] Generating for ${invoiceId}...`);
        const { pdfBuffer, pngBuffer, certId } = await generateCertificate(invoice);
        console.log(`✅ [Certificate] Generated: ${certId}`);

        // Save cert ID to sheet (non-blocking)
        updateInvoiceField(invoiceId, { certificate_id: certId }).catch((e) =>
            console.warn("Certificate ID save failed:", e.message)
        );

        if (format === "pdf") {
            return new Response(pdfBuffer, {
                headers: {
                    "Content-Type": "application/pdf",
                    "Content-Disposition": `inline; filename="${certId}.pdf"`,
                    "Content-Length": pdfBuffer.length.toString(),
                },
            });
        }

        // Default: PNG
        return new Response(pngBuffer, {
            headers: {
                "Content-Type": "image/png",
                "Content-Disposition": `inline; filename="${certId}.png"`,
                "Content-Length": pngBuffer.length.toString(),
            },
        });
    } catch (error) {
        console.error("❌ [Certificate] Generation error:", error);
        return NextResponse.json(
            { error: "Failed to generate certificate", detail: error.message },
            { status: 500 }
        );
    }
}

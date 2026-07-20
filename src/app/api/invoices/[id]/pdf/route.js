import { NextResponse } from "next/server";
import { getInvoiceById } from "@/lib/sheets";
import { generateInvoicePDF } from "@/lib/pdf-generator";

/**
 * GET /api/invoices/[id]/pdf — Generate and stream a PDF invoice
 */
export async function GET(request, { params }) {
    try {
        const { id } = await params;
        const invoice = await getInvoiceById(id);

        if (!invoice) {
            return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
        }

        console.log(`📄 [PDF] Generating PDF for invoice: ${id}`);
        const pdfBuffer = await generateInvoicePDF(invoice);
        console.log(`✅ [PDF] Generated (${pdfBuffer.length} bytes)`);

        return new Response(pdfBuffer, {
            headers: {
                "Content-Type": "application/pdf",
                "Content-Disposition": `inline; filename="${id}.pdf"`,
                "Content-Length": pdfBuffer.length.toString(),
            },
        });
    } catch (error) {
        console.error("PDF generation error:", error);
        return NextResponse.json(
            { error: "Failed to generate PDF", detail: error.message },
            { status: 500 }
        );
    }
}

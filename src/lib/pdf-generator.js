import puppeteer from "puppeteer";

/**
 * Generate a professional PDF invoice buffer from invoice data.
 * Returns a Buffer containing the PDF.
 */
export async function generateInvoicePDF(invoice) {
  const ownerName = process.env.OWNER_NAME || "ESolution";
  const ownerAddress = process.env.OWNER_ADDRESS || "";
  const ownerCity = process.env.OWNER_CITY || "";
  const ownerGSTIN = process.env.OWNER_GSTIN || "";
  const ownerEmail = process.env.OWNER_EMAIL || "";
  const ownerUPI = process.env.OWNER_UPI_ID || "";
  const ownerBank = process.env.OWNER_BANK_ACCOUNT || "";
  const ownerIFSC = process.env.OWNER_BANK_IFSC || "";

  const amount = parseFloat(invoice.amount) || 0;
  const disc = parseFloat(invoice.discount_percentage) || parseFloat(invoice.discount_percent) || 0;
  const discountAmount = Math.round(amount * disc / 100 * 100) / 100;
  const subtotal = amount;
  const afterDiscount = subtotal - discountAmount;
  const finalAmount = parseFloat(invoice.discounted_amount) || parseFloat(invoice.final_amount) || afterDiscount;
  const createdAt = invoice.created_at
    ? new Date(invoice.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
    : new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  const dueDate = invoice.due_date || "";

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; color: #333; background: #fff; }
  .page { width: 794px; min-height: 1100px; padding: 0; position: relative; }

  /* Header */
  .header { background: #1a3b7d; color: white; padding: 40px 50px; display: flex; justify-content: space-between; align-items: flex-start; }
  .header-left h1 { font-size: 42px; font-weight: 300; letter-spacing: 6px; text-transform: uppercase; }
  .header-right { text-align: right; font-size: 13px; line-height: 1.6; }
  .header-right .company-name { font-size: 18px; font-weight: 700; margin-bottom: 4px; }

  /* Balance Due Bar */
  .balance-bar { background: #2563eb; color: white; padding: 14px 50px; text-align: right; font-size: 16px; font-weight: 600; letter-spacing: 1px; }
  .balance-bar span { font-size: 22px; margin-left: 12px; }

  /* Info Section */
  .info-section { display: flex; justify-content: space-between; padding: 35px 50px 20px; }
  .bill-to { max-width: 300px; }
  .bill-to h3 { color: #1a3b7d; font-size: 11px; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 8px; }
  .bill-to .client-name { font-size: 20px; font-weight: 700; margin-bottom: 4px; }
  .bill-to p { font-size: 13px; color: #555; line-height: 1.5; }
  .invoice-meta { text-align: right; }
  .invoice-meta table { border-collapse: collapse; }
  .invoice-meta td { padding: 4px 0; font-size: 13px; }
  .invoice-meta td:first-child { color: #888; padding-right: 20px; }
  .invoice-meta td:last-child { font-weight: 600; }

  /* Items Table */
  .items-section { padding: 20px 50px; }
  .items-table { width: 100%; border-collapse: collapse; }
  .items-table thead { background: #f0f4f8; }
  .items-table th { padding: 12px 16px; text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #555; border-bottom: 2px solid #ddd; }
  .items-table th:last-child { text-align: right; }
  .items-table td { padding: 16px; font-size: 14px; border-bottom: 1px solid #eee; vertical-align: top; }
  .items-table td:first-child { width: 40px; color: #999; }
  .items-table td:last-child { text-align: right; font-weight: 600; white-space: nowrap; }
  .item-name { font-weight: 600; }
  .item-desc { color: #888; font-size: 12px; margin-top: 2px; }

  /* Totals */
  .totals-section { display: flex; justify-content: space-between; padding: 20px 50px 30px; align-items: flex-end; }
  .thanks { font-size: 14px; color: #888; font-style: italic; max-width: 250px; }
  .totals-table { min-width: 280px; }
  .totals-table table { width: 100%; border-collapse: collapse; }
  .totals-table td { padding: 6px 0; font-size: 14px; }
  .totals-table td:first-child { color: #666; }
  .totals-table td:last-child { text-align: right; font-weight: 600; }
  .totals-table .total-row td { font-size: 16px; font-weight: 700; padding-top: 10px; border-top: 1px solid #ddd; }
  .balance-due-row { background: #e8f0fe; }
  .balance-due-row td { padding: 12px 8px !important; font-size: 18px !important; color: #1a3b7d; font-weight: 800 !important; }

  /* Footer */
  .footer { position: absolute; bottom: 0; left: 0; right: 0; padding: 30px 50px; border-top: 1px solid #eee; }
  .footer h4 { font-size: 12px; text-transform: uppercase; letter-spacing: 1px; color: #1a3b7d; margin-bottom: 6px; }
  .footer p { font-size: 11px; color: #888; line-height: 1.6; }

  /* Payment Section */
  .payment-section { padding: 10px 50px 20px; }
  .payment-section h4 { font-size: 12px; text-transform: uppercase; letter-spacing: 1px; color: #1a3b7d; margin-bottom: 8px; }
  .payment-row { display: flex; gap: 24px; font-size: 13px; color: #555; }
  .payment-row strong { color: #333; }
</style>
</head>
<body>
<div class="page">
  <!-- Header -->
  <div class="header">
    <div class="header-left"><h1>INVOICE</h1></div>
    <div class="header-right">
      <div class="company-name">${ownerName}</div>
      ${ownerAddress ? `<div>${ownerAddress}</div>` : ""}
      ${ownerCity ? `<div>${ownerCity}</div>` : ""}
      ${ownerGSTIN ? `<div>GSTIN: ${ownerGSTIN}</div>` : ""}
      ${ownerEmail ? `<div>${ownerEmail}</div>` : ""}
    </div>
  </div>

  <!-- Balance Due Bar -->
  <div class="balance-bar">
    BALANCE DUE <span>₹${finalAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
  </div>

  <!-- Info Section -->
  <div class="info-section">
    <div class="bill-to">
      <h3>Bill To</h3>
      <div class="client-name">${invoice.client_name}</div>
      <p>${invoice.client_email}</p>
    </div>
    <div class="invoice-meta">
      <table>
        <tr><td>Invoice #</td><td>${invoice.invoice_id}</td></tr>
        <tr><td>Invoice Date</td><td>${createdAt}</td></tr>
        <tr><td>Terms</td><td>Due on Receipt</td></tr>
        <tr><td>Due Date</td><td>${dueDate}</td></tr>
      </table>
    </div>
  </div>

  <!-- Items Table -->
  <div class="items-section">
    <table class="items-table">
      <thead><tr><th>#</th><th>Item & Description</th><th>Amount</th></tr></thead>
      <tbody>
        <tr>
          <td>1</td>
          <td>
            <div class="item-name">Professional Services</div>
            <div class="item-desc">${invoice.notes || "As per agreement"}</div>
          </td>
          <td>₹${amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
        </tr>
      </tbody>
    </table>
  </div>

  <!-- Totals -->
  <div class="totals-section">
    <div class="thanks">Thanks for your business.</div>
    <div class="totals-table">
      <table>
        <tr><td>Sub Total</td><td>₹${subtotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td></tr>
        ${disc > 0 ? `<tr><td>Discount (${disc}%)</td><td>-₹${discountAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td></tr>` : ""}
        <tr class="total-row"><td>Total</td><td>₹${finalAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td></tr>
        <tr class="balance-due-row"><td>Balance Due</td><td>₹${finalAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td></tr>
      </table>
    </div>
  </div>

  <!-- Payment Details -->
  <div class="payment-section">
    <h4>Payment Details</h4>
    <div class="payment-row">
      ${ownerUPI ? `<div>UPI: <strong>${ownerUPI}</strong></div>` : ""}
      ${ownerBank ? `<div>Bank A/C: <strong>${ownerBank}</strong></div>` : ""}
      ${ownerIFSC ? `<div>IFSC: <strong>${ownerIFSC}</strong></div>` : ""}
    </div>
  </div>

  <!-- Footer -->
  <div class="footer">
    <h4>Terms & Conditions</h4>
    <p>Full payment is due upon receipt of this invoice. Late payments may incur additional charges or interest as per the applicable laws. Please make payment via UPI or bank transfer using the details above.</p>
  </div>
</div>
</body>
</html>`;

  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });
    const pdfBuffer = await page.pdf({
      width: "794px",
      height: "1123px",
      printBackground: true,
      margin: { top: 0, bottom: 0, left: 0, right: 0 },
    });
    return Buffer.from(pdfBuffer);
  } finally {
    await browser.close();
  }
}

import { sendEmail } from "./email.js";

/**
 * Send an enhanced invoice email to the client with portal link and PDF attachment.
 * @param {object} invoice - Invoice row data
 * @param {string} portalUrl - Magic link URL to the client portal
 * @param {Buffer|null} pdfBuffer - PDF invoice buffer (attached if provided)
 */
export async function sendPortalInvoiceEmail(invoice, portalUrl, pdfBuffer = null) {
  const ownerName = process.env.OWNER_NAME || "ESolution";
  const ownerUPI = process.env.OWNER_UPI_ID || "";
  const ownerBank = process.env.OWNER_BANK_ACCOUNT || "";
  const ownerIFSC = process.env.OWNER_BANK_IFSC || "";
  const ownerEmail = process.env.OWNER_EMAIL || "";

  const amount = parseFloat(invoice.amount) || 0;
  const finalAmount = parseFloat(invoice.discounted_amount || invoice.final_amount) || amount;
  const disc = parseFloat(invoice.discount_percentage || invoice.discount_percent) || 0;

  const subject = `Invoice ₹${finalAmount.toLocaleString("en-IN")} from ${ownerName} — Due ${invoice.due_date}`;

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; padding: 0; }
    @media only screen and (max-width: 600px) {
      .container { width: 100% !important; }
      .invoice-table td {
        font-size: 12px !important;
        padding: 10px 12px !important;
      }
      .cta-button {
        font-size: 14px !important;
        padding: 12px !important;
      }
    }
  </style>
</head>
<body style="font-family:'Segoe UI',Arial,sans-serif;background:#f0f2f5;padding:0;margin:0;">
  <div class="container" style="width:100%;max-width:600px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

    <!-- Header -->
    <div style="background:#6366f1;padding:24px 20px;text-align:center;width:100%;">
      <h1 style="color:white;margin:0;font-size:28px;font-weight:700;word-wrap:break-word;">ESolution</h1>
      <p style="color:rgba(255,255,255,0.8);margin:4px 0 0;font-size:14px;">Invoice & Payment System</p>
    </div>

    <!-- Body -->
    <div style="padding:24px 20px;background:#ffffff;">
      <p style="font-size:16px;color:#111;margin:0 0 8px 0;word-wrap:break-word;">Hi <strong>${invoice.client_name}</strong>,</p>
      <p style="color:#666;line-height:1.6;font-size:14px;margin:0 0 20px 0;word-wrap:break-word;">Please find your invoice details below. You can view the full invoice and make your payment securely through our portal.</p>

      <!-- Invoice Summary Card -->
      <table class="invoice-table" style="width:100%;border-collapse:collapse;background:#f9f9f9;border-radius:8px;overflow:hidden;max-width:100%;">
        <tr style="border-bottom:1px solid #eee;">
          <td style="width:45%;font-size:13px;color:#888;padding:12px 16px;">Invoice Number</td>
          <td style="width:55%;font-size:13px;color:#111;font-weight:500;text-align:right;padding:12px 16px;word-wrap:break-word;word-break:break-all;">${invoice.invoice_id}</td>
        </tr>
        <tr style="border-bottom:1px solid #eee;">
          <td style="width:45%;font-size:13px;color:#888;padding:12px 16px;">Amount</td>
          <td style="width:55%;font-size:13px;color:#111;font-weight:500;text-align:right;padding:12px 16px;">₹${amount.toLocaleString("en-IN")}</td>
        </tr>
        ${disc > 0 ? `<tr style="border-bottom:1px solid #eee;">
          <td style="width:45%;font-size:13px;color:#888;padding:12px 16px;">Discount</td>
          <td style="width:55%;font-size:13px;color:#16a34a;font-weight:500;text-align:right;padding:12px 16px;">-${disc}%</td>
        </tr>` : ""}
        <tr style="border-bottom:1px solid #eee;">
          <td style="width:45%;font-size:13px;color:#888;padding:12px 16px;">Due Date</td>
          <td style="width:55%;font-size:13px;color:#dc2626;font-weight:500;text-align:right;padding:12px 16px;">${invoice.due_date}</td>
        </tr>
        <tr style="background:#f0f0ff;">
          <td style="width:45%;font-size:15px;color:#6366f1;font-weight:700;padding:12px 16px;">Balance Due</td>
          <td style="width:55%;font-size:15px;color:#6366f1;font-weight:700;text-align:right;padding:12px 16px;">₹${finalAmount.toLocaleString("en-IN")}</td>
        </tr>
      </table>

      <!-- CTA Button -->
      <a href="${portalUrl}" class="cta-button" style="display:block;width:100%;max-width:100%;background:#6366f1;color:white;text-align:center;padding:14px 20px;border-radius:8px;font-size:15px;font-weight:600;text-decoration:none;margin:20px 0;box-sizing:border-box;">
        View Invoice & Pay Online →
      </a>

      <!-- Payment Methods -->
      <div style="border-top:1px solid #eee;padding-top:20px;">
        <p style="font-size:12px;text-transform:uppercase;color:#888;letter-spacing:1px;margin:0 0 12px 0;">Quick Payment Options</p>
        ${ownerUPI ? `<div style="padding:16px 20px;background:#f9f9f9;border-radius:8px;margin:0 0 10px 0;max-width:100%;">
          <p style="font-size:12px;text-transform:uppercase;color:#888;margin:0 0 4px 0;">📱 UPI</p>
          <p style="font-size:14px;font-weight:700;color:#111;margin:0;word-break:break-all;">${ownerUPI}</p>
        </div>` : ""}
        ${ownerBank ? `<div style="padding:16px 20px;background:#f9f9f9;border-radius:8px;margin:0 0 10px 0;max-width:100%;">
          <p style="font-size:12px;text-transform:uppercase;color:#888;margin:0 0 4px 0;">🏦 Bank Transfer</p>
          <p style="font-size:13px;color:#666;line-height:1.8;margin:0;word-break:break-all;">A/C: <strong>${ownerBank}</strong><br>IFSC: <strong>${ownerIFSC}</strong></p>
        </div>` : ""}
      </div>

      <p style="color:#888;margin:16px 0 0;font-size:13px;line-height:1.6;word-wrap:break-word;">Once payment is made, please click "I have paid" on the invoice portal or share the transaction reference with us.</p>
      <p style="color:#111;font-weight:600;margin:16px 0 0;font-size:14px;">Best regards,<br>${ownerName}<br><span style="color:#888;font-weight:400;font-size:13px;">${ownerEmail}</span></p>
    </div>

    <!-- Footer -->
    <div style="padding:20px;text-align:center;font-size:12px;color:#aaa;border-top:1px solid #eee;">
      ESolution Invoice System — Powered by AI<br>
      Questions? Reply to this email.
    </div>
  </div>
</body>
</html>`;

  const text = `Hi ${invoice.client_name},\n\nInvoice ${invoice.invoice_id} for ₹${finalAmount} is due on ${invoice.due_date}.\n\nView & Pay: ${portalUrl}\n\nUPI: ${ownerUPI}\nBank: ${ownerBank}, IFSC: ${ownerIFSC}\n\nBest regards,\n${ownerName}`;

  const emailOpts = {
    to: invoice.client_email,
    subject,
    html,
    text,
  };

  // If PDF buffer is provided, attach it
  if (pdfBuffer) {
    emailOpts.attachments = [
      {
        filename: `${invoice.invoice_id}.pdf`,
        content: pdfBuffer,
        contentType: "application/pdf",
      },
    ];
  }

  return sendEmail(emailOpts);
}

/**
 * Send notification to owner when client performs an action on the portal.
 */
export async function sendOwnerNotification({ type, invoice, message = "" }) {
  const ownerEmail = process.env.OWNER_EMAIL || process.env.GMAIL_USER;
  if (!ownerEmail) return { success: false, error: "No owner email configured" };

  const titles = {
    payment_claimed: "💰 Payment Claimed",
    partial_payment: "📊 Partial Payment Proposed",
    installment: "📋 Installment Plan Requested",
    dispute: "⚠️ Client Dispute",
  };

  const subject = `${titles[type] || "Portal Update"} — Invoice ${invoice.invoice_id} (${invoice.client_name})`;

  const html = `<div style="font-family:Arial;max-width:500px;margin:auto;padding:24px;">
      <h2 style="color:#1a3b7d;">${titles[type] || "Portal Update"}</h2>
      <p><strong>Invoice:</strong> ${invoice.invoice_id}</p>
      <p><strong>Client:</strong> ${invoice.client_name} (${invoice.client_email})</p>
      <p><strong>Amount:</strong> ₹${invoice.amount}</p>
      ${message ? `<p><strong>Message:</strong> ${message}</p>` : ""}
      <p style="color:#888;margin-top:20px;">Check your ESolution dashboard for details.</p>
    </div>`;

  return sendEmail({ to: ownerEmail, subject, html, text: subject });
}

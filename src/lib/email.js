import nodemailer from "nodemailer";

/**
 * Create a Gmail transporter using App Password or OAuth2.
 * Uses GMAIL_USER + GMAIL_APP_PASSWORD env vars.
 */
function createTransporter() {
  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.GMAIL_USER || process.env.OWNER_EMAIL,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  });
}

/**
 * Send a real email via Gmail (nodemailer).
 * Returns { success, messageId } or { success: false, error }
 */
export async function sendEmail({ to, subject, html, text, attachments }) {
  try {
    const transporter = createTransporter();
    const info = await transporter.sendMail({
      from: `"ESolution Invoice" <${process.env.GMAIL_USER || process.env.OWNER_EMAIL}>`,
      to,
      subject,
      text,
      html,
      attachments,
    });
    console.log("Email sent:", info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (err) {
    console.error("Email send error:", err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Shared mobile-responsive email wrapper.
 * Wraps content in a fully responsive HTML shell with viewport meta, media queries, and box-sizing.
 */
function mobileEmailWrapper(bodyContent, headerBg = "#6366f1", headerTitle = "ESolution", headerSubtitle = "Invoice & Payment System") {
  return `<!DOCTYPE html>
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
<body style="font-family:Arial,sans-serif;background:#f4f4f4;padding:0;margin:0;">
  <div class="container" style="width:100%;max-width:600px;margin:0 auto;background:#ffffff;">

    <!-- Header -->
    <div style="background:${headerBg};padding:24px 20px;text-align:center;width:100%;">
      <h1 style="color:white;margin:0;font-size:28px;font-weight:700;word-wrap:break-word;">${headerTitle}</h1>
      <p style="color:rgba(255,255,255,0.8);margin:4px 0 0;font-size:14px;">${headerSubtitle}</p>
    </div>

    <!-- Body -->
    <div style="padding:24px 20px;background:#ffffff;">
      ${bodyContent}
    </div>

    <!-- Footer -->
    <div style="padding:20px;text-align:center;font-size:12px;color:#aaa;border-top:1px solid #eee;">
      ESolution Invoice System — Powered by AI
    </div>
  </div>
</body>
</html>`;
}

/**
 * Generate payment email content (HTML & Text)
 */
export function generatePaymentEmail(invoice) {
  const ownerName = process.env.OWNER_NAME || "ESolution";
  const ownerUPI = process.env.OWNER_UPI_ID || "";
  const ownerBank = process.env.OWNER_BANK_ACCOUNT || "";
  const ownerIFSC = process.env.OWNER_BANK_IFSC || "";
  const ownerEmail = process.env.OWNER_EMAIL || "";

  const disc = parseFloat(invoice.discount_percentage || invoice.discount_percent) || 0;
  const finalAmount = invoice.final_amount || invoice.discounted_amount || invoice.amount;

  const subject = `Payment Request — Invoice ${invoice.invoice_id} (₹${finalAmount})`;

  const bodyContent = `
      <p style="font-size:16px;color:#111;margin:0 0 8px 0;word-wrap:break-word;">Dear <strong>${invoice.client_name}</strong>,</p>
      <p style="color:#666;line-height:1.6;font-size:14px;margin:0 0 20px 0;word-wrap:break-word;">I hope this message finds you well. Please find the payment details for the following invoice:</p>

      <!-- Invoice Details Table -->
      <table class="invoice-table" style="width:100%;border-collapse:collapse;background:#f9f9f9;border-radius:8px;overflow:hidden;max-width:100%;">
        <tr style="border-bottom:1px solid #eee;">
          <td style="width:45%;font-size:13px;color:#888;padding:12px 16px;">Invoice ID</td>
          <td style="width:55%;font-size:13px;color:#111;font-weight:500;text-align:right;padding:12px 16px;word-break:break-all;">${invoice.invoice_id}</td>
        </tr>
        <tr style="border-bottom:1px solid #eee;">
          <td style="width:45%;font-size:13px;color:#888;padding:12px 16px;">Amount</td>
          <td style="width:55%;font-size:13px;color:#111;font-weight:500;text-align:right;padding:12px 16px;">₹${invoice.amount}</td>
        </tr>
        ${disc > 0 ? `<tr style="border-bottom:1px solid #eee;">
          <td style="width:45%;font-size:13px;color:#888;padding:12px 16px;">Discount</td>
          <td style="width:55%;font-size:13px;color:#16a34a;font-weight:500;text-align:right;padding:12px 16px;">-${disc}% (₹${(invoice.amount - finalAmount).toFixed(2)})</td>
        </tr>` : ""}
        <tr style="border-bottom:1px solid #eee;">
          <td style="width:45%;font-size:13px;color:#888;padding:12px 16px;">Final Amount</td>
          <td style="width:55%;font-size:13px;color:#6366f1;font-weight:700;text-align:right;padding:12px 16px;">₹${finalAmount}</td>
        </tr>
        <tr style="border-bottom:1px solid #eee;">
          <td style="width:45%;font-size:13px;color:#888;padding:12px 16px;">Due Date</td>
          <td style="width:55%;font-size:13px;color:#dc2626;font-weight:500;text-align:right;padding:12px 16px;">${invoice.due_date}</td>
        </tr>
        ${invoice.notes ? `<tr style="border-bottom:1px solid #eee;">
          <td style="width:45%;font-size:13px;color:#888;padding:12px 16px;">Notes</td>
          <td style="width:55%;font-size:13px;color:#666;font-weight:500;text-align:right;padding:12px 16px;word-wrap:break-word;">${invoice.notes}</td>
        </tr>` : ""}
      </table>

      <!-- Payment Methods -->
      <div style="padding:16px 20px;background:#f9f9f9;border-radius:8px;margin:16px 0;max-width:100%;">
        <p style="font-size:12px;text-transform:uppercase;color:#888;margin:0 0 8px 0;">📱 UPI Payment</p>
        <p style="font-size:14px;font-weight:700;color:#111;margin:0;word-break:break-all;">${ownerUPI}</p>
      </div>
      ${ownerBank ? `<div style="padding:16px 20px;background:#f9f9f9;border-radius:8px;margin:0 0 16px 0;max-width:100%;">
        <p style="font-size:12px;text-transform:uppercase;color:#888;margin:0 0 8px 0;">🏦 Bank Transfer</p>
        <p style="font-size:13px;color:#666;line-height:1.8;margin:0;word-break:break-all;">Account: <strong>${ownerBank}</strong><br>IFSC: <strong>${ownerIFSC}</strong></p>
      </div>` : ""}

      <p style="color:#666;font-size:14px;line-height:1.6;margin:16px 0;word-wrap:break-word;">Once payment is made, please share the transaction reference so we can mark it as received.</p>
      <p style="color:#666;font-size:14px;margin:0 0 16px 0;">Thank you for your prompt attention!</p>
      <p style="color:#111;font-weight:600;font-size:14px;margin:0;">Best regards,<br>${ownerName}<br><span style="color:#888;font-weight:400;font-size:13px;">${ownerEmail}</span></p>`;

  const html = mobileEmailWrapper(bodyContent);

  const text = `Dear ${invoice.client_name},\n\nInvoice ${invoice.invoice_id} for ₹${finalAmount} is due on ${invoice.due_date}.\n\nPayment:\nUPI: ${ownerUPI}\nBank: ${ownerBank}, IFSC: ${ownerIFSC}\n\nBest regards,\n${ownerName}`;

  return { subject, html, text, to: invoice.client_email };
}

/**
 * Generate and send the initial payment request email to client
 */
export async function sendPaymentRequestEmail(invoice) {
  const emailData = generatePaymentEmail(invoice);
  return sendEmail(emailData);
}

/**
 * Send a reminder email for an overdue invoice
 * Tiers: 1-6 (Gentle), 7-13 (Firm), 14-29 (Urgent), 30+ (Legal Warning)
 */
export async function sendReminderEmail(invoice) {
  const ownerName = process.env.OWNER_NAME || "ESolution";
  const ownerUPI = process.env.OWNER_UPI_ID || "";
  const daysOverdue = parseInt(invoice.days_overdue) || 0;
  const totalAmountDue = invoice.total_amount_due || invoice.amount;
  const penaltyAmount = invoice.penalty_amount || 0;

  let subject = "";
  let heading = "";
  let messageBody = "";
  let headerBg = "";
  let tone = "";

  if (daysOverdue >= 30) {
    subject = `FINAL NOTICE: Legal Action Imminent - Invoice ${invoice.invoice_id}`;
    heading = "⚖️ FINAL LEGAL NOTICE";
    messageBody = `This is a final notice regarding Invoice <strong>${invoice.invoice_id}</strong>. Payment is now <strong style="color:red;">${daysOverdue} days overdue</strong>.<br><br>Failure to pay <strong>₹${totalAmountDue}</strong> immediately will result in legal action.`;
    headerBg = "#7f1d1d";
    tone = "Legal";
  } else if (daysOverdue >= 14) {
    subject = `URGENT: Payment Overdue - Invoice ${invoice.invoice_id}`;
    heading = "⚠️ ACTION REQUIRED";
    messageBody = `Your payment for Invoice <strong>${invoice.invoice_id}</strong> is significantly overdue (${daysOverdue} days).<br><br>Total due with penalty: <strong>₹${totalAmountDue}</strong>. Please prioritize this payment to avoid further escalation.`;
    headerBg = "#dc2626";
    tone = "Urgent";
  } else if (daysOverdue >= 7) {
    subject = `Payment Overdue - Invoice ${invoice.invoice_id}`;
    heading = "❗ Payment Reminder";
    messageBody = `We noticed that payment for Invoice <strong>${invoice.invoice_id}</strong> is now ${daysOverdue} days overdue.<br><br>Please clear the outstanding amount of <strong>₹${totalAmountDue}</strong> at your earliest convenience.`;
    headerBg = "#ea580c";
    tone = "Firm";
  } else {
    subject = `Friendly Reminder - Invoice ${invoice.invoice_id}`;
    heading = "📅 Payment Reminder";
    messageBody = `Just a friendly reminder that Invoice <strong>${invoice.invoice_id}</strong> was due on ${invoice.due_date}.<br><br>If you have already sent the payment, please ignore this email.`;
    headerBg = "#2563eb";
    tone = "Gentle";
  }

  const bodyContent = `
      <p style="font-size:16px;color:#111;margin:0 0 8px 0;word-wrap:break-word;">Dear <strong>${invoice.client_name}</strong>,</p>
      <p style="font-size:14px;color:#666;line-height:1.6;margin:0 0 16px 0;word-wrap:break-word;">${messageBody}</p>
      
      <!-- Amount Summary -->
      <table class="invoice-table" style="width:100%;border-collapse:collapse;background:#f9f9f9;border-radius:8px;overflow:hidden;max-width:100%;">
        <tr style="border-bottom:1px solid #eee;">
          <td style="width:45%;font-size:13px;color:#888;padding:12px 16px;">Original Amount</td>
          <td style="width:55%;font-size:13px;color:#111;font-weight:500;text-align:right;padding:12px 16px;">₹${invoice.amount}</td>
        </tr>
        ${penaltyAmount > 0 ? `<tr style="border-bottom:1px solid #eee;">
          <td style="width:45%;font-size:13px;color:#d32f2f;padding:12px 16px;">Late Penalty</td>
          <td style="width:55%;font-size:13px;color:#d32f2f;font-weight:500;text-align:right;padding:12px 16px;">+ ₹${penaltyAmount}</td>
        </tr>` : ""}
        <tr style="background:#f0f0ff;">
          <td style="width:45%;font-size:15px;color:#6366f1;font-weight:700;padding:12px 16px;">Total Due</td>
          <td style="width:55%;font-size:15px;color:#6366f1;font-weight:700;text-align:right;padding:12px 16px;">₹${totalAmountDue}</td>
        </tr>
      </table>

      <div style="padding:16px 20px;background:#f9f9f9;border-radius:8px;margin:16px 0;max-width:100%;">
        <p style="font-size:12px;text-transform:uppercase;color:#888;margin:0 0 4px 0;">📱 UPI Payment</p>
        <p style="font-size:14px;font-weight:700;color:#111;margin:0;word-break:break-all;">${ownerUPI}</p>
      </div>

      <p style="color:#888;font-size:12px;margin:8px 0 0 0;">Tone: ${tone} Reminder</p>
      <p style="color:#111;font-size:14px;margin:8px 0 0 0;">— ${ownerName}</p>`;

  const html = mobileEmailWrapper(bodyContent, headerBg, heading, "ESolution Invoice System");

  const text = `${heading}\n\nDear ${invoice.client_name},\n\n${messageBody.replace(/<br>/g, "\n").replace(/<strong>/g, "").replace(/<\/strong>/g, "")}\n\nTotal Due: ₹${totalAmountDue}\nUPI: ${ownerUPI}\n\n— ${ownerName}`;

  return sendEmail({ to: invoice.client_email, subject, html, text });
}

/**
 * Build a mailto: link as fallback
 */
export function buildMailtoLink({ to, subject, text }) {
  return `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`;
}

// ============================================
// TONE-BASED EMAIL TEMPLATES (Emotion-Driven)
// ============================================

/**
 * Send a tone-based reminder email based on emotion analysis.
 * @param {object} invoice - Invoice data from sheet
 * @param {string} tone - One of: friendly_hindi, formal_english, apologetic, firm
 * @returns {Promise<{success: boolean, messageId?: string, error?: string}>}
 */
export async function sendToneBasedReminder(invoice, tone) {
  const ownerName = process.env.OWNER_NAME || "ESolution";
  const ownerUPI = process.env.OWNER_UPI_ID || "";
  const amount = invoice.total_amount_due || invoice.amount;
  const name = invoice.client_name;
  const id = invoice.invoice_id;

  let subject = "";
  let bodyText = "";
  let headerBg = "#6366f1";
  let heading = "";

  switch (tone) {
    case "friendly_hindi":
      subject = `Hey ${name}! Bas ek reminder 🙏`;
      heading = "🙏 Friendly Reminder";
      bodyText = `Hey ${name}!\n\nKoi tension nahi yaar.\nJab bhi convenient ho kar dena.\nInvoice #${id} - ₹${amount}\n\nBas ek baar confirm kar do 😊`;
      headerBg = "#10b981";
      break;

    case "formal_english":
      subject = `Follow Up: Invoice #${id} - Payment Pending`;
      heading = "📋 Payment Follow-Up";
      bodyText = `Dear ${name},\n\nI hope this message finds you well.\nThis is a gentle follow-up regarding Invoice #${id} for ₹${amount}.\n\nKindly provide an estimated payment date.\nThank you for your continued partnership.`;
      headerBg = "#2563eb";
      break;

    case "apologetic":
      subject = `Sorry to bother you - Invoice #${id}`;
      heading = "🙏 Apology & Reminder";
      bodyText = `Hi ${name},\n\nI sincerely apologize if our reminders have felt excessive.\nWe completely trust you will handle Invoice #${id} - ₹${amount} when possible.\n\nWe will pause reminders for 7 days.\nThank you for your patience.`;
      headerBg = "#7c3aed";
      break;

    case "firm":
      subject = `URGENT: Invoice #${id} Requires Immediate Attention`;
      heading = "⚠️ URGENT: Payment Required";
      bodyText = `Dear ${name},\n\nInvoice #${id} for ₹${amount} is now seriously overdue.\nImmediate payment is required to avoid further escalation.\n\nPlease arrange payment today.\nUPI: ${ownerUPI}`;
      headerBg = "#dc2626";
      break;

    default:
      // Fall back to default reminder
      return sendReminderEmail(invoice);
  }

  const bodyContent = `
      <p style="white-space:pre-line;color:#666;line-height:1.8;font-size:14px;margin:0 0 16px 0;word-wrap:break-word;">${bodyText}</p>

      <table class="invoice-table" style="width:100%;border-collapse:collapse;background:#f9f9f9;border-radius:8px;overflow:hidden;max-width:100%;">
        <tr style="border-bottom:1px solid #eee;">
          <td style="width:45%;font-size:13px;color:#888;padding:12px 16px;">Invoice ID</td>
          <td style="width:55%;font-size:13px;color:#111;font-weight:500;text-align:right;padding:12px 16px;word-break:break-all;">${id}</td>
        </tr>
        <tr style="background:#f0f0ff;">
          <td style="width:45%;font-size:15px;color:#6366f1;font-weight:700;padding:12px 16px;">Amount Due</td>
          <td style="width:55%;font-size:15px;color:#6366f1;font-weight:700;text-align:right;padding:12px 16px;">₹${amount}</td>
        </tr>
      </table>

      <div style="padding:16px 20px;background:#f9f9f9;border-radius:8px;margin:16px 0;max-width:100%;">
        <p style="font-size:12px;text-transform:uppercase;color:#888;margin:0 0 4px 0;">📱 UPI Payment</p>
        <p style="font-size:14px;font-weight:700;color:#111;margin:0;word-break:break-all;">${ownerUPI}</p>
      </div>

      <p style="color:#888;font-size:11px;margin:8px 0 0 0;">Tone: ${tone} (AI-driven reminder)</p>
      <p style="color:#111;font-size:14px;margin:8px 0 0 0;">— ${ownerName}</p>`;

  const html = mobileEmailWrapper(bodyContent, headerBg, heading, "ESolution Invoice System");

  const text = `${heading}\n\n${bodyText}\n\nAmount Due: ₹${amount}\nUPI: ${ownerUPI}\n\n— ${ownerName}`;

  return sendEmail({ to: invoice.client_email, subject, html, text });
}

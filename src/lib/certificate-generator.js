import puppeteer from "puppeteer";
import { generateQR } from "@/lib/qr-generator";

/**
 * Generate a premium work completion certificate.
 * Returns { pdfBuffer, pngBuffer, certId }
 *
 * Design: Dark navy background, gold accents, QR code, digital seal
 */
export async function generateCertificate(invoice) {
    const ownerName = process.env.OWNER_NAME || "ESolution";
    const ownerEmail = process.env.OWNER_EMAIL || "";

    // Generate unique certificate ID
    const year = new Date().getFullYear();
    const randomChars = Math.random().toString(36).substring(2, 8).toUpperCase();
    const certId = `CERT-${year}-${randomChars}`;

    // Completion date
    const paidDate = invoice.paid_date
        ? new Date(invoice.paid_date)
        : new Date();
    const completionDate = paidDate.toLocaleDateString("en-IN", {
        month: "long",
        year: "numeric",
    });
    const fullDate = paidDate.toLocaleDateString("en-IN", {
        day: "numeric",
        month: "long",
        year: "numeric",
    });

    const amount = parseFloat(invoice.amount) || 0;
    const formattedAmount = amount.toLocaleString("en-IN");

    // Generate QR code for verification
    const verifyUrl = `${process.env.NEXTAUTH_URL || "http://localhost:3000"}/verify/${certId}`;
    let qrDataUrl = "";
    try {
        qrDataUrl = await generateQR(verifyUrl, 120);
    } catch (e) {
        console.warn("QR generation failed:", e.message);
    }

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<style>
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700;900&family=Inter:wght@300;400;500;600&display=swap');

  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Inter', sans-serif; background: #0f172a; }

  .certificate {
    width: 1000px;
    height: 700px;
    background: linear-gradient(145deg, #0f172a 0%, #1e293b 50%, #0f172a 100%);
    position: relative;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
  }

  /* Watermark */
  .watermark {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%) rotate(-30deg);
    font-family: 'Playfair Display', serif;
    font-size: 140px;
    font-weight: 900;
    color: rgba(245, 158, 11, 0.03);
    white-space: nowrap;
    pointer-events: none;
    letter-spacing: 20px;
  }

  /* Gold border */
  .border-outer {
    position: absolute;
    inset: 12px;
    border: 2px solid rgba(245, 158, 11, 0.4);
    border-radius: 4px;
  }
  .border-inner {
    position: absolute;
    inset: 20px;
    border: 1px solid rgba(245, 158, 11, 0.2);
    border-radius: 2px;
  }

  /* Corner ornaments */
  .corner { position: absolute; width: 40px; height: 40px; }
  .corner-tl { top: 16px; left: 16px; border-top: 3px solid #f59e0b; border-left: 3px solid #f59e0b; }
  .corner-tr { top: 16px; right: 16px; border-top: 3px solid #f59e0b; border-right: 3px solid #f59e0b; }
  .corner-bl { bottom: 16px; left: 16px; border-bottom: 3px solid #f59e0b; border-left: 3px solid #f59e0b; }
  .corner-br { bottom: 16px; right: 16px; border-bottom: 3px solid #f59e0b; border-right: 3px solid #f59e0b; }

  /* Logo */
  .logo {
    font-family: 'Playfair Display', serif;
    font-size: 18px;
    font-weight: 700;
    color: #f59e0b;
    letter-spacing: 8px;
    text-transform: uppercase;
    margin-bottom: 8px;
  }

  /* Title */
  .title {
    font-family: 'Playfair Display', serif;
    font-size: 36px;
    font-weight: 700;
    color: #ffffff;
    letter-spacing: 3px;
    margin-bottom: 4px;
  }

  .subtitle {
    font-size: 13px;
    color: rgba(245, 158, 11, 0.7);
    letter-spacing: 6px;
    text-transform: uppercase;
    margin-bottom: 30px;
  }

  /* Divider line */
  .divider {
    width: 120px;
    height: 2px;
    background: linear-gradient(90deg, transparent, #f59e0b, transparent);
    margin: 8px auto;
  }

  /* Certifies text */
  .certifies {
    font-size: 13px;
    color: #94a3b8;
    letter-spacing: 4px;
    text-transform: uppercase;
    margin-bottom: 10px;
  }

  /* Recipient name */
  .recipient {
    font-family: 'Playfair Display', serif;
    font-size: 42px;
    font-weight: 900;
    color: #f59e0b;
    margin-bottom: 16px;
    text-shadow: 0 2px 12px rgba(245, 158, 11, 0.3);
  }

  /* Project details */
  .details {
    text-align: center;
    margin-bottom: 24px;
  }
  .details .project-label {
    font-size: 12px;
    color: #64748b;
    letter-spacing: 3px;
    text-transform: uppercase;
    margin-bottom: 6px;
  }
  .details .project-name {
    font-size: 18px;
    color: #e2e8f0;
    font-weight: 500;
    margin-bottom: 4px;
  }
  .details .project-info {
    font-size: 14px;
    color: #94a3b8;
  }
  .details .project-info strong {
    color: #f59e0b;
  }

  /* Bottom section */
  .bottom-section {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    width: 800px;
    margin-top: 20px;
  }

  /* Digital seal */
  .seal {
    width: 80px;
    height: 80px;
    border: 2px solid rgba(245, 158, 11, 0.5);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-direction: column;
    position: relative;
  }
  .seal-text {
    font-size: 8px;
    color: #f59e0b;
    letter-spacing: 2px;
    text-transform: uppercase;
  }
  .seal-icon {
    font-size: 24px;
    margin-bottom: 2px;
  }
  .seal-ring {
    position: absolute;
    inset: -4px;
    border: 1px dashed rgba(245, 158, 11, 0.3);
    border-radius: 50%;
  }

  /* Signature */
  .signature-block {
    text-align: center;
  }
  .signature-line {
    width: 200px;
    height: 1px;
    background: rgba(245, 158, 11, 0.4);
    margin-bottom: 8px;
  }
  .signature-name {
    font-size: 14px;
    color: #e2e8f0;
    font-weight: 600;
  }
  .signature-title {
    font-size: 11px;
    color: #64748b;
  }

  /* QR code */
  .qr-section {
    display: flex;
    flex-direction: column;
    align-items: center;
  }
  .qr-section img {
    width: 70px;
    height: 70px;
    border-radius: 4px;
  }
  .qr-label {
    font-size: 8px;
    color: #475569;
    margin-top: 4px;
    letter-spacing: 1px;
  }

  /* Cert ID */
  .cert-id {
    position: absolute;
    bottom: 28px;
    left: 50%;
    transform: translateX(-50%);
    font-size: 10px;
    color: #475569;
    letter-spacing: 3px;
  }

  /* Footer */
  .footer-text {
    position: absolute;
    bottom: 14px;
    left: 50%;
    transform: translateX(-50%);
    font-size: 9px;
    color: #334155;
    letter-spacing: 2px;
  }
</style>
</head>
<body>
<div class="certificate">
  <div class="watermark">ESOLUTION</div>
  <div class="border-outer"></div>
  <div class="border-inner"></div>
  <div class="corner corner-tl"></div>
  <div class="corner corner-tr"></div>
  <div class="corner corner-bl"></div>
  <div class="corner corner-br"></div>

  <div class="logo">✦ ESolution ✦</div>
  <div class="title">Certificate of Completion</div>
  <div class="subtitle">Project Achievement</div>
  <div class="divider"></div>

  <div class="certifies">This certifies that</div>
  <div class="recipient">${ownerName}</div>

  <div class="details">
    <div class="project-label">Successfully Completed</div>
    <div class="project-name">${invoice.notes || "Professional Services"}</div>
    <div class="project-info">
      Client: <strong>${invoice.client_name}</strong> &nbsp;•&nbsp;
      Amount: <strong>₹${formattedAmount}</strong> &nbsp;•&nbsp;
      ${completionDate}
    </div>
  </div>

  <div class="bottom-section">
    <div class="seal">
      <div class="seal-ring"></div>
      <div class="seal-icon">🏆</div>
      <div class="seal-text">Verified</div>
    </div>

    <div class="signature-block">
      <div class="signature-line"></div>
      <div class="signature-name">${ownerName}</div>
      <div class="signature-title">ESolution Platform • ${fullDate}</div>
    </div>

    <div class="qr-section">
      ${qrDataUrl ? `<img src="${qrDataUrl}" alt="Verify" />` : '<div style="width:70px;height:70px;border:1px solid #334155;border-radius:4px;display:flex;align-items:center;justify-content:center;color:#475569;font-size:10px;">QR</div>'}
      <div class="qr-label">SCAN TO VERIFY</div>
    </div>
  </div>

  <div class="cert-id">${certId}</div>
  <div class="footer-text">Verified by ESolution Platform</div>
</div>
</body>
</html>`;

    const browser = await puppeteer.launch({
        headless: "new",
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    try {
        const page = await browser.newPage();
        await page.setViewport({ width: 1000, height: 700 });
        await page.setContent(html, { waitUntil: "networkidle0" });

        // Generate PNG
        const pngBuffer = await page.screenshot({
            type: "png",
            clip: { x: 0, y: 0, width: 1000, height: 700 },
        });

        // Generate PDF
        const pdfBuffer = await page.pdf({
            width: "1000px",
            height: "700px",
            printBackground: true,
            margin: { top: 0, bottom: 0, left: 0, right: 0 },
        });

        return {
            pdfBuffer: Buffer.from(pdfBuffer),
            pngBuffer: Buffer.from(pngBuffer),
            certId,
        };
    } finally {
        await browser.close();
    }
}

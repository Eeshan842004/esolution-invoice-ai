"""Gmail sending via smtplib, using the SAME app password as the website.

Templates are ports of src/lib/email.js:
- tier-based reminders (Gentle <7d, Firm 7-13d, Urgent 14-29d, Legal 30+)
- emotion-driven tone templates (friendly_hindi, formal_english,
  apologetic, firm) selected by the sheet's `reminder_tone` column.
"""

from __future__ import annotations

import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from src.config import settings


def send_email(to: str, subject: str, html: str, text: str = "") -> dict:
    """Send one email. Returns {success, error?} — never raises."""
    if not (settings.gmail_user and settings.gmail_app_password):
        return {"success": False,
                "error": "GMAIL_USER / GMAIL_APP_PASSWORD not configured"}
    try:
        msg = MIMEMultipart("alternative")
        msg["From"] = f"ESolution Invoice <{settings.gmail_user}>"
        msg["To"] = to
        msg["Subject"] = subject
        if text:
            msg.attach(MIMEText(text, "plain"))
        msg.attach(MIMEText(html, "html"))
        with smtplib.SMTP_SSL("smtp.gmail.com", 465, timeout=30) as server:
            # Gmail shows app passwords as "xxxx xxxx xxxx xxxx"; smtplib sends
            # them literally (spaces and all) and Gmail rejects that with a 535,
            # so strip whitespace the way Nodemailer does on the website side.
            app_password = settings.gmail_app_password.replace(" ", "")
            server.login(settings.gmail_user, app_password)
            server.send_message(msg)
        return {"success": True}
    except Exception as exc:  # network/auth errors become a soft failure
        return {"success": False, "error": str(exc)}


def _wrapper(body: str, header_bg: str = "#6366f1", title: str = "ESolution",
             subtitle: str = "Invoice & Payment System") -> str:
    """Mobile-responsive HTML shell — same structure as email.js."""
    return f"""<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>*{{box-sizing:border-box}}body{{margin:0;padding:0}}
@media only screen and (max-width:600px){{.container{{width:100%!important}}
.invoice-table td{{font-size:12px!important;padding:10px 12px!important}}}}</style></head>
<body style="font-family:Arial,sans-serif;background:#f4f4f4;padding:0;margin:0;">
<div class="container" style="width:100%;max-width:600px;margin:0 auto;background:#ffffff;">
<div style="background:{header_bg};padding:24px 20px;text-align:center;width:100%;">
<h1 style="color:white;margin:0;font-size:28px;font-weight:700;">{title}</h1>
<p style="color:rgba(255,255,255,0.8);margin:4px 0 0;font-size:14px;">{subtitle}</p></div>
<div style="padding:24px 20px;background:#ffffff;">{body}</div>
<div style="padding:20px;text-align:center;font-size:12px;color:#aaa;border-top:1px solid #eee;">
ESolution Invoice System — Powered by AI</div></div></body></html>"""


def _amount_table(invoice: dict) -> str:
    penalty = float(invoice.get("penalty_amount") or 0)
    total = invoice.get("total_amount_due") or invoice.get("amount")
    penalty_row = (
        f'<tr style="border-bottom:1px solid #eee;">'
        f'<td style="font-size:13px;color:#d32f2f;padding:12px 16px;">Late Penalty</td>'
        f'<td style="font-size:13px;color:#d32f2f;text-align:right;padding:12px 16px;">+ ₹{penalty}</td></tr>'
        if penalty > 0 else "")
    return f"""<table class="invoice-table" style="width:100%;border-collapse:collapse;background:#f9f9f9;border-radius:8px;overflow:hidden;">
<tr style="border-bottom:1px solid #eee;">
<td style="font-size:13px;color:#888;padding:12px 16px;">Invoice ID</td>
<td style="font-size:13px;color:#111;text-align:right;padding:12px 16px;word-break:break-all;">{invoice.get('invoice_id')}</td></tr>
<tr style="border-bottom:1px solid #eee;">
<td style="font-size:13px;color:#888;padding:12px 16px;">Original Amount</td>
<td style="font-size:13px;color:#111;text-align:right;padding:12px 16px;">₹{invoice.get('amount')}</td></tr>
{penalty_row}
<tr style="background:#f0f0ff;">
<td style="font-size:15px;color:#6366f1;font-weight:700;padding:12px 16px;">Total Due</td>
<td style="font-size:15px;color:#6366f1;font-weight:700;text-align:right;padding:12px 16px;">₹{total}</td></tr></table>
<div style="padding:16px 20px;background:#f9f9f9;border-radius:8px;margin:16px 0;">
<p style="font-size:12px;text-transform:uppercase;color:#888;margin:0 0 4px 0;">📱 UPI Payment</p>
<p style="font-size:14px;font-weight:700;color:#111;margin:0;word-break:break-all;">{settings.owner_upi_id}</p></div>"""


# Tier thresholds match email.js sendReminderEmail: 30+/14+/7+/else.
REMINDER_TIERS = (
    (30, "Legal", "#7f1d1d", "⚖️ FINAL LEGAL NOTICE",
     "FINAL NOTICE: Legal Action Imminent - Invoice {id}",
     "This is a final notice regarding Invoice <strong>{id}</strong>. Payment is "
     "now <strong style=\"color:red;\">{days} days overdue</strong>.<br><br>"
     "Failure to pay <strong>₹{total}</strong> immediately will result in legal action."),
    (14, "Urgent", "#dc2626", "⚠️ ACTION REQUIRED",
     "URGENT: Payment Overdue - Invoice {id}",
     "Your payment for Invoice <strong>{id}</strong> is significantly overdue "
     "({days} days).<br><br>Total due with penalty: <strong>₹{total}</strong>. "
     "Please prioritize this payment to avoid further escalation."),
    (7, "Firm", "#ea580c", "❗ Payment Reminder",
     "Payment Overdue - Invoice {id}",
     "We noticed that payment for Invoice <strong>{id}</strong> is now {days} days "
     "overdue.<br><br>Please clear the outstanding amount of "
     "<strong>₹{total}</strong> at your earliest convenience."),
    (0, "Gentle", "#2563eb", "📅 Payment Reminder",
     "Friendly Reminder - Invoice {id}",
     "Just a friendly reminder that Invoice <strong>{id}</strong> was due on "
     "{due}.<br><br>If you have already sent the payment, please ignore this email."),
)

# Emotion-driven templates match email.js sendToneBasedReminder.
TONE_TEMPLATES = {
    "friendly_hindi": ("#10b981", "🙏 Friendly Reminder",
                       "Hey {name}! Bas ek reminder 🙏",
                       "Hey {name}!\n\nKoi tension nahi yaar.\nJab bhi convenient ho kar dena.\n"
                       "Invoice #{id} - ₹{total}\n\nBas ek baar confirm kar do 😊"),
    "formal_english": ("#2563eb", "📋 Payment Follow-Up",
                       "Follow Up: Invoice #{id} - Payment Pending",
                       "Dear {name},\n\nI hope this message finds you well.\nThis is a gentle "
                       "follow-up regarding Invoice #{id} for ₹{total}.\n\nKindly provide an "
                       "estimated payment date.\nThank you for your continued partnership."),
    "apologetic": ("#7c3aed", "🙏 Apology & Reminder",
                   "Sorry to bother you - Invoice #{id}",
                   "Hi {name},\n\nI sincerely apologize if our reminders have felt excessive.\n"
                   "We completely trust you will handle Invoice #{id} - ₹{total} when possible.\n\n"
                   "We will pause reminders for 7 days.\nThank you for your patience."),
    "firm": ("#dc2626", "⚠️ URGENT: Payment Required",
             "URGENT: Invoice #{id} Requires Immediate Attention",
             "Dear {name},\n\nInvoice #{id} for ₹{total} is now seriously overdue.\n"
             "Immediate payment is required to avoid further escalation.\n\n"
             "Please arrange payment today.\nUPI: {upi}"),
}

VALID_TONES = tuple(TONE_TEMPLATES)


def send_reminder(invoice: dict, tone: str | None = None) -> dict:
    """Send a reminder for an (enriched) invoice.

    If `tone` is one of the emotion templates, use it; otherwise fall back
    to the day-tiered default. Returns {success, tone_used, error?}.
    """
    total = invoice.get("total_amount_due") or invoice.get("amount")
    name = invoice.get("client_name", "")
    inv_id = invoice.get("invoice_id", "")

    if tone in TONE_TEMPLATES:
        header_bg, heading, subject_t, body_t = TONE_TEMPLATES[tone]
        subject = subject_t.format(id=inv_id, name=name)
        body_text = body_t.format(id=inv_id, name=name, total=total,
                                  upi=settings.owner_upi_id)
        body = (f'<p style="white-space:pre-line;color:#666;line-height:1.8;'
                f'font-size:14px;margin:0 0 16px 0;">{body_text}</p>'
                + _amount_table(invoice)
                + f'<p style="color:#888;font-size:11px;">Tone: {tone} (AI-driven reminder)</p>'
                + f'<p style="color:#111;font-size:14px;">— {settings.owner_name}</p>')
        tone_used = tone
        text = f"{heading}\n\n{body_text}\n\nTotal Due: ₹{total}\n— {settings.owner_name}"
    else:
        days = int(invoice.get("days_overdue") or 0)
        for threshold, tier, header_bg, heading, subject_t, message_t in REMINDER_TIERS:
            if days >= threshold:
                break
        subject = subject_t.format(id=inv_id)
        message = message_t.format(id=inv_id, days=days, total=total,
                                   due=invoice.get("due_date", ""))
        body = (f'<p style="font-size:16px;color:#111;">Dear <strong>{name}</strong>,</p>'
                f'<p style="font-size:14px;color:#666;line-height:1.6;">{message}</p>'
                + _amount_table(invoice)
                + f'<p style="color:#888;font-size:12px;">Tone: {tier} Reminder</p>'
                + f'<p style="color:#111;font-size:14px;">— {settings.owner_name}</p>')
        tone_used = tier.lower()
        plain = (message.replace("<br>", "\n").replace("<strong>", "")
                 .replace("</strong>", "").replace('<strong style="color:red;">', ""))
        text = f"{heading}\n\nDear {name},\n\n{plain}\n\nTotal Due: ₹{total}\n— {settings.owner_name}"

    html = _wrapper(body, header_bg, heading, "ESolution Invoice System")
    result = send_email(invoice.get("client_email", ""), subject, html, text)
    return {**result, "tone_used": tone_used}


def send_legal_notice_email(invoice: dict, notice_text: str) -> dict:
    """Send a Gemini-drafted demand letter, same format as the /legal route."""
    subject = (f"FINAL LEGAL NOTICE: Overdue Payment for Invoice "
               f"{invoice.get('invoice_id')}")
    html = (f'<div style="font-family: monospace; white-space: pre-wrap;">'
            f'{notice_text}</div>')
    return send_email(invoice.get("client_email", ""), subject, html, notice_text)

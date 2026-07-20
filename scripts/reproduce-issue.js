import { appendInvoiceRow } from "../src/lib/sheets.js";
import { sendPaymentRequestEmail } from "../src/lib/email.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from 'url';
import { JWT } from "google-auth-library";
import { GoogleSpreadsheet } from "google-spreadsheet";

// Mock environment variables manually since we are not in Next.js
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.resolve(__dirname, '../.env.local');
const envContent = fs.readFileSync(envPath, 'utf-8');
const env = {};
envContent.split('\n').forEach(line => {
    const [key, ...valueParts] = line.split('=');
    if (key && valueParts.length > 0) {
        process.env[key.trim()] = valueParts.join('=').trim().replace(/"/g, '');
    }
});

async function reproduce() {
    console.log("🔄 Attempting to create invoice with USER data...");

    const rowData = {
        invoice_id: `inv_test_${Date.now()}`,
        client_name: "sarthakdfds",
        client_email: "eeshangupta10@gmail.com",
        amount: 3213,
        due_date: "2026-02-25",
        status: "Unpaid",
        payment_method: "Bank/UPI",
        last_reminder_date: "",
        reminder_count: 0,
        paid_date: "",
        payment_reference: "",
        ai_behavior_score: 50,
        discount_percent: 21,
        final_amount: 2538.27,
        legal_notice_sent: "FALSE",
        notes: "ewqqe",
        created_at: new Date().toISOString(),
    };

    try {
        console.log("1️⃣ Writing to Google Sheet...");
        // Re-implement getDoc logic here to avoid import issues if any
        const serviceAccountAuth = new JWT({
            email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
            key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
            scopes: ["https://www.googleapis.com/auth/spreadsheets"],
        });
        const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEET_ID, serviceAccountAuth);
        await doc.loadInfo();
        const sheet = doc.sheetsByIndex[0];
        await sheet.addRow(rowData);
        console.log("✅ Sheet write success!");
    } catch (err) {
        console.error("❌ Sheet write FAILED:", err);
    }

    try {
        console.log("2️⃣ Sending Email...");
        // We can't easily import email.js logic because it might use Next.js specific stuff or relative paths
        // But let's try to simulate the auth check
        console.log("   User: " + process.env.GMAIL_USER);
        console.log("   Pass length: " + (process.env.GMAIL_APP_PASSWORD ? process.env.GMAIL_APP_PASSWORD.length : 0));
    } catch (err) {
        console.error("❌ Email FAILED:", err);
    }
}

reproduce();

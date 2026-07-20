import { GoogleSpreadsheet } from "google-spreadsheet";
import { JWT } from "google-auth-library";
import fs from "fs";
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

// Load env vars manually
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const envPath = resolve(__dirname, '../.env.local');

try {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    envContent.split('\n').forEach(line => {
        const [key, value] = line.split('=');
        if (key && value) {
            process.env[key.trim()] = value.trim().replace(/"/g, ''); // Simple cleanup
        }
    });
} catch (e) {
    console.warn("⚠️ Could not read .env.local:", e.message);
}

const SHEET_NAME = "Invoices";

// Headers matching sheets.js
const HEADERS = [
    "invoice_id",
    "client_name",
    "client_email",
    "amount",
    "due_date",
    "status",
    "discount_percent",
    "final_amount",
    "last_reminder_date",
    "reminder_count",
    "paid_date",
    "penalty_amount",
    "total_amount_due",
    "ai_behavior_score",
    "notes",
    "created_at",
    "legal_notice_sent",
    "payment_method",
    "payment_reference",
];

async function seedData() {
    console.log("🌱 Seeding data...");

    if (!process.env.GOOGLE_SHEET_ID || !process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY) {
        console.error("❌ Missing environment variables. Check .env.local");
        process.exit(1);
    }

    const serviceAccountAuth = new JWT({
        email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
        scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });

    const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEET_ID, serviceAccountAuth);
    await doc.loadInfo();

    let sheet = doc.sheetsByTitle[SHEET_NAME];
    if (!sheet) {
        console.log("Creating new sheet...");
        sheet = await doc.addSheet({ title: SHEET_NAME, headerValues: HEADERS });
    } else {
        console.log("Updating headers...");
        await sheet.setHeaderRow(HEADERS);
    }

    // Sample Data
    const today = new Date();

    // 1. Overdue (Legal Phase) - 35 days overdue
    const dateLegal = new Date(today);
    dateLegal.setDate(today.getDate() - 35);

    // 2. Overdue (Urgent) - 15 days overdue
    const dateUrgent = new Date(today);
    dateUrgent.setDate(today.getDate() - 15);

    // 3. Overdue (Firm) - 8 days overdue
    const dateFirm = new Date(today);
    dateFirm.setDate(today.getDate() - 8);

    // 4. Due Soon - Due in 3 days
    const dateSoon = new Date(today);
    dateSoon.setDate(today.getDate() + 3);

    const samples = [
        {
            invoice_id: "inv_SAMPLE_LEGAL",
            client_name: "Wayne Enterprises",
            client_email: "bruce@wayne.com",
            amount: 50000,
            due_date: dateLegal.toISOString().split('T')[0],
            status: "Overdue",
            discount_percent: 0,
            final_amount: 50000,
            ai_behavior_score: 30,
            created_at: new Date().toISOString(),
            notes: "Sample overdue invoice (Legal)",
            payment_behavior_score: 30, // For backward compat if any code uses this
            total_amount_due: 50000 + Math.ceil(35 / 7) * 0.02 * 50000, // Pre-calc penalty roughly
            penalty_amount: Math.ceil(35 / 7) * 0.02 * 50000,
            days_overdue: 35
        },
        {
            invoice_id: "inv_SAMPLE_URGENT",
            client_name: "Stark Industries",
            client_email: "tony@stark.com",
            amount: 75000,
            due_date: dateUrgent.toISOString().split('T')[0],
            status: "Overdue",
            discount_percent: 5,
            final_amount: 71250, // 75000 * 0.95
            ai_behavior_score: 45,
            created_at: new Date().toISOString(),
            notes: "Sample overdue invoice (Urgent)",
            payment_behavior_score: 45,
            total_amount_due: 71250 + Math.ceil(15 / 7) * 0.02 * 75000,
            penalty_amount: Math.ceil(15 / 7) * 0.02 * 75000,
            days_overdue: 15
        },
        {
            invoice_id: "inv_SAMPLE_FIRM",
            client_name: "Daily Bugle",
            client_email: "jjj@bugle.com",
            amount: 15000,
            due_date: dateFirm.toISOString().split('T')[0],
            status: "Overdue",
            discount_percent: 0,
            final_amount: 15000,
            ai_behavior_score: 60,
            created_at: new Date().toISOString(),
            notes: "Sample overdue invoice (Firm)",
            payment_behavior_score: 60,
            total_amount_due: 15000 + Math.ceil(8 / 7) * 0.02 * 15000,
            penalty_amount: Math.ceil(8 / 7) * 0.02 * 15000,
            days_overdue: 8
        },
        {
            invoice_id: "inv_SAMPLE_FRESH",
            client_name: "Oscorp",
            client_email: "norman@oscorp.com",
            amount: 120000,
            due_date: dateSoon.toISOString().split('T')[0],
            status: "Unpaid",
            discount_percent: 10,
            final_amount: 108000,
            ai_behavior_score: 85,
            created_at: new Date().toISOString(),
            notes: "Sample fresh invoice",
            payment_behavior_score: 85,
            total_amount_due: 108000,
            penalty_amount: 0,
            days_overdue: 0
        }
    ];

    console.log(`Adding ${samples.length} sample invoices...`);
    await sheet.addRows(samples);
    console.log("✅ Seed complete!");
}

seedData().catch(console.error);

import { GoogleSpreadsheet } from "google-spreadsheet";
import { JWT } from "google-auth-library";
import fs from "fs";
import path from "path";
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env vars manually
const envPath = path.resolve(__dirname, '../.env.local');
const envContent = fs.readFileSync(envPath, 'utf-8');
const env = {};
envContent.split('\n').forEach(line => {
    const [key, ...valueParts] = line.split('=');
    if (key && valueParts.length > 0) {
        env[key.trim()] = valueParts.join('=').trim().replace(/"/g, '');
    }
});

async function testSheet() {
    console.log("🔍 Starting Sheet Debugger...");
    console.log("--------------------------------");

    const email = env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const sheetId = env.GOOGLE_SHEET_ID;
    const rawKey = env.GOOGLE_PRIVATE_KEY;

    console.log(`📧 Email: ${email}`);
    console.log(`📄 Sheet ID: ${sheetId}`);
    console.log(`🔑 Key Length: ${rawKey ? rawKey.length : 0}`);

    try {
        const serviceAccountAuth = new JWT({
            email: email,
            key: rawKey.replace(/\\n/g, "\n"),
            scopes: ["https://www.googleapis.com/auth/spreadsheets"],
        });

        const doc = new GoogleSpreadsheet(sheetId, serviceAccountAuth);

        console.log("\n📡 Connecting to Google...");
        await doc.loadInfo();
        console.log(`✅ Connected! Title: "${doc.title}"`);

        console.log("\n📑 Tabs found:");
        doc.sheetsByIndex.forEach((sheet, i) => {
            console.log(`   [${i}] Title: "${sheet.title}", Rows: ${sheet.rowCount}`);
        });

        // Try writing to the first sheet (index 0)
        const firstSheet = doc.sheetsByIndex[0];
        console.log(`\n✏️ Attempting to write to tab: "${firstSheet.title}"...`);

        await firstSheet.setHeaderRow(['Debug', 'Timestamp', 'Status']);
        await firstSheet.addRow({
            Debug: 'Test Write',
            Timestamp: new Date().toISOString(),
            Status: 'Success'
        });

        console.log("✅ Wrote test row to the first sheet!");
        console.log("👉 Please check your Google Sheet now.");

    } catch (error) {
        console.error("\n❌ ERROR:", error.message);
        if (error.response) {
            console.error("   Details:", error.response.data);
        }
    }
}

testSheet();

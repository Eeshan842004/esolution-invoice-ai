import { GoogleSpreadsheet } from "google-spreadsheet";
import { JWT } from "google-auth-library";

const SHEET_NAME = "Invoices";

// Column headers matching the schema
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
    "legal_notice_sent", // Keeping this as it's useful
    "payment_method",    // Keeping as useful
    "payment_reference",  // Keeping as useful
    // Portal columns
    "portal_token",
    "portal_viewed",
    "payment_claimed",
    "client_message",
    "installment_requested",
    "partial_amount_proposed",
    // Emotion analysis columns
    "last_client_reply",
    "client_emotion",
    "emotion_score",
    "reminder_tone",
    "next_reminder_date",
    // Certificate
    "certificate_id"
];

// Per-process connection cache. Auth, spreadsheet metadata and the header
// check are set up once and reused across requests — row data itself is
// always fetched fresh (getRows/addRow hit the API on every call), so this
// only removes the 2-3 redundant round-trips every request used to pay.
let _docPromise = null;
let _sheetPromise = null;

/**
 * Get authenticated Google Spreadsheet instance (cached per process)
 */
export async function getDoc() {
    if (_docPromise) return _docPromise;

    _docPromise = (async () => {
        const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
        const sheetId = process.env.GOOGLE_SHEET_ID;
        const rawKey = process.env.GOOGLE_PRIVATE_KEY;

        if (!email || !sheetId || !rawKey) {
            throw new Error("Missing Google Sheets credentials in environment variables");
        }

        const serviceAccountAuth = new JWT({
            email,
            key: rawKey.replace(/\\n/g, "\n"),
            scopes: ["https://www.googleapis.com/auth/spreadsheets"],
        });

        const doc = new GoogleSpreadsheet(sheetId, serviceAccountAuth);
        await doc.loadInfo();
        console.log("✅ [Sheets] Connected to spreadsheet:", doc.title);
        return doc;
    })();

    // A failed connection must not poison every future request.
    _docPromise.catch(() => { _docPromise = null; });
    return _docPromise;
}

/**
 * Get the first sheet (User's visible sheet), cached per process.
 * The rename + header check run once; afterwards requests go straight
 * to row reads/writes.
 */
async function getSheet() {
    if (_sheetPromise) return _sheetPromise;

    _sheetPromise = (async () => {
        const doc = await getDoc();

        // Always use the first sheet (index 0) to ensure visibility
        const sheet = doc.sheetsByIndex[0];
        console.log(`✅ [Sheets] Using first tab: "${sheet.title}" (Rows: ${sheet.rowCount})`);

        // Optional: Rename it to Invoices if it's the default Sheet1
        if (sheet.title === "Sheet1") {
            try {
                await sheet.updateProperties({ title: SHEET_NAME });
                console.log(`✅ [Sheets] Renamed "Sheet1" to "${SHEET_NAME}"`);
            } catch (err) {
                console.warn(`⚠️ [Sheets] Could not rename "Sheet1" to "${SHEET_NAME}" (likely already exists). Proceeding with "${sheet.title}".`);
            }
        }

        // Ensure headers exist on row 1
        await sheet.loadHeaderRow();
        const existingHeaders = sheet.headerValues;
        if (!existingHeaders || existingHeaders.length === 0 || existingHeaders[0] === "") {
            console.log("📋 [Sheets] Headers missing on row 1, setting them now...");
            await sheet.setHeaderRow(HEADERS);
            console.log("✅ [Sheets] Headers set on row 1");
        }

        return sheet;
    })();

    _sheetPromise.catch(() => { _sheetPromise = null; });
    return _sheetPromise;
}

/**
 * Initialize sheet headers (one-time setup)
 */
export async function initializeSheetHeaders() {
    const doc = await getDoc();
    const sheet = doc.sheetsByIndex[0]; // Always use first sheet

    await sheet.setHeaderRow(HEADERS);
    if (sheet.title === "Sheet1") {
        try {
            await sheet.updateProperties({ title: SHEET_NAME });
        } catch (e) {
            console.warn("Could not rename sheet (name collision).");
        }
    }

    // Header row changed — drop the cached sheet so the next request
    // re-reads it instead of serving stale header metadata.
    _sheetPromise = null;

    return { success: true, headers: HEADERS };
}

/**
 * Calculate dynamic fields for an invoice row
 */
function enrichInvoice(row) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const dueDate = new Date(row.due_date);
    dueDate.setHours(0, 0, 0, 0);

    const amount = parseFloat(row.amount) || 0;

    // Auto-calculate status
    let status = row.status;
    if (row.paid_date) {
        status = "Paid";
    } else if (today > dueDate) {
        status = "Overdue";
    } else if (status !== "Paid") { // Keep existing status if not paid/overdue, default Unpaid
        status = "Unpaid";
    }

    // Calculate days overdue
    const daysOverdue =
        status === "Overdue"
            ? Math.floor((today - dueDate) / (1000 * 60 * 60 * 24))
            : 0;

    // Penalty: Math.ceil(days_overdue / 7) * 0.02 * original_amount
    const penaltyAmount =
        daysOverdue > 0 ? Math.ceil(daysOverdue / 7) * 0.02 * amount : 0;

    // Total amount due
    const totalAmountDue = amount + penaltyAmount;

    // Discount calculation
    const discountPercent = parseFloat(row.discount_percent) || 0;
    const finalAmount = amount * (1 - discountPercent / 100);

    return {
        ...row,
        status,
        days_overdue: daysOverdue,
        penalty_amount: Math.round(penaltyAmount * 100) / 100,
        total_amount_due: Math.round(totalAmountDue * 100) / 100,
        final_amount: Math.round(finalAmount * 100) / 100,
        amount,
        ai_behavior_score: parseInt(row.ai_behavior_score) || 50, // Ensure number
    };
}

/**
 * Append a new invoice row to the sheet
 */
export async function appendInvoiceRow(data) {
    console.log("📋 [Sheets] Writing invoice row:", JSON.stringify({
        invoice_id: data.invoice_id,
        client_name: data.client_name,
        amount: data.amount,
        status: data.status,
    }));
    const sheet = await getSheet();
    const row = await sheet.addRow(data);
    const result = row.toObject();
    console.log("✅ [Sheets] Row written successfully! Row number:", row.rowNumber);
    console.log("✅ [Sheets] Written data:", JSON.stringify({
        invoice_id: result.invoice_id,
        client_name: result.client_name,
        amount: result.amount,
    }));
    return result;
}

/**
 * Get all invoices with enriched/calculated fields
 */
export async function getInvoices() {
    const sheet = await getSheet();
    const rows = await sheet.getRows();

    return rows.map((row) => {
        const obj = row.toObject();
        return enrichInvoice(obj);
    });
}

/**
 * Get a single invoice by ID
 */
export async function getInvoiceById(invoiceId) {
    const sheet = await getSheet();
    const rows = await sheet.getRows();

    const row = rows.find((r) => r.get("invoice_id") === invoiceId);
    if (!row) return null;

    return enrichInvoice(row.toObject());
}

/**
 * Update a specific field on an invoice
 */
export async function updateInvoiceField(invoiceId, updates) {
    const sheet = await getSheet();
    const rows = await sheet.getRows();

    const row = rows.find((r) => r.get("invoice_id") === invoiceId);
    if (!row) throw new Error(`Invoice ${invoiceId} not found`);

    for (const [key, value] of Object.entries(updates)) {
        row.set(key, value);
    }

    await row.save();
    return row.toObject();
}

/**
 * Mark invoice as paid
 */
export async function markInvoicePaid(invoiceId, paymentReference = "") {
    const today = new Date().toISOString().split("T")[0];
    return updateInvoiceField(invoiceId, {
        status: "Paid",
        paid_date: today,
        payment_reference: paymentReference,
    });
}

/**
 * Get all unpaid/overdue invoices (for reminder system)
 */
export async function getUnpaidInvoices() {
    const invoices = await getInvoices();
    return invoices.filter((inv) => inv.status !== "Paid");
}

/**
 * Get invoices for a specific client email (for AI predictions)
 */
export async function getInvoicesByClient(clientEmail) {
    const invoices = await getInvoices();
    return invoices.filter(
        (inv) => inv.client_email?.toLowerCase() === clientEmail?.toLowerCase()
    );
}

/**
 * Get summary statistics
 */
export async function getInvoiceSummary() {
    const invoices = await getInvoices();

    const totalInvoices = invoices.length;
    const paidInvoices = invoices.filter((i) => i.status === "Paid");
    const unpaidInvoices = invoices.filter((i) => i.status === "Unpaid");
    const overdueInvoices = invoices.filter((i) => i.status === "Overdue");

    const totalRevenue = paidInvoices.reduce((sum, i) => sum + i.amount, 0);
    const totalUnpaid = unpaidInvoices.reduce((sum, i) => sum + i.amount, 0);
    const totalOverdue = overdueInvoices.reduce(
        (sum, i) => sum + i.total_amount_due,
        0
    );

    return {
        total_invoices: totalInvoices,
        total_paid: paidInvoices.length,
        total_unpaid: unpaidInvoices.length,
        total_overdue: overdueInvoices.length,
        total_revenue: totalRevenue,
        total_unpaid_amount: totalUnpaid,
        total_overdue_amount: totalOverdue,
    };
}

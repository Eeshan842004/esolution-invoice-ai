// =====================================================
// HOW TO DEPLOY THE AUTO-REMINDER SCRIPT:
// =====================================================
// 1. Open your Google Sheet
// 2. Click Extensions → Apps Script
// 3. Delete any existing code in Code.gs
// 4. Paste this entire script
// 5. Update the OWNER_UPI constant below with your actual UPI ID
// 6. Click Save (Ctrl+S) or the floppy disk icon
// 7. Click Run → "sendDailyReminders" (First time: approve permissions)
// 8. Set up automatic trigger:
//    - Left sidebar → Clock icon (Triggers)
//    - Click "+ Add Trigger"
//    - Choose which function to run: sendDailyReminders
//    - Select event source: Time-driven
//    - Select type of time based trigger: Day timer
//    - Select time of day: 9am to 10am
//    - Click Save
// 9. Done! It will now run every morning at 9 AM automatically.
//    No website needs to be running! Works 24/7 automatically!
// =====================================================

// =====================================================
// CONSTANTS
// =====================================================
const SHEET_ID = "1a70EPdAm-OPEsi7K7iSeoVw9Kp29pqcFgR98-BJlU4Q";
const OWNER_NAME = "Eeshan Gupta";
const OWNER_EMAIL = "eeshangupta10@gmail.com";
const OWNER_UPI = "<your_upi_id>"; // ⚠️ UPDATE THIS LINE
const LATE_PENALTY_RATE_PER_WEEK = 0.02; // 2% per 7 days

// Spreadsheet Column Mappings (0-indexed)
const COL_A_INVOICE_ID = 0;
const COL_B_CLIENT_NAME = 1;
const COL_C_CLIENT_EMAIL = 2;
const COL_D_AMOUNT = 3;
const COL_E_DUE_DATE = 4;
const COL_F_STATUS = 5;
const COL_H_LAST_REMINDER_DATE = 7;
const COL_I_REMINDER_COUNT = 8;
const COL_J_PAID_DATE = 9;
const COL_M_PENALTY_AMOUNT = 12;
const COL_N_TOTAL_AMOUNT_DUE = 13;
const COL_U_DISCOUNTED_AMOUNT = 20;

function sendDailyReminders() {
  Logger.log("🚀 Starting Daily Reminders Cron Job...");
  var today = new Date();
  today.setHours(0, 0, 0, 0);
  var todayStr = Utilities.formatDate(today, Session.getScriptTimeZone(), "yyyy-MM-dd");

  var ss = SpreadsheetApp.openById(SHEET_ID);
  var sheet = ss.getSheets()[0]; // Always use the first sheet
  var data = sheet.getDataRange().getValues();

  var updatedCount = 0;
  var emailsSent = 0;

  // Start from row 1 (skip header)
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var status = String(row[COL_F_STATUS]).trim();

    // 1. Skip if already Paid
    if (status === "Paid") {
      continue;
    }

    var invoiceId = row[COL_A_INVOICE_ID];
    var clientName = row[COL_B_CLIENT_NAME];
    var clientEmail = row[COL_C_CLIENT_EMAIL];
    
    var originalAmount = parseFloat(row[COL_D_AMOUNT]) || 0;
    var discountedAmount = parseFloat(row[COL_U_DISCOUNTED_AMOUNT]);
    var amount = !isNaN(discountedAmount) && discountedAmount > 0 ? discountedAmount : originalAmount;
    
    var dueDateStr = row[COL_E_DUE_DATE];

    if (!dueDateStr) continue; // Skip invalid rows

    var dueDate = new Date(dueDateStr);
    dueDate.setHours(0, 0, 0, 0);

    // Calculate Days Overdue
    var daysOverdue = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));

    // 2. Skip if not due yet
    if (daysOverdue <= 0) {
      continue;
    }

    var lastReminderDate = String(row[COL_H_LAST_REMINDER_DATE]).trim();
    var reminderCountStr = row[COL_I_REMINDER_COUNT];
    // Attempt parsing. If empty, it's 0.
    var reminderCount = parseInt(reminderCountStr);
    if (isNaN(reminderCount)) reminderCount = 0;

    // 3. Skip if already reminded today
    if (lastReminderDate === todayStr) {
      continue; 
    }

    // 4. Determine if we should send a reminder today based on reminder_count
    var shouldSend = false;
    
    if (reminderCount === 0 && daysOverdue >= 1) {
      shouldSend = true;
    } else if (reminderCount === 1 && daysOverdue >= 3) {
      shouldSend = true;
    } else if (reminderCount === 2 && daysOverdue >= 7) {
      shouldSend = true;
    } else if (reminderCount === 3 && daysOverdue >= 14) {
      shouldSend = true;
    } else if (reminderCount === 4 && daysOverdue >= 21) {
      shouldSend = true;
    } else if (reminderCount >= 5) {
      // Once 5 reminders have been sent, we do it every 7 days continuously as long as it's not paid.
      // E.g., if it's 30+ days. Let's check when the last reminder was sent.
      if (lastReminderDate) {
         var lastDateObj = new Date(lastReminderDate);
         lastDateObj.setHours(0, 0, 0, 0);
         var diffDays = Math.floor((today.getTime() - lastDateObj.getTime()) / (1000 * 60 * 60 * 24));
         if (diffDays >= 7) {
            shouldSend = true;
         }
      } else {
         shouldSend = true; // Fail-safe (shouldn't be hit usually)
      }
    }

    // 5. If conditions met, calculate penalty and send email
    if (shouldSend) {
      Logger.log("⏳ Processing invoice " + invoiceId + " for " + clientEmail + " (Days Overdue: " + daysOverdue + ", Reminder Count: " + reminderCount + ")");
      
      // Calculate penalty: Math.ceil(days_overdue / 7) * 0.02 * original_amount
      var newPenalty = Math.ceil(daysOverdue / 7) * LATE_PENALTY_RATE_PER_WEEK * amount;
      var newTotal = amount + newPenalty;
      
      // Select Email Template based on Days Overdue
      var subject = "";
      var body = "";
      
      var fmtAmount = amount.toLocaleString("en-IN");
      var fmtPenalty = newPenalty.toLocaleString("en-IN");
      var fmtTotal = newTotal.toLocaleString("en-IN");
      var fmtDueDate = Utilities.formatDate(dueDate, Session.getScriptTimeZone(), "dd MMM, yyyy");

      if (daysOverdue >= 1 && daysOverdue <= 2) {
        // Day 1-2 (gentle)
        subject = "Invoice Payment Reminder - \u20B9" + fmtAmount;
        body = "Hi " + clientName + ",\n\nYour invoice of \u20B9" + fmtAmount + " was due on " + fmtDueDate + ". Please arrange payment at your earliest convenience.\n\nUPI: " + OWNER_UPI + "\nInvoice ID: " + invoiceId;
      } 
      else if (daysOverdue >= 3 && daysOverdue <= 6) {
        // Day 3-6 (friendly firm)
        subject = "Follow Up: Invoice \u20B9" + fmtAmount + " Overdue";
        body = "Hi " + clientName + ",\n\nThis is a follow up regarding your overdue invoice of \u20B9" + fmtAmount + ".\n" + daysOverdue + " days have passed since the due date. Late payment fee may apply.\n\nPlease pay immediately.\n\nUPI: " + OWNER_UPI + "\nInvoice ID: " + invoiceId;
      } 
      else if (daysOverdue >= 7 && daysOverdue <= 13) {
        // Day 7-13 (firm)
        subject = "OVERDUE: Invoice \u20B9" + fmtAmount + " - " + daysOverdue + " days late";
        body = "Dear " + clientName + ",\n\nYour invoice of \u20B9" + fmtAmount + " is now " + daysOverdue + " days overdue.\n\nPenalty added: \u20B9" + fmtPenalty + "\nTotal now due: \u20B9" + fmtTotal + "\n\nPlease pay immediately to avoid further penalties.\n\nUPI: " + OWNER_UPI + "\nInvoice ID: " + invoiceId;
      } 
      else if (daysOverdue >= 14 && daysOverdue <= 20) {
        // Day 14-20 (urgent)
        subject = "URGENT: Immediate Payment Required";
        body = "Dear " + clientName + ",\n\nThis is an urgent notice.\nInvoice \u20B9" + fmtAmount + " is " + daysOverdue + " days overdue.\n\nAccumulated penalty: \u20B9" + fmtPenalty + "\nTOTAL DUE NOW: \u20B9" + fmtTotal + "\n\nFailure to pay may result in legal action.\n\nUPI: " + OWNER_UPI + "\nInvoice ID: " + invoiceId;
      } 
      else if (daysOverdue >= 21 && daysOverdue <= 29) {
        // Day 21-29 (final warning)
        subject = "FINAL NOTICE Before Legal Action";
        body = "Dear " + clientName + ",\n\nThis is your final notice.\nInvoice \u20B9" + fmtAmount + " is seriously overdue.\nAll future penalties will continue to accumulate.\n\nLegal action will be considered if payment is not received within 7 days.\n\nUPI: " + OWNER_UPI + "\nInvoice ID: " + invoiceId;
      } 
      else {
        // Day 30+ (legal)
        subject = "Legal Action Notice - Invoice " + invoiceId;
        body = "Dear " + clientName + ",\n\nWe regret to inform you that your account has been referred for legal recovery proceedings.\n\nAmount due: \u20B9" + fmtTotal + "\n\nTo avoid legal proceedings, pay immediately.\n\nUPI: " + OWNER_UPI + "\nInvoice ID: " + invoiceId;
      }
      
      // Sign-off
      body += "\n\nRegards,\n" + OWNER_NAME;

      // 6. Send the Email directly using GmailApp
      try {
        GmailApp.sendEmail(clientEmail, subject, body, {
           name: OWNER_NAME
        });
        Logger.log("✅ Email sent to: " + clientEmail);
        emailsSent++;
      } catch (e) {
        Logger.log("❌ Failed to send email to " + clientEmail + ". Error: " + e.toString());
        continue; // Skip updating the sheet if email sending failed
      }

      // 7. Update the Google Sheet
      // i + 1 because data array is 0-indexed while sheet ranges are 1-indexed.
      var rowNumber = i + 1;
      
      // Set status to Overdue if it is Unpaid
      if (status !== "Overdue") {
        sheet.getRange(rowNumber, COL_F_STATUS + 1).setValue("Overdue");
      }
      
      // Update last reminder date and count
      sheet.getRange(rowNumber, COL_H_LAST_REMINDER_DATE + 1).setValue(todayStr); // Col H (Index 7 -> Col 8)
      sheet.getRange(rowNumber, COL_I_REMINDER_COUNT + 1).setValue(reminderCount + 1); // Col I (Index 8 -> Col 9)
      
      // Update penalty amounts
      sheet.getRange(rowNumber, COL_M_PENALTY_AMOUNT + 1).setValue(newPenalty); // Col M
      sheet.getRange(rowNumber, COL_N_TOTAL_AMOUNT_DUE + 1).setValue(newTotal); // Col N
      
      updatedCount++;
      Logger.log("✅ Sheet updated for row " + rowNumber);
    }
  }

  Logger.log("🎉 Cron job finished! Processed " + updatedCount + " invoice(s) and sent " + emailsSent + " email(s).");
}

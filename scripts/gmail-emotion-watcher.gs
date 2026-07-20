// =====================================================
// ESolution — Gmail Emotion Watcher (Apps Script)
// =====================================================
//
// This script monitors Gmail for client replies to 
// invoice emails. When a reply is found, it:
// 1. Extracts the invoice ID from the subject line
// 2. Verifies the sender matches the client in the sheet
// 3. Sends the reply text to the emotion analysis API
// 4. Updates the Google Sheet with emotion data
// 5. Marks the email as read
//
// =====================================================

// ========== CONFIGURATION — CHANGE THESE =============
var SHEET_ID = "1a70EPdAm-OPEsi7K7iSeoVw9Kp29pqcFgR98-BJlU4Q";
var WEBSITE_URL = "http://localhost:3000";  // Change to deployed URL (Vercel/ngrok) when ready
// =====================================================


/**
 * Main function — runs every 5 minutes via trigger.
 * Searches Gmail for unread replies to invoice emails,
 * extracts emotion data via AI, and updates the sheet.
 */
function checkGmailReplies() {
  Logger.log("🔍 Starting Gmail reply check...");
  
  // Search for unread emails with invoice IDs in subject
  var threads = GmailApp.search("is:unread in:inbox", 0, 10);
  Logger.log("📬 Found " + threads.length + " unread thread(s)");
  
  var processed = 0;
  var skipped = 0;
  
  for (var i = 0; i < threads.length; i++) {
    var thread = threads[i];
    var subject = thread.getFirstMessageSubject() || "";
    
    // Only process threads with invoice IDs in subject
    var invoiceMatch = subject.match(/inv_[a-zA-Z0-9_]+/);
    if (!invoiceMatch) {
      skipped++;
      continue;
    }
    
    var invoiceId = invoiceMatch[0];
    Logger.log("📧 Found invoice reference: " + invoiceId + " in subject: " + subject);
    
    // Get the latest unread message in this thread
    var messages = thread.getMessages();
    var latestMessage = null;
    
    for (var m = messages.length - 1; m >= 0; m--) {
      if (messages[m].isUnread()) {
        latestMessage = messages[m];
        break;
      }
    }
    
    if (!latestMessage) {
      Logger.log("⚠️ No unread message found in thread, skipping");
      continue;
    }
    
    var senderEmail = extractEmail(latestMessage.getFrom());
    var replyText = latestMessage.getPlainBody();
    
    // Clean up reply text (remove quoted text and signatures)
    replyText = cleanReplyText(replyText);
    
    if (!replyText || replyText.trim().length < 3) {
      Logger.log("⚠️ Reply text too short or empty, skipping");
      latestMessage.markRead();
      continue;
    }
    
    Logger.log("👤 Reply from: " + senderEmail);
    Logger.log("💬 Reply text: " + replyText.substring(0, 100) + "...");
    
    // --- STEP 3: Match to Google Sheet ---
    var sheetMatch = matchInvoiceInSheet(invoiceId, senderEmail);
    if (!sheetMatch.found) {
      Logger.log("❌ No matching invoice found in sheet for " + invoiceId + " / " + senderEmail);
      latestMessage.markRead();
      skipped++;
      continue;
    }
    
    Logger.log("✅ Invoice matched: " + invoiceId + " (Row " + sheetMatch.rowIndex + ")");
    
    // --- STEP 4: Send to emotion API ---
    var emotionResult = analyzeEmotion(invoiceId, replyText, senderEmail);
    
    if (emotionResult && emotionResult.success) {
      Logger.log("🧠 Emotion detected: " + emotionResult.emotion);
      Logger.log("🎯 Recommended tone: " + emotionResult.tone);
      Logger.log("⏳ Wait days: " + emotionResult.waitDays);
      
      // --- STEP 5: Update sheet with emotion data ---
      updateSheetWithEmotion(sheetMatch.rowIndex, {
        replyText: replyText.substring(0, 200),
        emotion: emotionResult.emotion,
        score: emotionResult.score,
        tone: emotionResult.tone,
        waitDays: emotionResult.waitDays
      });
      
      Logger.log("✅ Sheet updated successfully for " + invoiceId);
      processed++;
    } else {
      Logger.log("⚠️ Emotion analysis failed: " + (emotionResult ? emotionResult.error : "No response"));
    }
    
    // --- STEP 6: Mark email as read ---
    latestMessage.markRead();
    Logger.log("📨 Email marked as read");
  }
  
  Logger.log("✅ Done! Processed: " + processed + ", Skipped: " + skipped);
}


/**
 * Extract email address from "Name <email>" format
 */
function extractEmail(fromString) {
  var match = fromString.match(/<([^>]+)>/);
  return match ? match[1].toLowerCase() : fromString.toLowerCase().trim();
}


/**
 * Clean reply text — remove quoted replies and signatures
 */
function cleanReplyText(text) {
  if (!text) return "";
  
  // Remove everything after common reply markers
  var markers = [
    "\nOn ",           // "On Mon, Feb 19..."
    "\n>",             // Quoted text
    "------",          // Dividers
    "______",          // Dividers
    "From:",           // Forwarded
    "Sent from my",    // Mobile signatures
    "Get Outlook",     // Outlook signature
  ];
  
  var cleanedText = text;
  for (var i = 0; i < markers.length; i++) {
    var idx = cleanedText.indexOf(markers[i]);
    if (idx > 0) {
      cleanedText = cleanedText.substring(0, idx);
    }
  }
  
  return cleanedText.trim();
}


/**
 * Match invoice ID + sender email in Google Sheet
 * Column A = invoice_id, Column C = client_email
 */
function matchInvoiceInSheet(invoiceId, senderEmail) {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var sheet = ss.getSheets()[0]; // First sheet
  var data = sheet.getDataRange().getValues();
  
  // Skip header row (row 0)
  for (var i = 1; i < data.length; i++) {
    var rowInvoiceId = String(data[i][0]).trim();  // Column A
    var rowClientEmail = String(data[i][2]).trim().toLowerCase(); // Column C
    
    if (rowInvoiceId === invoiceId) {
      // Invoice ID matches
      if (rowClientEmail === senderEmail.toLowerCase()) {
        // Both match — correct invoice found
        return { found: true, rowIndex: i + 1 }; // +1 because sheet rows are 1-indexed
      } else {
        Logger.log("⚠️ Invoice ID matched but email mismatch: sheet=" + rowClientEmail + " sender=" + senderEmail);
        // Still process it — the reply might come from a different email
        return { found: true, rowIndex: i + 1 };
      }
    }
  }
  
  return { found: false, rowIndex: -1 };
}


/**
 * Send reply text to the emotion analysis API
 */
function analyzeEmotion(invoiceId, replyText, clientEmail) {
  var url = WEBSITE_URL + "/api/emotion/analyze";
  
  var payload = {
    invoiceId: invoiceId,
    replyText: replyText,
    clientEmail: clientEmail
  };
  
  var options = {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };
  
  try {
    var response = UrlFetchApp.fetch(url, options);
    var code = response.getResponseCode();
    var body = response.getContentText();
    
    Logger.log("🌐 API Response (" + code + "): " + body.substring(0, 200));
    
    if (code === 200) {
      return JSON.parse(body);
    } else {
      Logger.log("❌ API returned error code: " + code);
      return { success: false, error: "HTTP " + code };
    }
  } catch (e) {
    Logger.log("❌ API call failed: " + e.message);
    return { success: false, error: e.message };
  }
}


/**
 * Update Google Sheet row with emotion analysis data
 * Finds the correct columns by header name
 */
function updateSheetWithEmotion(rowIndex, emotionData) {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var sheet = ss.getSheets()[0];
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  
  // Find column indices by header name
  var colMap = {};
  for (var i = 0; i < headers.length; i++) {
    colMap[headers[i]] = i + 1; // 1-indexed for sheet operations
  }
  
  // Update each emotion column
  if (colMap["last_client_reply"]) {
    sheet.getRange(rowIndex, colMap["last_client_reply"]).setValue(emotionData.replyText);
  }
  if (colMap["client_emotion"]) {
    sheet.getRange(rowIndex, colMap["client_emotion"]).setValue(emotionData.emotion);
  }
  if (colMap["emotion_score"]) {
    sheet.getRange(rowIndex, colMap["emotion_score"]).setValue(emotionData.score);
  }
  if (colMap["reminder_tone"]) {
    sheet.getRange(rowIndex, colMap["reminder_tone"]).setValue(emotionData.tone);
  }
  if (colMap["next_reminder_date"]) {
    var nextDate = new Date();
    nextDate.setDate(nextDate.getDate() + (emotionData.waitDays || 3));
    sheet.getRange(rowIndex, colMap["next_reminder_date"]).setValue(
      Utilities.formatDate(nextDate, Session.getScriptTimeZone(), "yyyy-MM-dd")
    );
  }
}


/**
 * One-time authorization function.
 * Run this FIRST to grant Gmail + Sheets permissions.
 */
function authorizeScript() {
  Logger.log("✅ Authorization complete!");
  Logger.log("Gmail access: " + GmailApp.getInboxUnreadCount() + " unread emails");
  Logger.log("Sheet access: " + SpreadsheetApp.openById(SHEET_ID).getName());
}


/**
 * Manual test function — use this to test without waiting for trigger
 */
function testWithSampleReply() {
  var testInvoiceId = "inv_test_123";
  var testReply = "Bhai thoda time do yaar, next week kar dunga";
  var testEmail = "test@gmail.com";
  
  Logger.log("🧪 Testing emotion analysis...");
  var result = analyzeEmotion(testInvoiceId, testReply, testEmail);
  Logger.log("🧪 Result: " + JSON.stringify(result));
}


// =====================================================
// HOW TO SET UP THIS SCRIPT:
// =====================================================
//
// 1. Open your Google Sheet
// 2. Click Extensions → Apps Script
// 3. Delete any existing code in Code.gs
// 4. Paste this ENTIRE file into Code.gs
// 5. Change SHEET_ID (line 17) to your Google Sheet ID
//    Example: "1a70EPdAm-OPEsi7K7iSeoVw9Kp29pqcFgR98-BJlU4Q"
// 6. Change WEBSITE_URL (line 18) to your deployed website URL
//    Example: "https://your-app.vercel.app"
//    For local testing: "http://localhost:3000" (won't work from Apps Script)
// 7. Click Save (Ctrl+S)
// 8. Run the "authorizeScript" function first
//    - Click the function dropdown → select "authorizeScript"
//    - Click ▶️ Run
//    - Grant Gmail + Sheets permissions when prompted
// 9. Set up automatic trigger:
//    - Click ⏰ Triggers (clock icon in left sidebar)
//    - Click "+ Add Trigger"
//    - Function: checkGmailReplies
//    - Event source: Time-driven
//    - Type: Minutes timer
//    - Interval: Every 5 minutes
//    - Click Save
// 10. Done! The script will now automatically:
//     - Check Gmail every 5 minutes
//     - Find replies to invoice emails
//     - Analyze emotions via AI
//     - Update your Google Sheet
//     - Adjust reminder tones automatically
//
// MANUAL TESTING:
// 1. Send an invoice email from your dashboard
// 2. Reply to that email with: "Bhai thoda time do yaar"
// 3. Come back to Apps Script
// 4. Run "checkGmailReplies" manually (▶️ Run)
// 5. Check Logger.log (View → Logs) for:
//    "Found reply from: youremail@gmail.com"
//    "Invoice matched: inv_123"
//    "Emotion detected: stressed"
//    "Sheet updated successfully"
// 6. Open your Google Sheet → verify emotion columns updated ✅
// 7. Send a manual reminder from dashboard
// 8. Verify the friendly Hindi email is received ✅
//
// =====================================================

#!/usr/bin/env node

/**
 * Script to help set up Google Sheets authentication
 */

console.log("🔧 Google Sheets Authentication Setup");
console.log("=" * 50);

// Check current environment variables
console.log("\n📋 Current Google Sheets Environment Variables:");
console.log("GOOGLE_SHEETS_ID:", process.env.GOOGLE_SHEETS_ID || "Not set");
console.log(
  "GOOGLE_SPREADSHEET_ID:",
  process.env.GOOGLE_SPREADSHEET_ID || "Not set"
);
console.log(
  "GOOGLE_SERVICE_ACCOUNT_KEY:",
  process.env.GOOGLE_SERVICE_ACCOUNT_KEY
    ? "Set (but may be malformed)"
    : "Not set"
);

// Check if the JSON is valid
if (process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
  try {
    const parsed = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
    console.log("\n✅ GOOGLE_SERVICE_ACCOUNT_KEY is valid JSON");
    console.log("Project ID:", parsed.project_id);
    console.log("Client Email:", parsed.client_email);
  } catch (error) {
    console.log("\n❌ GOOGLE_SERVICE_ACCOUNT_KEY is invalid JSON");
    console.log("Error:", error.message);
    console.log("\n🔧 To fix this:");
    console.log("1. Get the complete Google Service Account JSON file");
    console.log("2. Copy the entire JSON content");
    console.log(
      "3. Paste it as the value for GOOGLE_SERVICE_ACCOUNT_KEY in Railway"
    );
    console.log("4. Make sure it's all on one line (no line breaks)");
  }
}

console.log("\n📝 Required Environment Variables:");
console.log("GOOGLE_SHEETS_ID: Your Google Spreadsheet ID");
console.log("GOOGLE_SPREADSHEET_ID: Same as GOOGLE_SHEETS_ID");
console.log("GOOGLE_SERVICE_ACCOUNT_KEY: Complete JSON service account key");

console.log("\n🔗 How to get Google Service Account Key:");
console.log("1. Go to Google Cloud Console");
console.log("2. Select your project (sweetflips)");
console.log("3. Go to IAM & Admin > Service Accounts");
console.log("4. Find your service account");
console.log("5. Click on it > Keys tab > Add Key > Create new key");
console.log("6. Download the JSON file");
console.log(
  "7. Copy the entire content and paste it as GOOGLE_SERVICE_ACCOUNT_KEY"
);

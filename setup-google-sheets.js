#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const readline = require("readline");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

async function setupGoogleSheets() {
  console.log("🚀 Google Sheets Integration Setup\n");

  console.log(
    "This script will help you configure Google Sheets integration for your bot.\n"
  );

  // Check if .env exists
  const envPath = path.join(__dirname, ".env");
  let envContent = "";

  if (fs.existsSync(envPath)) {
    envContent = fs.readFileSync(envPath, "utf8");
    console.log("✅ Found existing .env file");
  } else {
    console.log("📝 Creating new .env file");
  }

  // Get Google Sheets ID
  console.log("\n📊 Step 1: Google Sheets ID");
  console.log("1. Go to https://sheets.google.com");
  console.log("2. Create a new spreadsheet");
  console.log(
    "3. Copy the ID from the URL: https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit"
  );

  const sheetsId = await question("\nEnter your Google Sheets ID: ");

  if (!sheetsId.trim()) {
    console.log("❌ Google Sheets ID is required");
    process.exit(1);
  }

  // Get service account key file path
  console.log("\n🔑 Step 2: Service Account Key File");
  console.log("1. Go to https://console.cloud.google.com");
  console.log("2. Create a service account and download the JSON key");
  console.log("3. Place the file in your project directory");

  const keyFilePath = await question(
    "\nEnter the path to your service account key file (e.g., ./credentials/key.json): "
  );

  if (!keyFilePath.trim()) {
    console.log("❌ Service account key file path is required");
    process.exit(1);
  }

  // Check if key file exists
  if (!fs.existsSync(keyFilePath)) {
    console.log(`❌ Key file not found: ${keyFilePath}`);
    console.log("Please make sure the file exists and try again.");
    process.exit(1);
  }

  // Update .env file
  console.log("\n📝 Updating .env file...");

  // Remove existing Google Sheets config if present
  envContent = envContent.replace(/^GOOGLE_SHEETS_ID=.*$/gm, "");
  envContent = envContent.replace(/^GOOGLE_SERVICE_ACCOUNT_KEY_FILE=.*$/gm, "");

  // Add new config
  const newConfig = `
# Google Sheets Integration
GOOGLE_SHEETS_ID=${sheetsId.trim()}
GOOGLE_SERVICE_ACCOUNT_KEY_FILE=${keyFilePath.trim()}`;

  envContent += newConfig;

  // Write .env file
  fs.writeFileSync(envPath, envContent);

  console.log("✅ .env file updated successfully!");

  // Create credentials directory if it doesn't exist
  const credentialsDir = path.dirname(keyFilePath);
  if (!fs.existsSync(credentialsDir)) {
    fs.mkdirSync(credentialsDir, { recursive: true });
    console.log(`✅ Created directory: ${credentialsDir}`);
  }

  // Test the configuration
  console.log("\n🧪 Testing configuration...");

  try {
    const { google } = require("googleapis");
    const auth = new google.auth.GoogleAuth({
      keyFile: keyFilePath,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });

    const sheets = google.sheets({ version: "v4", auth });

    // Test access to the spreadsheet
    await sheets.spreadsheets.get({
      spreadsheetId: sheetsId.trim(),
    });

    console.log("✅ Google Sheets access test successful!");
    console.log("✅ Configuration is ready!");
  } catch (error) {
    console.log("❌ Configuration test failed:");
    console.log(error.message);
    console.log("\nPlease check:");
    console.log("1. The spreadsheet ID is correct");
    console.log("2. The service account key file is valid");
    console.log("3. The service account has access to the spreadsheet");
    console.log("4. The Google Sheets API is enabled in your project");
  }

  console.log("\n🎉 Setup complete!");
  console.log("\nNext steps:");
  console.log(
    "1. Make sure to share your Google Sheets with the service account email"
  );
  console.log("2. Start your bot: node test-polling-bot.js");
  console.log("3. Test with: /kick command");

  rl.close();
}

// Run setup
setupGoogleSheets().catch(console.error);

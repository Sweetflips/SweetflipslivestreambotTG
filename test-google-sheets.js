const { google } = require("googleapis");
require("dotenv").config();

async function testGoogleSheets() {
  console.log("🧪 Testing Google Sheets connection...");

  const GOOGLE_SHEETS_ID = process.env.GOOGLE_SHEETS_ID;
  const GOOGLE_SERVICE_ACCOUNT_KEY_FILE =
    process.env.GOOGLE_SERVICE_ACCOUNT_KEY_FILE;

  console.log("📊 Spreadsheet ID:", GOOGLE_SHEETS_ID);
  console.log("🔑 Key file:", GOOGLE_SERVICE_ACCOUNT_KEY_FILE);

  if (!GOOGLE_SHEETS_ID || !GOOGLE_SERVICE_ACCOUNT_KEY_FILE) {
    console.log("❌ Missing environment variables!");
    console.log("Make sure .env file contains:");
    console.log(
      "GOOGLE_SHEETS_ID=1giec5bb4Pmjywhfn_oy3aIESJ25XHi5kDwjXyoQbglQ"
    );
    console.log(
      "GOOGLE_SERVICE_ACCOUNT_KEY_FILE=./credentials/sweetflips-7086906ae249.json"
    );
    return;
  }

  try {
    const auth = new google.auth.GoogleAuth({
      keyFile: GOOGLE_SERVICE_ACCOUNT_KEY_FILE,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });

    const sheets = google.sheets({ version: "v4", auth });

    // Test access to the spreadsheet
    const response = await sheets.spreadsheets.get({
      spreadsheetId: GOOGLE_SHEETS_ID,
    });

    console.log("✅ Google Sheets access successful!");
    console.log("📋 Spreadsheet title:", response.data.properties.title);

    // Test adding a row
    const testData = [
      [
        "Test Telegram ID",
        "Test Username",
        "Test Kick",
        "2024-01-18",
        "VIEWER",
        new Date().toISOString(),
      ],
    ];

    await sheets.spreadsheets.values.append({
      spreadsheetId: GOOGLE_SHEETS_ID,
      range: "Sheet1!A:F",
      valueInputOption: "RAW",
      requestBody: { values: testData },
    });

    console.log("✅ Test data added successfully!");
    console.log("🎉 Google Sheets integration is working!");
  } catch (error) {
    console.log("❌ Google Sheets test failed:");
    console.log(error.message);

    if (error.message.includes("Permission denied")) {
      console.log("\n🔧 Fix: Share your spreadsheet with this email:");
      console.log("sweetflipskick@sweetflips.iam.gserviceaccount.com");
    }
  }
}

testGoogleSheets();

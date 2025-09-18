#!/usr/bin/env node

/**
 * Test Google Sheets connection
 */

const { google } = require('googleapis');

async function testGoogleSheets() {
  console.log("🧪 Testing Google Sheets connection...");
  
  try {
    // Check environment variables
    if (!process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
      console.error("❌ GOOGLE_SERVICE_ACCOUNT_KEY not set");
      return;
    }
    
    if (!process.env.GOOGLE_SPREADSHEET_ID) {
      console.error("❌ GOOGLE_SPREADSHEET_ID not set");
      return;
    }
    
    // Parse the service account key
    let credentials;
    try {
      credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
      console.log("✅ Service account key parsed successfully");
    } catch (error) {
      console.error("❌ Failed to parse GOOGLE_SERVICE_ACCOUNT_KEY:", error.message);
      return;
    }
    
    // Initialize Google Sheets
    const auth = new google.auth.GoogleAuth({
      credentials: credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    
    const sheets = google.sheets({ version: 'v4', auth });
    
    // Test connection by reading the spreadsheet
    console.log("🔍 Testing spreadsheet access...");
    const response = await sheets.spreadsheets.get({
      spreadsheetId: process.env.GOOGLE_SPREADSHEET_ID,
    });
    
    console.log("✅ Google Sheets connection successful!");
    console.log("📊 Spreadsheet title:", response.data.properties.title);
    console.log("📋 Sheets:", response.data.sheets.map(sheet => sheet.properties.title).join(', '));
    
  } catch (error) {
    console.error("❌ Google Sheets connection failed:", error.message);
    
    if (error.message.includes('Unexpected token')) {
      console.error("\n🔧 This looks like a JSON parsing error.");
      console.error("Make sure your GOOGLE_SERVICE_ACCOUNT_KEY is valid JSON.");
    }
  }
}

testGoogleSheets();
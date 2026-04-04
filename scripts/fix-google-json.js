#!/usr/bin/env node

/**
 * Script to help fix Google Service Account JSON formatting
 */

const fs = require("fs");
const path = require("path");

console.log("🔧 Google Service Account JSON Fixer");
console.log("=" * 50);

// Read the JSON file
const jsonPath = path.join(
  __dirname,
  "credentials",
  "sweetflips-7086906ae249.json"
);

try {
  const jsonContent = fs.readFileSync(jsonPath, "utf8");
  console.log("✅ Successfully read JSON file");

  // Parse to validate
  const parsed = JSON.parse(jsonContent);
  console.log("✅ JSON is valid");
  console.log("📧 Client Email:", parsed.client_email);
  console.log("🆔 Project ID:", parsed.project_id);

  // Create the single-line version for Railway
  const singleLineJson = JSON.stringify(parsed);
  console.log("\n📋 Copy this EXACT value for Railway:");
  console.log("=" * 50);
  console.log(singleLineJson);
  console.log("=" * 50);

  console.log("\n📝 Instructions:");
  console.log("1. Copy the JSON above (the single line between the === lines)");
  console.log("2. Go to Railway > Your Bot Service > Variables");
  console.log("3. Find GOOGLE_SERVICE_ACCOUNT_KEY");
  console.log("4. Paste the copied JSON as the value");
  console.log("5. Deploy your service");
} catch (error) {
  console.error("❌ Error reading or parsing JSON file:", error.message);
  console.log("\n🔧 Make sure the file exists at:", jsonPath);
}

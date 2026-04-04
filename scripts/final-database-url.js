#!/usr/bin/env node

/**
 * Final DATABASE_URL with actual resolved values
 */

console.log("🎯 FINAL DATABASE_URL FOR YOUR BOT SERVICE");
console.log("=".repeat(60));

// Actual resolved values from Railway
const domain = "shortline.proxy.rlwy.net";
const port = "14192";
const user = "postgres";
const password = "jchbUGUWVyjMGnYwTChaObqSTzLAorOb";
const database = "railway";

// Construct the final DATABASE_URL
const databaseUrl = `postgresql://${user}:${password}@${domain}:${port}/${database}`;

console.log("📋 COPY THIS EXACT VALUE:");
console.log("=".repeat(60));
console.log(databaseUrl);
console.log("=".repeat(60));

console.log("\n📝 INSTRUCTIONS:");
console.log("1. Copy the DATABASE_URL above");
console.log("2. Go to Railway → Your Bot Service → Variables");
console.log("3. Add new variable:");
console.log("   Name: DATABASE_URL");
console.log("   Value: [paste the URL above]");
console.log("4. Save and redeploy your bot service");

console.log("\n✅ This should fix the 'empty host' error!");


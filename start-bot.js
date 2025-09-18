#!/usr/bin/env node

/**
 * Start script that ensures database is ready before starting the bot
 */

const { execSync } = require("child_process");
const path = require("path");

console.log("🚀 Starting bot with Google Sheets integration...");

try {
  // Start the bot directly (no database setup needed)
  console.log("🤖 Starting bot...");
  execSync("node bot.js", { stdio: "inherit" });
} catch (error) {
  console.error("❌ Failed to start bot:", error.message);
  process.exit(1);
}

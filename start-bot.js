#!/usr/bin/env node

/**
 * Start script that ensures database is ready before starting the bot
 */

const { execSync } = require("child_process");
const path = require("path");

console.log("🚀 Starting bot with database and Google Sheets integration...");

try {
  // Check if DATABASE_URL is set
  if (!process.env.DATABASE_URL) {
    console.log("⚠️ No DATABASE_URL found, starting without database");
  } else {
    console.log("📊 Setting up database...");
    
    // Generate Prisma client
    console.log("🔧 Generating Prisma client...");
    execSync("npx prisma generate", { 
      stdio: "inherit",
      cwd: path.join(__dirname, "apps", "api")
    });
    
    // Push database schema (creates tables if they don't exist)
    console.log("🗄️ Setting up database tables...");
    execSync("npx prisma db push", { 
      stdio: "inherit",
      cwd: path.join(__dirname, "apps", "api")
    });
    
    console.log("✅ Database setup complete!");
  }
  
  // Start the bot
  console.log("🤖 Starting bot...");
  execSync("node bot.js", { stdio: "inherit" });
} catch (error) {
  console.error("❌ Failed to start bot:", error.message);
  process.exit(1);
}

#!/usr/bin/env node

/**
 * Start script that ensures database is ready before starting the bot
 */

const { execSync } = require("child_process");
const path = require("path");

console.log("🚀 Starting bot with database setup...");

// Check if DATABASE_URL is set
if (!process.env.DATABASE_URL) {
  console.error("❌ DATABASE_URL environment variable is not set!");
  console.error("Please add a PostgreSQL database to your Railway project.");
  console.error("Railway will automatically set the DATABASE_URL variable.");
  process.exit(1);
}

// Check if DATABASE_URL is valid
if (!process.env.DATABASE_URL.startsWith('postgresql://') && !process.env.DATABASE_URL.startsWith('postgres://')) {
  console.error("❌ DATABASE_URL is not a valid PostgreSQL URL!");
  console.error("Expected format: postgresql://user:password@host:port/database");
  console.error("Current value:", process.env.DATABASE_URL);
  process.exit(1);
}

try {
  // Change to the apps/api directory for Prisma commands
  process.chdir(path.join(__dirname, "apps", "api"));

  // Step 1: Generate Prisma client
  console.log("📦 Generating Prisma client...");
  execSync("npx prisma generate", { stdio: "inherit" });

  // Step 2: Push schema to database
  console.log("🗄️  Creating database tables...");
  execSync("npx prisma db push --force-reset", { stdio: "inherit" });

  console.log("✅ Database setup completed!");

  // Step 3: Start the bot
  console.log("🤖 Starting bot...");
  process.chdir(__dirname); // Go back to root directory
  execSync("node bot.js", { stdio: "inherit" });
} catch (error) {
  console.error("❌ Failed to start bot:", error.message);
  console.error("\n🔍 Debug information:");
  console.error("DATABASE_URL:", process.env.DATABASE_URL ? "Set" : "Not set");
  console.error("NODE_ENV:", process.env.NODE_ENV || "Not set");
  process.exit(1);
}

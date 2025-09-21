const fs = require("fs");
const path = require("path");

console.log("🚀 Setting up Simple Bot Configuration...\n");

// Update .env for simple setup without Docker
const envPath = path.join(__dirname, "apps", "api", ".env");

try {
  let envContent = fs.readFileSync(envPath, "utf8");

  // Use SQLite instead of PostgreSQL for simplicity
  envContent = envContent.replace(
    "DATABASE_URL=postgresql://postgres:password@localhost:5432/sweetflips_bot",
    "DATABASE_URL=file:./dev.db"
  );

  // Remove Redis dependency for now
  envContent = envContent.replace(
    "REDIS_URL=redis://localhost:6379",
    "REDIS_URL=memory://localhost"
  );

  // Set webhook URL for local testing
  envContent = envContent.replace(
    "TELEGRAM_WEBHOOK_URL=https://your-domain.com/webhook/telegram",
    "TELEGRAM_WEBHOOK_URL=http://localhost:3000/webhook/telegram"
  );

  fs.writeFileSync(envPath, envContent);
  console.log("✅ Updated .env for simple setup (SQLite + Memory Redis)");
} catch (error) {
  console.log("❌ Could not update .env file:", error.message);
}

console.log("\n📋 Next steps:");
console.log(
  "1. Update Prisma schema for SQLite: cd apps/api && npx prisma db push"
);
console.log("2. Restart the bot: npm run dev");
console.log("3. Message your bot with /start or /kick");
console.log("4. Set yourself as owner: node setup-owner.js");
console.log("\n🎉 Simple setup complete!");

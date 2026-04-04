#!/usr/bin/env node

/**
 * Test script to verify database connection from bot service
 */

console.log("🔍 Testing database connection from bot service...");

// Check if DATABASE_URL is accessible
console.log("\n📋 Environment Variables:");
console.log(
  "DATABASE_URL:",
  process.env.DATABASE_URL ? "✅ Set" : "❌ Not set"
);
console.log("NODE_ENV:", process.env.NODE_ENV || "Not set");

if (process.env.DATABASE_URL) {
  console.log("\n🔗 DATABASE_URL format check:");
  const url = process.env.DATABASE_URL;

  // Mask sensitive parts for display
  const maskedUrl = url.replace(/(:\/\/[^:]+:)[^@]+(@)/, "$1***$2");
  console.log("URL:", maskedUrl);

  if (url.startsWith("postgresql://") || url.startsWith("postgres://")) {
    console.log("✅ Valid PostgreSQL URL format");

    // Try to connect to the database
    console.log("\n🔌 Testing database connection...");
    try {
      const { PrismaClient } = require("@prisma/client");
      const prisma = new PrismaClient();

      // Test connection
      prisma
        .$connect()
        .then(() => {
          console.log("✅ Database connection successful!");
          return prisma.$disconnect();
        })
        .then(() => {
          console.log("🎉 Database is ready for use!");
          process.exit(0);
        })
        .catch((error) => {
          console.error("❌ Database connection failed:", error.message);
          process.exit(1);
        });
    } catch (error) {
      console.error("❌ Failed to create Prisma client:", error.message);
      process.exit(1);
    }
  } else {
    console.log("❌ Invalid URL format");
    process.exit(1);
  }
} else {
  console.log("\n❌ DATABASE_URL is not accessible from bot service!");
  console.log("This might mean:");
  console.log("1. The database service is not properly linked");
  console.log("2. The services are in different Railway projects");
  console.log("3. There's a Railway configuration issue");
  process.exit(1);
}

#!/usr/bin/env node

/**
 * Simple script to create database tables
 * Run this manually if the automatic setup fails
 */

const { PrismaClient } = require("@prisma/client");
const { execSync } = require("child_process");

async function createTables() {
  console.log("🚀 Creating database tables...");

  try {
    // Step 1: Generate Prisma client
    console.log("📦 Generating Prisma client...");
    execSync("npx prisma generate", { stdio: "inherit" });

    // Step 2: Push schema to database
    console.log("🗄️  Pushing schema to database...");
    execSync("npx prisma db push --force-reset", { stdio: "inherit" });

    // Step 3: Test connection
    console.log("🔍 Testing database connection...");
    const prisma = new PrismaClient();
    await prisma.$connect();

    // Step 4: Verify tables exist
    console.log("📊 Checking tables...");
    const tables = await prisma.$queryRaw`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
    `;

    console.log("✅ Tables created:", tables);

    await prisma.$disconnect();
    console.log("🎉 Database setup completed successfully!");
  } catch (error) {
    console.error("❌ Database setup failed:", error.message);
    process.exit(1);
  }
}

createTables();

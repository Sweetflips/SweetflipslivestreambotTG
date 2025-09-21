#!/usr/bin/env node

/**
 * Script to help get the actual Railway database URL
 * This will show you the resolved values instead of template variables
 */

console.log("🔍 Railway Database URL Helper");
console.log("=====================================");

// Check if we're in Railway environment
if (process.env.RAILWAY_ENVIRONMENT) {
  console.log("✅ Running in Railway environment");
  console.log(`Environment: ${process.env.RAILWAY_ENVIRONMENT}`);
} else {
  console.log("⚠️ Not running in Railway environment");
}

console.log("\n📊 Database Environment Variables:");
console.log("=====================================");

const dbVars = [
  "DATABASE_URL",
  "DATABASE_PUBLIC_URL",
  "POSTGRES_USER",
  "POSTGRES_PASSWORD",
  "POSTGRES_DB",
  "PGUSER",
  "PGPASSWORD",
  "PGDATABASE",
  "RAILWAY_TCP_PROXY_DOMAIN",
  "RAILWAY_TCP_PROXY_PORT",
  "RAILWAY_PRIVATE_DOMAIN",
];

dbVars.forEach((varName) => {
  const value = process.env[varName];
  if (value) {
    // Mask password for security
    const displayValue =
      varName.includes("PASSWORD") || varName.includes("PASS")
        ? value.substring(0, 4) + "***"
        : value;
    console.log(`${varName}: ${displayValue}`);
  } else {
    console.log(`${varName}: (not set)`);
  }
});

console.log("\n🔧 Recommended DATABASE_URL:");
console.log("=====================================");

// Try to construct the URL
const postgresUser = process.env.POSTGRES_USER || process.env.PGUSER;
const postgresPassword =
  process.env.POSTGRES_PASSWORD || process.env.PGPASSWORD;
const postgresDb = process.env.POSTGRES_DB || process.env.PGDATABASE;
const proxyDomain = process.env.RAILWAY_TCP_PROXY_DOMAIN;
const proxyPort = process.env.RAILWAY_TCP_PROXY_PORT;

if (
  postgresUser &&
  postgresPassword &&
  postgresDb &&
  proxyDomain &&
  proxyPort
) {
  const constructedUrl = `postgresql://${postgresUser}:${postgresPassword}@${proxyDomain}:${proxyPort}/${postgresDb}`;
  console.log("✅ Use this DATABASE_URL in your bot service:");
  console.log(constructedUrl);
} else {
  console.log("❌ Missing required variables to construct DATABASE_URL");
  console.log("Missing:");
  if (!postgresUser) console.log("  - POSTGRES_USER or PGUSER");
  if (!postgresPassword) console.log("  - POSTGRES_PASSWORD or PGPASSWORD");
  if (!postgresDb) console.log("  - POSTGRES_DB or PGDATABASE");
  if (!proxyDomain) console.log("  - RAILWAY_TCP_PROXY_DOMAIN");
  if (!proxyPort) console.log("  - RAILWAY_TCP_PROXY_PORT");
}

console.log("\n📝 Instructions:");
console.log("=====================================");
console.log("1. Copy the DATABASE_URL above");
console.log("2. Go to your Railway bot service");
console.log("3. Add DATABASE_URL as an environment variable");
console.log("4. Redeploy your bot service");

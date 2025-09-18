#!/usr/bin/env node

/**
 * Script to get the actual Railway database connection details
 */

console.log("🔍 Getting Railway database connection details...");

// Check all environment variables that might contain database info
const dbVars = [
  "DATABASE_URL",
  "DATABASE_PUBLIC_URL",
  "RAILWAY_TCP_PROXY_DOMAIN",
  "RAILWAY_TCP_PROXY_PORT",
  "RAILWAY_PRIVATE_DOMAIN",
  "PGHOST",
  "PGPORT",
  "PGDATABASE",
  "PGUSER",
  "PGPASSWORD",
  "POSTGRES_DB",
  "POSTGRES_USER",
  "POSTGRES_PASSWORD",
];

console.log("\n📋 Database-related environment variables:");
dbVars.forEach((varName) => {
  const value = process.env[varName];
  if (value) {
    // Mask password in URLs
    const maskedValue = value.replace(/(:\/\/[^:]+:)[^@]+(@)/, "$1***$2");
    console.log(`${varName}: ${maskedValue}`);
  } else {
    console.log(`${varName}: Not set`);
  }
});

// Try to construct a working DATABASE_URL
console.log("\n🔧 Suggested DATABASE_URL values:");

// Option 1: Use DATABASE_PUBLIC_URL if available
if (process.env.DATABASE_PUBLIC_URL) {
  console.log("Option 1 (Public URL):");
  console.log(`DATABASE_URL="${process.env.DATABASE_PUBLIC_URL}"`);
}

// Option 2: Use direct values if available
if (
  process.env.PGHOST &&
  process.env.PGPORT &&
  process.env.PGDATABASE &&
  process.env.PGUSER &&
  process.env.PGPASSWORD
) {
  const directUrl = `postgresql://${process.env.PGUSER}:${process.env.PGPASSWORD}@${process.env.PGHOST}:${process.env.PGPORT}/${process.env.PGDATABASE}`;
  console.log("Option 2 (Direct values):");
  console.log(`DATABASE_URL="${directUrl}"`);
}

// Option 3: Use Railway TCP Proxy if available
if (
  process.env.RAILWAY_TCP_PROXY_DOMAIN &&
  process.env.RAILWAY_TCP_PROXY_PORT
) {
  const proxyUrl = `postgresql://postgres:${
    process.env.POSTGRES_PASSWORD || process.env.PGPASSWORD
  }@${process.env.RAILWAY_TCP_PROXY_DOMAIN}:${
    process.env.RAILWAY_TCP_PROXY_PORT
  }/railway`;
  console.log("Option 3 (TCP Proxy):");
  console.log(`DATABASE_URL="${proxyUrl}"`);
}

console.log("\n📝 Instructions:");
console.log("1. Copy one of the suggested DATABASE_URL values above");
console.log("2. Go to your Railway bot service Variables tab");
console.log("3. Update the DATABASE_URL variable with the copied value");
console.log("4. Deploy your service");

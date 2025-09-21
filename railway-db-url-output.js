#!/usr/bin/env node

/**
 * Simple script to output the Railway DATABASE_URL for copy-pasting
 */

// Get the actual values (not template variables)
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
  const databaseUrl = `postgresql://${postgresUser}:${postgresPassword}@${proxyDomain}:${proxyPort}/${postgresDb}`;

  console.log("=".repeat(80));
  console.log("COPY THIS DATABASE_URL TO YOUR BOT SERVICE:");
  console.log("=".repeat(80));
  console.log(databaseUrl);
  console.log("=".repeat(80));
  console.log("Instructions:");
  console.log("1. Copy the URL above");
  console.log("2. Go to Railway → Your Bot Service → Variables");
  console.log("3. Add DATABASE_URL with the value above");
  console.log("4. Redeploy your bot service");
  console.log("=".repeat(80));
} else {
  console.log(
    "❌ Cannot construct DATABASE_URL - missing environment variables"
  );
  console.log("Available variables:");
  console.log(`POSTGRES_USER: ${postgresUser ? "✅" : "❌"}`);
  console.log(`POSTGRES_PASSWORD: ${postgresPassword ? "✅" : "❌"}`);
  console.log(`POSTGRES_DB: ${postgresDb ? "✅" : "❌"}`);
  console.log(`RAILWAY_TCP_PROXY_DOMAIN: ${proxyDomain ? "✅" : "❌"}`);
  console.log(`RAILWAY_TCP_PROXY_PORT: ${proxyPort ? "✅" : "❌"}`);
}


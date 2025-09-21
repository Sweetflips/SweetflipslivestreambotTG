#!/usr/bin/env node

/**
 * Construct the final DATABASE_URL using the actual values from Railway
 */

console.log("🔧 Constructing Railway DATABASE_URL");
console.log("=====================================");

// From your Railway database variables
const POSTGRES_USER = "postgres";
const POSTGRES_PASSWORD = "jchbUGUWVyjMGnYwTChaObqSTzLAorOb";
const POSTGRES_DB = "railway";

console.log("📊 Database Credentials:");
console.log(`User: ${POSTGRES_USER}`);
console.log(`Password: ${POSTGRES_PASSWORD.substring(0, 4)}***`);
console.log(`Database: ${POSTGRES_DB}`);

console.log("\n🔗 DATABASE_URL Options:");
console.log("=====================================");

// Option 1: Using TCP Proxy (recommended for external connections)
console.log("Option 1 - TCP Proxy (Recommended):");
console.log(
  "postgresql://postgres:jchbUGUWVyjMGnYwTChaObqSTzLAorOb@${{RAILWAY_TCP_PROXY_DOMAIN}}:${{RAILWAY_TCP_PROXY_PORT}}/railway"
);

// Option 2: Using Private Domain (for internal connections)
console.log("\nOption 2 - Private Domain:");
console.log(
  "postgresql://postgres:jchbUGUWVyjMGnYwTChaObqSTzLAorOb@${{RAILWAY_PRIVATE_DOMAIN}}:5432/railway"
);

console.log("\n⚠️  IMPORTANT:");
console.log("=====================================");
console.log(
  "The template variables ${{RAILWAY_TCP_PROXY_DOMAIN}} and ${{RAILWAY_TCP_PROXY_PORT}}"
);
console.log("need to be resolved to actual values in your bot service.");
console.log("");
console.log("You need to:");
console.log("1. Go to your Railway database service");
console.log("2. Check the 'Connect' tab or 'Variables' tab");
console.log("3. Find the actual resolved values for:");
console.log("   - RAILWAY_TCP_PROXY_DOMAIN");
console.log("   - RAILWAY_TCP_PROXY_PORT");
console.log("4. Replace the template variables with actual values");

console.log("\n🎯 Alternative Solution:");
console.log("=====================================");
console.log("Try using the DATABASE_PUBLIC_URL that Railway provides:");
console.log(
  "postgresql://postgres:jchbUGUWVyjMGnYwTChaObqSTzLAorOb@${{RAILWAY_TCP_PROXY_DOMAIN}}:${{RAILWAY_TCP_PROXY_PORT}}/railway"
);
console.log("");
console.log(
  "But you need to replace ${{RAILWAY_TCP_PROXY_DOMAIN}} and ${{RAILWAY_TCP_PROXY_PORT}}"
);
console.log(
  "with the actual resolved values from your Railway database service."
);


#!/usr/bin/env node

/**
 * Simple script to show all database-related environment variables
 */

console.log(
  "🔍 All environment variables containing 'DATABASE', 'POSTGRES', 'PG', or 'RAILWAY':"
);
console.log("=" * 80);

// Get all environment variables
const allVars = Object.keys(process.env).sort();

allVars.forEach((varName) => {
  const value = process.env[varName];

  // Check if it's database-related
  if (
    varName.includes("DATABASE") ||
    varName.includes("POSTGRES") ||
    varName.includes("PG") ||
    varName.includes("RAILWAY")
  ) {
    // Mask sensitive information
    let displayValue = value;
    if (varName.includes("PASSWORD") || varName.includes("URL")) {
      displayValue = value.replace(/(:\/\/[^:]+:)[^@]+(@)/, "$1***$2");
    }

    console.log(`${varName}: ${displayValue}`);
  }
});

console.log("\n" + "=" * 80);
console.log("📝 Instructions:");
console.log(
  "1. Look for variables with actual resolved values (not template variables)"
);
console.log("2. Use those values to construct your DATABASE_URL");
console.log(
  "3. The format should be: postgresql://user:password@host:port/database"
);

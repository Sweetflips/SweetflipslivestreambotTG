#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

// Read the JSON file
const jsonPath = path.join(
  __dirname,
  "credentials",
  "sweetflips-7086906ae249.json"
);
const jsonContent = fs.readFileSync(jsonPath, "utf8");
const parsed = JSON.parse(jsonContent);

// Create the single-line version for Railway
const singleLineJson = JSON.stringify(parsed);

console.log("Copy this EXACT value for Railway GOOGLE_SERVICE_ACCOUNT_KEY:");
console.log("");
console.log(singleLineJson);
console.log("");
console.log("Instructions:");
console.log("1. Copy the JSON above");
console.log("2. Go to Railway > Your Bot Service > Variables");
console.log("3. Find GOOGLE_SERVICE_ACCOUNT_KEY");
console.log("4. Paste the copied JSON as the value");
console.log("5. Deploy your service");

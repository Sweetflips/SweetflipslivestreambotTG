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

// Write to a file
const output = `RAILWAY ENVIRONMENT VARIABLE:

Variable Name: GOOGLE_SERVICE_ACCOUNT_KEY

Variable Value:
${singleLineJson}

Instructions:
1. Copy the JSON value above
2. Go to Railway > Your Bot Service > Variables
3. Find GOOGLE_SERVICE_ACCOUNT_KEY
4. Paste the copied JSON as the value
5. Deploy your service
`;

fs.writeFileSync("railway-google-key.txt", output);
console.log("✅ Railway JSON saved to railway-google-key.txt");
console.log("📁 Open that file to get your Railway environment variable");

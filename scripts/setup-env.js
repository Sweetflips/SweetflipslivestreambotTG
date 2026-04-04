const fs = require("fs");

// Create .env file with Google Sheets configuration
const envContent = `GOOGLE_SHEETS_ID=1giec5bb4Pmjywhfn_oy3aIESJ25XHi5kDwjXyoQbglQ
GOOGLE_SERVICE_ACCOUNT_KEY_FILE=./credentials/sweetflips-7086906ae249.json`;

fs.writeFileSync(".env", envContent);
console.log("✅ .env file created successfully!");
console.log("📄 Contents:");
console.log(envContent);

const fs = require("fs");
const readline = require("readline");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

async function setupLiveBalance() {
  console.log("🔧 Setting up Live Balance API integration...\n");

  try {
    // Read current .env file
    let envContent = "";
    if (fs.existsSync(".env")) {
      envContent = fs.readFileSync(".env", "utf8");
    }

    // Ask for bearer token
    const bearerToken = await new Promise((resolve) => {
      rl.question("Enter your Live Balance API Bearer Token: ", resolve);
    });

    // Ask for API URL
    const apiUrl = await new Promise((resolve) => {
      rl.question(
        "Enter the Live Balance API URL (or press Enter for default): ",
        (answer) => {
          resolve(answer.trim() || "https://api.example.com/balance");
        }
      );
    });

    // Update .env content
    const newEnvLines = [
      `LIVE_BALANCE_BEARER_TOKEN=${bearerToken}`,
      `LIVE_BALANCE_API_URL=${apiUrl}`,
    ];

    // Remove existing lines if they exist
    const lines = envContent.split("\n");
    const filteredLines = lines.filter(
      (line) =>
        !line.startsWith("LIVE_BALANCE_BEARER_TOKEN=") &&
        !line.startsWith("LIVE_BALANCE_API_URL=")
    );

    // Add new lines
    const updatedContent = [...filteredLines, ...newEnvLines].join("\n");

    // Write to .env file
    fs.writeFileSync(".env", updatedContent);

    console.log("\n✅ Live Balance API configuration saved to .env file!");
    console.log("\n📋 Configuration:");
    console.log(`Bearer Token: ${bearerToken.substring(0, 10)}...`);
    console.log(`API URL: ${apiUrl}`);

    console.log(
      "\n🚀 You can now restart the bot to use live balance features!"
    );
    console.log("\n📖 Available commands:");
    console.log("- /leaderboard - View live balance leaderboard (viewers)");
    console.log("- /balance live - View live balance leaderboard (admins)");
  } catch (error) {
    console.error("❌ Error setting up live balance:", error);
  } finally {
    rl.close();
  }
}

setupLiveBalance();

const { Telegraf } = require("telegraf");
const { PrismaClient } = require("@prisma/client");
const { google } = require("googleapis");
require("dotenv").config();

// Your bot token
const BOT_TOKEN = "8422817933:AAHm0YU707fnBeuehr-QrFJD-4A9M6aTCPc";

const bot = new Telegraf(BOT_TOKEN);
const prisma = new PrismaClient();

// Google Sheets configuration
const GOOGLE_SHEETS_ID = process.env.GOOGLE_SHEETS_ID || "";
const GOOGLE_SERVICE_ACCOUNT_KEY_FILE =
  process.env.GOOGLE_SERVICE_ACCOUNT_KEY_FILE;

// Live Balance configuration
const LIVE_BALANCE_API_URL = "https://api.razed.com/player/api/v1/wallets";
const LIVE_BALANCE_BEARER_TOKEN =
  "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJodHRwczovL2FwaS5yYXplZC5jb20vcGxheWVyL2FwaS92MS9zaWduaW4iLCJpYXQiOjE3NTcwNjM3NzQsImV4cCI6MTc2NDgzOTc3NCwibmJmIjoxNzU3MDYzNzc0LCJqdGkiOiI2blNlaTNNZzJjNGNtYk9aIiwic3ViIjoiNzQ4MjkiLCJwcnYiOiJlNjE3N2NkY2I2MWZmNmRlMzZiZTM3ODg5Yjk5OWNhZWY4YjQxMzQzIn0.Xy7XGY48EX5sqXI7UIM-dfatwZM2MLrXTjOpH5_wZ6E";

// Google Sheets service
class GoogleSheetsService {
  constructor() {
    this.sheets = null;
    this.spreadsheetId = GOOGLE_SHEETS_ID;
    this.range = "Sheet1!A:F";

    if (!this.spreadsheetId) {
      console.log(
        "⚠️ Google Sheets ID not configured. Sheets integration disabled."
      );
      return;
    }

    this.initializeSheets();
  }

  async initializeSheets() {
    try {
      if (!GOOGLE_SERVICE_ACCOUNT_KEY_FILE) {
        console.log(
          "⚠️ Google Service Account key file not configured. Sheets integration disabled."
        );
        return;
      }

      const auth = new google.auth.GoogleAuth({
        keyFile: GOOGLE_SERVICE_ACCOUNT_KEY_FILE,
        scopes: ["https://www.googleapis.com/auth/spreadsheets"],
      });

      this.sheets = google.sheets({ version: "v4", auth });

      await this.initializeSheet();
      console.log("✅ Google Sheets service initialized successfully");
    } catch (error) {
      console.error("❌ Failed to initialize Google Sheets service:", error);
    }
  }

  async initializeSheet() {
    try {
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: "Sheet1!A1:F1",
      });

      const values = response.data.values;

      if (!values || values.length === 0) {
        await this.sheets.spreadsheets.values.update({
          spreadsheetId: this.spreadsheetId,
          range: "Sheet1!A1:F1",
          valueInputOption: "RAW",
          requestBody: {
            values: [
              [
                "Telegram ID",
                "Telegram Username",
                "Kick Username",
                "Linked Date",
                "Role",
                "Timestamp",
              ],
            ],
          },
        });
        console.log("✅ Google Sheets headers initialized");
      }
    } catch (error) {
      console.error("❌ Failed to initialize sheet headers:", error);
    }
  }

  async addLinkedAccount(account) {
    if (!this.sheets) {
      console.log("⚠️ Google Sheets not initialized. Skipping account sync.");
      return false;
    }

    try {
      const values = [
        [
          account.telegramId,
          account.telegramUsername,
          account.kickUsername,
          account.linkedAt.toISOString().split("T")[0],
          account.role,
          new Date().toISOString(),
        ],
      ];

      await this.sheets.spreadsheets.values.append({
        spreadsheetId: this.spreadsheetId,
        range: this.range,
        valueInputOption: "RAW",
        requestBody: { values },
      });

      console.log(
        `✅ Linked account synced to Google Sheets: ${account.telegramUsername} -> ${account.kickUsername}`
      );
      return true;
    } catch (error) {
      console.error("❌ Failed to sync account to Google Sheets:", error);
      return false;
    }
  }
}

// Live Balance Service
// Live Balance Service
class LiveBalanceService {
  constructor(apiUrl, bearerToken) {
    this.apiUrl = apiUrl;
    this.bearerToken = bearerToken;
    this.lastBalance = null;
    this.lastUpdate = null;
  }

  async fetchCurrentBalance() {
    try {
      const response = await fetch(this.apiUrl, {
        method: "GET",
        headers: {
          Accept: "application/json",
          "Accept-Encoding": "gzip, deflate, br, zstd",
          "Accept-Language": "en-US,en;q=0.5",
          Authorization: `Bearer ${this.bearerToken}`,
          Connection: "keep-alive",
          Host: "api.razed.com",
          Origin: "https://www.razed.com",
          Referer: "https://www.razed.com/",
          "Sec-Fetch-Dest": "empty",
          "Sec-Fetch-Mode": "cors",
          "Sec-Fetch-Site": "same-site",
          TE: "trailers",
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:142.0) Gecko/20100101 Firefox/142.0",
          "x-client-id": "966344738.1750169000",
          "x-next-env": "production",
          "x-next-env-type": "browser",
          "x-next-locale": "en",
          "x-next-node-env": "release",
          "x-next-version": "3.3.0",
          "X-Timezone-Offset": "120",
        },
      });

      if (!response.ok) {
        throw new Error(
          `API request failed: ${response.status} ${response.statusText}`
        );
      }

      const data = await response.json();
      console.log("🔍 Raw API response:", JSON.stringify(data, null, 2));

      // Extract balance from the response
      const balance = this.extractBalance(data);

      this.lastBalance = balance;
      this.lastUpdate = new Date();

      console.log(`💰 Live balance fetched: $${balance}`);

      return {
        currentBalance: balance,
        lastUpdated: this.lastUpdate,
        source: this.apiUrl,
      };
    } catch (error) {
      console.error("Failed to fetch live balance:", error);
      throw error;
    }
  }

  extractBalance(data) {
    // Handle wallets API response format
    if (Array.isArray(data) && data.length > 0) {
      const mainWallet =
        data.find((wallet) => wallet.type === "main") || data[0];

      if (mainWallet) {
        // Try different balance field names
        const balanceFields = [
          "balance_in_float",
          "total_balance_in_float",
          "balance",
          "amount",
          "value",
        ];

        for (const field of balanceFields) {
          if (typeof mainWallet[field] === "number") {
            return mainWallet[field];
          }
        }

        // If balance is a string, try to parse it
        if (typeof mainWallet.balance === "string") {
          const parsed = parseFloat(mainWallet.balance);
          if (!isNaN(parsed)) {
            return parsed;
          }
        }
      }
    }

    throw new Error("Could not extract balance from API response");
  }
}

const googleSheets = new GoogleSheetsService();
const liveBalanceService = new LiveBalanceService(
  LIVE_BALANCE_API_URL,
  LIVE_BALANCE_BEARER_TOKEN
);

console.log("🤖 Starting SweetflipsStreamBot in polling mode...");

// Basic commands
bot.start(async (ctx) => {
  console.log(`👤 User started bot: ${ctx.from.username} (${ctx.from.id})`);

  try {
    // Create or update user
    const user = await prisma.user.upsert({
      where: { telegramId: ctx.from.id.toString() },
      update: {
        telegramUser: ctx.from.username || null,
        linkedAt: new Date(),
      },
      create: {
        telegramId: ctx.from.id.toString(),
        telegramUser: ctx.from.username || null,
        role: "VIEWER",
        linkedAt: new Date(),
      },
    });

    console.log(
      `✅ User created/updated: ${user.telegramUser} (${user.telegramId}) - Role: ${user.role}`
    );

    await ctx.reply(
      `🎉 Welcome to SweetflipsStreamBot!\n\n` +
        `You are: ${user.telegramUser || "Unknown"} (${user.telegramId})\n` +
        `Role: ${user.role}\n\n` +
        `🎮 **Gaming Commands:**\n` +
        `/guess balance <number> - Guess the end balance\n` +
        `/guess bonus <number> - Guess the bonus total\n` +
        `/balanceboard - View balance leaderboard\n` +
        `/bonusboard - View bonus leaderboard\n\n` +
        `🔗 **Account Commands:**\n` +
        `/kick - Link your Kick account\n` +
        `/help - Show all commands\n\n` +
        `Ready to play? Link your Kick account first with /kick!`
    );
  } catch (error) {
    console.error("Error creating user:", error);
    await ctx.reply("❌ Error setting up your account. Please try again.");
  }
});

bot.command("help", async (ctx) => {
  try {
    const user = await prisma.user.findUnique({
      where: { telegramId: ctx.from.id.toString() },
    });

    const userRole = user?.role || "VIEWER";

    let helpText =
      `🤖 **SweetflipsStreamBot Commands**\n\n` +
      `🎮 **Gaming Commands:**\n` +
      `/guess balance <number> - Guess the end balance (requires linked Kick account)\n` +
      `/guess bonus <number> - Guess the bonus total (requires linked Kick account)\n` +
      `/balanceboard - View live balance leaderboard with top 5 guessers\n` +
      `/bonusboard - View active bonus leaderboard with top 5 guessers\n\n` +
      `🔗 **Account Commands:**\n` +
      `/start - Welcome message and setup\n` +
      `/help - Show this help\n` +
      `/kick - Link your Kick account (one-time setup)\n\n`;

    if (["MOD", "OWNER"].includes(userRole)) {
      helpText +=
        `⚙️ **Admin Commands:**\n` +
        `/balance open - Open balance guessing\n` +
        `/balance close - Close balance guessing\n` +
        `/balance finalize - Finalize balance game with live balance\n` +
        `/balance reset - Reset balance game\n` +
        `/balance show - Show current balance standings\n\n` +
        `/bonus open - Open bonus guessing\n` +
        `/bonus close - Close bonus guessing\n` +
        `/bonus finalize - Finalize bonus game with active bonus\n` +
        `/bonus reset - Reset bonus game\n` +
        `/bonus show - Show current bonus standings\n\n` +
        `/addbonus <amount> - Add bonus amount\n` +
        `/removebonus <amount> - Remove bonus amount\n\n` +
        `/setrole <telegram_id> <MOD|OWNER> - Set user role\n` +
        `/listusers - List all users\n\n`;
    }

    helpText += `Your role: ${userRole}`;

    await ctx.reply(helpText);
  } catch (error) {
    console.error("Error in help command:", error);
    await ctx.reply("❌ Error showing help. Please try again.");
  }
});

// Balance leaderboard command
bot.command("balanceboard", async (ctx) => {
  try {
    let message = "💰 **BALANCE LEADERBOARD**\n\n";

    if (
      gameState.balance.finalized &&
      gameState.balance.finalBalance !== null
    ) {
      // Show final balance standings
      const balanceGuesses = Array.from(gameState.balance.guesses.values());

      message += `🏁 **FINAL BALANCE: $${gameState.balance.finalBalance.toLocaleString()}**\n\n`;

      if (balanceGuesses.length === 0) {
        message += "No balance guesses were recorded.";
      } else {
        const balanceLeaderboard = balanceGuesses
          .map((guess) => ({
            ...guess,
            difference: Math.abs(guess.value - gameState.balance.finalBalance),
            isExact: guess.value === gameState.balance.finalBalance,
          }))
          .sort((a, b) => {
            if (a.difference !== b.difference) {
              return a.difference - b.difference;
            }
            return new Date(a.timestamp) - new Date(b.timestamp);
          });

        message += "🏆 **Final Standings:**\n";
        const topBalanceEntries = balanceLeaderboard.slice(0, 5);
        topBalanceEntries.forEach((entry, index) => {
          const medal =
            index === 0
              ? "🥇"
              : index === 1
              ? "🥈"
              : index === 2
              ? "🥉"
              : `${index + 1}.`;
          const exact = entry.isExact ? " 🎯" : "";
          const difference =
            entry.difference === 0
              ? "EXACT!"
              : `(${entry.difference.toLocaleString()} off)`;
          message += `${medal} ${
            entry.username
          } - $${entry.value.toLocaleString()} ${difference}${exact}\n`;
        });
        if (balanceLeaderboard.length > 5) {
          message += `... and ${balanceLeaderboard.length - 5} more`;
        }
      }
    } else {
      // Show live balance
      const balanceData = await liveBalanceService.fetchCurrentBalance();
      const balanceGuesses = Array.from(gameState.balance.guesses.values());

      message += `💰 **LIVE BALANCE: $${balanceData.currentBalance.toLocaleString()}**\n\n`;

      if (balanceGuesses.length === 0) {
        message += "No balance guesses yet. Use /guess balance <number>!";
      } else {
        const balanceLeaderboard = balanceGuesses
          .map((guess) => ({
            ...guess,
            difference: Math.abs(guess.value - balanceData.currentBalance),
            isExact: guess.value === balanceData.currentBalance,
          }))
          .sort((a, b) => {
            if (a.difference !== b.difference) {
              return a.difference - b.difference;
            }
            return new Date(a.timestamp) - new Date(b.timestamp);
          });

        message += "🏆 **Top 5 Closest Guessers:**\n";
        const topBalanceEntries = balanceLeaderboard.slice(0, 5);
        topBalanceEntries.forEach((entry, index) => {
          const medal =
            index === 0
              ? "🥇"
              : index === 1
              ? "🥈"
              : index === 2
              ? "🥉"
              : `${index + 1}.`;
          const exact = entry.isExact ? " 🎯" : "";
          const difference =
            entry.difference === 0
              ? "EXACT!"
              : `(${entry.difference.toLocaleString()} off)`;
          message += `${medal} ${
            entry.username
          } - $${entry.value.toLocaleString()} ${difference}${exact}\n`;
        });
        if (balanceLeaderboard.length > 5) {
          message += `... and ${balanceLeaderboard.length - 5} more`;
        }
      }
    }

    await ctx.reply(message);
    console.log(
      `📊 Balance leaderboard displayed for user ${ctx.from.username}`
    );
  } catch (error) {
    console.error("Error showing balance leaderboard:", error);
    await ctx.reply("❌ Unable to fetch live balance. Please try again later.");
  }
});

// Bonus leaderboard command
bot.command("bonusboard", async (ctx) => {
  try {
    let message = "🎁 **BONUS LEADERBOARD**\n\n";

    if (gameState.bonus.finalized && gameState.bonus.finalBonus !== null) {
      // Show final bonus standings
      const bonusGuesses = Array.from(gameState.bonus.guesses.values());

      message += `🏁 **FINAL BONUS: ${gameState.bonus.finalBonus}x**\n\n`;

      if (bonusGuesses.length === 0) {
        message += "No bonus guesses were recorded.";
      } else {
        const bonusLeaderboard = bonusGuesses
          .map((guess) => ({
            ...guess,
            difference: Math.abs(guess.value - gameState.bonus.finalBonus),
            isExact: guess.value === gameState.bonus.finalBonus,
          }))
          .sort((a, b) => {
            if (a.difference !== b.difference) {
              return a.difference - b.difference;
            }
            return new Date(a.timestamp) - new Date(b.timestamp);
          });

        message += "🏆 **Final Standings:**\n";
        const topBonusEntries = bonusLeaderboard.slice(0, 5);
        topBonusEntries.forEach((entry, index) => {
          const medal =
            index === 0
              ? "🥇"
              : index === 1
              ? "🥈"
              : index === 2
              ? "🥉"
              : `${index + 1}.`;
          const exact = entry.isExact ? " 🎯" : "";
          const difference =
            entry.difference === 0
              ? "EXACT!"
              : `(${entry.difference.toLocaleString()}x off)`;
          message += `${medal} ${entry.username} - ${entry.value}x ${difference}${exact}\n`;
        });
        if (bonusLeaderboard.length > 5) {
          message += `... and ${bonusLeaderboard.length - 5} more`;
        }
      }
    } else {
      // Show active bonus
      const bonusGuesses = Array.from(gameState.bonus.guesses.values());

      message += `🎁 **ACTIVE BONUS: ${gameState.bonus.activeBonus}x**\n\n`;

      if (bonusGuesses.length === 0) {
        message += "No bonus guesses yet. Use /guess bonus <number>!";
      } else {
        const bonusLeaderboard = bonusGuesses
          .map((guess) => ({
            ...guess,
            difference: Math.abs(guess.value - gameState.bonus.activeBonus),
            isExact: guess.value === gameState.bonus.activeBonus,
          }))
          .sort((a, b) => {
            if (a.difference !== b.difference) {
              return a.difference - b.difference;
            }
            return new Date(a.timestamp) - new Date(b.timestamp);
          });

        message += "🏆 **Top 5 Closest Guessers:**\n";
        const topBonusEntries = bonusLeaderboard.slice(0, 5);
        topBonusEntries.forEach((entry, index) => {
          const medal =
            index === 0
              ? "🥇"
              : index === 1
              ? "🥈"
              : index === 2
              ? "🥉"
              : `${index + 1}.`;
          const exact = entry.isExact ? " 🎯" : "";
          const difference =
            entry.difference === 0
              ? "EXACT!"
              : `(${entry.difference.toLocaleString()}x off)`;
          message += `${medal} ${entry.username} - ${entry.value}x ${difference}${exact}\n`;
        });
        if (bonusLeaderboard.length > 5) {
          message += `... and ${bonusLeaderboard.length - 5} more`;
        }
      }
    }

    await ctx.reply(message);
    console.log(`📊 Bonus leaderboard displayed for user ${ctx.from.username}`);
  } catch (error) {
    console.error("Error showing bonus leaderboard:", error);
    await ctx.reply(
      "❌ Unable to show bonus leaderboard. Please try again later."
    );
  }
});

// Bonus amount management commands
bot.command("addbonus", async (ctx) => {
  console.log(`🎁 Add bonus command: ${ctx.from.username} (${ctx.from.id})`);

  try {
    const user = await prisma.user.findUnique({
      where: { telegramId: ctx.from.id.toString() },
    });

    if (!user || !["MOD", "OWNER"].includes(user.role)) {
      await ctx.reply("⛔️ Mods only.");
      return;
    }

    const args = ctx.message.text.split(" ").slice(1);
    const amount = args[0];

    if (!amount || isNaN(amount) || parseFloat(amount) <= 0) {
      await ctx.reply("Usage: /addbonus <amount>\nExample: /addbonus 100");
      return;
    }

    const bonusAmount = parseFloat(amount);
    gameState.bonus.activeBonus += bonusAmount;

    await ctx.reply(
      `🎁 Added ${bonusAmount}x bonus!\n\n` +
        `💰 **Current Active Bonus: ${gameState.bonus.activeBonus}x**`
    );
    console.log(
      `🎁 Added ${bonusAmount}x bonus by ${user.telegramUser}. Total: ${gameState.bonus.activeBonus}x`
    );
  } catch (error) {
    console.error("Error in addbonus command:", error);
    await ctx.reply("❌ Error processing addbonus command.");
  }
});

bot.command("removebonus", async (ctx) => {
  console.log(`🎁 Remove bonus command: ${ctx.from.username} (${ctx.from.id})`);

  try {
    const user = await prisma.user.findUnique({
      where: { telegramId: ctx.from.id.toString() },
    });

    if (!user || !["MOD", "OWNER"].includes(user.role)) {
      await ctx.reply("⛔️ Mods only.");
      return;
    }

    const args = ctx.message.text.split(" ").slice(1);
    const amount = args[0];

    if (!amount || isNaN(amount) || parseFloat(amount) <= 0) {
      await ctx.reply("Usage: /removebonus <amount>\nExample: /removebonus 50");
      return;
    }

    const bonusAmount = parseFloat(amount);

    if (bonusAmount > gameState.bonus.activeBonus) {
      await ctx.reply(
        `❌ Cannot remove ${bonusAmount}x bonus. Current active bonus is only ${gameState.bonus.activeBonus}x.`
      );
      return;
    }

    gameState.bonus.activeBonus -= bonusAmount;

    await ctx.reply(
      `🎁 Removed ${bonusAmount}x bonus!\n\n` +
        `💰 **Current Active Bonus: ${gameState.bonus.activeBonus}x**`
    );
    console.log(
      `🎁 Removed ${bonusAmount}x bonus by ${user.telegramUser}. Total: ${gameState.bonus.activeBonus}x`
    );
  } catch (error) {
    console.error("Error in removebonus command:", error);
    await ctx.reply("❌ Error processing removebonus command.");
  }
});

// Track users in linking mode
const linkingUsers = new Set();

bot.command("kick", async (ctx) => {
  console.log(
    `👤 User wants to link Kick: ${ctx.from.username} (${ctx.from.id})`
  );

  try {
    // Check if user already has a linked Kick account
    const existingUser = await prisma.user.findUnique({
      where: { telegramId: ctx.from.id.toString() },
    });

    if (existingUser && existingUser.kickName) {
      await ctx.reply(
        `⛔️ You already linked a kick account\n\n` +
          `Current link: @${existingUser.kickName}\n\n` +
          `Contact an admin if you need to change this.`
      );
      return;
    }

    const args = ctx.message.text.split(" ").slice(1);

    if (args.length === 0) {
      // Add user to linking mode
      linkingUsers.add(ctx.from.id.toString());

      await ctx.reply(
        `🔗 Link Your Kick Account\n\n` +
          `Please send your Kick username now.\n` +
          `Example: sweetflips`
      );
      return;
    }

    const kickName = args[0].replace("@", "");

    const user = await prisma.user.update({
      where: { telegramId: ctx.from.id.toString() },
      data: { kickName: kickName },
    });

    console.log(
      `✅ User linked Kick: ${user.telegramUser} -> ${user.kickName}`
    );

    await ctx.reply(
      `✅ Account Linked Successfully!\n\n` +
        `Telegram: ${user.telegramUser || "Unknown"}\n` +
        `Kick: @${user.kickName}\n\n` +
        `You can now use all bot commands!`
    );
  } catch (error) {
    console.error("Error linking account:", error);
    await ctx.reply("❌ Error linking your account. Please try again.");
  }
});

// Handle Kick username input for users in linking mode
bot.on("text", async (ctx) => {
  // Skip if it's a command
  if (ctx.message.text.startsWith("/")) {
    return;
  }

  // Check if user is in linking mode
  if (linkingUsers.has(ctx.from.id.toString())) {
    const username = ctx.message.text.trim();

    if (username && username.length > 0) {
      try {
        // Remove user from linking mode
        linkingUsers.delete(ctx.from.id.toString());

        // Check if user already has a linked Kick account
        const existingUser = await prisma.user.findUnique({
          where: { telegramId: ctx.from.id.toString() },
        });

        if (existingUser && existingUser.kickName) {
          await ctx.reply(
            `⛔️ You already linked a kick account\n\n` +
              `Current link: @${existingUser.kickName}\n\n` +
              `Contact an admin if you need to change this.`
          );
          return;
        }

        // Update user with Kick username
        const user = await prisma.user.upsert({
          where: { telegramId: ctx.from.id.toString() },
          update: {
            kickName: username,
            linkedAt: new Date(),
          },
          create: {
            telegramId: ctx.from.id.toString(),
            telegramUser: ctx.from.username || "Unknown",
            kickName: username,
            role: "VIEWER",
            linkedAt: new Date(),
          },
        });

        await ctx.reply(
          `✅ Account Linked Successfully!\n\n` +
            `Telegram: ${user.telegramUser || "Unknown"}\n` +
            `Kick: @${user.kickName}\n\n` +
            `You can now use all bot commands!`
        );

        console.log(
          `✅ Kick account linked: ${user.telegramUser} -> ${user.kickName}`
        );

        // Sync to Google Sheets
        await googleSheets.addLinkedAccount({
          telegramId: user.telegramId,
          telegramUsername: user.telegramUser || "Unknown",
          kickUsername: user.kickName,
          linkedAt: user.linkedAt || new Date(),
          role: user.role,
        });
      } catch (error) {
        console.error("Error linking Kick account:", error);
        await ctx.reply(
          "❌ Error linking your Kick account. Please try again."
        );
        // Remove from linking mode on error so they can try again
        linkingUsers.delete(ctx.from.id.toString());
      }
    }
  }
});

// Game state tracking
let gameState = {
  balance: {
    isOpen: false,
    guesses: new Map(),
    finalized: false,
    finalBalance: null,
  },
  bonus: {
    isOpen: false,
    guesses: new Map(),
    finalized: false,
    finalBonus: null,
    activeBonus: 0,
  },
};

bot.command("guess", async (ctx) => {
  console.log(`🎯 User making guess: ${ctx.from.username} (${ctx.from.id})`);

  const args = ctx.message.text.split(" ").slice(1);

  if (args.length < 2) {
    await ctx.reply(
      "🎯 Guess Commands:\n\n" +
        "/guess balance <number> - Guess the end balance\n" +
        "/guess bonus <number> - Guess the bonus total\n\n" +
        "Example: /guess balance 1000\n" +
        "Example: /guess bonus 500"
    );
    return;
  }

  const gameType = args[0].toLowerCase();
  const guessValue = args[1];

  if (!["balance", "bonus"].includes(gameType)) {
    await ctx.reply(
      'Please specify "balance" or "bonus".\nExample: /guess balance 1000'
    );
    return;
  }

  // Check if game is open
  if (!gameState[gameType].isOpen) {
    await ctx.reply(
      `⛔️ ${
        gameType.charAt(0).toUpperCase() + gameType.slice(1)
      } guessing is currently closed.`
    );
    return;
  }

  if (!guessValue || isNaN(guessValue)) {
    await ctx.reply(
      "Please provide a valid number.\nExample: /guess balance 1000"
    );
    return;
  }

  const numValue = parseInt(guessValue);
  const userId = ctx.from.id.toString();

  // Check if user already has a guess
  if (gameState[gameType].guesses.has(userId)) {
    await ctx.reply(
      `⛔️ You already have a ${gameType} guess recorded. Only one guess per game allowed.`
    );
    return;
  }

  // Record the guess
  gameState[gameType].guesses.set(userId, {
    username: ctx.from.username || "Unknown",
    value: numValue,
    timestamp: new Date(),
  });

  if (gameType === "balance") {
    await ctx.reply(`✅ Your balance guess of ${numValue} has been recorded!`);
    console.log(
      `✅ Balance guess recorded: ${ctx.from.username} -> ${numValue}`
    );
  } else if (gameType === "bonus") {
    await ctx.reply(`✅ Your bonus guess of ${numValue}x has been recorded!`);
    console.log(
      `✅ Bonus guess recorded: ${ctx.from.username} -> ${numValue}x`
    );
  }
});

// Balance Game Management Commands
bot.command("balance", async (ctx) => {
  console.log(`🎮 Balance game command: ${ctx.from.username} (${ctx.from.id})`);

  try {
    const user = await prisma.user.findUnique({
      where: { telegramId: ctx.from.id.toString() },
    });

    if (!user || !["MOD", "OWNER"].includes(user.role)) {
      await ctx.reply("⛔️ Mods only.");
      return;
    }

    const args = ctx.message.text.split(" ").slice(1);
    const command = args[0]?.toLowerCase();

    if (!command) {
      await ctx.reply(
        "🎯 Balance Game Commands:\n\n" +
          "/balance open - Open balance guessing\n" +
          "/balance close - Close balance guessing\n" +
          "/balance final <number> - Set final balance\n" +
          "/balance finalize - Finalize game with current live balance\n" +
          "/balance reveal - Show results\n" +
          "/balance show - Show current standings\n" +
          "/balance reset - Reset game and clear all guesses"
      );
      return;
    }

    switch (command) {
      case "open":
        gameState.balance.isOpen = true;
        await ctx.reply(
          "✅ Balance guessing is now OPEN! Users can submit their guesses."
        );
        console.log(`✅ Balance game opened by ${user.telegramUser}`);
        break;

      case "close":
        gameState.balance.isOpen = false;
        await ctx.reply(
          "⛔️ Balance guessing is now CLOSED. No more guesses accepted."
        );
        console.log(`⛔️ Balance game closed by ${user.telegramUser}`);
        break;

      case "final":
        const finalValue = args[1];
        if (!finalValue || isNaN(finalValue)) {
          await ctx.reply(
            "Usage: /balance final <number>\nExample: /balance final 1000"
          );
          return;
        }
        await ctx.reply(`🎯 Final balance set to: ${finalValue}`);
        console.log(
          `🎯 Final balance set to ${finalValue} by ${user.telegramUser}`
        );
        break;

      case "finalize":
        // Get current live balance and finalize the game
        try {
          const balanceData = await liveBalanceService.fetchCurrentBalance();
          gameState.balance.finalized = true;
          gameState.balance.finalBalance = balanceData.currentBalance;
          gameState.balance.isOpen = false; // Close guessing when finalized

          await ctx.reply(
            `🏁 **Balance game FINALIZED!**\n\n` +
              `💰 **Final Balance: $${balanceData.currentBalance.toLocaleString()}**\n\n` +
              `The leaderboard now shows final standings. Use /balance reset to start a new round.`
          );
          console.log(
            `🏁 Balance game finalized with balance $${balanceData.currentBalance} by ${user.telegramUser}`
          );
        } catch (error) {
          console.error("Error finalizing balance:", error);
          await ctx.reply(
            "❌ Unable to fetch live balance for finalization. Please try again."
          );
        }
        break;

      case "reveal":
        await ctx.reply("🏁 Balance game results revealed!");
        console.log(`🏁 Balance results revealed by ${user.telegramUser}`);
        break;

      case "show":
        const balanceGuesses = Array.from(gameState.balance.guesses.values());
        if (balanceGuesses.length === 0) {
          await ctx.reply("📊 No balance guesses recorded yet.");
        } else {
          let message = "📊 Balance Game Standings:\n\n";
          balanceGuesses.forEach((guess, index) => {
            message += `${index + 1}) ${guess.username}: ${guess.value}\n`;
          });
          await ctx.reply(message);
        }
        console.log(`📊 Balance standings requested by ${user.telegramUser}`);
        break;

      // Live case removed

      case "reset":
        gameState.balance.guesses.clear();
        gameState.balance.isOpen = false;
        gameState.balance.finalized = false;
        gameState.balance.finalBalance = null;
        await ctx.reply(
          "🔄 Balance game has been reset. All guesses cleared and game unfinalized."
        );
        console.log(`🔄 Balance game reset by ${user.telegramUser}`);
        break;

      default:
        await ctx.reply("Unknown balance command. Use /balance for help.");
    }
  } catch (error) {
    console.error("Error in balance command:", error);
    await ctx.reply("❌ Error processing balance command.");
  }
});

// Bonus Game Management Commands
bot.command("bonus", async (ctx) => {
  console.log(`🎮 Bonus game command: ${ctx.from.username} (${ctx.from.id})`);

  try {
    const user = await prisma.user.findUnique({
      where: { telegramId: ctx.from.id.toString() },
    });

    if (!user || !["MOD", "OWNER"].includes(user.role)) {
      await ctx.reply("⛔️ Mods only.");
      return;
    }

    const args = ctx.message.text.split(" ").slice(1);
    const command = args[0]?.toLowerCase();

    if (!command) {
      await ctx.reply(
        "🎯 Bonus Game Commands:\n\n" +
          "/bonus open - Open bonus guessing\n" +
          "/bonus close - Close bonus guessing\n" +
          "/bonus final <number> - Set final bonus total\n" +
          "/bonus finalize - Finalize game with current active bonus\n" +
          "/bonus reveal - Show results\n" +
          "/bonus show - Show current standings\n" +
          "/bonus reset - Reset game and clear all guesses"
      );
      return;
    }

    switch (command) {
      case "open":
        gameState.bonus.isOpen = true;
        await ctx.reply(
          "✅ Bonus guessing is now OPEN! Users can submit their guesses."
        );
        console.log(`✅ Bonus game opened by ${user.telegramUser}`);
        break;

      case "close":
        gameState.bonus.isOpen = false;
        await ctx.reply(
          "⛔️ Bonus guessing is now CLOSED. No more guesses accepted."
        );
        console.log(`⛔️ Bonus game closed by ${user.telegramUser}`);
        break;

      case "final":
        const finalValue = args[1];
        if (!finalValue || isNaN(finalValue)) {
          await ctx.reply(
            "Usage: /bonus final <number>\nExample: /bonus final 500"
          );
          return;
        }
        await ctx.reply(`🎯 Final bonus total set to: ${finalValue}x`);
        console.log(
          `🎯 Final bonus total set to ${finalValue}x by ${user.telegramUser}`
        );
        break;

      case "reveal":
        await ctx.reply("🏆 Bonus game results revealed!");
        console.log(`🏆 Bonus results revealed by ${user.telegramUser}`);
        break;

      case "show":
        const bonusGuesses = Array.from(gameState.bonus.guesses.values());
        if (bonusGuesses.length === 0) {
          await ctx.reply("📊 No bonus guesses recorded yet.");
        } else {
          let message = "📊 Bonus Game Standings:\n\n";
          bonusGuesses.forEach((guess, index) => {
            message += `${index + 1}) ${guess.username}: ${guess.value}x\n`;
          });
          await ctx.reply(message);
        }
        console.log(`📊 Bonus standings requested by ${user.telegramUser}`);
        break;

      case "finalize":
        // Finalize the bonus game with current active bonus
        gameState.bonus.finalized = true;
        gameState.bonus.finalBonus = gameState.bonus.activeBonus;
        gameState.bonus.isOpen = false; // Close guessing when finalized

        await ctx.reply(
          `🏁 **Bonus game FINALIZED!**\n\n` +
            `🎁 **Final Bonus: ${gameState.bonus.finalBonus}x**\n\n` +
            `The leaderboard now shows final standings. Use /bonus reset to start a new round.`
        );
        console.log(
          `🏁 Bonus game finalized with ${gameState.bonus.finalBonus}x by ${user.telegramUser}`
        );
        break;

      case "reset":
        gameState.bonus.guesses.clear();
        gameState.bonus.isOpen = false;
        gameState.bonus.finalized = false;
        gameState.bonus.finalBonus = null;
        gameState.bonus.activeBonus = 0; // Reset active bonus too
        await ctx.reply(
          "🔄 Bonus game has been reset. All guesses cleared and game unfinalized."
        );
        console.log(`🔄 Bonus game reset by ${user.telegramUser}`);
        break;

      default:
        await ctx.reply("Unknown bonus command. Use /bonus for help.");
    }
  } catch (error) {
    console.error("Error in bonus command:", error);
    await ctx.reply("❌ Error processing bonus command.");
  }
});

bot.command("setrole", async (ctx) => {
  console.log(`🔧 Admin setting role: ${ctx.from.username} (${ctx.from.id})`);

  try {
    const user = await prisma.user.findUnique({
      where: { telegramId: ctx.from.id.toString() },
    });

    if (!user || user.role !== "OWNER") {
      await ctx.reply("⛔️ Owner only.");
      return;
    }

    const args = ctx.message.text.split(" ").slice(1);
    if (args.length < 2) {
      await ctx.reply("Usage: /setrole <telegram_id> <MOD|OWNER>");
      return;
    }

    const targetId = args[0];
    const role = args[1].toUpperCase();

    if (!["MOD", "OWNER"].includes(role)) {
      await ctx.reply("Role must be MOD or OWNER");
      return;
    }

    const targetUser = await prisma.user.update({
      where: { telegramId: targetId },
      data: { role: role },
    });

    await ctx.reply(
      `✅ Role Updated\n\n` +
        `User: ${targetUser.telegramUser || "Unknown"} (${
          targetUser.telegramId
        })\n` +
        `New Role: ${targetUser.role}`
    );

    console.log(
      `✅ Role updated: ${targetUser.telegramUser} -> ${targetUser.role}`
    );
  } catch (error) {
    console.error("Error setting role:", error);
    await ctx.reply("❌ Error setting role. User might not exist.");
  }
});

bot.command("listusers", async (ctx) => {
  console.log(`📋 Admin listing users: ${ctx.from.username} (${ctx.from.id})`);

  try {
    const user = await prisma.user.findUnique({
      where: { telegramId: ctx.from.id.toString() },
    });

    if (!user || !["MOD", "OWNER"].includes(user.role)) {
      await ctx.reply("⛔️ Mods only.");
      return;
    }

    const users = await prisma.user.findMany({
      select: {
        telegramId: true,
        telegramUser: true,
        kickName: true,
        role: true,
        linkedAt: true,
        createdAt: true,
      },
    });

    let message = `📋 **Users (${users.length}):**\n\n`;

    users.forEach((u, index) => {
      const roleEmoji =
        u.role === "OWNER" ? "👑" : u.role === "MOD" ? "🛡️" : "👤";
      const linkedStatus = u.kickName ? "✅" : "❌";

      message += `${index + 1}) ${roleEmoji} ${u.telegramUser || "Unknown"}\n`;
      message += `   ID: \`${u.telegramId}\`\n`;
      message += `   Kick: ${
        u.kickName ? `@${u.kickName}` : "Not linked"
      } ${linkedStatus}\n`;
      message += `   Role: ${u.role}\n\n`;
    });

    await ctx.reply(message);
  } catch (error) {
    console.error("Error listing users:", error);
    await ctx.reply("❌ Error listing users.");
  }
});

// Error handling
bot.catch((err, ctx) => {
  console.error("Bot error:", err);
  ctx.reply("❌ An error occurred. Please try again.");
});

// Start the bot
bot
  .launch()
  .then(() => {
    console.log("✅ Bot is running in polling mode!");
    console.log("📱 Message your bot with /start to test it");
  })
  .catch((error) => {
    console.error("❌ Failed to start bot:", error);
  });

// Graceful shutdown
process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));

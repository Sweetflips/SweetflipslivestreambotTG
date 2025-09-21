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

// Live Balance configuration - DISABLED

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
class LiveBalanceService {
  constructor(balanceApiUrl) {
    this.balanceApiUrl = balanceApiUrl;
    this.lastBalance = null;
    this.lastUpdate = null;
  }

  async fetchCurrentBalance() {
    // Use test balance if configured
    if (USE_TEST_BALANCE) {
      this.lastBalance = TEST_BALANCE;
      this.lastUpdate = new Date();

      console.log(`💰 Using test balance: ${TEST_BALANCE}`);

      return {
        currentBalance: TEST_BALANCE,
        lastUpdated: this.lastUpdate,
        source: "TEST_MODE",
      };
    }

    // Check cache first (10 minutes)
    const cached = this.getCachedBalance(10);
    if (cached) {
      console.log(`💰 Using cached balance: ${cached.currentBalance}`);
      return cached;
    }

    if (!this.balanceApiUrl) {
      throw new Error("Live balance API not configured");
    }

    try {
      const result = await this.fetchWithRetry();
      console.log("✅ Successfully fetched balance:", result);
      return result;
    } catch (error) {
      console.error("Failed to fetch live balance:", error);

      // If we have a cached balance, use it even if it's old
      if (this.lastBalance) {
        console.log(`💰 Using stale cached balance: ${this.lastBalance}`);
        return {
          currentBalance: this.lastBalance,
          lastUpdated: this.lastUpdate,
          source: this.balanceApiUrl + " (cached)",
        };
      }

      // Final fallback: use test balance if API completely fails
      console.log(
        `💰 API failed, using fallback test balance: ${TEST_BALANCE}`
      );
      return {
        currentBalance: TEST_BALANCE,
        lastUpdated: new Date(),
        source: "FALLBACK_MODE",
      };
    }
  }

  extractBalanceFromResponse(data) {
    console.log(
      "🔍 Extracting balance from response:",
      JSON.stringify(data, null, 2)
    );

    // Handle wallets API response format
    if (Array.isArray(data) && data.length > 0) {
      console.log(`📋 Response is an array with ${data.length} items`);

      // Look for the main wallet (usually the first one or the one with highest balance)
      const mainWallet =
        data.find((wallet) => wallet.type === "main") || data[0];
      console.log("📋 Main wallet:", JSON.stringify(mainWallet, null, 2));

      if (mainWallet) {
        // Try different balance field names (prioritize float values)
        const balanceFields = [
          "balance_in_float", // This is the actual balance as a number
          "total_balance_in_float",
          "balance",
          "amount",
          "value",
          "currentBalance",
          "totalBalance",
        ];

        for (const field of balanceFields) {
          if (typeof mainWallet[field] === "number") {
            console.log(
              `💰 Found balance in field '${field}':`,
              mainWallet[field]
            );
            return mainWallet[field];
          }
        }

        // If balance is a string, try to parse it
        if (typeof mainWallet.balance === "string") {
          const parsed = parseFloat(mainWallet.balance);
          if (!isNaN(parsed)) {
            console.log("💰 Found string balance, parsed:", parsed);
            return parsed;
          }
        }

        // If no direct balance field, look for nested structures
        if (mainWallet.balance && typeof mainWallet.balance === "object") {
          for (const field of balanceFields) {
            if (typeof mainWallet.balance[field] === "number") {
              console.log(
                `💰 Found nested balance in 'balance.${field}':`,
                mainWallet.balance[field]
              );
              return mainWallet.balance[field];
            }
          }
        }
      }
    }

    // Handle single object response
    if (typeof data === "object" && data !== null) {
      console.log("📋 Response is an object with keys:", Object.keys(data));

      // Common patterns for balance extraction
      if (typeof data.balance === "number") {
        console.log("💰 Found balance:", data.balance);
        return data.balance;
      }
      if (typeof data.currentBalance === "number") {
        console.log("💰 Found currentBalance:", data.currentBalance);
        return data.currentBalance;
      }
      if (typeof data.amount === "number") {
        console.log("💰 Found amount:", data.amount);
        return data.amount;
      }
      if (typeof data.value === "number") {
        console.log("💰 Found value:", data.value);
        return data.value;
      }

      // If balance is nested in an object
      if (data.data && typeof data.data.balance === "number") {
        console.log(
          "💰 Found nested balance in data.balance:",
          data.data.balance
        );
        return data.data.balance;
      }
      if (data.result && typeof data.result.balance === "number") {
        console.log(
          "💰 Found nested balance in result.balance:",
          data.result.balance
        );
        return data.result.balance;
      }

      // If balance is a string, try to parse it
      if (typeof data.balance === "string") {
        const parsed = parseFloat(data.balance);
        if (!isNaN(parsed)) {
          console.log("💰 Found string balance, parsed:", parsed);
          return parsed;
        }
      }
    }

    console.log("❌ Could not extract balance from API response");
    console.log("📊 Full response structure:", JSON.stringify(data, null, 2));
    throw new Error("Could not extract balance from API response");
  }

  getCachedBalance(maxAgeMinutes = 10) {
    if (!this.lastBalance || !this.lastUpdate) return null;

    const ageMinutes = (Date.now() - this.lastUpdate.getTime()) / (1000 * 60);
    if (ageMinutes > maxAgeMinutes) return null;

    return {
      currentBalance: this.lastBalance,
      lastUpdated: this.lastUpdate,
      source: this.balanceApiUrl,
    };
  }

  // Fetch balance from the overlay website with retry for loading state
  async fetchWithRetry() {
    const maxRetries = 3;
    const delayMs = 2000;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await fetch(this.balanceApiUrl, {
          method: "GET",
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
            Accept:
              "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
          },
        });

        if (!response.ok) {
          throw new Error(
            `API request failed: ${response.status} ${response.statusText}`
          );
        }

        const html = await response.text();

        // Extract balance from HTML using regex
        const balanceMatch = html.match(
          /id="activeBalance"[^>]*>\$([0-9,]+\.?[0-9]*)/
        );

        if (!balanceMatch) {
          // Check if it's still loading
          if (html.includes('id="activeBalance">Loading...')) {
            console.log(
              `⏳ Balance is still loading, attempt ${attempt}/${maxRetries}`
            );
            if (attempt < maxRetries) {
              await new Promise((resolve) => setTimeout(resolve, delayMs));
              continue;
            }
            throw new Error("Balance is still loading after retries");
          }
          throw new Error("Could not find balance in HTML response");
        }

        // Parse the balance (remove commas and convert to number)
        const balanceString = balanceMatch[1].replace(/,/g, "");
        const currentBalance = parseFloat(balanceString);

        if (isNaN(currentBalance)) {
          throw new Error("Could not parse balance as number");
        }

        this.lastBalance = currentBalance;
        this.lastUpdate = new Date();

        console.log(`💰 Live balance fetched: $${currentBalance}`);

        return {
          currentBalance,
          lastUpdated: this.lastUpdate,
          source: this.balanceApiUrl,
        };
      } catch (error) {
        console.error(
          `Attempt ${attempt}/${maxRetries} failed:`,
          error.message
        );
        if (attempt === maxRetries) {
          throw error;
        }
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }

  calculateLeaderboard(currentBalance, userGuesses) {
    return userGuesses
      .map((guess) => ({
        ...guess,
        difference: Math.abs(guess.guess - currentBalance),
        isExact: guess.guess === currentBalance,
      }))
      .sort((a, b) => {
        if (a.difference !== b.difference) {
          return a.difference - b.difference;
        }
        if (a.isExact !== b.isExact) {
          return a.isExact ? -1 : 1;
        }
        return 0;
      })
      .map((entry, index) => ({
        rank: index + 1,
        telegramUsername: entry.telegramUsername,
        kickUsername: entry.kickUsername,
        guess: entry.guess,
        difference: entry.difference,
        isExact: entry.isExact,
      }));
  }
}

const googleSheets = new GoogleSheetsService();
const liveBalanceService = new LiveBalanceService(LIVE_BALANCE_API_URL);

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
        `Available commands:\n` +
        `/help - Show all commands\n` +
        `/kick - Link your Kick account\n` +
        `/gtbalance - Guess the balance\n` +
        `/gtbonus - Guess the bonus total`
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
      `🤖 SweetflipsStreamBot Commands\n\n` +
      `Viewer Commands:\n` +
      `/start - Welcome message\n` +
      `/help - Show this help\n` +
      `/kick - Link your Kick account\n` +
      `/guess balance <number> - Guess the end balance\n` +
      `/guess bonus <number> - Guess the bonus total\n` +
      `/leaderboard - View live balance leaderboard\n\n`;

    if (["MOD", "OWNER"].includes(userRole)) {
      helpText +=
        `Admin Commands:\n` +
        `/balance <command> - Manage balance game\n` +
        `/bonus <command> - Manage bonus game\n` +
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

// Public leaderboard command for viewers
bot.command("leaderboard", async (ctx) => {
  try {
    // Check if user has linked Kick account
    const user = await prisma.user.findUnique({
      where: { telegramId: ctx.from.id.toString() },
    });

    if (!user || !user.kickName) {
      await ctx.reply(
        "🔗 Please link your Kick account first using /kick command."
      );
      return;
    }

    try {
      // Get current live balance
      const balanceData = await liveBalanceService.fetchCurrentBalance();

      // Get user guesses from game state
      const userGuesses = Array.from(gameState.balance.guesses.values()).map(
        (guess) => ({
          telegramUsername: guess.username,
          kickUsername: guess.username, // Using same for now
          guess: guess.value,
        })
      );

      if (userGuesses.length === 0) {
        await ctx.reply(
          `💰 **Live Balance: ${balanceData.currentBalance.toLocaleString()}**\n\n` +
            `No guesses recorded yet. Use /guess balance <number> to make a guess!`
        );
        return;
      }

      // Calculate leaderboard
      const leaderboard = liveBalanceService.calculateLeaderboard(
        balanceData.currentBalance,
        userGuesses
      );

      // Format leaderboard
      let message = `💰 **Live Balance: ${balanceData.currentBalance.toLocaleString()}**\n\n`;
      message += "🏆 **Leaderboard**\n\n";

      const topEntries = leaderboard.slice(0, 10);
      topEntries.forEach((entry) => {
        const medal =
          entry.rank === 1
            ? "🥇"
            : entry.rank === 2
            ? "🥈"
            : entry.rank === 3
            ? "🥉"
            : `${entry.rank}.`;
        const exact = entry.isExact ? " 🎯" : "";
        const displayName = entry.kickUsername
          ? `@${entry.kickUsername}`
          : entry.telegramUsername;
        const difference =
          entry.difference === 0
            ? "EXACT!"
            : `(${entry.difference.toLocaleString()} off)`;

        message += `${medal} ${displayName} - ${entry.guess.toLocaleString()} ${difference}${exact}\n`;
      });

      if (leaderboard.length > 10) {
        message += `\n... and ${leaderboard.length - 10} more`;
      }

      message += `\n\n🔄 *Live updates every 30 seconds*`;

      await ctx.reply(message);
      console.log(
        `📊 Public leaderboard displayed for user ${user.telegramUser}`
      );
    } catch (error) {
      console.error("Error showing live leaderboard:", error);

      // Fallback: show leaderboard with test balance
      const userGuesses = Array.from(gameState.balance.guesses.values()).map(
        (guess) => ({
          telegramUsername: guess.username,
          kickUsername: guess.username,
          guess: guess.value,
        })
      );

      if (userGuesses.length === 0) {
        await ctx.reply(
          `💰 **Live Balance: ${TEST_BALANCE.toLocaleString()}** (Fallback Mode)\n\n` +
            `No guesses recorded yet. Use /guess balance <number> to make a guess!`
        );
        return;
      }

      const leaderboard = liveBalanceService.calculateLeaderboard(
        TEST_BALANCE,
        userGuesses
      );

      let message = `💰 **Live Balance: ${TEST_BALANCE.toLocaleString()}** (Fallback Mode)\n\n`;
      message += "🏆 **Leaderboard**\n\n";

      const topEntries = leaderboard.slice(0, 10);
      topEntries.forEach((entry) => {
        const medal =
          entry.rank === 1
            ? "🥇"
            : entry.rank === 2
            ? "🥈"
            : entry.rank === 3
            ? "🥉"
            : `${entry.rank}.`;
        const exact = entry.isExact ? " 🎯" : "";
        const displayName = entry.kickUsername
          ? `@${entry.kickUsername}`
          : entry.telegramUsername;
        const difference =
          entry.difference === 0
            ? "EXACT!"
            : `(${entry.difference.toLocaleString()} off)`;
        message += `${medal} ${displayName} - ${entry.guess.toLocaleString()} ${difference}${exact}\n`;
      });

      if (leaderboard.length > 10) {
        message += `\n... and ${leaderboard.length - 10} more`;
      }

      message += `\n\n⚠️ *Using fallback balance due to API issues*`;
      await ctx.reply(message);
    }
  } catch (error) {
    console.error("Error in leaderboard command:", error);
    await ctx.reply("❌ Error displaying leaderboard. Please try again.");
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
  balance: { isOpen: false, guesses: new Map() },
  bonus: { isOpen: false, guesses: new Map() },
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
          "/balance reveal - Show results\n" +
          "/balance show - Show current standings\n" +
          "/balance live - Show live balance leaderboard\n" +
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

      case "live":
        try {
          // Get current live balance
          const balanceData = await liveBalanceService.fetchCurrentBalance();

          // Get user guesses from game state
          const userGuesses = Array.from(
            gameState.balance.guesses.values()
          ).map((guess) => ({
            telegramUsername: guess.username,
            kickUsername: guess.username, // Using same for now
            guess: guess.value,
          }));

          if (userGuesses.length === 0) {
            await ctx.reply(
              `💰 **Live Balance: ${balanceData.currentBalance.toLocaleString()}**\n\n` +
                `No guesses recorded yet. Use /guess balance <number> to make a guess!`
            );
            return;
          }

          // Calculate leaderboard
          const leaderboard = liveBalanceService.calculateLeaderboard(
            balanceData.currentBalance,
            userGuesses
          );

          // Format leaderboard
          let message = `💰 **Live Balance: ${balanceData.currentBalance.toLocaleString()}**\n\n`;
          message += "🏆 **Leaderboard**\n\n";

          const topEntries = leaderboard.slice(0, 10);
          topEntries.forEach((entry) => {
            const medal =
              entry.rank === 1
                ? "🥇"
                : entry.rank === 2
                ? "🥈"
                : entry.rank === 3
                ? "🥉"
                : `${entry.rank}.`;
            const exact = entry.isExact ? " 🎯" : "";
            const displayName = entry.kickUsername
              ? `@${entry.kickUsername}`
              : entry.telegramUsername;
            const difference =
              entry.difference === 0
                ? "EXACT!"
                : `(${entry.difference.toLocaleString()} off)`;

            message += `${medal} ${displayName} - ${entry.guess.toLocaleString()} ${difference}${exact}\n`;
          });

          if (leaderboard.length > 10) {
            message += `\n... and ${leaderboard.length - 10} more`;
          }

          message += `\n\n🔄 *Live updates every 30 seconds*`;

          await ctx.reply(message);
          console.log(
            `💰 Live balance leaderboard displayed by ${user.telegramUser}`
          );
        } catch (error) {
          console.error("Error showing live leaderboard:", error);

          // Fallback: show leaderboard with test balance
          const userGuesses = Array.from(
            gameState.balance.guesses.values()
          ).map((guess) => ({
            telegramUsername: guess.username,
            kickUsername: guess.username,
            guess: guess.value,
          }));

          if (userGuesses.length === 0) {
            await ctx.reply(
              `💰 **Live Balance: ${TEST_BALANCE.toLocaleString()}** (Fallback Mode)\n\n` +
                `No guesses recorded yet. Use /guess balance <number> to make a guess!`
            );
            return;
          }

          const leaderboard = liveBalanceService.calculateLeaderboard(
            TEST_BALANCE,
            userGuesses
          );

          let message = `💰 **Live Balance: ${TEST_BALANCE.toLocaleString()}** (Fallback Mode)\n\n`;
          message += "🏆 **Leaderboard**\n\n";

          const topEntries = leaderboard.slice(0, 10);
          topEntries.forEach((entry) => {
            const medal =
              entry.rank === 1
                ? "🥇"
                : entry.rank === 2
                ? "🥈"
                : entry.rank === 3
                ? "🥉"
                : `${entry.rank}.`;
            const exact = entry.isExact ? " 🎯" : "";
            const displayName = entry.kickUsername
              ? `@${entry.kickUsername}`
              : entry.telegramUsername;
            const difference =
              entry.difference === 0
                ? "EXACT!"
                : `(${entry.difference.toLocaleString()} off)`;
            message += `${medal} ${displayName} - ${entry.guess.toLocaleString()} ${difference}${exact}\n`;
          });

          if (leaderboard.length > 10) {
            message += `\n... and ${leaderboard.length - 10} more`;
          }

          message += `\n\n⚠️ *Using fallback balance due to API issues*`;
          await ctx.reply(message);
        }
        break;

      case "reset":
        gameState.balance.guesses.clear();
        gameState.balance.isOpen = false;
        await ctx.reply("🔄 Balance game has been reset. All guesses cleared.");
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

      case "reset":
        gameState.bonus.guesses.clear();
        gameState.bonus.isOpen = false;
        await ctx.reply("🔄 Bonus game has been reset. All guesses cleared.");
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

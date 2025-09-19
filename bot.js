const { Telegraf } = require("telegraf");
const { PrismaClient } = require("@prisma/client");
const { google } = require("googleapis");
const fs = require("fs");
const path = require("path");

// Initialize Prisma with error handling
let prisma = null;
try {
  const { PrismaClient } = require("@prisma/client");
  prisma = new PrismaClient();
  console.log("✅ Database connection initialized");
} catch (error) {
  console.error("❌ Database initialization failed:", error.message);
  console.log("⚠️ Bot will run without database features");
  prisma = null;
}

// Function to wait for database to be ready
async function waitForDatabase() {
  if (!prisma) return false;

  let retries = 0;
  const maxRetries = 10;

  while (retries < maxRetries) {
    try {
      // Try to query a simple table to check if database is ready
      await prisma.$queryRaw`SELECT 1`;
      console.log("✅ Database is ready");
      return true;
    } catch (error) {
      retries++;
      console.log(`⏳ Waiting for database... (${retries}/${maxRetries})`);
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }

  console.error("❌ Database not ready after maximum retries");
  return false;
}

// Check for required environment variables
if (!process.env.TELEGRAM_BOT_TOKEN) {
  console.error("❌ TELEGRAM_BOT_TOKEN environment variable is required!");
  console.error(
    "Please set TELEGRAM_BOT_TOKEN in your Railway environment variables."
  );
  process.exit(1);
}

// Initialize bot
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

// Force redeploy - /kick command now has personal message restriction

// Global state for linking users
global.linkingUsers = new Set();

// Game state
const gameState = {
  balance: {
    isOpen: false,
    isFinalized: false,
    finalBalance: null,
    guesses: new Map(),
  },
  bonus: {
    isOpen: false,
    isFinalized: false,
    finalBonus: null,
    guesses: new Map(),
    bonusAmount: 0,
    bonusList: [], // Track individual bonuses
  },
};

// Live balance service
class LiveBalanceService {
  constructor() {
    this.cache = null;
    this.cacheTime = null;
    this.cacheDuration = 10 * 60 * 1000; // 10 minutes
  }

  async fetchCurrentBalance() {
    try {
      const response = await fetch(
        "https://api.razed.com/player/api/v1/wallets",
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${process.env.LIVE_BALANCE_BEARER_TOKEN}`,
            Accept: "application/json",
            "Accept-Encoding": "gzip, deflate, br, zstd",
            "Accept-Language": "en-US,en;q=0.5",
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:142.0) Gecko/20100101 Firefox/142.0",
            Origin: "https://www.razed.com",
            Referer: "https://www.razed.com/",
            "Sec-Fetch-Dest": "empty",
            "Sec-Fetch-Mode": "cors",
            "Sec-Fetch-Site": "same-site",
            TE: "trailers",
            "x-client-id": "966344738.1750169000",
            "x-next-env": "production",
            "x-next-env-type": "browser",
            "x-next-locale": "en",
            "x-next-node-env": "release",
            "x-next-version": "3.3.0",
            "X-Timezone-Offset": "120",
          },
        }
      );

      if (!response.ok) {
        throw new Error(
          `API request failed: ${response.status} ${response.statusText}`
        );
      }

      const data = await response.json();
      console.log("🔍 Raw API response:", JSON.stringify(data, null, 2));

      const balance = this.extractBalanceFromResponse(data);
      console.log("💰 Extracted balance:", balance);

      this.cache = balance;
      this.cacheTime = Date.now();

      return balance;
    } catch (error) {
      console.error("❌ Error fetching live balance:", error);

      // Return cached data if available
      if (this.cache && this.cacheTime) {
        const age = Date.now() - this.cacheTime;
        if (age < this.cacheDuration) {
          console.log("📦 Using fresh cache");
          return this.cache;
        } else {
          console.log("📦 Using stale cache");
          return this.cache;
        }
      }

      // Fallback to test balance
      console.log("🧪 Using test balance");
      return 15000;
    }
  }

  extractBalanceFromResponse(data) {
    try {
      // Handle array of wallets
      if (Array.isArray(data)) {
        for (const wallet of data) {
          if (wallet.balance_in_float !== undefined) {
            return wallet.balance_in_float;
          }
          if (wallet.total_balance_in_float !== undefined) {
            return wallet.total_balance_in_float;
          }
          if (wallet.balance && typeof wallet.balance === "string") {
            const parsed = parseFloat(wallet.balance.replace(/[,$]/g, ""));
            if (!isNaN(parsed)) return parsed;
          }
        }
      }

      // Handle single wallet object
      if (data.balance_in_float !== undefined) {
        return data.balance_in_float;
      }
      if (data.total_balance_in_float !== undefined) {
        return data.total_balance_in_float;
      }
      if (data.balance && typeof data.balance === "string") {
        const parsed = parseFloat(data.balance.replace(/[,$]/g, ""));
        if (!isNaN(parsed)) return parsed;
      }

      console.log("⚠️ Could not extract balance from response structure");
      return null;
    } catch (error) {
      console.error("❌ Error extracting balance:", error);
      return null;
    }
  }
}

const liveBalanceService = new LiveBalanceService();

// Google Sheets setup (optional)
let sheets = null;
let SPREADSHEET_ID = null;

try {
  // Try environment variable first
  if (process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
    try {
      const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
      const auth = new google.auth.GoogleAuth({
        credentials: credentials,
        scopes: ["https://www.googleapis.com/auth/spreadsheets"],
      });
      sheets = google.sheets({ version: "v4", auth });
      SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID;
      console.log(
        "✅ Google Sheets integration enabled (environment variable)"
      );
    } catch (envError) {
      console.log("⚠️ Environment variable failed, trying file-based auth...");
      throw envError; // This will trigger the file-based fallback
    }
  } else {
    throw new Error("No environment variable set");
  }
} catch (error) {
  // Fallback to file-based authentication
  try {
    const auth = new google.auth.GoogleAuth({
      keyFile: path.join(
        __dirname,
        "credentials",
        "sweetflips-7086906ae249.json"
      ),
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });
    sheets = google.sheets({ version: "v4", auth });
    SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID;
    console.log("✅ Google Sheets integration enabled (file-based)");
  } catch (fileError) {
    console.error("❌ Google Sheets setup failed:", fileError.message);
    console.log("⚠️ Bot will run without Google Sheets integration");
    sheets = null;
    SPREADSHEET_ID = null;
  }
}

// Helper functions
async function getUserOrCreate(telegramId, telegramUser) {
  // If database is not available, return a mock user and sync to Google Sheets
  if (!prisma) {
    console.log(
      `⚠️ Database unavailable - using mock user: ${telegramUser} (${telegramId})`
    );
    const mockUser = {
      id: telegramId.toString(),
      telegramId: telegramId.toString(),
      telegramUser: telegramUser,
      role: "VIEWER",
      kickName: null,
    };

    // Sync to Google Sheets even with mock user
    await syncToGoogleSheets(mockUser);

    return mockUser;
  }

  try {
    let user = await prisma.user.findUnique({
      where: { telegramId: telegramId.toString() },
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          telegramId: telegramId.toString(),
          telegramUser: telegramUser,
          role: "VIEWER",
        },
      });
      console.log(
        `✅ User created: ${telegramUser} (${telegramId}) - Role: ${user.role}`
      );
    } else {
      // Update username if changed
      if (user.telegramUser !== telegramUser) {
        user = await prisma.user.update({
          where: { telegramId: telegramId.toString() },
          data: { telegramUser: telegramUser },
        });
      }
      console.log(
        `✅ User found: ${telegramUser} (${telegramId}) - Role: ${user.role}`
      );
    }

    return user;
  } catch (error) {
    console.error("❌ Database error in getUserOrCreate:", error);
    // Return mock user if database fails
    return {
      id: telegramId.toString(),
      telegramId: telegramId.toString(),
      telegramUser: telegramUser,
      role: "VIEWER",
      kickName: null,
    };
  }
}

async function syncToGoogleSheets(user) {
  // Skip if Google Sheets is not available
  if (!sheets || !SPREADSHEET_ID) {
    console.log("⚠️ Google Sheets not available - skipping sync");
    return;
  }

  try {
    const values = [
      [
        user.telegramUser || "Unknown",
        user.kickName || "Not linked",
        new Date().toISOString(),
      ],
    ];

    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: "Sheet1!A:C",
      valueInputOption: "RAW",
      resource: { values },
    });

    console.log(
      `📊 Synced to Google Sheets: ${user.telegramUser} -> ${user.kickName}`
    );
  } catch (error) {
    console.error("❌ Error syncing to Google Sheets:", error);
  }
}

function isAdmin(user) {
  return ["MOD", "OWNER"].includes(user.role);
}

// Bot commands
bot.start(async (ctx) => {
  const user = await getUserOrCreate(ctx.from.id, ctx.from.username);

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
});

bot.help(async (ctx) => {
  const user = await getUserOrCreate(ctx.from.id, ctx.from.username);

  if (isAdmin(user)) {
    // Admin/Mod help - shows all commands
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
      `/kick - Link your Kick account (one-time setup)\n\n` +
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
      `/add <bonus name> - Add a bonus (counts as +1)\n` +
      `/remove <bonus name> - Remove a bonus (counts as -1)\n\n` +
      `/live - Send live announcement to all admin groups\n\n` +
      `/setrole <telegram_id> <MOD|OWNER> - Set user role\n` +
      `/listusers - List all users\n\n`;

    await ctx.reply(helpText);
  } else {
    // Viewer help - shows only gaming and account commands
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

    await ctx.reply(helpText);
  }
});

bot.command("kick", async (ctx) => {
  // Check if command is used in a group chat
  if (ctx.chat.type !== "private") {
    await ctx.reply(
      `❌ This command can only be used in personal messages. [BOT.JS v2.0]`
    );
    return;
  }

  const user = await getUserOrCreate(ctx.from.id, ctx.from.username);

  if (user.kickName) {
    await ctx.reply(`✅ You already linked a Kick account: @${user.kickName}`);
    return;
  }

  if (global.linkingUsers.has(ctx.from.id)) {
    await ctx.reply(
      `⏳ You're already in the linking process. Please send your Kick username now.`
    );
    return;
  }

  global.linkingUsers.add(ctx.from.id);
  await ctx.reply(
    `🔗 **Kick Account Linking**\n\n` +
      `Please send your Kick username (without @).\n` +
      `Example: sweetflips\n\n` +
      `This will link your Telegram account to your Kick account for gaming features.`
  );
});

bot.command("guess", async (ctx) => {
  // Check if command is used in a group chat
  if (ctx.chat.type !== "private") {
    await ctx.reply(`❌ This command can only be used in personal messages.`);
    return;
  }

  const user = await getUserOrCreate(ctx.from.id, ctx.from.username);

  if (!user.kickName) {
    await ctx.reply(
      `❌ You need to link your Kick account first!\n\n` +
        `Use /kick to link your account.`
    );
    return;
  }

  const args = ctx.message.text.split(" ").slice(1);
  if (args.length < 2) {
    await ctx.reply(
      `❌ Usage: /guess <balance|bonus> <number>\n\n` +
        `Examples:\n` +
        `/guess balance 15000\n` +
        `/guess bonus 500`
    );
    return;
  }

  const gameType = args[0].toLowerCase();
  const guess = parseFloat(args[1]);

  if (isNaN(guess) || guess <= 0) {
    await ctx.reply(`❌ Please enter a valid positive number.`);
    return;
  }

  if (gameType === "balance") {
    if (!gameState.balance.isOpen) {
      await ctx.reply(
        `❌ Balance guessing is not open. Wait for an admin to open it.`
      );
      return;
    }

    if (gameState.balance.isFinalized) {
      await ctx.reply(`❌ Balance game is finalized. Wait for the next round.`);
      return;
    }

    gameState.balance.guesses.set(ctx.from.id, {
      user: user.telegramUser,
      kickName: user.kickName,
      guess: guess,
      timestamp: Date.now(),
    });

    await ctx.reply(`✅ Balance guess recorded: ${guess}`);
  } else if (gameType === "bonus") {
    if (!gameState.bonus.isOpen) {
      await ctx.reply(
        `❌ Bonus guessing is not open. Wait for an admin to open it.`
      );
      return;
    }

    if (gameState.bonus.isFinalized) {
      await ctx.reply(`❌ Bonus game is finalized. Wait for the next round.`);
      return;
    }

    gameState.bonus.guesses.set(ctx.from.id, {
      user: user.telegramUser,
      kickName: user.kickName,
      guess: guess,
      timestamp: Date.now(),
    });

    await ctx.reply(`✅ Bonus guess recorded: ${guess}`);
  } else {
    await ctx.reply(`❌ Invalid game type. Use 'balance' or 'bonus'.`);
  }
});

bot.command("balanceboard", async (ctx) => {
  try {
    const liveBalance = await liveBalanceService.fetchCurrentBalance();

    let leaderboardText = `💰 **Live Balance: ${liveBalance.toLocaleString()}**\n\n`;

    if (
      gameState.balance.isFinalized &&
      gameState.balance.finalBalance !== null
    ) {
      leaderboardText = `🏁 **Final Balance: ${gameState.balance.finalBalance.toLocaleString()}**\n\n`;
    }

    if (gameState.balance.guesses.size === 0) {
      leaderboardText += `No guesses recorded yet. Use /guess balance <number> to make a guess!`;
    } else {
      const guesses = Array.from(gameState.balance.guesses.values());
      const targetBalance = gameState.balance.isFinalized
        ? gameState.balance.finalBalance
        : liveBalance;

      guesses.sort((a, b) => {
        const diffA = Math.abs(a.guess - targetBalance);
        const diffB = Math.abs(b.guess - targetBalance);
        if (diffA === diffB) return a.timestamp - b.timestamp;
        return diffA - diffB;
      });

      leaderboardText += `**Top 5 Closest Guessers:**\n`;
      guesses.slice(0, 5).forEach((guess, index) => {
        const diff = Math.abs(guess.guess - targetBalance);
        const emoji =
          index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : "🏅";

        let prizeText = "";
        if (index === 0) prizeText = " - $12.50";
        else if (index === 1) prizeText = " - $7.50";
        else if (index === 2) prizeText = " - $5.00";

        leaderboardText += `${emoji} ${index + 1}. @${
          guess.kickName
        } - ${guess.guess.toLocaleString()} (Δ ${diff.toLocaleString()})${prizeText}\n`;
      });
    }

    await ctx.reply(leaderboardText);
  } catch (error) {
    console.error("❌ Error showing balance leaderboard:", error);
    await ctx.reply(
      `❌ Error loading balance leaderboard. Please try again later.`
    );
  }
});

bot.command("bonusboard", async (ctx) => {
  let leaderboardText = `🎁 **Active Bonuses: ${gameState.bonus.bonusAmount}**\n\n`;

  if (gameState.bonus.bonusList.length > 0) {
    leaderboardText += `**Bonus List:**\n`;
    gameState.bonus.bonusList.forEach((bonus, index) => {
      leaderboardText += `${index + 1}. ${bonus}\n`;
    });
    leaderboardText += `\n`;
  }

  if (gameState.bonus.isFinalized && gameState.bonus.finalBonus !== null) {
    leaderboardText = `🏆 **Final Bonus Total: ${gameState.bonus.finalBonus}**\n\n`;
  }

  if (gameState.bonus.guesses.size === 0) {
    leaderboardText += `No guesses recorded yet. Use /guess bonus <number> to make a guess!`;
  } else {
    const guesses = Array.from(gameState.bonus.guesses.values());
    const targetBonus = gameState.bonus.isFinalized
      ? gameState.bonus.finalBonus
      : gameState.bonus.bonusAmount;

    guesses.sort((a, b) => {
      const diffA = Math.abs(a.guess - targetBonus);
      const diffB = Math.abs(b.guess - targetBonus);
      if (diffA === diffB) return a.timestamp - b.timestamp;
      return diffA - diffB;
    });

    leaderboardText += `**Top 5 Closest Guessers:**\n`;
    guesses.slice(0, 5).forEach((guess, index) => {
      const diff = Math.abs(guess.guess - targetBonus);
      const emoji =
        index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : "🏅";

      let prizeText = "";
      if (index === 0) prizeText = " - $12.50";
      else if (index === 1) prizeText = " - $7.50";
      else if (index === 2) prizeText = " - $5.00";

      leaderboardText += `${emoji} ${index + 1}. @${
        guess.kickName
      } - ${guess.guess.toLocaleString()} (Δ ${diff.toLocaleString()})${prizeText}\n`;
    });
  }

  await ctx.reply(leaderboardText);
});

// Admin commands
bot.command("balance", async (ctx) => {
  const user = await getUserOrCreate(ctx.from.id, ctx.from.username);

  if (!isAdmin(user)) {
    await ctx.reply(`⛔️ Mods only.`);
    return;
  }

  const args = ctx.message.text.split(" ").slice(1);
  const action = args[0];

  switch (action) {
    case "open":
      gameState.balance.isOpen = true;
      gameState.balance.isFinalized = false;
      await ctx.reply(
        `✅ Balance guessing is now OPEN! Users can submit their guesses.`
      );
      break;

    case "close":
      gameState.balance.isOpen = false;
      await ctx.reply(
        `⛔️ Balance guessing is now CLOSED. ${gameState.balance.guesses.size} guesses collected.`
      );
      break;

    case "finalize":
      try {
        const liveBalance = await liveBalanceService.fetchCurrentBalance();
        gameState.balance.finalBalance = liveBalance;
        gameState.balance.isFinalized = true;
        await ctx.reply(
          `🏁 Balance game finalized with live balance: ${liveBalance.toLocaleString()}`
        );
      } catch (error) {
        await ctx.reply(`❌ Error finalizing balance game. Please try again.`);
      }
      break;

    case "reset":
      gameState.balance = {
        isOpen: false,
        isFinalized: false,
        finalBalance: null,
        guesses: new Map(),
      };
      await ctx.reply(`🔄 Balance game reset. All guesses cleared.`);
      break;

    case "show":
      const balanceGuesses = Array.from(gameState.balance.guesses.values());
      if (balanceGuesses.length === 0) {
        await ctx.reply(`📊 No balance guesses recorded yet.`);
      } else {
        let showText = `📊 **Balance Guesses (${balanceGuesses.length}):**\n\n`;
        balanceGuesses.forEach((guess, index) => {
          showText += `${index + 1}. @${
            guess.kickName
          } - ${guess.guess.toLocaleString()}\n`;
        });
        await ctx.reply(showText);
      }
      break;

    default:
      await ctx.reply(
        `❌ Invalid balance command. Use: open, close, finalize, reset, show`
      );
  }
});

bot.command("bonus", async (ctx) => {
  const user = await getUserOrCreate(ctx.from.id, ctx.from.username);

  if (!isAdmin(user)) {
    await ctx.reply(`⛔️ Mods only.`);
    return;
  }

  const args = ctx.message.text.split(" ").slice(1);
  const action = args[0];

  switch (action) {
    case "open":
      gameState.bonus.isOpen = true;
      gameState.bonus.isFinalized = false;
      await ctx.reply(
        `✅ Bonus guessing is now OPEN! Users can submit their guesses.`
      );
      break;

    case "close":
      gameState.bonus.isOpen = false;
      await ctx.reply(
        `⛔️ Bonus guessing is now CLOSED. ${gameState.bonus.guesses.size} guesses collected.`
      );
      break;

    case "finalize":
      gameState.bonus.finalBonus = gameState.bonus.bonusAmount;
      gameState.bonus.isFinalized = true;
      await ctx.reply(
        `🏆 Bonus game finalized with total: ${gameState.bonus.bonusAmount}`
      );
      break;

    case "reset":
      gameState.bonus = {
        isOpen: false,
        isFinalized: false,
        finalBonus: null,
        guesses: new Map(),
        bonusAmount: 0,
        bonusList: [],
      };
      await ctx.reply(`🔄 Bonus game reset. All guesses and bonuses cleared.`);
      break;

    case "show":
      const bonusGuesses = Array.from(gameState.bonus.guesses.values());
      if (bonusGuesses.length === 0) {
        await ctx.reply(`📊 No bonus guesses recorded yet.`);
      } else {
        let showText = `📊 **Bonus Guesses (${bonusGuesses.length}):**\n\n`;
        bonusGuesses.forEach((guess, index) => {
          showText += `${index + 1}. @${
            guess.kickName
          } - ${guess.guess.toLocaleString()}\n`;
        });
        await ctx.reply(showText);
      }
      break;

    default:
      await ctx.reply(
        `❌ Invalid bonus command. Use: open, close, finalize, reset, show`
      );
  }
});

bot.command("add", async (ctx) => {
  const user = await getUserOrCreate(ctx.from.id, ctx.from.username);

  if (!isAdmin(user)) {
    await ctx.reply(`⛔️ Mods only.`);
    return;
  }

  const args = ctx.message.text.split(" ").slice(1);
  if (args.length === 0) {
    await ctx.reply(`❌ Usage: /add <bonus name>\n\nExample: /add Wanted`);
    return;
  }

  const bonusName = args.join(" ").trim();

  if (bonusName.length < 2 || bonusName.length > 50) {
    await ctx.reply(`❌ Bonus name must be 2-50 characters.`);
    return;
  }

  gameState.bonus.bonusAmount += 1;
  gameState.bonus.bonusList.push(bonusName);

  await ctx.reply(
    `✅ Added bonus: "${bonusName}"\n\nTotal bonuses: ${gameState.bonus.bonusAmount}`
  );
});

bot.command("remove", async (ctx) => {
  const user = await getUserOrCreate(ctx.from.id, ctx.from.username);

  if (!isAdmin(user)) {
    await ctx.reply(`⛔️ Mods only.`);
    return;
  }

  const args = ctx.message.text.split(" ").slice(1);
  if (args.length === 0) {
    await ctx.reply(
      `❌ Usage: /remove <bonus name>\n\nExample: /remove Wanted`
    );
    return;
  }

  const bonusName = args.join(" ").trim();

  const bonusIndex = gameState.bonus.bonusList.indexOf(bonusName);
  if (bonusIndex === -1) {
    await ctx.reply(`❌ Bonus "${bonusName}" not found in the list.`);
    return;
  }

  gameState.bonus.bonusAmount = Math.max(0, gameState.bonus.bonusAmount - 1);
  gameState.bonus.bonusList.splice(bonusIndex, 1);

  await ctx.reply(
    `✅ Removed bonus: "${bonusName}"\n\nTotal bonuses: ${gameState.bonus.bonusAmount}`
  );
});

bot.command("setrole", async (ctx) => {
  const user = await getUserOrCreate(ctx.from.id, ctx.from.username);

  if (user.role !== "OWNER") {
    await ctx.reply(`⛔️ Owner only.`);
    return;
  }

  const args = ctx.message.text.split(" ").slice(1);
  if (args.length < 2) {
    await ctx.reply(`❌ Usage: /setrole <telegram_id> <MOD|OWNER>`);
    return;
  }

  const targetId = args[0];
  const newRole = args[1].toUpperCase();

  if (!["MOD", "OWNER"].includes(newRole)) {
    await ctx.reply(`❌ Invalid role. Use MOD or OWNER.`);
    return;
  }

  try {
    if (!prisma) {
      await ctx.reply("❌ Database unavailable. Cannot set role.");
      return;
    }

    const targetUser = await prisma.user.findUnique({
      where: { telegramId: targetId },
    });

    if (!targetUser) {
      await ctx.reply(`❌ User not found.`);
      return;
    }

    await prisma.user.update({
      where: { telegramId: targetId },
      data: { role: newRole },
    });

    await ctx.reply(
      `✅ Role updated: ${targetUser.telegramUser} is now ${newRole}`
    );
  } catch (error) {
    await ctx.reply(`❌ Error updating role.`);
  }
});

bot.command("listusers", async (ctx) => {
  const user = await getUserOrCreate(ctx.from.id, ctx.from.username);

  if (!isAdmin(user)) {
    await ctx.reply(`⛔️ Mods only.`);
    return;
  }

  try {
    if (!prisma) {
      await ctx.reply("❌ Database unavailable. Cannot list users.");
      return;
    }

    const users = await prisma.user.findMany({
      orderBy: { createdAt: "desc" },
    });

    let userList = `👥 **All Users (${users.length}):**\n\n`;
    users.forEach((u, index) => {
      const kickStatus = u.kickName ? `✅ @${u.kickName}` : "❌ Not linked";
      userList += `${index + 1}. ${u.telegramUser || "Unknown"} (${
        u.telegramId
      }) - ${u.role} - ${kickStatus}\n`;
    });

    await ctx.reply(userList);
  } catch (error) {
    await ctx.reply(`❌ Error listing users.`);
  }
});

// Function to get all group chats where bot is admin
async function getAdminGroups() {
  try {
    const response = await fetch(
      `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/getUpdates`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status}`);
    }

    const data = await response.json();
    const adminGroups = new Set();

    // Process updates to find group chats where bot is admin
    for (const update of data.result || []) {
      if (update.message && update.message.chat) {
        const chat = update.message.chat;
        if (chat.type === 'group' || chat.type === 'supergroup') {
          adminGroups.add(chat.id);
        }
      }
    }

    return Array.from(adminGroups);
  } catch (error) {
    console.error("❌ Error getting admin groups:", error);
    return [];
  }
}

// Function to send live announcement to all admin groups
async function sendLiveAnnouncement() {
  const liveMessage = `Sweetflips is now live on Kick
@https://kick.com/sweetflips`;

  try {
    const adminGroups = await getAdminGroups();
    
    if (adminGroups.length === 0) {
      console.log("⚠️ No admin groups found to send live announcement");
      return { success: 0, failed: 0, groups: [] };
    }

    let successCount = 0;
    let failedCount = 0;
    const results = [];

    for (const groupId of adminGroups) {
      try {
        await bot.telegram.sendMessage(groupId, liveMessage);
        successCount++;
        results.push({ groupId, status: 'success' });
        console.log(`✅ Live announcement sent to group ${groupId}`);
      } catch (error) {
        failedCount++;
        results.push({ groupId, status: 'failed', error: error.message });
        console.error(`❌ Failed to send to group ${groupId}:`, error.message);
      }
    }

    return { success: successCount, failed: failedCount, groups: results };
  } catch (error) {
    console.error("❌ Error sending live announcement:", error);
    return { success: 0, failed: 0, groups: [], error: error.message };
  }
}

bot.command("live", async (ctx) => {
  const user = await getUserOrCreate(ctx.from.id, ctx.from.username);

  if (!isAdmin(user)) {
    await ctx.reply(`⛔️ Mods only.`);
    return;
  }

  await ctx.reply("📢 Sending live announcement to all admin groups...");

  try {
    const result = await sendLiveAnnouncement();
    
    if (result.success > 0) {
      await ctx.reply(
        `✅ Live announcement sent successfully!\n\n` +
        `📊 **Results:**\n` +
        `✅ Success: ${result.success} groups\n` +
        `❌ Failed: ${result.failed} groups\n\n` +
        `🎉 Sweetflips is now live on Kick!`
      );
    } else {
      await ctx.reply(
        `❌ Failed to send live announcement.\n\n` +
        `📊 **Results:**\n` +
        `✅ Success: ${result.success} groups\n` +
        `❌ Failed: ${result.failed} groups\n\n` +
        `⚠️ No groups were reached. Make sure the bot is admin in group chats.`
      );
    }
  } catch (error) {
    console.error("❌ Error in live command:", error);
    await ctx.reply("❌ Error sending live announcement. Please try again.");
  }
});

// Handle text messages for Kick linking
bot.on("text", async (ctx) => {
  if (global.linkingUsers.has(ctx.from.id)) {
    const kickUsername = ctx.message.text.trim();

    if (kickUsername.length < 3 || kickUsername.length > 20) {
      await ctx.reply(`❌ Invalid Kick username. Must be 3-20 characters.`);
      return;
    }

    // Check if Kick username is already linked to another user
    if (!prisma) {
      await ctx.reply("❌ Database unavailable. Cannot link Kick account.");
      return;
    }

    const existingUser = await prisma.user.findFirst({
      where: { kickName: kickUsername },
    });

    if (existingUser) {
      await ctx.reply(
        `❌ This Kick username is already linked to another Telegram account.`
      );
      global.linkingUsers.delete(ctx.from.id);
      return;
    }

    try {
      const user = await prisma.user.update({
        where: { telegramId: ctx.from.id.toString() },
        data: {
          kickName: kickUsername,
          linkedAt: new Date(),
        },
      });

      global.linkingUsers.delete(ctx.from.id);

      await ctx.reply(
        `✅ **Account Linked Successfully!**\n\n` +
          `Telegram: @${user.telegramUser}\n` +
          `Kick: @${kickUsername}\n\n` +
          `You can now participate in gaming features!`
      );

      // Sync to Google Sheets
      await syncToGoogleSheets(user);
    } catch (error) {
      console.error("❌ Error linking account:", error);
      await ctx.reply(`❌ Error linking account. Please try again.`);
      global.linkingUsers.delete(ctx.from.id);
    }
  }
});

// Test command to sync data to Google Sheets
bot.command("testsync", async (ctx) => {
  try {
    const user = await getUserOrCreate(ctx.from.id, ctx.from.username);
    await ctx.reply("✅ Test sync completed! Check your Google Sheets.");
  } catch (error) {
    console.error("❌ Test sync error:", error);
    await ctx.reply("❌ Test sync failed. Check logs.");
  }
});

// Error handling
bot.catch((err, ctx) => {
  console.error("❌ Bot error:", err);
  ctx.reply("❌ An error occurred. Please try again.");
});

// Start bot
async function startBot() {
  console.log("🤖 Starting SweetflipsStreamBot...");
  console.log(
    "🔑 Bot token:",
    process.env.TELEGRAM_BOT_TOKEN ? "✅ Set" : "❌ Missing"
  );

  // Wait for database to be ready
  console.log("⏳ Waiting for database to be ready...");
  const dbReady = await waitForDatabase();

  if (!dbReady) {
    console.log(
      "⚠️ Database not ready, starting bot without database features"
    );
  }

  bot.launch().catch((error) => {
    console.error("❌ Failed to start bot:", error);
    if (error.response && error.response.error_code === 404) {
      console.error("❌ Bot token is invalid or bot doesn't exist!");
      console.error(
        "Please check your TELEGRAM_BOT_TOKEN in Railway environment variables."
      );
    }
    process.exit(1);
  });
}

// Start the bot
startBot();

// Graceful shutdown
process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));

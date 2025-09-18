const { Telegraf } = require("telegraf");
const { PrismaClient } = require("@prisma/client");

// Your bot token
const BOT_TOKEN = "8422817933:AAHm0YU707fnBeuehr-QrFJD-4A9M6aTCPc";

const bot = new Telegraf(BOT_TOKEN);
const prisma = new PrismaClient();

// Game state
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

// Add debug logging for all messages
bot.use((ctx, next) => {
  console.log(
    `📨 Received: ${ctx.message?.text || "No text"} from ${
      ctx.from?.username || "Unknown"
    }`
  );
  return next();
});

// Start command
bot.start(async (ctx) => {
  console.log(`👤 User started bot: ${ctx.from.username} (${ctx.from.id})`);

  try {
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

// Help command
bot.command("help", async (ctx) => {
  console.log(`❓ Help requested by: ${ctx.from.username} (${ctx.from.id})`);

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
    console.log(
      `❓ Help displayed for user ${ctx.from.username} (${userRole})`
    );
  } catch (error) {
    console.error("Error in help command:", error);
    await ctx.reply("❌ Error showing help. Please try again.");
  }
});

// Kick command
bot.command("kick", async (ctx) => {
  console.log(
    `🔗 Kick linking requested by: ${ctx.from.username} (${ctx.from.id})`
  );

  try {
    const user = await prisma.user.findUnique({
      where: { telegramId: ctx.from.id.toString() },
    });

    if (!user) {
      await ctx.reply("❌ Please use /start first to set up your account.");
      return;
    }

    // Check if user already has a linked Kick account
    if (user.kickName) {
      await ctx.reply(
        `⛔️ You already linked a Kick account: **${user.kickName}**\n\n` +
          `Only one Kick account can be linked per Telegram account.`
      );
      return;
    }

    // Store linking state in memory (since we don't have linkingMode in DB)
    if (!global.linkingUsers) {
      global.linkingUsers = new Set();
    }

    if (global.linkingUsers.has(ctx.from.id.toString())) {
      await ctx.reply(
        "⏳ You're already in the process of linking your Kick account.\n\n" +
          "Please send your Kick username now, or wait for the linking process to timeout."
      );
      return;
    }

    // Start linking process
    global.linkingUsers.add(ctx.from.id.toString());

    await ctx.reply(
      `🔗 **Kick Account Linking**\n\n` +
        `Please now go ahead and send your personal Kick username.\n` +
        `This will be linked to your Telegram account.\n\n` +
        `Example: sweetflips`
    );

    console.log(`🔗 Kick linking started for user ${ctx.from.username}`);
  } catch (error) {
    console.error("Error in kick command:", error);
    await ctx.reply("❌ Error starting Kick linking. Please try again.");
  }
});

// Handle Kick username input
bot.on("text", async (ctx) => {
  // Skip if it's a command
  if (ctx.message.text.startsWith("/")) {
    return;
  }

  try {
    // Check if user is in linking mode (using in-memory storage)
    if (
      !global.linkingUsers ||
      !global.linkingUsers.has(ctx.from.id.toString())
    ) {
      return; // Not in linking mode, ignore
    }

    const user = await prisma.user.findUnique({
      where: { telegramId: ctx.from.id.toString() },
    });

    if (!user) {
      global.linkingUsers.delete(ctx.from.id.toString());
      await ctx.reply("❌ User not found. Please use /start first.");
      return;
    }

    const kickUsername = ctx.message.text.trim();

    // Basic validation
    if (kickUsername.length < 2 || kickUsername.length > 50) {
      await ctx.reply(
        "❌ Invalid Kick username. Please provide a valid username (2-50 characters)."
      );
      return;
    }

    // Check if this Kick username is already linked to another Telegram account
    const existingUser = await prisma.user.findFirst({
      where: {
        kickName: kickUsername,
        telegramId: { not: ctx.from.id.toString() },
      },
    });

    if (existingUser) {
      await ctx.reply(
        `❌ The Kick username **${kickUsername}** is already linked to another Telegram account.\n\n` +
          `Please use a different Kick username or contact an admin if this is an error.`
      );

      // Reset linking mode
      global.linkingUsers.delete(ctx.from.id.toString());
      return;
    }

    // Link the account
    await prisma.user.update({
      where: { telegramId: ctx.from.id.toString() },
      data: {
        kickName: kickUsername,
        linkedAt: new Date(),
      },
    });

    // Remove from linking mode
    global.linkingUsers.delete(ctx.from.id.toString());

    await ctx.reply(
      `✅ **Kick Account Linked Successfully!**\n\n` +
        `Your Telegram account is now linked to: **${kickUsername}**\n\n` +
        `You can now participate in games that require a linked Kick account!`
    );

    console.log(
      `✅ Kick account linked: ${ctx.from.username} -> ${kickUsername}`
    );
  } catch (error) {
    console.error("Error processing Kick username:", error);
    await ctx.reply("❌ Error linking Kick account. Please try again.");

    // Reset linking mode on error
    if (global.linkingUsers) {
      global.linkingUsers.delete(ctx.from.id.toString());
    }
  }
});

// Balance command (admin only)
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
        break;

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

      case "finalize":
        // Finalize the balance game with test balance
        gameState.balance.finalized = true;
        gameState.balance.finalBalance = 5000; // Test balance
        gameState.balance.isOpen = false; // Close guessing when finalized

        await ctx.reply(
          `🏁 **Balance game FINALIZED!**\n\n` +
            `💰 **Final Balance: $${gameState.balance.finalBalance.toLocaleString()}**\n\n` +
            `The leaderboard now shows final standings. Use /balance reset to start a new round.`
        );
        console.log(
          `🏁 Balance game finalized with balance $${gameState.balance.finalBalance} by ${user.telegramUser}`
        );
        break;

      default:
        await ctx.reply(`Unknown balance command: ${command}`);
        break;
    }
  } catch (error) {
    console.error("Error in balance command:", error);
    await ctx.reply("❌ Error processing balance command.");
  }
});

// Bonus command (admin only)
bot.command("bonus", async (ctx) => {
  console.log(`🎁 Bonus game command: ${ctx.from.username} (${ctx.from.id})`);

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
        break;

      case "reset":
        gameState.bonus.guesses.clear();
        gameState.bonus.isOpen = false;
        gameState.bonus.finalized = false;
        gameState.bonus.finalBonus = null;
        gameState.bonus.activeBonus = 0;
        await ctx.reply(
          "🔄 Bonus game has been reset. All guesses cleared and game unfinalized."
        );
        console.log(`🔄 Bonus game reset by ${user.telegramUser}`);
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

      default:
        await ctx.reply(`Unknown bonus command: ${command}`);
        break;
    }
  } catch (error) {
    console.error("Error in bonus command:", error);
    await ctx.reply("❌ Error processing bonus command.");
  }
});

// Addbonus command
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

// Removebonus command
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

// Guess command
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

// Balanceboard command
bot.command("balanceboard", async (ctx) => {
  console.log(
    `📊 Balance leaderboard requested by: ${ctx.from.username} (${ctx.from.id})`
  );

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
      // Show live balance (using test balance for now)
      const testBalance = 5000; // Test balance
      const balanceGuesses = Array.from(gameState.balance.guesses.values());
      message += `💰 **LIVE BALANCE: $${testBalance.toLocaleString()}**\n\n`;

      if (balanceGuesses.length === 0) {
        message += "No balance guesses yet. Use /guess balance <number>!";
      } else {
        const balanceLeaderboard = balanceGuesses
          .map((guess) => ({
            ...guess,
            difference: Math.abs(guess.value - testBalance),
            isExact: guess.value === testBalance,
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
    await ctx.reply(
      "❌ Unable to show balance leaderboard. Please try again later."
    );
  }
});

// Bonusboard command
bot.command("bonusboard", async (ctx) => {
  console.log(
    `📊 Bonus leaderboard requested by: ${ctx.from.username} (${ctx.from.id})`
  );

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

// Setrole command (admin only)
bot.command("setrole", async (ctx) => {
  console.log(`👑 Set role command: ${ctx.from.username} (${ctx.from.id})`);

  try {
    const user = await prisma.user.findUnique({
      where: { telegramId: ctx.from.id.toString() },
    });

    if (!user || !["MOD", "OWNER"].includes(user.role)) {
      await ctx.reply("⛔️ Mods only.");
      return;
    }

    const args = ctx.message.text.split(" ").slice(1);

    if (args.length < 2) {
      await ctx.reply(
        "Usage: /setrole <telegram_id> <MOD|OWNER>\nExample: /setrole 123456789 MOD"
      );
      return;
    }

    const targetTelegramId = args[0];
    const newRole = args[1].toUpperCase();

    if (!["MOD", "OWNER"].includes(newRole)) {
      await ctx.reply("❌ Role must be either MOD or OWNER.");
      return;
    }

    // Find the target user
    const targetUser = await prisma.user.findUnique({
      where: { telegramId: targetTelegramId },
    });

    if (!targetUser) {
      await ctx.reply(
        `❌ User with Telegram ID ${targetTelegramId} not found.`
      );
      return;
    }

    // Update the role
    await prisma.user.update({
      where: { telegramId: targetTelegramId },
      data: { role: newRole },
    });

    await ctx.reply(
      `✅ **Role Updated Successfully!**\n\n` +
        `User: ${targetUser.telegramUser || "Unknown"} (${
          targetUser.telegramId
        })\n` +
        `New Role: ${newRole}\n\n` +
        `Updated by: ${user.telegramUser}`
    );

    console.log(
      `👑 Role updated: ${targetUser.telegramUser} -> ${newRole} by ${user.telegramUser}`
    );
  } catch (error) {
    console.error("Error in setrole command:", error);
    await ctx.reply("❌ Error processing setrole command.");
  }
});

// Listusers command (admin only)
bot.command("listusers", async (ctx) => {
  console.log(`👥 List users command: ${ctx.from.username} (${ctx.from.id})`);

  try {
    const user = await prisma.user.findUnique({
      where: { telegramId: ctx.from.id.toString() },
    });

    if (!user || !["MOD", "OWNER"].includes(user.role)) {
      await ctx.reply("⛔️ Mods only.");
      return;
    }

    const allUsers = await prisma.user.findMany({
      orderBy: { linkedAt: "desc" },
    });

    if (allUsers.length === 0) {
      await ctx.reply("📋 No users found in the database.");
      return;
    }

    let message = `👥 **All Users (${allUsers.length} total)**\n\n`;

    allUsers.forEach((user, index) => {
      const kickInfo = user.kickName ? `🔗 ${user.kickName}` : "❌ Not linked";
      const roleEmoji =
        user.role === "OWNER" ? "👑" : user.role === "MOD" ? "🛡️" : "👤";

      message += `${index + 1}. ${roleEmoji} **${
        user.telegramUser || "Unknown"
      }**\n`;
      message += `   ID: ${user.telegramId}\n`;
      message += `   Role: ${user.role}\n`;
      message += `   Kick: ${kickInfo}\n`;
      message += `   Joined: ${
        user.linkedAt ? user.linkedAt.toLocaleDateString() : "Unknown"
      }\n\n`;
    });

    // Split message if too long
    if (message.length > 4000) {
      const chunks = message.match(/.{1,4000}/g) || [];
      for (let i = 0; i < chunks.length; i++) {
        await ctx.reply(chunks[i]);
        if (i < chunks.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 100)); // Small delay between messages
        }
      }
    } else {
      await ctx.reply(message);
    }

    console.log(`👥 Listed ${allUsers.length} users for ${user.telegramUser}`);
  } catch (error) {
    console.error("Error in listusers command:", error);
    await ctx.reply("❌ Error processing listusers command.");
  }
});

// Start the bot
console.log("🤖 Starting comprehensive test bot...");
bot
  .launch()
  .then(() => {
    console.log("✅ Test bot is running!");
    console.log("📱 Test sequence:");
    console.log("1. Send /start");
    console.log("2. Send /help");
    console.log("3. Send /kick");
    console.log("4. Send your Kick username");
    console.log("5. Send /balance open (if you have MOD/OWNER role)");
    console.log("6. Send /guess balance 1000");
    console.log("7. Send /balanceboard");
    console.log("8. Send /addbonus 100");
    console.log("9. Send /bonus open");
    console.log("10. Send /guess bonus 50");
    console.log("11. Send /bonusboard");
  })
  .catch(console.error);

// Enable graceful stop
process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));

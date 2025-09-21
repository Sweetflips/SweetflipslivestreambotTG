const { Telegraf } = require("telegraf");

// Your bot token
const BOT_TOKEN = "8422817933:AAHm0YU707fnBeuehr-QrFJD-4A9M6aTCPc";

const bot = new Telegraf(BOT_TOKEN);

// Add debug logging for all messages
bot.use((ctx, next) => {
  console.log(
    `📨 Received: ${ctx.message?.text || "No text"} from ${
      ctx.from?.username || "Unknown"
    }`
  );
  return next();
});

// Simple start command
bot.start(async (ctx) => {
  console.log(`👤 User started bot: ${ctx.from.username} (${ctx.from.id})`);
  await ctx.reply("🎉 Welcome to SweetflipsStreamBot! Bot is working!");
});

// Simple balance open command
bot.command("balance", async (ctx) => {
  console.log(`🎮 Balance command: ${ctx.from.username} (${ctx.from.id})`);

  const args = ctx.message.text.split(" ").slice(1);
  const command = args[0]?.toLowerCase();

  if (command === "open") {
    await ctx.reply(
      "✅ Balance guessing is now OPEN! Users can submit their guesses."
    );
    console.log(`✅ Balance game opened by ${ctx.from.username}`);
  } else {
    await ctx.reply("🎯 Balance Commands: /balance open, /balance close");
  }
});

// Simple help command
bot.command("help", async (ctx) => {
  console.log(`❓ Help requested by: ${ctx.from.username} (${ctx.from.id})`);
  await ctx.reply(
    "🤖 Simple Test Bot Commands:\n/start - Welcome\n/balance open - Open balance\n/help - This help"
  );
});

// Start the bot
console.log("🤖 Starting simple test bot...");
bot
  .launch()
  .then(() => {
    console.log("✅ Simple test bot is running!");
    console.log("📱 Test commands:");
    console.log("1. /start");
    console.log("2. /balance open");
    console.log("3. /help");
  })
  .catch(console.error);

// Enable graceful stop
process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));

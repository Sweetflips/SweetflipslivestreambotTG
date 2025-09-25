import { PrismaClient } from "@prisma/client";
import { google } from "googleapis";
import cron from "node-cron";
import path from "path";
import { Telegraf } from "telegraf";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Prisma with error handling
let prisma = null;
let guessService = null;

// Initialize Prisma client
try {
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

// Database functions for group management
async function saveGroupToDatabase(groupId, groupInfo = {}, source = "auto") {
  if (!prisma) {
    console.log("⚠️ Database not available, skipping group save");
    return false;
  }

  try {
    const groupData = {
      groupId: groupId.toString(),
      title: groupInfo.title || null,
      type: groupInfo.type || null,
      memberCount: groupInfo.memberCount || null,
      isActive: true,
      source: source,
      lastSeen: new Date(),
    };

    await prisma.telegramGroup.upsert({
      where: { groupId: groupId.toString() },
      update: {
        ...groupData,
        updatedAt: new Date(),
      },
      create: groupData,
    });

    console.log(`✅ Group ${groupId} saved to database (source: ${source})`);
    return true;
  } catch (error) {
    console.error(
      `❌ Error saving group ${groupId} to database:`,
      error.message
    );
    return false;
  }
}

async function loadGroupsFromDatabase() {
  if (!prisma) {
    console.log("⚠️ Database not available, returning empty groups list");
    return [];
  }

  try {
    const groups = await prisma.telegramGroup.findMany({
      where: { isActive: true },
      orderBy: { lastSeen: "desc" },
    });

    console.log(`📊 Loaded ${groups.length} groups from database`);
    return groups;
  } catch (error) {
    console.error("❌ Error loading groups from database:", error.message);
    return [];
  }
}

async function markGroupInactive(groupId) {
  if (!prisma) {
    console.log("⚠️ Database not available, skipping group deactivation");
    return false;
  }

  try {
    await prisma.telegramGroup.update({
      where: { groupId: groupId.toString() },
      data: {
        isActive: false,
        updatedAt: new Date(),
      },
    });

    console.log(`🗑️ Group ${groupId} marked as inactive in database`);
    return true;
  } catch (error) {
    console.error(
      `❌ Error marking group ${groupId} as inactive:`,
      error.message
    );
    return false;
  }
}

async function updateGroupInfo(groupId, groupInfo) {
  if (!prisma) {
    console.log("⚠️ Database not available, skipping group update");
    return false;
  }

  try {
    await prisma.telegramGroup.update({
      where: { groupId: groupId.toString() },
      data: {
        title: groupInfo.title || undefined,
        type: groupInfo.type || undefined,
        memberCount: groupInfo.memberCount || undefined,
        lastSeen: new Date(),
        updatedAt: new Date(),
      },
    });

    console.log(`🔄 Group ${groupId} info updated in database`);
    return true;
  } catch (error) {
    console.error(`❌ Error updating group ${groupId} info:`, error.message);
    return false;
  }
}

// Schedule management functions
async function addScheduleEntry(
  dayOfWeek,
  streamNumber,
  eventTitle,
  createdBy
) {
  if (!prisma) {
    console.log("⚠️ Database not available, skipping schedule add");
    return false;
  }

  try {
    await prisma.schedule.upsert({
      where: {
        dayOfWeek_streamNumber: {
          dayOfWeek: dayOfWeek,
          streamNumber: streamNumber,
        },
      },
      update: {
        eventTitle: eventTitle,
        isActive: true,
        createdBy: createdBy,
        updatedAt: new Date(),
      },
      create: {
        dayOfWeek: dayOfWeek,
        streamNumber: streamNumber,
        eventTitle: eventTitle,
        isActive: true,
        createdBy: createdBy,
      },
    });

    console.log(
      `✅ Schedule entry added: Day ${dayOfWeek}, Stream ${streamNumber}, Title: ${eventTitle}`
    );
    return true;
  } catch (error) {
    console.error(`❌ Error adding schedule entry:`, error.message);
    return false;
  }
}

async function removeScheduleEntry(dayOfWeek, streamNumber) {
  if (!prisma) {
    console.log("⚠️ Database not available, skipping schedule remove");
    return false;
  }

  try {
    await prisma.schedule.update({
      where: {
        dayOfWeek_streamNumber: {
          dayOfWeek: dayOfWeek,
          streamNumber: streamNumber,
        },
      },
      data: {
        isActive: false,
        updatedAt: new Date(),
      },
    });

    console.log(
      `🗑️ Schedule entry removed: Day ${dayOfWeek}, Stream ${streamNumber}`
    );
    return true;
  } catch (error) {
    console.error(`❌ Error removing schedule entry:`, error.message);
    return false;
  }
}

async function getScheduleForWeek() {
  if (!prisma) {
    console.log("⚠️ Database not available, returning empty schedule");
    return [];
  }

  try {
    const schedules = await prisma.schedule.findMany({
      where: { isActive: true },
      orderBy: [{ dayOfWeek: "asc" }, { streamNumber: "asc" }],
    });

    console.log(`📅 Loaded ${schedules.length} schedule entries from database`);
    return schedules;
  } catch (error) {
    console.error("❌ Error loading schedule from database:", error.message);
    return [];
  }
}

// Helper function to get day name from day of week number
function getDayName(dayOfWeek) {
  const days = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];
  return days[dayOfWeek] || "Unknown";
}

// Helper function to get stream time in different timezones
function getStreamTimes(streamNumber) {
  const stream1UTC = "07:00"; // 7 AM UTC
  const stream2UTC = "17:00"; // 5 PM UTC

  const utcTime = streamNumber === 1 ? stream1UTC : stream2UTC;

  // Convert to different timezones
  const istTime = streamNumber === 1 ? "12:30" : "22:30"; // +5:30 from UTC
  const pstTime = streamNumber === 1 ? "23:00" : "09:00"; // -8 from UTC (PST)

  return {
    utc: utcTime,
    ist: istTime,
    pst: pstTime,
  };
}

// Automated schedule messaging function
async function sendScheduleToAllGroups() {
  try {
    console.log("📅 Starting automated schedule broadcast...");

    // Get all active groups
    const result = await getAllGroups();
    const allGroups = result.groupIds;

    if (allGroups.length === 0) {
      console.log("⚠️ No groups found for schedule broadcast");
      return { success: 0, failed: 0, groups: [] };
    }

    // Get current schedule
    const schedules = await getScheduleForWeek();

    // Build schedule message (exactly like /schedule command)
    let scheduleMessage;

    if (schedules.length === 0) {
      scheduleMessage =
        `📅 <b>Stream Schedule</b>\n\n` +
        `No scheduled streams found for the next 7 days.\n\n` +
        `<b>Stream Times:</b>\n` +
        `• Stream 1: 7:00 AM UTC (12:30 PM IST, 11:00 PM PST)\n` +
        `• Stream 2: 5:00 PM UTC (10:30 PM IST, 9:00 AM PST)\n\n` +
        `Check back later for updates!`;
    } else {
      scheduleMessage = `📅 <b>Stream Schedule - Next 7 Days</b>\n\n`;

      // Group schedules by day
      const schedulesByDay = {};
      for (const schedule of schedules) {
        if (!schedulesByDay[schedule.dayOfWeek]) {
          schedulesByDay[schedule.dayOfWeek] = [];
        }
        schedulesByDay[schedule.dayOfWeek].push(schedule);
      }

      // Display schedule for each day
      for (let day = 0; day < 7; day++) {
        const dayName = getDayName(day);
        const daySchedules = schedulesByDay[day] || [];

        if (daySchedules.length > 0) {
          scheduleMessage += `<b>${dayName}</b>\n`;

          for (const schedule of daySchedules) {
            const times = getStreamTimes(schedule.streamNumber);
            scheduleMessage += `• Stream ${schedule.streamNumber}: ${schedule.eventTitle}\n`;
            scheduleMessage += `  🌍 UTC: ${times.utc} | 🇮🇳 IST: ${times.ist} | 🇺🇸 PST: ${times.pst}\n`;
          }
          scheduleMessage += `\n`;
        }
      }

      scheduleMessage += `<b>Stream Times:</b>\n`;
      scheduleMessage += `• Stream 1: 7:00 AM UTC (12:30 PM IST, 11:00 PM PST)\n`;
      scheduleMessage += `• Stream 2: 5:00 PM UTC (10:30 PM IST, 9:00 AM PST)\n\n`;
      scheduleMessage += `🎮 Join us at https://kick.com/sweetflips`;
    }

    // Send to all groups
    let successCount = 0;
    let failedCount = 0;
    const results = [];

    console.log(`📢 Sending schedule to ${allGroups.length} groups...`);

    for (const groupId of allGroups) {
      try {
        await bot.telegram.sendMessage(groupId, scheduleMessage, {
          parse_mode: "HTML",
          disable_web_page_preview: false,
        });
        successCount++;
        results.push({ groupId, status: "success" });
        console.log(`✅ Schedule sent to group ${groupId}`);

        // Small delay to avoid rate limiting
        await new Promise((resolve) => setTimeout(resolve, 100));
      } catch (error) {
        failedCount++;
        results.push({ groupId, status: "failed", error: error.message });
        console.error(
          `❌ Failed to send schedule to group ${groupId}:`,
          error.message
        );
      }
    }

    console.log(`\n📊 Schedule Broadcast Results:`);
    console.log(`✅ Successfully sent: ${successCount} groups`);
    console.log(`❌ Failed: ${failedCount} groups`);
    console.log(
      `📈 Success rate: ${((successCount / allGroups.length) * 100).toFixed(
        1
      )}%`
    );

    return { success: successCount, failed: failedCount, groups: results };
  } catch (error) {
    console.error("❌ Error in automated schedule broadcast:", error);
    return { success: 0, failed: 0, groups: [], error: error.message };
  }
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

// Add debugging middleware to log all messages
bot.use((ctx, next) => {
  console.log(`📨 Received message: ${ctx.message?.text || 'No text'} from ${ctx.from?.username || 'Unknown'} (${ctx.from?.id})`);
  return next();
});

// Test command to verify bot is responding
bot.command("test", async (ctx) => {
  console.log("🧪 Test command received");
  await ctx.reply("✅ Bot is responding! Database status: " + (prisma ? "Connected" : "Not connected"));
});

// Force redeploy - /kick command now has personal message restriction

// Global state for linking users
global.linkingUsers = new Set();

// Global state for group management
global.addingGroups = new Set();
global.knownGroups = new Set();

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
  console.log(`🔍 getUserOrCreate called for: ${telegramUser} (${telegramId})`);

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
    try {
      await syncToGoogleSheets(mockUser);
    } catch (error) {
      console.error("❌ Error syncing mock user to Google Sheets:", error);
      // Continue with mock user even if Google Sheets fails
    }

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

    // Sync to Google Sheets
    try {
      await syncToGoogleSheets(user);
    } catch (error) {
      console.error("❌ Error syncing user to Google Sheets:", error);
      // Continue with user even if Google Sheets fails
    }

    return user;
  } catch (error) {
    console.error("❌ Database error in getUserOrCreate:", error);
    // Return mock user if database fails
    const mockUser = {
      id: telegramId.toString(),
      telegramId: telegramId.toString(),
      telegramUser: telegramUser,
      role: "VIEWER",
      kickName: null,
    };

    // Try to sync mock user to Google Sheets
    try {
      await syncToGoogleSheets(mockUser);
    } catch (error) {
      console.error("❌ Error syncing mock user to Google Sheets:", error);
      // Continue with mock user even if Google Sheets fails
    }

    return mockUser;
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
  try {
    const user = await getUserOrCreate(ctx.from.id, ctx.from.username);

    await ctx.reply(
      `🎉 Welcome to SweetflipsStreamBot!\n\n` +
        `You are: ${user.telegramUser || "Unknown"} (${user.telegramId})\n` +
        `Role: ${user.role}\n\n` +
        `🎮 <b>Gaming Commands:</b>\n` +
        `/guess balance &lt;number&gt; - Guess the end balance\n` +
        `/guess bonus &lt;number&gt; - Guess the bonus total\n` +
        `/balanceboard - View balance leaderboard\n` +
        `/bonusboard - View bonus leaderboard\n\n` +
        `🔗 <b>Account Commands:</b>\n` +
        `/kick - Link your Kick account\n` +
        `/help - Show all commands\n\n` +
        `Ready to play? Link your Kick account first with /kick!`,
      { parse_mode: "HTML" }
    );
  } catch (error) {
    console.error("❌ Error in start command:", error);
    await ctx.reply(`❌ An error occurred. Please try again.`);
  }
});

bot.help(async (ctx) => {
  try {
    const user = await getUserOrCreate(ctx.from.id, ctx.from.username);

    if (isAdmin(user)) {
      // Admin/Mod help - shows all commands
      let helpText =
        `🤖 <b>SweetflipsStreamBot Commands</b>\n\n` +
        `🎮 <b>Gaming Commands:</b>\n` +
        `/guess balance &lt;number&gt; - Guess the end balance (requires linked Kick account)\n` +
        `/guess bonus &lt;number&gt; - Guess the bonus total (requires linked Kick account)\n` +
        `/balanceboard - View live balance leaderboard with top 5 guessers\n` +
        `/bonusboard - View active bonus leaderboard with top 5 guessers\n\n` +
        `📅 <b>Schedule Commands:</b>\n` +
        `/schedule - View stream schedule for next 7 days\n\n` +
        `🔗 <b>Account Commands:</b>\n` +
        `/start - Welcome message and setup\n` +
        `/help - Show this help\n` +
        `/kick - Link your Kick account (one-time setup)\n\n` +
        `⚙️ <b>Admin Commands:</b>\n` +
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
        `/add &lt;bonus name&gt; - Add a bonus (counts as +1)\n` +
        `/remove &lt;bonus name&gt; - Remove a bonus (counts as -1)\n\n` +
        `/live - Send live announcement to all groups\n` +
        `/broadcastschedule - Manually send schedule to all groups\n` +
        `/findgroups - Find all group chats where bot is a member\n` +
        `/groupstats - Show detailed group management statistics\n` +
        `/testgroups - Test group detection functionality\n` +
        `/addgroup - Manually add a group ID for live announcements\n\n` +
        `/schedule add &lt;day&gt; &lt;stream&gt; &lt;title&gt; - Add schedule entry\n` +
        `/schedule remove &lt;day&gt; &lt;stream&gt; - Remove schedule entry\n\n` +
        `/setrole &lt;telegram_id&gt; &lt;MOD|OWNER&gt; - Set user role\n` +
        `/listusers - List all users\n\n`;

      await ctx.reply(helpText, { parse_mode: "HTML" });
    } else {
      // Viewer help - shows only gaming and account commands
      let helpText =
        `🤖 <b>SweetflipsStreamBot Commands</b>\n\n` +
        `🎮 <b>Gaming Commands:</b>\n` +
        `/guess balance &lt;number&gt; - Guess the end balance (requires linked Kick account)\n` +
        `/guess bonus &lt;number&gt; - Guess the bonus total (requires linked Kick account)\n` +
        `/balanceboard - View live balance leaderboard with top 5 guessers\n` +
        `/bonusboard - View active bonus leaderboard with top 5 guessers\n\n` +
        `📅 <b>Schedule Commands:</b>\n` +
        `/schedule - View stream schedule for next 7 days\n\n` +
        `🔗 <b>Account Commands:</b>\n` +
        `/start - Welcome message and setup\n` +
        `/help - Show this help\n` +
        `/kick - Link your Kick account (one-time setup)\n\n`;

      await ctx.reply(helpText, { parse_mode: "HTML" });
    }
  } catch (error) {
    console.error("❌ Error in help command:", error);
    console.error("❌ Error details:", error.message);
    console.error("❌ Error stack:", error.stack);
    await ctx.reply(
      `❌ Error in help command: ${error.message}. Please try again.`
    );
  }
});

bot.command("kick", async (ctx) => {
  try {
    // Check if command is used in a group chat
    if (ctx.chat.type !== "private") {
      await ctx.reply(
        `❌ This command can only be used in personal messages. [BOT.JS v2.0]`
      );
      return;
    }

    const user = await getUserOrCreate(ctx.from.id, ctx.from.username);

    if (user.kickName) {
      await ctx.reply(
        `✅ You already linked a Kick account: @${user.kickName}`
      );
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
      `🔗 <b>Kick Account Linking</b>\n\n` +
        `Please send your Kick username (without @).\n` +
        `Example: sweetflips\n\n` +
        `This will link your Telegram account to your Kick account for gaming features.`,
      { parse_mode: "HTML" }
    );
  } catch (error) {
    console.error("❌ Error in kick command:", error);
    await ctx.reply(`❌ An error occurred. Please try again.`);
  }
});

bot.command("guess", async (ctx) => {
  try {
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
        `❌ Usage: /guess <balance|bonus> &lt;number&gt;\n\n` +
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
        await ctx.reply(
          `❌ Balance game is finalized. Wait for the next round.`
        );
        return;
      }

      // Use database storage if available, otherwise fall back to memory
      if (guessService && prisma) {
        try {
          const result = await guessService.submitGuess(
            user.id,
            "GUESS_BALANCE",
            Math.round(guess)
          );

          if (result.success) {
            console.log(
              `✅ Balance guess stored in database for user ${ctx.from.id}: ${guess}`
            );
            await ctx.reply(result.message, { parse_mode: "Markdown" });
          } else {
            await ctx.reply(result.message, { parse_mode: "Markdown" });
          }
        } catch (error) {
          console.error("❌ Database guess storage failed:", error);
          await ctx.reply(
            "❌ Failed to store guess in database. Please try again."
          );
        }
      } else {
        // Fallback to memory storage
        if (gameState.balance.guesses.has(ctx.from.id)) {
          await ctx.reply(
            `⛔️ You already have a balance guess recorded. Only one guess per game allowed.`
          );
          return;
        }

        const existingGuess = Array.from(
          gameState.balance.guesses.values()
        ).find((entry) => entry.guess === guess);

        if (existingGuess) {
          console.log(
            `Duplicate balance guess detected: User ${ctx.from.id} tried to guess ${guess} but it's already taken`
          );
          await ctx.reply(
            `⛔️ This guess has already been submitted by another player. Please choose a different number.`
          );
          return;
        }

        gameState.balance.guesses.set(ctx.from.id, {
          user: user.telegramUser,
          kickName: user.kickName,
          guess: guess,
          timestamp: Date.now(),
        });

        console.log(
          `✅ Balance guess recorded in memory for user ${ctx.from.id}: ${guess}`
        );
        await ctx.reply(`✅ Balance guess recorded: ${guess}`);
      }
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

      // Use database storage if available, otherwise fall back to memory
      if (guessService && prisma) {
        try {
          const result = await guessService.submitGuess(
            user.id,
            "GUESS_BONUS",
            Math.round(guess)
          );

          if (result.success) {
            console.log(
              `✅ Bonus guess stored in database for user ${ctx.from.id}: ${guess}`
            );
            await ctx.reply(result.message, { parse_mode: "Markdown" });
          } else {
            await ctx.reply(result.message, { parse_mode: "Markdown" });
          }
        } catch (error) {
          console.error("❌ Database guess storage failed:", error);
          await ctx.reply(
            "❌ Failed to store guess in database. Please try again."
          );
        }
      } else {
        // Fallback to memory storage
        if (gameState.bonus.guesses.has(ctx.from.id)) {
          await ctx.reply(
            `⛔️ You already have a bonus guess recorded. Only one guess per game allowed.`
          );
          return;
        }

        const existingGuess = Array.from(gameState.bonus.guesses.values()).find(
          (entry) => entry.guess === guess
        );

        if (existingGuess) {
          console.log(
            `Duplicate bonus guess detected: User ${ctx.from.id} tried to guess ${guess} but it's already taken`
          );
          await ctx.reply(
            `⛔️ This guess has already been submitted by another player. Please choose a different number.`
          );
          return;
        }

        gameState.bonus.guesses.set(ctx.from.id, {
          user: user.telegramUser,
          kickName: user.kickName,
          guess: guess,
          timestamp: Date.now(),
        });

        console.log(
          `✅ Bonus guess recorded in memory for user ${ctx.from.id}: ${guess}`
        );
        await ctx.reply(`✅ Bonus guess recorded: ${guess}`);
      }
    } else {
      await ctx.reply(`❌ Invalid game type. Use 'balance' or 'bonus'.`);
    }
  } catch (error) {
    console.error("❌ Error in guess command:", error);
    await ctx.reply(`❌ An error occurred. Please try again.`);
  }
});

bot.command("balanceboard", async (ctx) => {
  try {
    // Log command usage for debugging
    const chatType = ctx.chat?.type || "unknown";
    const chatId = ctx.chat?.id || "unknown";
    console.log(`📊 /balanceboard command used in ${chatType} chat: ${chatId}`);

    const liveBalance = await liveBalanceService.fetchCurrentBalance();

    if (liveBalance === null) {
      await ctx.reply(
        `💰 <b>Balance Leaderboard</b>\n\n` +
          `Unable to fetch live balance at the moment.\n\n` +
          `This could be due to:\n` +
          `• Network connectivity issues\n` +
          `• API service temporarily unavailable\n` +
          `• Missing or invalid API credentials\n\n` +
          `Please try again later or contact an admin.`,
        { parse_mode: "HTML" }
      );
      return;
    }
    let leaderboardText = `💰 <b>Live Balance: ${liveBalance.toLocaleString()}</b>\n\n`;

    if (
      gameState.balance.isFinalized &&
      gameState.balance.finalBalance !== null
    ) {
      leaderboardText = `🏁 <b>Final Balance: ${gameState.balance.finalBalance.toLocaleString()}</b>\n\n`;
    }

    console.log(
      `📊 Balanceboard - Total guesses: ${gameState.balance.guesses.size}`
    );
    console.log(
      `📊 Balanceboard - Game state guesses:`,
      Array.from(gameState.balance.guesses.entries())
    );

    if (gameState.balance.guesses.size === 0) {
      leaderboardText += `No guesses recorded yet. Use /guess balance &lt;number&gt; to make a guess!`;
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

      leaderboardText += `<b>Top 5 Closest Guessers:</b>\n`;
      guesses.slice(0, 5).forEach((guess, index) => {
        const diff = Math.abs(guess.guess - targetBalance);
        const emoji =
          index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : "🏅";

        let prizeText = "";
        if (index === 0) prizeText = " - $25";
        else if (index === 1) prizeText = " - $15";
        else if (index === 2) prizeText = " - $10";

        leaderboardText += `${emoji} ${index + 1}. @${
          guess.kickName
        } - ${guess.guess.toLocaleString()} (Δ ${diff.toLocaleString()})${prizeText}\n`;
      });
    }

    await ctx.reply(leaderboardText, { parse_mode: "HTML" });
  } catch (error) {
    console.error("❌ Error showing balance leaderboard:", error);
    await ctx.reply(
      `❌ Error loading balance leaderboard. Please try again later.`
    );
  }
});

bot.command("bonusboard", async (ctx) => {
  try {
    // Log command usage for debugging
    const chatType = ctx.chat?.type || "unknown";
    const chatId = ctx.chat?.id || "unknown";
    console.log(`🎁 /bonusboard command used in ${chatType} chat: ${chatId}`);

    let leaderboardText = `🎁 <b>Active Bonuses: ${gameState.bonus.bonusAmount}</b>\n\n`;

    if (gameState.bonus.bonusList.length > 0) {
      leaderboardText += `<b>Bonus List:</b>\n`;
      gameState.bonus.bonusList.forEach((bonus, index) => {
        leaderboardText += `${index + 1}. ${bonus}\n`;
      });
      leaderboardText += `\n`;
    }

    if (gameState.bonus.isFinalized && gameState.bonus.finalBonus !== null) {
      leaderboardText = `🏆 <b>Final Bonus Total: ${gameState.bonus.finalBonus}</b>\n\n`;
    }

    if (gameState.bonus.guesses.size === 0) {
      leaderboardText += `No guesses recorded yet. Use /guess bonus &lt;number&gt; to make a guess!`;
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

      leaderboardText += `<b>Top 5 Closest Guessers:</b>\n`;
      guesses.slice(0, 5).forEach((guess, index) => {
        const diff = Math.abs(guess.guess - targetBonus);
        const emoji =
          index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : "🏅";

        let prizeText = "";
        if (index === 0) prizeText = " - $25";
        else if (index === 1) prizeText = " - $15";
        else if (index === 2) prizeText = " - $10";

        leaderboardText += `${emoji} ${index + 1}. @${
          guess.kickName
        } - ${guess.guess.toLocaleString()} (Δ ${diff.toLocaleString()})${prizeText}\n`;
      });
    }

    await ctx.reply(leaderboardText, { parse_mode: "HTML" });
  } catch (error) {
    console.error("❌ Error showing bonus leaderboard:", error);
    await ctx.reply(
      `❌ Error loading bonus leaderboard. Please try again later.`
    );
  }
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
      console.log(
        `📊 Balance show - Total guesses: ${gameState.balance.guesses.size}`
      );
      console.log(
        `📊 Balance show - Game state guesses:`,
        Array.from(gameState.balance.guesses.entries())
      );

      const balanceGuesses = Array.from(gameState.balance.guesses.values());
      if (balanceGuesses.length === 0) {
        await ctx.reply(`📊 No balance guesses recorded yet.`);
      } else {
        let showText = `📊 <b>Balance Guesses (${balanceGuesses.length}):</b>\n\n`;
        balanceGuesses.forEach((guess, index) => {
          showText += `${index + 1}. @${
            guess.kickName
          } - ${guess.guess.toLocaleString()}\n`;
        });
        await ctx.reply(showText, { parse_mode: "HTML" });
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
        let showText = `📊 <b>Bonus Guesses (${bonusGuesses.length}):</b>\n\n`;
        bonusGuesses.forEach((guess, index) => {
          showText += `${index + 1}. @${
            guess.kickName
          } - ${guess.guess.toLocaleString()}\n`;
        });
        await ctx.reply(showText, { parse_mode: "HTML" });
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

    let userList = `👥 <b>All Users (${users.length}):</b>\n\n`;
    users.forEach((u, index) => {
      const kickStatus = u.kickName ? `✅ @${u.kickName}` : "❌ Not linked";
      userList += `${index + 1}. ${u.telegramUser || "Unknown"} (${
        u.telegramId
      }) - ${u.role} - ${kickStatus}\n`;
    });

    await ctx.reply(userList, { parse_mode: "HTML" });
  } catch (error) {
    await ctx.reply(`❌ Error listing users.`);
  }
});

// Function to check if bot is a member of a specific chat
async function isBotMember(chatId) {
  try {
    // Get bot's actual user ID
    const botInfo = await bot.telegram.getMe();
    const botUserId = botInfo.id;

    const response = await fetch(
      `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/getChatMember`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          chat_id: chatId,
          user_id: botUserId, // Bot's actual user ID
        }),
      }
    );

    if (!response.ok) {
      return false;
    }

    const data = await response.json();
    const status = data.result?.status;

    // Bot is a member if it has any status (member, administrator, creator, etc.)
    return status && status !== "left" && status !== "kicked";
  } catch (error) {
    console.error(
      `❌ Error checking membership status for chat ${chatId}:`,
      error
    );
    return false;
  }
}

// Function to get all group chats where bot is a member
async function getAllGroups() {
  const allGroups = new Set();
  const groupDetails = new Map(); // Store group details for better logging

  console.log("🔍 Discovering all groups where bot is a member...");

  // First, load groups from database
  console.log("💾 Loading groups from database...");
  const dbGroups = await loadGroupsFromDatabase();
  for (const dbGroup of dbGroups) {
    try {
      if (await isBotMember(dbGroup.groupId)) {
        allGroups.add(dbGroup.groupId);
        groupDetails.set(dbGroup.groupId, {
          title: dbGroup.title || "Unknown",
          type: dbGroup.type || "unknown",
          source: "database",
          memberCount: dbGroup.memberCount,
        });
        console.log(`✅ Found active group from database: ${dbGroup.groupId}`);

        // Update last seen timestamp
        await updateGroupInfo(dbGroup.groupId, {
          lastSeen: new Date(),
        });
      } else {
        console.log(
          `❌ Group from database is no longer active: ${dbGroup.groupId}`
        );
        await markGroupInactive(dbGroup.groupId);
      }
    } catch (error) {
      console.error(
        `❌ Error checking group from database ${dbGroup.groupId}:`,
        error.message
      );
    }
  }

  // Then, add manually added groups from memory (for backward compatibility)
  console.log(
    `📝 Checking ${global.knownGroups.size} known groups from memory...`
  );
  for (const groupId of global.knownGroups) {
    if (!allGroups.has(groupId)) {
      // Don't duplicate groups already found in database
      try {
        if (await isBotMember(groupId)) {
          allGroups.add(groupId);
          // Try to get group info for better logging
          try {
            const chatInfo = await bot.telegram.getChat(groupId);
            const memberCount = await bot.telegram.getChatMemberCount(groupId);
            groupDetails.set(groupId, {
              title: chatInfo.title || "Unknown",
              type: chatInfo.type,
              source: "memory",
              memberCount: memberCount,
            });

            // Save to database for future persistence
            await saveGroupToDatabase(
              groupId,
              {
                title: chatInfo.title,
                type: chatInfo.type,
                memberCount: memberCount,
              },
              "memory"
            );
          } catch (error) {
            groupDetails.set(groupId, {
              title: "Unknown",
              type: "unknown",
              source: "memory",
            });

            // Save to database even with limited info
            await saveGroupToDatabase(groupId, {}, "memory");
          }
          console.log(`✅ Found active group from memory: ${groupId}`);
        } else {
          console.log(`❌ Group from memory is no longer active: ${groupId}`);
          global.knownGroups.delete(groupId); // Clean up inactive groups
          await markGroupInactive(groupId); // Also mark as inactive in database
        }
      } catch (error) {
        console.error(
          `❌ Error checking group from memory ${groupId}:`,
          error.message
        );
      }
    }
  }

  // Then, try to get groups from environment variable (if configured)
  const configuredGroups = process.env.ADMIN_GROUP_IDS;
  if (configuredGroups) {
    const groupIds = configuredGroups
      .split(",")
      .map((id) => id.trim())
      .filter((id) => id);
    console.log(
      `⚙️ Checking ${groupIds.length} configured groups from environment...`
    );

    for (const groupId of groupIds) {
      if (!allGroups.has(groupId)) {
        // Don't duplicate groups already found
        try {
          if (await isBotMember(groupId)) {
            allGroups.add(groupId);
            // Try to get group info for better logging
            try {
              const chatInfo = await bot.telegram.getChat(groupId);
              const memberCount = await bot.telegram.getChatMemberCount(
                groupId
              );
              groupDetails.set(groupId, {
                title: chatInfo.title || "Unknown",
                type: chatInfo.type,
                source: "environment",
                memberCount: memberCount,
              });

              // Save to database for future persistence
              await saveGroupToDatabase(
                groupId,
                {
                  title: chatInfo.title,
                  type: chatInfo.type,
                  memberCount: memberCount,
                },
                "environment"
              );
            } catch (error) {
              groupDetails.set(groupId, {
                title: "Unknown",
                type: "unknown",
                source: "environment",
              });

              // Save to database even with limited info
              await saveGroupToDatabase(groupId, {}, "environment");
            }
            console.log(`✅ Found active configured group: ${groupId}`);
          } else {
            console.log(`❌ Configured group is no longer active: ${groupId}`);
            await markGroupInactive(groupId);
          }
        } catch (error) {
          console.error(
            `❌ Error checking configured group ${groupId}:`,
            error.message
          );
        }
      }
    }
  }

  // Also try to get groups from recent updates (more comprehensive)
  try {
    console.log("📡 Fetching recent updates to discover new groups...");
    const response = await fetch(
      `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/getUpdates?limit=100&timeout=10`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    if (response.ok) {
      const data = await response.json();
      let newGroupsFound = 0;

      // Process updates to find group chats
      for (const update of data.result || []) {
        // Check regular messages
        if (update.message && update.message.chat) {
          const chat = update.message.chat;
          if (
            (chat.type === "group" || chat.type === "supergroup") &&
            !allGroups.has(chat.id.toString())
          ) {
            try {
              if (await isBotMember(chat.id)) {
                allGroups.add(chat.id.toString());
                try {
                  const memberCount = await bot.telegram.getChatMemberCount(
                    chat.id
                  );
                  groupDetails.set(chat.id.toString(), {
                    title: chat.title || "Unknown",
                    type: chat.type,
                    source: "updates",
                    memberCount: memberCount,
                  });

                  // Save to database for future persistence
                  await saveGroupToDatabase(
                    chat.id.toString(),
                    {
                      title: chat.title,
                      type: chat.type,
                      memberCount: memberCount,
                    },
                    "updates"
                  );
                } catch (error) {
                  groupDetails.set(chat.id.toString(), {
                    title: chat.title || "Unknown",
                    type: chat.type,
                    source: "updates",
                  });

                  // Save to database even with limited info
                  await saveGroupToDatabase(
                    chat.id.toString(),
                    {
                      title: chat.title,
                      type: chat.type,
                    },
                    "updates"
                  );
                }
                newGroupsFound++;
                console.log(
                  `✅ Found new group from updates: ${chat.id} (${
                    chat.title || "Unknown"
                  })`
                );
              }
            } catch (error) {
              console.error(
                `❌ Error checking group from updates ${chat.id}:`,
                error.message
              );
            }
          }
        }

        // Check my_chat_member updates (bot being added/removed)
        if (update.my_chat_member && update.my_chat_member.chat) {
          const chat = update.my_chat_member.chat;
          if (
            (chat.type === "group" || chat.type === "supergroup") &&
            !allGroups.has(chat.id.toString())
          ) {
            try {
              if (await isBotMember(chat.id)) {
                allGroups.add(chat.id.toString());
                try {
                  const memberCount = await bot.telegram.getChatMemberCount(
                    chat.id
                  );
                  groupDetails.set(chat.id.toString(), {
                    title: chat.title || "Unknown",
                    type: chat.type,
                    source: "chat_member_updates",
                    memberCount: memberCount,
                  });

                  // Save to database for future persistence
                  await saveGroupToDatabase(
                    chat.id.toString(),
                    {
                      title: chat.title,
                      type: chat.type,
                      memberCount: memberCount,
                    },
                    "chat_member_updates"
                  );
                } catch (error) {
                  groupDetails.set(chat.id.toString(), {
                    title: chat.title || "Unknown",
                    type: chat.type,
                    source: "chat_member_updates",
                  });

                  // Save to database even with limited info
                  await saveGroupToDatabase(
                    chat.id.toString(),
                    {
                      title: chat.title,
                      type: chat.type,
                    },
                    "chat_member_updates"
                  );
                }
                newGroupsFound++;
                console.log(
                  `✅ Found new group from chat member updates: ${chat.id} (${
                    chat.title || "Unknown"
                  })`
                );
              }
            } catch (error) {
              console.error(
                `❌ Error checking group from chat member updates ${chat.id}:`,
                error.message
              );
            }
          }
        }
      }

      console.log(`📊 Found ${newGroupsFound} new groups from updates`);
    } else {
      console.error("❌ Failed to fetch updates from Telegram API");
    }
  } catch (error) {
    console.error("❌ Error getting groups from updates:", error);
  }

  // Log summary
  console.log(`\n📊 Group Discovery Summary:`);
  console.log(`✅ Total active groups found: ${allGroups.size}`);

  const sourceCounts = {};
  for (const [groupId, details] of groupDetails) {
    sourceCounts[details.source] = (sourceCounts[details.source] || 0) + 1;
  }

  for (const [source, count] of Object.entries(sourceCounts)) {
    console.log(`   ${source}: ${count} groups`);
  }

  return {
    groupIds: Array.from(allGroups),
    groupDetails: groupDetails,
  };
}

// Function to send live announcement to all groups
async function sendLiveAnnouncement() {
  const now = new Date();

  // Format time for different timezones
  const utcTime = now.toLocaleString("en-US", {
    timeZone: "UTC",
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  });

  const istTime = now.toLocaleString("en-US", {
    timeZone: "Asia/Kolkata",
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  });

  const pstTime = now.toLocaleString("en-US", {
    timeZone: "America/Los_Angeles",
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  });

  const liveMessage = `🔴 <b>SWEETFLIPS IS LIVE!</b> 🔴

🎮 <b>Join the stream now:</b>
👉 https://kick.com/sweetflips

⏰ <b>Started:</b>
🌍 UTC: ${utcTime}
🇮🇳 IST: ${istTime}
🇺🇸 PST: ${pstTime}

💬 <b>Get involved:</b>
• Link your Kick account with /kick
• Participate in live games
• Chat with the community
• Win rewards!

🚀 <b>Don't miss out - join now!</b>
#SweetflipsLive #KickStreaming #GamingCommunity`;

  try {
    const result = await getAllGroups();
    const allGroups = result.groupIds;

    if (allGroups.length === 0) {
      console.log("⚠️ No groups found to send live announcement");
      return { success: 0, failed: 0, groups: [] };
    }

    let successCount = 0;
    let failedCount = 0;
    const results = [];
    const failedGroups = []; // Groups to retry

    console.log(
      `📢 Sending live announcement to ${allGroups.length} groups...`
    );

    // First attempt - send to all groups
    for (const groupId of allGroups) {
      try {
        await bot.telegram.sendMessage(groupId, liveMessage, {
          parse_mode: "HTML",
          disable_web_page_preview: false,
        });
        successCount++;
        results.push({ groupId, status: "success", attempt: 1 });
        console.log(`✅ Live announcement sent to group ${groupId}`);

        // Small delay to avoid rate limiting
        await new Promise((resolve) => setTimeout(resolve, 100));
      } catch (error) {
        console.error(
          `❌ Failed to send to group ${groupId} (attempt 1):`,
          error.message
        );

        // Check if it's a retryable error
        if (isRetryableError(error)) {
          failedGroups.push({ groupId, error: error.message, attempt: 1 });
        } else {
          failedCount++;
          results.push({
            groupId,
            status: "failed",
            error: error.message,
            attempt: 1,
          });
        }
      }
    }

    // Retry failed groups after a short delay
    if (failedGroups.length > 0) {
      console.log(`🔄 Retrying ${failedGroups.length} failed groups...`);
      await new Promise((resolve) => setTimeout(resolve, 2000)); // Wait 2 seconds before retry

      for (const { groupId, error: originalError } of failedGroups) {
        try {
          await bot.telegram.sendMessage(groupId, liveMessage, {
            parse_mode: "HTML",
            disable_web_page_preview: false,
          });
          successCount++;
          results.push({ groupId, status: "success", attempt: 2 });
          console.log(
            `✅ Live announcement sent to group ${groupId} (retry successful)`
          );

          // Small delay to avoid rate limiting
          await new Promise((resolve) => setTimeout(resolve, 150));
        } catch (error) {
          failedCount++;
          results.push({
            groupId,
            status: "failed",
            error: error.message,
            originalError: originalError,
            attempt: 2,
          });
          console.error(
            `❌ Failed to send to group ${groupId} (retry failed):`,
            error.message
          );

          // Remove from known groups if bot was removed or group doesn't exist
          if (isPermanentError(error)) {
            global.knownGroups.delete(groupId);
            console.log(
              `🗑️ Removed inactive group from known groups: ${groupId}`
            );
          }
        }
      }
    }

    console.log(`\n📊 Live Announcement Results:`);
    console.log(`✅ Successfully sent: ${successCount} groups`);
    console.log(`❌ Failed: ${failedCount} groups`);
    console.log(
      `📈 Success rate: ${((successCount / allGroups.length) * 100).toFixed(
        1
      )}%`
    );

    return { success: successCount, failed: failedCount, groups: results };
  } catch (error) {
    console.error("❌ Error sending live announcement:", error);
    return { success: 0, failed: 0, groups: [], error: error.message };
  }
}

// Helper function to determine if an error is retryable
function isRetryableError(error) {
  const retryableErrors = [
    "ETELEGRAM",
    "ECONNRESET",
    "ETIMEDOUT",
    "ENOTFOUND",
    "rate limit",
    "flood",
    "temporary",
  ];

  const errorMessage = error.message.toLowerCase();
  return retryableErrors.some((retryableError) =>
    errorMessage.includes(retryableError)
  );
}

// Helper function to determine if an error is permanent (bot removed, group deleted, etc.)
function isPermanentError(error) {
  const permanentErrors = [
    "bot was blocked",
    "chat not found",
    "bot is not a member",
    "group chat was upgraded",
    "chat is deactivated",
    "user is deactivated",
    "forbidden: bot is not a member",
    "forbidden: chat not found",
  ];

  const errorMessage = error.message.toLowerCase();
  return permanentErrors.some((permanentError) =>
    errorMessage.includes(permanentError)
  );
}

bot.command("addgroup", async (ctx) => {
  const user = await getUserOrCreate(ctx.from.id, ctx.from.username);

  if (!isAdmin(user)) {
    await ctx.reply(`⛔️ Mods only.`);
    return;
  }

  if (global.addingGroups.has(ctx.from.id)) {
    await ctx.reply(
      `⏳ You're already in the process of adding a group. Please send the group ID now.`
    );
    return;
  }

  global.addingGroups.add(ctx.from.id);
  await ctx.reply(
    `🔗 <b>Add Group for Live Announcements</b>\n\n` +
      `Please send the group ID you want to add.\n\n` +
      `<b>How to get a group ID:</b>\n` +
      `1. Add @userinfobot to your group\n` +
      `2. Send any message in the group\n` +
      `3. The bot will reply with the group ID\n` +
      `4. Copy the group ID and send it here\n\n` +
      `<b>Example:</b> <code>-1001234567890</code>\n\n` +
      `Type <code>cancel</code> to cancel this operation.`,
    { parse_mode: "HTML" }
  );
});

bot.command("findgroups", async (ctx) => {
  const user = await getUserOrCreate(ctx.from.id, ctx.from.username);

  if (!isAdmin(user)) {
    await ctx.reply(`⛔️ Mods only.`);
    return;
  }

  await ctx.reply("🔍 Finding all group chats where bot is a member...");

  try {
    const result = await getAllGroups();
    const allGroups = result.groupIds;
    const groupDetails = result.groupDetails;

    if (allGroups.length > 0) {
      let message = `✅ <b>Found ${allGroups.length} groups where bot is a member:</b>\n\n`;

      // Use cached group details from database
      for (let i = 0; i < allGroups.length; i++) {
        const groupId = allGroups[i];
        const details = groupDetails.get(groupId);

        if (details) {
          // Use cached information from database
          message += `${i + 1}. <b>${details.title || "Unknown"}</b>\n`;
          message += `   ID: <code>${groupId}</code>\n`;
          message += `   Type: ${details.type}\n`;
          message += `   Members: ${details.memberCount || "Unknown"}\n`;
          message += `   Source: ${details.source}\n\n`;
        } else {
          // Fallback to API call if no cached info
          try {
            const chatInfo = await bot.telegram.getChat(groupId);
            const memberCount = await bot.telegram.getChatMemberCount(groupId);
            message += `${i + 1}. <b>${chatInfo.title || "Unknown"}</b>\n`;
            message += `   ID: <code>${groupId}</code>\n`;
            message += `   Type: ${chatInfo.type}\n`;
            message += `   Members: ${memberCount}\n`;
            message += `   Source: API call\n\n`;
          } catch (error) {
            message += `${
              i + 1
            }. Group ID: \`${groupId}\` (Info unavailable)\n\n`;
          }
        }
      }

      message += `💡 <b>To configure these groups:</b>\n`;
      message += `Add this to your Railway environment variables:\n`;
      message += `\`ADMIN_GROUP_IDS=${allGroups.join(",")}\`\n\n`;
      message += `This will make the /live command more reliable.`;

      await ctx.reply(message, { parse_mode: "HTML" });
    } else {
      await ctx.reply(
        `❌ No groups found automatically.\n\n` +
          `<b>Try these solutions:</b>\n\n` +
          `1. <b>Manual Group Addition:</b>\n` +
          `   Use /addgroup to manually add group IDs\n\n` +
          `2. <b>Generate Activity:</b>\n` +
          `   - Send messages in groups where bot is added\n` +
          `   - Try this command again\n\n` +
          `3. <b>Environment Variable:</b>\n` +
          `   Set <code>ADMIN_GROUP_IDS=group_id_1,group_id_2</code> in Railway\n\n` +
          `4. <b>Get Group ID:</b>\n` +
          `   Add @userinfobot to your group to get the group ID`,
        { parse_mode: "HTML" }
      );
    }
  } catch (error) {
    console.error("❌ Error in findgroups command:", error);
    await ctx.reply("❌ Error finding groups. Please try again.");
  }
});

// Schedule command (viewers and admin management)
bot.command("schedule", async (ctx) => {
  try {
    // Log command usage for debugging
    const chatType = ctx.chat?.type || "unknown";
    const chatId = ctx.chat?.id || "unknown";
    console.log(`📅 /schedule command used in ${chatType} chat: ${chatId}`);

    const user = await getUserOrCreate(ctx.from.id, ctx.from.username);
    const args = ctx.message.text.split(" ").slice(1);

    // If no arguments, show schedule (for everyone)
    if (args.length === 0) {
      try {
        const schedules = await getScheduleForWeek();

        if (schedules.length === 0) {
          await ctx.reply(
            `📅 <b>Stream Schedule</b>\n\n` +
              `No scheduled streams found for the next 7 days.\n\n` +
              `<b>Stream Times:</b>\n` +
              `• Stream 1: 7:00 AM UTC (12:30 PM IST, 11:00 PM PST)\n` +
              `• Stream 2: 5:00 PM UTC (10:30 PM IST, 9:00 AM PST)\n\n` +
              `Check back later for updates!`,
            { parse_mode: "HTML" }
          );
          return;
        }

        let message = `📅 <b>Stream Schedule - Next 7 Days</b>\n\n`;

        // Group schedules by day
        const schedulesByDay = {};
        for (const schedule of schedules) {
          if (!schedulesByDay[schedule.dayOfWeek]) {
            schedulesByDay[schedule.dayOfWeek] = [];
          }
          schedulesByDay[schedule.dayOfWeek].push(schedule);
        }

        // Display schedule for each day
        for (let day = 0; day < 7; day++) {
          const dayName = getDayName(day);
          const daySchedules = schedulesByDay[day] || [];

          if (daySchedules.length > 0) {
            message += `<b>${dayName}</b>\n`;

            for (const schedule of daySchedules) {
              const times = getStreamTimes(schedule.streamNumber);
              message += `• Stream ${schedule.streamNumber}: ${schedule.eventTitle}\n`;
              message += `  🌍 UTC: ${times.utc} | 🇮🇳 IST: ${times.ist} | 🇺🇸 PST: ${times.pst}\n`;
            }
            message += `\n`;
          }
        }

        message += `<b>Stream Times:</b>\n`;
        message += `• Stream 1: 7:00 AM UTC (12:30 PM IST, 11:00 PM PST)\n`;
        message += `• Stream 2: 5:00 PM UTC (10:30 PM IST, 9:00 AM PST)\n\n`;
        message += `🎮 Join us at https://kick.com/sweetflips`;

        await ctx.reply(message, { parse_mode: "HTML" });
      } catch (error) {
        console.error("❌ Error in schedule command:", error);
        await ctx.reply("❌ Error loading schedule. Please try again.");
      }
      return;
    }

    // Admin commands require admin privileges
    if (!isAdmin(user)) {
      await ctx.reply(`⛔️ Mods only.`);
      return;
    }

    const action = args[0].toLowerCase();

    if (action === "add") {
      // /schedule add <day> <stream> <title>
      if (args.length < 4) {
        await ctx.reply(
          `❌ <b>Invalid format for /schedule add</b>\n\n` +
            `<b>Usage:</b> <code>/schedule add &lt;day&gt; &lt;stream&gt; &lt;title&gt;</code>\n\n` +
            `<b>Examples:</b>\n` +
            `• <code>/schedule add monday 1 Gaming Stream</code>\n` +
            `• <code>/schedule add friday 2 Bonus Hunt</code>\n\n` +
            `<b>Days:</b> monday, tuesday, wednesday, thursday, friday, saturday, sunday\n` +
            `<b>Streams:</b> 1 (7AM UTC) or 2 (5PM UTC)`,
          { parse_mode: "HTML" }
        );
        return;
      }

      const dayName = args[1].toLowerCase();
      const streamNumber = parseInt(args[2]);
      const eventTitle = args.slice(3).join(" ");

      // Validate day
      const dayMap = {
        sunday: 0,
        monday: 1,
        tuesday: 2,
        wednesday: 3,
        thursday: 4,
        friday: 5,
        saturday: 6,
      };

      const dayOfWeek = dayMap[dayName];
      if (dayOfWeek === undefined) {
        await ctx.reply(
          `❌ <b>Invalid day name.</b>\n\n` +
            `Valid days: monday, tuesday, wednesday, thursday, friday, saturday, sunday`,
          { parse_mode: "HTML" }
        );
        return;
      }

      // Validate stream number
      if (streamNumber !== 1 && streamNumber !== 2) {
        await ctx.reply(
          `❌ <b>Invalid stream number.</b>\n\n` +
            `Valid streams: 1 (7AM UTC) or 2 (5PM UTC)`,
          { parse_mode: "HTML" }
        );
        return;
      }

      // Add schedule entry
      const success = await addScheduleEntry(
        dayOfWeek,
        streamNumber,
        eventTitle,
        user.id
      );

      if (success) {
        const times = getStreamTimes(streamNumber);
        await ctx.reply(
          `✅ <b>Schedule Entry Added!</b>\n\n` +
            `<b>Day:</b> ${getDayName(dayOfWeek)}\n` +
            `<b>Stream:</b> ${streamNumber}\n` +
            `<b>Title:</b> ${eventTitle}\n` +
            `<b>Times:</b>\n` +
            `🌍 UTC: ${times.utc} | 🇮🇳 IST: ${times.ist} | 🇺🇸 PST: ${times.pst}`,
          { parse_mode: "HTML" }
        );
      } else {
        await ctx.reply("❌ Failed to add schedule entry. Please try again.");
      }
    } else if (action === "remove") {
      // /schedule remove <day> <stream>
      if (args.length < 3) {
        await ctx.reply(
          `❌ <b>Invalid format for /schedule remove</b>\n\n` +
            `<b>Usage:</b> <code>/schedule remove &lt;day&gt; &lt;stream&gt;</code>\n\n` +
            `<b>Examples:</b>\n` +
            `• <code>/schedule remove monday 1</code>\n` +
            `• <code>/schedule remove friday 2</code>\n\n` +
            `<b>Days:</b> monday, tuesday, wednesday, thursday, friday, saturday, sunday\n` +
            `<b>Streams:</b> 1 (7AM UTC) or 2 (5PM UTC)`,
          { parse_mode: "HTML" }
        );
        return;
      }

      const dayName = args[1].toLowerCase();
      const streamNumber = parseInt(args[2]);

      // Validate day
      const dayMap = {
        sunday: 0,
        monday: 1,
        tuesday: 2,
        wednesday: 3,
        thursday: 4,
        friday: 5,
        saturday: 6,
      };

      const dayOfWeek = dayMap[dayName];
      if (dayOfWeek === undefined) {
        await ctx.reply(
          `❌ <b>Invalid day name.</b>\n\n` +
            `Valid days: monday, tuesday, wednesday, thursday, friday, saturday, sunday`,
          { parse_mode: "HTML" }
        );
        return;
      }

      // Validate stream number
      if (streamNumber !== 1 && streamNumber !== 2) {
        await ctx.reply(
          `❌ <b>Invalid stream number.</b>\n\n` +
            `Valid streams: 1 (7AM UTC) or 2 (5PM UTC)`,
          { parse_mode: "HTML" }
        );
        return;
      }

      // Remove schedule entry
      const success = await removeScheduleEntry(dayOfWeek, streamNumber);

      if (success) {
        await ctx.reply(
          `✅ <b>Schedule Entry Removed!</b>\n\n` +
            `<b>Day:</b> ${getDayName(dayOfWeek)}\n` +
            `<b>Stream:</b> ${streamNumber}`,
          { parse_mode: "HTML" }
        );
      } else {
        await ctx.reply(
          "❌ Failed to remove schedule entry. Please try again."
        );
      }
    } else {
      await ctx.reply(
        `❌ <b>Invalid schedule command.</b>\n\n` +
          `<b>Available commands:</b>\n` +
          `• <code>/schedule</code> - View schedule (everyone)\n` +
          `• <code>/schedule add &lt;day&gt; &lt;stream&gt; &lt;title&gt;</code> - Add schedule entry (mods only)\n` +
          `• <code>/schedule remove &lt;day&gt; &lt;stream&gt;</code> - Remove schedule entry (mods only)\n\n` +
          `<b>Examples:</b>\n` +
          `• <code>/schedule add monday 1 Gaming Stream</code>\n` +
          `• <code>/schedule remove friday 2</code>`,
        { parse_mode: "HTML" }
      );
    }
  } catch (error) {
    console.error("❌ Error in schedule command:", error);
    await ctx.reply("❌ Error processing schedule command. Please try again.");
  }
});

// Test command to verify group detection functionality
bot.command("testgroups", async (ctx) => {
  const user = await getUserOrCreate(ctx.from.id, ctx.from.username);

  if (!isAdmin(user)) {
    await ctx.reply(`⛔️ Mods only.`);
    return;
  }

  await ctx.reply("🧪 Testing group detection functionality...");

  try {
    // Test 1: Check current known groups
    let message = `🧪 <b>Group Detection Test Results</b>\n\n`;
    message += `📝 <b>Known Groups (Memory):</b> ${global.knownGroups.size}\n`;
    if (global.knownGroups.size > 0) {
      message += `Groups: ${Array.from(global.knownGroups).join(", ")}\n\n`;
    } else {
      message += `No groups in memory\n\n`;
    }

    // Test 2: Check environment variable
    const configuredGroups = process.env.ADMIN_GROUP_IDS;
    message += `⚙️ <b>Environment Variable:</b> ${
      configuredGroups ? "Set" : "Not set"
    }\n`;
    if (configuredGroups) {
      const groupIds = configuredGroups
        .split(",")
        .map((id) => id.trim())
        .filter((id) => id);
      message += `Configured groups: ${groupIds.length}\n`;
      message += `IDs: ${groupIds.join(", ")}\n\n`;
    } else {
      message += `No ADMIN_GROUP_IDS configured\n\n`;
    }

    // Test 3: Test isBotMember function with a dummy ID
    message += `🔍 <b>Bot Member Check Test:</b>\n`;
    try {
      const testResult = await isBotMember("-1000000000000"); // Dummy group ID
      message += `Dummy group test: ${
        testResult ? "Member" : "Not member"
      } (expected: Not member)\n`;
    } catch (error) {
      message += `Dummy group test: Error - ${error.message}\n`;
    }

    // Test 4: Check if we can get bot info
    try {
      const botInfo = await bot.telegram.getMe();
      message += `Bot info: @${botInfo.username} (ID: ${botInfo.id})\n\n`;
    } catch (error) {
      message += `Bot info: Error - ${error.message}\n\n`;
    }

    message += `💡 <b>Next Steps:</b>\n`;
    message += `1. Add bot to a test group\n`;
    message += `2. Send any message in the group\n`;
    message += `3. Run /findgroups to see if it's detected\n`;
    message += `4. Use /addgroup to manually add group IDs\n`;
    message += `5. Set ADMIN_GROUP_IDS environment variable for persistence`;

    await ctx.reply(message, { parse_mode: "HTML" });
  } catch (error) {
    console.error("❌ Error in testgroups command:", error);
    await ctx.reply("❌ Error running group detection test. Please try again.");
  }
});

// New command to show group statistics
bot.command("groupstats", async (ctx) => {
  const user = await getUserOrCreate(ctx.from.id, ctx.from.username);

  if (!isAdmin(user)) {
    await ctx.reply(`⛔️ Mods only.`);
    return;
  }

  await ctx.reply("📊 Gathering group statistics...");

  try {
    const result = await getAllGroups();
    const allGroups = result.groupIds;
    const groupDetails = result.groupDetails;
    const knownGroupsCount = global.knownGroups.size;
    const configuredGroups = process.env.ADMIN_GROUP_IDS
      ? process.env.ADMIN_GROUP_IDS.split(",").length
      : 0;

    let message = `📊 <b>Group Management Statistics</b>\n\n`;
    message += `🔢 <b>Total Active Groups:</b> ${allGroups.length}\n`;
    message += `💾 <b>Known Groups (Memory):</b> ${knownGroupsCount}\n`;
    message += `⚙️ <b>Configured Groups (Env):</b> ${configuredGroups}\n\n`;

    if (allGroups.length > 0) {
      message += `📋 <b>Group Details:</b>\n`;

      let totalMembers = 0;
      for (let i = 0; i < Math.min(allGroups.length, 10); i++) {
        // Show max 10 groups
        const groupId = allGroups[i];
        const details = groupDetails.get(groupId);

        if (details) {
          // Use cached information from database
          const memberCount = details.memberCount || 0;
          totalMembers += memberCount;

          message += `${i + 1}. <b>${details.title || "Unknown"}</b>\n`;
          message += `   👥 ${memberCount} members\n`;
          message += `   🆔 \`${groupId}\`\n`;
          message += `   📊 ${details.source}\n\n`;
        } else {
          // Fallback to API call if no cached info
          try {
            const chatInfo = await bot.telegram.getChat(groupId);
            const memberCount = await bot.telegram.getChatMemberCount(groupId);
            totalMembers += memberCount;

            message += `${i + 1}. <b>${chatInfo.title || "Unknown"}</b>\n`;
            message += `   👥 ${memberCount} members\n`;
            message += `   🆔 \`${groupId}\`\n`;
            message += `   📊 API call\n\n`;
          } catch (error) {
            message += `${i + 1}. Group \`${groupId}\` (Info unavailable)\n\n`;
          }
        }
      }

      if (allGroups.length > 10) {
        message += `... and ${allGroups.length - 10} more groups\n\n`;
      }

      message += `👥 <b>Total Members Across All Groups:</b> ${totalMembers}\n\n`;
    }

    message += `💡 <b>Tips:</b>\n`;
    message += `• Use /findgroups to see all group IDs\n`;
    message += `• Use /addgroup to manually add groups\n`;
    message += `• Set ADMIN_GROUP_IDS for persistent storage\n`;
    message += `• Groups are auto-detected when bot is added`;

    await ctx.reply(message, { parse_mode: "HTML" });
  } catch (error) {
    console.error("❌ Error in groupstats command:", error);
    await ctx.reply("❌ Error gathering group statistics. Please try again.");
  }
});

bot.command("live", async (ctx) => {
  const user = await getUserOrCreate(ctx.from.id, ctx.from.username);

  if (!isAdmin(user)) {
    await ctx.reply(`⛔️ Mods only.`);
    return;
  }

  await ctx.reply("📢 Sending live announcement to all groups...");

  try {
    const result = await sendLiveAnnouncement();

    if (result.success > 0) {
      await ctx.reply(
        `✅ Live announcement sent successfully!\n\n` +
          `📊 <b>Results:</b>\n` +
          `✅ Success: ${result.success} groups\n` +
          `❌ Failed: ${result.failed} groups\n\n` +
          `🎉 Sweetflips is now live on Kick!`
      );
    } else {
      await ctx.reply(
        `❌ Failed to send live announcement.\n\n` +
          `📊 <b>Results:</b>\n` +
          `✅ Success: ${result.success} groups\n` +
          `❌ Failed: ${result.failed} groups\n\n` +
          `⚠️ No groups were reached.\n\n` +
          `<b>Try this:</b>\n` +
          `1. Use /findgroups to discover group IDs\n` +
          `2. Set ADMIN_GROUP_IDS in Railway environment variables\n` +
          `3. Make sure bot is added to group chats`
      );
    }
  } catch (error) {
    console.error("❌ Error in live command:", error);
    await ctx.reply("❌ Error sending live announcement. Please try again.");
  }
});

bot.command("broadcastschedule", async (ctx) => {
  const user = await getUserOrCreate(ctx.from.id, ctx.from.username);

  if (!isAdmin(user)) {
    await ctx.reply(`⛔️ Mods only.`);
    return;
  }

  await ctx.reply("📅 Broadcasting schedule to all groups...");

  try {
    const result = await sendScheduleToAllGroups();

    if (result.success > 0) {
      await ctx.reply(
        `✅ Schedule broadcast sent successfully!\n\n` +
          `📊 <b>Results:</b>\n` +
          `✅ Success: ${result.success} groups\n` +
          `❌ Failed: ${result.failed} groups\n\n` +
          `📅 Schedule shared with all groups!`
      );
    } else {
      await ctx.reply(
        `❌ Failed to send schedule broadcast.\n\n` +
          `📊 <b>Results:</b>\n` +
          `✅ Success: ${result.success} groups\n` +
          `❌ Failed: ${result.failed} groups\n\n` +
          `⚠️ No groups were reached.\n\n` +
          `<b>Try this:</b>\n` +
          `1. Use /findgroups to discover group IDs\n` +
          `2. Set ADMIN_GROUP_IDS in Railway environment variables\n` +
          `3. Make sure bot is added to group chats`
      );
    }
  } catch (error) {
    console.error("❌ Error in broadcastschedule command:", error);
    await ctx.reply("❌ Error sending schedule broadcast. Please try again.");
  }
});

// Handle when bot is added to a new group
bot.on("my_chat_member", async (ctx) => {
  const update = ctx.update;
  const chatMember = update.my_chat_member;

  if (
    chatMember.chat.type === "group" ||
    chatMember.chat.type === "supergroup"
  ) {
    const chatId = chatMember.chat.id.toString();
    const newStatus = chatMember.new_chat_member.status;
    const oldStatus = chatMember.old_chat_member.status;

    // Bot was added to group
    if (oldStatus === "left" && newStatus === "member") {
      global.knownGroups.add(chatId);
      console.log(
        `✅ Bot added to new group: ${chatId} (${
          chatMember.chat.title || "Unknown"
        })`
      );

      // Save to database
      try {
        const memberCount = await bot.telegram.getChatMemberCount(chatId);
        await saveGroupToDatabase(
          chatId,
          {
            title: chatMember.chat.title,
            type: chatMember.chat.type,
            memberCount: memberCount,
          },
          "auto_added"
        );
      } catch (error) {
        console.error(`❌ Error saving new group to database:`, error.message);
        // Still save with basic info
        await saveGroupToDatabase(
          chatId,
          {
            title: chatMember.chat.title,
            type: chatMember.chat.type,
          },
          "auto_added"
        );
      }

      // Send welcome message to the group
      try {
        await ctx.telegram.sendMessage(
          chatId,
          `🎉 <b>SweetflipsStreamBot is now active!</b>\n\n` +
            `I'm here to help with live stream announcements and gaming features!\n\n` +
            `<b>Available Commands:</b>\n` +
            `• /start - Get started\n` +
            `• /help - See all commands\n` +
            `• /kick <username> - Link your Kick account\n\n` +
            `<b>For Admins:</b>\n` +
            `• /live - Send live announcement to all groups\n` +
            `• /findgroups - Discover all groups\n\n` +
            `Ready to enhance your stream experience! 🚀`,
          { parse_mode: "HTML" }
        );
      } catch (error) {
        console.error(
          `❌ Failed to send welcome message to group ${chatId}:`,
          error.message
        );
      }
    }
    // Bot was removed from group
    else if (oldStatus === "member" && newStatus === "left") {
      global.knownGroups.delete(chatId);
      console.log(
        `❌ Bot removed from group: ${chatId} (${
          chatMember.chat.title || "Unknown"
        })`
      );

      // Mark as inactive in database
      await markGroupInactive(chatId);
    }
  }
});

// Handle when new members join groups (to detect new groups)
bot.on("new_chat_members", async (ctx) => {
  const chat = ctx.chat;

  if (
    (chat.type === "group" || chat.type === "supergroup") &&
    ctx.message.new_chat_members
  ) {
    const chatId = chat.id.toString();

    // Check if bot is one of the new members
    const botInfo = await ctx.telegram.getMe();
    const botWasAdded = ctx.message.new_chat_members.some(
      (member) => member.id === botInfo.id
    );

    if (botWasAdded) {
      global.knownGroups.add(chatId);
      console.log(
        `✅ Bot detected in new group: ${chatId} (${chat.title || "Unknown"})`
      );

      // Save to database
      try {
        const memberCount = await bot.telegram.getChatMemberCount(chatId);
        await saveGroupToDatabase(
          chatId,
          {
            title: chat.title,
            type: chat.type,
            memberCount: memberCount,
          },
          "auto_detected"
        );
      } catch (error) {
        console.error(
          `❌ Error saving detected group to database:`,
          error.message
        );
        // Still save with basic info
        await saveGroupToDatabase(
          chatId,
          {
            title: chat.title,
            type: chat.type,
          },
          "auto_detected"
        );
      }
    }
  }
});

// Handle text messages for Kick linking and group management
bot.on("text", async (ctx) => {
  // Handle Kick account linking
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
        `✅ <b>Account Linked Successfully!</b>\n\n` +
          `Telegram: @${user.telegramUser}\n` +
          `Kick: @${kickUsername}\n\n` +
          `You can now participate in gaming features!`,
        { parse_mode: "HTML" }
      );

      // Sync to Google Sheets
      await syncToGoogleSheets(user);
    } catch (error) {
      console.error("❌ Error linking account:", error);
      await ctx.reply(`❌ Error linking account. Please try again.`);
      global.linkingUsers.delete(ctx.from.id);
    }
  }
  // Handle group ID addition
  else if (global.addingGroups.has(ctx.from.id)) {
    const groupId = ctx.message.text.trim();

    if (groupId.toLowerCase() === "cancel") {
      global.addingGroups.delete(ctx.from.id);
      await ctx.reply("❌ Group addition cancelled.");
      return;
    }

    // Validate group ID format (should start with - and be numeric)
    if (!groupId.match(/^-\d+$/)) {
      await ctx.reply(
        `❌ Invalid group ID format. Group ID should start with - and contain only numbers.\n\n` +
          `Example: \`-1001234567890\`\n\n` +
          `Type \`cancel\` to cancel this operation.`
      );
      return;
    }

    try {
      // Check if bot is a member of this group
      const isMember = await isBotMember(groupId);

      if (!isMember) {
        await ctx.reply(
          `❌ Bot is not a member of this group or group doesn't exist.\n\n` +
            `Make sure:\n` +
            `1. The group ID is correct\n` +
            `2. The bot is added to the group\n` +
            `3. The bot hasn't been removed from the group\n\n` +
            `Type \`cancel\` to cancel this operation.`
        );
        return;
      }

      // Add to known groups
      global.knownGroups.add(groupId);

      // Save to database
      try {
        const chatInfo = await bot.telegram.getChat(groupId);
        const memberCount = await bot.telegram.getChatMemberCount(groupId);
        await saveGroupToDatabase(
          groupId,
          {
            title: chatInfo.title,
            type: chatInfo.type,
            memberCount: memberCount,
          },
          "manual"
        );
      } catch (error) {
        console.error(
          `❌ Error saving manually added group to database:`,
          error.message
        );
        // Still save with basic info
        await saveGroupToDatabase(groupId, {}, "manual");
      }

      global.addingGroups.delete(ctx.from.id);

      await ctx.reply(
        `✅ <b>Group Added Successfully!</b>\n\n` +
          `Group ID: <code>${groupId}</code>\n\n` +
          `This group will now receive live announcements when you use /live.\n\n` +
          `<b>To make this permanent:</b>\n` +
          `Add this to your Railway environment variables:\n` +
          `<code>ADMIN_GROUP_IDS=${Array.from(global.knownGroups).join(
            ","
          )}</code>`,
        { parse_mode: "HTML" }
      );

      console.log(`✅ Group ${groupId} added by user ${ctx.from.id}`);
    } catch (error) {
      console.error("❌ Error adding group:", error);
      await ctx.reply(
        `❌ Error adding group. Please try again.\n\n` +
          `Type \`cancel\` to cancel this operation.`
      );
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

// Auto-restart configuration
const AUTO_RESTART_CONFIG = {
  maxRetries: 10,
  retryDelay: 5000, // 5 seconds
  backoffMultiplier: 1.5,
  maxDelay: 60000, // 1 minute
  healthCheckInterval: 30000, // 30 seconds
  gracefulShutdownTimeout: 10000, // 10 seconds
};

let restartCount = 0;
let isShuttingDown = false;
let healthCheckInterval = null;

// Health check function
async function performHealthCheck() {
  try {
    // Check if bot is running
    if (!bot.botInfo) {
      throw new Error("Bot not initialized");
    }

    // Check database connection if available
    if (prisma) {
      await prisma.$queryRaw`SELECT 1`;
    }

    console.log("✅ Health check passed");
    return true;
  } catch (error) {
    console.error("❌ Health check failed:", error.message);
    return false;
  }
}

// Start health monitoring
function startHealthMonitoring() {
  if (healthCheckInterval) {
    clearInterval(healthCheckInterval);
  }

  healthCheckInterval = setInterval(async () => {
    const isHealthy = await performHealthCheck();
    if (!isHealthy && !isShuttingDown) {
      console.log("🔄 Health check failed, attempting restart...");
      await gracefulRestart();
    }
  }, AUTO_RESTART_CONFIG.healthCheckInterval);
}

// Graceful restart function
async function gracefulRestart() {
  if (isShuttingDown) return;

  restartCount++;
  console.log(
    `🔄 Attempting restart #${restartCount}/${AUTO_RESTART_CONFIG.maxRetries}`
  );

  if (restartCount > AUTO_RESTART_CONFIG.maxRetries) {
    console.error("❌ Maximum restart attempts reached. Exiting...");
    process.exit(1);
  }

  try {
    // Stop health monitoring
    if (healthCheckInterval) {
      clearInterval(healthCheckInterval);
      healthCheckInterval = null;
    }

    // Gracefully stop the bot
    console.log("🛑 Gracefully stopping bot...");
    await bot.stop();

    // Wait for graceful shutdown
    await new Promise((resolve) =>
      setTimeout(resolve, AUTO_RESTART_CONFIG.gracefulShutdownTimeout)
    );

    // Restart the bot
    console.log("🚀 Restarting bot...");
    await startBot();
  } catch (error) {
    console.error("❌ Error during restart:", error);

    // Calculate delay with exponential backoff
    const delay = Math.min(
      AUTO_RESTART_CONFIG.retryDelay *
        Math.pow(AUTO_RESTART_CONFIG.backoffMultiplier, restartCount - 1),
      AUTO_RESTART_CONFIG.maxDelay
    );

    console.log(`⏳ Waiting ${delay}ms before next restart attempt...`);
    setTimeout(() => gracefulRestart(), delay);
  }
}

// Setup automated schedule messaging with cron jobs
function setupAutomatedScheduleMessaging() {
  console.log("⏰ Setting up automated schedule messaging...");

  // Schedule for 7:00 AM UTC (0 7 * * *)
  const morningSchedule = cron.schedule(
    "0 7 * * *",
    async () => {
      console.log("🌅 Morning schedule broadcast triggered (7:00 AM UTC)");
      try {
        const result = await sendScheduleToAllGroups();
        console.log(
          `🌅 Morning broadcast completed: ${result.success} success, ${result.failed} failed`
        );
      } catch (error) {
        console.error("❌ Error in morning schedule broadcast:", error);
      }
    },
    {
      scheduled: true,
      timezone: "UTC",
    }
  );

  // Schedule for 3:00 PM UTC (0 15 * * *)
  const afternoonSchedule = cron.schedule(
    "0 15 * * *",
    async () => {
      console.log("🌆 Afternoon schedule broadcast triggered (3:00 PM UTC)");
      try {
        const result = await sendScheduleToAllGroups();
        console.log(
          `🌆 Afternoon broadcast completed: ${result.success} success, ${result.failed} failed`
        );
      } catch (error) {
        console.error("❌ Error in afternoon schedule broadcast:", error);
      }
    },
    {
      scheduled: true,
      timezone: "UTC",
    }
  );

  console.log("✅ Automated schedule messaging configured:");
  console.log("   🌅 Morning broadcast: 7:00 AM UTC");
  console.log("   🌆 Afternoon broadcast: 3:00 PM UTC");

  // Store references for cleanup
  global.morningSchedule = morningSchedule;
  global.afternoonSchedule = afternoonSchedule;
}

// Start bot with auto-restart capabilities
async function startBot() {
  console.log("🤖 Starting SweetflipsStreamBot...");
  console.log(
    "🔑 Bot token:",
    process.env.TELEGRAM_BOT_TOKEN ? "✅ Set" : "❌ Missing"
  );

  try {
    // Wait for database to be ready
    console.log("⏳ Waiting for database to be ready...");
    const dbReady = await waitForDatabase();

    if (!dbReady) {
      console.log(
        "⚠️ Database not ready, starting bot without database features"
      );
    } else {
      // Initialize GuessService for database storage
      try {
        const { GuessService } = await import("./guessService.js");
        guessService = new GuessService(prisma);
        console.log("✅ GuessService initialized for database storage");
      } catch (error) {
        console.error("❌ GuessService initialization failed:", error.message);
        console.log("⚠️ Bot will run without GuessService features");
        guessService = null;
      }
    }

    // Launch the bot
    await bot.launch();
    console.log("✅ Bot launched successfully");

    // Reset restart count on successful start
    restartCount = 0;

    // Start health monitoring
    startHealthMonitoring();

    // Set up automated schedule messaging
    setupAutomatedScheduleMessaging();

    // Set up graceful shutdown handlers
    setupGracefulShutdown();
  } catch (error) {
    console.error("❌ Failed to start bot:", error);
    if (error.response && error.response.error_code === 404) {
      console.error("❌ Bot token is invalid or bot doesn't exist!");
      console.error(
        "Please check your TELEGRAM_BOT_TOKEN in Railway environment variables."
      );
    }

    // Attempt restart if not shutting down
    if (!isShuttingDown) {
      await gracefulRestart();
    } else {
      process.exit(1);
    }
  }
}

// Setup graceful shutdown handlers
function setupGracefulShutdown() {
  const shutdown = async (signal) => {
    if (isShuttingDown) return;
    isShuttingDown = true;

    console.log(`🛑 Received ${signal}, shutting down gracefully...`);

    // Stop health monitoring
    if (healthCheckInterval) {
      clearInterval(healthCheckInterval);
      healthCheckInterval = null;
    }

    // Stop automated schedule messaging
    if (global.morningSchedule) {
      global.morningSchedule.stop();
      console.log("✅ Morning schedule broadcast stopped");
    }
    if (global.afternoonSchedule) {
      global.afternoonSchedule.stop();
      console.log("✅ Afternoon schedule broadcast stopped");
    }

    try {
      // Stop the bot
      await bot.stop(signal);
      console.log("✅ Bot stopped gracefully");

      // Close database connection
      if (prisma) {
        await prisma.$disconnect();
        console.log("✅ Database connection closed");
      }

      process.exit(0);
    } catch (error) {
      console.error("❌ Error during shutdown:", error);
      process.exit(1);
    }
  };

  process.once("SIGINT", () => shutdown("SIGINT"));
  process.once("SIGTERM", () => shutdown("SIGTERM"));
  process.once("SIGUSR2", () => shutdown("SIGUSR2")); // For nodemon
}

// Start the bot
startBot();

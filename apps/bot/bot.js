import cron from "node-cron";
import path from "path";
import { Telegraf } from "telegraf";
import { fileURLToPath } from "url";
import { createPrismaClient } from "./dist/services/prismaClient.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Prisma with error handling
let prisma = null;
let guessService = null;

// Initialize Prisma client
try {
  console.log("🔧 Initializing Prisma client...");
  console.log("📊 DATABASE_URL:", process.env.DATABASE_URL ? "Set" : "Not set");
  prisma = createPrismaClient();
  console.log("✅ Database connection initialized");
  console.log("🔍 Prisma client type:", typeof prisma);
  console.log("🔍 Prisma client has callSession:", !!prisma.callSession);
} catch (error) {
  console.error("❌ Database initialization failed:", error.message);
  console.log("⚠️ Bot will run without database features");
  prisma = null;
}

// Function to wait for database to be ready
async function waitForDatabase() {
  if (!prisma) {
    console.log("❌ Prisma client not initialized");
    return false;
  }

  let retries = 0;
  const maxRetries = 10;

  while (retries < maxRetries) {
    try {
      // Try to connect first
      await prisma.$connect();
      console.log("✅ Database connected");

      // Try to query a simple table to check if database is ready
      await prisma.$queryRaw`SELECT 1`;
      console.log("✅ Database is ready");
      return true;
    } catch (error) {
      retries++;
      console.log(
        `⏳ Waiting for database... (${retries}/${maxRetries}) - Error: ${error.message}`
      );
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

async function getScheduleWithCurrentDayFirst() {
  if (!prisma) {
    console.log("⚠️ Database not available, returning empty schedule");
    return { schedules: [], currentDay: "", nextStream: null };
  }

  try {
    // Clean up old events first
    await cleanupOldEvents();

    const entries = await prisma.schedule.findMany({
      where: { isActive: true },
      orderBy: [{ dayOfWeek: "asc" }, { streamNumber: "asc" }],
    });

    const now = new Date();
    const currentDayOfWeek = now.getDay();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const currentTimeInMinutes = currentHour * 60 + currentMinute;

    let nextStream = null;
    let nextStreamTime = null;

    const currentDayEntries = entries.filter(
      (entry) => entry.dayOfWeek === currentDayOfWeek
    );
    for (const entry of currentDayEntries) {
      const streamTime = getStreamTimeInMinutes(entry.dayOfWeek, entry.streamNumber);
      if (streamTime > currentTimeInMinutes) {
        const timeUntilStream = streamTime - currentTimeInMinutes;
        if (nextStreamTime === null || timeUntilStream < nextStreamTime) {
          nextStreamTime = timeUntilStream;
          nextStream = `${getDayName(entry.dayOfWeek)} - Stream ${
            entry.streamNumber
          }: ${entry.eventTitle} (in ${Math.floor(timeUntilStream / 60)}h ${
            timeUntilStream % 60
          }m)`;
        }
      }
    }

    if (nextStream === null) {
      for (let dayOffset = 1; dayOffset <= 7; dayOffset++) {
        const checkDay = (currentDayOfWeek + dayOffset) % 7;
        const dayEntries = entries.filter(
          (entry) => entry.dayOfWeek === checkDay
        );

        for (const entry of dayEntries) {
          const streamTime = getStreamTimeInMinutes(entry.dayOfWeek, entry.streamNumber);
          const totalMinutesUntilStream = dayOffset * 24 * 60 + streamTime;

          if (
            nextStreamTime === null ||
            totalMinutesUntilStream < nextStreamTime
          ) {
            nextStreamTime = totalMinutesUntilStream;
            const daysUntil = Math.floor(totalMinutesUntilStream / (24 * 60));
            const hoursUntil = Math.floor(
              (totalMinutesUntilStream % (24 * 60)) / 60
            );
            const minutesUntil = totalMinutesUntilStream % 60;

            let timeString = "";
            if (daysUntil > 0) timeString += `${daysUntil}d `;
            if (hoursUntil > 0) timeString += `${hoursUntil}h `;
            if (minutesUntil > 0) timeString += `${minutesUntil}m`;

            nextStream = `${getDayName(entry.dayOfWeek)} - Stream ${
              entry.streamNumber
            }: ${entry.eventTitle} (in ${timeString.trim()})`;
          }
        }
      }
    }

    // Reorder schedules to show current day first, then upcoming days
    const reorderedEntries = [];

    // Add current day entries first
    const currentDaySchedules = entries.filter(
      (entry) => entry.dayOfWeek === currentDayOfWeek
    );
    reorderedEntries.push(...currentDaySchedules);

    // Add remaining days in order
    for (let dayOffset = 1; dayOffset < 7; dayOffset++) {
      const checkDay = (currentDayOfWeek + dayOffset) % 7;
      const daySchedules = entries.filter(
        (entry) => entry.dayOfWeek === checkDay
      );
      reorderedEntries.push(...daySchedules);
    }

    console.log(
      `📅 Loaded ${entries.length} schedule entries with current day first`
    );
    return {
      schedules: reorderedEntries,
      currentDay: getDayName(currentDayOfWeek),
      nextStream,
    };
  } catch (error) {
    console.error("❌ Error loading schedule from database:", error.message);
    return { schedules: [], currentDay: "", nextStream: null };
  }
}

async function cleanupOldEvents() {
  if (!prisma) {
    return;
  }

  try {
    const now = new Date();
    const currentDayOfWeek = now.getDay();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const currentTimeInMinutes = currentHour * 60 + currentMinute;

    const previousDay = (currentDayOfWeek - 1 + 7) % 7;
    await prisma.schedule.updateMany({
      where: {
        dayOfWeek: previousDay,
        isActive: true,
      },
      data: {
        isActive: false,
        updatedAt: new Date(),
      },
    });

    const threeHoursInMinutes = 3 * 60;

    const stream1Time = getStreamTimeInMinutes(currentDayOfWeek, 1);
    if (currentTimeInMinutes > stream1Time + threeHoursInMinutes) {
      await prisma.schedule.updateMany({
        where: {
          dayOfWeek: currentDayOfWeek,
          streamNumber: 1,
          isActive: true,
        },
        data: {
          isActive: false,
          updatedAt: new Date(),
        },
      });
    }

    const stream2Time = getStreamTimeInMinutes(currentDayOfWeek, 2);
    if (currentTimeInMinutes > stream2Time + threeHoursInMinutes) {
      await prisma.schedule.updateMany({
        where: {
          dayOfWeek: currentDayOfWeek,
          streamNumber: 2,
          isActive: true,
        },
        data: {
          isActive: false,
          updatedAt: new Date(),
        },
      });
    }

    console.log("🧹 Cleaned up old schedule events");
  } catch (error) {
    console.error("❌ Error cleaning up old events:", error.message);
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

function getStreamTimeInMinutes(dayOfWeek, streamNumber) {
  const stream1Time = 9 * 60;
  
  if (streamNumber === 1) {
    return stream1Time;
  }
  
  const lateStreamDays = [0, 1, 3, 6];
  if (lateStreamDays.includes(dayOfWeek)) {
    return 19 * 60;
  }
  
  return 13 * 60;
}

function getStreamTimeUTC(dayOfWeek, streamNumber) {
  const minutes = getStreamTimeInMinutes(dayOfWeek, streamNumber);
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}

function convertUTCToIST(utcTime) {
  const [hours, minutes] = utcTime.split(':').map(Number);
  let istHours = hours + 5;
  let istMinutes = minutes + 30;
  if (istMinutes >= 60) {
    istMinutes -= 60;
    istHours += 1;
  }
  if (istHours >= 24) {
    istHours -= 24;
  }
  return `${istHours.toString().padStart(2, '0')}:${istMinutes.toString().padStart(2, '0')}`;
}

function convertUTCToPST(utcTime) {
  const [hours, minutes] = utcTime.split(':').map(Number);
  let pstHours = hours - 8;
  if (pstHours < 0) {
    pstHours += 24;
  }
  return `${pstHours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}

function getStreamTimes(dayOfWeek, streamNumber) {
  const utcTime = getStreamTimeUTC(dayOfWeek, streamNumber);
  const istTime = convertUTCToIST(utcTime);
  const pstTime = convertUTCToPST(utcTime);

  return {
    utc: utcTime,
    ist: istTime,
    pst: pstTime,
  };
}

// Automated schedule messaging function
async function sendScheduleToAllGroups() {
  const scheduleData = await getScheduleWithCurrentDayFirst();

  let scheduleMessage;

  if (scheduleData.schedules.length === 0) {
    scheduleMessage =
      `📅 <b>Stream Schedule</b>\n\n` +
      `No scheduled streams found for the next 7 days.\n\n` +
      `<b>Stream Times:</b>\n` +
      `• Stream 1 (Early): 9:00 AM UTC\n` +
      `• Stream 2 (Late): Variable times (1:00 PM UTC Tue/Thu/Fri, 7:00 PM UTC Mon/Wed/Sat/Sun)\n\n` +
      `Check back later for updates!`;
  } else {
    scheduleMessage = `📅 <b>Stream Schedule - ${scheduleData.currentDay} & Next 7 Days</b>\n\n`;

    if (scheduleData.nextStream) {
      scheduleMessage += `⏰ <b>Next Stream:</b> ${scheduleData.nextStream}\n\n`;
    }

    const schedulesByDay = {};
    for (const schedule of scheduleData.schedules) {
      if (!schedulesByDay[schedule.dayOfWeek]) {
        schedulesByDay[schedule.dayOfWeek] = [];
      }
      schedulesByDay[schedule.dayOfWeek].push(schedule);
    }

    const currentDayOfWeek = new Date().getDay();
    const orderedDays = [];

    orderedDays.push(currentDayOfWeek);

    for (let dayOffset = 1; dayOffset < 7; dayOffset++) {
      const checkDay = (currentDayOfWeek + dayOffset) % 7;
      orderedDays.push(checkDay);
    }

    for (const day of orderedDays) {
      const dayName = getDayName(day);
      const daySchedules = schedulesByDay[day] || [];

      if (daySchedules.length > 0) {
        const isCurrentDay = day === currentDayOfWeek;
        const dayHeader = isCurrentDay
          ? `📅 <b>${dayName} (Today)</b>`
          : `<b>${dayName}</b>`;
        scheduleMessage += `${dayHeader}\n`;

        for (const schedule of daySchedules) {
          const times = getStreamTimes(schedule.dayOfWeek, schedule.streamNumber);
          scheduleMessage += `• Stream ${schedule.streamNumber}: ${schedule.eventTitle}\n`;
          scheduleMessage += `  🌍 UTC: ${times.utc} | 🇮🇳 IST: ${times.ist} | 🇺🇸 PST: ${times.pst}\n`;
        }
        scheduleMessage += `\n`;
      }
    }

    scheduleMessage += `<b>General Stream Times:</b>\n`;
    scheduleMessage += `• Stream 1 (Early): 9:00 AM UTC\n`;
    scheduleMessage += `• Stream 2 (Late): 1:00 PM UTC (Tue/Thu/Fri) or 7:00 PM UTC (Mon/Wed/Sat/Sun)\n\n`;
    scheduleMessage += `🎮 Join us at https://kick.com/sweetflips`;
  }

  return await broadcastHtmlToAllGroups(scheduleMessage, "Schedule Broadcast");
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
  console.log(
    `📨 Received message: ${ctx.message?.text || "No text"} from ${
      ctx.from?.username || "Unknown"
    } (${ctx.from?.id})`
  );
  return next();
});

// Test command to verify bot is responding
bot.command("test", async (ctx) => {
  console.log("🧪 Test command received");
  await ctx.reply(
    "✅ Bot is responding! Database status: " +
      (prisma ? "Connected" : "Not connected")
  );
});

// Global error handler
bot.catch((err, ctx) => {
  console.error("❌ Bot error:", err);
  console.error("❌ Error context:", {
    message: ctx.message?.text,
    user: ctx.from?.username,
    userId: ctx.from?.id,
    chatId: ctx.chat?.id,
  });

  // Log error details for debugging

  // Try to reply with error info
  ctx.reply("❌ An error occurred. Please try again.").catch(console.error);
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

// Google Sheets integration removed - using database storage instead
console.log("✅ Bot configured to use database storage only");

// Helper functions
async function getUserOrCreate(telegramId, telegramUser) {
  console.log(`🔍 getUserOrCreate called for: ${telegramUser} (${telegramId})`);
  console.log(
    `🔍 Prisma client status: ${prisma ? "Available" : "Not available"}`
  );

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

    // Google Sheets sync removed - using database storage instead

    return mockUser;
  }

  try {
    console.log("🔍 Searching for user in database...");
    let user = await prisma.user.findUnique({
      where: { telegramId: telegramId.toString() },
    });

    if (!user) {
      console.log("👤 User not found, creating new user...");
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
      console.log("👤 User found, checking for updates...");
      // Update username if changed
      if (user.telegramUser !== telegramUser) {
        console.log("🔄 Updating username...");
        user = await prisma.user.update({
          where: { telegramId: telegramId.toString() },
          data: { telegramUser: telegramUser },
        });
      }
      console.log(
        `✅ User found: ${telegramUser} (${telegramId}) - Role: ${user.role}`
      );
    }

    // Google Sheets sync removed - using database storage instead

    console.log("✅ getUserOrCreate completed successfully");
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

    // Google Sheets sync removed - using database storage instead

    return mockUser;
  }
}

// Google Sheets sync function removed - using database storage instead

function isAdmin(user) {
  return ["MOD", "OWNER"].includes(user.role);
}

// Bot commands
bot.start(async (ctx) => {
  try {
    console.log("🚀 /start command received");
    console.log("📋 User info:", {
      id: ctx.from.id,
      username: ctx.from.username,
    });

    const user = await getUserOrCreate(ctx.from.id, ctx.from.username);
    console.log("👤 User created/retrieved:", { id: user.id, role: user.role });

    await ctx.reply(
      `🎉 Welcome to SweetflipsStreamBot!\n\n` +
        `You are: ${user.telegramUser || "Unknown"} (${user.telegramId})\n` +
        `Role: ${user.role}\n\n` +
        `🎮 <b>Gaming Commands:</b>\n` +
        `/guess balance &lt;number&gt; - Guess the end balance\n` +
        `/guess bonus &lt;number&gt; - Guess the bonus total\n` +
        `/balanceboard - View balance leaderboard\n` +
        `/bonusboard - View bonus leaderboard\n\n` +
        `📞 <b>Sweet Calls Game:</b>\n` +
        `/call &lt;slot name&gt; - Call a slot in the current round\n\n` +
        `🔗 <b>Account Commands:</b>\n` +
        `/kick - Link your Kick account\n` +
        `/help - Show all commands\n\n` +
        `Ready to play? Link your Kick account first with /kick!`,
      { parse_mode: "HTML" }
    );

    console.log("✅ /start command completed successfully");
  } catch (error) {
    console.error("❌ Error in start command:", error);
    console.error("❌ Error stack:", error.stack);
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
        `📞 <b>Sweet Calls Game:</b>\n` +
        `/call &lt;slot name&gt; - Call a slot in the current round\n` +
        `/call raffle - Randomly pick a winner (mods only)\n` +
        `/sc &lt;slot name&gt; &lt;multiplier&gt; - Set multiplier for a slot (mods only)\n` +
        `/sc change &lt;slot name&gt; &lt;new multiplier&gt; - Update multiplier (mods only)\n` +
        `/callboard - View top 10 Sweet Calls leaderboard\n\n` +
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
        `/broadcast &lt;message&gt; - Broadcast an HTML message to all groups\n` +
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
        `📞 <b>Sweet Calls Game:</b>\n` +
        `/call &lt;slot name&gt; - Call a slot in the current round\n\n` +
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

    let guesses = [];
    let hasGuesses = false;

    if (guessService && prisma) {
      try {
        const currentRound = await guessService.getCurrentRound(
          "GUESS_BALANCE"
        );
        console.log(
          `📊 Balanceboard - Round found: ${
            currentRound ? "Yes" : "No"
          }, Phase: ${currentRound?.phase}`
        );

        if (currentRound) {
          const dbGuesses = await prisma.guess.findMany({
            where: {
              gameRoundId: currentRound.id,
            },
            include: {
              user: true,
            },
            orderBy: {
              value: "asc",
            },
          });

          console.log(
            `📊 Balanceboard - Database guesses found: ${dbGuesses.length}`
          );

          if (dbGuesses.length > 0) {
            hasGuesses = true;
            guesses = dbGuesses.map((guess) => ({
              kickName:
                guess.user.kickName || guess.user.telegramUser || "Unknown",
              guess: guess.value,
              timestamp: new Date(guess.createdAt).getTime(),
            }));
          }
        }
      } catch (error) {
        console.error(
          "❌ Error fetching balance guesses from database:",
          error
        );
      }
    }

    if (!hasGuesses && gameState.balance.guesses.size > 0) {
      hasGuesses = true;
      guesses = Array.from(gameState.balance.guesses.values());
    }

    console.log(
      `📊 Balanceboard - Total guesses: ${
        hasGuesses ? guesses.length : 0
      }, Game Open: ${gameState.balance.isOpen}`
    );

    if (!hasGuesses) {
      leaderboardText += `No guesses recorded yet. Use /guess balance &lt;number&gt; to make a guess!`;
    } else {
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

    let guesses = [];
    let hasGuesses = false;

    if (guessService && prisma) {
      try {
        const currentRound = await guessService.getCurrentRound("GUESS_BONUS");
        console.log(
          `🎁 Bonusboard - Round found: ${
            currentRound ? "Yes" : "No"
          }, Phase: ${currentRound?.phase}`
        );

        if (currentRound) {
          const dbGuesses = await prisma.guess.findMany({
            where: {
              gameRoundId: currentRound.id,
            },
            include: {
              user: true,
            },
            orderBy: {
              value: "asc",
            },
          });

          console.log(
            `🎁 Bonusboard - Database guesses found: ${dbGuesses.length}`
          );

          if (dbGuesses.length > 0) {
            hasGuesses = true;
            guesses = dbGuesses.map((guess) => ({
              kickName:
                guess.user.kickName || guess.user.telegramUser || "Unknown",
              guess: guess.value,
              timestamp: new Date(guess.createdAt).getTime(),
            }));
          }
        }
      } catch (error) {
        console.error("❌ Error fetching guesses from database:", error);
      }
    }

    if (!hasGuesses && gameState.bonus.guesses.size > 0) {
      hasGuesses = true;
      guesses = Array.from(gameState.bonus.guesses.values());
    }

    console.log(
      `🎁 Bonusboard - Total guesses: ${
        hasGuesses ? guesses.length : 0
      }, Game Open: ${gameState.bonus.isOpen}`
    );

    if (!hasGuesses) {
      leaderboardText += `No guesses recorded yet. Use /guess bonus &lt;number&gt; to make a guess!`;
    } else {
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
      try {
        if (!guessService) {
          await ctx.reply(`❌ Database service not available.`);
          return;
        }

        // Open new balance round in database
        const result = await guessService.openRound("GUESS_BALANCE", user.id);

        // Update in-memory game state
        gameState.balance.isOpen = true;
        gameState.balance.isFinalized = false;

        await ctx.reply(
          `✅ Balance guessing is now OPEN! Users can submit their guesses.`
        );
      } catch (error) {
        console.error("Error opening balance game:", error);
        await ctx.reply(`❌ Error opening balance game. Please try again.`);
      }
      break;

    case "close":
      try {
        if (!guessService) {
          await ctx.reply(`❌ Database service not available.`);
          return;
        }

        // Close balance round in database
        const result = await guessService.closeRound("GUESS_BALANCE", user.id);

        // Update in-memory game state
        gameState.balance.isOpen = false;

        // Get guess count from database for accurate reporting
        const currentRound = await guessService.getCurrentRound(
          "GUESS_BALANCE"
        );
        let guessCount = 0;
        if (currentRound) {
          const guesses = await prisma.guess.findMany({
            where: { gameRoundId: currentRound.id },
          });
          guessCount = guesses.length;
        }

        await ctx.reply(
          `⛔️ Balance guessing is now CLOSED. ${guessCount} guesses collected.`
        );
      } catch (error) {
        console.error("Error closing balance game:", error);
        await ctx.reply(`❌ Error closing balance game. Please try again.`);
      }
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
      try {
        if (!guessService) {
          await ctx.reply(`❌ Database service not available.`);
          return;
        }

        // Close any open balance rounds in database
        await guessService.resetRound("GUESS_BALANCE", user.id);

        // Reset in-memory game state
        gameState.balance = {
          isOpen: false,
          isFinalized: false,
          finalBalance: null,
          guesses: new Map(),
        };

        await ctx.reply(
          `🔄 Balance game reset. All guesses cleared from database and memory.`
        );
      } catch (error) {
        console.error("Error resetting balance game:", error);
        await ctx.reply(`❌ Error resetting balance game. Please try again.`);
      }
      break;

    case "show":
      try {
        if (!guessService) {
          await ctx.reply(`❌ Database service not available.`);
          return;
        }

        // Get current balance round from database
        const currentRound = await guessService.getCurrentRound(
          "GUESS_BALANCE"
        );
        if (!currentRound) {
          await ctx.reply(`📊 No active balance guessing round found.`);
          return;
        }

        // Fetch all guesses for this round from database
        const guesses = await prisma.guess.findMany({
          where: {
            gameRoundId: currentRound.id,
          },
          include: {
            user: true,
          },
          orderBy: {
            value: "asc",
          },
        });

        if (guesses.length === 0) {
          await ctx.reply(`📊 No balance guesses recorded yet.`);
        } else {
          let showText = `📊 <b>Balance Guesses (${guesses.length}):</b>\n\n`;
          guesses.forEach((guess, index) => {
            const kickName =
              guess.user.kickName || guess.user.telegramUser || "Unknown";
            showText += `${
              index + 1
            }. @${kickName} - ${guess.value.toLocaleString()}\n`;
          });
          await ctx.reply(showText, { parse_mode: "HTML" });
        }
      } catch (error) {
        console.error("Error showing balance guesses:", error);
        await ctx.reply(`❌ Error fetching balance guesses from database.`);
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
      try {
        if (!guessService) {
          await ctx.reply(`❌ Database service not available.`);
          return;
        }

        // Open new bonus round in database
        const result = await guessService.openRound("GUESS_BONUS", user.id);

        // Update in-memory game state
        gameState.bonus.isOpen = true;
        gameState.bonus.isFinalized = false;

        await ctx.reply(
          `✅ Bonus guessing is now OPEN! Users can submit their guesses.`
        );
      } catch (error) {
        console.error("Error opening bonus game:", error);
        await ctx.reply(`❌ Error opening bonus game. Please try again.`);
      }
      break;

    case "close":
      try {
        if (!guessService) {
          await ctx.reply(`❌ Database service not available.`);
          return;
        }

        // Close bonus round in database
        const result = await guessService.closeRound("GUESS_BONUS", user.id);

        // Update in-memory game state
        gameState.bonus.isOpen = false;

        // Get guess count from database for accurate reporting
        const currentRound = await guessService.getCurrentRound("GUESS_BONUS");
        let guessCount = 0;
        if (currentRound) {
          const guesses = await prisma.guess.findMany({
            where: { gameRoundId: currentRound.id },
          });
          guessCount = guesses.length;
        }

        await ctx.reply(
          `⛔️ Bonus guessing is now CLOSED. ${guessCount} guesses collected.`
        );
      } catch (error) {
        console.error("Error closing bonus game:", error);
        await ctx.reply(`❌ Error closing bonus game. Please try again.`);
      }
      break;

    case "finalize":
      gameState.bonus.finalBonus = gameState.bonus.bonusAmount;
      gameState.bonus.isFinalized = true;
      await ctx.reply(
        `🏆 Bonus game finalized with total: ${gameState.bonus.bonusAmount}`
      );
      break;

    case "reset":
      try {
        if (!guessService) {
          await ctx.reply(`❌ Database service not available.`);
          return;
        }

        // Close any open bonus rounds in database
        await guessService.resetRound("GUESS_BONUS", user.id);

        // Reset in-memory game state
        gameState.bonus = {
          isOpen: false,
          isFinalized: false,
          finalBonus: null,
          guesses: new Map(),
          bonusAmount: 0,
          bonusList: [],
        };

        await ctx.reply(
          `🔄 Bonus game reset. All guesses and bonuses cleared from database and memory.`
        );
      } catch (error) {
        console.error("Error resetting bonus game:", error);
        await ctx.reply(`❌ Error resetting bonus game. Please try again.`);
      }
      break;

    case "show":
      try {
        if (!guessService) {
          await ctx.reply(`❌ Database service not available.`);
          return;
        }

        // Get current bonus round from database
        const currentRound = await guessService.getCurrentRound("GUESS_BONUS");
        if (!currentRound) {
          await ctx.reply(`📊 No active bonus guessing round found.`);
          return;
        }

        // Fetch all guesses for this round from database
        const guesses = await prisma.guess.findMany({
          where: {
            gameRoundId: currentRound.id,
          },
          include: {
            user: true,
          },
          orderBy: {
            value: "asc",
          },
        });

        if (guesses.length === 0) {
          await ctx.reply(`📊 No bonus guesses recorded yet.`);
        } else {
          let showText = `📊 <b>Bonus Guesses (${guesses.length}):</b>\n\n`;
          guesses.forEach((guess, index) => {
            const kickName =
              guess.user.kickName || guess.user.telegramUser || "Unknown";
            showText += `${
              index + 1
            }. @${kickName} - ${guess.value.toLocaleString()}\n`;
          });
          await ctx.reply(showText, { parse_mode: "HTML" });
        }
      } catch (error) {
        console.error("Error showing bonus guesses:", error);
        await ctx.reply(`❌ Error fetching bonus guesses from database.`);
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

  if (guessService && prisma) {
    try {
      const bonusRound = await guessService.getCurrentRound("GUESS_BONUS");

      await prisma.bonusItem.create({
        data: {
          gameRoundId: bonusRound.id,
          name: bonusName,
        },
      });

      gameState.bonus.bonusAmount += 1;
      gameState.bonus.bonusList.push(bonusName);

      await ctx.reply(
        `✅ Added bonus: "${bonusName}"\n\nTotal bonuses: ${gameState.bonus.bonusAmount}`
      );
    } catch (error) {
      console.error("❌ Error adding bonus item:", error);
      await ctx.reply(`❌ Failed to add bonus item. Please try again.`);
    }
  } else {
    gameState.bonus.bonusAmount += 1;
    gameState.bonus.bonusList.push(bonusName);

    await ctx.reply(
      `✅ Added bonus: "${bonusName}"\n\nTotal bonuses: ${gameState.bonus.bonusAmount}`
    );
  }
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

  if (guessService && prisma) {
    try {
      const bonusRound = await guessService.getCurrentRound("GUESS_BONUS");

      const bonusItem = await prisma.bonusItem.findFirst({
        where: {
          gameRoundId: bonusRound.id,
          name: bonusName,
        },
      });

      if (bonusItem) {
        await prisma.bonusItem.delete({
          where: { id: bonusItem.id },
        });
      }

      gameState.bonus.bonusAmount = Math.max(
        0,
        gameState.bonus.bonusAmount - 1
      );
      gameState.bonus.bonusList.splice(bonusIndex, 1);

      await ctx.reply(
        `✅ Removed bonus: "${bonusName}"\n\nTotal bonuses: ${gameState.bonus.bonusAmount}`
      );
    } catch (error) {
      console.error("❌ Error removing bonus item:", error);
      await ctx.reply(`❌ Failed to remove bonus item. Please try again.`);
    }
  } else {
    gameState.bonus.bonusAmount = Math.max(0, gameState.bonus.bonusAmount - 1);
    gameState.bonus.bonusList.splice(bonusIndex, 1);

    await ctx.reply(
      `✅ Removed bonus: "${bonusName}"\n\nTotal bonuses: ${gameState.bonus.bonusAmount}`
    );
  }
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

async function broadcastHtmlToAllGroups(message, logPrefix = "Broadcast") {
  try {
    const result = await getAllGroups();
    const allGroups = result.groupIds;

    if (allGroups.length === 0) {
      console.log(`⚠️ No groups found for ${logPrefix.toLowerCase()}`);
      return { success: 0, failed: 0, groups: [] };
    }

    let successCount = 0;
    let failedCount = 0;
    const results = [];
    const failedGroups = [];

    console.log(`📢 ${logPrefix} to ${allGroups.length} groups...`);

    for (const groupId of allGroups) {
      try {
        await bot.telegram.sendMessage(groupId, message, {
          parse_mode: "HTML",
          disable_web_page_preview: false,
        });
        successCount++;
        results.push({ groupId, status: "success", attempt: 1 });
        console.log(`✅ ${logPrefix} sent to group ${groupId}`);

        await new Promise((resolve) => setTimeout(resolve, 100));
      } catch (error) {
        console.error(
          `❌ Failed to send to group ${groupId} (attempt 1):`,
          error.message
        );

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

          if (isPermanentError(error)) {
            global.knownGroups.delete(groupId);
            await markGroupInactive(groupId);
            console.log(`🗑️ Removed inactive group: ${groupId}`);
          }
        }
      }
    }

    if (failedGroups.length > 0) {
      console.log(`🔄 Retrying ${failedGroups.length} failed groups...`);
      await new Promise((resolve) => setTimeout(resolve, 2000));

      for (const { groupId, error: originalError } of failedGroups) {
        try {
          await bot.telegram.sendMessage(groupId, message, {
            parse_mode: "HTML",
            disable_web_page_preview: false,
          });
          successCount++;
          results.push({ groupId, status: "success", attempt: 2 });
          console.log(`✅ ${logPrefix} sent to group ${groupId} (retry successful)`);

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

          if (isPermanentError(error)) {
            global.knownGroups.delete(groupId);
            await markGroupInactive(groupId);
            console.log(`🗑️ Removed inactive group: ${groupId}`);
          }
        }
      }
    }

    console.log(`\n📊 ${logPrefix} Results:`);
    console.log(`✅ Successfully sent: ${successCount} groups`);
    console.log(`❌ Failed: ${failedCount} groups`);
    console.log(
      `📈 Success rate: ${((successCount / allGroups.length) * 100).toFixed(1)}%`
    );

    return { success: successCount, failed: failedCount, groups: results };
  } catch (error) {
    console.error(`❌ Error in ${logPrefix.toLowerCase()}:`, error);
    return { success: 0, failed: 0, groups: [], error: error.message };
  }
}

// Function to send live announcement to all groups
async function sendLiveAnnouncement() {
  const now = new Date();

  const utcDate = now.toLocaleString("en-US", {
    timeZone: "UTC",
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const utcTime = now.toLocaleString("en-US", {
    timeZone: "UTC",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });

  const utcTimeFormatted = `${utcDate} at ${utcTime} UTC`;

  const liveMessage = `❤️ SWEETFLIPS IS LIVE ❤️

▶️ Join us on KICK (https://kick.com/sweetflips)

⏰ Started:
🌍 UTC: ${utcTimeFormatted}

💵Earn by watching through linking your Kick here (https://www.kickdashboard.com/login)

Join us on Razed (https://www.razed.com/signup/?raf=SweetFlips) & LuxDrop (https://luxdrop.com/r/sweetflips) 🔥`;

  return await broadcastHtmlToAllGroups(liveMessage, "Live Announcement");
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
        const scheduleData = await getScheduleWithCurrentDayFirst();

        if (scheduleData.schedules.length === 0) {
          await ctx.reply(
            `📅 <b>Stream Schedule</b>\n\n` +
              `No scheduled streams found for the next 7 days.\n\n` +
              `<b>Stream Times:</b>\n` +
              `• Stream 1 (Early): 9:00 AM UTC\n` +
              `• Stream 2 (Late): Variable times (1:00 PM UTC Tue/Thu/Fri, 7:00 PM UTC Mon/Wed/Sat/Sun)\n\n` +
              `Check back later for updates!`,
            { parse_mode: "HTML" }
          );
          return;
        }

        let message = `📅 <b>Stream Schedule - ${scheduleData.currentDay} & Next 7 Days</b>\n\n`;

        // Show next upcoming stream at the top
        if (scheduleData.nextStream) {
          message += `⏰ <b>Next Stream:</b> ${scheduleData.nextStream}\n\n`;
        }

        // Group schedules by day
        const schedulesByDay = {};
        for (const schedule of scheduleData.schedules) {
          if (!schedulesByDay[schedule.dayOfWeek]) {
            schedulesByDay[schedule.dayOfWeek] = [];
          }
          schedulesByDay[schedule.dayOfWeek].push(schedule);
        }

        // Display schedule for each day (current day first, then upcoming days)
        const currentDayOfWeek = new Date().getDay();
        const orderedDays = [];

        // Add current day first
        orderedDays.push(currentDayOfWeek);

        // Add remaining days in order
        for (let dayOffset = 1; dayOffset < 7; dayOffset++) {
          const checkDay = (currentDayOfWeek + dayOffset) % 7;
          orderedDays.push(checkDay);
        }

        for (const day of orderedDays) {
          const dayName = getDayName(day);
          const daySchedules = schedulesByDay[day] || [];

          if (daySchedules.length > 0) {
            // Highlight current day
            const isCurrentDay = day === currentDayOfWeek;
            const dayHeader = isCurrentDay
              ? `📅 <b>${dayName} (Today)</b>`
              : `<b>${dayName}</b>`;
            message += `${dayHeader}\n`;

            for (const schedule of daySchedules) {
              const times = getStreamTimes(schedule.dayOfWeek, schedule.streamNumber);
              message += `• Stream ${schedule.streamNumber}: ${schedule.eventTitle}\n`;
              message += `  🌍 UTC: ${times.utc} | 🇮🇳 IST: ${times.ist} | 🇺🇸 PST: ${times.pst}\n`;
            }
            message += `\n`;
          }
        }

        message += `<b>General Stream Times:</b>\n`;
        message += `• Stream 1 (Early): 9:00 AM UTC\n`;
        message += `• Stream 2 (Late): 1:00 PM UTC (Tue/Thu/Fri) or 7:00 PM UTC (Mon/Wed/Sat/Sun)\n\n`;
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
        const times = getStreamTimes(dayOfWeek, streamNumber);
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

bot.command("broadcast", async (ctx) => {
  const user = await getUserOrCreate(ctx.from.id, ctx.from.username);

  if (!isAdmin(user)) {
    await ctx.reply(`⛔️ Mods only.`);
    return;
  }

  const messageText = ctx.message.text.trim();
  const commandMatch = messageText.match(/^\/broadcast\s+(.+)$/s);

  if (!commandMatch || !commandMatch[1]) {
    await ctx.reply(
      `❌ <b>Usage:</b> <code>/broadcast &lt;HTML message&gt;</code>\n\n` +
        `📝 <b>Example:</b>\n` +
        `<code>/broadcast &lt;b&gt;Hello&lt;/b&gt; everyone! This is a test message.`,
      { parse_mode: "HTML" }
    );
    return;
  }

  const broadcastMessage = commandMatch[1];

  await ctx.reply("📢 Broadcasting message to all groups...");

  try {
    const result = await broadcastHtmlToAllGroups(
      broadcastMessage,
      "Broadcast"
    );

    if (result.success > 0) {
      await ctx.reply(
        `✅ Broadcast sent successfully!\n\n` +
          `📊 <b>Results:</b>\n` +
          `✅ Success: ${result.success} groups\n` +
          `❌ Failed: ${result.failed} groups\n\n` +
          `📢 Message shared with all groups!`,
        { parse_mode: "HTML" }
      );
    } else {
      await ctx.reply(
        `❌ Failed to send broadcast.\n\n` +
          `📊 <b>Results:</b>\n` +
          `✅ Success: ${result.success} groups\n` +
          `❌ Failed: ${result.failed} groups\n\n` +
          `⚠️ No groups were reached.\n\n` +
          `<b>Try this:</b>\n` +
          `1. Use /findgroups to discover group IDs\n` +
          `2. Set ADMIN_GROUP_IDS in Railway environment variables\n` +
          `3. Make sure bot is added to group chats`,
        { parse_mode: "HTML" }
      );
    }
  } catch (error) {
    console.error("❌ Error in broadcast command:", error);
    await ctx.reply("❌ Error sending broadcast. Please try again.");
  }
});

// Database health check command (for debugging)
bot.command("dbhealth", async (ctx) => {
  try {
    const health = await checkDatabaseHealth();
    if (health.healthy) {
      await ctx.reply("✅ Database is healthy and connected");
    } else {
      await ctx.reply(`❌ Database health check failed: ${health.error}`);
    }
  } catch (error) {
    await ctx.reply(`❌ Error checking database health: ${error.message}`);
  }
});

// Sweet Calls game command
bot.command("call", async (ctx) => {
  try {
    const user = await getUserOrCreate(ctx.from.id, ctx.from.username);
    const args = ctx.message.text.split(" ").slice(1);

    if (args.length === 0) {
      await ctx.reply(
        `📞 <b>Sweet Calls Game</b>\n\n` +
          `🎮 <b>How to play:</b>\n` +
          `• Use <code>/call &lt;slot name&gt;</code> to call a slot\n` +
          `• Each user can only call once per round\n` +
          `• Each slot can only be called once per round\n` +
          `• Slot names must be unique and under 50 characters\n\n` +
          `📋 <b>Example:</b>\n` +
          `<code>/call Red</code>\n` +
          `<code>/call Blue</code>\n` +
          `<code>/call Lucky 7</code>\n\n` +
          `🎯 <b>Current Round:</b>\n` +
          (await getCurrentCallsDisplay()),
        { parse_mode: "HTML" }
      );
      return;
    }

    // Handle raffle subcommand for MOD/Owner
    if (args[0].toLowerCase() === "raffle") {
      if (!isAdmin(user)) {
        await ctx.reply(`⛔️ Mods only.`);
        return;
      }

      const raffleResult = await runSweetCallsRaffle();

      if (raffleResult.success) {
        await ctx.reply(raffleResult.message, { parse_mode: "HTML" });
      } else {
        await ctx.reply(
          `❌ <b>Raffle Failed</b>\n\n` +
            `📝 <b>Reason:</b> ${raffleResult.message}\n\n` +
            `💡 <b>Make sure:</b>\n` +
            `• There is an active round\n` +
            `• At least one call has been made`,
          { parse_mode: "HTML" }
        );
      }
      return;
    }

    const slotName = args.join(" ");

    // Make the call
    const result = await makeSweetCall(user.id, slotName);

    if (result.success) {
      await ctx.reply(
        `✅ <b>Call Successful!</b>\n\n` +
          `📞 You called: <b>${slotName}</b>\n` +
          `👤 User: ${user.telegramUser || user.kickName || "Unknown"}\n\n` +
          `🎯 <b>Current Round:</b>\n` +
          (await getCurrentCallsDisplay()),
        { parse_mode: "HTML" }
      );
    } else {
      await ctx.reply(
        `❌ <b>Call Failed</b>\n\n` +
          `📝 <b>Reason:</b> ${result.message}\n\n` +
          `💡 <b>Try:</b>\n` +
          `• Use a different slot name\n` +
          `• Check if you already called in this round\n` +
          `• Make sure slot name is under 50 characters`,
        { parse_mode: "HTML" }
      );
    }
  } catch (error) {
    console.error("❌ Error in call command:", error);
    await ctx.reply("❌ Error processing your call. Please try again.");
  }
});

// Sweet Calls multiplier command for MOD/Owner
bot.command("sc", async (ctx) => {
  try {
    const user = await getUserOrCreate(ctx.from.id, ctx.from.username);

    if (!isAdmin(user)) {
      await ctx.reply(`⛔️ Mods only.`);
      return;
    }

    const args = ctx.message.text.split(" ").slice(1);

    if (args.length === 0) {
      await ctx.reply(
        `🎯 <b>Sweet Calls Multiplier Management</b>\n\n` +
          `📋 <b>Commands:</b>\n` +
          `<code>/sc &lt;slot name&gt; &lt;multiplier&gt;</code> - Set multiplier for a slot\n` +
          `<code>/sc change &lt;slot name&gt; &lt;new multiplier&gt;</code> - Update multiplier for a slot\n\n` +
          `📋 <b>Examples:</b>\n` +
          `<code>/sc Red 2.5</code>\n` +
          `<code>/sc change Blue 3.0</code>\n\n` +
          `🎯 <b>Current Round:</b>\n` +
          (await getCurrentCallsDisplay()),
        { parse_mode: "HTML" }
      );
      return;
    }

    // Handle change subcommand
    if (args[0].toLowerCase() === "change") {
      if (args.length < 3) {
        await ctx.reply(
          `❌ <b>Invalid Command</b>\n\n` +
            `📝 <b>Usage:</b> <code>/sc change &lt;slot name&gt; &lt;new multiplier&gt;</code>\n\n` +
            `📋 <b>Example:</b> <code>/sc change Red 2.5</code>`,
          { parse_mode: "HTML" }
        );
        return;
      }

      const slotName = args[1];
      const multiplier = parseFloat(args[2]);

      if (isNaN(multiplier)) {
        await ctx.reply(
          `❌ <b>Invalid Multiplier</b>\n\n` +
            `📝 <b>Multiplier must be a number between 0 and 1000</b>\n\n` +
            `📋 <b>Example:</b> <code>/sc change Red 2.5</code>`,
          { parse_mode: "HTML" }
        );
        return;
      }

      const result = await setSlotMultiplier(slotName, multiplier);

      if (result.success) {
        await ctx.reply(result.message, { parse_mode: "HTML" });
      } else {
        await ctx.reply(
          `❌ <b>Failed to Update Multiplier</b>\n\n` +
            `📝 <b>Reason:</b> ${result.message}\n\n` +
            `💡 <b>Make sure:</b>\n` +
            `• The slot name exists in the current round\n` +
            `• The multiplier is between 0 and 1000`,
          { parse_mode: "HTML" }
        );
      }
      return;
    }

    // Handle regular set command
    if (args.length < 2) {
      await ctx.reply(
        `❌ <b>Invalid Command</b>\n\n` +
          `📝 <b>Usage:</b> <code>/sc &lt;slot name&gt; &lt;multiplier&gt;</code>\n\n` +
          `📋 <b>Example:</b> <code>/sc Red 2.5</code>`,
        { parse_mode: "HTML" }
      );
      return;
    }

    const slotName = args[0];
    const multiplier = parseFloat(args[1]);

    if (isNaN(multiplier)) {
      await ctx.reply(
        `❌ <b>Invalid Multiplier</b>\n\n` +
          `📝 <b>Multiplier must be a number between 0 and 1000</b>\n\n` +
          `📋 <b>Example:</b> <code>/sc Red 2.5</code>`,
        { parse_mode: "HTML" }
      );
      return;
    }

    const result = await setSlotMultiplier(slotName, multiplier);

    if (result.success) {
      await ctx.reply(result.message, { parse_mode: "HTML" });
    } else {
      await ctx.reply(
        `❌ <b>Failed to Set Multiplier</b>\n\n` +
          `📝 <b>Reason:</b> ${result.message}\n\n` +
          `💡 <b>Make sure:</b>\n` +
          `• The slot name exists in the current round\n` +
          `• The multiplier is between 0 and 1000`,
        { parse_mode: "HTML" }
      );
    }
  } catch (error) {
    console.error("❌ Error in sc command:", error);
    await ctx.reply(
      "❌ Error processing multiplier command. Please try again."
    );
  }
});

// Sweet Calls leaderboard command
bot.command("callboard", async (ctx) => {
  try {
    const result = await getCallboardData();

    if (result.success) {
      await ctx.reply(result.message, { parse_mode: "HTML" });
    } else {
      await ctx.reply(
        `❌ <b>Failed to Load Leaderboard</b>\n\n` +
          `📝 <b>Reason:</b> ${result.message}\n\n` +
          `💡 <b>Try again later or contact an admin</b>`,
        { parse_mode: "HTML" }
      );
    }
  } catch (error) {
    console.error("❌ Error in callboard command:", error);
    await ctx.reply("❌ Error loading leaderboard. Please try again.");
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

// Send stream reminders to all groups
async function sendStreamReminders(streamNumber) {
  if (!prisma) {
    console.log("⚠️ Database not available, skipping stream reminders");
    return;
  }

  try {
    console.log(`🚀 Checking for Stream ${streamNumber} reminders...`);

    // Get current day and time
    const now = new Date();
    const currentDayOfWeek = now.getDay();

    // Find active schedule for this stream on current day
    const schedule = await prisma.schedule.findUnique({
      where: {
        dayOfWeek_streamNumber: {
          dayOfWeek: currentDayOfWeek,
          streamNumber: streamNumber,
        },
      },
    });

    if (!schedule || !schedule.isActive) {
      console.log(
        `📅 No active schedule found for Stream ${streamNumber} on ${getDayName(
          currentDayOfWeek
        )}`
      );
      return;
    }

    // Check if we've already sent this reminder today
    const eventDate = new Date();
    eventDate.setHours(streamNumber === 1 ? 7 : 17, 0, 0, 0);

    const alreadySent = await hasNotificationBeenSent(
      prisma,
      currentDayOfWeek,
      streamNumber,
      "2hour_reminder",
      eventDate
    );

    if (alreadySent) {
      console.log(`📤 Reminder already sent for Stream ${streamNumber} today`);
      return;
    }

    // Create reminder message
    const reminderMessage = createStreamReminderMessage({
      dayOfWeek: currentDayOfWeek,
      streamNumber: streamNumber,
      eventTitle: schedule.eventTitle,
      eventDate: eventDate,
      timeUntilStream: "2h 0m",
    });

    // Get all active groups
    const result = await getAllGroups();
    const allGroups = result.groupIds;

    if (allGroups.length === 0) {
      console.log("⚠️ No groups found for stream reminder");
      return;
    }

    // Send to all groups
    let successCount = 0;
    let failedCount = 0;

    console.log(
      `📢 Sending Stream ${streamNumber} reminder to ${allGroups.length} groups...`
    );

    for (const groupId of allGroups) {
      try {
        await bot.telegram.sendMessage(groupId, reminderMessage, {
          parse_mode: "HTML",
          disable_web_page_preview: true,
        });
        successCount++;
        console.log(`✅ Reminder sent to group ${groupId}`);
      } catch (error) {
        failedCount++;
        console.error(
          `❌ Failed to send reminder to group ${groupId}:`,
          error.message
        );

        // If bot was removed from group, mark as inactive
        if (
          error.message.includes("bot was blocked") ||
          error.message.includes("chat not found") ||
          error.message.includes("bot is not a member")
        ) {
          await markGroupAsInactive(groupId);
        }
      }
    }

    // Record the notification as sent
    await recordNotificationSent(
      prisma,
      currentDayOfWeek,
      streamNumber,
      "2hour_reminder",
      eventDate,
      successCount,
      failedCount
    );

    console.log(
      `🚀 Stream ${streamNumber} reminder completed: ${successCount} success, ${failedCount} failed`
    );
  } catch (error) {
    console.error(`❌ Error sending Stream ${streamNumber} reminders:`, error);
  }
}

// Check if notification has been sent
async function hasNotificationBeenSent(
  prisma,
  dayOfWeek,
  streamNumber,
  notificationType,
  eventDate
) {
  if (!prisma) {
    return false;
  }

  try {
    const existing = await prisma.streamNotification.findUnique({
      where: {
        dayOfWeek_streamNumber_notificationType_eventDate: {
          dayOfWeek: dayOfWeek,
          streamNumber: streamNumber,
          notificationType: notificationType,
          eventDate: eventDate,
        },
      },
    });

    return existing !== null;
  } catch (error) {
    console.error("Error checking notification status:", error);
    return false;
  }
}

// Record notification as sent
async function recordNotificationSent(
  prisma,
  dayOfWeek,
  streamNumber,
  notificationType,
  eventDate,
  successCount,
  failedCount
) {
  if (!prisma) {
    return;
  }

  try {
    await prisma.streamNotification.upsert({
      where: {
        dayOfWeek_streamNumber_notificationType_eventDate: {
          dayOfWeek: dayOfWeek,
          streamNumber: streamNumber,
          notificationType: notificationType,
          eventDate: eventDate,
        },
      },
      update: {
        sentAt: new Date(),
        successCount: successCount,
        failedCount: failedCount,
      },
      create: {
        dayOfWeek: dayOfWeek,
        streamNumber: streamNumber,
        notificationType: notificationType,
        eventDate: eventDate,
        successCount: successCount,
        failedCount: failedCount,
      },
    });
  } catch (error) {
    console.error("Error recording notification:", error);
  }
}

// Create stream reminder message
function createStreamReminderMessage(reminder) {
  const times = getStreamTimes(reminder.dayOfWeek, reminder.streamNumber);

  return (
    `🚀 <b>Stream Reminder!</b>\n\n` +
    `⏰ <b>Stream starting in ${reminder.timeUntilStream}!</b>\n\n` +
    `📅 <b>${getDayName(reminder.dayOfWeek)} - Stream ${
      reminder.streamNumber
    }</b>\n` +
    `🎮 <b>Event:</b> ${reminder.eventTitle}\n\n` +
    `🕐 <b>Stream Times:</b>\n` +
    `🌍 UTC: ${times.utc}\n` +
    `🇮🇳 IST: ${times.ist}\n` +
    `🇺🇸 PST: ${times.pst}\n\n` +
    `🎯 <b>Join us at:</b> https://kick.com/sweetflips\n\n` +
    `⚡ Get ready for an amazing stream!`
  );
}

// Cleanup old notifications
async function cleanupOldNotifications() {
  if (!prisma) {
    return;
  }

  try {
    // Delete notifications older than 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    await prisma.streamNotification.deleteMany({
      where: {
        sentAt: {
          lt: sevenDaysAgo,
        },
      },
    });

    console.log("🧹 Cleaned up old stream notifications");
  } catch (error) {
    console.error("Error cleaning up old notifications:", error);
  }
}

// Sweet Calls game functions
async function makeSweetCall(userId, slotName) {
  if (!prisma) {
    console.error("❌ Prisma client is null - database not available");
    return { success: false, message: "Database not available" };
  }

  // Ensure database is connected
  try {
    await prisma.$connect();
  } catch (error) {
    console.error("❌ Database connection failed:", error);
    return { success: false, message: "Database connection failed" };
  }

  try {
    // Import the updated service functions
    const { makeCall } = await import("./dist/modules/sweetCallsService.js");

    // Debug: Check if prisma is valid
    console.log("🔍 Prisma client type:", typeof prisma);
    console.log(
      "🔍 Prisma client has findFirst:",
      typeof prisma.callSession?.findFirst
    );

    // Use the new service function
    const result = await makeCall(prisma, userId, slotName);
    return result;
  } catch (error) {
    console.error("Error making Sweet Call:", error);
    return {
      success: false,
      message: "An error occurred while making your call",
    };
  }
}

// Database health check function
async function checkDatabaseHealth() {
  if (!prisma) {
    return { healthy: false, error: "Prisma client is null" };
  }

  try {
    // Test basic connection
    await prisma.$queryRaw`SELECT 1`;

    // Test if sweet_calls_rounds table exists and is accessible using Prisma ORM
    await prisma.sweetCallsRound.findFirst();

    return { healthy: true };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    return { healthy: false, error: errorMessage };
  }
}

async function getActiveSweetCallsSession() {
  if (!prisma) {
    return null;
  }

  try {
    // Import the updated service functions
    const { getActiveSession } = await import(
      "./dist/modules/sweetCallsService.js"
    );

    // Use the new service function
    const activeSession = await getActiveSession(prisma);
    return activeSession;
  } catch (error) {
    console.error("Error getting active Sweet Calls session:", error);
    return null;
  }
}

async function createNewSweetCallsSession() {
  if (!prisma) {
    console.error("❌ Prisma client is null - database not available");
    return null;
  }

  try {
    // Import the updated service functions
    const { createNewSession } = await import(
      "./dist/modules/sweetCallsService.js"
    );

    // Use the new service function
    const newSession = await createNewSession(prisma);
    return newSession;
  } catch (error) {
    console.error("❌ Error creating new Sweet Calls session:", error);
    return null;
  }
}

async function getCurrentCallsDisplay() {
  if (!prisma) {
    return "Database not available";
  }

  try {
    // Import the updated service functions
    const { getActiveSession, getSessionCalls, formatCallsDisplay } =
      await import("./dist/modules/sweetCallsService.js");

    // Get active session
    const activeSession = await getActiveSession(prisma);
    if (!activeSession) {
      return "No active session";
    }

    // Get calls for the session
    const calls = await getSessionCalls(prisma, activeSession.id);

    // Format the display
    return formatCallsDisplay(calls);
  } catch (error) {
    console.error("Error getting current calls display:", error);
    return "Error loading calls";
  }
}

async function runSweetCallsRaffle() {
  if (!prisma) {
    return { success: false, message: "Database not available" };
  }

  try {
    // Import the updated service functions
    const { raffleCall } = await import("./dist/modules/sweetCallsService.js");

    // Use the new service function
    const result = await raffleCall(prisma);
    return result;
  } catch (error) {
    console.error("Error in raffle call:", error);
    return { success: false, message: "An error occurred during the raffle" };
  }
}

async function setSlotMultiplier(slotName, multiplier) {
  if (!prisma) {
    return { success: false, message: "Database not available" };
  }

  try {
    // Import the updated service functions
    const { setSlotMultiplier: setMultiplier } = await import(
      "./dist/modules/sweetCallsService.js"
    );

    // Use the new service function
    const result = await setMultiplier(prisma, slotName, multiplier);
    return result;
  } catch (error) {
    console.error("Error setting slot multiplier:", error);
    return {
      success: false,
      message: "An error occurred while setting the multiplier",
    };
  }
}

async function getCallboardData() {
  if (!prisma) {
    return { success: false, message: "Database not available" };
  }

  try {
    // Import the updated service functions
    const { getCallboardData: getCallboard } = await import(
      "./dist/modules/sweetCallsService.js"
    );

    // Use the new service function
    const result = await getCallboard(prisma);
    return result;
  } catch (error) {
    console.error("Error getting callboard data:", error);
    return {
      success: false,
      message: "An error occurred while loading the leaderboard",
    };
  }
}

// Setup automated schedule messaging with cron jobs
function setupAutomatedScheduleMessaging() {
  console.log("⏰ Setting up automated schedule messaging...");

  const morningSchedule = cron.schedule(
    "0 9 * * *",
    async () => {
      console.log("🌅 Morning schedule broadcast triggered (9:00 AM UTC)");
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

  const afternoonSchedule = cron.schedule(
    "0 13 * * *",
    async () => {
      console.log("🌆 Afternoon schedule broadcast triggered (1:00 PM UTC)");
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

  const stream1Reminder = cron.schedule(
    "0 7 * * *",
    async () => {
      console.log("🚀 Stream 1 reminder triggered (7:00 AM UTC)");
      try {
        await sendStreamReminders(1);
      } catch (error) {
        console.error("❌ Error in Stream 1 reminder:", error);
      }
    },
    {
      scheduled: true,
      timezone: "UTC",
    }
  );

  const stream2ReminderEarly = cron.schedule(
    "0 11 * * 2,4,5",
    async () => {
      console.log("🚀 Stream 2 reminder triggered (11:00 AM UTC for Tue/Thu/Fri)");
      try {
        await sendStreamReminders(2);
      } catch (error) {
        console.error("❌ Error in Stream 2 reminder:", error);
      }
    },
    {
      scheduled: true,
      timezone: "UTC",
    }
  );

  const stream2ReminderLate = cron.schedule(
    "0 17 * * 0,1,3,6",
    async () => {
      console.log("🚀 Stream 2 reminder triggered (5:00 PM UTC for Mon/Wed/Sat/Sun)");
      try {
        await sendStreamReminders(2);
      } catch (error) {
        console.error("❌ Error in Stream 2 reminder:", error);
      }
    },
    {
      scheduled: true,
      timezone: "UTC",
    }
  );

  // Cleanup old notifications daily at midnight
  const cleanupSchedule = cron.schedule(
    "0 0 * * *",
    async () => {
      console.log("🧹 Daily cleanup triggered (12:00 AM UTC)");
      try {
        await cleanupOldNotifications();
      } catch (error) {
        console.error("❌ Error in daily cleanup:", error);
      }
    },
    {
      scheduled: true,
      timezone: "UTC",
    }
  );

  console.log("✅ Automated schedule messaging configured:");
  console.log("   🌅 Morning broadcast: 9:00 AM UTC");
  console.log("   🌆 Afternoon broadcast: 1:00 PM UTC");
  console.log("   🚀 Stream 1 reminder: 7:00 AM UTC (2h before)");
  console.log("   🚀 Stream 2 reminder: 11:00 AM UTC (Tue/Thu/Fri) or 5:00 PM UTC (Mon/Wed/Sat/Sun)");
  console.log("   🧹 Daily cleanup: 12:00 AM UTC");

  global.morningSchedule = morningSchedule;
  global.afternoonSchedule = afternoonSchedule;
  global.stream1Reminder = stream1Reminder;
  global.stream2ReminderEarly = stream2ReminderEarly;
  global.stream2ReminderLate = stream2ReminderLate;
  global.cleanupSchedule = cleanupSchedule;
}

// Start bot with auto-restart capabilities
async function syncGameStateWithDatabase() {
  if (!guessService || !prisma) {
    console.log("⚠️ Skipping game state sync - database not available");
    return;
  }

  try {
    console.log("🔄 Syncing game state with database...");

    const balanceRound = await guessService.getCurrentRound("GUESS_BALANCE");
    if (balanceRound) {
      gameState.balance.isOpen = balanceRound.phase === "OPEN";
      gameState.balance.isFinalized =
        balanceRound.phase === "REVEALED" || balanceRound.finalValue !== null;
      gameState.balance.finalBalance = balanceRound.finalValue;

      const balanceGuessCount = await prisma.guess.count({
        where: { gameRoundId: balanceRound.id },
      });
      console.log(
        `📊 Balance: Phase=${balanceRound.phase}, Guesses=${balanceGuessCount}`
      );
    }

    const bonusRound = await guessService.getCurrentRound("GUESS_BONUS");
    if (bonusRound) {
      gameState.bonus.isOpen = bonusRound.phase === "OPEN";
      gameState.bonus.isFinalized =
        bonusRound.phase === "REVEALED" || bonusRound.finalValue !== null;
      gameState.bonus.finalBonus = bonusRound.finalValue;

      const bonusItems = await prisma.bonusItem.findMany({
        where: { gameRoundId: bonusRound.id },
        orderBy: { createdAt: "asc" },
      });

      gameState.bonus.bonusAmount = bonusItems.length;
      gameState.bonus.bonusList = bonusItems.map((item) => item.name);

      const bonusGuessCount = await prisma.guess.count({
        where: { gameRoundId: bonusRound.id },
      });
      console.log(
        `🎁 Bonus: Phase=${bonusRound.phase}, Items=${bonusItems.length}, Guesses=${bonusGuessCount}`
      );
    }

    console.log("✅ Game state synced with database");
  } catch (error) {
    console.error("❌ Error syncing game state:", error);
  }
}

async function startBot() {
  console.log("🤖 Starting SweetflipsStreamBot...");
  console.log(
    "🔑 Bot token:",
    process.env.TELEGRAM_BOT_TOKEN ? "✅ Set" : "❌ Missing"
  );

  try {
    console.log("⏳ Waiting for database to be ready...");
    const dbReady = await waitForDatabase();

    if (!dbReady) {
      console.log(
        "⚠️ Database not ready, starting bot without database features"
      );
    } else {
      try {
        const { GuessService } = await import("./guessService.js");
        guessService = new GuessService(prisma);
        console.log("✅ GuessService initialized for database storage");

        await syncGameStateWithDatabase();
      } catch (error) {
        console.error("❌ GuessService initialization failed:", error.message);
        console.log("⚠️ Bot will run without GuessService features");
        guessService = null;
      }
    }

    await bot.launch();
    console.log("✅ Bot launched successfully");

    restartCount = 0;

    startHealthMonitoring();

    setupAutomatedScheduleMessaging();

    setupGracefulShutdown();
  } catch (error) {
    console.error("❌ Failed to start bot:", error);
    if (error.response && error.response.error_code === 404) {
      console.error("❌ Bot token is invalid or bot doesn't exist!");
      console.error(
        "Please check your TELEGRAM_BOT_TOKEN in Railway environment variables."
      );
    }

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
    if (global.stream1Reminder) {
      global.stream1Reminder.stop();
      console.log("✅ Stream 1 reminder stopped");
    }
    if (global.stream2ReminderEarly) {
      global.stream2ReminderEarly.stop();
      console.log("✅ Stream 2 reminder (early) stopped");
    }
    if (global.stream2ReminderLate) {
      global.stream2ReminderLate.stop();
      console.log("✅ Stream 2 reminder (late) stopped");
    }
    if (global.cleanupSchedule) {
      global.cleanupSchedule.stop();
      console.log("✅ Cleanup schedule stopped");
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

import type { PrismaClient } from "@prisma/client";

export interface CallEntry {
  id: string;
  userId: string;
  slotName: string;
  multiplier: number | null;
  createdAt: Date;
  user: {
    telegramUser: string | null;
    kickName: string | null;
  };
}

export interface CallSession {
  id: string;
  sessionName: string;
  status: string;
  createdAt: Date;
  closedAt: Date | null;
  revealedAt: Date | null;
  callEntries: CallEntry[];
}

// In-memory storage for active sessions
const activeSessions = new Map<string, CallSession>();

// Database health check function
export const checkDatabaseHealth = async (prisma: PrismaClient | null): Promise<{ healthy: boolean; error?: string }> => {
  if (!prisma) {
    return { healthy: false, error: "Prisma client is null" };
  }

  try {
    // Test basic connection
    await prisma.$queryRaw`SELECT 1`;
    
    // Test if call_sessions table exists and is accessible using Prisma ORM
    await prisma.callSession.findFirst();
    
    return { healthy: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return { healthy: false, error: errorMessage };
  }
};

export const createNewSession = async (prisma: PrismaClient | null): Promise<CallSession | null> => {
  if (!prisma) {
    console.error("❌ Prisma client is null - database not available");
    return null;
  }

  try {
    // Test database connection first
    await prisma.$queryRaw`SELECT 1`;
    
    // Close any existing open sessions using Prisma ORM
    await prisma.callSession.updateMany({
      where: { status: "OPEN" },
      data: { 
        status: "CLOSED",
        closedAt: new Date(),
        updatedAt: new Date()
      }
    });

    // Create new session using Prisma ORM
    const newSession = await prisma.callSession.create({
      data: {
        sessionName: `Session_${Date.now()}`,
        status: "OPEN"
      }
    });

    const session: CallSession = {
      id: newSession.id,
      sessionName: newSession.sessionName,
      status: newSession.status,
      createdAt: newSession.createdAt,
      closedAt: newSession.closedAt,
      revealedAt: newSession.revealedAt,
      callEntries: []
    };

    // Store in memory
    activeSessions.set(newSession.id, session);

    console.log(`✅ Created new Call Session: ${newSession.id}`);
    return session;
  } catch (error) {
    console.error("❌ Error creating new Call Session:", error);
    
    // Provide more specific error information
    if (error instanceof Error) {
      if (error.message.includes('connect')) {
        console.error("❌ Database connection failed");
      } else if (error.message.includes('relation') || error.message.includes('table')) {
        console.error("❌ Database schema issue - table may not exist");
      } else if (error.message.includes('permission')) {
        console.error("❌ Database permission issue");
      } else if (error.message.includes('column') && error.message.includes('does not exist')) {
        console.error("❌ Database schema mismatch - missing columns. Run Prisma migration.");
      } else {
        console.error(`❌ Database error: ${error.message}`);
      }
    }
    
    return null;
  }
};

export const getActiveSession = async (prisma: PrismaClient | null): Promise<CallSession | null> => {
  if (!prisma) {
    return null;
  }

  try {
    // First check in-memory cache
    for (const [_, session] of activeSessions) {
      if (session.status === "OPEN") {
        return session;
      }
    }

    // If not in memory, check database using Prisma ORM
    const dbSession = await prisma.callSession.findFirst({
      where: { status: "OPEN" },
      include: {
        callEntries: {
          include: {
            user: {
              select: {
                telegramUser: true,
                kickName: true
              }
            }
          },
          orderBy: { createdAt: "asc" }
        }
      },
      orderBy: { createdAt: "desc" }
    });

    if (dbSession) {
      const session: CallSession = {
        id: dbSession.id,
        sessionName: dbSession.sessionName,
        status: dbSession.status,
        createdAt: dbSession.createdAt,
        closedAt: dbSession.closedAt,
        revealedAt: dbSession.revealedAt,
        callEntries: dbSession.callEntries.map(entry => ({
          id: entry.id,
          userId: entry.userId,
          slotName: entry.slotName,
          multiplier: entry.multiplier,
          createdAt: entry.createdAt,
          user: {
            telegramUser: entry.user.telegramUser,
            kickName: entry.user.kickName
          }
        }))
      };

      // Store in memory
      activeSessions.set(dbSession.id, session);
      return session;
    }

    return null;
  } catch (error) {
    console.error("Error getting active Call Session:", error);
    return null;
  }
};

export const makeCall = async (
  prisma: PrismaClient | null,
  userId: string,
  slotName: string
): Promise<{ success: boolean; message: string; sessionId?: string }> => {
  if (!prisma) {
    return { success: false, message: "Database not available" };
  }

  try {
    // Get or create active session
    let activeSession = await getActiveSession(prisma);
    if (!activeSession) {
      const newSession = await createNewSession(prisma);
      if (!newSession) {
        return { 
          success: false, 
          message: "Failed to create new session. Please check database connection and try again." 
        };
      }
      activeSession = newSession;
    }

    // Validate slot name
    if (!slotName || slotName.trim().length === 0) {
      return { success: false, message: "Slot name cannot be empty" };
    }

    if (slotName.length > 50) {
      return { success: false, message: "Slot name must be 50 characters or less" };
    }

    const trimmedSlotName = slotName.trim();

    // Check if user already called in this session
    const existingUserCall = await prisma.callEntry.findFirst({
      where: {
        sessionId: activeSession.id,
        userId: userId
      }
    });

    if (existingUserCall) {
      return { success: false, message: "You have already called a slot in this session" };
    }

    // Check if slot name is already taken
    const existingSlotCall = await prisma.callEntry.findFirst({
      where: {
        sessionId: activeSession.id,
        slotName: trimmedSlotName
      }
    });

    if (existingSlotCall) {
      return { success: false, message: `Slot "${trimmedSlotName}" is already taken` };
    }

    // Create the call entry
    const newCall = await prisma.callEntry.create({
      data: {
        sessionId: activeSession.id,
        userId: userId,
        slotName: trimmedSlotName
      },
      include: {
        user: {
          select: {
            telegramUser: true,
            kickName: true
          }
        }
      }
    });

    // Update in-memory cache
    const updatedSession = activeSessions.get(activeSession.id);
    if (updatedSession) {
      updatedSession.callEntries.push({
        id: newCall.id,
        userId: newCall.userId,
        slotName: newCall.slotName,
        multiplier: newCall.multiplier,
        createdAt: newCall.createdAt,
        user: {
          telegramUser: newCall.user.telegramUser,
          kickName: newCall.user.kickName
        }
      });
    }

    return { 
      success: true, 
      message: `Successfully called slot "${trimmedSlotName}"!`,
      sessionId: activeSession.id
    };

  } catch (error) {
    console.error("Error making Call Entry:", error);
    return { success: false, message: "An error occurred while making your call" };
  }
};

export const getSessionCalls = async (
  prisma: PrismaClient | null,
  sessionId?: string
): Promise<CallEntry[]> => {
  if (!prisma) {
    return [];
  }

  try {
    let targetSessionId = sessionId;

    // If no sessionId provided, get active session
    if (!targetSessionId) {
      const activeSession = await getActiveSession(prisma);
      if (!activeSession) {
        return [];
      }
      targetSessionId = activeSession.id;
    }

    const calls = await prisma.callEntry.findMany({
      where: { 
        sessionId: targetSessionId,
        isArchived: false
      },
      include: {
        user: {
          select: {
            telegramUser: true,
            kickName: true
          }
        }
      },
      orderBy: { createdAt: "asc" }
    });

    return calls.map(call => ({
      id: call.id,
      userId: call.userId,
      slotName: call.slotName,
      multiplier: call.multiplier,
      createdAt: call.createdAt,
      user: {
        telegramUser: call.user.telegramUser,
        kickName: call.user.kickName
      }
    }));

  } catch (error) {
    console.error("Error getting session calls:", error);
    return [];
  }
};

export const closeSession = async (prisma: PrismaClient | null, sessionId?: string): Promise<boolean> => {
  if (!prisma) {
    return false;
  }

  try {
    let targetSessionId = sessionId;

    // If no sessionId provided, get active session
    if (!targetSessionId) {
      const activeSession = await getActiveSession(prisma);
      if (!activeSession) {
        return false;
      }
      targetSessionId = activeSession.id;
    }

    await prisma.callSession.update({
      where: { id: targetSessionId },
      data: {
        status: "CLOSED",
        closedAt: new Date(),
        updatedAt: new Date()
      }
    });

    // Update in-memory cache
    const cachedSession = activeSessions.get(targetSessionId);
    if (cachedSession) {
      cachedSession.status = "CLOSED";
      cachedSession.closedAt = new Date();
    }

    return true;
  } catch (error) {
    console.error("Error closing session:", error);
    return false;
  }
};

export const formatCallsDisplay = (calls: CallEntry[]): string => {
  if (calls.length === 0) {
    return "No calls yet!";
  }

  let message = `📞 <b>Sweet Calls - Current Session</b>\n\n`;
  
  calls.forEach((call, index) => {
    const displayName = call.user.kickName || call.user.telegramUser || "Unknown";
    const multiplierText = call.multiplier ? ` (${call.multiplier}x)` : "";
    message += `${index + 1}. <b>${call.slotName}</b> - ${displayName}${multiplierText}\n`;
  });

  message += `\n📊 Total calls: ${calls.length}`;
  
  return message;
};

export const clearInMemoryCache = (): void => {
  activeSessions.clear();
};

export const raffleCall = async (
  prisma: PrismaClient | null
): Promise<{ success: boolean; message: string; winner?: CallEntry }> => {
  if (!prisma) {
    return { success: false, message: "Database not available" };
  }

  try {
    // Get active session
    const activeSession = await getActiveSession(prisma);
    if (!activeSession) {
      return { success: false, message: "No active session found" };
    }

    // Get all calls for the current session
    const calls = await getSessionCalls(prisma, activeSession.id);
    if (calls.length === 0) {
      return { success: false, message: "No calls found in current session" };
    }

    // Randomly select a winner
    const randomIndex = Math.floor(Math.random() * calls.length);
    const winner = calls[randomIndex];

    return {
      success: true,
      message: `🎉 <b>Raffle Winner!</b>\n\n` +
        `🏆 <b>Winner:</b> ${winner.user.kickName || winner.user.telegramUser || "Unknown"}\n` +
        `📞 <b>Called Slot:</b> ${winner.slotName}\n` +
        `⏰ <b>Called At:</b> ${winner.createdAt.toLocaleString()}\n\n` +
        `🎯 <b>Total Participants:</b> ${calls.length}`,
      winner
    };

  } catch (error) {
    console.error("Error in raffle call:", error);
    return { success: false, message: "An error occurred during the raffle" };
  }
};

export const setSlotMultiplier = async (
  prisma: PrismaClient | null,
  slotName: string,
  multiplier: number
): Promise<{ success: boolean; message: string }> => {
  if (!prisma) {
    return { success: false, message: "Database not available" };
  }

  try {
    // Validate multiplier
    if (multiplier < 0 || multiplier > 1000) {
      return { success: false, message: "Multiplier must be between 0 and 1000" };
    }

    // Get active session
    const activeSession = await getActiveSession(prisma);
    if (!activeSession) {
      return { success: false, message: "No active session found" };
    }

    // Find the call with this slot name
    const call = await prisma.callEntry.findFirst({
      where: {
        sessionId: activeSession.id,
        slotName: slotName
      },
      include: {
        user: {
          select: {
            telegramUser: true,
            kickName: true
          }
        }
      }
    });

    if (!call) {
      return { success: false, message: `Slot "${slotName}" not found in current session` };
    }

    // Update the multiplier
    await prisma.callEntry.update({
      where: { id: call.id },
      data: { multiplier: multiplier }
    });

    const displayName = call.user.kickName || call.user.telegramUser || "Unknown";
    const action = call.multiplier === null ? "set" : "updated";

    return {
      success: true,
      message: `✅ <b>Multiplier ${action}!</b>\n\n` +
        `📞 <b>Slot:</b> ${slotName}\n` +
        `👤 <b>User:</b> ${displayName}\n` +
        `🎯 <b>Multiplier:</b> ${multiplier}x\n\n` +
        `🎮 <b>Action:</b> ${action}`
    };

  } catch (error) {
    console.error("Error setting slot multiplier:", error);
    return { success: false, message: "An error occurred while setting the multiplier" };
  }
};

export const getCallboardData = async (
  prisma: PrismaClient | null
): Promise<{ success: boolean; message: string; data?: CallEntry[] }> => {
  if (!prisma) {
    return { success: false, message: "Database not available" };
  }

  try {
    // Get all calls with multipliers from all sessions
    const calls = await prisma.callEntry.findMany({
      where: {
        multiplier: {
          not: null
        },
        isArchived: false
      },
      include: {
        user: {
          select: {
            telegramUser: true,
            kickName: true
          }
        },
        session: {
          select: {
            id: true,
            createdAt: true
          }
        }
      },
      orderBy: {
        multiplier: "desc"
      },
      take: 10 // Top 10 results
    });

    if (calls.length === 0) {
      return {
        success: true,
        message: `🏆 <b>Sweet Calls Leaderboard</b>\n\n` +
          `📊 <b>No calls with multipliers found</b>\n\n` +
          `💡 <b>Tip:</b> Use <code>/sc &lt;slot name&gt; &lt;multiplier&gt;</code> to set multipliers!`
      };
    }

    // Format the leaderboard
    let message = `🏆 <b>Sweet Calls Leaderboard</b>\n\n`;
    
    calls.forEach((call, index) => {
      const displayName = call.user.kickName || call.user.telegramUser || "Unknown";
      const rank = index + 1;
      const isTop5 = rank <= 5;
      const prizeText = isTop5 ? " 💰" : "";
      const rankEmoji = isTop5 ? "🥇🥈🥉🏅🏅".split("")[index] : "🔸";
      
      message += `${rankEmoji} <b>#${rank}</b> ${displayName}${prizeText}\n`;
      message += `   📞 <b>${call.slotName}</b> - <b>${call.multiplier}x</b>\n`;
      message += `   📅 ${call.session.createdAt.toLocaleDateString()}\n\n`;
    });

    // Add prize information
    message += `💰 <b>Top 5 Winners</b> - $10 Prize Each!\n`;
    message += `📊 <b>Total Entries:</b> ${calls.length}`;

    return {
      success: true,
      message: message,
      data: calls.map(call => ({
        id: call.id,
        userId: call.userId,
        slotName: call.slotName,
        multiplier: call.multiplier,
        createdAt: call.createdAt,
        user: {
          telegramUser: call.user.telegramUser,
          kickName: call.user.kickName
        }
      }))
    };

  } catch (error) {
    console.error("Error getting callboard data:", error);
    return { success: false, message: "An error occurred while loading the leaderboard" };
  }
};

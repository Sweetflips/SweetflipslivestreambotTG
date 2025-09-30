import type { PrismaClient } from "@prisma/client";

export interface SweetCallEntry {
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

export interface SweetCallsRound {
  id: string;
  phase: string;
  createdAt: Date;
  closedAt: Date | null;
  revealedAt: Date | null;
  calls: SweetCallEntry[];
}

// In-memory storage for active rounds
const activeRounds = new Map<string, SweetCallsRound>();

// Database health check function
export const checkDatabaseHealth = async (prisma: PrismaClient | null): Promise<{ healthy: boolean; error?: string }> => {
  if (!prisma) {
    return { healthy: false, error: "Prisma client is null" };
  }

  try {
    // Test basic connection
    await prisma.$queryRaw`SELECT 1`;
    
    // Test if sweet_calls_rounds table exists and is accessible
    await prisma.sweetCallsRound.findFirst();
    
    return { healthy: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return { healthy: false, error: errorMessage };
  }
};

export const createNewRound = async (prisma: PrismaClient | null): Promise<SweetCallsRound | null> => {
  if (!prisma) {
    console.error("❌ Prisma client is null - database not available");
    return null;
  }

  try {
    // Test database connection first
    await prisma.$queryRaw`SELECT 1`;
    
    // Close any existing open rounds
    await prisma.sweetCallsRound.updateMany({
      where: { phase: "OPEN" },
      data: { 
        phase: "CLOSED",
        closedAt: new Date(),
        updatedAt: new Date()
      }
    });

    // Create new round
    const newRound = await prisma.sweetCallsRound.create({
      data: {
        phase: "OPEN"
      }
    });

    const round: SweetCallsRound = {
      id: newRound.id,
      phase: newRound.phase,
      createdAt: newRound.createdAt,
      closedAt: newRound.closedAt,
      revealedAt: newRound.revealedAt,
      calls: []
    };

    // Store in memory
    activeRounds.set(newRound.id, round);

    console.log(`✅ Created new Sweet Calls round: ${newRound.id}`);
    return round;
  } catch (error) {
    console.error("❌ Error creating new Sweet Calls round:", error);
    
    // Provide more specific error information
    if (error instanceof Error) {
      if (error.message.includes('connect')) {
        console.error("❌ Database connection failed");
      } else if (error.message.includes('relation') || error.message.includes('table')) {
        console.error("❌ Database schema issue - table may not exist");
      } else if (error.message.includes('permission')) {
        console.error("❌ Database permission issue");
      } else {
        console.error(`❌ Database error: ${error.message}`);
      }
    }
    
    return null;
  }
};

export const getActiveRound = async (prisma: PrismaClient | null): Promise<SweetCallsRound | null> => {
  if (!prisma) {
    return null;
  }

  try {
    // First check in-memory cache
    for (const [_, round] of activeRounds) {
      if (round.phase === "OPEN") {
        return round;
      }
    }

    // If not in memory, check database
    const dbRound = await prisma.sweetCallsRound.findFirst({
      where: { phase: "OPEN" },
      include: {
        calls: {
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

    if (dbRound) {
      const round: SweetCallsRound = {
        id: dbRound.id,
        phase: dbRound.phase,
        createdAt: dbRound.createdAt,
        closedAt: dbRound.closedAt,
        revealedAt: dbRound.revealedAt,
        calls: dbRound.calls.map(call => ({
          id: call.id,
          userId: call.userId,
          slotName: call.slotName,
          createdAt: call.createdAt,
          user: {
            telegramUser: call.user.telegramUser,
            kickName: call.user.kickName
          }
        }))
      };

      // Store in memory
      activeRounds.set(dbRound.id, round);
      return round;
    }

    return null;
  } catch (error) {
    console.error("Error getting active Sweet Calls round:", error);
    return null;
  }
};

export const makeCall = async (
  prisma: PrismaClient | null,
  userId: string,
  slotName: string
): Promise<{ success: boolean; message: string; roundId?: string }> => {
  if (!prisma) {
    return { success: false, message: "Database not available" };
  }

  try {
    // Get or create active round
    let activeRound = await getActiveRound(prisma);
    if (!activeRound) {
      const newRound = await createNewRound(prisma);
      if (!newRound) {
        return { 
          success: false, 
          message: "Failed to create new round. Please check database connection and try again." 
        };
      }
      activeRound = newRound;
    }

    // Validate slot name
    if (!slotName || slotName.trim().length === 0) {
      return { success: false, message: "Slot name cannot be empty" };
    }

    if (slotName.length > 50) {
      return { success: false, message: "Slot name must be 50 characters or less" };
    }

    const trimmedSlotName = slotName.trim();

    // Check if user already called in this round
    const existingUserCall = await prisma.sweetCall.findUnique({
      where: {
        roundId_userId: {
          roundId: activeRound.id,
          userId: userId
        }
      }
    });

    if (existingUserCall) {
      return { success: false, message: "You have already called a slot in this round" };
    }

    // Check if slot name is already taken
    const existingSlotCall = await prisma.sweetCall.findUnique({
      where: {
        roundId_slotName: {
          roundId: activeRound.id,
          slotName: trimmedSlotName
        }
      }
    });

    if (existingSlotCall) {
      return { success: false, message: `Slot "${trimmedSlotName}" is already taken` };
    }

    // Create the call
    const newCall = await prisma.sweetCall.create({
      data: {
        roundId: activeRound.id,
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
    const updatedRound = activeRounds.get(activeRound.id);
    if (updatedRound) {
      updatedRound.calls.push({
        id: newCall.id,
        userId: newCall.userId,
        slotName: newCall.slotName,
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
      roundId: activeRound.id
    };

  } catch (error) {
    console.error("Error making Sweet Call:", error);
    return { success: false, message: "An error occurred while making your call" };
  }
};

export const getRoundCalls = async (
  prisma: PrismaClient | null,
  roundId?: string
): Promise<SweetCallEntry[]> => {
  if (!prisma) {
    return [];
  }

  try {
    let targetRoundId = roundId;

    // If no roundId provided, get active round
    if (!targetRoundId) {
      const activeRound = await getActiveRound(prisma);
      if (!activeRound) {
        return [];
      }
      targetRoundId = activeRound.id;
    }

    const calls = await prisma.sweetCall.findMany({
      where: { 
        roundId: targetRoundId,
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
    console.error("Error getting round calls:", error);
    return [];
  }
};

export const closeRound = async (prisma: PrismaClient | null, roundId?: string): Promise<boolean> => {
  if (!prisma) {
    return false;
  }

  try {
    let targetRoundId = roundId;

    // If no roundId provided, get active round
    if (!targetRoundId) {
      const activeRound = await getActiveRound(prisma);
      if (!activeRound) {
        return false;
      }
      targetRoundId = activeRound.id;
    }

    await prisma.sweetCallsRound.update({
      where: { id: targetRoundId },
      data: {
        phase: "CLOSED",
        closedAt: new Date(),
        updatedAt: new Date()
      }
    });

    // Update in-memory cache
    const cachedRound = activeRounds.get(targetRoundId);
    if (cachedRound) {
      cachedRound.phase = "CLOSED";
      cachedRound.closedAt = new Date();
    }

    return true;
  } catch (error) {
    console.error("Error closing round:", error);
    return false;
  }
};

export const formatCallsDisplay = (calls: SweetCallEntry[]): string => {
  if (calls.length === 0) {
    return "No calls yet!";
  }

  let message = `📞 <b>Sweet Calls - Current Round</b>\n\n`;
  
  calls.forEach((call, index) => {
    const displayName = call.user.kickName || call.user.telegramUser || "Unknown";
    const multiplierText = call.multiplier ? ` (${call.multiplier}x)` : "";
    message += `${index + 1}. <b>${call.slotName}</b> - ${displayName}${multiplierText}\n`;
  });

  message += `\n📊 Total calls: ${calls.length}`;
  
  return message;
};

export const clearInMemoryCache = (): void => {
  activeRounds.clear();
};

export const raffleCall = async (
  prisma: PrismaClient | null
): Promise<{ success: boolean; message: string; winner?: SweetCallEntry }> => {
  if (!prisma) {
    return { success: false, message: "Database not available" };
  }

  try {
    // Get active round
    const activeRound = await getActiveRound(prisma);
    if (!activeRound) {
      return { success: false, message: "No active round found" };
    }

    // Get all calls for the current round
    const calls = await getRoundCalls(prisma, activeRound.id);
    if (calls.length === 0) {
      return { success: false, message: "No calls found in current round" };
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

    // Get active round
    const activeRound = await getActiveRound(prisma);
    if (!activeRound) {
      return { success: false, message: "No active round found" };
    }

    // Find the call with this slot name
    const call = await prisma.sweetCall.findUnique({
      where: {
        roundId_slotName: {
          roundId: activeRound.id,
          slotName: slotName
        }
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
      return { success: false, message: `Slot "${slotName}" not found in current round` };
    }

    // Update the multiplier
    await prisma.sweetCall.update({
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
): Promise<{ success: boolean; message: string; data?: SweetCallEntry[] }> => {
  if (!prisma) {
    return { success: false, message: "Database not available" };
  }

  try {
    // Get all calls with multipliers from all rounds
    const calls = await prisma.sweetCall.findMany({
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
        round: {
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
      message += `   📅 ${call.round.createdAt.toLocaleDateString()}\n\n`;
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

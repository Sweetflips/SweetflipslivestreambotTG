import { PrismaClient } from '@prisma/client';

export interface CallSessionData {
  id: string;
  sessionName: string;
  status: string;
  createdAt: Date;
  closedAt: Date | null;
  revealedAt: Date | null;
  callEntries: CallEntryData[];
}

export interface CallEntryData {
  id: string;
  sessionId: string;
  userId: string;
  slotName: string;
  multiplier: number | null;
  createdAt: Date;
  isArchived: boolean;
  user: {
    telegramUser: string | null;
    kickName: string | null;
  };
}

// In-memory storage for active sessions
const activeSessions = new Map<string, CallSessionData>();

export const createNewCallSession = async (prisma: PrismaClient | null): Promise<CallSessionData | null> => {
  if (!prisma) {
    return null;
  }

  try {
    // Close any existing open sessions
    await prisma.callSession.updateMany({
      where: { status: 'OPEN' },
      data: { 
        status: 'CLOSED',
        closedAt: new Date()
      }
    });

    // Create new session
    const newSession = await prisma.callSession.create({
      data: {
        sessionName: `Session_${Date.now()}`,
        status: 'OPEN'
      }
    });

    const sessionData: CallSessionData = {
      id: newSession.id,
      sessionName: newSession.sessionName,
      status: newSession.status,
      createdAt: newSession.createdAt,
      closedAt: newSession.closedAt,
      revealedAt: newSession.revealedAt,
      callEntries: []
    };

    // Store in memory
    activeSessions.set(newSession.id, sessionData);
    
    return sessionData;
  } catch (error) {
    console.error('Error creating new call session:', error);
    return null;
  }
};

export const getActiveCallSession = async (prisma: PrismaClient | null): Promise<CallSessionData | null> => {
  if (!prisma) {
    return null;
  }

  try {
    // First check in-memory cache
    for (const [_, session] of activeSessions) {
      if (session.status === 'OPEN') {
        return session;
      }
    }

    // If not in memory, check database using Prisma ORM
    const dbSession = await prisma.callSession.findFirst({
      where: { status: 'OPEN' },
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
          orderBy: { createdAt: 'asc' }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    if (dbSession) {
      const session: CallSessionData = {
        id: dbSession.id,
        sessionName: dbSession.sessionName,
        status: dbSession.status,
        createdAt: dbSession.createdAt,
        closedAt: dbSession.closedAt,
        revealedAt: dbSession.revealedAt,
        callEntries: dbSession.callEntries.map(entry => ({
          id: entry.id,
          sessionId: entry.sessionId,
          userId: entry.userId,
          slotName: entry.slotName,
          multiplier: entry.multiplier,
          createdAt: entry.createdAt,
          isArchived: entry.isArchived,
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
    console.error('Error getting active call session:', error);
    return null;
  }
};

export const makeCallEntry = async (
  prisma: PrismaClient | null,
  userId: string,
  slotName: string
): Promise<{ success: boolean; message: string; sessionId?: string }> => {
  if (!prisma) {
    return { success: false, message: 'Database not available' };
  }

  try {
    // Get active session
    const activeSession = await getActiveCallSession(prisma);
    if (!activeSession) {
      return { success: false, message: 'No active call session found' };
    }

    // Check if user already has an entry in this session
    const existingEntry = await prisma.callEntry.findFirst({
      where: {
        sessionId: activeSession.id,
        userId: userId
      }
    });

    if (existingEntry) {
      return { success: false, message: 'You have already made a call in this session' };
    }

    // Check if slot is already taken
    const slotTaken = await prisma.callEntry.findFirst({
      where: {
        sessionId: activeSession.id,
        slotName: slotName
      }
    });

    if (slotTaken) {
      return { success: false, message: `Slot "${slotName}" is already taken` };
    }

    // Create new call entry
    const newEntry = await prisma.callEntry.create({
      data: {
        sessionId: activeSession.id,
        userId: userId,
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

    // Update in-memory cache
    const sessionData = activeSessions.get(activeSession.id);
    if (sessionData) {
      sessionData.callEntries.push({
        id: newEntry.id,
        sessionId: newEntry.sessionId,
        userId: newEntry.userId,
        slotName: newEntry.slotName,
        multiplier: newEntry.multiplier,
        createdAt: newEntry.createdAt,
        isArchived: newEntry.isArchived,
        user: {
          telegramUser: newEntry.user.telegramUser,
          kickName: newEntry.user.kickName
        }
      });
    }

    return { 
      success: true, 
      message: `Call entry created successfully for slot "${slotName}"`,
      sessionId: activeSession.id
    };
  } catch (error) {
    console.error('Error making call entry:', error);
    return { success: false, message: 'An error occurred while making your call' };
  }
};

export const getSessionCallEntries = async (
  prisma: PrismaClient | null,
  sessionId?: string
): Promise<CallEntryData[]> => {
  if (!prisma) {
    return [];
  }

  try {
    let targetSessionId = sessionId;

    // If no sessionId provided, get active session
    if (!targetSessionId) {
      const activeSession = await getActiveCallSession(prisma);
      if (!activeSession) {
        return [];
      }
      targetSessionId = activeSession.id;
    }

    const entries = await prisma.callEntry.findMany({
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
      orderBy: { createdAt: 'asc' }
    });

    return entries.map(entry => ({
      id: entry.id,
      sessionId: entry.sessionId,
      userId: entry.userId,
      slotName: entry.slotName,
      multiplier: entry.multiplier,
      createdAt: entry.createdAt,
      isArchived: entry.isArchived,
      user: {
        telegramUser: entry.user.telegramUser,
        kickName: entry.user.kickName
      }
    }));

  } catch (error) {
    console.error('Error getting session call entries:', error);
    return [];
  }
};

export const closeCallSession = async (prisma: PrismaClient | null, sessionId?: string): Promise<boolean> => {
  if (!prisma) {
    return false;
  }

  try {
    let targetSessionId = sessionId;

    // If no sessionId provided, get active session
    if (!targetSessionId) {
      const activeSession = await getActiveCallSession(prisma);
      if (!activeSession) {
        return false;
      }
      targetSessionId = activeSession.id;
    }

    // Update session status
    await prisma.callSession.update({
      where: { id: targetSessionId },
      data: { 
        status: 'CLOSED',
        closedAt: new Date()
      }
    });

    // Remove from memory cache
    activeSessions.delete(targetSessionId);

    return true;
  } catch (error) {
    console.error('Error closing call session:', error);
    return false;
  }
};

export const revealCallSession = async (prisma: PrismaClient | null, sessionId?: string): Promise<boolean> => {
  if (!prisma) {
    return false;
  }

  try {
    let targetSessionId = sessionId;

    // If no sessionId provided, get active session
    if (!targetSessionId) {
      const activeSession = await getActiveCallSession(prisma);
      if (!activeSession) {
        return false;
      }
      targetSessionId = activeSession.id;
    }

    // Update session status
    await prisma.callSession.update({
      where: { id: targetSessionId },
      data: { 
        status: 'REVEALED',
        revealedAt: new Date()
      }
    });

    // Remove from memory cache
    activeSessions.delete(targetSessionId);

    return true;
  } catch (error) {
    console.error('Error revealing call session:', error);
    return false;
  }
};

export const setSlotMultiplier = async (
  prisma: PrismaClient | null,
  sessionId: string,
  slotName: string,
  multiplier: number
): Promise<boolean> => {
  if (!prisma) {
    return false;
  }

  try {
    await prisma.callEntry.updateMany({
      where: {
        sessionId: sessionId,
        slotName: slotName
      },
      data: {
        multiplier: multiplier
      }
    });

    // Update in-memory cache
    const sessionData = activeSessions.get(sessionId);
    if (sessionData) {
      const entry = sessionData.callEntries.find(e => e.slotName === slotName);
      if (entry) {
        entry.multiplier = multiplier;
      }
    }

    return true;
  } catch (error) {
    console.error('Error setting slot multiplier:', error);
    return false;
  }
};

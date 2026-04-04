import { PrismaClient } from '@prisma/client';
export class CallSessionService {
    prisma;
    activeSessions;
    constructor(prisma) {
        this.prisma = prisma;
        this.activeSessions = new Map();
    }
    async initialize() {
        try {
            // Load any existing open sessions from database
            const openSessions = await this.prisma.callSession.findMany({
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
                }
            });
            // Load sessions into memory cache
            for (const session of openSessions) {
                const sessionData = {
                    id: session.id,
                    sessionName: session.sessionName,
                    status: session.status,
                    createdAt: session.createdAt,
                    closedAt: session.closedAt,
                    revealedAt: session.revealedAt,
                    callEntries: session.callEntries.map(entry => ({
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
                this.activeSessions.set(session.id, sessionData);
            }
            console.log(`✅ CallSessionService initialized with ${openSessions.length} open sessions`);
        }
        catch (error) {
            console.error('❌ Failed to initialize CallSessionService:', error);
            throw error;
        }
    }
    async createNewCallSession() {
        try {
            // Close any existing open sessions
            await this.prisma.callSession.updateMany({
                where: { status: 'OPEN' },
                data: {
                    status: 'CLOSED',
                    closedAt: new Date()
                }
            });
            // Create new session
            const newSession = await this.prisma.callSession.create({
                data: {
                    sessionName: `Session_${Date.now()}`,
                    status: 'OPEN'
                }
            });
            const sessionData = {
                id: newSession.id,
                sessionName: newSession.sessionName,
                status: newSession.status,
                createdAt: newSession.createdAt,
                closedAt: newSession.closedAt,
                revealedAt: newSession.revealedAt,
                callEntries: []
            };
            // Store in memory
            this.activeSessions.set(newSession.id, sessionData);
            return sessionData;
        }
        catch (error) {
            console.error('Error creating new call session:', error);
            return null;
        }
    }
    async getActiveCallSession() {
        try {
            // First check in-memory cache
            for (const [_, session] of this.activeSessions) {
                if (session.status === 'OPEN') {
                    return session;
                }
            }
            // If not in memory, check database using Prisma ORM
            const dbSession = await this.prisma.callSession.findFirst({
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
                const session = {
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
                this.activeSessions.set(dbSession.id, session);
                return session;
            }
            return null;
        }
        catch (error) {
            console.error('Error getting active call session:', error);
            return null;
        }
    }
    async makeCallEntry(userId, slotName) {
        try {
            // Get active session
            const activeSession = await this.getActiveCallSession();
            if (!activeSession) {
                return { success: false, message: 'No active call session found' };
            }
            // Check if user already has an entry in this session
            const existingEntry = await this.prisma.callEntry.findFirst({
                where: {
                    sessionId: activeSession.id,
                    userId: userId
                }
            });
            if (existingEntry) {
                return { success: false, message: 'You have already made a call in this session' };
            }
            // Check if slot is already taken
            const slotTaken = await this.prisma.callEntry.findFirst({
                where: {
                    sessionId: activeSession.id,
                    slotName: slotName
                }
            });
            if (slotTaken) {
                return { success: false, message: `Slot "${slotName}" is already taken` };
            }
            // Create new call entry
            const newEntry = await this.prisma.callEntry.create({
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
            const sessionData = this.activeSessions.get(activeSession.id);
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
        }
        catch (error) {
            console.error('Error making call entry:', error);
            return { success: false, message: 'An error occurred while making your call' };
        }
    }
    async getSessionCallEntries(sessionId) {
        try {
            let targetSessionId = sessionId;
            // If no sessionId provided, get active session
            if (!targetSessionId) {
                const activeSession = await this.getActiveCallSession();
                if (!activeSession) {
                    return [];
                }
                targetSessionId = activeSession.id;
            }
            const entries = await this.prisma.callEntry.findMany({
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
        }
        catch (error) {
            console.error('Error getting session call entries:', error);
            return [];
        }
    }
    async closeCallSession(sessionId) {
        try {
            let targetSessionId = sessionId;
            // If no sessionId provided, get active session
            if (!targetSessionId) {
                const activeSession = await this.getActiveCallSession();
                if (!activeSession) {
                    return false;
                }
                targetSessionId = activeSession.id;
            }
            // Update session status
            await this.prisma.callSession.update({
                where: { id: targetSessionId },
                data: {
                    status: 'CLOSED',
                    closedAt: new Date()
                }
            });
            // Remove from memory cache
            this.activeSessions.delete(targetSessionId);
            return true;
        }
        catch (error) {
            console.error('Error closing call session:', error);
            return false;
        }
    }
    async revealCallSession(sessionId) {
        try {
            let targetSessionId = sessionId;
            // If no sessionId provided, get active session
            if (!targetSessionId) {
                const activeSession = await this.getActiveCallSession();
                if (!activeSession) {
                    return false;
                }
                targetSessionId = activeSession.id;
            }
            // Update session status
            await this.prisma.callSession.update({
                where: { id: targetSessionId },
                data: {
                    status: 'REVEALED',
                    revealedAt: new Date()
                }
            });
            // Remove from memory cache
            this.activeSessions.delete(targetSessionId);
            return true;
        }
        catch (error) {
            console.error('Error revealing call session:', error);
            return false;
        }
    }
    async setSlotMultiplier(sessionId, slotName, multiplier) {
        try {
            await this.prisma.callEntry.updateMany({
                where: {
                    sessionId: sessionId,
                    slotName: slotName
                },
                data: {
                    multiplier: multiplier
                }
            });
            // Update in-memory cache
            const sessionData = this.activeSessions.get(sessionId);
            if (sessionData) {
                const entry = sessionData.callEntries.find(e => e.slotName === slotName);
                if (entry) {
                    entry.multiplier = multiplier;
                }
            }
            return true;
        }
        catch (error) {
            console.error('Error setting slot multiplier:', error);
            return false;
        }
    }
}
//# sourceMappingURL=callSessionService.js.map
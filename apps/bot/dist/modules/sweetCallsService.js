// In-memory storage for active rounds
const activeRounds = new Map();
export const createNewRound = async (prisma) => {
    if (!prisma) {
        return null;
    }
    try {
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
        const round = {
            id: newRound.id,
            phase: newRound.phase,
            createdAt: newRound.createdAt,
            closedAt: newRound.closedAt,
            revealedAt: newRound.revealedAt,
            calls: []
        };
        // Store in memory
        activeRounds.set(newRound.id, round);
        return round;
    }
    catch (error) {
        console.error("Error creating new Sweet Calls round:", error);
        return null;
    }
};
export const getActiveRound = async (prisma) => {
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
            const round = {
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
    }
    catch (error) {
        console.error("Error getting active Sweet Calls round:", error);
        return null;
    }
};
export const makeCall = async (prisma, userId, slotName) => {
    if (!prisma) {
        return { success: false, message: "Database not available" };
    }
    try {
        // Get or create active round
        let activeRound = await getActiveRound(prisma);
        if (!activeRound) {
            const newRound = await createNewRound(prisma);
            if (!newRound) {
                return { success: false, message: "Failed to create new round" };
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
    }
    catch (error) {
        console.error("Error making Sweet Call:", error);
        return { success: false, message: "An error occurred while making your call" };
    }
};
export const getRoundCalls = async (prisma, roundId) => {
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
            createdAt: call.createdAt,
            user: {
                telegramUser: call.user.telegramUser,
                kickName: call.user.kickName
            }
        }));
    }
    catch (error) {
        console.error("Error getting round calls:", error);
        return [];
    }
};
export const closeRound = async (prisma, roundId) => {
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
    }
    catch (error) {
        console.error("Error closing round:", error);
        return false;
    }
};
export const formatCallsDisplay = (calls) => {
    if (calls.length === 0) {
        return "No calls yet!";
    }
    let message = `📞 <b>Sweet Calls - Current Round</b>\n\n`;
    calls.forEach((call, index) => {
        const displayName = call.user.kickName || call.user.telegramUser || "Unknown";
        message += `${index + 1}. <b>${call.slotName}</b> - ${displayName}\n`;
    });
    message += `\n📊 Total calls: ${calls.length}`;
    return message;
};
export const clearInMemoryCache = () => {
    activeRounds.clear();
};

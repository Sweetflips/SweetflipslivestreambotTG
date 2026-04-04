export const saveGroup = async (prisma, groupId, info, source) => {
    if (!prisma) {
        return;
    }
    const now = new Date();
    const payload = {
        title: info.title ?? null,
        type: info.type ?? null,
        memberCount: info.memberCount ?? null,
        lastSeen: info.lastSeen ?? now,
    };
    await prisma.telegramGroup.upsert({
        where: { groupId },
        update: {
            ...payload,
            source,
            updatedAt: now,
        },
        create: {
            groupId,
            ...payload,
            isActive: true,
            source,
        },
    });
};
export const loadActiveGroups = async (prisma) => {
    if (!prisma) {
        return [];
    }
    return prisma.telegramGroup.findMany({
        where: { isActive: true },
        orderBy: { lastSeen: "desc" },
    });
};
export const markGroupInactive = async (prisma, groupId) => {
    if (!prisma) {
        return;
    }
    await prisma.telegramGroup.update({
        where: { groupId },
        data: {
            isActive: false,
            updatedAt: new Date(),
        },
    });
};
export const updateGroupDetails = async (prisma, groupId, info) => {
    if (!prisma) {
        return;
    }
    await prisma.telegramGroup.update({
        where: { groupId },
        data: {
            title: info.title ?? undefined,
            type: info.type ?? undefined,
            memberCount: info.memberCount ?? undefined,
            lastSeen: info.lastSeen ?? new Date(),
            updatedAt: new Date(),
        },
    });
};

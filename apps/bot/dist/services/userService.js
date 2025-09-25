const toStoredUser = (user) => ({
    id: user.id,
    telegramId: user.telegramId,
    telegramUser: user.telegramUser,
    role: user.role,
    kickName: user.kickName,
});
const createMockUser = (telegramId, username) => ({
    id: telegramId.toString(),
    telegramId: telegramId.toString(),
    telegramUser: username ?? null,
    role: "VIEWER",
    kickName: null,
});
const syncToSheets = async (sheets, user) => {
    if (!sheets) {
        return;
    }
    await sheets.appendUser([
        [
            user.telegramUser ?? "Unknown",
            user.kickName ?? "Not linked",
            new Date().toISOString(),
        ],
    ]);
};
export const createUserService = (prisma, sheets) => {
    const getUserOrCreate = async (telegramId, username) => {
        if (!prisma) {
            const mock = createMockUser(telegramId, username);
            await syncToSheets(sheets, mock);
            return mock;
        }
        const telegramIdString = telegramId.toString();
        let user = await prisma.user.findUnique({
            where: { telegramId: telegramIdString },
        });
        if (!user) {
            user = await prisma.user.create({
                data: {
                    telegramId: telegramIdString,
                    telegramUser: username ?? null,
                    role: "VIEWER",
                },
            });
        }
        else if (user.telegramUser !== username) {
            user = await prisma.user.update({
                where: { telegramId: telegramIdString },
                data: { telegramUser: username ?? null },
            });
        }
        const stored = toStoredUser(user);
        await syncToSheets(sheets, stored);
        return stored;
    };
    const isAdmin = (user) => user.role === "MOD" || user.role === "OWNER";
    const isOwner = (user) => user.role === "OWNER";
    const setKickName = async (telegramId, kickName) => {
        if (!prisma) {
            return null;
        }
        const telegramIdString = telegramId.toString();
        const updated = await prisma.user.update({
            where: { telegramId: telegramIdString },
            data: { kickName, linkedAt: new Date() },
        });
        const stored = toStoredUser(updated);
        await syncToSheets(sheets, stored);
        return stored;
    };
    const findByKickName = async (kickName) => {
        if (!prisma) {
            return null;
        }
        const user = await prisma.user.findFirst({ where: { kickName } });
        return user ? toStoredUser(user) : null;
    };
    const setRole = async (telegramId, role) => {
        if (!prisma) {
            return null;
        }
        const updated = await prisma.user.update({
            where: { telegramId },
            data: { role },
        });
        return toStoredUser(updated);
    };
    const listUsers = async () => {
        if (!prisma) {
            return [];
        }
        const users = await prisma.user.findMany({
            orderBy: { createdAt: "desc" },
        });
        return users.map(toStoredUser);
    };
    return {
        getUserOrCreate,
        isAdmin,
        isOwner,
        setKickName,
        findByKickName,
        setRole,
        listUsers,
    };
};

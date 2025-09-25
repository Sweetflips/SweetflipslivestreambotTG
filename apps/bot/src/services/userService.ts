import type { PrismaClient, User } from "@prisma/client";
import type { GoogleSheetsService } from "./googleSheets";

export interface StoredUser {
  id: string;
  telegramId: string;
  telegramUser: string | null;
  role: "VIEWER" | "MOD" | "OWNER";
  kickName: string | null;
}

export interface UserService {
  getUserOrCreate: (telegramId: number, username: string | undefined) => Promise<StoredUser>;
  isAdmin: (user: StoredUser) => boolean;
  isOwner: (user: StoredUser) => boolean;
  setKickName: (telegramId: number, kickName: string) => Promise<StoredUser | null>;
  findByKickName: (kickName: string) => Promise<StoredUser | null>;
  setRole: (telegramId: string, role: "MOD" | "OWNER") => Promise<StoredUser | null>;
  listUsers: () => Promise<StoredUser[]>;
}

const toStoredUser = (user: User): StoredUser => ({
  id: user.id,
  telegramId: user.telegramId,
  telegramUser: user.telegramUser,
  role: user.role as StoredUser["role"],
  kickName: user.kickName,
});

const createMockUser = (telegramId: number, username: string | undefined): StoredUser => ({
  id: telegramId.toString(),
  telegramId: telegramId.toString(),
  telegramUser: username ?? null,
  role: "VIEWER",
  kickName: null,
});

const syncToSheets = async (
  sheets: GoogleSheetsService | null,
  user: StoredUser
) => {
  if (!sheets) {
    return;
  }

  await sheets.appendUser([[user.telegramUser ?? "Unknown", user.kickName ?? "Not linked", new Date().toISOString()]]);
};

export const createUserService = (
  prisma: PrismaClient | null,
  sheets: GoogleSheetsService | null
): UserService => {
  const getUserOrCreate = async (telegramId: number, username: string | undefined) => {
    if (!prisma) {
      const mock = createMockUser(telegramId, username);
      await syncToSheets(sheets, mock);
      return mock;
    }

    const telegramIdString = telegramId.toString();
    let user = await prisma.user.findUnique({ where: { telegramId: telegramIdString } });

    if (!user) {
      user = await prisma.user.create({
        data: {
          telegramId: telegramIdString,
          telegramUser: username ?? null,
          role: "VIEWER",
        },
      });
    } else if (user.telegramUser !== username) {
      user = await prisma.user.update({
        where: { telegramId: telegramIdString },
        data: { telegramUser: username ?? null },
      });
    }

    const stored = toStoredUser(user);
    await syncToSheets(sheets, stored);
    return stored;
  };

  const isAdmin = (user: StoredUser) => user.role === "MOD" || user.role === "OWNER";
  const isOwner = (user: StoredUser) => user.role === "OWNER";

  const setKickName = async (telegramId: number, kickName: string) => {
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

  const findByKickName = async (kickName: string) => {
    if (!prisma) {
      return null;
    }

    const user = await prisma.user.findFirst({ where: { kickName } });
    return user ? toStoredUser(user) : null;
  };

  const setRole = async (telegramId: string, role: "MOD" | "OWNER") => {
    if (!prisma) {
      return null;
    }

    const updated = await prisma.user.update({ where: { telegramId }, data: { role } });
    return toStoredUser(updated);
  };

  const listUsers = async () => {
    if (!prisma) {
      return [];
    }

    const users = await prisma.user.findMany({ orderBy: { createdAt: "desc" } });
    return users.map(toStoredUser);
  };

  return { getUserOrCreate, isAdmin, isOwner, setKickName, findByKickName, setRole, listUsers };
};


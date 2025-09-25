import type { PrismaClient } from "@prisma/client";

export interface GroupInfo {
  title?: string | null;
  type?: string | null;
  memberCount?: number | null;
  lastSeen?: Date;
}

export interface TelegramGroupRecord {
  groupId: string;
  title: string | null;
  type: string | null;
  memberCount: number | null;
  isActive: boolean;
  source: string | null;
  lastSeen: Date | null;
  updatedAt: Date | null;
}

export const saveGroup = async (
  prisma: PrismaClient | null,
  groupId: string,
  info: GroupInfo,
  source: string
) => {
  if (!prisma) {
    return;
  }

  const now = new Date();
  const payload: GroupInfo = {
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

export const loadActiveGroups = async (
  prisma: PrismaClient | null
): Promise<TelegramGroupRecord[]> => {
  if (!prisma) {
    return [];
  }

  return prisma.telegramGroup.findMany({
    where: { isActive: true },
    orderBy: { lastSeen: "desc" },
  });
};

export const markGroupInactive = async (prisma: PrismaClient | null, groupId: string) => {
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

export const updateGroupDetails = async (
  prisma: PrismaClient | null,
  groupId: string,
  info: GroupInfo
) => {
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


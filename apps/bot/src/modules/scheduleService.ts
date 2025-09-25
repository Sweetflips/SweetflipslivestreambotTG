import type { PrismaClient } from "@prisma/client";
import { getDayName } from "../utils/dayName";
import { formatStreamTimes } from "../utils/timezone";

export interface ScheduleEntry {
  dayOfWeek: number;
  streamNumber: 1 | 2;
  eventTitle: string;
}

export interface ScheduleSummary {
  day: string;
  stream: number;
  event: string;
  times: string;
}

export const addScheduleEntry = async (
  prisma: PrismaClient | null,
  entry: ScheduleEntry,
  createdBy: string
) => {
  if (!prisma) {
    return false;
  }

  await prisma.schedule.upsert({
    where: {
      dayOfWeek_streamNumber: {
        dayOfWeek: entry.dayOfWeek,
        streamNumber: entry.streamNumber,
      },
    },
    update: {
      eventTitle: entry.eventTitle,
      isActive: true,
      createdBy,
      updatedAt: new Date(),
    },
    create: {
      ...entry,
      isActive: true,
      createdBy,
    },
  });

  return true;
};

export const removeScheduleEntry = async (
  prisma: PrismaClient | null,
  dayOfWeek: number,
  streamNumber: 1 | 2
) => {
  if (!prisma) {
    return false;
  }

  await prisma.schedule.update({
    where: {
      dayOfWeek_streamNumber: {
        dayOfWeek,
        streamNumber,
      },
    },
    data: {
      isActive: false,
      updatedAt: new Date(),
    },
  });

  return true;
};

export const getActiveSchedule = async (
  prisma: PrismaClient | null
): Promise<ScheduleSummary[]> => {
  if (!prisma) {
    return [];
  }

  const entries = await prisma.schedule.findMany({
    where: { isActive: true },
    orderBy: [{ dayOfWeek: "asc" }, { streamNumber: "asc" }],
  });

  return entries.map((entry) => {
    const times = formatStreamTimes(entry.streamNumber === 1 ? "07:00" : "17:00", entry.streamNumber as 1 | 2)
      .map((item) => `${item.label}: ${item.time}`)
      .join(" | ");

    return {
      day: getDayName(entry.dayOfWeek),
      stream: entry.streamNumber,
      event: entry.eventTitle,
      times,
    };
  });
};


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
    const times = formatStreamTimes(
      entry.streamNumber === 1 ? "07:00" : "17:00",
      entry.streamNumber as 1 | 2
    )
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

export interface ScheduleWithDateTime extends ScheduleSummary {
  dayOfWeek: number;
  streamNumber: 1 | 2;
  eventTitle: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export const getScheduleWithCurrentDayFirst = async (
  prisma: PrismaClient | null
): Promise<{ schedules: ScheduleWithDateTime[]; currentDay: string; nextStream: string | null }> => {
  if (!prisma) {
    return { schedules: [], currentDay: "", nextStream: null };
  }

  // Clean up old events first
  await cleanupOldEvents(prisma);

  const entries = await prisma.schedule.findMany({
    where: { isActive: true },
    orderBy: [{ dayOfWeek: "asc" }, { streamNumber: "asc" }],
  });

  const now = new Date();
  const currentDayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  const currentTimeInMinutes = currentHour * 60 + currentMinute;

  // Stream times in minutes from midnight UTC
  const stream1Time = 7 * 60; // 7:00 AM UTC
  const stream2Time = 17 * 60; // 5:00 PM UTC

  // Find the next upcoming stream
  let nextStream: string | null = null;
  let nextStreamTime: number | null = null;

  // Check current day first
  const currentDayEntries = entries.filter(entry => entry.dayOfWeek === currentDayOfWeek);
  for (const entry of currentDayEntries) {
    const streamTime = entry.streamNumber === 1 ? stream1Time : stream2Time;
    if (streamTime > currentTimeInMinutes) {
      const timeUntilStream = streamTime - currentTimeInMinutes;
      if (nextStreamTime === null || timeUntilStream < nextStreamTime) {
        nextStreamTime = timeUntilStream;
        nextStream = `${getDayName(entry.dayOfWeek)} - Stream ${entry.streamNumber}: ${entry.eventTitle} (in ${Math.floor(timeUntilStream / 60)}h ${timeUntilStream % 60}m)`;
      }
    }
  }

  // If no stream today, check next 7 days
  if (nextStream === null) {
    for (let dayOffset = 1; dayOffset <= 7; dayOffset++) {
      const checkDay = (currentDayOfWeek + dayOffset) % 7;
      const dayEntries = entries.filter(entry => entry.dayOfWeek === checkDay);
      
      for (const entry of dayEntries) {
        const streamTime = entry.streamNumber === 1 ? stream1Time : stream2Time;
        const totalMinutesUntilStream = dayOffset * 24 * 60 + streamTime;
        
        if (nextStreamTime === null || totalMinutesUntilStream < nextStreamTime) {
          nextStreamTime = totalMinutesUntilStream;
          const daysUntil = Math.floor(totalMinutesUntilStream / (24 * 60));
          const hoursUntil = Math.floor((totalMinutesUntilStream % (24 * 60)) / 60);
          const minutesUntil = totalMinutesUntilStream % 60;
          
          let timeString = "";
          if (daysUntil > 0) timeString += `${daysUntil}d `;
          if (hoursUntil > 0) timeString += `${hoursUntil}h `;
          if (minutesUntil > 0) timeString += `${minutesUntil}m`;
          
          nextStream = `${getDayName(entry.dayOfWeek)} - Stream ${entry.streamNumber}: ${entry.eventTitle} (in ${timeString.trim()})`;
        }
      }
    }
  }

  // Reorder schedules to show current day first, then upcoming days
  const reorderedEntries: ScheduleWithDateTime[] = [];
  
  // Add current day entries first
  const currentDaySchedules = entries.filter(entry => entry.dayOfWeek === currentDayOfWeek);
  reorderedEntries.push(...currentDaySchedules);
  
  // Add remaining days in order
  for (let dayOffset = 1; dayOffset < 7; dayOffset++) {
    const checkDay = (currentDayOfWeek + dayOffset) % 7;
    const daySchedules = entries.filter(entry => entry.dayOfWeek === checkDay);
    reorderedEntries.push(...daySchedules);
  }

  return {
    schedules: reorderedEntries,
    currentDay: getDayName(currentDayOfWeek),
    nextStream
  };
};

export const cleanupOldEvents = async (prisma: PrismaClient | null): Promise<void> => {
  if (!prisma) {
    return;
  }

  const now = new Date();
  const currentDayOfWeek = now.getDay();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  const currentTimeInMinutes = currentHour * 60 + currentMinute;

  // Stream times in minutes from midnight UTC
  const stream1Time = 7 * 60; // 7:00 AM UTC
  const stream2Time = 17 * 60; // 5:00 PM UTC

  // Clean up events from previous days
  const previousDay = (currentDayOfWeek - 1 + 7) % 7;
  await prisma.schedule.updateMany({
    where: {
      dayOfWeek: previousDay,
      isActive: true
    },
    data: {
      isActive: false,
      updatedAt: new Date()
    }
  });

  // Clean up events from current day that have passed 3+ hours
  const threeHoursInMinutes = 3 * 60;
  
  // Check stream 1 (7:00 AM UTC)
  if (currentTimeInMinutes > stream1Time + threeHoursInMinutes) {
    await prisma.schedule.updateMany({
      where: {
        dayOfWeek: currentDayOfWeek,
        streamNumber: 1,
        isActive: true
      },
      data: {
        isActive: false,
        updatedAt: new Date()
      }
    });
  }

  // Check stream 2 (5:00 PM UTC)
  if (currentTimeInMinutes > stream2Time + threeHoursInMinutes) {
    await prisma.schedule.updateMany({
      where: {
        dayOfWeek: currentDayOfWeek,
        streamNumber: 2,
        isActive: true
      },
      data: {
        isActive: false,
        updatedAt: new Date()
      }
    });
  }
};
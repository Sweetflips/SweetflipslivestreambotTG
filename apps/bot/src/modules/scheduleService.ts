import { prisma } from "../lib/prisma.js";
import { getDayName } from "../utils/dayName";
import { formatStreamTimes, type StreamTime } from "../utils/timezone";
import { getStreamTimeInMinutes, getStreamTimeUTC } from "../utils/streamTimes.js";

export interface ScheduleEntry {
  dayOfWeek: number;
  streamNumber: 1 | 2;
  eventTitle: string;
}

export interface ScheduleSummary {
  day: string;
  stream: number;
  event: string;
  times: StreamTime[];
}

export const addScheduleEntry = async (
  prismaClient: typeof prisma,
  entry: ScheduleEntry,
  createdBy: string
) => {
  if (!prismaClient) {
    return false;
  }

  await prismaClient.schedule.upsert({
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
  prismaClient: typeof prisma,
  dayOfWeek: number,
  streamNumber: 1 | 2
) => {
  if (!prismaClient) {
    return false;
  }

  await prismaClient.schedule.update({
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
  prismaClient: typeof prisma
): Promise<ScheduleSummary[]> => {
  if (!prismaClient) {
    return [];
  }

  const entries = await prismaClient.schedule.findMany({
    where: { isActive: true },
    orderBy: [{ dayOfWeek: "asc" }, { streamNumber: "asc" }],
  });

  return entries.map((entry) => {
    const utcTime = getStreamTimeUTC(entry.dayOfWeek, entry.streamNumber as 1 | 2);
    const times = formatStreamTimes(utcTime, entry.streamNumber as 1 | 2);

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
  streamNumber: number;
  eventTitle: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export const getScheduleWithCurrentDayFirst = async (
  prismaClient: typeof prisma
): Promise<{
  schedules: ScheduleWithDateTime[];
  currentDay: string;
  nextStream: string | null;
}> => {
  if (!prismaClient) {
    return { schedules: [], currentDay: "", nextStream: null };
  }

  // Clean up old events first
  await cleanupOldEvents(prismaClient);

  const entries = await prismaClient.schedule.findMany({
    where: { isActive: true },
    orderBy: [{ dayOfWeek: "asc" }, { streamNumber: "asc" }],
  });

  const now = new Date();
  const currentDayOfWeek = now.getDay();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  const currentTimeInMinutes = currentHour * 60 + currentMinute;

  let nextStream: string | null = null;
  let nextStreamTime: number | null = null;

  const currentDayEntries = entries.filter(
    (entry) => entry.dayOfWeek === currentDayOfWeek
  );
  for (const entry of currentDayEntries) {
    const streamTime = getStreamTimeInMinutes(entry.dayOfWeek, entry.streamNumber as 1 | 2);
    if (streamTime > currentTimeInMinutes) {
      const timeUntilStream = streamTime - currentTimeInMinutes;
      if (nextStreamTime === null || timeUntilStream < nextStreamTime) {
        nextStreamTime = timeUntilStream;
        nextStream = `${getDayName(entry.dayOfWeek)} - Stream ${
          entry.streamNumber
        }: ${entry.eventTitle} (in ${Math.floor(timeUntilStream / 60)}h ${
          timeUntilStream % 60
        }m)`;
      }
    }
  }

  if (nextStream === null) {
    for (let dayOffset = 1; dayOffset <= 7; dayOffset++) {
      const checkDay = (currentDayOfWeek + dayOffset) % 7;
      const dayEntries = entries.filter(
        (entry) => entry.dayOfWeek === checkDay
      );

      for (const entry of dayEntries) {
        const streamTime = getStreamTimeInMinutes(entry.dayOfWeek, entry.streamNumber as 1 | 2);
        const totalMinutesUntilStream = dayOffset * 24 * 60 + streamTime;

        if (
          nextStreamTime === null ||
          totalMinutesUntilStream < nextStreamTime
        ) {
          nextStreamTime = totalMinutesUntilStream;
          const daysUntil = Math.floor(nextStreamTime / (24 * 60));
          const hoursUntil = Math.floor(
            (nextStreamTime % (24 * 60)) / 60
          );
          const minutesUntil = nextStreamTime % 60;

          let timeString = "";
          if (daysUntil > 0) timeString += `${daysUntil}d `;
          if (hoursUntil > 0) timeString += `${hoursUntil}h `;
          if (minutesUntil > 0) timeString += `${minutesUntil}m`;

          nextStream = `${getDayName(entry.dayOfWeek)} - Stream ${
            entry.streamNumber
          }: ${entry.eventTitle} (in ${timeString.trim()})`;
        }
      }
    }
  }

  // Reorder schedules to show current day first, then upcoming days
  const reorderedEntries: ScheduleWithDateTime[] = [];

  // Add current day entries first
  const currentDaySchedules = entries.filter(
    (entry) => entry.dayOfWeek === currentDayOfWeek
  );
  reorderedEntries.push(
    ...currentDaySchedules.map((entry) => {
      const utcTime = getStreamTimeUTC(entry.dayOfWeek, entry.streamNumber as 1 | 2);
      return {
        ...entry,
        day: getDayName(entry.dayOfWeek),
        stream: entry.streamNumber,
        event: entry.eventTitle,
        times: formatStreamTimes(utcTime, entry.streamNumber as 1 | 2),
      };
    })
  );

  for (let dayOffset = 1; dayOffset < 7; dayOffset++) {
    const checkDay = (currentDayOfWeek + dayOffset) % 7;
    const daySchedules = entries.filter(
      (entry) => entry.dayOfWeek === checkDay
    );
    reorderedEntries.push(
      ...daySchedules.map((entry) => {
        const utcTime = getStreamTimeUTC(entry.dayOfWeek, entry.streamNumber as 1 | 2);
        return {
          ...entry,
          day: getDayName(entry.dayOfWeek),
          stream: entry.streamNumber,
          event: entry.eventTitle,
          times: formatStreamTimes(utcTime, entry.streamNumber as 1 | 2),
        };
      })
    );
  }

  return {
    schedules: reorderedEntries,
    currentDay: getDayName(currentDayOfWeek),
    nextStream,
  };
};

export const cleanupOldEvents = async (
  prismaClient: typeof prisma
): Promise<void> => {
  if (!prismaClient) {
    return;
  }

  const now = new Date();
  const currentDayOfWeek = now.getDay();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  const currentTimeInMinutes = currentHour * 60 + currentMinute;

  const previousDay = (currentDayOfWeek - 1 + 7) % 7;
  await prisma.schedule.updateMany({
    where: {
      dayOfWeek: previousDay,
      isActive: true,
    },
    data: {
      isActive: false,
      updatedAt: new Date(),
    },
  });

  const threeHoursInMinutes = 3 * 60;

  const stream1Time = getStreamTimeInMinutes(currentDayOfWeek, 1);
  if (currentTimeInMinutes > stream1Time + threeHoursInMinutes) {
    await prisma.schedule.updateMany({
      where: {
        dayOfWeek: currentDayOfWeek,
        streamNumber: 1,
        isActive: true,
      },
      data: {
        isActive: false,
        updatedAt: new Date(),
      },
    });
  }

  const stream2Time = getStreamTimeInMinutes(currentDayOfWeek, 2);
  if (currentTimeInMinutes > stream2Time + threeHoursInMinutes) {
    await prisma.schedule.updateMany({
      where: {
        dayOfWeek: currentDayOfWeek,
        streamNumber: 2,
        isActive: true,
      },
      data: {
        isActive: false,
        updatedAt: new Date(),
      },
    });
  }
};

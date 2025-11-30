import { prisma } from "../lib/prisma.js";
import { getDayName } from "../utils/dayName";
import { formatStreamTimes } from "../utils/timezone";
import { getStreamTimeInMinutes, getStreamTimeUTC } from "../utils/streamTimes.js";

export interface StreamReminder {
  dayOfWeek: number;
  streamNumber: 1 | 2;
  eventTitle: string;
  eventDate: Date;
  timeUntilStream: string;
}

export const checkForUpcomingStreams = async (
  prismaClient: typeof prisma,
  hoursBefore: number = 2
): Promise<StreamReminder[]> => {
  if (!prismaClient) {
    return [];
  }

  const now = new Date();
  const currentDayOfWeek = now.getDay();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  const currentTimeInMinutes = currentHour * 60 + currentMinute;

  const reminders: StreamReminder[] = [];

  const schedules = await prismaClient.schedule.findMany({
    where: { isActive: true },
    orderBy: [{ dayOfWeek: "asc" }, { streamNumber: "asc" }],
  });

  const currentDaySchedules = schedules.filter(
    (schedule) => schedule.dayOfWeek === currentDayOfWeek
  );

  for (const schedule of currentDaySchedules) {
    const streamTime = getStreamTimeInMinutes(schedule.dayOfWeek, schedule.streamNumber as 1 | 2);
    const reminderTime = streamTime - hoursBefore * 60;

    if (Math.abs(currentTimeInMinutes - reminderTime) <= 5) {
      const eventDate = new Date();
      eventDate.setHours(Math.floor(streamTime / 60), streamTime % 60, 0, 0);

      const timeUntilStream = streamTime - currentTimeInMinutes;
      const hoursUntil = Math.floor(timeUntilStream / 60);
      const minutesUntil = timeUntilStream % 60;

      reminders.push({
        dayOfWeek: schedule.dayOfWeek,
        streamNumber: schedule.streamNumber as 1 | 2,
        eventTitle: schedule.eventTitle,
        eventDate,
        timeUntilStream: `${hoursUntil}h ${minutesUntil}m`,
      });
    }
  }

  const nextDay = (currentDayOfWeek + 1) % 7;
  const nextDaySchedules = schedules.filter(
    (schedule) => schedule.dayOfWeek === nextDay
  );

  for (const schedule of nextDaySchedules) {
    const streamTime = getStreamTimeInMinutes(schedule.dayOfWeek, schedule.streamNumber as 1 | 2);
    const reminderTime = streamTime - hoursBefore * 60;

    if (Math.abs(currentTimeInMinutes - reminderTime) <= 5) {
      const eventDate = new Date();
      eventDate.setDate(eventDate.getDate() + 1);
      eventDate.setHours(Math.floor(streamTime / 60), streamTime % 60, 0, 0);

      const timeUntilStream = 24 * 60 + streamTime - currentTimeInMinutes;
      const hoursUntil = Math.floor(timeUntilStream / 60);
      const minutesUntil = timeUntilStream % 60;

      reminders.push({
        dayOfWeek: schedule.dayOfWeek,
        streamNumber: schedule.streamNumber as 1 | 2,
        eventTitle: schedule.eventTitle,
        eventDate,
        timeUntilStream: `${hoursUntil}h ${minutesUntil}m`,
      });
    }
  }

  return reminders;
};

export const hasNotificationBeenSent = async (
  prismaClient: typeof prisma,
  dayOfWeek: number,
  streamNumber: 1 | 2,
  notificationType: string,
  eventDate: Date
): Promise<boolean> => {
  if (!prisma) {
    return false;
  }

  try {
    const existing = await prismaClient.streamNotification.findUnique({
      where: {
        dayOfWeek_streamNumber_notificationType_eventDate: {
          dayOfWeek,
          streamNumber,
          notificationType,
          eventDate,
        },
      },
    });

    return existing !== null;
  } catch (error) {
    console.error("Error checking notification status:", error);
    return false;
  }
};

export const recordNotificationSent = async (
  prismaClient: typeof prisma,
  dayOfWeek: number,
  streamNumber: 1 | 2,
  notificationType: string,
  eventDate: Date,
  successCount: number,
  failedCount: number
): Promise<void> => {
  if (!prismaClient) {
    return;
  }

  try {
    await prismaClient.streamNotification.upsert({
      where: {
        dayOfWeek_streamNumber_notificationType_eventDate: {
          dayOfWeek,
          streamNumber,
          notificationType,
          eventDate,
        },
      },
      update: {
        sentAt: new Date(),
        successCount,
        failedCount,
      },
      create: {
        dayOfWeek,
        streamNumber,
        notificationType,
        eventDate,
        successCount,
        failedCount,
      },
    });
  } catch (error) {
    console.error("Error recording notification:", error);
  }
};

export const createStreamReminderMessage = (
  reminder: StreamReminder
): string => {
  const utcTime = getStreamTimeUTC(reminder.dayOfWeek, reminder.streamNumber);
  const times = formatStreamTimes(utcTime, reminder.streamNumber);

  const utcTime = times.find((t) => t.label === "UTC")?.time || "Unknown";
  const istTime = times.find((t) => t.label === "IST")?.time || "Unknown";
  const pstTime = times.find((t) => t.label === "PST")?.time || "Unknown";

  return (
    `🚀 <b>Stream Reminder!</b>\n\n` +
    `⏰ <b>Stream starting in ${reminder.timeUntilStream}!</b>\n\n` +
    `📅 <b>${getDayName(reminder.dayOfWeek)} - Stream ${
      reminder.streamNumber
    }</b>\n` +
    `🎮 <b>Event:</b> ${reminder.eventTitle}\n\n` +
    `🕐 <b>Stream Times:</b>\n` +
    `🌍 UTC: ${utcTime}\n` +
    `🇮🇳 IST: ${istTime}\n` +
    `🇺🇸 PST: ${pstTime}\n\n` +
    `🎯 <b>Join us at:</b> https://kick.com/sweetflips\n\n` +
    `⚡ Get ready for an amazing stream!`
  );
};

export const cleanupOldNotifications = async (
  prismaClient: typeof prisma
): Promise<void> => {
  if (!prismaClient) {
    return;
  }

  try {
    // Delete notifications older than 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    await prismaClient.streamNotification.deleteMany({
      where: {
        sentAt: {
          lt: sevenDaysAgo,
        },
      },
    });

    console.log("🧹 Cleaned up old stream notifications");
  } catch (error) {
    console.error("Error cleaning up old notifications:", error);
  }
};

import { prisma } from "../lib/prisma.js";
import { getDayName } from "../utils/dayName";
import { formatStreamTimes } from "../utils/timezone";
export const checkForUpcomingStreams = async (prismaClient, hoursBefore = 2) => {
    if (!prismaClient) {
        return [];
    }
    const now = new Date();
    const currentDayOfWeek = now.getDay();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const currentTimeInMinutes = currentHour * 60 + currentMinute;
    // Stream times in minutes from midnight UTC
    const stream1Time = 8 * 60; // 8:00 AM UTC
    const stream2Time = 18 * 60; // 6:00 PM UTC
    const reminders = [];
    // Check current day for streams starting in exactly 'hoursBefore' hours
    const targetTimeInMinutes = currentTimeInMinutes + hoursBefore * 60;
    // Check if target time falls within a stream time window
    const stream1TargetTime = stream1Time - hoursBefore * 60;
    const stream2TargetTime = stream2Time - hoursBefore * 60;
    // Get active schedules
    const schedules = await prismaClient.schedule.findMany({
        where: { isActive: true },
        orderBy: [{ dayOfWeek: "asc" }, { streamNumber: "asc" }],
    });
    // Check current day
    const currentDaySchedules = schedules.filter((schedule) => schedule.dayOfWeek === currentDayOfWeek);
    for (const schedule of currentDaySchedules) {
        const streamTime = schedule.streamNumber === 1 ? stream1Time : stream2Time;
        const reminderTime = streamTime - hoursBefore * 60;
        // Check if current time is within 5 minutes of the reminder time
        if (Math.abs(currentTimeInMinutes - reminderTime) <= 5) {
            const eventDate = new Date();
            eventDate.setHours(Math.floor(streamTime / 60), streamTime % 60, 0, 0);
            const timeUntilStream = streamTime - currentTimeInMinutes;
            const hoursUntil = Math.floor(timeUntilStream / 60);
            const minutesUntil = timeUntilStream % 60;
            reminders.push({
                dayOfWeek: schedule.dayOfWeek,
                streamNumber: schedule.streamNumber,
                eventTitle: schedule.eventTitle,
                eventDate,
                timeUntilStream: `${hoursUntil}h ${minutesUntil}m`,
            });
        }
    }
    // Check next day for streams (in case we're checking late at night)
    const nextDay = (currentDayOfWeek + 1) % 7;
    const nextDaySchedules = schedules.filter((schedule) => schedule.dayOfWeek === nextDay);
    for (const schedule of nextDaySchedules) {
        const streamTime = schedule.streamNumber === 1 ? stream1Time : stream2Time;
        const reminderTime = streamTime - hoursBefore * 60;
        // For next day, check if current time is within 5 minutes of the reminder time
        // (this handles cases where we're checking late at night for next day's early stream)
        if (Math.abs(currentTimeInMinutes - reminderTime) <= 5) {
            const eventDate = new Date();
            eventDate.setDate(eventDate.getDate() + 1);
            eventDate.setHours(Math.floor(streamTime / 60), streamTime % 60, 0, 0);
            const timeUntilStream = 24 * 60 + streamTime - currentTimeInMinutes;
            const hoursUntil = Math.floor(timeUntilStream / 60);
            const minutesUntil = timeUntilStream % 60;
            reminders.push({
                dayOfWeek: schedule.dayOfWeek,
                streamNumber: schedule.streamNumber,
                eventTitle: schedule.eventTitle,
                eventDate,
                timeUntilStream: `${hoursUntil}h ${minutesUntil}m`,
            });
        }
    }
    return reminders;
};
export const hasNotificationBeenSent = async (prismaClient, dayOfWeek, streamNumber, notificationType, eventDate) => {
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
    }
    catch (error) {
        console.error("Error checking notification status:", error);
        return false;
    }
};
export const recordNotificationSent = async (prismaClient, dayOfWeek, streamNumber, notificationType, eventDate, successCount, failedCount) => {
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
    }
    catch (error) {
        console.error("Error recording notification:", error);
    }
};
export const createStreamReminderMessage = (reminder) => {
    const times = formatStreamTimes(reminder.streamNumber === 1 ? "08:00" : "18:00", reminder.streamNumber);
    const utcTime = times.find((t) => t.label === "UTC")?.time || "Unknown";
    const istTime = times.find((t) => t.label === "IST")?.time || "Unknown";
    const pstTime = times.find((t) => t.label === "PST")?.time || "Unknown";
    return (`🚀 <b>Stream Reminder!</b>\n\n` +
        `⏰ <b>Stream starting in ${reminder.timeUntilStream}!</b>\n\n` +
        `📅 <b>${getDayName(reminder.dayOfWeek)} - Stream ${reminder.streamNumber}</b>\n` +
        `🎮 <b>Event:</b> ${reminder.eventTitle}\n\n` +
        `🕐 <b>Stream Times:</b>\n` +
        `🌍 UTC: ${utcTime}\n` +
        `🇮🇳 IST: ${istTime}\n` +
        `🇺🇸 PST: ${pstTime}\n\n` +
        `🎯 <b>Join us at:</b> https://kick.com/sweetflips\n\n` +
        `⚡ Get ready for an amazing stream!`);
};
export const cleanupOldNotifications = async (prismaClient) => {
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
    }
    catch (error) {
        console.error("Error cleaning up old notifications:", error);
    }
};

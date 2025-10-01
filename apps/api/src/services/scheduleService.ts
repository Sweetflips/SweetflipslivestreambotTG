import { PrismaClient } from '@prisma/client';
import { logger } from '../telemetry/logger.js';

export interface ScheduleEntry {
  id: string;
  dayOfWeek: number;
  streamNumber: number;
  eventTitle: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface StreamTime {
  hour: number;
  minute: number;
  timezone: string;
}

export class ScheduleService {
  private prisma: PrismaClient;
  private streamTimes: StreamTime[] = [
    { hour: 8, minute: 0, timezone: 'UTC' }, // 8am UTC
    { hour: 18, minute: 0, timezone: 'UTC' }, // 6pm UTC
  ];

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  async getScheduleForWeek(): Promise<ScheduleEntry[]> {
    try {
      const schedules = await this.prisma.schedule.findMany({
        where: { isActive: true },
        orderBy: [{ dayOfWeek: 'asc' }, { streamNumber: 'asc' }],
      });

      return schedules;
    } catch (error) {
      logger.error('Failed to get schedule for week:', error);
      throw error;
    }
  }

  async addScheduleEntry(
    dayOfWeek: number,
    streamNumber: number,
    eventTitle: string,
    createdBy?: string
  ): Promise<ScheduleEntry> {
    try {
      if (dayOfWeek < 0 || dayOfWeek > 6) {
        throw new Error('Day of week must be between 0 (Sunday) and 6 (Saturday)');
      }

      if (streamNumber < 1 || streamNumber > 2) {
        throw new Error('Stream number must be 1 or 2');
      }

      if (eventTitle.length > 100) {
        throw new Error('Event title too long (max 100 characters)');
      }

      const schedule = await this.prisma.schedule.upsert({
        where: {
          dayOfWeek_streamNumber: {
            dayOfWeek,
            streamNumber,
          },
        },
        update: {
          eventTitle,
          isActive: true,
          createdBy: createdBy || null,
        },
        create: {
          dayOfWeek,
          streamNumber,
          eventTitle,
          isActive: true,
          createdBy: createdBy || null,
        },
      });

      logger.info(`Schedule entry added: ${dayOfWeek}-${streamNumber} - ${eventTitle}`);
      return schedule;
    } catch (error) {
      logger.error('Failed to add schedule entry:', error);
      throw error;
    }
  }

  async removeScheduleEntry(dayOfWeek: number, streamNumber: number): Promise<void> {
    try {
      await this.prisma.schedule.updateMany({
        where: {
          dayOfWeek,
          streamNumber,
        },
        data: {
          isActive: false,
        },
      });

      logger.info(`Schedule entry removed: ${dayOfWeek}-${streamNumber}`);
    } catch (error) {
      logger.error('Failed to remove schedule entry:', error);
      throw error;
    }
  }

  async getStreamTime(streamNumber: number): Promise<StreamTime> {
    if (streamNumber < 1 || streamNumber > 2) {
      throw new Error('Stream number must be 1 or 2');
    }

    const streamTime = this.streamTimes[streamNumber - 1];
    if (!streamTime) {
      throw new Error('Invalid stream number');
    }
    return streamTime;
  }

  async getAllStreamTimes(): Promise<StreamTime[]> {
    return [...this.streamTimes];
  }

  formatScheduleForDisplay(schedules: ScheduleEntry[]): string {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    let message = '📅 **Stream Schedule**\n\n';

    for (let day = 0; day < 7; day++) {
      const daySchedules = schedules.filter(s => s.dayOfWeek === day);

      if (daySchedules.length === 0) {
        message += `**${days[day]}:** No streams scheduled\n\n`;
        continue;
      }

      message += `**${days[day]}:**\n`;

      for (const schedule of daySchedules) {
        const streamTime = this.streamTimes[schedule.streamNumber - 1];
        if (streamTime) {
          const timeStr = `${streamTime.hour.toString().padStart(2, '0')}:${streamTime.minute
            .toString()
            .padStart(2, '0')} ${streamTime.timezone}`;
          message += `  ${schedule.streamNumber}. ${timeStr} - ${schedule.eventTitle}\n`;
        }
      }

      message += '\n';
    }

    return message;
  }

  async getNextStreams(days: number = 7): Promise<
    Array<{
      date: Date;
      dayOfWeek: number;
      streamNumber: number;
      eventTitle: string;
      streamTime: StreamTime;
    }>
  > {
    try {
      const schedules = await this.getScheduleForWeek();
      const nextStreams: Array<{
        date: Date;
        dayOfWeek: number;
        streamNumber: number;
        eventTitle: string;
        streamTime: StreamTime;
      }> = [];

      const today = new Date();

      for (let i = 0; i < days; i++) {
        const checkDate = new Date(today);
        checkDate.setDate(today.getDate() + i);
        const dayOfWeek = checkDate.getDay();

        const daySchedules = schedules.filter(s => s.dayOfWeek === dayOfWeek);

        for (const schedule of daySchedules) {
          const streamTime = this.streamTimes[schedule.streamNumber - 1];
          if (streamTime) {
            const streamDate = new Date(checkDate);
            streamDate.setUTCHours(streamTime.hour, streamTime.minute, 0, 0);

            nextStreams.push({
              date: streamDate,
              dayOfWeek,
              streamNumber: schedule.streamNumber,
              eventTitle: schedule.eventTitle,
              streamTime,
            });
          }
        }
      }

      return nextStreams.sort((a, b) => a.date.getTime() - b.date.getTime());
    } catch (error) {
      logger.error('Failed to get next streams:', error);
      throw error;
    }
  }
}

import { PrismaClient } from '@prisma/client';
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
export declare class ScheduleService {
    private prisma;
    private streamTimes;
    constructor(prisma: PrismaClient);
    getScheduleForWeek(): Promise<ScheduleEntry[]>;
    addScheduleEntry(dayOfWeek: number, streamNumber: number, eventTitle: string, createdBy?: string): Promise<ScheduleEntry>;
    removeScheduleEntry(dayOfWeek: number, streamNumber: number): Promise<void>;
    getStreamTime(streamNumber: number): Promise<StreamTime>;
    getAllStreamTimes(): Promise<StreamTime[]>;
    formatScheduleForDisplay(schedules: ScheduleEntry[]): string;
    getNextStreams(days?: number): Promise<Array<{
        date: Date;
        dayOfWeek: number;
        streamNumber: number;
        eventTitle: string;
        streamTime: StreamTime;
    }>>;
}
//# sourceMappingURL=scheduleService.d.ts.map
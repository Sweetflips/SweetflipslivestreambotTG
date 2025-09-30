import { PrismaClient } from '@prisma/client';
export interface CallSessionData {
    id: string;
    sessionName: string;
    status: string;
    createdAt: Date;
    closedAt: Date | null;
    revealedAt: Date | null;
    callEntries: CallEntryData[];
}
export interface CallEntryData {
    id: string;
    sessionId: string;
    userId: string;
    slotName: string;
    multiplier: number | null;
    createdAt: Date;
    isArchived: boolean;
    user: {
        telegramUser: string | null;
        kickName: string | null;
    };
}
export declare class CallSessionService {
    private prisma;
    private activeSessions;
    constructor(prisma: PrismaClient);
    initialize(): Promise<void>;
    createNewCallSession(): Promise<CallSessionData | null>;
    getActiveCallSession(): Promise<CallSessionData | null>;
    makeCallEntry(userId: string, slotName: string): Promise<{
        success: boolean;
        message: string;
        sessionId?: string;
    }>;
    getSessionCallEntries(sessionId?: string): Promise<CallEntryData[]>;
    closeCallSession(sessionId?: string): Promise<boolean>;
    revealCallSession(sessionId?: string): Promise<boolean>;
    setSlotMultiplier(sessionId: string, slotName: string, multiplier: number): Promise<boolean>;
}
//# sourceMappingURL=callSessionService.d.ts.map
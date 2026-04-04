import { PrismaClient } from '@prisma/client';
export declare class LinkService {
    private prisma;
    constructor(prisma: PrismaClient);
    generateLinkCode(userId: string): Promise<string>;
    verifyLinkCode(code: string, kickName: string): Promise<boolean>;
    unlinkAccount(userId: string): Promise<void>;
    getLinkStatus(userId: string): Promise<{
        id: string;
        telegramId: string;
        kickName: string | null;
        telegramUser: string | null;
        role: string;
        linkedAt: Date | null;
        createdAt: Date;
        updatedAt: Date;
    }>;
}
//# sourceMappingURL=linkService.d.ts.map
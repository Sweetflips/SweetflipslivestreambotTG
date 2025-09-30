import { PrismaClient, Role } from '@prisma/client';
export interface UserContext {
    id: string;
    telegramId?: string;
    kickName?: string;
    role: Role;
}
export interface AuthResult {
    user: UserContext;
    isAuthenticated: boolean;
}
export declare function hasRole(userRole: Role, requiredRole: Role): boolean;
export declare function requireRole(requiredRole: Role): (userRole: Role) => void;
export declare class AuthService {
    private prisma;
    constructor(prisma: PrismaClient);
    getUserByTelegramId(telegramId: string): Promise<UserContext | null>;
    getUserByKickName(kickName: string): Promise<UserContext | null>;
    createOrUpdateUser(data: {
        telegramId?: string;
        telegramUser?: string;
        kickName?: string;
        cwalletHandle?: string;
        role?: Role;
    }): Promise<UserContext>;
    verifyTelegramAdmin(telegramId: string, chatId: string, botToken: string): Promise<boolean>;
    authenticateTelegramUser(telegramId: string, chatId: string, botToken: string): Promise<AuthResult>;
    authenticateKickUser(kickName: string): Promise<AuthResult>;
}
export declare function createRBACPreHandler(requiredRole: Role): (request: any, reply: any) => Promise<void>;
export declare function createRBACMiddleware(requiredRole: Role): (ctx: any, next: () => Promise<void>) => Promise<void>;
//# sourceMappingURL=rbac.d.ts.map
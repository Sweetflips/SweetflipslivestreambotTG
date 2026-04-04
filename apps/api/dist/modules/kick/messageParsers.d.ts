import { KickMessage, KickRole } from './chatProvider.js';
export interface ParsedCommand {
    type: 'guess' | 'link' | 'answer' | 'unknown';
    data?: any;
    originalMessage: string;
}
export declare function parseKickMessage(message: KickMessage): ParsedCommand;
export declare function validateKickMessage(message: KickMessage): boolean;
export declare function extractUserInfo(message: KickMessage): {
    username: string;
    role: KickRole;
    isSubscriber: boolean;
    isModerator: boolean;
    isVip: boolean;
};
export declare function isModeratorOrAbove(role: KickRole): boolean;
export declare function isSubscriberOrAbove(role: KickRole): boolean;
//# sourceMappingURL=messageParsers.d.ts.map
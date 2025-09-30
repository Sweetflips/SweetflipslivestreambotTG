import { AuthService } from '../../auth/rbac.js';
import { RateLimiter } from '../../utils/rateLimit.js';
import { BonusService } from '../games/bonus/bonusService.js';
import { TriviaService } from '../games/trivia/triviaService.js';
import { LinkService } from '../linking/linkService.js';
export interface KickMessage {
    type: 'message' | 'user_joined' | 'user_left' | 'system';
    username: string;
    message: string;
    timestamp: Date;
    isMod: boolean;
    isSubscriber: boolean;
}
export declare class KickChatProvider {
    private authService;
    private bonusService;
    private triviaService;
    private linkService;
    private rateLimiter;
    private ws;
    private reconnectAttempts;
    private maxReconnectAttempts;
    private reconnectDelay;
    constructor(authService: AuthService, bonusService: BonusService, triviaService: TriviaService, linkService: LinkService, rateLimiter: RateLimiter);
    connect(): Promise<void>;
    private handleMessage;
    private processMessage;
    private handleGuess;
    private handleLink;
    private handleAnswer;
    private handleReconnect;
    sendMessage(message: string): Promise<void>;
    disconnect(): Promise<void>;
}
//# sourceMappingURL=kickChat.d.ts.map
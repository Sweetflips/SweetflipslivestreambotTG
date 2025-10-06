import type { FastifyReply, FastifyRequest } from 'fastify';
import { BonusService } from './bonusService.js';
export declare class BonusController {
    private bonusService;
    constructor(bonusService: BonusService);
    startGame(request: FastifyRequest, reply: FastifyReply): Promise<never>;
    submitGuess(request: FastifyRequest<{
        Body: {
            gameRoundId: string;
            userId: string;
            guess: number;
        };
    }>, reply: FastifyReply): Promise<never>;
    closeGame(request: FastifyRequest<{
        Params: {
            gameRoundId: string;
        };
    }>, reply: FastifyReply): Promise<never>;
    revealGame(request: FastifyRequest<{
        Params: {
            gameRoundId: string;
        };
        Body: {
            finalValue: number;
        };
    }>, reply: FastifyReply): Promise<never>;
    getGameResults(request: FastifyRequest<{
        Params: {
            gameRoundId: string;
        };
    }>, reply: FastifyReply): Promise<never>;
    getLeaderboard(request: FastifyRequest<{
        Params: {
            gameRoundId: string;
        };
    }>, reply: FastifyReply): Promise<never>;
    getCurrentGame(request: FastifyRequest, reply: FastifyReply): Promise<never>;
}
//# sourceMappingURL=bonusController.d.ts.map
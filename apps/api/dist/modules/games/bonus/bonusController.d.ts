import { FastifyReply, FastifyRequest } from 'fastify';
import { BonusService } from './bonusService.js';
export declare class BonusController {
    private bonusService;
    constructor(bonusService: BonusService);
    startGame(request: FastifyRequest, reply: FastifyReply): Promise<never>;
    addBonus(request: FastifyRequest<{
        Body: {
            name: string;
        };
    }>, reply: FastifyReply): Promise<never>;
    recordPayout(request: FastifyRequest<{
        Body: {
            name: string;
            amount: number;
        };
    }>, reply: FastifyReply): Promise<never>;
    submitGuess(request: FastifyRequest<{
        Body: {
            userId: string;
            guess: number;
        };
    }>, reply: FastifyReply): Promise<never>;
    closeGame(request: FastifyRequest, reply: FastifyReply): Promise<never>;
    getGameState(request: FastifyRequest<{
        Params: {
            gameId: string;
        };
    }>, reply: FastifyReply): Promise<never>;
    getLeaderboard(request: FastifyRequest<{
        Querystring: {
            gameId?: string;
        };
    }>, reply: FastifyReply): Promise<never>;
    getCurrentGame(request: FastifyRequest, reply: FastifyReply): Promise<never>;
}
//# sourceMappingURL=bonusController.d.ts.map
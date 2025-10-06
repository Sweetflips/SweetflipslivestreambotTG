import type { FastifyReply, FastifyRequest } from 'fastify';
import { TriviaService } from './triviaService.js';
export declare class TriviaController {
    private triviaService;
    constructor(triviaService: TriviaService);
    startGame(request: FastifyRequest, reply: FastifyReply): Promise<never>;
    createRound(request: FastifyRequest<{
        Body: {
            question: string;
            answer: string;
        };
    }>, reply: FastifyReply): Promise<never>;
    submitAnswer(request: FastifyRequest<{
        Body: {
            userId: string;
            answer: string;
        };
    }>, reply: FastifyReply): Promise<never>;
    lockRound(request: FastifyRequest, reply: FastifyReply): Promise<never>;
    stopGame(request: FastifyRequest, reply: FastifyReply): Promise<never>;
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
    getCurrentRound(request: FastifyRequest, reply: FastifyReply): Promise<never>;
}
//# sourceMappingURL=triviaController.d.ts.map
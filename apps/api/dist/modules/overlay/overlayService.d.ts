import { Server as SocketIOServer } from 'socket.io';
import { BonusService } from '../games/bonus/bonusService.js';
import { TriviaService } from '../games/trivia/triviaService.js';
export interface OverlayState {
    gameType: 'BONUS' | 'TRIVIA' | null;
    gameStatus: 'IDLE' | 'RUNNING' | 'OPENING' | 'COMPLETED';
    data: any;
}
export declare class OverlayService {
    private bonusService;
    private triviaService;
    private io;
    private overlayNamespace;
    constructor(io: SocketIOServer, bonusService: BonusService, triviaService: TriviaService);
    private setupOverlayNamespace;
    private sendCurrentState;
    getCurrentState(): Promise<OverlayState>;
    broadcastBonusUpdate(gameId: string): Promise<void>;
    broadcastBonusFinal(gameId: string, results: any): Promise<void>;
    broadcastTriviaUpdate(gameId: string): Promise<void>;
    broadcastTriviaScores(gameId: string, scores: any[]): Promise<void>;
}
//# sourceMappingURL=overlayService.d.ts.map
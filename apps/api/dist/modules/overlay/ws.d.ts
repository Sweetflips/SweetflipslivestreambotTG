import { PrismaClient } from '@prisma/client';
import { Server as SocketIOServer } from 'socket.io';
import { OverlayConnectionInfo, OverlayState } from './dto.js';
export declare class OverlayWebSocketService {
    private io;
    private prisma;
    private connections;
    private bonusService;
    private triviaService;
    constructor(io: SocketIOServer, prisma: PrismaClient);
    private setupNamespace;
    private sendCurrentState;
    private updateLastActivity;
    getCurrentOverlayState(): Promise<OverlayState>;
    private getBonusOverlayState;
    private getTriviaOverlayState;
    broadcastBonusState(gameId: string): Promise<void>;
    broadcastBonusFinal(gameId: string): Promise<void>;
    broadcastTriviaState(gameId: string): Promise<void>;
    broadcastTriviaScores(gameId: string): Promise<void>;
    getConnectionCount(): number;
    getConnections(): OverlayConnectionInfo[];
    cleanupInactiveConnections(maxInactiveMinutes?: number): Promise<number>;
    sendToClient(socketId: string, event: string, data: any): Promise<void>;
    broadcast(event: string, data: any): Promise<void>;
}
//# sourceMappingURL=ws.d.ts.map
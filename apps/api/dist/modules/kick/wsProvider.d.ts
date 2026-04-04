import { EventEmitter } from 'events';
import { ChatProvider, ChatProviderConfig, KickMessage, KickRole } from './chatProvider.js';
export declare class WebSocketKickProvider extends EventEmitter implements ChatProvider {
    private config;
    private ws;
    private reconnectTimer;
    private reconnectAttempts;
    private isConnecting;
    private messageCallbacks;
    private userCache;
    constructor(config: ChatProviderConfig);
    connect(): Promise<void>;
    private establishConnection;
    private subscribeToChannel;
    private handleMessage;
    private processChatMessage;
    private processUserJoin;
    private processUserLeave;
    private mapKickRole;
    private scheduleReconnect;
    disconnect(): Promise<void>;
    sendMessage(message: string): Promise<void>;
    onMessage(callback: (message: KickMessage) => void): void;
    getUserRole(username: string): Promise<KickRole>;
    isConnected(): boolean;
}
export declare class MockKickProvider extends EventEmitter implements ChatProvider {
    private config;
    private messageCallbacks;
    private connected;
    private messageInterval;
    constructor(config: ChatProviderConfig);
    connect(): Promise<void>;
    private startMockMessages;
    disconnect(): Promise<void>;
    sendMessage(message: string): Promise<void>;
    onMessage(callback: (message: KickMessage) => void): void;
    getUserRole(username: string): Promise<KickRole>;
    isConnected(): boolean;
}
//# sourceMappingURL=wsProvider.d.ts.map
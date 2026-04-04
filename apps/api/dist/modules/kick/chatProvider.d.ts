export interface KickMessage {
    id: string;
    username: string;
    message: string;
    timestamp: Date;
    role: KickRole;
    isSubscriber: boolean;
    isModerator: boolean;
    isVip: boolean;
}
export interface KickUser {
    username: string;
    role: KickRole;
    isSubscriber: boolean;
    isModerator: boolean;
    isVip: boolean;
}
export declare enum KickRole {
    VIEWER = "viewer",
    SUBSCRIBER = "subscriber",
    VIP = "vip",
    MODERATOR = "moderator",
    BROADCASTER = "broadcaster"
}
export interface ChatProvider {
    connect(): Promise<void>;
    disconnect(): Promise<void>;
    sendMessage(message: string): Promise<void>;
    onMessage(callback: (message: KickMessage) => void): void;
    getUserRole(username: string): Promise<KickRole>;
    isConnected(): boolean;
}
export interface ChatProviderConfig {
    channel: string;
    wsUrl?: string;
    reconnectInterval?: number;
    maxReconnectAttempts?: number;
}
//# sourceMappingURL=chatProvider.d.ts.map
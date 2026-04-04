import { EventEmitter } from 'events';
import WebSocket from 'ws';
import { logger } from '../../telemetry/logger.js';
import { ChatProvider, ChatProviderConfig, KickMessage, KickRole, KickUser } from './chatProvider.js';

export class WebSocketKickProvider extends EventEmitter implements ChatProvider {
  private ws: WebSocket | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private reconnectAttempts = 0;
  private isConnecting = false;
  private messageCallbacks: ((message: KickMessage) => void)[] = [];
  private userCache = new Map<string, KickUser>();

  constructor(private config: ChatProviderConfig) {
    super();
  }

  async connect(): Promise<void> {
    if (this.isConnecting || this.isConnected()) {
      return;
    }

    this.isConnecting = true;
    this.reconnectAttempts = 0;

    try {
      await this.establishConnection();
      this.isConnecting = false;
      logger.info(`✅ Connected to Kick chat: ${this.config.channel}`);
    } catch (error) {
      this.isConnecting = false;
      logger.error('Failed to connect to Kick chat:', error);
      this.scheduleReconnect();
      throw error;
    }
  }

  private async establishConnection(): Promise<void> {
    return new Promise((resolve, reject) => {
      const wsUrl = this.config.wsUrl || `wss://ws-us2.pusher.app/app/eb1d5f283081a78b932f?protocol=7&client=js&version=7.4.0&flash=false`;

      this.ws = new WebSocket(wsUrl);

      const timeout = setTimeout(() => {
        this.ws?.close();
        reject(new Error('Connection timeout'));
      }, 10000);

      this.ws.on('open', () => {
        clearTimeout(timeout);
        this.reconnectAttempts = 0;

        // Subscribe to channel
        this.subscribeToChannel();
        resolve();
      });

      this.ws.on('message', (data) => {
        this.handleMessage(data.toString());
      });

      this.ws.on('close', (code, reason) => {
        clearTimeout(timeout);
        logger.warn(`Kick WebSocket closed: ${code} ${reason}`);
        this.scheduleReconnect();
      });

      this.ws.on('error', (error) => {
        clearTimeout(timeout);
        logger.error('Kick WebSocket error:', error);
        reject(error);
      });
    });
  }

  private subscribeToChannel(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }

    // Subscribe to Pusher channel for Kick chat
    const subscribeMessage = {
      event: 'pusher:subscribe',
      data: {
        channel: `chatrooms.${this.config.channel}.v2`,
      },
    };

    this.ws.send(JSON.stringify(subscribeMessage));
    logger.info(`Subscribed to Kick channel: ${this.config.channel}`);
  }

  private handleMessage(data: string): void {
    try {
      const message = JSON.parse(data);

      // Handle Pusher events
      if (message.event === 'pusher:connection_established') {
        logger.info('Pusher connection established');
        return;
      }

      if (message.event === 'pusher:subscription_succeeded') {
        logger.info(`Successfully subscribed to channel: ${message.channel}`);
        return;
      }

      // Handle chat messages
      if (message.event === 'App\\Events\\ChatMessageEvent') {
        this.processChatMessage(message.data);
      }

      // Handle user join/leave events
      if (message.event === 'App\\Events\\UserJoinedChannelEvent') {
        this.processUserJoin(message.data);
      }

      if (message.event === 'App\\Events\\UserLeftChannelEvent') {
        this.processUserLeave(message.data);
      }

    } catch (error) {
      logger.error('Failed to parse Kick message:', error);
    }
  }

  private processChatMessage(data: any): void {
    try {
      const kickMessage: KickMessage = {
        id: data.id || crypto.randomUUID(),
        username: data.sender?.username || 'unknown',
        message: data.content || '',
        timestamp: new Date(data.created_at || Date.now()),
        role: this.mapKickRole(data.sender?.role),
        isSubscriber: data.sender?.is_subscriber || false,
        isModerator: data.sender?.is_moderator || false,
        isVip: data.sender?.is_vip || false,
      };

      // Cache user info
      this.userCache.set(kickMessage.username.toLowerCase(), {
        username: kickMessage.username,
        role: kickMessage.role,
        isSubscriber: kickMessage.isSubscriber,
        isModerator: kickMessage.isModerator,
        isVip: kickMessage.isVip,
      });

      // Notify callbacks
      this.messageCallbacks.forEach(callback => {
        try {
          callback(kickMessage);
        } catch (error) {
          logger.error('Error in message callback:', error);
        }
      });

      // Emit event
      this.emit('message', kickMessage);

    } catch (error) {
      logger.error('Failed to process chat message:', error);
    }
  }

  private processUserJoin(data: any): void {
    logger.info(`User joined: ${data.user?.username}`);
  }

  private processUserLeave(data: any): void {
    logger.info(`User left: ${data.user?.username}`);
  }

  private mapKickRole(role: string): KickRole {
    switch (role?.toLowerCase()) {
      case 'broadcaster':
        return KickRole.BROADCASTER;
      case 'moderator':
        return KickRole.MODERATOR;
      case 'vip':
        return KickRole.VIP;
      case 'subscriber':
        return KickRole.SUBSCRIBER;
      default:
        return KickRole.VIEWER;
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    const maxAttempts = this.config.maxReconnectAttempts || 10;
    if (this.reconnectAttempts >= maxAttempts) {
      logger.error('Max reconnection attempts reached');
      return;
    }

    const interval = this.config.reconnectInterval || 5000;
    const delay = Math.min(interval * Math.pow(2, this.reconnectAttempts), 30000);

    this.reconnectTimer = setTimeout(() => {
      this.reconnectAttempts++;
      logger.info(`Attempting to reconnect to Kick chat (attempt ${this.reconnectAttempts})`);
      this.connect().catch(error => {
        logger.error('Reconnection failed:', error);
      });
    }, delay);
  }

  async disconnect(): Promise<void> {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.reconnectAttempts = 0;
    logger.info('Disconnected from Kick chat');
  }

  async sendMessage(message: string): Promise<void> {
    if (!this.isConnected()) {
      throw new Error('Not connected to Kick chat');
    }

    // Note: Sending messages to Kick chat typically requires authentication
    // and is usually done through their API, not WebSocket
    logger.warn('Sending messages via WebSocket is not supported by Kick');
    throw new Error('Sending messages via WebSocket is not supported');
  }

  onMessage(callback: (message: KickMessage) => void): void {
    this.messageCallbacks.push(callback);
  }

  async getUserRole(username: string): Promise<KickRole> {
    const cached = this.userCache.get(username.toLowerCase());
    if (cached) {
      return cached.role;
    }

    // If not cached, assume viewer
    return KickRole.VIEWER;
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}

// Mock provider for development/testing
export class MockKickProvider extends EventEmitter implements ChatProvider {
  private messageCallbacks: ((message: KickMessage) => void)[] = [];
  private connected = false;
  private messageInterval: NodeJS.Timeout | null = null;

  constructor(private config: ChatProviderConfig) {
    super();
  }

  async connect(): Promise<void> {
    this.connected = true;
    logger.info(`✅ Mock Kick provider connected to channel: ${this.config.channel}`);

    // Simulate some test messages
    this.startMockMessages();
  }

  private startMockMessages(): void {
    const testMessages = [
      { username: 'testuser1', message: '!guess 500', role: KickRole.VIEWER },
      { username: 'testuser2', message: '!guess 750', role: KickRole.SUBSCRIBER },
      { username: 'testuser3', message: 'Hello everyone!', role: KickRole.VIEWER },
      { username: 'testmod', message: 'Welcome to the stream!', role: KickRole.MODERATOR },
    ];

    let messageIndex = 0;
    this.messageInterval = setInterval(() => {
      if (!this.connected) return;

      const testMsg = testMessages[messageIndex % testMessages.length];
      const kickMessage: KickMessage = {
        id: crypto.randomUUID(),
        username: testMsg.username,
        message: testMsg.message,
        timestamp: new Date(),
        role: testMsg.role,
        isSubscriber: testMsg.role === KickRole.SUBSCRIBER,
        isModerator: testMsg.role === KickRole.MODERATOR,
        isVip: testMsg.role === KickRole.VIP,
      };

      this.messageCallbacks.forEach(callback => {
        try {
          callback(kickMessage);
        } catch (error) {
          logger.error('Error in mock message callback:', error);
        }
      });

      this.emit('message', kickMessage);
      messageIndex++;
    }, 10000); // Send a message every 10 seconds
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    if (this.messageInterval) {
      clearInterval(this.messageInterval);
      this.messageInterval = null;
    }
    logger.info('Mock Kick provider disconnected');
  }

  async sendMessage(message: string): Promise<void> {
    logger.info(`Mock Kick send: ${message}`);
  }

  onMessage(callback: (message: KickMessage) => void): void {
    this.messageCallbacks.push(callback);
  }

  async getUserRole(username: string): Promise<KickRole> {
    // Mock role mapping
    if (username.includes('mod')) return KickRole.MODERATOR;
    if (username.includes('vip')) return KickRole.VIP;
    if (username.includes('sub')) return KickRole.SUBSCRIBER;
    return KickRole.VIEWER;
  }

  isConnected(): boolean {
    return this.connected;
  }
}


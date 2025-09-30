import WebSocket from 'ws';
import { AuthService } from '../../auth/rbac.js';
import { getEnv } from '../../config/env.js';
import { logger } from '../../telemetry/logger.js';
import { RATE_LIMITS, RateLimiter } from '../../utils/rateLimit.js';
import { parseKickMessage } from '../../utils/regex.js';
import { BonusService } from '../games/bonus/bonusService.js';
import { TriviaService } from '../games/trivia/triviaService.js';
import { LinkService } from '../linking/linkService.js';
const env = getEnv();
export class KickChatProvider {
    authService;
    bonusService;
    triviaService;
    linkService;
    rateLimiter;
    ws = null;
    reconnectAttempts = 0;
    maxReconnectAttempts = 5;
    reconnectDelay = 1000;
    constructor(authService, bonusService, triviaService, linkService, rateLimiter) {
        this.authService = authService;
        this.bonusService = bonusService;
        this.triviaService = triviaService;
        this.linkService = linkService;
        this.rateLimiter = rateLimiter;
    }
    async connect() {
        return new Promise((resolve, reject) => {
            try {
                this.ws = new WebSocket(env.KICK_CHAT_WEBSOCKET_URL);
                this.ws.on('open', () => {
                    logger.info('Connected to Kick chat WebSocket');
                    this.reconnectAttempts = 0;
                    resolve();
                });
                this.ws.on('message', (data) => {
                    this.handleMessage(data.toString());
                });
                this.ws.on('close', (code, reason) => {
                    logger.warn('Kick chat WebSocket closed', { code, reason: reason.toString() });
                    this.handleReconnect();
                });
                this.ws.on('error', (error) => {
                    logger.error('Kick chat WebSocket error:', error);
                    reject(error);
                });
            }
            catch (error) {
                logger.error('Failed to connect to Kick chat:', error);
                reject(error);
            }
        });
    }
    handleMessage(data) {
        try {
            const message = JSON.parse(data);
            if (message.type === 'message' && message.data) {
                const kickMessage = {
                    type: 'message',
                    username: message.data.username,
                    message: message.data.message,
                    timestamp: new Date(),
                    isMod: message.data.isMod || false,
                    isSubscriber: message.data.isSubscriber || false,
                };
                this.processMessage(kickMessage);
            }
        }
        catch (error) {
            logger.error('Failed to parse Kick message:', error);
        }
    }
    async processMessage(kickMessage) {
        try {
            const parsed = parseKickMessage(kickMessage.message);
            if (parsed.type === 'unknown') {
                return;
            }
            // Authenticate user
            const authResult = await this.authService.authenticateKickUser(kickMessage.username);
            if (!authResult.isAuthenticated) {
                logger.warn('Failed to authenticate Kick user', { username: kickMessage.username });
                return;
            }
            const user = authResult.user;
            switch (parsed.type) {
                case 'guess':
                    await this.handleGuess(user.id, parsed.data.guess);
                    break;
                case 'link':
                    await this.handleLink(user.id, parsed.data.code);
                    break;
                case 'answer':
                    await this.handleAnswer(user.id, parsed.data.answer);
                    break;
            }
        }
        catch (error) {
            logger.error('Failed to process Kick message:', error);
        }
    }
    async handleGuess(userId, guess) {
        try {
            // Rate limiting
            await this.rateLimiter.consumeLimit(userId, RATE_LIMITS.GUESS_SUBMISSION);
            // Check if there's an active bonus hunt
            const activeGame = await this.bonusService.getActiveGame();
            if (!activeGame) {
                return; // No active game, ignore guess
            }
            // Submit guess
            await this.bonusService.submitGuess(activeGame.id, userId, guess);
            logger.info('Bonus hunt guess submitted', {
                userId,
                guess,
                gameId: activeGame.id,
            });
        }
        catch (error) {
            logger.error('Failed to handle guess:', error);
        }
    }
    async handleLink(userId, code) {
        try {
            // Rate limiting
            await this.rateLimiter.consumeLimit(userId, RATE_LIMITS.LINK_ATTEMPT);
            // Get user by Kick name (we need to find the user first)
            const user = await this.authService.getUserByKickName(userId);
            if (!user) {
                logger.warn('User not found for link attempt', { userId });
                return;
            }
            // Verify link code
            const success = await this.linkService.verifyLinkCode(code, userId);
            if (success) {
                logger.info('Account linked via Kick chat', { userId, code });
                // Could send a confirmation message to Kick chat here
            }
        }
        catch (error) {
            logger.error('Failed to handle link:', error);
        }
    }
    async handleAnswer(userId, answer) {
        try {
            // Rate limiting
            await this.rateLimiter.consumeLimit(userId, RATE_LIMITS.TRIVIA_ANSWER);
            // Check if there's an active trivia game
            const activeGame = await this.triviaService.getActiveGame();
            if (!activeGame) {
                return; // No active game, ignore answer
            }
            // Find the current open round
            const openRound = await this.triviaService.getCurrentOpenRound(activeGame.id);
            if (!openRound) {
                return; // No open round, ignore answer
            }
            // Submit answer
            await this.triviaService.submitAnswer(openRound.id, userId, answer);
            logger.info('Trivia answer submitted', {
                userId,
                answer,
                roundId: openRound.id,
            });
        }
        catch (error) {
            logger.error('Failed to handle answer:', error);
        }
    }
    handleReconnect() {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
            logger.info(`Attempting to reconnect to Kick chat in ${delay}ms`, {
                attempt: this.reconnectAttempts,
                maxAttempts: this.maxReconnectAttempts,
            });
            setTimeout(() => {
                this.connect().catch((error) => {
                    logger.error('Reconnection failed:', error);
                });
            }, delay);
        }
        else {
            logger.error('Max reconnection attempts reached for Kick chat');
        }
    }
    async sendMessage(message) {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            throw new Error('Kick chat WebSocket is not connected');
        }
        // This would need to be implemented based on Kick's API
        // For now, we'll just log the message
        logger.info('Sending message to Kick chat', { message });
    }
    async disconnect() {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
    }
}
//# sourceMappingURL=kickChat.js.map
import { logger } from '../../telemetry/logger.js';
import { parseAnswerCommand, parseGuessCommand, parseLinkCommand, sanitizeInput } from '../../utils/regex.js';
import { KickMessage, KickRole } from './chatProvider.js';

export interface ParsedCommand {
  type: 'guess' | 'link' | 'answer' | 'unknown';
  data?: any;
  originalMessage: string;
}

export function parseKickMessage(message: KickMessage): ParsedCommand {
  const sanitized = sanitizeInput(message.message);

  // Try to parse as guess command
  const guess = parseGuessCommand(sanitized);
  if (guess !== null) {
    return {
      type: 'guess',
      data: { guess },
      originalMessage: message.message,
    };
  }

  // Try to parse as link command
  const linkCode = parseLinkCommand(sanitized);
  if (linkCode !== null) {
    return {
      type: 'link',
      data: { code: linkCode },
      originalMessage: message.message,
    };
  }

  // Try to parse as answer command
  const answer = parseAnswerCommand(sanitized);
  if (answer !== null) {
    return {
      type: 'answer',
      data: { answer },
      originalMessage: message.message,
    };
  }

  // Check if it's a potential trivia answer (any message during open round)
  if (sanitized.length > 0 && sanitized.length <= 100) {
    return {
      type: 'answer',
      data: { answer: sanitized },
      originalMessage: message.message,
    };
  }

  return {
    type: 'unknown',
    originalMessage: message.message,
  };
}

export function validateKickMessage(message: KickMessage): boolean {
  // Basic validation
  if (!message.username || !message.message) {
    return false;
  }

  // Check username format
  if (!/^[a-zA-Z0-9_]{3,20}$/.test(message.username)) {
    logger.warn(`Invalid username format: ${message.username}`);
    return false;
  }

  // Check message length
  if (message.message.length > 1000) {
    logger.warn(`Message too long from ${message.username}: ${message.message.length} chars`);
    return false;
  }

  // Check for suspicious patterns
  const suspiciousPatterns = [
    /<script/i,
    /javascript:/i,
    /on\w+\s*=/i,
    /data:/i,
    /eval\(/i,
    /function\s*\(/i,
  ];

  for (const pattern of suspiciousPatterns) {
    if (pattern.test(message.message)) {
      logger.warn(`Suspicious message from ${message.username}: ${message.message}`);
      return false;
    }
  }

  return true;
}

export function extractUserInfo(message: KickMessage): {
  username: string;
  role: KickRole;
  isSubscriber: boolean;
  isModerator: boolean;
  isVip: boolean;
} {
  return {
    username: message.username.toLowerCase(),
    role: message.role,
    isSubscriber: message.isSubscriber,
    isModerator: message.isModerator,
    isVip: message.isVip,
  };
}

export function isModeratorOrAbove(role: KickRole): boolean {
  return [KickRole.MODERATOR, KickRole.BROADCASTER].includes(role);
}

export function isSubscriberOrAbove(role: KickRole): boolean {
  return [KickRole.SUBSCRIBER, KickRole.VIP, KickRole.MODERATOR, KickRole.BROADCASTER].includes(role);
}


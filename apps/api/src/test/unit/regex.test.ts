import { describe, expect, it } from 'vitest';
import {
    calculateLevenshteinDistance,
    isAnswerCorrect,
    normalizeAnswer,
    parseAnswerCommand,
    parseGuessCommand,
    parseLinkCommand,
    sanitizeInput
} from '../../utils/regex.js';

describe('Regex Utils', () => {
  describe('parseGuessCommand', () => {
    it('should parse valid guess commands', () => {
      expect(parseGuessCommand('!guess 500')).toBe(500);
      expect(parseGuessCommand('!GUESS 1000')).toBe(1000);
      expect(parseGuessCommand('!guess 1')).toBe(1);
      expect(parseGuessCommand('!guess 1000000')).toBe(1000000);
    });

    it('should reject invalid guess commands', () => {
      expect(parseGuessCommand('!guess 0')).toBeNull();
      expect(parseGuessCommand('!guess 1000001')).toBeNull();
      expect(parseGuessCommand('!guess abc')).toBeNull();
      expect(parseGuessCommand('!guess 1.5')).toBeNull();
      expect(parseGuessCommand('guess 500')).toBeNull();
      expect(parseGuessCommand('!guess')).toBeNull();
    });
  });

  describe('parseLinkCommand', () => {
    it('should parse valid link commands', () => {
      expect(parseLinkCommand('!link ABC123')).toBe('ABC123');
      expect(parseLinkCommand('!LINK xyz789')).toBe('XYZ789');
      expect(parseLinkCommand('!link 123456')).toBe('123456');
    });

    it('should reject invalid link commands', () => {
      expect(parseLinkCommand('!link ABC12')).toBeNull(); // Too short
      expect(parseLinkCommand('!link ABC1234')).toBeNull(); // Too long
      expect(parseLinkCommand('!link ABC-123')).toBeNull(); // Invalid character
      expect(parseLinkCommand('link ABC123')).toBeNull(); // Missing !
      expect(parseLinkCommand('!link')).toBeNull(); // Missing code
    });
  });

  describe('parseAnswerCommand', () => {
    it('should parse valid answer commands', () => {
      expect(parseAnswerCommand('!answer Paris')).toBe('Paris');
      expect(parseAnswerCommand('!ANSWER New York')).toBe('New York');
      expect(parseAnswerCommand('!answer 42')).toBe('42');
    });

    it('should reject invalid answer commands', () => {
      expect(parseAnswerCommand('!answer')).toBeNull(); // Missing answer
      expect(parseAnswerCommand('answer Paris')).toBeNull(); // Missing !
    });
  });

  describe('sanitizeInput', () => {
    it('should sanitize input correctly', () => {
      expect(sanitizeInput('  hello  world  ')).toBe('hello world');
      expect(sanitizeInput('hello\u200Bworld')).toBe('helloworld'); // Remove zero-width
      expect(sanitizeInput('hello\n\nworld')).toBe('hello world'); // Normalize whitespace
    });
  });

  describe('normalizeAnswer', () => {
    it('should normalize answers correctly', () => {
      expect(normalizeAnswer('Hello, World!')).toBe('hello world');
      expect(normalizeAnswer('What\'s up?')).toBe('whats up');
      expect(normalizeAnswer('  APPLE  ')).toBe('apple');
    });
  });

  describe('calculateLevenshteinDistance', () => {
    it('should calculate distance correctly', () => {
      expect(calculateLevenshteinDistance('apple', 'apple')).toBe(0);
      expect(calculateLevenshteinDistance('apple', 'aple')).toBe(1);
      expect(calculateLevenshteinDistance('apple', 'ap')).toBe(3);
      expect(calculateLevenshteinDistance('', 'apple')).toBe(5);
      expect(calculateLevenshteinDistance('apple', '')).toBe(5);
    });
  });

  describe('isAnswerCorrect', () => {
    it('should match exact answers', () => {
      expect(isAnswerCorrect('apple', 'apple')).toBe(true);
      expect(isAnswerCorrect('Apple', 'apple')).toBe(true);
      expect(isAnswerCorrect('APPLE', 'apple')).toBe(true);
    });

    it('should match fuzzy answers within distance', () => {
      expect(isAnswerCorrect('appl', 'apple')).toBe(true); // Distance 1
      expect(isAnswerCorrect('aple', 'apple')).toBe(true); // Distance 1
      expect(isAnswerCorrect('ap', 'apple')).toBe(false); // Distance 3
    });

    it('should handle punctuation and case', () => {
      expect(isAnswerCorrect('Hello, World!', 'hello world')).toBe(true);
      expect(isAnswerCorrect('What\'s up?', 'whats up')).toBe(true);
    });

    it('should reject incorrect answers', () => {
      expect(isAnswerCorrect('banana', 'apple')).toBe(false);
      expect(isAnswerCorrect('orange', 'apple')).toBe(false);
    });
  });
});


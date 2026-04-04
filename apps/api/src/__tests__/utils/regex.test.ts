import { describe, expect, it } from 'vitest';
import { isAnswerClose, normalizeAnswer, parseKickMessage } from '../../utils/regex.js';

describe('Regex Utils', () => {
  describe('parseKickMessage', () => {
    it('should parse guess commands', () => {
      const result = parseKickMessage('!guess 42');
      expect(result.type).toBe('guess');
      expect(result.data.guess).toBe(42);
    });

    it('should parse link commands', () => {
      const result = parseKickMessage('!link ABC12345');
      expect(result.type).toBe('link');
      expect(result.data.code).toBe('ABC12345');
    });

    it('should parse answer commands', () => {
      const result = parseKickMessage('!answer The capital of France');
      expect(result.type).toBe('answer');
      expect(result.data.answer).toBe('The capital of France');
    });

    it('should return unknown for invalid commands', () => {
      const result = parseKickMessage('Hello world');
      expect(result.type).toBe('unknown');
    });
  });

  describe('isAnswerClose', () => {
    it('should match exact answers', () => {
      expect(isAnswerClose('Paris', 'Paris')).toBe(true);
      expect(isAnswerClose('paris', 'Paris')).toBe(true);
      expect(isAnswerClose('PARIS', 'paris')).toBe(true);
    });

    it('should match similar answers', () => {
      expect(isAnswerClose('Pariss', 'Paris')).toBe(true);
      expect(isAnswerClose('Pari', 'Paris')).toBe(true);
      expect(isAnswerClose('Paris, France', 'Paris')).toBe(true);
    });

    it('should not match very different answers', () => {
      expect(isAnswerClose('London', 'Paris')).toBe(false);
      expect(isAnswerClose('Tokyo', 'Paris')).toBe(false);
    });
  });

  describe('normalizeAnswer', () => {
    it('should normalize answers correctly', () => {
      expect(normalizeAnswer('Paris, France!')).toBe('paris france');
      expect(normalizeAnswer('  PARIS  ')).toBe('paris');
      expect(normalizeAnswer('Paris-France')).toBe('paris france');
    });
  });
});


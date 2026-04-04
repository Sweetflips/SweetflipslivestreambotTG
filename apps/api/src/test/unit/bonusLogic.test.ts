import { describe, expect, it } from 'vitest';
import { BonusGameLogic } from '../../modules/games/bonus/bonusLogic.js';

describe('BonusGameLogic', () => {
  describe('validateGuess', () => {
    it('should validate correct guesses', () => {
      expect(BonusGameLogic.validateGuess(1)).toEqual({ valid: true });
      expect(BonusGameLogic.validateGuess(500000)).toEqual({ valid: true });
      expect(BonusGameLogic.validateGuess(1000000)).toEqual({ valid: true });
    });

    it('should reject invalid guesses', () => {
      expect(BonusGameLogic.validateGuess(0)).toEqual({
        valid: false,
        error: 'Guess must be at least 1'
      });
      expect(BonusGameLogic.validateGuess(1000001)).toEqual({
        valid: false,
        error: 'Guess must be at most 1,000,000'
      });
      expect(BonusGameLogic.validateGuess(1.5)).toEqual({
        valid: false,
        error: 'Guess must be a whole number'
      });
    });
  });

  describe('validateBonusName', () => {
    it('should validate correct bonus names', () => {
      expect(BonusGameLogic.validateBonusName('Mega Bonus')).toEqual({ valid: true });
      expect(BonusGameLogic.validateBonusName('A')).toEqual({ valid: true });
    });

    it('should reject invalid bonus names', () => {
      expect(BonusGameLogic.validateBonusName('')).toEqual({
        valid: false,
        error: 'Bonus name cannot be empty'
      });
      expect(BonusGameLogic.validateBonusName('A'.repeat(51))).toEqual({
        valid: false,
        error: 'Bonus name too long (max 50 characters)'
      });
    });
  });

  describe('calculateFinalPayout', () => {
    it('should calculate total payout correctly', () => {
      const payouts = [
        { amountX: 100, bonusName: 'Bonus 1' },
        { amountX: 200, bonusName: 'Bonus 2' },
        { amountX: 50, bonusName: 'Bonus 3' },
      ];

      expect(BonusGameLogic.calculateFinalPayout(payouts as any)).toBe(350);
    });

    it('should handle empty payouts', () => {
      expect(BonusGameLogic.calculateFinalPayout([])).toBe(0);
    });
  });

  describe('rankEntries', () => {
    it('should rank entries by delta and creation time', () => {
      const entries = [
        {
          id: '1',
          gameId: 'game1',
          userId: 'user1',
          guess: 100,
          createdAt: new Date('2023-01-01T10:00:00Z'),
          user: { id: 'user1', kickName: 'user1', telegramUser: null },
        },
        {
          id: '2',
          gameId: 'game1',
          userId: 'user2',
          guess: 200,
          createdAt: new Date('2023-01-01T09:00:00Z'),
          user: { id: 'user2', kickName: 'user2', telegramUser: null },
        },
        {
          id: '3',
          gameId: 'game1',
          userId: 'user3',
          guess: 150,
          createdAt: new Date('2023-01-01T11:00:00Z'),
          user: { id: 'user3', kickName: 'user3', telegramUser: null },
        },
      ];

      const finalPayout = 150;
      const ranked = BonusGameLogic.rankEntries(entries as any, finalPayout);

      expect(ranked).toHaveLength(3);
      expect(ranked[0].userId).toBe('user3'); // Exact match
      expect(ranked[0].rank).toBe(1);
      expect(ranked[1].userId).toBe('user2'); // Delta 50, earlier time
      expect(ranked[1].rank).toBe(2);
      expect(ranked[2].userId).toBe('user1'); // Delta 50, later time
      expect(ranked[2].rank).toBe(3);
    });
  });
});


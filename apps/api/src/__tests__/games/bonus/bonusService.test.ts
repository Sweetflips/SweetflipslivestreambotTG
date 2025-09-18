import { GameStatus, GameType, PrismaClient } from '@prisma/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { BonusService } from '../../../modules/games/bonus/bonusService.js';

describe('BonusService', () => {
  let prisma: PrismaClient;
  let bonusService: BonusService;

  beforeEach(async () => {
    prisma = new PrismaClient();
    bonusService = new BonusService(prisma);
  });

  afterEach(async () => {
    await prisma.$disconnect();
  });

  describe('startGame', () => {
    it('should create a new bonus hunt game', async () => {
      const game = await bonusService.startGame();

      expect(game.type).toBe(GameType.BONUS);
      expect(game.status).toBe(GameStatus.RUNNING);
      expect(game.startedAt).toBeDefined();
    });

    it('should throw error if game is already active', async () => {
      await bonusService.startGame();

      await expect(bonusService.startGame()).rejects.toThrow('A game is already active');
    });
  });

  describe('addBonus', () => {
    it('should add a bonus to the active game', async () => {
      const game = await bonusService.startGame();
      const bonus = await bonusService.addBonus('Test Bonus');

      expect(bonus.gameId).toBe(game.id);
      expect(bonus.name).toBe('Test Bonus');
      expect(bonus.amountX).toBe(0);
    });
  });

  describe('recordPayout', () => {
    it('should record a bonus payout', async () => {
      const game = await bonusService.startGame();
      await bonusService.addBonus('Test Bonus');

      const payout = await bonusService.recordPayout('Test Bonus', 5);

      expect(payout.gameId).toBe(game.id);
      expect(payout.name).toBe('Test Bonus');
      expect(payout.amountX).toBe(5);
    });
  });

  describe('closeGame', () => {
    it('should close the game and return results', async () => {
      const game = await bonusService.startGame();
      await bonusService.addBonus('Bonus 1');
      await bonusService.addBonus('Bonus 2');
      await bonusService.recordPayout('Bonus 1', 3);
      await bonusService.recordPayout('Bonus 2', 2);

      const result = await bonusService.closeGame();

      expect(result.game.status).toBe(GameStatus.COMPLETED);
      expect(result.totalPayout).toBe(5);
      expect(result.game.endedAt).toBeDefined();
    });
  });
});


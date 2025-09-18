import { GameStatus, GameType } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BonusService } from '../../modules/games/guess/bonusService.js';

// Mock Prisma client
const mockPrisma = {
  gameRound: {
    findFirst: vi.fn(),
  },
  bonusItem: {
    findFirst: vi.fn(),
    create: vi.fn(),
    delete: vi.fn(),
    update: vi.fn(),
    findMany: vi.fn(),
  },
  auditLog: {
    create: vi.fn(),
  },
} as any;

describe('BonusService', () => {
  let bonusService: BonusService;

  beforeEach(() => {
    vi.clearAllMocks();
    bonusService = new BonusService(mockPrisma);
  });

  describe('addBonusItem', () => {
    it('should add a new bonus item successfully', async () => {
      const mockRound = {
        id: 'round-1',
        type: GameType.GUESS_BONUS,
        phase: GameStatus.OPEN,
      };

      mockPrisma.gameRound.findFirst.mockResolvedValue(mockRound);
      mockPrisma.bonusItem.findFirst.mockResolvedValue(null);
      mockPrisma.bonusItem.create.mockResolvedValue({ id: 'item-1' });
      mockPrisma.auditLog.create.mockResolvedValue({ id: 'audit-1' });

      const result = await bonusService.addBonusItem('Wanted', 'user-1');

      expect(result).toContain('✅ Added bonus item: "Wanted"');
      expect(mockPrisma.bonusItem.create).toHaveBeenCalledWith({
        data: {
          gameRoundId: 'round-1',
          name: 'Wanted',
        },
      });
    });

    it('should reject duplicate bonus item', async () => {
      const mockRound = {
        id: 'round-1',
        type: GameType.GUESS_BONUS,
        phase: GameStatus.OPEN,
      };

      const mockExistingItem = {
        id: 'item-1',
        name: 'Wanted',
      };

      mockPrisma.gameRound.findFirst.mockResolvedValue(mockRound);
      mockPrisma.bonusItem.findFirst.mockResolvedValue(mockExistingItem);

      const result = await bonusService.addBonusItem('Wanted', 'user-1');

      expect(result).toContain('❌ Bonus item "Wanted" already exists');
    });
  });

  describe('removeBonusItem', () => {
    it('should remove bonus item successfully', async () => {
      const mockRound = {
        id: 'round-1',
        type: GameType.GUESS_BONUS,
        phase: GameStatus.OPEN,
      };

      const mockItem = {
        id: 'item-1',
        name: 'Wanted',
      };

      mockPrisma.gameRound.findFirst.mockResolvedValue(mockRound);
      mockPrisma.bonusItem.findFirst.mockResolvedValue(mockItem);
      mockPrisma.bonusItem.delete.mockResolvedValue(mockItem);
      mockPrisma.auditLog.create.mockResolvedValue({ id: 'audit-1' });

      const result = await bonusService.removeBonusItem('Wanted', 'user-1');

      expect(result).toContain('✅ Removed bonus item: "Wanted"');
      expect(mockPrisma.bonusItem.delete).toHaveBeenCalledWith({
        where: { id: 'item-1' },
      });
    });

    it('should reject removal of non-existent item', async () => {
      const mockRound = {
        id: 'round-1',
        type: GameType.GUESS_BONUS,
        phase: GameStatus.OPEN,
      };

      mockPrisma.gameRound.findFirst.mockResolvedValue(mockRound);
      mockPrisma.bonusItem.findFirst.mockResolvedValue(null);

      const result = await bonusService.removeBonusItem('NonExistent', 'user-1');

      expect(result).toContain('❌ Bonus item "NonExistent" not found');
    });
  });

  describe('recordPayout', () => {
    it('should record payout successfully', async () => {
      const mockRound = {
        id: 'round-1',
        type: GameType.GUESS_BONUS,
        phase: GameStatus.OPEN,
      };

      const mockItem = {
        id: 'item-1',
        name: 'Wanted',
      };

      mockPrisma.gameRound.findFirst.mockResolvedValue(mockRound);
      mockPrisma.bonusItem.findFirst.mockResolvedValue(mockItem);
      mockPrisma.bonusItem.update.mockResolvedValue({ ...mockItem, payoutX: 150 });
      mockPrisma.auditLog.create.mockResolvedValue({ id: 'audit-1' });

      const result = await bonusService.recordPayout('Wanted', 150, 'user-1');

      expect(result).toContain('✅ Recorded payout for "Wanted": 150x');
      expect(mockPrisma.bonusItem.update).toHaveBeenCalledWith({
        where: { id: 'item-1' },
        data: { payoutX: 150 },
      });
    });

    it('should reject negative payout', async () => {
      const result = await bonusService.recordPayout('Wanted', -50, 'user-1');

      expect(result).toContain('❌ Payout must be a positive number');
    });
  });

  describe('finalizeBonusTotal', () => {
    it('should finalize bonus total successfully', async () => {
      const mockRound = {
        id: 'round-1',
        type: GameType.GUESS_BONUS,
        phase: GameStatus.OPEN,
      };

      const mockItems = [
        { id: 'item-1', name: 'Wanted', payoutX: 150 },
        { id: 'item-2', name: 'Gates', payoutX: 200 },
        { id: 'item-3', name: 'Mystery', payoutX: 100 },
      ];

      mockPrisma.gameRound.findFirst.mockResolvedValue(mockRound);
      mockPrisma.bonusItem.findMany.mockResolvedValue(mockItems);
      mockPrisma.gameRound.update.mockResolvedValue({ ...mockRound, finalValue: 450 });
      mockPrisma.auditLog.create.mockResolvedValue({ id: 'audit-1' });

      const result = await bonusService.finalizeBonusTotal('user-1');

      expect(result).toContain('✅ **Bonus Total Finalized:** 450x');
      expect(result).toContain('Based on 3 bonus items');
      expect(mockPrisma.gameRound.update).toHaveBeenCalledWith({
        where: { id: 'round-1' },
        data: {
          finalValue: 450,
          updatedAt: expect.any(Date),
        },
      });
    });

    it('should reject finalization with no items', async () => {
      const mockRound = {
        id: 'round-1',
        type: GameType.GUESS_BONUS,
        phase: GameStatus.OPEN,
      };

      mockPrisma.gameRound.findFirst.mockResolvedValue(mockRound);
      mockPrisma.bonusItem.findMany.mockResolvedValue([]);

      const result = await bonusService.finalizeBonusTotal('user-1');

      expect(result).toContain('❌ No bonus items to finalize');
    });

    it('should reject finalization with no payouts', async () => {
      const mockRound = {
        id: 'round-1',
        type: GameType.GUESS_BONUS,
        phase: GameStatus.OPEN,
      };

      const mockItems = [
        { id: 'item-1', name: 'Wanted', payoutX: null },
        { id: 'item-2', name: 'Gates', payoutX: null },
      ];

      mockPrisma.gameRound.findFirst.mockResolvedValue(mockRound);
      mockPrisma.bonusItem.findMany.mockResolvedValue(mockItems);

      const result = await bonusService.finalizeBonusTotal('user-1');

      expect(result).toContain('❌ Cannot finalize: no payouts recorded');
    });
  });

  describe('getBonusSummary', () => {
    it('should return correct bonus summary', async () => {
      const mockRound = {
        id: 'round-1',
        type: GameType.GUESS_BONUS,
        phase: GameStatus.OPEN,
        finalValue: 450,
      };

      const mockItems = [
        { id: 'item-1', name: 'Wanted', payoutX: 150, createdAt: new Date('2024-01-01T10:00:00Z') },
        { id: 'item-2', name: 'Gates', payoutX: 200, createdAt: new Date('2024-01-01T10:01:00Z') },
        {
          id: 'item-3',
          name: 'Mystery',
          payoutX: 100,
          createdAt: new Date('2024-01-01T10:02:00Z'),
        },
      ];

      mockPrisma.gameRound.findFirst.mockResolvedValue(mockRound);
      mockPrisma.bonusItem.findMany.mockResolvedValue(mockItems);

      const summary = await bonusService.getBonusSummary();

      expect(summary.items).toHaveLength(3);
      expect(summary.totalPayoutX).toBe(450);
      expect(summary.finalized).toBe(true);
      expect(summary.items[0].name).toBe('Wanted');
      expect(summary.items[0].payoutX).toBe(150);
    });
  });
});

import { GameType, Role } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GuessCommands } from '../../modules/games/guess/guessCommands.js';

// Mock Prisma client
const mockPrisma = {
  user: {
    findUnique: vi.fn(),
  },
  auditLog: {
    create: vi.fn(),
  },
} as any;

// Mock services
const mockGuessService = {
  submitGuess: vi.fn(),
  isAdmin: vi.fn(),
  isOwner: vi.fn(),
} as any;

const mockBonusService = {
  addBonusItem: vi.fn(),
  removeBonusItem: vi.fn(),
  listBonusItems: vi.fn(),
  recordPayout: vi.fn(),
  finalizeBonusTotal: vi.fn(),
} as any;

// Mock Telegram context
const createMockContext = (userId: string, text: string) =>
  ({
    from: { id: parseInt(userId) },
    message: { text },
    reply: vi.fn(),
  } as any);

describe('GuessCommands Integration', () => {
  let guessCommands: GuessCommands;

  beforeEach(() => {
    vi.clearAllMocks();
    guessCommands = new GuessCommands(mockPrisma, mockGuessService, mockBonusService);
  });

  describe('handleGtBalance', () => {
    it('should handle balance guess successfully', async () => {
      const ctx = createMockContext('123456789', '/gtbalance 50000');
      const mockUser = {
        id: 'user-1',
        telegramId: '123456789',
        kickName: 'testuser',
        role: Role.VIEWER,
      };

      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockGuessService.submitGuess.mockResolvedValue({
        success: true,
        message: '✅ Saved *50000*. You can edit once within 30s with /gtbalance again.',
      });

      await guessCommands.handleGtBalance(ctx, ['50000']);

      expect(mockGuessService.submitGuess).toHaveBeenCalledWith(
        'user-1',
        GameType.GUESS_BALANCE,
        50000
      );
      expect(ctx.reply).toHaveBeenCalledWith(
        '✅ Saved *50000*. You can edit once within 30s with /gtbalance again.',
        { parse_mode: 'Markdown' }
      );
    });

    it('should reject guess from unlinked user', async () => {
      const ctx = createMockContext('123456789', '/gtbalance 50000');
      const mockUser = {
        id: 'user-1',
        telegramId: '123456789',
        kickName: null, // Not linked
        role: Role.VIEWER,
      };

      mockPrisma.user.findUnique.mockResolvedValue(mockUser);

      await guessCommands.handleGtBalance(ctx, ['50000']);

      expect(ctx.reply).toHaveBeenCalledWith(
        expect.stringContaining('🔗 **Account Linking Required**'),
        { parse_mode: 'Markdown' }
      );
      expect(mockGuessService.submitGuess).not.toHaveBeenCalled();
    });

    it('should prompt for input when no number provided', async () => {
      const ctx = createMockContext('123456789', '/gtbalance');
      const mockUser = {
        id: 'user-1',
        telegramId: '123456789',
        kickName: 'testuser',
        role: Role.VIEWER,
      };

      mockPrisma.user.findUnique.mockResolvedValue(mockUser);

      await guessCommands.handleGtBalance(ctx, []);

      expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('🎯 **Guess the Balance**'), {
        parse_mode: 'Markdown',
      });
      expect(mockGuessService.submitGuess).not.toHaveBeenCalled();
    });

    it('should reject invalid number', async () => {
      const ctx = createMockContext('123456789', '/gtbalance abc');
      const mockUser = {
        id: 'user-1',
        telegramId: '123456789',
        kickName: 'testuser',
        role: Role.VIEWER,
      };

      mockPrisma.user.findUnique.mockResolvedValue(mockUser);

      await guessCommands.handleGtBalance(ctx, ['abc']);

      expect(ctx.reply).toHaveBeenCalledWith('❌ Please provide a valid number.');
      expect(mockGuessService.submitGuess).not.toHaveBeenCalled();
    });
  });

  describe('handleBalanceAdmin', () => {
    it('should allow admin to open balance game', async () => {
      const ctx = createMockContext('123456789', '/balance open');
      const mockUser = {
        id: 'user-1',
        telegramId: '123456789',
        role: Role.MOD,
      };

      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockGuessService.isAdmin.mockResolvedValue(true);
      mockGuessService.openRound = vi.fn().mockResolvedValue('✅ *Balance* guesses are OPEN.');

      await guessCommands.handleBalanceAdmin(ctx, ['open']);

      expect(mockGuessService.openRound).toHaveBeenCalledWith(GameType.GUESS_BALANCE, 'user-1');
      expect(ctx.reply).toHaveBeenCalledWith('✅ *Balance* guesses are OPEN.', {
        parse_mode: 'Markdown',
      });
    });

    it('should reject non-admin access', async () => {
      const ctx = createMockContext('123456789', '/balance open');
      const mockUser = {
        id: 'user-1',
        telegramId: '123456789',
        role: Role.VIEWER,
      };

      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockGuessService.isAdmin.mockResolvedValue(false);
      mockPrisma.auditLog.create.mockResolvedValue({ id: 'audit-1' });

      await guessCommands.handleBalanceAdmin(ctx, ['open']);

      expect(ctx.reply).toHaveBeenCalledWith('⛔️ Mods only.');
      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
        data: {
          userId: '123456789',
          command: 'unauthorized_balance_admin',
          params: JSON.stringify({ args: ['open'], attemptedBy: '123456789' }),
        },
      });
    });

    it('should require CONFIRM for reset command', async () => {
      const ctx = createMockContext('123456789', '/balance reset');
      const mockUser = {
        id: 'user-1',
        telegramId: '123456789',
        role: Role.OWNER,
      };

      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockGuessService.isAdmin.mockResolvedValue(true);
      mockGuessService.isOwner.mockResolvedValue(true);

      await guessCommands.handleBalanceAdmin(ctx, ['reset']);

      expect(ctx.reply).toHaveBeenCalledWith(
        expect.stringContaining('⚠️ **Reset Confirmation Required**'),
        { parse_mode: 'Markdown' }
      );
    });

    it('should execute reset with CONFIRM', async () => {
      const ctx = createMockContext('123456789', '/balance reset CONFIRM');
      const mockUser = {
        id: 'user-1',
        telegramId: '123456789',
        role: Role.OWNER,
      };

      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockGuessService.isAdmin.mockResolvedValue(true);
      mockGuessService.isOwner.mockResolvedValue(true);
      mockGuessService.resetRound = vi.fn().mockResolvedValue('✅ Balance game reset.');

      await guessCommands.handleBalanceAdmin(ctx, ['reset', 'CONFIRM']);

      expect(mockGuessService.resetRound).toHaveBeenCalledWith(GameType.GUESS_BALANCE, 'user-1');
      expect(ctx.reply).toHaveBeenCalledWith('✅ Balance game reset.', { parse_mode: 'Markdown' });
    });
  });

  describe('handleBonusAdmin', () => {
    it('should allow admin to add bonus item', async () => {
      const ctx = createMockContext('123456789', '/bonus add Wanted');
      const mockUser = {
        id: 'user-1',
        telegramId: '123456789',
        role: Role.MOD,
      };

      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockGuessService.isAdmin.mockResolvedValue(true);
      mockBonusService.addBonusItem.mockResolvedValue('✅ Added bonus item: "Wanted"');

      await guessCommands.handleBonusAdmin(ctx, ['add', 'Wanted']);

      expect(mockBonusService.addBonusItem).toHaveBeenCalledWith('Wanted', 'user-1');
      expect(ctx.reply).toHaveBeenCalledWith('✅ Added bonus item: "Wanted"', {
        parse_mode: 'Markdown',
      });
    });

    it('should allow admin to record payout', async () => {
      const ctx = createMockContext('123456789', '/bonus payout Wanted 150');
      const mockUser = {
        id: 'user-1',
        telegramId: '123456789',
        role: Role.MOD,
      };

      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockGuessService.isAdmin.mockResolvedValue(true);
      mockBonusService.recordPayout.mockResolvedValue('✅ Recorded payout for "Wanted": 150x');

      await guessCommands.handleBonusAdmin(ctx, ['payout', 'Wanted', '150']);

      expect(mockBonusService.recordPayout).toHaveBeenCalledWith('Wanted', 150, 'user-1');
      expect(ctx.reply).toHaveBeenCalledWith('✅ Recorded payout for "Wanted": 150x', {
        parse_mode: 'Markdown',
      });
    });

    it('should allow admin to finalize bonus total', async () => {
      const ctx = createMockContext('123456789', '/bonus finalize');
      const mockUser = {
        id: 'user-1',
        telegramId: '123456789',
        role: Role.MOD,
      };

      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockGuessService.isAdmin.mockResolvedValue(true);
      mockBonusService.finalizeBonusTotal.mockResolvedValue('✅ **Bonus Total Finalized:** 450x');

      await guessCommands.handleBonusAdmin(ctx, ['finalize']);

      expect(mockBonusService.finalizeBonusTotal).toHaveBeenCalledWith('user-1');
      expect(ctx.reply).toHaveBeenCalledWith('✅ **Bonus Total Finalized:** 450x', {
        parse_mode: 'Markdown',
      });
    });
  });

  describe('handleGameAdmin', () => {
    it('should handle game open command', async () => {
      const ctx = createMockContext('123456789', '/game open balance');
      const mockUser = {
        id: 'user-1',
        telegramId: '123456789',
        role: Role.MOD,
      };

      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockGuessService.isAdmin.mockResolvedValue(true);
      mockGuessService.openRound = vi.fn().mockResolvedValue('✅ *Balance* guesses are OPEN.');

      await guessCommands.handleGameAdmin(ctx, ['open', 'balance']);

      expect(mockGuessService.openRound).toHaveBeenCalledWith(GameType.GUESS_BALANCE, 'user-1');
      expect(ctx.reply).toHaveBeenCalledWith('✅ *Balance* guesses are OPEN.', {
        parse_mode: 'Markdown',
      });
    });

    it('should reject invalid game type', async () => {
      const ctx = createMockContext('123456789', '/game open invalid');
      const mockUser = {
        id: 'user-1',
        telegramId: '123456789',
        role: Role.MOD,
      };

      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockGuessService.isAdmin.mockResolvedValue(true);

      await guessCommands.handleGameAdmin(ctx, ['open', 'invalid']);

      expect(ctx.reply).toHaveBeenCalledWith('❌ Game type must be "bonus" or "balance".');
    });
  });
});

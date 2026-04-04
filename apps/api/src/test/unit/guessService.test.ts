import { GameStatus, GameType, Role } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GuessService } from '../../modules/games/guess/guessService.js';

// Mock Prisma client
const mockPrisma = {
  gameRound: {
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  guess: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
    deleteMany: vi.fn(),
  },
  bonusItem: {
    deleteMany: vi.fn(),
  },
  auditLog: {
    create: vi.fn(),
  },
  user: {
    findUnique: vi.fn(),
  },
} as any;

describe('GuessService', () => {
  let guessService: GuessService;

  beforeEach(() => {
    vi.clearAllMocks();
    guessService = new GuessService(mockPrisma);
  });

  describe('submitGuess', () => {
    it('should accept first guess when game is open', async () => {
      const mockRound = {
        id: 'round-1',
        type: GameType.GUESS_BALANCE,
        phase: GameStatus.OPEN,
        minRange: 1,
        maxRange: 1000000,
        graceWindow: 30,
      };

      mockPrisma.gameRound.findFirst.mockResolvedValue(mockRound);
      mockPrisma.guess.findUnique.mockResolvedValue(null);
      mockPrisma.guess.create.mockResolvedValue({ id: 'guess-1' });

      const result = await guessService.submitGuess('user-1', GameType.GUESS_BALANCE, 50000);

      expect(result.success).toBe(true);
      expect(result.message).toContain('✅ Saved *50000*');
      expect(mockPrisma.guess.create).toHaveBeenCalledWith({
        data: {
          gameRoundId: 'round-1',
          userId: 'user-1',
          value: 50000,
        },
      });
    });

    it('should reject guess when game is closed', async () => {
      const mockRound = {
        id: 'round-1',
        type: GameType.GUESS_BALANCE,
        phase: GameStatus.CLOSED,
        minRange: 1,
        maxRange: 1000000,
        graceWindow: 30,
      };

      mockPrisma.gameRound.findFirst.mockResolvedValue(mockRound);

      const result = await guessService.submitGuess('user-1', GameType.GUESS_BALANCE, 50000);

      expect(result.success).toBe(false);
      expect(result.message).toContain('⛔️ Guessing is closed');
    });

    it('should reject guess outside valid range', async () => {
      const mockRound = {
        id: 'round-1',
        type: GameType.GUESS_BALANCE,
        phase: GameStatus.OPEN,
        minRange: 1,
        maxRange: 1000000,
        graceWindow: 30,
      };

      mockPrisma.gameRound.findFirst.mockResolvedValue(mockRound);

      const result = await guessService.submitGuess('user-1', GameType.GUESS_BALANCE, 2000000);

      expect(result.success).toBe(false);
      expect(result.message).toContain('❌ Guess must be between 1 and 1000000');
    });

    it('should allow edit within grace window', async () => {
      const mockRound = {
        id: 'round-1',
        type: GameType.GUESS_BALANCE,
        phase: GameStatus.OPEN,
        minRange: 1,
        maxRange: 1000000,
        graceWindow: 30,
      };

      const mockExistingGuess = {
        id: 'guess-1',
        createdAt: new Date(Date.now() - 10000), // 10 seconds ago
        value: 50000,
      };

      mockPrisma.gameRound.findFirst.mockResolvedValue(mockRound);
      mockPrisma.guess.findUnique.mockResolvedValue(mockExistingGuess);
      mockPrisma.guess.update.mockResolvedValue({ id: 'guess-1' });

      const result = await guessService.submitGuess('user-1', GameType.GUESS_BALANCE, 75000, true);

      expect(result.success).toBe(true);
      expect(result.message).toContain('✏️ Updated to *75000*');
      expect(result.isEdit).toBe(true);
      expect(mockPrisma.guess.update).toHaveBeenCalledWith({
        where: { id: 'guess-1' },
        data: {
          value: 75000,
          editedAt: expect.any(Date),
        },
      });
    });

    it('should reject edit outside grace window', async () => {
      const mockRound = {
        id: 'round-1',
        type: GameType.GUESS_BALANCE,
        phase: GameStatus.OPEN,
        minRange: 1,
        maxRange: 1000000,
        graceWindow: 30,
      };

      const mockExistingGuess = {
        id: 'guess-1',
        createdAt: new Date(Date.now() - 60000), // 60 seconds ago (outside grace window)
        value: 50000,
      };

      mockPrisma.gameRound.findFirst.mockResolvedValue(mockRound);
      mockPrisma.guess.findUnique.mockResolvedValue(mockExistingGuess);

      const result = await guessService.submitGuess('user-1', GameType.GUESS_BALANCE, 75000, true);

      expect(result.success).toBe(false);
      expect(result.message).toContain('⛔️ Edit window has expired');
    });

    it('should reject duplicate guess value from different user', async () => {
      const mockRound = {
        id: 'round-1',
        type: GameType.GUESS_BALANCE,
        phase: GameStatus.OPEN,
        minRange: 1,
        maxRange: 1000000,
        graceWindow: 30,
      };

      const mockExistingGuess = {
        id: 'guess-2',
        gameRoundId: 'round-1',
        value: 50000,
        userId: 'user-2',
      };

      mockPrisma.gameRound.findFirst.mockResolvedValue(mockRound);
      mockPrisma.guess.findUnique.mockResolvedValue(null); // User hasn't guessed yet
      mockPrisma.guess.findFirst.mockResolvedValue(mockExistingGuess); // But value is taken

      const result = await guessService.submitGuess('user-1', GameType.GUESS_BALANCE, 50000);

      expect(result.success).toBe(false);
      expect(result.message).toContain('⛔️ This guess has already been submitted by another player');
      expect(mockPrisma.guess.create).not.toHaveBeenCalled();
    });

    it('should reject edit to duplicate guess value from different user', async () => {
      const mockRound = {
        id: 'round-1',
        type: GameType.GUESS_BALANCE,
        phase: GameStatus.OPEN,
        minRange: 1,
        maxRange: 1000000,
        graceWindow: 30,
      };

      const mockExistingGuess = {
        id: 'guess-1',
        createdAt: new Date(Date.now() - 10000), // 10 seconds ago (within grace window)
        value: 50000,
      };

      const mockDuplicateGuess = {
        id: 'guess-2',
        gameRoundId: 'round-1',
        value: 75000,
        userId: 'user-2',
      };

      mockPrisma.gameRound.findFirst.mockResolvedValue(mockRound);
      mockPrisma.guess.findUnique.mockResolvedValue(mockExistingGuess);
      mockPrisma.guess.findFirst.mockResolvedValue(mockDuplicateGuess);

      const result = await guessService.submitGuess('user-1', GameType.GUESS_BALANCE, 75000, true);

      expect(result.success).toBe(false);
      expect(result.message).toContain('⛔️ This guess has already been submitted by another player');
      expect(mockPrisma.guess.update).not.toHaveBeenCalled();
    });

    it('should allow edit to same value (no change)', async () => {
      const mockRound = {
        id: 'round-1',
        type: GameType.GUESS_BALANCE,
        phase: GameStatus.OPEN,
        minRange: 1,
        maxRange: 1000000,
        graceWindow: 30,
      };

      const mockExistingGuess = {
        id: 'guess-1',
        createdAt: new Date(Date.now() - 10000), // 10 seconds ago (within grace window)
        value: 50000,
      };

      mockPrisma.gameRound.findFirst.mockResolvedValue(mockRound);
      mockPrisma.guess.findUnique.mockResolvedValue(mockExistingGuess);
      mockPrisma.guess.findFirst.mockResolvedValue(null); // No duplicate found (same user's guess)
      mockPrisma.guess.update.mockResolvedValue({ id: 'guess-1' });

      const result = await guessService.submitGuess('user-1', GameType.GUESS_BALANCE, 50000, true);

      expect(result.success).toBe(true);
      expect(result.message).toContain('✏️ Updated to *50000*');
      expect(mockPrisma.guess.update).toHaveBeenCalled();
    });
  });

  describe('openRound', () => {
    it('should open a round successfully', async () => {
      const mockRound = {
        id: 'round-1',
        type: GameType.GUESS_BALANCE,
        phase: GameStatus.IDLE,
        windowMin: 0,
      };

      mockPrisma.gameRound.findFirst.mockResolvedValue(mockRound);
      mockPrisma.gameRound.update.mockResolvedValue(mockRound);
      mockPrisma.auditLog.create.mockResolvedValue({ id: 'audit-1' });

      const result = await guessService.openRound(GameType.GUESS_BALANCE, 'user-1');

      expect(result).toContain('✅ *Balance* guesses are OPEN');
      expect(mockPrisma.gameRound.update).toHaveBeenCalledWith({
        where: { id: 'round-1' },
        data: {
          phase: GameStatus.OPEN,
          updatedAt: expect.any(Date),
        },
      });
    });

    it('should return already open message when round is already open', async () => {
      const mockRound = {
        id: 'round-1',
        type: GameType.GUESS_BALANCE,
        phase: GameStatus.OPEN,
        windowMin: 0,
      };

      mockPrisma.gameRound.findFirst.mockResolvedValue(mockRound);

      const result = await guessService.openRound(GameType.GUESS_BALANCE, 'user-1');

      expect(result).toContain('already OPEN');
    });
  });

  describe('getLeaderboard', () => {
    it('should calculate correct leaderboard with deltas', async () => {
      const mockRound = {
        id: 'round-1',
        type: GameType.GUESS_BALANCE,
        finalValue: 100000,
      };

      const mockGuesses = [
        {
          userId: 'user-1',
          value: 95000,
          createdAt: new Date('2024-01-01T10:00:00Z'),
          user: { telegramUser: 'user1', kickName: 'kick1' },
        },
        {
          userId: 'user-2',
          value: 105000,
          createdAt: new Date('2024-01-01T10:01:00Z'),
          user: { telegramUser: 'user2', kickName: 'kick2' },
        },
        {
          userId: 'user-3',
          value: 100000,
          createdAt: new Date('2024-01-01T10:02:00Z'),
          user: { telegramUser: 'user3', kickName: 'kick3' },
        },
      ];

      mockPrisma.gameRound.findFirst.mockResolvedValue(mockRound);
      mockPrisma.guess.findMany.mockResolvedValue(mockGuesses);

      const leaderboard = await guessService.getLeaderboard(GameType.GUESS_BALANCE, 3);

      expect(leaderboard).toHaveLength(3);
      expect(leaderboard[0].rank).toBe(1);
      expect(leaderboard[0].isExact).toBe(true); // Exact guess should be first
      expect(leaderboard[0].delta).toBe(0);
      expect(leaderboard[1].delta).toBe(5000); // 105000 - 100000
      expect(leaderboard[2].delta).toBe(5000); // 100000 - 95000
    });
  });

  describe('isAdmin', () => {
    it('should return true for MOD role', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ role: Role.MOD });

      const result = await guessService.isAdmin('user-1');

      expect(result).toBe(true);
    });

    it('should return true for OWNER role', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ role: Role.OWNER });

      const result = await guessService.isAdmin('user-1');

      expect(result).toBe(true);
    });

    it('should return false for VIEWER role', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ role: Role.VIEWER });

      const result = await guessService.isAdmin('user-1');

      expect(result).toBe(false);
    });

    it('should return false for non-existent user', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const result = await guessService.isAdmin('user-1');

      expect(result).toBe(false);
    });
  });
});

import { PrismaClient, Role } from '@prisma/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AuthService, hasRole, requireRole } from '../../auth/rbac.js';

describe('RBAC', () => {
  let prisma: PrismaClient;
  let authService: AuthService;

  beforeEach(async () => {
    prisma = new PrismaClient();
    authService = new AuthService(prisma);
  });

  afterEach(async () => {
    await prisma.$disconnect();
  });

  describe('hasRole', () => {
    it('should return true for same role', () => {
      expect(hasRole(Role.VIEWER, Role.VIEWER)).toBe(true);
      expect(hasRole(Role.MOD, Role.MOD)).toBe(true);
      expect(hasRole(Role.OWNER, Role.OWNER)).toBe(true);
    });

    it('should return true for higher role', () => {
      expect(hasRole(Role.MOD, Role.VIEWER)).toBe(true);
      expect(hasRole(Role.OWNER, Role.VIEWER)).toBe(true);
      expect(hasRole(Role.OWNER, Role.MOD)).toBe(true);
    });

    it('should return false for lower role', () => {
      expect(hasRole(Role.VIEWER, Role.MOD)).toBe(false);
      expect(hasRole(Role.VIEWER, Role.OWNER)).toBe(false);
      expect(hasRole(Role.MOD, Role.OWNER)).toBe(false);
    });
  });

  describe('requireRole', () => {
    it('should not throw for sufficient role', () => {
      expect(() => requireRole(Role.VIEWER)(Role.VIEWER)).not.toThrow();
      expect(() => requireRole(Role.VIEWER)(Role.MOD)).not.toThrow();
      expect(() => requireRole(Role.VIEWER)(Role.OWNER)).not.toThrow();
    });

    it('should throw for insufficient role', () => {
      expect(() => requireRole(Role.MOD)(Role.VIEWER)).toThrow();
      expect(() => requireRole(Role.OWNER)(Role.VIEWER)).toThrow();
      expect(() => requireRole(Role.OWNER)(Role.MOD)).toThrow();
    });
  });

  describe('AuthService', () => {
    it('should create a new user with VIEWER role', async () => {
      const user = await authService.createOrUpdateUser({
        telegramId: '123456789',
        telegramUser: 'testuser',
      });

      expect(user.role).toBe(Role.VIEWER);
      expect(user.telegramId).toBe('123456789');
    });

    it('should update existing user', async () => {
      const user1 = await authService.createOrUpdateUser({
        telegramId: '123456789',
        telegramUser: 'testuser',
      });

      const user2 = await authService.createOrUpdateUser({
        telegramId: '123456789',
        kickName: 'testkick',
        role: Role.MOD,
      });

      expect(user1.id).toBe(user2.id);
      expect(user2.kickName).toBe('testkick');
      expect(user2.role).toBe(Role.MOD);
    });
  });
});


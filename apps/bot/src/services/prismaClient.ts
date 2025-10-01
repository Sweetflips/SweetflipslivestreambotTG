import { prisma } from '../lib/prisma.js';

export const createPrismaClient = () => {
  return prisma;
};

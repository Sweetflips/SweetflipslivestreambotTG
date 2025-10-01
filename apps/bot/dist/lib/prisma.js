import { PrismaClient } from '@prisma/client';
const createPrismaClient = () => {
    return new PrismaClient({
        log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
        errorFormat: 'pretty',
    });
};
export const prisma = globalThis.__prisma ?? createPrismaClient();
if (process.env.NODE_ENV !== 'production') {
    globalThis.__prisma = prisma;
}
export default prisma;

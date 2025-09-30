import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll } from 'vitest';
const prisma = new PrismaClient({
    datasources: {
        db: {
            url: process.env.TEST_DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/sweetflips_test',
        },
    },
});
beforeAll(async () => {
    // Clean up test database
    await prisma.$executeRaw `TRUNCATE TABLE "users", "games", "bonus_entries", "bonus_payouts", "trivia_rounds", "trivia_answers", "scores", "awards", "link_codes" RESTART IDENTITY CASCADE`;
});
afterAll(async () => {
    await prisma.$disconnect();
});
export { prisma };
//# sourceMappingURL=setup.js.map
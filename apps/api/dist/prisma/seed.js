import { PrismaClient, Role } from '@prisma/client';
import { logger } from '../telemetry/logger.js';
const prisma = new PrismaClient();
async function main() {
    logger.info('Starting database seed...');
    // Create owner user if not exists
    const owner = await prisma.user.upsert({
        where: { telegramId: '123456789' }, // Replace with actual owner Telegram ID
        update: {},
        create: {
            telegramId: '123456789',
            telegramUser: 'owner',
            role: Role.OWNER,
            linkedAt: new Date(),
        },
    });
    logger.info('Database seeded successfully', { ownerId: owner.id });
}
main()
    .catch((e) => {
    logger.error('Seed failed:', e);
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
});
//# sourceMappingURL=seed.js.map
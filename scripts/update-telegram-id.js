const { PrismaClient } = require("@prisma/client");

async function updateTelegramId() {
  const telegramId = process.argv[2];

  if (!telegramId) {
    console.log("Usage: node update-telegram-id.js <your_telegram_id>");
    console.log("Example: node update-telegram-id.js 7638759103");
    process.exit(1);
  }

  try {
    const prisma = new PrismaClient();

    // Find user with placeholder ID
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { telegramId: "PLACEHOLDER_ID" },
          { telegramUser: { contains: "sweetflipsnick", mode: "insensitive" } },
        ],
      },
    });

    if (user) {
      const updatedUser = await prisma.user.update({
        where: { telegramId: user.telegramId },
        data: { telegramId: telegramId },
      });

      console.log(`✅ Updated Telegram ID for ${updatedUser.telegramUser}`);
      console.log(`New ID: ${updatedUser.telegramId}`);
      console.log(`Role: ${updatedUser.role}`);
    } else {
      console.log("❌ User not found");
    }
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await prisma.$disconnect();
  }
}

updateTelegramId();

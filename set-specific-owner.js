const { PrismaClient } = require("@prisma/client");

async function setSpecificOwner() {
  const telegramId = process.argv[2];

  if (!telegramId) {
    console.log("Usage: node set-specific-owner.js <telegram_id>");
    console.log("Example: node set-specific-owner.js 123456789");
    process.exit(1);
  }

  try {
    const prisma = new PrismaClient();

    // Find user by Telegram ID
    const user = await prisma.user.findUnique({
      where: { telegramId: telegramId },
    });

    if (!user) {
      console.log(`❌ User with Telegram ID ${telegramId} not found.`);
      console.log("Make sure the user has sent /start to the bot first.");
      return;
    }

    // Update to OWNER
    const updatedUser = await prisma.user.update({
      where: { telegramId: telegramId },
      data: { role: "OWNER" },
    });

    console.log(
      `🎉 Successfully set ${updatedUser.telegramUser || "Unknown"} as OWNER!`
    );
    console.log(`Telegram ID: ${updatedUser.telegramId}`);
    console.log(`Role: ${updatedUser.role}`);
    console.log(`Kick: ${updatedUser.kickName || "Not linked"}`);

    await prisma.$disconnect();
  } catch (error) {
    console.error("❌ Error:", error.message);
  }
}

setSpecificOwner();

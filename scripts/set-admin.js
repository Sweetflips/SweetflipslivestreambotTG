const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function setAdmin() {
  try {
    // Get the Telegram ID from command line arguments
    const telegramId = process.argv[2];
    const role = process.argv[3] || "MOD"; // Default to MOD, can be MOD or OWNER

    if (!telegramId) {
      console.log("Usage: node set-admin.js <telegram_id> [MOD|OWNER]");
      console.log("Example: node set-admin.js 123456789 MOD");
      console.log("Example: node set-admin.js 123456789 OWNER");
      process.exit(1);
    }

    if (!["MOD", "OWNER"].includes(role)) {
      console.log("Role must be either MOD or OWNER");
      process.exit(1);
    }

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { telegramId },
    });

    if (!existingUser) {
      console.log(`❌ User with Telegram ID ${telegramId} not found.`);
      console.log("Make sure the user has used /start or /kick command first.");
      process.exit(1);
    }

    // Update user role
    const updatedUser = await prisma.user.update({
      where: { telegramId },
      data: { role },
    });

    console.log(`✅ Successfully set user role to ${role}`);
    console.log(
      `User: ${updatedUser.telegramUser || "Unknown"} (${
        updatedUser.telegramId
      })`
    );
    console.log(`Kick: ${updatedUser.kickName || "Not linked"}`);
    console.log(`Role: ${updatedUser.role}`);
  } catch (error) {
    console.error("Error setting admin:", error);
  } finally {
    await prisma.$disconnect();
  }
}

setAdmin();

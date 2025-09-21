const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function createFirstAdmin() {
  try {
    // Get the Telegram ID from command line arguments
    const telegramId = process.argv[2];
    const telegramUser = process.argv[3] || "admin";

    if (!telegramId) {
      console.log(
        "Usage: node create-first-admin.js <telegram_id> [telegram_username]"
      );
      console.log("Example: node create-first-admin.js 123456789 sweetflips");
      process.exit(1);
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { telegramId },
    });

    if (existingUser) {
      // Update existing user to OWNER
      const updatedUser = await prisma.user.update({
        where: { telegramId },
        data: {
          role: "OWNER",
          telegramUser: telegramUser,
        },
      });

      console.log(`✅ Updated existing user to OWNER`);
      console.log(
        `User: ${updatedUser.telegramUser} (${updatedUser.telegramId})`
      );
      console.log(`Role: ${updatedUser.role}`);
    } else {
      // Create new OWNER user
      const newUser = await prisma.user.create({
        data: {
          telegramId,
          telegramUser,
          role: "OWNER",
          linkedAt: new Date(),
        },
      });

      console.log(`✅ Created new OWNER user`);
      console.log(`User: ${newUser.telegramUser} (${newUser.telegramId})`);
      console.log(`Role: ${newUser.role}`);
    }

    console.log("\n🎉 You can now use the bot with OWNER privileges!");
    console.log("Available OWNER commands:");
    console.log("- /setrole <telegram_id> <MOD|OWNER>");
    console.log("- /listusers");
    console.log("- All MOD commands");
  } catch (error) {
    console.error("Error creating admin:", error);
  } finally {
    await prisma.$disconnect();
  }
}

createFirstAdmin();

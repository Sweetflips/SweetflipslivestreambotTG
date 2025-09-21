const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function findAndSetOwner() {
  try {
    console.log("🔍 Looking for user with username: sweetflipsnick");

    // Try to find user by telegram username
    const user = await prisma.user.findFirst({
      where: {
        telegramUser: {
          contains: "sweetflipsnick",
          mode: "insensitive",
        },
      },
    });

    if (user) {
      console.log(`✅ Found user: ${user.telegramUser} (${user.telegramId})`);
      console.log(`Current role: ${user.role}`);

      // Update to OWNER
      const updatedUser = await prisma.user.update({
        where: { telegramId: user.telegramId },
        data: { role: "OWNER" },
      });

      console.log(`🎉 Successfully set ${updatedUser.telegramUser} as OWNER!`);
      console.log(`Telegram ID: ${updatedUser.telegramId}`);
      console.log(`Role: ${updatedUser.role}`);
    } else {
      console.log(
        '❌ User not found with username containing "sweetflipsnick"'
      );
      console.log("\n📋 Current users in database:");

      const allUsers = await prisma.user.findMany({
        select: {
          telegramId: true,
          telegramUser: true,
          role: true,
        },
      });

      if (allUsers.length === 0) {
        console.log("No users found. You need to interact with the bot first.");
        console.log(
          "Send /start or /kick to your bot, then run this script again."
        );
      } else {
        allUsers.forEach((u, index) => {
          console.log(
            `${index + 1}) ${u.telegramUser || "Unknown"} (${u.telegramId}): ${
              u.role
            }`
          );
        });
      }
    }
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await prisma.$disconnect();
  }
}

findAndSetOwner();

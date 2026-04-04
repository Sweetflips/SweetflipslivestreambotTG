const { PrismaClient } = require("@prisma/client");

async function setOwner() {
  console.log("🚀 Setting up SweetflipsStreamBot Owner...\n");

  try {
    const prisma = new PrismaClient();

    // Get all users
    const users = await prisma.user.findMany();
    console.log(`📋 Found ${users.length} users in database:`);

    if (users.length === 0) {
      console.log("❌ No users found. You need to message your bot first!");
      console.log("Send /start to your bot, then run this script again.");
      return;
    }

    // Show all users
    users.forEach((user, index) => {
      const roleEmoji =
        user.role === "OWNER" ? "👑" : user.role === "MOD" ? "🛡️" : "👤";
      console.log(
        `${index + 1}) ${roleEmoji} ${user.telegramUser || "Unknown"} (${
          user.telegramId
        }): ${user.role}`
      );
    });

    // Find user with sweetflipsnick or similar
    const targetUser = users.find(
      (user) =>
        user.telegramUser &&
        (user.telegramUser.toLowerCase().includes("sweetflips") ||
          user.telegramUser.toLowerCase().includes("nick"))
    );

    if (targetUser) {
      console.log(
        `\n🎯 Found target user: ${targetUser.telegramUser} (${targetUser.telegramId})`
      );

      // Update to OWNER
      const updatedUser = await prisma.user.update({
        where: { telegramId: targetUser.telegramId },
        data: { role: "OWNER" },
      });

      console.log(`🎉 Successfully set ${updatedUser.telegramUser} as OWNER!`);
      console.log(`Telegram ID: ${updatedUser.telegramId}`);
      console.log(`Role: ${updatedUser.role}`);
    } else {
      console.log(
        '\n❌ No user found with "sweetflips" or "nick" in username.'
      );
      console.log("Available users:");
      users.forEach((user, index) => {
        console.log(
          `${index + 1}) ${user.telegramUser || "Unknown"} (${user.telegramId})`
        );
      });
      console.log("\nTo set a specific user as owner, run:");
      console.log("node set-specific-owner.js <telegram_id>");
    }

    await prisma.$disconnect();
  } catch (error) {
    console.error("❌ Error:", error.message);
  }
}

setOwner();

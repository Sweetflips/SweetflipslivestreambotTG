const { PrismaClient } = require("@prisma/client");

// Simple setup script for making sweetflipsnick an owner
async function setupOwner() {
  console.log("🚀 Setting up SweetflipsStreamBot Owner...\n");

  try {
    const prisma = new PrismaClient();

    // Check if user exists
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { telegramUser: { contains: "sweetflipsnick", mode: "insensitive" } },
          { telegramUser: { contains: "sweetflips", mode: "insensitive" } },
        ],
      },
    });

    if (existingUser) {
      console.log(
        `✅ Found user: ${existingUser.telegramUser} (${existingUser.telegramId})`
      );

      // Update to OWNER
      const updatedUser = await prisma.user.update({
        where: { telegramId: existingUser.telegramId },
        data: { role: "OWNER" },
      });

      console.log(`🎉 Successfully set ${updatedUser.telegramUser} as OWNER!`);
      console.log(`Telegram ID: ${updatedUser.telegramId}`);
      console.log(`Role: ${updatedUser.role}`);
    } else {
      console.log("❌ User not found. Creating new OWNER user...");

      // Create new user with a placeholder ID (you'll need to update this)
      const newUser = await prisma.user.create({
        data: {
          telegramId: "PLACEHOLDER_ID", // You need to replace this
          telegramUser: "sweetflipsnick",
          role: "OWNER",
          linkedAt: new Date(),
        },
      });

      console.log(`✅ Created new OWNER user: ${newUser.telegramUser}`);
      console.log(`⚠️  IMPORTANT: You need to update the Telegram ID!`);
      console.log(`Run: node update-telegram-id.js YOUR_ACTUAL_TELEGRAM_ID`);
    }

    // Show all users
    console.log("\n📋 All users in database:");
    const allUsers = await prisma.user.findMany();
    allUsers.forEach((user, index) => {
      const roleEmoji =
        user.role === "OWNER" ? "👑" : user.role === "MOD" ? "🛡️" : "👤";
      console.log(
        `${index + 1}) ${roleEmoji} ${user.telegramUser || "Unknown"} (${
          user.telegramId
        }): ${user.role}`
      );
    });
  } catch (error) {
    console.error("❌ Error:", error.message);

    if (error.message.includes("DATABASE_URL")) {
      console.log("\n💡 You need to set up your environment variables first!");
      console.log("1. Create apps/api/.env file");
      console.log("2. Add your DATABASE_URL and other required variables");
      console.log("3. Start your database (PostgreSQL + Redis)");
      console.log("4. Run: npx prisma db push");
    }
  } finally {
    try {
      await prisma.$disconnect();
    } catch (e) {
      // Ignore disconnect errors
    }
  }
}

setupOwner();

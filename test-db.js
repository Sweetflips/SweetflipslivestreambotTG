const { PrismaClient } = require('@prisma/client');

async function testDatabase() {
  console.log('🔍 Testing database connection...');
  
  try {
    const prisma = new PrismaClient();
    
    const users = await prisma.user.findMany();
    console.log(`✅ Database connected! Found ${users.length} users:`);
    
    if (users.length === 0) {
      console.log('📝 No users found. You need to message your bot first!');
      console.log('Send /start or /kick to your bot, then run this script again.');
    } else {
      users.forEach((user, index) => {
        const roleEmoji = user.role === 'OWNER' ? '👑' : user.role === 'MOD' ? '🛡️' : '👤';
        console.log(`${index + 1}) ${roleEmoji} ${user.telegramUser || 'Unknown'} (${user.telegramId}): ${user.role}`);
      });
    }
    
    await prisma.$disconnect();
  } catch (error) {
    console.error('❌ Database error:', error.message);
    
    if (error.message.includes('DATABASE_URL')) {
      console.log('\n💡 You need to set up your environment variables!');
      console.log('Create apps/api/.env file with your DATABASE_URL');
    }
  }
}

testDatabase();

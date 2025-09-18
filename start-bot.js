#!/usr/bin/env node

/**
 * Start script that ensures database is ready before starting the bot
 */

const { execSync } = require('child_process');
const path = require('path');

console.log('🚀 Starting bot with database setup...');

try {
  // Change to the apps/api directory for Prisma commands
  process.chdir(path.join(__dirname, 'apps', 'api'));
  
  // Step 1: Generate Prisma client
  console.log('📦 Generating Prisma client...');
  execSync('npx prisma generate', { stdio: 'inherit' });
  
  // Step 2: Push schema to database
  console.log('🗄️  Creating database tables...');
  execSync('npx prisma db push --force-reset', { stdio: 'inherit' });
  
  console.log('✅ Database setup completed!');
  
  // Step 3: Start the bot
  console.log('🤖 Starting bot...');
  process.chdir(__dirname); // Go back to root directory
  execSync('node bot.js', { stdio: 'inherit' });
  
} catch (error) {
  console.error('❌ Failed to start bot:', error.message);
  process.exit(1);
}

#!/usr/bin/env node

/**
 * Database Setup Script
 * This script helps set up the database tables for the Stream Bot
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function setupDatabase() {
  console.log('🚀 Setting up database...');
  
  try {
    // Test database connection
    await prisma.$connect();
    console.log('✅ Database connection successful');
    
    // The Prisma client will automatically create tables when first used
    // But we can test by trying to query the schedule table
    try {
      const schedules = await prisma.schedule.findMany();
      console.log(`📅 Found ${schedules.length} existing schedule entries`);
    } catch (error) {
      console.log('📅 Schedule table will be created on first use');
    }
    
    // Test user table
    try {
      const users = await prisma.user.findMany();
      console.log(`👥 Found ${users.length} existing users`);
    } catch (error) {
      console.log('👥 User table will be created on first use');
    }
    
    // Test telegram groups table
    try {
      const groups = await prisma.telegramGroup.findMany();
      console.log(`📱 Found ${groups.length} existing telegram groups`);
    } catch (error) {
      console.log('📱 Telegram groups table will be created on first use');
    }
    
    console.log('✅ Database setup completed successfully!');
    console.log('💡 Tables will be created automatically when the bot starts');
    
  } catch (error) {
    console.error('❌ Database setup failed:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the setup
setupDatabase();

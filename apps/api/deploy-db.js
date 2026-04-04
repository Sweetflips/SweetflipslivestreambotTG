#!/usr/bin/env node

/**
 * Database deployment script for Railway
 * This script will:
 * 1. Generate Prisma client
 * 2. Run database migrations
 * 3. Seed the database if needed
 */

import { PrismaClient } from '@prisma/client';
import { execSync } from 'child_process';
import { config } from 'dotenv';

// Load environment variables
config();

const prisma = new PrismaClient();

async function deployDatabase() {
  console.log('🚀 Starting database deployment...');

  try {
    // Step 1: Generate Prisma client
    console.log('📦 Generating Prisma client...');
    execSync('npx prisma generate', { stdio: 'inherit' });

    // Step 2: Run database migrations
    console.log('🗄️  Running database migrations...');
    try {
      execSync('npx prisma migrate deploy', { stdio: 'inherit' });
      console.log('✅ Migrations completed successfully');
    } catch (migrationError) {
      console.log('⚠️  Migration failed, trying to reset and migrate...');
      try {
        execSync('npx prisma migrate reset --force', { stdio: 'inherit' });
        console.log('✅ Database reset and migrated successfully');
      } catch (resetError) {
        console.error('❌ Failed to reset and migrate database:', resetError.message);
        throw resetError;
      }
    }

    // Step 3: Test database connection
    console.log('🔍 Testing database connection...');
    await prisma.$connect();
    console.log('✅ Database connection successful');

    // Step 4: Check if tables exist
    console.log('📋 Checking database tables...');
    const tables = await prisma.$queryRaw`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
    `;

    console.log('📊 Found tables:', tables);

    // Step 5: Seed database if needed
    console.log('🌱 Seeding database...');
    try {
      execSync('npm run prisma:seed', { stdio: 'inherit' });
      console.log('✅ Database seeded successfully');
    } catch (seedError) {
      console.log('⚠️  Seeding failed or not configured:', seedError.message);
    }

    console.log('🎉 Database deployment completed successfully!');
  } catch (error) {
    console.error('❌ Database deployment failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the deployment
deployDatabase();

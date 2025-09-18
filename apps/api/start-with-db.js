#!/usr/bin/env node

/**
 * Startup script that ensures database is ready before starting the app
 * This will be used as the main entry point in Railway
 */

import { execSync } from 'child_process';
import { config } from 'dotenv';

// Load environment variables
config();

async function startApp() {
  console.log('🚀 Starting application with database setup...');

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
        // Don't exit, try to continue anyway
        console.log('⚠️  Continuing without database migration...');
      }
    }

    // Step 3: Start the main application
    console.log('🎯 Starting main application...');
    execSync('npm start', { stdio: 'inherit' });
  } catch (error) {
    console.error('❌ Application startup failed:', error);
    process.exit(1);
  }
}

// Run the startup
startApp();

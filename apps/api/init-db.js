#!/usr/bin/env node

/**
 * Simple database initialization script
 * This will create all tables from the Prisma schema
 */

import { execSync } from 'child_process';
import { config } from 'dotenv';

// Load environment variables
config();

console.log('🚀 Initializing database...');

try {
  // Step 1: Generate Prisma client
  console.log('📦 Generating Prisma client...');
  execSync('npx prisma generate', { stdio: 'inherit' });

  // Step 2: Push schema to database (creates tables)
  console.log('🗄️  Creating database tables...');
  execSync('npx prisma db push --force-reset', { stdio: 'inherit' });

  console.log('✅ Database initialized successfully!');
  console.log('📊 Tables created:');

  // Step 3: Show created tables
  try {
    execSync('npx prisma db seed', { stdio: 'inherit' });
    console.log('🌱 Database seeded successfully!');
  } catch (seedError) {
    console.log('⚠️  Seeding skipped (not configured)');
  }
} catch (error) {
  console.error('❌ Database initialization failed:', error.message);
  process.exit(1);
}

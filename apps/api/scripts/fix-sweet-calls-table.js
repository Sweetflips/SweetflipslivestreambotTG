#!/usr/bin/env node

import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const prisma = new PrismaClient();

async function runMigration() {
  try {
    console.log('🔧 Running migration to fix sweet_calls_rounds table...');
    
    // Read the migration SQL file
    const migrationPath = join(__dirname, '../prisma/migrations/001_add_missing_columns_to_sweet_calls_rounds.sql');
    const migrationSQL = readFileSync(migrationPath, 'utf8');
    
    // Execute the migration
    await prisma.$executeRawUnsafe(migrationSQL);
    
    console.log('✅ Migration completed successfully!');
    
    // Verify the table structure
    console.log('🔍 Verifying table structure...');
    const result = await prisma.$queryRaw`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'sweet_calls_rounds' 
      ORDER BY ordinal_position;
    `;
    
    console.log('📋 Current table structure:');
    console.table(result);
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

runMigration().catch((error) => {
  console.error('❌ Script failed:', error);
  process.exit(1);
});

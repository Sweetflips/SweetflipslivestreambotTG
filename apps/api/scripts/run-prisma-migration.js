#!/usr/bin/env node

import { PrismaClient } from '@prisma/client';
import { logger } from '../src/telemetry/logger.js';

const prisma = new PrismaClient();

async function runMigration() {
  try {
    logger.info('🔧 Running Prisma migration to fix sweet_calls_rounds table...');
    
    // First, check if the table exists and what columns it has
    const tableInfo = await prisma.$queryRaw`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'sweet_calls_rounds' 
      ORDER BY ordinal_position;
    `;
    
    logger.info('📋 Current table structure:', tableInfo);
    
    // Check if we need to add missing columns
    const columns = tableInfo.map(col => col.column_name);
    const missingColumns = [];
    
    if (!columns.includes('createdAt')) missingColumns.push('createdAt');
    if (!columns.includes('closedAt')) missingColumns.push('closedAt');
    if (!columns.includes('revealedAt')) missingColumns.push('revealedAt');
    if (!columns.includes('updatedAt')) missingColumns.push('updatedAt');
    
    if (missingColumns.length > 0) {
      logger.info(`🔧 Adding missing columns: ${missingColumns.join(', ')}`);
      
      // Use Prisma's db push to sync the schema
      logger.info('🔄 Syncing database schema with Prisma...');
      
      // This will create the missing columns according to the Prisma schema
      await prisma.$executeRaw`
        -- Add createdAt column if it doesn't exist
        DO $$ 
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                           WHERE table_name = 'sweet_calls_rounds' 
                           AND column_name = 'createdAt') THEN
                ALTER TABLE sweet_calls_rounds ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
            END IF;
        END $$;
      `;
      
      await prisma.$executeRaw`
        -- Add closedAt column if it doesn't exist
        DO $$ 
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                           WHERE table_name = 'sweet_calls_rounds' 
                           AND column_name = 'closedAt') THEN
                ALTER TABLE sweet_calls_rounds ADD COLUMN "closedAt" TIMESTAMP(3);
            END IF;
        END $$;
      `;
      
      await prisma.$executeRaw`
        -- Add revealedAt column if it doesn't exist
        DO $$ 
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                           WHERE table_name = 'sweet_calls_rounds' 
                           AND column_name = 'revealedAt') THEN
                ALTER TABLE sweet_calls_rounds ADD COLUMN "revealedAt" TIMESTAMP(3);
            END IF;
        END $$;
      `;
      
      await prisma.$executeRaw`
        -- Add updatedAt column if it doesn't exist
        DO $$ 
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                           WHERE table_name = 'sweet_calls_rounds' 
                           AND column_name = 'updatedAt') THEN
                ALTER TABLE sweet_calls_rounds ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
            END IF;
        END $$;
      `;
      
      // Create trigger for updatedAt
      await prisma.$executeRaw`
        CREATE OR REPLACE FUNCTION update_updated_at_column()
        RETURNS TRIGGER AS $$
        BEGIN
            NEW."updatedAt" = CURRENT_TIMESTAMP;
            RETURN NEW;
        END;
        $$ language 'plpgsql';
      `;
      
      await prisma.$executeRaw`
        DROP TRIGGER IF EXISTS update_sweet_calls_rounds_updated_at ON sweet_calls_rounds;
        CREATE TRIGGER update_sweet_calls_rounds_updated_at
            BEFORE UPDATE ON sweet_calls_rounds
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column();
      `;
      
      logger.info('✅ Migration completed successfully!');
    } else {
      logger.info('✅ All required columns already exist');
    }
    
    // Verify the final table structure
    const finalTableInfo = await prisma.$queryRaw`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'sweet_calls_rounds' 
      ORDER BY ordinal_position;
    `;
    
    logger.info('📋 Final table structure:', finalTableInfo);
    
    // Test Prisma ORM access
    logger.info('🧪 Testing Prisma ORM access...');
    const testResult = await prisma.sweetCallsRound.findFirst();
    logger.info('✅ Prisma ORM access working correctly');
    
  } catch (error) {
    logger.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

runMigration().catch((error) => {
  logger.error('❌ Script failed:', error);
  process.exit(1);
});

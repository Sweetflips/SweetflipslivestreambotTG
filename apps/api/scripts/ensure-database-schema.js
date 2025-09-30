#!/usr/bin/env node

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function ensureDatabaseSchema() {
  try {
    console.log('🔧 Ensuring database schema is up to date...');
    
    // Test basic connection
    await prisma.$queryRaw`SELECT 1`;
    console.log('✅ Database connection successful');
    
    // Check if sweet_calls_rounds table exists
    const tableExists = await prisma.$queryRaw`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'sweet_calls_rounds'
      );
    `;
    
    if (!tableExists[0].exists) {
      console.log('❌ sweet_calls_rounds table does not exist');
      console.log('🔄 Running Prisma db push to create tables...');
      process.exit(1);
    }
    
    console.log('✅ sweet_calls_rounds table exists');
    
    // Check current table structure
    const columns = await prisma.$queryRaw`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'sweet_calls_rounds' 
      ORDER BY ordinal_position;
    `;
    
    console.log('📋 Current table structure:', columns.map(c => c.column_name));
    
    // Check for missing columns
    const columnNames = columns.map(c => c.column_name);
    const requiredColumns = ['id', 'phase', 'createdAt', 'closedAt', 'revealedAt', 'updatedAt'];
    const missingColumns = requiredColumns.filter(col => !columnNames.includes(col));
    
    if (missingColumns.length > 0) {
      console.log(`🔧 Adding missing columns: ${missingColumns.join(', ')}`);
      
      // Add missing columns one by one
      for (const column of missingColumns) {
        try {
          switch (column) {
            case 'createdAt':
              await prisma.$executeRaw`
                ALTER TABLE sweet_calls_rounds 
                ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
              `;
              break;
            case 'closedAt':
              await prisma.$executeRaw`
                ALTER TABLE sweet_calls_rounds 
                ADD COLUMN IF NOT EXISTS "closedAt" TIMESTAMP(3);
              `;
              break;
            case 'revealedAt':
              await prisma.$executeRaw`
                ALTER TABLE sweet_calls_rounds 
                ADD COLUMN IF NOT EXISTS "revealedAt" TIMESTAMP(3);
              `;
              break;
            case 'updatedAt':
              await prisma.$executeRaw`
                ALTER TABLE sweet_calls_rounds 
                ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
              `;
              break;
          }
          console.log(`✅ Added column: ${column}`);
        } catch (error) {
          console.error(`❌ Failed to add column ${column}:`, error.message);
        }
      }
      
      // Create trigger for updatedAt
      try {
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
        
        console.log('✅ Created updatedAt trigger');
      } catch (error) {
        console.error('❌ Failed to create trigger:', error.message);
      }
      
    } else {
      console.log('✅ All required columns exist');
    }
    
    // Test Prisma ORM access
    console.log('🧪 Testing Prisma ORM access...');
    try {
      await prisma.sweetCallsRound.findFirst();
      console.log('✅ Prisma ORM access working correctly');
    } catch (error) {
      console.error('❌ Prisma ORM access failed:', error.message);
      throw error;
    }
    
    console.log('🎉 Database schema is ready!');
    
  } catch (error) {
    console.error('❌ Database schema check failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  ensureDatabaseSchema().catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });
}

export { ensureDatabaseSchema };

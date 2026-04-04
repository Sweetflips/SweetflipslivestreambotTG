#!/usr/bin/env node

/**
 * Railway Database Fix Script
 * This script fixes the SweetCallsRound schema issue on Railway
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixRailwayDatabase() {
  console.log('🚀 Railway Database Fix Script');
  console.log('================================');
  
  try {
    // Test connection
    await prisma.$queryRaw`SELECT 1`;
    console.log('✅ Database connection successful');
    
    // Check if table exists
    const tableExists = await prisma.$queryRaw`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'sweet_calls_rounds'
      );
    `;
    
    if (!tableExists[0].exists) {
      console.log('❌ sweet_calls_rounds table does not exist');
      console.log('🔄 This should not happen - table should exist');
      process.exit(1);
    }
    
    // Check current columns
    const columns = await prisma.$queryRaw`
      SELECT column_name
      FROM information_schema.columns 
      WHERE table_name = 'sweet_calls_rounds' 
      ORDER BY ordinal_position;
    `;
    
    const columnNames = columns.map(c => c.column_name);
    console.log('📋 Current columns:', columnNames);
    
    // Add missing columns
    const missingColumns = [];
    
    if (!columnNames.includes('createdAt')) {
      missingColumns.push('createdAt');
    }
    if (!columnNames.includes('closedAt')) {
      missingColumns.push('closedAt');
    }
    if (!columnNames.includes('revealedAt')) {
      missingColumns.push('revealedAt');
    }
    if (!columnNames.includes('updatedAt')) {
      missingColumns.push('updatedAt');
    }
    
    if (missingColumns.length > 0) {
      console.log(`🔧 Adding missing columns: ${missingColumns.join(', ')}`);
      
      for (const column of missingColumns) {
        try {
          if (column === 'createdAt') {
            await prisma.$executeRaw`
              ALTER TABLE sweet_calls_rounds 
              ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
            `;
          } else if (column === 'closedAt') {
            await prisma.$executeRaw`
              ALTER TABLE sweet_calls_rounds 
              ADD COLUMN IF NOT EXISTS "closedAt" TIMESTAMP(3);
            `;
          } else if (column === 'revealedAt') {
            await prisma.$executeRaw`
              ALTER TABLE sweet_calls_rounds 
              ADD COLUMN IF NOT EXISTS "revealedAt" TIMESTAMP(3);
            `;
          } else if (column === 'updatedAt') {
            await prisma.$executeRaw`
              ALTER TABLE sweet_calls_rounds 
              ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
            `;
          }
          console.log(`✅ Added column: ${column}`);
        } catch (error) {
          console.error(`❌ Failed to add column ${column}:`, error.message);
        }
      }
      
      // Create updatedAt trigger
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
      console.log('✅ All required columns already exist');
    }
    
    // Test the fix
    console.log('🧪 Testing SweetCallsRound operations...');
    
    try {
      // Test finding rounds
      const rounds = await prisma.sweetCallsRound.findMany();
      console.log(`✅ Found ${rounds.length} existing rounds`);
      
      // Test creating a new round
      const newRound = await prisma.sweetCallsRound.create({
        data: {
          phase: 'IDLE'
        }
      });
      console.log('✅ Successfully created new round');
      
      // Test updating the round
      await prisma.sweetCallsRound.update({
        where: { id: newRound.id },
        data: { phase: 'OPEN' }
      });
      console.log('✅ Successfully updated round');
      
      // Clean up test round
      await prisma.sweetCallsRound.delete({
        where: { id: newRound.id }
      });
      console.log('✅ Test round cleaned up');
      
    } catch (error) {
      console.error('❌ SweetCallsRound operations failed:', error.message);
      throw error;
    }
    
    console.log('🎉 Database fix completed successfully!');
    console.log('✅ SweetCallsRound schema is now working correctly');
    
  } catch (error) {
    console.error('❌ Database fix failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

fixRailwayDatabase();

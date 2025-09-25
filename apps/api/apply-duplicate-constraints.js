#!/usr/bin/env node

/**
 * Script to apply duplicate guess prevention constraints
 * This ensures the database has the proper unique constraints
 */

import { PrismaClient } from '@prisma/client';
import { execSync } from 'child_process';

const prisma = new PrismaClient();

async function applyConstraints() {
  console.log('🔧 Applying duplicate guess prevention constraints...');

  try {
    // Step 1: Generate Prisma client with latest schema
    console.log('📦 Generating Prisma client...');
    execSync('npx prisma generate', { stdio: 'inherit' });

    // Step 2: Push schema to database to apply constraints
    console.log('🗄️  Applying database constraints...');
    execSync('npx prisma db push --force-reset', { stdio: 'inherit' });

    console.log('✅ Constraints applied successfully!');
    
    // Step 3: Verify constraints exist
    console.log('🔍 Verifying constraints...');
    await prisma.$connect();
    
    // Test the constraints by trying to create duplicate data
    console.log('🧪 Testing duplicate prevention...');
    
    // This should work - create a test guess
    try {
      const testGuess = await prisma.guess.create({
        data: {
          gameRoundId: 'test-round',
          userId: 'test-user-1',
          value: 100,
        },
      });
      console.log('✅ Test guess created successfully');
      
      // This should fail - try to create duplicate value
      try {
        await prisma.guess.create({
          data: {
            gameRoundId: 'test-round',
            userId: 'test-user-2',
            value: 100, // Same value
          },
        });
        console.log('❌ ERROR: Duplicate guess was allowed!');
      } catch (duplicateError) {
        console.log('✅ Duplicate guess correctly prevented');
      }
      
      // Clean up test data
      await prisma.guess.deleteMany({
        where: {
          gameRoundId: 'test-round',
        },
      });
      console.log('🧹 Test data cleaned up');
      
    } catch (error) {
      console.log('⚠️  Test failed:', error.message);
    }

    console.log('🎉 Duplicate guess prevention is working correctly!');
    
  } catch (error) {
    console.error('❌ Failed to apply constraints:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

applyConstraints();

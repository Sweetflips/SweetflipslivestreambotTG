#!/usr/bin/env node

/**
 * Quick Fix Script for Railway SweetCallsRound Issue
 * Run this script on Railway to immediately fix the database schema
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function quickFix() {
  console.log('🚀 Quick Fix for SweetCallsRound Schema');
  console.log('=====================================');
  
  try {
    // Test connection
    await prisma.$queryRaw`SELECT 1`;
    console.log('✅ Database connected');
    
    // Add missing columns
    console.log('🔧 Adding missing columns...');
    
    try {
      await prisma.$executeRaw`
        ALTER TABLE sweet_calls_rounds 
        ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
      `;
      console.log('✅ Added createdAt column');
    } catch (e) {
      console.log('ℹ️  createdAt column already exists or error:', e.message);
    }
    
    try {
      await prisma.$executeRaw`
        ALTER TABLE sweet_calls_rounds 
        ADD COLUMN IF NOT EXISTS "closedAt" TIMESTAMP(3);
      `;
      console.log('✅ Added closedAt column');
    } catch (e) {
      console.log('ℹ️  closedAt column already exists or error:', e.message);
    }
    
    try {
      await prisma.$executeRaw`
        ALTER TABLE sweet_calls_rounds 
        ADD COLUMN IF NOT EXISTS "revealedAt" TIMESTAMP(3);
      `;
      console.log('✅ Added revealedAt column');
    } catch (e) {
      console.log('ℹ️  revealedAt column already exists or error:', e.message);
    }
    
    try {
      await prisma.$executeRaw`
        ALTER TABLE sweet_calls_rounds 
        ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
      `;
      console.log('✅ Added updatedAt column');
    } catch (e) {
      console.log('ℹ️  updatedAt column already exists or error:', e.message);
    }
    
    // Test the fix
    console.log('🧪 Testing SweetCallsRound...');
    
    const testRound = await prisma.sweetCallsRound.create({
      data: { phase: 'IDLE' }
    });
    console.log('✅ Created test round');
    
    await prisma.sweetCallsRound.update({
      where: { id: testRound.id },
      data: { phase: 'OPEN' }
    });
    console.log('✅ Updated test round');
    
    await prisma.sweetCallsRound.delete({
      where: { id: testRound.id }
    });
    console.log('✅ Deleted test round');
    
    console.log('🎉 Quick fix completed successfully!');
    console.log('✅ SweetCallsRound is now working correctly');
    
  } catch (error) {
    console.error('❌ Quick fix failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

quickFix();

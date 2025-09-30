#!/usr/bin/env node

/**
 * Verify Call Tables Script
 * Checks if the call_sessions and call_entries tables exist and are accessible
 */

import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';

config();

const prisma = new PrismaClient();

async function verifyCallTables() {
  try {
    console.log('🔍 Verifying Call Tables...');
    
    // Test database connection
    await prisma.$queryRaw`SELECT 1`;
    console.log('✅ Database connection successful');
    
    // Check if call_sessions table exists
    const sessionsTable = await prisma.$queryRaw`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'call_sessions'
      );
    `;
    
    if (sessionsTable[0].exists) {
      console.log('✅ call_sessions table exists');
    } else {
      console.log('❌ call_sessions table does not exist');
      return false;
    }
    
    // Check if call_entries table exists
    const entriesTable = await prisma.$queryRaw`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'call_entries'
      );
    `;
    
    if (entriesTable[0].exists) {
      console.log('✅ call_entries table exists');
    } else {
      console.log('❌ call_entries table does not exist');
      return false;
    }
    
    // Test basic Prisma operations
    const sessionCount = await prisma.callSession.count();
    console.log(`✅ call_sessions table accessible (${sessionCount} records)`);
    
    const entryCount = await prisma.callEntry.count();
    console.log(`✅ call_entries table accessible (${entryCount} records)`);
    
    // Test creating a test session
    const testSession = await prisma.callSession.create({
      data: {
        sessionName: 'Test Session',
        status: 'OPEN'
      }
    });
    console.log('✅ Can create call sessions');
    
    // Test deleting the test session
    await prisma.callSession.delete({
      where: { id: testSession.id }
    });
    console.log('✅ Can delete call sessions');
    
    console.log('🎉 All table verifications passed!');
    return true;
    
  } catch (error) {
    console.error('❌ Table verification failed:', error);
    return false;
  } finally {
    await prisma.$disconnect();
  }
}

// Run verification
verifyCallTables().then(success => {
  process.exit(success ? 0 : 1);
}).catch(error => {
  console.error('❌ Verification script failed:', error);
  process.exit(1);
});

#!/usr/bin/env node

/**
 * Simple CallSessionService Test
 * Quick test to verify the service is working
 */

import { PrismaClient } from '@prisma/client';
import { CallSessionService } from '../src/services/callSessionService.js';
import { config } from 'dotenv';

config();

const prisma = new PrismaClient();

async function testCallSessionService() {
  try {
    console.log('🧪 Testing CallSessionService...');
    
    // Create service instance
    const callSessionService = new CallSessionService(prisma);
    
    // Initialize service
    await callSessionService.initialize();
    console.log('✅ Service initialized successfully');
    
    // Test creating a new session
    const newSession = await callSessionService.createNewCallSession();
    if (newSession) {
      console.log('✅ Created new session:', newSession.sessionName);
    } else {
      console.log('❌ Failed to create new session');
      return false;
    }
    
    // Test getting active session
    const activeSession = await callSessionService.getActiveCallSession();
    if (activeSession) {
      console.log('✅ Retrieved active session:', activeSession.sessionName);
    } else {
      console.log('❌ Failed to get active session');
      return false;
    }
    
    // Test closing session
    const closed = await callSessionService.closeCallSession(newSession.id);
    if (closed) {
      console.log('✅ Session closed successfully');
    } else {
      console.log('❌ Failed to close session');
      return false;
    }
    
    console.log('🎉 All tests passed!');
    return true;
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    return false;
  } finally {
    await prisma.$disconnect();
  }
}

// Run test
testCallSessionService().then(success => {
  process.exit(success ? 0 : 1);
}).catch(error => {
  console.error('❌ Test script failed:', error);
  process.exit(1);
});

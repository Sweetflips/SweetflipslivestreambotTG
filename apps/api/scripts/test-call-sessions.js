#!/usr/bin/env node

/**
 * Test Call Sessions Script
 * Tests the new CallSession and CallEntry tables
 * Validates all CRUD operations and relationships
 */

import { PrismaClient } from '@prisma/client';
import { CallSessionService } from '../src/services/callSessionService.js';
import { config } from 'dotenv';

config();

const prisma = new PrismaClient();

class CallSessionsTester {
  constructor() {
    this.testResults = {
      connection: false,
      models: {},
      operations: {},
      service: {},
      errors: []
    };
    this.callSessionService = new CallSessionService(prisma);
  }

  async log(message, level = 'INFO') {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [${level}] ${message}`);
  }

  async testDatabaseConnection() {
    try {
      await this.log('Testing database connection...');
      await prisma.$queryRaw`SELECT 1`;
      this.testResults.connection = true;
      await this.log('✅ Database connection successful');
      return true;
    } catch (error) {
      this.testResults.errors.push(`Connection failed: ${error.message}`);
      await this.log(`❌ Database connection failed: ${error.message}`, 'ERROR');
      return false;
    }
  }

  async testCallSessionModel() {
    try {
      await this.log('Testing CallSession model...');
      
      // Test CREATE
      const testSession = await prisma.callSession.create({
        data: {
          sessionName: 'Test Session',
          status: 'OPEN'
        }
      });
      await this.log('✅ CallSession CREATE operation successful');
      
      // Test READ
      const foundSession = await prisma.callSession.findUnique({
        where: { id: testSession.id }
      });
      if (!foundSession) {
        throw new Error('Created session not found');
      }
      await this.log('✅ CallSession READ operation successful');
      
      // Test UPDATE
      await prisma.callSession.update({
        where: { id: testSession.id },
        data: { 
          status: 'CLOSED',
          closedAt: new Date()
        }
      });
      await this.log('✅ CallSession UPDATE operation successful');
      
      // Test DELETE
      await prisma.callSession.delete({
        where: { id: testSession.id }
      });
      await this.log('✅ CallSession DELETE operation successful');
      
      this.testResults.models.callSession = true;
      return true;
    } catch (error) {
      this.testResults.models.callSession = false;
      this.testResults.errors.push(`CallSession model failed: ${error.message}`);
      await this.log(`❌ CallSession model failed: ${error.message}`, 'ERROR');
      return false;
    }
  }

  async testCallEntryModel() {
    try {
      await this.log('Testing CallEntry model...');
      
      // Create test user and session first
      const testUser = await prisma.user.create({
        data: {
          telegramId: `test_${Date.now()}`,
          role: 'VIEWER'
        }
      });
      
      const testSession = await prisma.callSession.create({
        data: {
          sessionName: 'Test Session for Entry',
          status: 'OPEN'
        }
      });
      
      // Test CREATE
      const testEntry = await prisma.callEntry.create({
        data: {
          sessionId: testSession.id,
          userId: testUser.id,
          slotName: 'test_slot'
        }
      });
      await this.log('✅ CallEntry CREATE operation successful');
      
      // Test READ
      const foundEntry = await prisma.callEntry.findUnique({
        where: { id: testEntry.id }
      });
      if (!foundEntry) {
        throw new Error('Created entry not found');
      }
      await this.log('✅ CallEntry READ operation successful');
      
      // Test UPDATE
      await prisma.callEntry.update({
        where: { id: testEntry.id },
        data: { 
          multiplier: 2.5,
          isArchived: true
        }
      });
      await this.log('✅ CallEntry UPDATE operation successful');
      
      // Test DELETE
      await prisma.callEntry.delete({
        where: { id: testEntry.id }
      });
      await this.log('✅ CallEntry DELETE operation successful');
      
      // Clean up test data
      await prisma.callSession.delete({ where: { id: testSession.id } });
      await prisma.user.delete({ where: { id: testUser.id } });
      
      this.testResults.models.callEntry = true;
      return true;
    } catch (error) {
      this.testResults.models.callEntry = false;
      this.testResults.errors.push(`CallEntry model failed: ${error.message}`);
      await this.log(`❌ CallEntry model failed: ${error.message}`, 'ERROR');
      return false;
    }
  }

  async testRelationships() {
    try {
      await this.log('Testing relationships...');
      
      // Create test data
      const testUser = await prisma.user.create({
        data: {
          telegramId: `test_${Date.now()}`,
          role: 'VIEWER'
        }
      });
      
      const testSession = await prisma.callSession.create({
        data: {
          sessionName: 'Test Session for Relations',
          status: 'OPEN'
        }
      });
      
      const testEntry = await prisma.callEntry.create({
        data: {
          sessionId: testSession.id,
          userId: testUser.id,
          slotName: 'test_slot'
        }
      });
      
      // Test User -> CallEntry relationship
      const userWithEntries = await prisma.user.findUnique({
        where: { id: testUser.id },
        include: { callEntries: true }
      });
      
      if (!userWithEntries || userWithEntries.callEntries.length === 0) {
        throw new Error('User -> CallEntry relationship failed');
      }
      await this.log('✅ User -> CallEntry relationship working');
      
      // Test CallSession -> CallEntry relationship
      const sessionWithEntries = await prisma.callSession.findUnique({
        where: { id: testSession.id },
        include: { callEntries: true }
      });
      
      if (!sessionWithEntries || sessionWithEntries.callEntries.length === 0) {
        throw new Error('CallSession -> CallEntry relationship failed');
      }
      await this.log('✅ CallSession -> CallEntry relationship working');
      
      // Test CallEntry -> User relationship
      const entryWithUser = await prisma.callEntry.findUnique({
        where: { id: testEntry.id },
        include: { user: true }
      });
      
      if (!entryWithUser || !entryWithUser.user) {
        throw new Error('CallEntry -> User relationship failed');
      }
      await this.log('✅ CallEntry -> User relationship working');
      
      // Test CallEntry -> CallSession relationship
      const entryWithSession = await prisma.callEntry.findUnique({
        where: { id: testEntry.id },
        include: { session: true }
      });
      
      if (!entryWithSession || !entryWithSession.session) {
        throw new Error('CallEntry -> CallSession relationship failed');
      }
      await this.log('✅ CallEntry -> CallSession relationship working');
      
      // Clean up test data
      await prisma.callEntry.delete({ where: { id: testEntry.id } });
      await prisma.callSession.delete({ where: { id: testSession.id } });
      await prisma.user.delete({ where: { id: testUser.id } });
      
      this.testResults.operations.relationships = true;
      return true;
    } catch (error) {
      this.testResults.operations.relationships = false;
      this.testResults.errors.push(`Relationships failed: ${error.message}`);
      await this.log(`❌ Relationships failed: ${error.message}`, 'ERROR');
      return false;
    }
  }

  async testConstraints() {
    try {
      await this.log('Testing constraints...');
      
      // Create test data
      const testUser = await prisma.user.create({
        data: {
          telegramId: `test_${Date.now()}`,
          role: 'VIEWER'
        }
      });
      
      const testSession = await prisma.callSession.create({
        data: {
          sessionName: 'Test Session for Constraints',
          status: 'OPEN'
        }
      });
      
      // Test unique constraint: user can only have one entry per session
      await prisma.callEntry.create({
        data: {
          sessionId: testSession.id,
          userId: testUser.id,
          slotName: 'slot1'
        }
      });
      
      try {
        await prisma.callEntry.create({
          data: {
            sessionId: testSession.id,
            userId: testUser.id,
            slotName: 'slot2'
          }
        });
        throw new Error('Unique constraint failed - user should not be able to have multiple entries in same session');
      } catch (error) {
        if (error.code === 'P2002') {
          await this.log('✅ Unique constraint (user per session) working');
        } else {
          throw error;
        }
      }
      
      // Test unique constraint: slot can only be used once per session
      const testUser2 = await prisma.user.create({
        data: {
          telegramId: `test2_${Date.now()}`,
          role: 'VIEWER'
        }
      });
      
      try {
        await prisma.callEntry.create({
          data: {
            sessionId: testSession.id,
            userId: testUser2.id,
            slotName: 'slot1'
          }
        });
        throw new Error('Unique constraint failed - slot should not be able to be used multiple times in same session');
      } catch (error) {
        if (error.code === 'P2002') {
          await this.log('✅ Unique constraint (slot per session) working');
        } else {
          throw error;
        }
      }
      
      // Clean up test data
      await prisma.callEntry.deleteMany({ where: { sessionId: testSession.id } });
      await prisma.callSession.delete({ where: { id: testSession.id } });
      await prisma.user.delete({ where: { id: testUser.id } });
      await prisma.user.delete({ where: { id: testUser2.id } });
      
      this.testResults.operations.constraints = true;
      return true;
    } catch (error) {
      this.testResults.operations.constraints = false;
      this.testResults.errors.push(`Constraints failed: ${error.message}`);
      await this.log(`❌ Constraints failed: ${error.message}`, 'ERROR');
      return false;
    }
  }

  async testCallSessionService() {
    try {
      await this.log('Testing CallSessionService...');
      
      // Test service initialization
      await this.callSessionService.initialize();
      await this.log('✅ CallSessionService initialization successful');
      
      // Create test user
      const testUser = await prisma.user.create({
        data: {
          telegramId: `test_service_${Date.now()}`,
          role: 'VIEWER'
        }
      });
      
      // Test creating new session
      const newSession = await this.callSessionService.createNewCallSession();
      if (!newSession) {
        throw new Error('Failed to create new session');
      }
      await this.log('✅ CallSessionService createNewCallSession working');
      
      // Test getting active session
      const activeSession = await this.callSessionService.getActiveCallSession();
      if (!activeSession || activeSession.id !== newSession.id) {
        throw new Error('Failed to get active session');
      }
      await this.log('✅ CallSessionService getActiveCallSession working');
      
      // Test making call entry
      const entryResult = await this.callSessionService.makeCallEntry(testUser.id, 'test_slot');
      if (!entryResult.success) {
        throw new Error(`Failed to make call entry: ${entryResult.message}`);
      }
      await this.log('✅ CallSessionService makeCallEntry working');
      
      // Test getting session entries
      const entries = await this.callSessionService.getSessionCallEntries(newSession.id);
      if (entries.length === 0) {
        throw new Error('Failed to get session entries');
      }
      await this.log('✅ CallSessionService getSessionCallEntries working');
      
      // Test setting multiplier
      const multiplierResult = await this.callSessionService.setSlotMultiplier(newSession.id, 'test_slot', 2.5);
      if (!multiplierResult) {
        throw new Error('Failed to set slot multiplier');
      }
      await this.log('✅ CallSessionService setSlotMultiplier working');
      
      // Test closing session
      const closeResult = await this.callSessionService.closeCallSession(newSession.id);
      if (!closeResult) {
        throw new Error('Failed to close session');
      }
      await this.log('✅ CallSessionService closeCallSession working');
      
      // Clean up test data
      await prisma.user.delete({ where: { id: testUser.id } });
      
      this.testResults.service.callSessionService = true;
      return true;
    } catch (error) {
      this.testResults.service.callSessionService = false;
      this.testResults.errors.push(`CallSessionService failed: ${error.message}`);
      await this.log(`❌ CallSessionService failed: ${error.message}`, 'ERROR');
      return false;
    }
  }

  async run() {
    try {
      await this.log('🧪 Starting Call Sessions Test');
      await this.log('=============================');
      
      // Step 1: Database connection
      const connected = await this.testDatabaseConnection();
      if (!connected) {
        throw new Error('Cannot connect to database');
      }
      
      // Step 2: Test models
      await this.testCallSessionModel();
      await this.testCallEntryModel();
      
      // Step 3: Test relationships
      await this.testRelationships();
      
      // Step 4: Test constraints
      await this.testConstraints();
      
      // Step 5: Test CallSessionService
      await this.testCallSessionService();
      
      // Step 6: Summary
      await this.log('📊 Test Summary');
      await this.log('===============');
      await this.log(`Connection: ${this.testResults.connection ? '✅' : '❌'}`);
      await this.log(`Models: ${Object.values(this.testResults.models).every(m => m) ? '✅' : '❌'}`);
      await this.log(`Operations: ${Object.values(this.testResults.operations).every(o => o) ? '✅' : '❌'}`);
      await this.log(`Service: ${Object.values(this.testResults.service).every(s => s) ? '✅' : '❌'}`);
      
      if (this.testResults.errors.length > 0) {
        await this.log('❌ Errors found:');
        this.testResults.errors.forEach(error => {
          await this.log(`  - ${error}`, 'ERROR');
        });
        return false;
      } else {
        await this.log('🎉 All tests passed!');
        await this.log('✅ CallSession and CallEntry tables are working correctly');
        return true;
      }
      
    } catch (error) {
      await this.log(`❌ Test failed: ${error.message}`, 'ERROR');
      return false;
    } finally {
      await prisma.$disconnect();
    }
  }
}

// Run test if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const tester = new CallSessionsTester();
  tester.run().then(success => {
    process.exit(success ? 0 : 1);
  }).catch(error => {
    console.error('❌ Test script failed:', error);
    process.exit(1);
  });
}

export { CallSessionsTester };

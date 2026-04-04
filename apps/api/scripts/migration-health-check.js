#!/usr/bin/env node

/**
 * Migration Health Check Script
 * Validates database schema and operations after migration
 * Provides detailed diagnostics for troubleshooting
 */

import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';

config();

const prisma = new PrismaClient();

class MigrationHealthCheck {
  constructor() {
    this.results = {
      connection: false,
      models: {},
      operations: {},
      errors: []
    };
  }

  async log(message, level = 'INFO') {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [${level}] ${message}`);
  }

  async checkDatabaseConnection() {
    try {
      await this.log('Testing database connection...');
      await prisma.$queryRaw`SELECT 1`;
      this.results.connection = true;
      await this.log('✅ Database connection successful');
      return true;
    } catch (error) {
      this.results.errors.push(`Connection failed: ${error.message}`);
      await this.log(`❌ Database connection failed: ${error.message}`, 'ERROR');
      return false;
    }
  }

  async checkDatabaseInfo() {
    try {
      await this.log('Checking database information...');
      
      const version = await prisma.$queryRaw`SELECT version() as version`;
      await this.log(`📊 Database: ${version[0].version}`);
      
      const currentTime = await prisma.$queryRaw`SELECT NOW() as current_time`;
      await this.log(`🕐 Database time: ${currentTime[0].current_time}`);
      
      return true;
    } catch (error) {
      this.results.errors.push(`Database info failed: ${error.message}`);
      await this.log(`❌ Failed to get database info: ${error.message}`, 'ERROR');
      return false;
    }
  }

  async checkModel(modelName, modelInstance) {
    try {
      await this.log(`Checking ${modelName} model...`);
      
      // Test basic findFirst operation
      await modelInstance.findFirst();
      this.results.models[modelName] = { accessible: true, operations: {} };
      await this.log(`✅ ${modelName} model accessible`);
      
      return true;
    } catch (error) {
      this.results.models[modelName] = { accessible: false, error: error.message };
      this.results.errors.push(`${modelName} model failed: ${error.message}`);
      await this.log(`❌ ${modelName} model failed: ${error.message}`, 'ERROR');
      return false;
    }
  }

  async testSweetCallsRoundOperations() {
    try {
      await this.log('Testing SweetCallsRound operations...');
      
      // Test CREATE
      const testRound = await prisma.sweetCallsRound.create({
        data: { phase: 'IDLE' }
      });
      await this.log('✅ SweetCallsRound CREATE operation successful');
      
      // Test READ
      const foundRound = await prisma.sweetCallsRound.findUnique({
        where: { id: testRound.id }
      });
      if (!foundRound) {
        throw new Error('Created round not found');
      }
      await this.log('✅ SweetCallsRound READ operation successful');
      
      // Test UPDATE
      await prisma.sweetCallsRound.update({
        where: { id: testRound.id },
        data: { 
          phase: 'OPEN',
          closedAt: new Date()
        }
      });
      await this.log('✅ SweetCallsRound UPDATE operation successful');
      
      // Test DELETE
      await prisma.sweetCallsRound.delete({
        where: { id: testRound.id }
      });
      await this.log('✅ SweetCallsRound DELETE operation successful');
      
      this.results.operations.sweetCallsRound = true;
      return true;
    } catch (error) {
      this.results.operations.sweetCallsRound = false;
      this.results.errors.push(`SweetCallsRound operations failed: ${error.message}`);
      await this.log(`❌ SweetCallsRound operations failed: ${error.message}`, 'ERROR');
      return false;
    }
  }

  async testUserOperations() {
    try {
      await this.log('Testing User operations...');
      
      // Test CREATE
      const testUser = await prisma.user.create({
        data: {
          telegramId: `test_${Date.now()}`,
          role: 'VIEWER'
        }
      });
      await this.log('✅ User CREATE operation successful');
      
      // Test READ
      const foundUser = await prisma.user.findUnique({
        where: { id: testUser.id }
      });
      if (!foundUser) {
        throw new Error('Created user not found');
      }
      await this.log('✅ User READ operation successful');
      
      // Test UPDATE
      await prisma.user.update({
        where: { id: testUser.id },
        data: { role: 'MOD' }
      });
      await this.log('✅ User UPDATE operation successful');
      
      // Test DELETE
      await prisma.user.delete({
        where: { id: testUser.id }
      });
      await this.log('✅ User DELETE operation successful');
      
      this.results.operations.user = true;
      return true;
    } catch (error) {
      this.results.operations.user = false;
      this.results.errors.push(`User operations failed: ${error.message}`);
      await this.log(`❌ User operations failed: ${error.message}`, 'ERROR');
      return false;
    }
  }

  async checkTableStructure() {
    try {
      await this.log('Checking table structure...');
      
      const tables = await prisma.$queryRaw`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public'
        ORDER BY table_name;
      `;
      
      const expectedTables = [
        'users',
        'game_rounds', 
        'guesses',
        'sweet_calls_rounds',
        'sweet_calls',
        'audit_logs',
        'telegram_groups',
        'schedules',
        'stream_notifications',
        'bonus_items'
      ];
      
      const foundTables = tables.map(t => t.table_name);
      const missingTables = expectedTables.filter(t => !foundTables.includes(t));
      
      if (missingTables.length > 0) {
        await this.log(`⚠️  Missing tables: ${missingTables.join(', ')}`, 'WARN');
        this.results.errors.push(`Missing tables: ${missingTables.join(', ')}`);
      } else {
        await this.log('✅ All expected tables present');
      }
      
      // Check SweetCallsRound columns specifically
      const sweetCallsColumns = await prisma.$queryRaw`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns 
        WHERE table_name = 'sweet_calls_rounds'
        ORDER BY ordinal_position;
      `;
      
      const expectedColumns = ['id', 'phase', 'createdAt', 'closedAt', 'revealedAt', 'updatedAt'];
      const foundColumns = sweetCallsColumns.map(c => c.column_name);
      const missingColumns = expectedColumns.filter(c => !foundColumns.includes(c));
      
      if (missingColumns.length > 0) {
        await this.log(`❌ SweetCallsRound missing columns: ${missingColumns.join(', ')}`, 'ERROR');
        this.results.errors.push(`SweetCallsRound missing columns: ${missingColumns.join(', ')}`);
      } else {
        await this.log('✅ SweetCallsRound has all required columns');
      }
      
      return missingTables.length === 0 && missingColumns.length === 0;
    } catch (error) {
      this.results.errors.push(`Table structure check failed: ${error.message}`);
      await this.log(`❌ Table structure check failed: ${error.message}`, 'ERROR');
      return false;
    }
  }

  async run() {
    try {
      await this.log('🏥 Starting Migration Health Check');
      await this.log('==================================');
      
      // Step 1: Database connection
      const connected = await this.checkDatabaseConnection();
      if (!connected) {
        throw new Error('Cannot connect to database');
      }
      
      // Step 2: Database info
      await this.checkDatabaseInfo();
      
      // Step 3: Table structure
      const structureOk = await this.checkTableStructure();
      
      // Step 4: Model accessibility
      const models = [
        { name: 'User', instance: prisma.user },
        { name: 'GameRound', instance: prisma.gameRound },
        { name: 'Guess', instance: prisma.guess },
        { name: 'SweetCallsRound', instance: prisma.sweetCallsRound },
        { name: 'SweetCall', instance: prisma.sweetCall },
        { name: 'AuditLog', instance: prisma.auditLog }
      ];
      
      for (const model of models) {
        await this.checkModel(model.name, model.instance);
      }
      
      // Step 5: Critical operations
      await this.testSweetCallsRoundOperations();
      await this.testUserOperations();
      
      // Step 6: Summary
      await this.log('📊 Health Check Summary');
      await this.log('======================');
      await this.log(`Connection: ${this.results.connection ? '✅' : '❌'}`);
      await this.log(`Structure: ${structureOk ? '✅' : '❌'}`);
      await this.log(`Models: ${Object.values(this.results.models).every(m => m.accessible) ? '✅' : '❌'}`);
      await this.log(`Operations: ${Object.values(this.results.operations).every(o => o) ? '✅' : '❌'}`);
      
      if (this.results.errors.length > 0) {
        await this.log('❌ Errors found:');
        this.results.errors.forEach(error => {
          await this.log(`  - ${error}`, 'ERROR');
        });
        return false;
      } else {
        await this.log('🎉 All health checks passed!');
        return true;
      }
      
    } catch (error) {
      await this.log(`❌ Health check failed: ${error.message}`, 'ERROR');
      return false;
    } finally {
      await prisma.$disconnect();
    }
  }
}

// Run health check if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const healthCheck = new MigrationHealthCheck();
  healthCheck.run().then(success => {
    process.exit(success ? 0 : 1);
  }).catch(error => {
    console.error('❌ Health check script failed:', error);
    process.exit(1);
  });
}

export { MigrationHealthCheck };

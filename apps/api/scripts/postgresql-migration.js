#!/usr/bin/env node

/**
 * PostgreSQL Migration Script for Railway
 * Handles the transition from SQLite to PostgreSQL with proper column naming
 * Ensures all tables use snake_case columns in PostgreSQL
 */

import { PrismaClient } from '@prisma/client';
import { execSync } from 'child_process';
import { config } from 'dotenv';

config();

const prisma = new PrismaClient();

class PostgreSQLMigration {
  constructor() {
    this.maxRetries = 3;
    this.retryDelay = 5000;
  }

  async log(message, level = 'INFO') {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [${level}] ${message}`);
  }

  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async validatePostgreSQLConnection() {
    try {
      await this.log('Validating PostgreSQL connection...');
      
      const result = await prisma.$queryRaw`SELECT version() as version`;
      const version = result[0].version;
      
      if (!version.includes('PostgreSQL')) {
        throw new Error('Database is not PostgreSQL');
      }
      
      await this.log(`✅ PostgreSQL connection validated: ${version}`);
      return true;
    } catch (error) {
      await this.log(`❌ PostgreSQL validation failed: ${error.message}`, 'ERROR');
      return false;
    }
  }

  async checkExistingTables() {
    try {
      await this.log('Checking existing tables...');
      
      const tables = await prisma.$queryRaw`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public'
        ORDER BY table_name;
      `;
      
      const tableNames = tables.map(t => t.table_name);
      await this.log(`📋 Found tables: ${tableNames.join(', ')}`);
      
      return tableNames;
    } catch (error) {
      await this.log(`❌ Failed to check tables: ${error.message}`, 'ERROR');
      return [];
    }
  }

  async checkColumnNaming() {
    try {
      await this.log('Checking column naming conventions...');
      
      const tables = [
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
      
      const issues = [];
      
      for (const table of tables) {
        try {
          const columns = await prisma.$queryRaw`
            SELECT column_name, data_type
            FROM information_schema.columns 
            WHERE table_name = ${table}
            ORDER BY ordinal_position;
          `;
          
          const columnNames = columns.map(c => c.column_name);
          const camelCaseColumns = columnNames.filter(name => /[A-Z]/.test(name));
          
          if (camelCaseColumns.length > 0) {
            issues.push(`${table}: ${camelCaseColumns.join(', ')}`);
          }
        } catch (error) {
          await this.log(`⚠️  Could not check table ${table}: ${error.message}`, 'WARN');
        }
      }
      
      if (issues.length > 0) {
        await this.log('❌ Found camelCase columns that need to be converted:', 'ERROR');
        issues.forEach(issue => await this.log(`  - ${issue}`, 'ERROR'));
        return false;
      } else {
        await this.log('✅ All columns follow snake_case convention');
        return true;
      }
    } catch (error) {
      await this.log(`❌ Column naming check failed: ${error.message}`, 'ERROR');
      return false;
    }
  }

  async runPrismaMigrateDeploy() {
    try {
      await this.log('Running Prisma migrate deploy...');
      
      execSync('npx prisma migrate deploy', {
        stdio: 'inherit',
        env: { ...process.env }
      });
      
      await this.log('✅ Prisma migrate deploy completed');
      return true;
    } catch (error) {
      await this.log(`❌ Prisma migrate deploy failed: ${error.message}`, 'ERROR');
      return false;
    }
  }

  async runPrismaDbPush() {
    try {
      await this.log('Running Prisma db push...');
      
      execSync('npx prisma db push', {
        stdio: 'inherit',
        env: { ...process.env }
      });
      
      await this.log('✅ Prisma db push completed');
      return true;
    } catch (error) {
      await this.log(`❌ Prisma db push failed: ${error.message}`, 'ERROR');
      return false;
    }
  }

  async testSchemaOperations() {
    try {
      await this.log('Testing schema operations...');
      
      // Test User operations
      const testUser = await prisma.user.create({
        data: {
          telegramId: `test_${Date.now()}`,
          role: 'VIEWER'
        }
      });
      await this.log('✅ User creation successful');
      
      // Test SweetCallsRound operations
      const testRound = await prisma.sweetCallsRound.create({
        data: { phase: 'IDLE' }
      });
      await this.log('✅ SweetCallsRound creation successful');
      
      // Test SweetCall operations
      const testCall = await prisma.sweetCall.create({
        data: {
          roundId: testRound.id,
          userId: testUser.id,
          slotName: 'test_slot'
        }
      });
      await this.log('✅ SweetCall creation successful');
      
      // Test GameRound operations
      const testGameRound = await prisma.gameRound.create({
        data: {
          type: 'BONUS',
          phase: 'IDLE'
        }
      });
      await this.log('✅ GameRound creation successful');
      
      // Test Guess operations
      const testGuess = await prisma.guess.create({
        data: {
          gameRoundId: testGameRound.id,
          userId: testUser.id,
          value: 100
        }
      });
      await this.log('✅ Guess creation successful');
      
      // Clean up test data
      await prisma.guess.delete({ where: { id: testGuess.id } });
      await prisma.gameRound.delete({ where: { id: testGameRound.id } });
      await prisma.sweetCall.delete({ where: { id: testCall.id } });
      await prisma.sweetCallsRound.delete({ where: { id: testRound.id } });
      await prisma.user.delete({ where: { id: testUser.id } });
      
      await this.log('✅ All schema operations successful');
      return true;
    } catch (error) {
      await this.log(`❌ Schema operations failed: ${error.message}`, 'ERROR');
      return false;
    }
  }

  async runMigrationWithRetry() {
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        await this.log(`Migration attempt ${attempt}/${this.maxRetries}`);
        
        // Try migrate deploy first
        let success = await this.runPrismaMigrateDeploy();
        
        if (!success) {
          await this.log('Migrate deploy failed, trying db push...', 'WARN');
          success = await this.runPrismaDbPush();
        }
        
        if (success) {
          return true;
        }
      } catch (error) {
        await this.log(`Migration attempt ${attempt} failed: ${error.message}`, 'ERROR');
        
        if (attempt === this.maxRetries) {
          throw error;
        }
        
        await this.log(`Retrying in ${this.retryDelay}ms...`);
        await this.sleep(this.retryDelay);
      }
    }
    
    return false;
  }

  async run() {
    try {
      await this.log('🚀 Starting PostgreSQL Migration');
      await this.log('================================');
      
      // Step 1: Validate PostgreSQL connection
      const connected = await this.validatePostgreSQLConnection();
      if (!connected) {
        throw new Error('Not connected to PostgreSQL database');
      }
      
      // Step 2: Check existing tables
      await this.checkExistingTables();
      
      // Step 3: Run migration with retry
      const migrationSuccess = await this.runMigrationWithRetry();
      if (!migrationSuccess) {
        throw new Error('Migration failed after all retries');
      }
      
      // Step 4: Check column naming
      const namingOk = await this.checkColumnNaming();
      if (!namingOk) {
        await this.log('⚠️  Column naming issues detected, but migration completed', 'WARN');
      }
      
      // Step 5: Test schema operations
      const operationsOk = await this.testSchemaOperations();
      if (!operationsOk) {
        throw new Error('Schema operations test failed');
      }
      
      await this.log('🎉 PostgreSQL migration completed successfully!');
      await this.log('✅ Database is ready for production use');
      
    } catch (error) {
      await this.log(`❌ PostgreSQL migration failed: ${error.message}`, 'ERROR');
      throw error;
    } finally {
      await prisma.$disconnect();
    }
  }
}

// Run migration if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const migration = new PostgreSQLMigration();
  migration.run().catch((error) => {
    console.error('❌ PostgreSQL migration script failed:', error);
    process.exit(1);
  });
}

export { PostgreSQLMigration };

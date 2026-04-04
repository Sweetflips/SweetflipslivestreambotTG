#!/usr/bin/env node

/**
 * Migration Rollback Script
 * Provides rollback capabilities for failed migrations
 * Follows best practices for safe database rollbacks
 */

import { PrismaClient } from '@prisma/client';
import { execSync } from 'child_process';
import { config } from 'dotenv';

config();

const prisma = new PrismaClient();

class MigrationRollback {
  constructor() {
    this.backupEnabled = true;
    this.maxRollbackSteps = 5;
  }

  async log(message, level = 'INFO') {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [${level}] ${message}`);
  }

  async createBackup() {
    try {
      await this.log('Creating database backup before rollback...');
      
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupName = `backup_${timestamp}`;
      
      // Create backup using pg_dump (PostgreSQL)
      execSync(`pg_dump "${process.env.DATABASE_URL}" > /tmp/${backupName}.sql`, {
        stdio: 'inherit',
        env: { ...process.env }
      });
      
      await this.log(`✅ Backup created: /tmp/${backupName}.sql`);
      return backupName;
    } catch (error) {
      await this.log(`⚠️  Backup creation failed: ${error.message}`, 'WARN');
      return null;
    }
  }

  async checkMigrationHistory() {
    try {
      await this.log('Checking migration history...');
      
      const migrations = await prisma.$queryRaw`
        SELECT migration_name, finished_at, rolled_back_at
        FROM _prisma_migrations 
        ORDER BY finished_at DESC
        LIMIT 10;
      `;
      
      await this.log(`📋 Found ${migrations.length} recent migrations`);
      migrations.forEach((migration, index) => {
        const status = migration.rolled_back_at ? 'ROLLED BACK' : 'APPLIED';
        await this.log(`  ${index + 1}. ${migration.migration_name} - ${status}`);
      });
      
      return migrations;
    } catch (error) {
      await this.log(`❌ Failed to check migration history: ${error.message}`, 'ERROR');
      return [];
    }
  }

  async rollbackToLastStable() {
    try {
      await this.log('Attempting rollback to last stable migration...');
      
      // Get recent migrations
      const migrations = await this.checkMigrationHistory();
      
      if (migrations.length === 0) {
        await this.log('⚠️  No migrations found to rollback', 'WARN');
        return false;
      }
      
      // Find the last stable migration (not rolled back)
      const lastStable = migrations.find(m => !m.rolled_back_at);
      
      if (!lastStable) {
        await this.log('❌ No stable migration found to rollback to', 'ERROR');
        return false;
      }
      
      await this.log(`🔄 Rolling back to: ${lastStable.migration_name}`);
      
      // Mark current migration as rolled back
      await prisma.$executeRaw`
        UPDATE _prisma_migrations 
        SET rolled_back_at = NOW()
        WHERE migration_name = ${lastStable.migration_name}
        AND rolled_back_at IS NULL;
      `;
      
      await this.log('✅ Migration marked as rolled back');
      return true;
    } catch (error) {
      await this.log(`❌ Rollback failed: ${error.message}`, 'ERROR');
      return false;
    }
  }

  async resetToSchema() {
    try {
      await this.log('Resetting database to match current schema...');
      
      // Use Prisma db push to reset schema
      execSync('npx prisma db push --force-reset', {
        stdio: 'inherit',
        env: { ...process.env }
      });
      
      await this.log('✅ Database reset to current schema');
      return true;
    } catch (error) {
      await this.log(`❌ Schema reset failed: ${error.message}`, 'ERROR');
      return false;
    }
  }

  async validateRollback() {
    try {
      await this.log('Validating rollback...');
      
      // Test basic operations
      await prisma.$queryRaw`SELECT 1`;
      
      // Test key models
      await prisma.user.findFirst();
      await prisma.sweetCallsRound.findFirst();
      
      await this.log('✅ Rollback validation successful');
      return true;
    } catch (error) {
      await this.log(`❌ Rollback validation failed: ${error.message}`, 'ERROR');
      return false;
    }
  }

  async run(rollbackType = 'auto') {
    try {
      await this.log('🔄 Starting Migration Rollback');
      await this.log('==============================');
      
      // Step 1: Create backup
      let backupName = null;
      if (this.backupEnabled) {
        backupName = await this.createBackup();
      }
      
      // Step 2: Determine rollback strategy
      let rollbackSuccess = false;
      
      switch (rollbackType) {
        case 'migration':
          rollbackSuccess = await this.rollbackToLastStable();
          break;
        case 'schema':
          rollbackSuccess = await this.resetToSchema();
          break;
        case 'auto':
        default:
          // Try migration rollback first, then schema reset
          rollbackSuccess = await this.rollbackToLastStable();
          if (!rollbackSuccess) {
            await this.log('Migration rollback failed, trying schema reset...', 'WARN');
            rollbackSuccess = await this.resetToSchema();
          }
          break;
      }
      
      if (!rollbackSuccess) {
        throw new Error('All rollback methods failed');
      }
      
      // Step 3: Validate rollback
      const validationSuccess = await this.validateRollback();
      if (!validationSuccess) {
        throw new Error('Rollback validation failed');
      }
      
      await this.log('🎉 Rollback completed successfully!');
      if (backupName) {
        await this.log(`💾 Backup available at: /tmp/${backupName}.sql`);
      }
      
    } catch (error) {
      await this.log(`❌ Rollback failed: ${error.message}`, 'ERROR');
      throw error;
    } finally {
      await prisma.$disconnect();
    }
  }
}

// Run rollback if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const rollbackType = process.argv[2] || 'auto';
  const rollback = new MigrationRollback();
  
  rollback.run(rollbackType).catch((error) => {
    console.error('❌ Rollback script failed:', error);
    process.exit(1);
  });
}

export { MigrationRollback };

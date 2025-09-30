#!/usr/bin/env node

/**
 * Auto Database Migration Script for Railway
 * Automatically runs Prisma migrations on deployment
 * Follows best practices for PostgreSQL and Railway deployments
 */

import { PrismaClient } from '@prisma/client';
import { execSync } from 'child_process';
import { config } from 'dotenv';

// Load environment variables
config();

const prisma = new PrismaClient();

class DatabaseMigrator {
  constructor() {
    this.maxRetries = 3;
    this.retryDelay = 5000; // 5 seconds
  }

  async log(message, level = 'INFO') {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [${level}] ${message}`);
  }

  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async testDatabaseConnection() {
    try {
      await this.log('Testing database connection...');
      await prisma.$queryRaw`SELECT 1`;
      await this.log('✅ Database connection successful');
      return true;
    } catch (error) {
      await this.log(`❌ Database connection failed: ${error.message}`, 'ERROR');
      return false;
    }
  }

  async checkDatabaseProvider() {
    try {
      const result = await prisma.$queryRaw`
        SELECT version() as version;
      `;
      const version = result[0].version;
      
      if (version.includes('PostgreSQL')) {
        await this.log(`✅ PostgreSQL detected: ${version}`);
        return 'postgresql';
      } else {
        await this.log(`⚠️  Non-PostgreSQL database detected: ${version}`, 'WARN');
        return 'other';
      }
    } catch (error) {
      await this.log(`❌ Failed to detect database provider: ${error.message}`, 'ERROR');
      throw error;
    }
  }

  async checkMigrationStatus() {
    try {
      await this.log('Checking migration status...');
      
      // Check if _prisma_migrations table exists
      const migrationTableExists = await prisma.$queryRaw`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = '_prisma_migrations'
        );
      `;

      if (!migrationTableExists[0].exists) {
        await this.log('📋 No migration history found - fresh database');
        return { hasMigrations: false, pendingMigrations: [] };
      }

      // Get applied migrations
      const appliedMigrations = await prisma.$queryRaw`
        SELECT migration_name, finished_at 
        FROM _prisma_migrations 
        WHERE finished_at IS NOT NULL
        ORDER BY finished_at;
      `;

      await this.log(`📋 Found ${appliedMigrations.length} applied migrations`);
      
      return { 
        hasMigrations: true, 
        appliedMigrations: appliedMigrations.map(m => m.migration_name)
      };
    } catch (error) {
      await this.log(`❌ Failed to check migration status: ${error.message}`, 'ERROR');
      throw error;
    }
  }

  async runPrismaGenerate() {
    try {
      await this.log('Generating Prisma client...');
      execSync('npx prisma generate', { 
        stdio: 'inherit',
        env: { ...process.env }
      });
      await this.log('✅ Prisma client generated successfully');
    } catch (error) {
      await this.log(`❌ Failed to generate Prisma client: ${error.message}`, 'ERROR');
      throw error;
    }
  }

  async runPrismaMigrateDeploy() {
    try {
      await this.log('Running Prisma migrate deploy...');
      execSync('npx prisma migrate deploy', { 
        stdio: 'inherit',
        env: { ...process.env }
      });
      await this.log('✅ Prisma migrate deploy completed successfully');
    } catch (error) {
      await this.log(`❌ Prisma migrate deploy failed: ${error.message}`, 'ERROR');
      throw error;
    }
  }

  async runPrismaDbPush() {
    try {
      await this.log('Running Prisma db push...');
      execSync('npx prisma db push', { 
        stdio: 'inherit',
        env: { ...process.env }
      });
      await this.log('✅ Prisma db push completed successfully');
    } catch (error) {
      await this.log(`❌ Prisma db push failed: ${error.message}`, 'ERROR');
      throw error;
    }
  }

  async validateSchema() {
    try {
      await this.log('Validating database schema...');
      
      // Test key models
      const models = [
        'User',
        'GameRound', 
        'Guess',
        'SweetCallsRound',
        'SweetCall',
        'AuditLog'
      ];

      for (const model of models) {
        try {
          await prisma[model.toLowerCase()].findFirst();
          await this.log(`✅ ${model} model accessible`);
        } catch (error) {
          await this.log(`❌ ${model} model failed: ${error.message}`, 'ERROR');
          throw error;
        }
      }

      await this.log('✅ All models validated successfully');
    } catch (error) {
      await this.log(`❌ Schema validation failed: ${error.message}`, 'ERROR');
      throw error;
    }
  }

  async runMigrationWithRetry() {
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        await this.log(`Migration attempt ${attempt}/${this.maxRetries}`);
        
        // First try migrate deploy (for production)
        try {
          await this.runPrismaMigrateDeploy();
          return true;
        } catch (migrateError) {
          await this.log(`Migrate deploy failed, trying db push: ${migrateError.message}`, 'WARN');
          
          // Fallback to db push if migrate deploy fails
          await this.runPrismaDbPush();
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
  }

  async performHealthCheck() {
    try {
      await this.log('Performing health check...');
      
      // Test database connection
      await prisma.$queryRaw`SELECT 1`;
      
      // Test basic operations
      await this.validateSchema();
      
      // Test SweetCallsRound specifically (the problematic model)
      const testRound = await prisma.sweetCallsRound.create({
        data: { phase: 'IDLE' }
      });
      
      await prisma.sweetCallsRound.update({
        where: { id: testRound.id },
        data: { phase: 'OPEN' }
      });
      
      await prisma.sweetCallsRound.delete({
        where: { id: testRound.id }
      });
      
      await this.log('✅ Health check passed - all operations working');
      return true;
    } catch (error) {
      await this.log(`❌ Health check failed: ${error.message}`, 'ERROR');
      return false;
    }
  }

  async run() {
    try {
      await this.log('🚀 Starting auto database migration for Railway');
      await this.log('================================================');
      
      // Step 1: Test database connection
      const connected = await this.testDatabaseConnection();
      if (!connected) {
        throw new Error('Cannot connect to database');
      }
      
      // Step 2: Check database provider
      const provider = await this.checkDatabaseProvider();
      if (provider !== 'postgresql') {
        await this.log('⚠️  Warning: Not using PostgreSQL in production', 'WARN');
      }
      
      // Step 3: Generate Prisma client
      await this.runPrismaGenerate();
      
      // Step 4: Check migration status
      const migrationStatus = await this.checkMigrationStatus();
      
      // Step 5: Run migrations
      await this.runMigrationWithRetry();
      
      // Step 6: Validate schema
      await this.validateSchema();
      
      // Step 7: Health check
      const healthCheckPassed = await this.performHealthCheck();
      if (!healthCheckPassed) {
        throw new Error('Health check failed after migration');
      }
      
      await this.log('🎉 Auto migration completed successfully!');
      await this.log('✅ Database is ready for production use');
      
    } catch (error) {
      await this.log(`❌ Auto migration failed: ${error.message}`, 'ERROR');
      throw error;
    } finally {
      await prisma.$disconnect();
    }
  }
}

// Run migration if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const migrator = new DatabaseMigrator();
  migrator.run().catch((error) => {
    console.error('❌ Migration script failed:', error);
    process.exit(1);
  });
}

export { DatabaseMigrator };

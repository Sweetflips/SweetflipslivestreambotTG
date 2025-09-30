#!/usr/bin/env node

/**
 * Railway Deployment Script
 * Handles complete deployment process with database migration
 * Follows best practices for Railway and PostgreSQL deployments
 */

import { DatabaseMigrator } from './auto-migrate.js';
import { MigrationHealthCheck } from './migration-health-check.js';
import { MigrationRollback } from './migration-rollback.js';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class RailwayDeployment {
  constructor() {
    this.maxRetries = 3;
    this.retryDelay = 10000; // 10 seconds
  }

  async log(message, level = 'INFO') {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [${level}] ${message}`);
  }

  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async validateEnvironment() {
    try {
      await this.log('Validating deployment environment...');
      
      // Check required environment variables
      const requiredVars = [
        'DATABASE_URL',
        'NODE_ENV',
        'TELEGRAM_BOT_TOKEN'
      ];
      
      const missingVars = requiredVars.filter(varName => !process.env[varName]);
      
      if (missingVars.length > 0) {
        throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
      }
      
      // Validate DATABASE_URL is PostgreSQL
      if (!process.env.DATABASE_URL.includes('postgresql://')) {
        throw new Error('DATABASE_URL must be a PostgreSQL connection string');
      }
      
      await this.log('✅ Environment validation passed');
      return true;
    } catch (error) {
      await this.log(`❌ Environment validation failed: ${error.message}`, 'ERROR');
      return false;
    }
  }

  async runDatabaseMigration() {
    try {
      await this.log('Running database migration...');
      
      const migrator = new DatabaseMigrator();
      await migrator.run();
      
      await this.log('✅ Database migration completed');
      return true;
    } catch (error) {
      await this.log(`❌ Database migration failed: ${error.message}`, 'ERROR');
      return false;
    }
  }

  async runHealthCheck() {
    try {
      await this.log('Running health check...');
      
      const healthCheck = new MigrationHealthCheck();
      const success = await healthCheck.run();
      
      if (success) {
        await this.log('✅ Health check passed');
        return true;
      } else {
        await this.log('❌ Health check failed', 'ERROR');
        return false;
      }
    } catch (error) {
      await this.log(`❌ Health check error: ${error.message}`, 'ERROR');
      return false;
    }
  }

  async startApplication() {
    try {
      await this.log('Starting application...');
      
      const botPath = join(__dirname, '../bot/bot.js');
      const child = spawn('node', [botPath], {
        stdio: 'inherit',
        env: process.env
      });
      
      child.on('error', (error) => {
        this.log(`❌ Application start error: ${error.message}`, 'ERROR');
        process.exit(1);
      });
      
      child.on('exit', (code) => {
        this.log(`📱 Application exited with code ${code}`);
        process.exit(code);
      });
      
      // Handle graceful shutdown
      process.on('SIGINT', () => {
        this.log('🛑 Received SIGINT, shutting down gracefully...');
        child.kill('SIGINT');
      });
      
      process.on('SIGTERM', () => {
        this.log('🛑 Received SIGTERM, shutting down gracefully...');
        child.kill('SIGTERM');
      });
      
      await this.log('✅ Application started successfully');
      return child;
    } catch (error) {
      await this.log(`❌ Failed to start application: ${error.message}`, 'ERROR');
      throw error;
    }
  }

  async runWithRetry(operation, operationName) {
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        await this.log(`${operationName} attempt ${attempt}/${this.maxRetries}`);
        const result = await operation();
        if (result) {
          return true;
        }
      } catch (error) {
        await this.log(`${operationName} attempt ${attempt} failed: ${error.message}`, 'ERROR');
        
        if (attempt === this.maxRetries) {
          throw error;
        }
        
        await this.log(`Retrying in ${this.retryDelay}ms...`);
        await this.sleep(this.retryDelay);
      }
    }
    return false;
  }

  async deploy() {
    try {
      await this.log('🚀 Starting Railway Deployment');
      await this.log('==============================');
      
      // Step 1: Validate environment
      const envValid = await this.validateEnvironment();
      if (!envValid) {
        throw new Error('Environment validation failed');
      }
      
      // Step 2: Run database migration with retry
      const migrationSuccess = await this.runWithRetry(
        () => this.runDatabaseMigration(),
        'Database Migration'
      );
      
      if (!migrationSuccess) {
        await this.log('❌ Database migration failed after all retries', 'ERROR');
        await this.log('🔄 Attempting rollback...', 'WARN');
        
        try {
          const rollback = new MigrationRollback();
          await rollback.run('auto');
          await this.log('✅ Rollback completed');
        } catch (rollbackError) {
          await this.log(`❌ Rollback failed: ${rollbackError.message}`, 'ERROR');
        }
        
        throw new Error('Deployment failed - migration unsuccessful');
      }
      
      // Step 3: Run health check
      const healthSuccess = await this.runWithRetry(
        () => this.runHealthCheck(),
        'Health Check'
      );
      
      if (!healthSuccess) {
        await this.log('❌ Health check failed after all retries', 'ERROR');
        throw new Error('Deployment failed - health check unsuccessful');
      }
      
      // Step 4: Start application
      await this.startApplication();
      
    } catch (error) {
      await this.log(`❌ Deployment failed: ${error.message}`, 'ERROR');
      process.exit(1);
    }
  }
}

// Run deployment if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const deployment = new RailwayDeployment();
  deployment.deploy();
}

export { RailwayDeployment };

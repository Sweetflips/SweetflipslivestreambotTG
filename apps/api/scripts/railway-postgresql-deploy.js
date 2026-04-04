#!/usr/bin/env node

/**
 * Railway PostgreSQL Deployment Script
 * Handles complete deployment with PostgreSQL integration
 * Follows Railway best practices and deployment guidelines
 */

import { PrismaClient } from '@prisma/client';
import { execSync } from 'child_process';
import { config } from 'dotenv';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
config();

const prisma = new PrismaClient();

class RailwayPostgreSQLDeployment {
  constructor() {
    this.maxRetries = 3;
    this.retryDelay = 10000; // 10 seconds
    this.healthCheckTimeout = 30000; // 30 seconds
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
      await this.log('Validating Railway PostgreSQL environment...');
      
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
      
      // Check if it's a Railway PostgreSQL URL
      if (process.env.DATABASE_URL.includes('railway.app')) {
        await this.log('✅ Railway PostgreSQL database detected');
      } else {
        await this.log('⚠️  Non-Railway PostgreSQL database detected', 'WARN');
      }
      
      await this.log('✅ Environment validation passed');
      return true;
    } catch (error) {
      await this.log(`❌ Environment validation failed: ${error.message}`, 'ERROR');
      return false;
    }
  }

  async testPostgreSQLConnection() {
    try {
      await this.log('Testing PostgreSQL connection...');
      
      // Test basic connection
      await prisma.$queryRaw`SELECT 1`;
      await this.log('✅ PostgreSQL connection successful');
      
      // Get database info
      const version = await prisma.$queryRaw`SELECT version() as version`;
      await this.log(`📊 Database: ${version[0].version}`);
      
      // Test SSL connection
      const sslInfo = await prisma.$queryRaw`SELECT ssl_is_used() as ssl_used`;
      await this.log(`🔒 SSL Connection: ${sslInfo[0].ssl_used ? 'Enabled' : 'Disabled'}`);
      
      return true;
    } catch (error) {
      await this.log(`❌ PostgreSQL connection failed: ${error.message}`, 'ERROR');
      return false;
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

  async validateDatabaseSchema() {
    try {
      await this.log('Validating database schema...');
      
      // Test key models
      const models = [
        'User',
        'GameRound', 
        'Guess',
        'AuditLog',
        'TelegramGroup',
        'Schedule',
        'StreamNotification',
        'BonusItem'
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

  async performHealthCheck() {
    try {
      await this.log('Performing health check...');
      
      // Test database connection
      await prisma.$queryRaw`SELECT 1`;
      
      // Test basic operations
      await this.validateDatabaseSchema();
      
      // Test User operations
      const testUser = await prisma.user.create({
        data: {
          telegramId: `test_${Date.now()}`,
          role: 'VIEWER'
        }
      });
      
      await prisma.user.update({
        where: { id: testUser.id },
        data: { role: 'MOD' }
      });
      
      await prisma.user.delete({
        where: { id: testUser.id }
      });
      
      await this.log('✅ Health check passed - all operations working');
      return true;
    } catch (error) {
      await this.log(`❌ Health check failed: ${error.message}`, 'ERROR');
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
      await this.log('🚀 Starting Railway PostgreSQL Deployment');
      await this.log('==========================================');
      
      // Step 1: Validate environment
      const envValid = await this.validateEnvironment();
      if (!envValid) {
        throw new Error('Environment validation failed');
      }
      
      // Step 2: Test PostgreSQL connection
      const connected = await this.runWithRetry(
        () => this.testPostgreSQLConnection(),
        'PostgreSQL Connection'
      );
      
      if (!connected) {
        throw new Error('PostgreSQL connection failed');
      }
      
      // Step 3: Generate Prisma client
      await this.runPrismaGenerate();
      
      // Step 4: Run migrations
      const migrationSuccess = await this.runWithRetry(
        () => this.runPrismaMigrateDeploy(),
        'Database Migration'
      );
      
      if (!migrationSuccess) {
        throw new Error('Database migration failed');
      }
      
      // Step 5: Validate schema
      await this.validateDatabaseSchema();
      
      // Step 6: Health check
      const healthSuccess = await this.runWithRetry(
        () => this.performHealthCheck(),
        'Health Check'
      );
      
      if (!healthSuccess) {
        throw new Error('Health check failed');
      }
      
      // Step 7: Start application
      await this.startApplication();
      
    } catch (error) {
      await this.log(`❌ Railway PostgreSQL deployment failed: ${error.message}`, 'ERROR');
      process.exit(1);
    }
  }
}

// Run deployment if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const deployment = new RailwayPostgreSQLDeployment();
  deployment.deploy();
}

export { RailwayPostgreSQLDeployment };

#!/usr/bin/env node

/**
 * Railway Health Check Script
 * Provides health check endpoint for Railway monitoring
 * Follows Railway health check best practices
 */

import { PrismaClient } from '@prisma/client';
import { createServer } from 'http';
import { config } from 'dotenv';

config();

const prisma = new PrismaClient();

class HealthCheckServer {
  constructor() {
    this.port = process.env.PORT || 3000;
    this.server = null;
    this.isHealthy = false;
    this.lastHealthCheck = null;
  }

  async log(message, level = 'INFO') {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [${level}] ${message}`);
  }

  async checkDatabaseHealth() {
    try {
      // Test database connection
      await prisma.$queryRaw`SELECT 1`;
      
      // Test basic operations
      await prisma.user.findFirst();
      
      return { status: 'healthy', message: 'Database connection successful' };
    } catch (error) {
      return { status: 'unhealthy', message: `Database error: ${error.message}` };
    }
  }

  async checkApplicationHealth() {
    try {
      // Check environment variables
      const requiredVars = ['DATABASE_URL', 'NODE_ENV', 'TELEGRAM_BOT_TOKEN'];
      const missingVars = requiredVars.filter(varName => !process.env[varName]);
      
      if (missingVars.length > 0) {
        return { 
          status: 'unhealthy', 
          message: `Missing environment variables: ${missingVars.join(', ')}` 
        };
      }
      
      return { status: 'healthy', message: 'Application configuration valid' };
    } catch (error) {
      return { status: 'unhealthy', message: `Application error: ${error.message}` };
    }
  }

  async performHealthCheck() {
    try {
      const dbHealth = await this.checkDatabaseHealth();
      const appHealth = await this.checkApplicationHealth();
      
      const overallHealth = dbHealth.status === 'healthy' && appHealth.status === 'healthy';
      
      this.isHealthy = overallHealth;
      this.lastHealthCheck = new Date().toISOString();
      
      return {
        status: overallHealth ? 'healthy' : 'unhealthy',
        timestamp: this.lastHealthCheck,
        checks: {
          database: dbHealth,
          application: appHealth
        }
      };
    } catch (error) {
      this.isHealthy = false;
      this.lastHealthCheck = new Date().toISOString();
      
      return {
        status: 'unhealthy',
        timestamp: this.lastHealthCheck,
        error: error.message
      };
    }
  }

  async handleRequest(req, res) {
    const url = new URL(req.url, `http://${req.headers.host}`);
    
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }
    
    if (url.pathname === '/health') {
      try {
        const healthStatus = await this.performHealthCheck();
        
        const statusCode = healthStatus.status === 'healthy' ? 200 : 503;
        
        res.writeHead(statusCode, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(healthStatus, null, 2));
        
        await this.log(`Health check: ${healthStatus.status} (${statusCode})`);
      } catch (error) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
          status: 'error', 
          message: error.message,
          timestamp: new Date().toISOString()
        }));
        
        await this.log(`Health check error: ${error.message}`, 'ERROR');
      }
    } else if (url.pathname === '/ready') {
      // Readiness check - simpler than health check
      const ready = this.isHealthy && this.lastHealthCheck;
      
      const statusCode = ready ? 200 : 503;
      res.writeHead(statusCode, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        ready,
        timestamp: this.lastHealthCheck || new Date().toISOString()
      }));
    } else if (url.pathname === '/live') {
      // Liveness check - always returns 200 if server is running
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        alive: true,
        timestamp: new Date().toISOString()
      }));
    } else {
      // Default response
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        error: 'Not found',
        availableEndpoints: ['/health', '/ready', '/live']
      }));
    }
  }

  async start() {
    try {
      await this.log('Starting Railway health check server...');
      
      this.server = createServer((req, res) => {
        this.handleRequest(req, res).catch(error => {
          this.log(`Request handling error: ${error.message}`, 'ERROR');
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Internal server error' }));
        });
      });
      
      this.server.listen(this.port, () => {
        this.log(`✅ Health check server listening on port ${this.port}`);
        this.log(`📊 Health check endpoint: http://localhost:${this.port}/health`);
        this.log(`🔍 Readiness endpoint: http://localhost:${this.port}/ready`);
        this.log(`💓 Liveness endpoint: http://localhost:${this.port}/live`);
      });
      
      // Perform initial health check
      await this.performHealthCheck();
      
      // Set up periodic health checks
      setInterval(async () => {
        await this.performHealthCheck();
      }, 30000); // Every 30 seconds
      
    } catch (error) {
      await this.log(`❌ Failed to start health check server: ${error.message}`, 'ERROR');
      throw error;
    }
  }

  async stop() {
    try {
      if (this.server) {
        await this.log('Stopping health check server...');
        this.server.close();
        await this.log('✅ Health check server stopped');
      }
    } catch (error) {
      await this.log(`❌ Error stopping health check server: ${error.message}`, 'ERROR');
    } finally {
      await prisma.$disconnect();
    }
  }
}

// Run health check server if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const healthServer = new HealthCheckServer();
  
  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    await healthServer.stop();
    process.exit(0);
  });
  
  process.on('SIGTERM', async () => {
    await healthServer.stop();
    process.exit(0);
  });
  
  healthServer.start().catch(error => {
    console.error('❌ Health check server failed:', error);
    process.exit(1);
  });
}

export { HealthCheckServer };

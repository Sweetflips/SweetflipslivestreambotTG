#!/usr/bin/env node

import { ensureDatabaseSchema } from './ensure-database-schema.js';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function startWithMigration() {
  try {
    console.log('🚀 Starting application with database migration...');
    
    // Ensure database schema is ready
    await ensureDatabaseSchema();
    
    console.log('✅ Database schema ready, starting application...');
    
    // Start the main application
    const appPath = join(__dirname, '../dist/index.js');
    const child = spawn('node', [appPath], {
      stdio: 'inherit',
      env: process.env
    });
    
    child.on('error', (error) => {
      console.error('❌ Failed to start application:', error);
      process.exit(1);
    });
    
    child.on('exit', (code) => {
      console.log(`📱 Application exited with code ${code}`);
      process.exit(code);
    });
    
    // Handle graceful shutdown
    process.on('SIGINT', () => {
      console.log('🛑 Received SIGINT, shutting down gracefully...');
      child.kill('SIGINT');
    });
    
    process.on('SIGTERM', () => {
      console.log('🛑 Received SIGTERM, shutting down gracefully...');
      child.kill('SIGTERM');
    });
    
  } catch (error) {
    console.error('❌ Startup failed:', error);
    process.exit(1);
  }
}

startWithMigration();

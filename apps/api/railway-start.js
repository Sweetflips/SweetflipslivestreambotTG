#!/usr/bin/env node

import { ensureDatabaseSchema } from './scripts/ensure-database-schema.js';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function railwayStart() {
  try {
    console.log('🚀 Starting Railway deployment with database migration...');
    
    // Ensure database schema is ready
    await ensureDatabaseSchema();
    
    console.log('✅ Database schema ready, starting bot...');
    
    // Start the bot application
    const botPath = join(__dirname, '../bot/bot.js');
    const child = spawn('node', [botPath], {
      stdio: 'inherit',
      env: process.env
    });
    
    child.on('error', (error) => {
      console.error('❌ Failed to start bot:', error);
      process.exit(1);
    });
    
    child.on('exit', (code) => {
      console.log(`📱 Bot exited with code ${code}`);
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
    console.error('❌ Railway startup failed:', error);
    process.exit(1);
  }
}

railwayStart();

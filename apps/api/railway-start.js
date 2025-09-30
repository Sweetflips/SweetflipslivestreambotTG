#!/usr/bin/env node

import { RailwayPostgreSQLDeployment } from './scripts/railway-postgresql-deploy.js';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function railwayStart() {
  try {
    console.log('🚀 Starting Railway PostgreSQL deployment...');
    
    // Run Railway PostgreSQL deployment
    const deployment = new RailwayPostgreSQLDeployment();
    await deployment.deploy();
    
  } catch (error) {
    console.error('❌ Railway PostgreSQL deployment failed:', error);
    process.exit(1);
  }
}

railwayStart();

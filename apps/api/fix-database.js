#!/usr/bin/env node

import { ensureDatabaseSchema } from './scripts/ensure-database-schema.js';

async function fixDatabase() {
  try {
    console.log('🔧 Fixing database schema for Railway deployment...');
    await ensureDatabaseSchema();
    console.log('✅ Database schema fixed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Failed to fix database schema:', error);
    process.exit(1);
  }
}

fixDatabase();

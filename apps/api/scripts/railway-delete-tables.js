#!/usr/bin/env node

/**
 * Railway Table Deletion Script
 * Deletes sweet_calls and sweet_calls_rounds tables on Railway
 * Can be run directly on Railway or locally
 */

import { SweetCallsTableDeletion } from './delete-sweet-calls-tables.js';

async function railwayDeleteTables() {
  console.log('🚀 Railway Sweet Calls Tables Deletion');
  console.log('=====================================');
  
  try {
    const deletion = new SweetCallsTableDeletion();
    await deletion.run();
    
    console.log('🎉 Table deletion completed successfully!');
    console.log('✅ Ready for Railway deployment');
    
  } catch (error) {
    console.error('❌ Table deletion failed:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  railwayDeleteTables();
}

export { railwayDeleteTables };

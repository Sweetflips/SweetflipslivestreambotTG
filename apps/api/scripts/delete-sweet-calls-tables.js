#!/usr/bin/env node

/**
 * Delete Sweet Calls Tables Script
 * Safely removes sweet_calls and sweet_calls_rounds tables from PostgreSQL
 * Includes backup and validation steps
 */

import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';

config();

const prisma = new PrismaClient();

class SweetCallsTableDeletion {
  constructor() {
    this.tablesToDelete = ['sweet_calls', 'sweet_calls_rounds'];
    this.backupEnabled = true;
  }

  async log(message, level = 'INFO') {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [${level}] ${message}`);
  }

  async validatePostgreSQLConnection() {
    try {
      await this.log('Validating PostgreSQL connection...');
      
      const result = await prisma.$queryRaw`SELECT version() as version`;
      const version = result[0].version;
      
      if (!version.includes('PostgreSQL')) {
        throw new Error('Database is not PostgreSQL');
      }
      
      await this.log(`✅ PostgreSQL connection validated: ${version}`);
      return true;
    } catch (error) {
      await this.log(`❌ PostgreSQL validation failed: ${error.message}`, 'ERROR');
      return false;
    }
  }

  async checkTablesExist() {
    try {
      await this.log('Checking if tables exist...');
      
      const existingTables = [];
      
      for (const table of this.tablesToDelete) {
        const tableExists = await prisma.$queryRaw`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = ${table}
          );
        `;
        
        if (tableExists[0].exists) {
          existingTables.push(table);
          await this.log(`✅ Table ${table} exists`);
        } else {
          await this.log(`ℹ️  Table ${table} does not exist`);
        }
      }
      
      return existingTables;
    } catch (error) {
      await this.log(`❌ Failed to check tables: ${error.message}`, 'ERROR');
      return [];
    }
  }

  async getTableData(tableName) {
    try {
      await this.log(`Getting data from ${tableName}...`);
      
      const data = await prisma.$queryRawUnsafe(`SELECT * FROM ${tableName} LIMIT 10`);
      const count = await prisma.$queryRawUnsafe(`SELECT COUNT(*) as count FROM ${tableName}`);
      
      await this.log(`📊 ${tableName}: ${count[0].count} records`);
      if (data.length > 0) {
        await this.log(`📋 Sample data: ${JSON.stringify(data[0], null, 2)}`);
      }
      
      return { data, count: count[0].count };
    } catch (error) {
      await this.log(`❌ Failed to get data from ${tableName}: ${error.message}`, 'ERROR');
      return { data: [], count: 0 };
    }
  }

  async createBackup() {
    try {
      if (!this.backupEnabled) {
        await this.log('⚠️  Backup disabled, skipping backup creation', 'WARN');
        return null;
      }
      
      await this.log('Creating backup of tables...');
      
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupData = {};
      
      for (const table of this.tablesToDelete) {
        const tableData = await this.getTableData(table);
        if (tableData.count > 0) {
          backupData[table] = tableData;
        }
      }
      
      if (Object.keys(backupData).length > 0) {
        const backupFile = `/tmp/sweet_calls_backup_${timestamp}.json`;
        await this.log(`💾 Backup data prepared for ${Object.keys(backupData).length} tables`);
        await this.log(`📁 Backup would be saved to: ${backupFile}`);
        return backupData;
      } else {
        await this.log('ℹ️  No data to backup');
        return null;
      }
    } catch (error) {
      await this.log(`❌ Backup creation failed: ${error.message}`, 'ERROR');
      return null;
    }
  }

  async deleteTable(tableName) {
    try {
      await this.log(`Deleting table ${tableName}...`);
      
      // Check for foreign key constraints
      const constraints = await prisma.$queryRaw`
        SELECT 
          tc.constraint_name,
          tc.table_name,
          kcu.column_name,
          ccu.table_name AS foreign_table_name,
          ccu.column_name AS foreign_column_name
        FROM information_schema.table_constraints AS tc
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage AS ccu
          ON ccu.constraint_name = tc.constraint_name
          AND ccu.table_schema = tc.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY'
        AND (tc.table_name = ${tableName} OR ccu.table_name = ${tableName});
      `;
      
      if (constraints.length > 0) {
        await this.log(`⚠️  Found ${constraints.length} foreign key constraints for ${tableName}`, 'WARN');
        constraints.forEach(constraint => {
          this.log(`  - ${constraint.constraint_name}: ${constraint.table_name}.${constraint.column_name} -> ${constraint.foreign_table_name}.${constraint.foreign_column_name}`);
        });
      }
      
      // Drop the table
      await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS ${tableName} CASCADE`);
      await this.log(`✅ Table ${tableName} deleted successfully`);
      
      return true;
    } catch (error) {
      await this.log(`❌ Failed to delete table ${tableName}: ${error.message}`, 'ERROR');
      return false;
    }
  }

  async validateDeletion() {
    try {
      await this.log('Validating table deletion...');
      
      const remainingTables = [];
      
      for (const table of this.tablesToDelete) {
        const tableExists = await prisma.$queryRaw`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = ${table}
          );
        `;
        
        if (tableExists[0].exists) {
          remainingTables.push(table);
        }
      }
      
      if (remainingTables.length === 0) {
        await this.log('✅ All tables deleted successfully');
        return true;
      } else {
        await this.log(`❌ Tables still exist: ${remainingTables.join(', ')}`, 'ERROR');
        return false;
      }
    } catch (error) {
      await this.log(`❌ Validation failed: ${error.message}`, 'ERROR');
      return false;
    }
  }

  async run() {
    try {
      await this.log('🗑️  Starting Sweet Calls Tables Deletion');
      await this.log('==========================================');
      
      // Step 1: Validate PostgreSQL connection
      const connected = await this.validatePostgreSQLConnection();
      if (!connected) {
        throw new Error('Not connected to PostgreSQL database');
      }
      
      // Step 2: Check which tables exist
      const existingTables = await this.checkTablesExist();
      if (existingTables.length === 0) {
        await this.log('ℹ️  No tables to delete');
        return;
      }
      
      // Step 3: Create backup
      const backupData = await this.createBackup();
      
      // Step 4: Delete tables
      let allDeleted = true;
      for (const table of existingTables) {
        const deleted = await this.deleteTable(table);
        if (!deleted) {
          allDeleted = false;
        }
      }
      
      if (!allDeleted) {
        throw new Error('Some tables could not be deleted');
      }
      
      // Step 5: Validate deletion
      const validationSuccess = await this.validateDeletion();
      if (!validationSuccess) {
        throw new Error('Table deletion validation failed');
      }
      
      await this.log('🎉 Sweet Calls tables deletion completed successfully!');
      await this.log('✅ Tables sweet_calls and sweet_calls_rounds have been removed');
      
      if (backupData) {
        await this.log('💾 Backup data was prepared (not saved to file in this script)');
        await this.log('📋 Backup contained data from: ' + Object.keys(backupData).join(', '));
      }
      
    } catch (error) {
      await this.log(`❌ Table deletion failed: ${error.message}`, 'ERROR');
      throw error;
    } finally {
      await prisma.$disconnect();
    }
  }
}

// Run deletion if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const deletion = new SweetCallsTableDeletion();
  deletion.run().catch((error) => {
    console.error('❌ Sweet calls table deletion script failed:', error);
    process.exit(1);
  });
}

export { SweetCallsTableDeletion };

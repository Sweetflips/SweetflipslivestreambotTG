#!/usr/bin/env node

/**
 * Debug script to check database configuration
 */

console.log('🔍 Debugging database configuration...');

// Check environment variables
console.log('\n📋 Environment Variables:');
console.log('DATABASE_URL:', process.env.DATABASE_URL ? '✅ Set' : '❌ Not set');
console.log('NODE_ENV:', process.env.NODE_ENV || 'Not set');

if (process.env.DATABASE_URL) {
  console.log('\n🔗 DATABASE_URL value:');
  // Mask sensitive parts of the URL
  const url = process.env.DATABASE_URL;
  const maskedUrl = url.replace(/(:\/\/[^:]+:)[^@]+(@)/, '$1***$2');
  console.log(maskedUrl);
  
  // Check if it's a valid PostgreSQL URL
  if (url.startsWith('postgresql://') || url.startsWith('postgres://')) {
    console.log('✅ Valid PostgreSQL URL format');
  } else {
    console.log('❌ Invalid URL format - must start with postgresql:// or postgres://');
  }
} else {
  console.log('\n❌ DATABASE_URL is not set!');
  console.log('This means Railway has not provided the database connection string.');
  console.log('Make sure you have added a PostgreSQL database to your Railway project.');
}

console.log('\n📝 Next steps:');
console.log('1. Go to your Railway project dashboard');
console.log('2. Make sure you have a PostgreSQL database service');
console.log('3. Check that DATABASE_URL is automatically set in your service variables');
console.log('4. If not, add a PostgreSQL database to your project');

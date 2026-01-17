#!/usr/bin/env tsx
/**
 * Database Connection Test Script
 * Tests Supabase database connection
 */

// Load .env.local file for database connection test
// IMPORTANT: Load environment variables BEFORE importing any modules that use them
const { config } = require('dotenv');
const { resolve } = require('path');

// Load environment variables from .env.local (highest priority)
config({ path: resolve(process.cwd(), '.env.local') });
config({ path: resolve(process.cwd(), '.env.development') });
config({ path: resolve(process.cwd(), '.env') });

// Now import modules after env vars are loaded
const { db } = require('../src/core/db');
const { envConfigs } = require('../src/config');

async function testDatabaseConnection() {
  console.log('🔍 Testing database connection...\n');
  
  // Check environment variables
  console.log('📋 Environment Variables:');
  console.log(`   DATABASE_PROVIDER: ${envConfigs.database_provider}`);
  console.log(`   DATABASE_URL: ${envConfigs.database_url ? '✅ Set' : '❌ Not set'}`);
  if (envConfigs.database_url) {
    // Mask password in URL for security
    const maskedUrl = envConfigs.database_url.replace(/:[^:@]+@/, ':****@');
    console.log(`   DATABASE_URL (masked): ${maskedUrl}`);
  }
  console.log(`   DB_SINGLETON_ENABLED: ${envConfigs.db_singleton_enabled}\n`);

  try {
    // Test database connection
    console.log('🔄 Attempting to connect to database...');
    const database = db();
    
    // Try a simple query to test connection
    console.log('📊 Testing query execution...');
    const result = await database.execute('SELECT NOW() as current_time, version() as pg_version');
    
    console.log('✅ Database connection successful!\n');
    console.log('📈 Connection Details:');
    if (result && result.length > 0) {
      console.log(`   Current Time: ${result[0]?.current_time}`);
      console.log(`   PostgreSQL Version: ${result[0]?.pg_version?.substring(0, 50)}...`);
    }
    
    // Test better-auth schema tables
    console.log('\n🔐 Testing better-auth tables...');
    try {
      const tablesResult = await database.execute(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name IN ('user', 'session', 'account', 'verification')
        ORDER BY table_name
      `);
      
      const tableNames = tablesResult.map((row: any) => row.table_name);
      console.log(`   Found tables: ${tableNames.length > 0 ? tableNames.join(', ') : 'None found'}`);
      
      if (tableNames.length === 0) {
        console.log('   ⚠️  Warning: No better-auth tables found. You may need to run migrations.');
      } else {
        console.log('   ✅ better-auth tables exist');
      }
    } catch (error: any) {
      console.log(`   ⚠️  Could not check tables: ${error.message}`);
    }
    
    console.log('\n✅ All tests passed! Database connection is working correctly.\n');
    process.exit(0);
  } catch (error: any) {
    console.error('\n❌ Database connection failed!\n');
    console.error('Error details:');
    console.error(`   Message: ${error.message}`);
    console.error(`   Code: ${error.code || 'N/A'}`);
    
    if (error.message?.includes('timeout') || error.message?.includes('ETIMEDOUT')) {
      console.error('\n💡 Troubleshooting:');
      console.error('   1. Check your network connection');
      console.error('   2. Verify the DATABASE_URL is correct');
      console.error('   3. Check if Supabase is accessible from your location');
      console.error('   4. Verify firewall settings');
    } else if (error.message?.includes('password') || error.message?.includes('authentication')) {
      console.error('\n💡 Troubleshooting:');
      console.error('   1. Verify DATABASE_URL credentials are correct');
      console.error('   2. Check if the database user has proper permissions');
    } else if (error.message?.includes('SSL') || error.message?.includes('certificate')) {
      console.error('\n💡 Troubleshooting:');
      console.error('   1. Ensure DATABASE_URL includes ?sslmode=require');
      console.error('   2. Check SSL certificate configuration');
    }
    
    console.error('\n');
    process.exit(1);
  }
}

// Run the test
testDatabaseConnection().catch((error) => {
  console.error('Unexpected error:', error);
  process.exit(1);
});

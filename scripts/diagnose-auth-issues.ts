#!/usr/bin/env tsx
/**
 * Authentication Issues Diagnosis Script
 * Comprehensive check for FAILED_TO_GET_SESSION and related auth issues
 */

// Load .env.local file FIRST - BEFORE any imports
// Use ESM import for dotenv to ensure proper loading
import * as dotenv from 'dotenv';
import { resolve } from 'path';

// Load environment variables in correct order (local overrides development over default)
dotenv.config({ path: resolve(process.cwd(), '.env.local') });
dotenv.config({ path: resolve(process.cwd(), '.env.development') });
dotenv.config({ path: resolve(process.cwd(), '.env') });

// Now import modules after env vars are loaded
import { db } from '../src/core/db';
import { envConfigs } from '../src/config';
import { getAuth } from '../src/core/auth';

interface DiagnosisResult {
  category: string;
  status: '✅ PASS' | '⚠️ WARNING' | '❌ FAIL';
  message: string;
  details?: any;
  suggestion?: string;
}

const results: DiagnosisResult[] = [];

function addResult(result: DiagnosisResult) {
  results.push(result);
  const icon = result.status === '✅ PASS' ? '✅' : result.status === '⚠️ WARNING' ? '⚠️' : '❌';
  console.log(`${icon} [${result.category}] ${result.message}`);
  if (result.details) {
    console.log(`   Details:`, result.details);
  }
  if (result.suggestion) {
    console.log(`   💡 Suggestion: ${result.suggestion}`);
  }
  console.log('');
}

async function checkEnvironmentVariables() {
  console.log('🔍 1. Environment Variables Check\n');
  
  // Check AUTH_SECRET
  const authSecret = envConfigs.auth_secret;
  if (!authSecret || authSecret.length < 32) {
    addResult({
      category: 'AUTH_SECRET',
      status: '❌ FAIL',
      message: 'AUTH_SECRET is missing or too short',
      details: { length: authSecret?.length || 0 },
      suggestion: 'Generate a new AUTH_SECRET: openssl rand -base64 32',
    });
  } else {
    addResult({
      category: 'AUTH_SECRET',
      status: '✅ PASS',
      message: `AUTH_SECRET is configured (length: ${authSecret.length})`,
    });
  }
  
  // Check AUTH_URL
  const authUrl = envConfigs.auth_url;
  const appUrl = envConfigs.app_url;
  if (!authUrl) {
    addResult({
      category: 'AUTH_URL',
      status: '⚠️ WARNING',
      message: 'AUTH_URL is not set, using NEXT_PUBLIC_APP_URL as fallback',
      details: { appUrl },
    });
  } else {
    addResult({
      category: 'AUTH_URL',
      status: '✅ PASS',
      message: `AUTH_URL is set: ${authUrl}`,
    });
  }
  
  // Check URL consistency
  const urlMatch = !authUrl || authUrl === appUrl || authUrl === appUrl + '/api/auth';
  if (!urlMatch) {
    addResult({
      category: 'URL_CONSISTENCY',
      status: '⚠️ WARNING',
      message: 'AUTH_URL and APP_URL may not match',
      details: { authUrl, appUrl },
      suggestion: 'Ensure AUTH_URL matches your app domain. For local: http://localhost:3000',
    });
  } else {
    addResult({
      category: 'URL_CONSISTENCY',
      status: '✅ PASS',
      message: 'AUTH_URL and APP_URL are consistent',
    });
  }
  
  // Check DATABASE_URL
  const dbUrl = envConfigs.database_url;
  if (!dbUrl) {
    addResult({
      category: 'DATABASE_URL',
      status: '❌ FAIL',
      message: 'DATABASE_URL is not set',
      suggestion: 'Set DATABASE_URL in .env.local',
    });
  } else {
    const maskedUrl = dbUrl.replace(/:[^:@]+@/, ':****@');
    addResult({
      category: 'DATABASE_URL',
      status: '✅ PASS',
      message: `DATABASE_URL is configured`,
      details: { maskedUrl },
    });
  }
}

async function checkDatabaseConnection() {
  console.log('\n🔍 2. Database Connection Check\n');
  
  try {
    const database = db();
    const result = await database.execute('SELECT NOW() as current_time');
    addResult({
      category: 'DB_CONNECTION',
      status: '✅ PASS',
      message: 'Database connection successful',
      details: { timestamp: result[0]?.current_time },
    });
  } catch (error: any) {
    addResult({
      category: 'DB_CONNECTION',
      status: '❌ FAIL',
      message: 'Database connection failed',
      details: { error: error.message },
      suggestion: 'Check DATABASE_URL and network connectivity',
    });
  }
}

async function checkBetterAuthTables() {
  console.log('\n🔍 3. Better-Auth Tables Check\n');
  
  try {
    const database = db();
    
    // Check session table structure
    const sessionTableCheck = await database.execute(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public' 
      AND table_name = 'session'
      ORDER BY ordinal_position
    `);
    
    const sessionColumns = sessionTableCheck.map((row: any) => ({
      name: row.column_name,
      type: row.data_type,
      nullable: row.is_nullable,
    }));
    
    const requiredColumns = ['id', 'expiresAt', 'token', 'userId', 'ipAddress', 'userAgent'];
    const missingColumns = requiredColumns.filter(
      col => !sessionColumns.find((c: any) => c.name === col)
    );
    
    if (missingColumns.length > 0) {
      addResult({
        category: 'SESSION_TABLE',
        status: '❌ FAIL',
        message: `Session table missing required columns: ${missingColumns.join(', ')}`,
        details: { existingColumns: sessionColumns.map((c: any) => c.name) },
        suggestion: 'Run database migrations: pnpm db:migrate',
      });
    } else {
      addResult({
        category: 'SESSION_TABLE',
        status: '✅ PASS',
        message: 'Session table structure is correct',
        details: { columns: sessionColumns.map((c: any) => c.name).join(', ') },
      });
    }
    
    // Check for active sessions
    const activeSessions = await database.execute(`
      SELECT COUNT(*) as count
      FROM session
      WHERE "expiresAt" > NOW()
    `);
    
    const sessionCount = parseInt(activeSessions[0]?.count || '0');
    addResult({
      category: 'ACTIVE_SESSIONS',
      status: sessionCount > 0 ? '✅ PASS' : '⚠️ WARNING',
      message: `Found ${sessionCount} active session(s) in database`,
      suggestion: sessionCount === 0 ? 'No active sessions found. This is normal if no user is logged in.' : undefined,
    });
    
    // Check user table
    const userTableCheck = await database.execute(`
      SELECT COUNT(*) as count FROM "user"
    `);
    const userCount = parseInt(userTableCheck[0]?.count || '0');
    addResult({
      category: 'USER_TABLE',
      status: '✅ PASS',
      message: `User table exists with ${userCount} user(s)`,
    });
    
  } catch (error: any) {
    addResult({
      category: 'BETTER_AUTH_TABLES',
      status: '❌ FAIL',
      message: 'Failed to check better-auth tables',
      details: { error: error.message },
      suggestion: 'Check database permissions and table existence',
    });
  }
}

async function checkBetterAuthConfig() {
  console.log('\n🔍 4. Better-Auth Configuration Check\n');
  
  try {
    const auth = await getAuth();
    
    // Check if auth instance is created successfully
    if (!auth) {
      addResult({
        category: 'BETTER_AUTH_INIT',
        status: '❌ FAIL',
        message: 'Failed to initialize better-auth',
        suggestion: 'Check AUTH_SECRET and database connection',
      });
      return;
    }
    
    addResult({
      category: 'BETTER_AUTH_INIT',
      status: '✅ PASS',
      message: 'Better-auth instance initialized successfully',
    });
    
    // Check auth options
    const authOptions = await import('../src/core/auth/config').then(m => m.getAuthOptions());
    const hasDatabase = !!authOptions.database;
    
    addResult({
      category: 'AUTH_DATABASE_ADAPTER',
      status: hasDatabase ? '✅ PASS' : '❌ FAIL',
      message: hasDatabase ? 'Database adapter is configured' : 'Database adapter is missing',
      suggestion: hasDatabase ? undefined : 'Check DATABASE_URL and drizzle adapter configuration',
    });
    
  } catch (error: any) {
    addResult({
      category: 'BETTER_AUTH_CONFIG',
      status: '❌ FAIL',
      message: 'Failed to check better-auth configuration',
      details: { error: error.message },
      suggestion: 'Check AUTH_SECRET and database connection',
    });
  }
}

async function checkCookieConfiguration() {
  console.log('\n🔍 5. Cookie Configuration Check\n');
  
  const authUrl = envConfigs.auth_url || envConfigs.app_url;
  
  // Check if URLs use HTTPS in production
  if (process.env.NODE_ENV === 'production') {
    const isHttps = authUrl?.startsWith('https://');
    addResult({
      category: 'HTTPS_CHECK',
      status: isHttps ? '✅ PASS' : '⚠️ WARNING',
      message: isHttps ? 'Using HTTPS (required for secure cookies)' : 'Not using HTTPS in production',
      suggestion: isHttps ? undefined : 'Production requires HTTPS for secure cookie transmission',
    });
  }
  
  // Check domain configuration
  if (authUrl) {
    try {
      const url = new URL(authUrl);
      const hostname = url.hostname;
      
      if (hostname === 'localhost' || hostname === '127.0.0.1') {
        addResult({
          category: 'COOKIE_DOMAIN',
          status: '✅ PASS',
          message: 'Using localhost (cookies will work locally)',
          details: { hostname },
        });
      } else {
        addResult({
          category: 'COOKIE_DOMAIN',
          status: '✅ PASS',
          message: `Domain configured: ${hostname}`,
          details: { hostname, port: url.port },
        });
      }
    } catch (error: any) {
      addResult({
        category: 'COOKIE_DOMAIN',
        status: '⚠️ WARNING',
        message: 'Could not parse AUTH_URL',
        details: { authUrl, error: error.message },
      });
    }
  }
}

async function checkSessionValidity() {
  console.log('\n🔍 6. Session Validity Check\n');
  
  try {
    const database = db();
    
    // Check for expired sessions
    const expiredSessions = await database.execute(`
      SELECT COUNT(*) as count
      FROM session
      WHERE "expiresAt" <= NOW()
    `);
    
    const expiredCount = parseInt(expiredSessions[0]?.count || '0');
    
    if (expiredCount > 0) {
      addResult({
        category: 'EXPIRED_SESSIONS',
        status: '⚠️ WARNING',
        message: `Found ${expiredCount} expired session(s) in database`,
        suggestion: 'Expired sessions should be cleaned up periodically. This is normal but may indicate cleanup job is needed.',
      });
    } else {
      addResult({
        category: 'EXPIRED_SESSIONS',
        status: '✅ PASS',
        message: 'No expired sessions found (or cleanup is working)',
      });
    }
    
    // Check for sessions with invalid user references
    const orphanSessions = await database.execute(`
      SELECT COUNT(*) as count
      FROM session s
      LEFT JOIN "user" u ON s."userId" = u.id
      WHERE u.id IS NULL
    `);
    
    const orphanCount = parseInt(orphanSessions[0]?.count || '0');
    
    if (orphanCount > 0) {
      addResult({
        category: 'ORPHAN_SESSIONS',
        status: '⚠️ WARNING',
        message: `Found ${orphanCount} orphan session(s) (no associated user)`,
        suggestion: 'These sessions reference deleted users. Consider cleaning them up.',
      });
    } else {
      addResult({
        category: 'ORPHAN_SESSIONS',
        status: '✅ PASS',
        message: 'No orphan sessions found',
      });
    }
    
  } catch (error: any) {
    addResult({
      category: 'SESSION_VALIDITY',
      status: '❌ FAIL',
      message: 'Failed to check session validity',
      details: { error: error.message },
    });
  }
}

async function generateRecommendations() {
  console.log('\n📋 7. Recommendations\n');
  
  const fails = results.filter(r => r.status === '❌ FAIL');
  const warnings = results.filter(r => r.status === '⚠️ WARNING');
  
  if (fails.length === 0 && warnings.length === 0) {
    console.log('✅ All checks passed! Your authentication configuration looks good.\n');
    console.log('💡 If you still experience FAILED_TO_GET_SESSION errors:');
    console.log('   1. Check browser cookies (better-auth.session_token)');
    console.log('   2. Verify request headers are being passed correctly');
    console.log('   3. Check if AUTH_SECRET was changed after users logged in');
    console.log('   4. Review server logs for detailed error messages\n');
    return;
  }
  
  if (fails.length > 0) {
    console.log('❌ Critical Issues Found:\n');
    fails.forEach((result, index) => {
      console.log(`${index + 1}. [${result.category}] ${result.message}`);
      if (result.suggestion) {
        console.log(`   → ${result.suggestion}`);
      }
    });
    console.log('');
  }
  
  if (warnings.length > 0) {
    console.log('⚠️  Warnings:\n');
    warnings.forEach((result, index) => {
      console.log(`${index + 1}. [${result.category}] ${result.message}`);
      if (result.suggestion) {
        console.log(`   → ${result.suggestion}`);
      }
    });
    console.log('');
  }
}

async function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🔍 Authentication Issues Diagnosis Tool');
  console.log('═══════════════════════════════════════════════════════════\n');
  
  await checkEnvironmentVariables();
  await checkDatabaseConnection();
  await checkBetterAuthTables();
  await checkBetterAuthConfig();
  await checkCookieConfiguration();
  await checkSessionValidity();
  await generateRecommendations();
  
  console.log('═══════════════════════════════════════════════════════════');
  console.log('✅ Diagnosis Complete\n');
  
  const fails = results.filter(r => r.status === '❌ FAIL');
  const warnings = results.filter(r => r.status === '⚠️ WARNING');
  
  if (fails.length > 0) {
    process.exit(1);
  } else if (warnings.length > 0) {
    process.exit(0);
  } else {
    process.exit(0);
  }
}

main().catch((error) => {
  console.error('Unexpected error:', error);
  process.exit(1);
});

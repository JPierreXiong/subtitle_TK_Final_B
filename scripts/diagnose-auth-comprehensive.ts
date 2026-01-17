#!/usr/bin/env tsx
/**
 * Comprehensive Authentication Diagnosis Script
 * Diagnoses 401 authentication issues including:
 * - AUTH_SECRET configuration
 * - Cookie settings
 * - Session creation and verification
 * - Database connection
 * - Better-Auth configuration
 * - TRUST_HOST configuration
 */

import * as dotenv from 'dotenv';
import path from 'path';
import { existsSync } from 'fs';

// Load environment variables FIRST
const envPath = path.resolve(process.cwd(), '.env.local');
if (existsSync(envPath)) {
  dotenv.config({ path: envPath });
} else {
  console.error(`❌ 错误: 未找到环境文件: ${envPath}`);
  process.exit(1);
}
dotenv.config({ path: path.resolve(process.cwd(), '.env.development') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

console.log('═══════════════════════════════════════════════════════════');
console.log('🔍 Comprehensive Authentication Diagnosis');
console.log('═══════════════════════════════════════════════════════════\n');

// Test configurations
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
const AUTH_URL = process.env.AUTH_URL || process.env.NEXT_PUBLIC_APP_URL || '';
const AUTH_SECRET = process.env.AUTH_SECRET || '';

// Diagnosis results
const results: Array<{ name: string; status: '✅ PASS' | '❌ FAIL' | '⚠️ WARN'; message: string; details?: any }> = [];

function addResult(name: string, status: '✅ PASS' | '❌ FAIL' | '⚠️ WARN', message: string, details?: any) {
  results.push({ name, status, message, details });
  const icon = status === '✅ PASS' ? '✅' : status === '❌ FAIL' ? '❌' : '⚠️';
  console.log(`${icon} [${name}] ${message}`);
  if (details) {
    console.log(`   Details:`, details);
  }
  console.log('');
}

// 1. Check AUTH_SECRET
console.log('📋 1. AUTH_SECRET Configuration\n');
if (!AUTH_SECRET) {
  addResult('AUTH_SECRET', '❌ FAIL', 'AUTH_SECRET is not set', {
    impact: 'Authentication will fail - sessions cannot be encrypted/decrypted',
  });
} else if (AUTH_SECRET.length < 32) {
  addResult('AUTH_SECRET', '⚠️ WARN', `AUTH_SECRET is too short (${AUTH_SECRET.length} chars, recommended: >= 32)`, {
    length: AUTH_SECRET.length,
    recommendation: 'Generate with: openssl rand -base64 32',
  });
} else {
  addResult('AUTH_SECRET', '✅ PASS', `AUTH_SECRET is configured (length: ${AUTH_SECRET.length})`, {
    length: AUTH_SECRET.length,
    preview: `${AUTH_SECRET.substring(0, 10)}...`,
  });
}

// 2. Check AUTH_URL and APP_URL consistency
console.log('📋 2. URL Configuration\n');
const appUrlParsed = APP_URL ? new URL(APP_URL) : null;
const authUrlParsed = AUTH_URL ? new URL(AUTH_URL) : null;

if (!APP_URL) {
  addResult('APP_URL', '❌ FAIL', 'NEXT_PUBLIC_APP_URL is not set');
} else if (!appUrlParsed) {
  addResult('APP_URL', '❌ FAIL', `Invalid APP_URL format: ${APP_URL}`);
} else {
  addResult('APP_URL', '✅ PASS', `APP_URL: ${APP_URL}`, {
    protocol: appUrlParsed.protocol,
    hostname: appUrlParsed.hostname,
    port: appUrlParsed.port || 'default',
  });
}

if (!AUTH_URL) {
  addResult('AUTH_URL', '⚠️ WARN', 'AUTH_URL is not set (will use APP_URL)');
} else if (!authUrlParsed) {
  addResult('AUTH_URL', '❌ FAIL', `Invalid AUTH_URL format: ${AUTH_URL}`);
} else {
  addResult('AUTH_URL', '✅ PASS', `AUTH_URL: ${AUTH_URL}`, {
    protocol: authUrlParsed.protocol,
    hostname: authUrlParsed.hostname,
    port: authUrlParsed.port || 'default',
  });
}

// Check URL consistency
if (appUrlParsed && authUrlParsed) {
  const hostnameMatch = appUrlParsed.hostname === authUrlParsed.hostname;
  const protocolMatch = appUrlParsed.protocol === authUrlParsed.protocol;
  
  if (!hostnameMatch || !protocolMatch) {
    addResult('URL_CONSISTENCY', '⚠️ WARN', 'APP_URL and AUTH_URL do not match', {
      appUrlHostname: appUrlParsed.hostname,
      authUrlHostname: authUrlParsed.hostname,
      appUrlProtocol: appUrlParsed.protocol,
      authUrlProtocol: authUrlParsed.protocol,
      recommendation: 'For local development, both should use http://localhost:3000',
    });
  } else {
    addResult('URL_CONSISTENCY', '✅ PASS', 'APP_URL and AUTH_URL match');
  }
}

// 3. Check TRUST_HOST configuration
console.log('📋 3. TRUST_HOST Configuration\n');
const TRUST_HOST = process.env.BETTER_AUTH_TRUST_HOST || process.env.AUTH_TRUST_HOST || '';
const isVercel = process.env.VERCEL === '1';

if (isVercel && !TRUST_HOST) {
  addResult('TRUST_HOST', '⚠️ WARN', 'Running on Vercel but TRUST_HOST is not set', {
    recommendation: 'Set BETTER_AUTH_TRUST_HOST=true in Vercel environment variables',
    impact: 'Preview URLs may not be trusted, causing 401 errors',
  });
} else if (isVercel && TRUST_HOST === 'true') {
  addResult('TRUST_HOST', '✅ PASS', 'TRUST_HOST is enabled for Vercel');
} else if (!isVercel) {
  addResult('TRUST_HOST', '✅ PASS', 'Not on Vercel, TRUST_HOST check skipped');
}

// 4. Check Cookie settings
console.log('📋 4. Cookie Configuration\n');
const COOKIE_SECURE = process.env.BETTER_AUTH_COOKIE_SECURE || process.env.NEXT_PUBLIC_BETTER_AUTH_COOKIE_SECURE || 'false';
const isHttps = APP_URL?.startsWith('https://') || AUTH_URL?.startsWith('https://');

if (COOKIE_SECURE === 'true' && !isHttps) {
  addResult('COOKIE_SECURE', '❌ FAIL', 'Cookie Secure is enabled but using HTTP', {
    cookieSecure: COOKIE_SECURE,
    isHttps,
    impact: 'Cookies will not be sent over HTTP when Secure=true',
    recommendation: 'Set BETTER_AUTH_COOKIE_SECURE=false for local development',
  });
} else if (COOKIE_SECURE === 'false' && isHttps) {
  addResult('COOKIE_SECURE', '⚠️ WARN', 'Using HTTPS but Cookie Secure is disabled', {
    recommendation: 'Enable BETTER_AUTH_COOKIE_SECURE=true for production HTTPS',
  });
} else {
  addResult('COOKIE_SECURE', '✅ PASS', `Cookie Secure: ${COOKIE_SECURE} (${isHttps ? 'HTTPS' : 'HTTP'})`);
}

// Main diagnosis function (async)
async function runDiagnosis() {
  // 5. Check database connection
  console.log('📋 5. Database Connection\n');
  const DATABASE_URL = process.env.DATABASE_URL || '';

  if (!DATABASE_URL) {
    addResult('DATABASE_URL', '❌ FAIL', 'DATABASE_URL is not set', {
      impact: 'Better-Auth cannot connect to database to verify sessions',
    });
  } else {
    // Try to verify database connection by importing db
    try {
      // Dynamic import to avoid build-time database calls
      const { db } = await import('../src/core/db/index.js');
      addResult('DATABASE_URL', '✅ PASS', 'DATABASE_URL is configured', {
        urlLength: DATABASE_URL.length,
        hasSupabase: DATABASE_URL.includes('supabase'),
      });
      
      // Try to query session table (if exists)
      try {
        const { session } = await import('../src/config/db/schema.js');
        const { count } = await import('drizzle-orm');
        // This might fail if table doesn't exist, which is OK
        addResult('SESSION_TABLE', '✅ PASS', 'Session table schema is accessible');
      } catch (e: any) {
        addResult('SESSION_TABLE', '⚠️ WARN', 'Cannot access session table schema', {
          error: e.message,
        });
      }
    } catch (error: any) {
      addResult('DATABASE_CONNECTION', '❌ FAIL', 'Failed to connect to database', {
        error: error.message,
      });
    }
  }

  // 6. Test Better-Auth initialization
  console.log('📋 6. Better-Auth Initialization\n');
  try {
    const { getAuth } = await import('../src/core/auth/index.js');
    const auth = await getAuth();
    
    if (auth) {
      addResult('BETTER_AUTH_INIT', '✅ PASS', 'Better-Auth initialized successfully', {
        baseURL: (auth as any).options?.baseURL || 'not set',
      });
    } else {
      addResult('BETTER_AUTH_INIT', '❌ FAIL', 'Better-Auth returned null/undefined');
    }
  } catch (error: any) {
    addResult('BETTER_AUTH_INIT', '❌ FAIL', 'Failed to initialize Better-Auth', {
      error: error.message,
      stack: error.stack?.substring(0, 200),
    });
  }

  // 7. Test API endpoint accessibility
  console.log('📋 7. API Endpoint Accessibility\n');
  try {
    const response = await fetch(`${APP_URL}/api/auth/sign-in/email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: 'test@example.com',
        password: 'test',
      }),
    });
    
    // Don't expect success, but check if endpoint is accessible
    if (response.status === 404) {
      addResult('API_ENDPOINT', '❌ FAIL', 'Auth endpoint not found (404)', {
        url: `${APP_URL}/api/auth/sign-in/email`,
        recommendation: 'Check if server is running and route is correct',
      });
    } else if (response.status === 401 || response.status === 400) {
      // 401/400 is expected for invalid credentials
      addResult('API_ENDPOINT', '✅ PASS', 'Auth endpoint is accessible (returned expected error for invalid credentials)');
    } else {
      addResult('API_ENDPOINT', '✅ PASS', `Auth endpoint is accessible (status: ${response.status})`);
    }
  } catch (error: any) {
    addResult('API_ENDPOINT', '❌ FAIL', 'Cannot access auth endpoint', {
      error: error.message,
      url: `${APP_URL}/api/auth/sign-in/email`,
      recommendation: 'Check if server is running: pnpm dev',
    });
  }

// Summary
console.log('═══════════════════════════════════════════════════════════');
console.log('📊 Diagnosis Summary\n');

const passed = results.filter(r => r.status === '✅ PASS').length;
const failed = results.filter(r => r.status === '❌ FAIL').length;
const warnings = results.filter(r => r.status === '⚠️ WARN').length;

console.log(`   ✅ Passed: ${passed}`);
console.log(`   ❌ Failed: ${failed}`);
console.log(`   ⚠️  Warnings: ${warnings}`);
console.log(`   Total: ${results.length}\n`);

// Critical failures
const criticalFailures = results.filter(r => r.status === '❌ FAIL');
if (criticalFailures.length > 0) {
  console.log('❌ Critical Failures (must fix):\n');
  criticalFailures.forEach(r => {
    console.log(`   - ${r.name}: ${r.message}`);
  });
  console.log('');
}

// Recommendations
if (failed > 0 || warnings > 0) {
  console.log('💡 Recommendations:\n');
  
  if (criticalFailures.some(r => r.name === 'AUTH_SECRET')) {
    console.log('   1. Generate AUTH_SECRET: openssl rand -base64 32');
    console.log('   2. Add to .env.local: AUTH_SECRET=<generated-secret>');
    console.log('   3. Restart server: pnpm dev\n');
  }
  
  if (criticalFailures.some(r => r.name === 'DATABASE_URL') || criticalFailures.some(r => r.name === 'DATABASE_CONNECTION')) {
    console.log('   1. Check DATABASE_URL in .env.local');
    console.log('   2. Verify Supabase connection is working');
    console.log('   3. Test connection: pnpm tsx scripts/test-db-connection.ts\n');
  }
  
  if (results.some(r => r.name === 'URL_CONSISTENCY' && r.status !== '✅ PASS')) {
    console.log('   1. Ensure AUTH_URL matches APP_URL');
    console.log('   2. For local dev: Both should be http://localhost:3000');
    console.log('   3. Update .env.local accordingly\n');
  }
  
  if (results.some(r => r.name === 'COOKIE_SECURE' && r.status === '❌ FAIL')) {
    console.log('   1. For HTTP development: Set BETTER_AUTH_COOKIE_SECURE=false');
    console.log('   2. For HTTPS production: Set BETTER_AUTH_COOKIE_SECURE=true\n');
  }
  
  if (results.some(r => r.name === 'TRUST_HOST' && r.status === '⚠️ WARN')) {
    console.log('   1. For Vercel deployment: Set BETTER_AUTH_TRUST_HOST=true');
    console.log('   2. This allows Better-Auth to trust preview URLs\n');
  }
}

console.log('═══════════════════════════════════════════════════════════\n');

process.exit(failed > 0 ? 1 : 0);
}

// Run diagnosis
runDiagnosis().catch((error) => {
  console.error('❌ Diagnosis script failed:', error);
  process.exit(1);
});

#!/usr/bin/env tsx
/**
 * Authentication Flow Test Script
 * Tests login/logout flow and session management
 */

// Load .env.local file FIRST - MUST be before any other imports
import * as dotenv from 'dotenv';
import path from 'path';
import { existsSync } from 'fs';

// 1. 确定 .env.local 的绝对路径
const envPath = path.resolve(process.cwd(), '.env.local');

// 2. 检查文件是否存在（调试用）
if (existsSync(envPath)) {
  dotenv.config({ path: envPath });
} else {
  console.error(`❌ 错误: 未找到环境文件: ${envPath}`);
  process.exit(1);
}

// 3. 加载其他环境文件（优先级更低）
dotenv.config({ path: path.resolve(process.cwd(), '.env.development') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

// 4. 验证关键变量（可选，用于调试）
if (process.env.NODE_ENV === 'development' && !process.env.DATABASE_URL && !process.env.AUTH_SECRET) {
  console.warn('⚠️  警告: DATABASE_URL 或 AUTH_SECRET 未定义，请检查 .env.local 内容');
}

import { envConfigs } from '../src/config';
import { db } from '../src/core/db';
import { getAuth } from '../src/core/auth';

async function testAuthConfiguration() {
  console.log('🔍 Testing Authentication Configuration\n');
  console.log('═══════════════════════════════════════════════════════════\n');
  
  // Check 1: Environment Variables
  console.log('1️⃣ Environment Variables Check\n');
  
  const authSecret = envConfigs.auth_secret;
  const authUrl = envConfigs.auth_url;
  const appUrl = envConfigs.app_url;
  
  // Check AUTH_SECRET from process.env directly (may not be in envConfigs yet)
  const authSecretEnv = process.env.AUTH_SECRET;
  
  console.log(`   AUTH_SECRET (env): ${authSecretEnv ? `✅ Set (length: ${authSecretEnv.length})` : '❌ Not set'}`);
  console.log(`   AUTH_SECRET (config): ${authSecret ? `✅ Set (length: ${authSecret.length})` : '❌ Not set'}`);
  if (authSecretEnv && authSecret && authSecretEnv !== authSecret) {
    console.log(`   ⚠️  WARNING: AUTH_SECRET mismatch between env and config!`);
  }
  
  console.log(`   AUTH_URL: ${authUrl || '⚠️  Not set (using fallback)'}`);
  console.log(`   APP_URL: ${appUrl || '❌ Not set'}`);
  
  // Check Cookie settings
  const cookieSecure = process.env.BETTER_AUTH_COOKIE_SECURE || process.env.NEXT_PUBLIC_BETTER_AUTH_COOKIE_SECURE;
  const isHttps = authUrl?.startsWith('https://') || appUrl?.startsWith('https://');
  console.log(`   Cookie Secure: ${cookieSecure || '(not set, using default)'}`);
  if (!isHttps && cookieSecure === 'true') {
    console.log(`   ⚠️  WARNING: Cookie Secure=true but using HTTP! Cookies may not be sent.`);
  }
  
  console.log('');
  
  // Check 2: URL Consistency
  console.log('2️⃣ URL Consistency Check\n');
  
  const urlMatch = !authUrl || authUrl === appUrl || authUrl === appUrl + '/api/auth';
  if (urlMatch) {
    console.log('   ✅ AUTH_URL and APP_URL are consistent');
  } else {
    console.log('   ⚠️  AUTH_URL and APP_URL may not match');
    console.log(`      AUTH_URL: ${authUrl}`);
    console.log(`      APP_URL: ${appUrl}`);
    console.log('   💡 Suggestion: Ensure AUTH_URL matches your app domain');
  }
  console.log('');
  
  // Check 3: Domain Validation
  console.log('3️⃣ Domain Validation Check\n');
  
  if (authUrl) {
    try {
      const url = new URL(authUrl);
      const hostname = url.hostname;
      
      console.log(`   Hostname: ${hostname}`);
      console.log(`   Port: ${url.port || '(default)'}`);
      console.log(`   Protocol: ${url.protocol}`);
      
      if (hostname === 'localhost' || hostname === '127.0.0.1') {
        console.log('   ✅ Using localhost (suitable for local development)');
        
        // Check for localhost vs 127.0.0.1 mismatch
        if (authUrl.includes('localhost') && appUrl && appUrl.includes('127.0.0.1')) {
          console.log('   ❌ ERROR: AUTH_URL uses "localhost" but APP_URL uses "127.0.0.1"!');
          console.log('   💡 Fix: Use "localhost" consistently in both URLs');
        } else if (authUrl.includes('127.0.0.1') && appUrl && appUrl.includes('localhost')) {
          console.log('   ❌ ERROR: AUTH_URL uses "127.0.0.1" but APP_URL uses "localhost"!');
          console.log('   💡 Fix: Use "localhost" consistently in both URLs');
        } else {
          console.log('   ✅ localhost usage is consistent');
        }
        
        console.log('   💡 Important: Use "localhost" consistently, avoid mixing with "127.0.0.1"');
        console.log('   💡 Browser must access using the same hostname as AUTH_URL');
      } else {
        console.log(`   ✅ Using custom domain: ${hostname}`);
      }
      
      // Check protocol consistency
      const appProtocol = appUrl ? new URL(appUrl).protocol : null;
      if (appProtocol && url.protocol !== appProtocol) {
        console.log(`   ⚠️  WARNING: AUTH_URL uses ${url.protocol} but APP_URL uses ${appProtocol}`);
      }
      
    } catch (error: any) {
      console.log(`   ❌ Invalid AUTH_URL format: ${error.message}`);
    }
  } else {
    console.log('   ⚠️  AUTH_URL not set, using NEXT_PUBLIC_APP_URL fallback');
    if (appUrl) {
      try {
        const url = new URL(appUrl);
        console.log(`   Fallback hostname: ${url.hostname}`);
        console.log(`   💡 Consider setting AUTH_URL explicitly to avoid confusion`);
      } catch (e) {
        // Ignore
      }
    }
  }
  console.log('');
  
  // Check 4: Database Connection
  console.log('4️⃣ Database Connection Check\n');
  
  try {
    const database = db();
    const result = await database.execute('SELECT NOW() as current_time');
    console.log('   ✅ Database connection successful');
    console.log(`   Timestamp: ${result[0]?.current_time}`);
  } catch (error: any) {
    console.log(`   ❌ Database connection failed: ${error.message}`);
  }
  console.log('');
  
  // Check 5: Better-Auth Initialization
  console.log('5️⃣ Better-Auth Initialization Check\n');
  
  try {
    const auth = await getAuth();
    if (auth) {
      console.log('   ✅ Better-Auth initialized successfully');
    } else {
      console.log('   ❌ Better-Auth initialization failed');
    }
  } catch (error: any) {
    console.log(`   ❌ Better-Auth initialization error: ${error.message}`);
  }
  console.log('');
  
  // Check 6: Session Table
  console.log('6️⃣ Session Table Check\n');
  
  try {
    const database = db();
    const sessionCheck = await database.execute(`
      SELECT COUNT(*) as count 
      FROM session 
      WHERE "expiresAt" > NOW()
    `);
    const activeSessions = parseInt(sessionCheck[0]?.count || '0');
    console.log(`   ✅ Session table accessible`);
    console.log(`   Active sessions: ${activeSessions}`);
  } catch (error: any) {
    console.log(`   ❌ Session table check failed: ${error.message}`);
  }
  console.log('');
  
  // Summary
  console.log('═══════════════════════════════════════════════════════════');
  console.log('📋 Summary\n');
  console.log('✅ Configuration checks completed');
  console.log('💡 Next steps:');
  console.log('   1. Check browser cookies (better-auth.session_token)');
  console.log('   2. Verify AUTH_URL matches your browser address');
  console.log('   3. Test login/logout flow in browser');
  console.log('   4. Check server logs for [getSignUser] messages');
  console.log('');
}

// Run the test
testAuthConfiguration().catch((error) => {
  console.error('Unexpected error:', error);
  process.exit(1);
});

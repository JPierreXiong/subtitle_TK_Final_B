#!/usr/bin/env tsx
/**
 * Sign-Up Flow Test Script
 * Simulates user registration to diagnose 422 errors
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

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

console.log('═══════════════════════════════════════════════════════════');
console.log('🧪 Sign-Up Flow Test');
console.log('═══════════════════════════════════════════════════════════\n');

// Generate unique test email
const timestamp = Date.now();
const TEST_EMAIL = `test_${timestamp}@example.com`;
const TEST_PASSWORD = 'Test123456!'; // 12 characters, meets typical requirements
const TEST_NAME = 'Test User';

console.log('📋 Test Configuration:');
console.log(`   App URL: ${APP_URL}`);
console.log(`   Test Email: ${TEST_EMAIL}`);
console.log(`   Test Password: ${TEST_PASSWORD.length} characters`);
console.log(`   Test Name: ${TEST_NAME}\n`);

async function testSignUp() {
  console.log('🔍 1. Testing Server Connection\n');
  
  try {
    const response = await fetch(`${APP_URL}/`, {
      method: 'GET',
    });
    
    if (response.ok) {
      console.log(`✅ [SERVER] Server is accessible at ${APP_URL}`);
      console.log(`   Status: ${response.status}\n`);
    } else {
      console.log(`⚠️  [SERVER] Server responded with status ${response.status}\n`);
    }
  } catch (error: any) {
    console.error(`❌ [SERVER] Cannot connect to server: ${error.message}`);
    console.error(`   Please ensure server is running: pnpm dev\n`);
    process.exit(1);
  }

  console.log('🔍 2. Testing Sign-Up Endpoint\n');
  
  try {
    const requestBody = {
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
      name: TEST_NAME,
    };

    console.log('📤 Request:');
    console.log(`   URL: ${APP_URL}/api/auth/sign-up/email`);
    console.log(`   Method: POST`);
    console.log(`   Body:`, JSON.stringify(requestBody, null, 2));
    console.log('');

    const response = await fetch(`${APP_URL}/api/auth/sign-up/email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    console.log(`📥 Response:`);
    console.log(`   Status: ${response.status} ${response.statusText}`);
    console.log(`   Content-Type: ${response.headers.get('content-type')}`);
    console.log('');

    // Try to read response body
    let responseData: any = {};
    try {
      const text = await response.text();
      if (text) {
        try {
          responseData = JSON.parse(text);
        } catch (e) {
          responseData = { raw: text };
        }
      }
    } catch (e) {
      // Response body may be empty or not readable
      responseData = { error: 'Unable to read response body' };
    }

    console.log('📋 Response Body:');
    console.log(JSON.stringify(responseData, null, 2));
    console.log('');

    // Check for Set-Cookie header (successful registration)
    const setCookieHeader = response.headers.get('set-cookie');
    if (setCookieHeader) {
      const hasSessionToken = setCookieHeader.includes('better-auth.session_token');
      console.log(`🍪 Cookie Header:`);
      console.log(`   Set-Cookie: ${hasSessionToken ? '✅ better-auth.session_token present' : '❌ Not found'}`);
      console.log(`   Preview: ${setCookieHeader.substring(0, 100)}...\n`);
    } else {
      console.log(`🍪 Cookie Header: Not set\n`);
    }

    // Analyze response
    if (response.status === 200 || response.status === 201) {
      console.log('✅ [SIGN_UP] User registration successful!');
      console.log(`   User ID: ${responseData.user?.id || 'N/A'}`);
      console.log(`   Email: ${responseData.user?.email || TEST_EMAIL}`);
      console.log(`   Has Session Token: ${!!setCookieHeader}\n`);
      return true;
    } else if (response.status === 422) {
      console.log('❌ [SIGN_UP] Registration failed: 422 UNPROCESSABLE_ENTITY');
      console.log('');
      console.log('🔍 Error Analysis:');
      
      // Check for common validation errors
      const error = responseData.error || responseData.message || '';
      const errorLower = error.toLowerCase();

      if (errorLower.includes('email') && errorLower.includes('already') || errorLower.includes('exists')) {
        console.log('   💡 Issue: Email already exists in database');
        console.log('   💡 Solution: Try with a different email or delete existing user');
      } else if (errorLower.includes('email') && (errorLower.includes('invalid') || errorLower.includes('format'))) {
        console.log('   💡 Issue: Invalid email format');
        console.log('   💡 Solution: Check email format (should be valid email)');
      } else if (errorLower.includes('password') && (errorLower.includes('short') || errorLower.includes('min'))) {
        console.log('   💡 Issue: Password too short');
        console.log('   💡 Solution: Password should be at least 8 characters');
      } else if (errorLower.includes('password') && (errorLower.includes('weak') || errorLower.includes('strength'))) {
        console.log('   💡 Issue: Password too weak');
        console.log('   💡 Solution: Use stronger password (mix of letters, numbers, symbols)');
      } else if (errorLower.includes('name') && (errorLower.includes('required') || errorLower.includes('missing'))) {
        console.log('   💡 Issue: Name field is required');
        console.log('   💡 Solution: Ensure name field is provided');
      } else if (errorLower.includes('database') || errorLower.includes('constraint')) {
        console.log('   💡 Issue: Database constraint violation');
        console.log('   💡 Solution: Check database schema and constraints');
      } else {
        console.log('   💡 Issue: Validation error (unknown)');
        console.log('   💡 Check response body above for details');
      }
      
      console.log('');
      console.log('📋 Full Error Details:');
      console.log(JSON.stringify(responseData, null, 2));
      console.log('');
      
      return false;
    } else if (response.status === 409) {
      console.log('⚠️  [SIGN_UP] Email already exists (409 Conflict)');
      console.log('   This is expected if the email was already registered\n');
      return true; // Continue with login test
    } else {
      console.log(`❌ [SIGN_UP] Registration failed: ${response.status} ${response.statusText}`);
      console.log('   Error:', JSON.stringify(responseData, null, 2));
      console.log('');
      return false;
    }
  } catch (error: any) {
    console.error(`❌ [SIGN_UP] Request error: ${error.message}`);
    console.error('   Stack:', error.stack?.substring(0, 200));
    console.log('');
    return false;
  }
}

async function testLogin() {
  console.log('🔍 3. Testing Sign-In (if registration succeeded)\n');
  
  try {
    const requestBody = {
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
    };

    const response = await fetch(`${APP_URL}/api/auth/sign-in/email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    let responseData: any = {};
    try {
      const text = await response.text();
      if (text) {
        responseData = JSON.parse(text);
      }
    } catch (e) {
      // Response might not be JSON
    }

    if (response.status === 200 || response.status === 201) {
      console.log('✅ [SIGN_IN] Login successful!');
      const setCookieHeader = response.headers.get('set-cookie');
      console.log(`   Has Session Token: ${!!setCookieHeader}\n`);
      return true;
    } else {
      console.log(`⚠️  [SIGN_IN] Login failed: ${response.status}`);
      console.log('   Details:', JSON.stringify(responseData, null, 2));
      console.log('');
      return false;
    }
  } catch (error: any) {
    console.error(`❌ [SIGN_IN] Request error: ${error.message}\n`);
    return false;
  }
}

async function main() {
  const signUpResult = await testSignUp();
  
  if (signUpResult) {
    await testLogin();
  }

  console.log('═══════════════════════════════════════════════════════════');
  console.log('📊 Test Summary\n');
  
  if (signUpResult) {
    console.log('✅ Sign-up test: PASSED');
    console.log('💡 If 422 error occurred, check the error details above');
  } else {
    console.log('❌ Sign-up test: FAILED (422 or other error)');
    console.log('💡 Check the error analysis above for solutions');
  }
  
  console.log('\n═══════════════════════════════════════════════════════════\n');
  
  process.exit(signUpResult ? 0 : 1);
}

main().catch((error) => {
  console.error('❌ Test script failed:', error);
  process.exit(1);
});

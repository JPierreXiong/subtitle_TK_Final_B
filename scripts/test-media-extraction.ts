#!/usr/bin/env tsx

/**
 * Media Extraction Test Script
 * Tests subtitle and video extraction for TikTok/YouTube videos
 * 
 * Usage:
 *   pnpm tsx scripts/test-media-extraction.ts <url>
 * 
 * Example:
 *   pnpm tsx scripts/test-media-extraction.ts "https://www.tiktok.com/@eharmonyofficial/video/7587079480779296014"
 */

import * as dotenv from 'dotenv';
import path from 'path';
import { existsSync } from 'fs';

// Load .env.local
const envPath = path.resolve(process.cwd(), '.env.local');
if (existsSync(envPath)) {
  dotenv.config({ path: envPath });
} else {
  console.error(`❌ Environment file not found: ${envPath}`);
  process.exit(1);
}

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
const TEST_URL = process.argv[2] || 'https://www.tiktok.com/@eharmonyofficial/video/7587079480779296014?is_from_webapp=1&sender_device=pc';

interface TestResult {
  testName: string;
  status: 'PASS' | 'FAIL' | 'SKIP';
  message: string;
  details?: any;
  duration?: number;
}

const results: TestResult[] = [];

function addResult(result: TestResult) {
  results.push(result);
  const icon = result.status === 'PASS' ? '✅' : result.status === 'FAIL' ? '❌' : '⏭️';
  console.log(`${icon} ${result.testName}: ${result.message}`);
  if (result.details) {
    console.log(`   Details:`, JSON.stringify(result.details, null, 2));
  }
  if (result.duration) {
    console.log(`   Duration: ${result.duration}ms`);
  }
  console.log('');
}

interface MediaTaskResponse {
  code: number;
  message: string;
  data?: {
    taskId?: string;
    [key: string]: any;
  };
}

interface MediaTaskStatus {
  id: string;
  status: 'pending' | 'downloading' | 'processing' | 'extracted' | 'translating' | 'completed' | 'failed';
  progress: number;
  subtitleRaw?: string;
  subtitleTranslated?: string;
  videoUrlInternal?: string;
  errorMessage?: string;
  platform?: string;
  title?: string;
  author?: string;
  [key: string]: any;
}

/**
 * Test server accessibility
 */
async function testServerConnection(): Promise<boolean> {
  const startTime = Date.now();
  try {
    // Try to connect to root endpoint
    const rootResponse = await fetch(APP_URL, {
      method: 'GET',
      signal: AbortSignal.timeout(5000), // 5 second timeout
    });
    
    const duration = Date.now() - startTime;
    const isAccessible = rootResponse.status < 500; // Accept any status < 500 (even 404 is OK, server is running)
    
    addResult({
      testName: 'SERVER_CONNECTION',
      status: isAccessible ? 'PASS' : 'FAIL',
      message: isAccessible 
        ? `Server is accessible (status: ${rootResponse.status})` 
        : `Server returned ${rootResponse.status}`,
      details: { status: rootResponse.status, url: APP_URL },
      duration,
    });
    return isAccessible;
  } catch (error: any) {
    const duration = Date.now() - startTime;
    addResult({
      testName: 'SERVER_CONNECTION',
      status: 'FAIL',
      message: `Cannot connect to server: ${error.message}`,
      details: { 
        url: APP_URL, 
        error: error.message,
        suggestion: 'Make sure the development server is running: pnpm dev'
      },
      duration,
    });
    return false;
  }
}

/**
 * Submit media extraction task
 */
async function submitMediaTask(
  url: string,
  outputType: 'subtitle' | 'video',
  cookies?: string
): Promise<{ taskId: string | null; success: boolean; error?: string }> {
  const startTime = Date.now();
  try {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    if (cookies) {
      headers['Cookie'] = cookies;
    }

    const response = await fetch(`${APP_URL}/api/media/submit`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        url: url.trim(),
        outputType,
      }),
    });

    const duration = Date.now() - startTime;
    const contentType = response.headers.get('content-type');

    let data: MediaTaskResponse = { code: -1, message: 'Unknown error' };
    if (contentType?.includes('application/json')) {
      data = await response.json();
    } else {
      const text = await response.text();
      addResult({
        testName: `SUBMIT_${outputType.toUpperCase()}`,
        status: 'FAIL',
        message: `Unexpected response type: ${contentType}`,
        details: { status: response.status, text: text.substring(0, 200) },
        duration,
      });
      return { taskId: null, success: false, error: 'Invalid response' };
    }

    if (response.ok && data.code === 0 && data.data?.taskId) {
      addResult({
        testName: `SUBMIT_${outputType.toUpperCase()}`,
        status: 'PASS',
        message: `Task submitted successfully`,
        details: { taskId: data.data.taskId, outputType },
        duration,
      });
      return { taskId: data.data.taskId, success: true };
    } else {
      addResult({
        testName: `SUBMIT_${outputType.toUpperCase()}`,
        status: 'FAIL',
        message: data.message || `Task submission failed: ${response.status}`,
        details: { code: data.code, status: response.status },
        duration,
      });
      return { taskId: null, success: false, error: data.message };
    }
  } catch (error: any) {
    const duration = Date.now() - startTime;
    addResult({
      testName: `SUBMIT_${outputType.toUpperCase()}`,
      status: 'FAIL',
      message: `Submission error: ${error.message}`,
      details: { error: error.message },
      duration,
    });
    return { taskId: null, success: false, error: error.message };
  }
}

/**
 * Poll task status until completion or timeout
 */
async function pollTaskStatus(
  taskId: string,
  cookies?: string,
  timeoutMs: number = 300000 // 5 minutes
): Promise<MediaTaskStatus | null> {
  const startTime = Date.now();
  const pollInterval = 3000; // 3 seconds
  let lastStatus: string = '';

  while (Date.now() - startTime < timeoutMs) {
    try {
      const headers: HeadersInit = {};
      if (cookies) {
        headers['Cookie'] = cookies;
      }

      const response = await fetch(`${APP_URL}/api/media/status?id=${taskId}`, {
        headers,
      });
      if (!response.ok) {
        console.error(`   ⚠️  Status check failed: ${response.status}`);
        await new Promise(resolve => setTimeout(resolve, pollInterval));
        continue;
      }

      const { code, message, data } = await response.json();
      if (code !== 0 || !data) {
        console.error(`   ⚠️  Status check error: ${message}`);
        await new Promise(resolve => setTimeout(resolve, pollInterval));
        continue;
      }

      const taskData = data as MediaTaskStatus;
      const currentStatus = taskData.status;
      const progress = taskData.progress || 0;

      // Log status changes
      if (currentStatus !== lastStatus || progress % 20 === 0) {
        console.log(`   📊 Status: ${currentStatus} (${progress}%) - ${Math.round((Date.now() - startTime) / 1000)}s elapsed`);
        lastStatus = currentStatus;
      }

      // Check if task is in final state
      if (
        currentStatus === 'completed' ||
        currentStatus === 'extracted' ||
        currentStatus === 'failed'
      ) {
        const duration = Date.now() - startTime;
        console.log(`   ✅ Task completed: ${currentStatus} (took ${Math.round(duration / 1000)}s)`);
        return taskData;
      }

      // Wait before next poll
      await new Promise(resolve => setTimeout(resolve, pollInterval));
    } catch (error: any) {
      console.error(`   ⚠️  Polling error: ${error.message}`);
      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }
  }

  // Timeout
  console.error(`   ⏱️  Task polling timeout after ${Math.round(timeoutMs / 1000)}s`);
  return null;
}

/**
 * Test subtitle extraction
 */
async function testSubtitleExtraction(url: string, cookies: string): Promise<boolean> {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🧪 Test 1: Subtitle Extraction');
  console.log('═══════════════════════════════════════════════════════════\n');

  const { taskId, success } = await submitMediaTask(url, 'subtitle', cookies);
  
  if (!success || !taskId) {
    addResult({
      testName: 'SUBTITLE_EXTRACTION',
      status: 'FAIL',
      message: 'Task submission failed',
    });
    return false;
  }

  console.log(`📋 Polling task status: ${taskId}\n`);
  const taskResult = await pollTaskStatus(taskId, cookies);

  if (!taskResult) {
    addResult({
      testName: 'SUBTITLE_EXTRACTION',
      status: 'FAIL',
      message: 'Task polling timeout or error',
    });
    return false;
  }

  // Analyze results
  const hasSubtitle = !!taskResult.subtitleRaw;
  const status = taskResult.status;
  const error = taskResult.errorMessage;

  if (status === 'extracted' || status === 'completed') {
    addResult({
      testName: 'SUBTITLE_EXTRACTION',
      status: 'PASS',
      message: `Extraction successful: ${status}`,
      details: {
        status,
        hasSubtitle,
        subtitleLength: taskResult.subtitleRaw?.length || 0,
        platform: taskResult.platform,
        title: taskResult.title,
        author: taskResult.author,
      },
    });
    return true;
  } else if (status === 'failed') {
    addResult({
      testName: 'SUBTITLE_EXTRACTION',
      status: 'FAIL',
      message: `Extraction failed: ${error || 'Unknown error'}`,
      details: { status, error, progress: taskResult.progress },
    });
    return false;
  } else {
    addResult({
      testName: 'SUBTITLE_EXTRACTION',
      status: 'FAIL',
      message: `Unexpected status: ${status}`,
      details: { status, progress: taskResult.progress },
    });
    return false;
  }
}

/**
 * Test video extraction
 */
async function testVideoExtraction(url: string, cookies: string): Promise<boolean> {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🧪 Test 2: Video Extraction');
  console.log('═══════════════════════════════════════════════════════════\n');

  const { taskId, success } = await submitMediaTask(url, 'video', cookies);
  
  if (!success || !taskId) {
    addResult({
      testName: 'VIDEO_EXTRACTION',
      status: 'FAIL',
      message: 'Task submission failed',
    });
    return false;
  }

  console.log(`📋 Polling task status: ${taskId}\n`);
  const taskResult = await pollTaskStatus(taskId, cookies);

  if (!taskResult) {
    addResult({
      testName: 'VIDEO_EXTRACTION',
      status: 'FAIL',
      message: 'Task polling timeout or error',
    });
    return false;
  }

  // Analyze results
  const hasVideo = !!taskResult.videoUrlInternal;
  const status = taskResult.status;
  const error = taskResult.errorMessage;

  if (status === 'extracted' || status === 'completed') {
    addResult({
      testName: 'VIDEO_EXTRACTION',
      status: 'PASS',
      message: `Extraction successful: ${status}`,
      details: {
        status,
        hasVideo,
        videoUrlInternal: taskResult.videoUrlInternal?.substring(0, 100) + '...',
        platform: taskResult.platform,
        title: taskResult.title,
        author: taskResult.author,
        expiresAt: taskResult.expiresAt,
      },
    });
    return true;
  } else if (status === 'failed') {
    addResult({
      testName: 'VIDEO_EXTRACTION',
      status: 'FAIL',
      message: `Extraction failed: ${error || 'Unknown error'}`,
      details: { status, error, progress: taskResult.progress },
    });
    return false;
  } else {
    addResult({
      testName: 'VIDEO_EXTRACTION',
      status: 'FAIL',
      message: `Unexpected status: ${status}`,
      details: { status, progress: taskResult.progress },
    });
    return false;
  }
}

/**
 * Sign in to get session cookie
 */
async function signIn(email?: string, password?: string): Promise<string | null> {
  const testEmail = email || process.env.TEST_EMAIL || `test_${Date.now()}@example.com`;
  const testPassword = password || process.env.TEST_PASSWORD || 'Test123456!';
  
  try {
    // Try to sign in first
    const signInResponse = await fetch(`${APP_URL}/api/auth/sign-in/email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: testEmail,
        password: testPassword,
      }),
    });

    if (signInResponse.ok) {
      const setCookieHeader = signInResponse.headers.get('set-cookie');
      if (setCookieHeader && setCookieHeader.includes('better-auth.session_token')) {
        console.log(`   ✅ Signed in as: ${testEmail}`);
        return setCookieHeader;
      }
    }

    // If sign-in failed, try to sign up
    console.log(`   ⚠️  Sign-in failed, attempting sign-up...`);
    const signUpResponse = await fetch(`${APP_URL}/api/auth/sign-up/email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: testEmail,
        password: testPassword,
        name: 'Test User',
      }),
    });

    if (signUpResponse.ok) {
      const setCookieHeader = signUpResponse.headers.get('set-cookie');
      if (setCookieHeader && setCookieHeader.includes('better-auth.session_token')) {
        console.log(`   ✅ Signed up and signed in as: ${testEmail}`);
        return setCookieHeader;
      }
    }

    console.error(`   ❌ Failed to sign in or sign up`);
    return null;
  } catch (error: any) {
    console.error(`   ❌ Sign-in error: ${error.message}`);
    return null;
  }
}

/**
 * Main test function
 */
async function runTests() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🎬 Media Extraction Test Suite');
  console.log('═══════════════════════════════════════════════════════════\n');
  console.log('📋 Test Configuration:');
  console.log(`   App URL: ${APP_URL}`);
  console.log(`   Test URL: ${TEST_URL}`);
  console.log(`   Timestamp: ${new Date().toISOString()}\n`);

  // Test 1: Server connection
  const serverOk = await testServerConnection();
  if (!serverOk) {
    console.log('❌ Server connection failed. Aborting tests.\n');
    generateReport();
    process.exit(1);
  }

  // Test 2: Authentication
  console.log('🔐 Authenticating...\n');
  const cookies = await signIn();
  
  if (!cookies) {
    addResult({
      testName: 'AUTHENTICATION',
      status: 'FAIL',
      message: 'Failed to sign in or sign up',
      details: {
        suggestion: 'Please check TEST_EMAIL and TEST_PASSWORD environment variables or create a test account',
      },
    });
    generateReport();
    process.exit(1);
  }

  addResult({
    testName: 'AUTHENTICATION',
    status: 'PASS',
    message: 'Successfully authenticated',
  });

  // Wait for session to stabilize (especially for newly registered users)
  console.log('⏳ Waiting for session to stabilize...\n');
  await new Promise(resolve => setTimeout(resolve, 3000)); // Wait 3 seconds (increased from 2s)

  // Verify session is working by calling get-user-info
  try {
    const verifyResponse = await fetch(`${APP_URL}/api/user/get-user-info`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': cookies,
      },
    });
    
    if (verifyResponse.ok) {
      console.log('   ✅ Session verified successfully\n');
    } else {
      console.log(`   ⚠️  Session verification returned ${verifyResponse.status}, continuing anyway...\n`);
    }
  } catch (error: any) {
    console.log(`   ⚠️  Session verification error: ${error.message}, continuing anyway...\n`);
  }

  // Test 3: Subtitle extraction
  const subtitleOk = await testSubtitleExtraction(TEST_URL, cookies);

  // Test 4: Video extraction
  const videoOk = await testVideoExtraction(TEST_URL, cookies);

  // Generate report
  generateReport();
}

/**
 * Generate test report
 */
function generateReport() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('📊 Test Report');
  console.log('═══════════════════════════════════════════════════════════\n');

  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  const skipped = results.filter(r => r.status === 'SKIP').length;
  const total = results.length;

  console.log('📈 Summary:');
  console.log(`   Total Tests: ${total}`);
  console.log(`   ✅ Passed: ${passed}`);
  console.log(`   ❌ Failed: ${failed}`);
  console.log(`   ⏭️  Skipped: ${skipped}\n`);

  console.log('📋 Detailed Results:');
  results.forEach((result, index) => {
    const icon = result.status === 'PASS' ? '✅' : result.status === 'FAIL' ? '❌' : '⏭️';
    console.log(`\n${index + 1}. ${icon} ${result.testName}`);
    console.log(`   Status: ${result.status}`);
    console.log(`   Message: ${result.message}`);
    if (result.details) {
      console.log(`   Details:`, JSON.stringify(result.details, null, 2));
    }
    if (result.duration) {
      console.log(`   Duration: ${result.duration}ms`);
    }
  });

  console.log('\n═══════════════════════════════════════════════════════════\n');

  // Save report to file
  const reportPath = path.resolve(process.cwd(), 'MEDIA_EXTRACTION_TEST_REPORT.md');
  const reportContent = generateMarkdownReport();
  
  try {
    const fs = require('fs');
    fs.writeFileSync(reportPath, reportContent, 'utf-8');
    console.log(`📄 Report saved to: ${reportPath}\n`);
  } catch (error) {
    console.error('❌ Failed to save report:', error);
  }
}

/**
 * Generate markdown report
 */
function generateMarkdownReport(): string {
  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  const skipped = results.filter(r => r.status === 'SKIP').length;
  const total = results.length;

  let report = `# Media Extraction Test Report\n\n`;
  report += `**Generated:** ${new Date().toISOString()}\n`;
  report += `**Test URL:** ${TEST_URL}\n`;
  report += `**App URL:** ${APP_URL}\n\n`;

  report += `## Summary\n\n`;
  report += `| Metric | Count |\n`;
  report += `|--------|-------|\n`;
  report += `| Total Tests | ${total} |\n`;
  report += `| ✅ Passed | ${passed} |\n`;
  report += `| ❌ Failed | ${failed} |\n`;
  report += `| ⏭️  Skipped | ${skipped} |\n\n`;

  report += `## Detailed Results\n\n`;
  results.forEach((result, index) => {
    const icon = result.status === 'PASS' ? '✅' : result.status === 'FAIL' ? '❌' : '⏭️';
    report += `### ${index + 1}. ${icon} ${result.testName}\n\n`;
    report += `- **Status:** ${result.status}\n`;
    report += `- **Message:** ${result.message}\n`;
    if (result.details) {
      report += `- **Details:**\n\`\`\`json\n${JSON.stringify(result.details, null, 2)}\n\`\`\`\n`;
    }
    if (result.duration) {
      report += `- **Duration:** ${result.duration}ms\n`;
    }
    report += `\n`;
  });

  return report;
}

// Run tests
runTests().catch((error) => {
  console.error('❌ Test execution failed:', error);
  process.exit(1);
});

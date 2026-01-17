#!/usr/bin/env tsx

/**
 * Add Test Credits Script
 * Grants 50 credits to a test user for testing purposes
 * 
 * Usage:
 *   pnpm tsx scripts/add-test-credits.ts <email>
 * 
 * Example:
 *   pnpm tsx scripts/add-test-credits.ts test@example.com
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

async function addTestCredits(email: string, credits: number = 50) {
  try {
    // Dynamic import to avoid build-time database calls
    const { createCredit } = await import('../src/shared/models/credit.js');
    const { CreditStatus, CreditTransactionType } = await import('../src/shared/models/credit.js');
    const { getUuid, getSnowId } = await import('../src/shared/lib/hash.js');

    console.log('═══════════════════════════════════════════════════════════');
    console.log('💰 Add Test Credits');
    console.log('═══════════════════════════════════════════════════════════\n');
    console.log(`📋 Configuration:`);
    console.log(`   Email: ${email}`);
    console.log(`   Credits: ${credits}`);
    console.log(`   Timestamp: ${new Date().toISOString()}\n`);

    // Find user by email
    console.log('🔍 Finding user...');
    const { getUsers } = await import('../src/shared/models/user.js');
    const users = await getUsers({ email, limit: 1 });
    
    if (!users || users.length === 0) {
      console.error(`❌ User not found: ${email}`);
      console.log('\n💡 Suggestion: Create the user first by running the test script');
      process.exit(1);
    }

    const user = users[0];
    console.log(`✅ User found: ${user.id} (${user.email})\n`);

    // Create credit record
    console.log('💳 Creating credit record...');
    const creditResult = await createCredit({
      id: getUuid(),
      transactionNo: getSnowId(),
      userId: user.id,
      transactionType: CreditTransactionType.GRANT,
      credits: credits,
      remainingCredits: credits,
      status: CreditStatus.ACTIVE,
      expiresAt: null, // Never expires for test credits
      description: `Test credits granted for testing purposes`,
      metadata: JSON.stringify({
        type: 'test-credits',
        grantedAt: new Date().toISOString(),
      }),
    });

    if (creditResult) {
      console.log(`✅ Credits granted successfully!`);
      console.log(`\n📊 Credit Details:`);
      console.log(`   Credit ID: ${creditResult.id}`);
      console.log(`   Credits: ${credits}`);
      console.log(`   Remaining: ${creditResult.remainingCredits}`);
      console.log(`   Status: ${creditResult.status}`);
      console.log(`   Expires: ${creditResult.expiresAt ? new Date(creditResult.expiresAt).toISOString() : 'Never'}\n`);
      
      // Verify total credits
      const { getRemainingCredits } = await import('../src/shared/models/credit.js');
      const totalCredits = await getRemainingCredits(user.id);
      console.log(`💰 Total Credits for ${email}: ${totalCredits}\n`);
      
      return true;
    } else {
      console.error(`❌ Failed to create credit record`);
      return false;
    }
  } catch (error: any) {
    console.error(`❌ Error adding credits:`, error);
    console.error(`   Message: ${error.message}`);
    if (error.stack) {
      console.error(`   Stack: ${error.stack.substring(0, 300)}`);
    }
    return false;
  }
}

// Main execution
const email = process.argv[2];
const credits = parseInt(process.argv[3] || '50');

if (!email) {
  console.error('❌ Email is required');
  console.log('\nUsage: pnpm tsx scripts/add-test-credits.ts <email> [credits]');
  console.log('Example: pnpm tsx scripts/add-test-credits.ts test@example.com 50');
  process.exit(1);
}

addTestCredits(email, credits)
  .then((success) => {
    if (success) {
      console.log('═══════════════════════════════════════════════════════════');
      console.log('✅ Test credits added successfully!\n');
      process.exit(0);
    } else {
      console.log('═══════════════════════════════════════════════════════════');
      console.log('❌ Failed to add test credits\n');
      process.exit(1);
    }
  })
  .catch((error) => {
    console.error('❌ Unexpected error:', error);
    process.exit(1);
  });

#!/usr/bin/env tsx
/**
 * Environment Variables Check Script
 * Validates that .env.local is correctly loaded
 */

import * as dotenv from 'dotenv';
import path from 'path';
import { existsSync } from 'fs';

console.log('═══════════════════════════════════════════════════════════');
console.log('🔍 Environment Variables Check');
console.log('═══════════════════════════════════════════════════════════\n');

// 1. 确定 .env.local 的绝对路径
const envPath = path.resolve(process.cwd(), '.env.local');
const currentDir = process.cwd();

console.log('📁 Directory Info:');
console.log(`   Current Directory: ${currentDir}`);
console.log(`   .env.local Path: ${envPath}`);
console.log(`   File Exists: ${existsSync(envPath) ? '✅ Yes' : '❌ No'}\n`);

// 2. 检查文件是否存在
if (!existsSync(envPath)) {
  console.error(`❌ 错误: 未找到环境文件: ${envPath}`);
  console.error('💡 请确保 .env.local 文件存在于项目根目录');
  process.exit(1);
}

console.log(`✅ 找到环境文件: ${envPath}\n`);

// 3. 加载环境变量
dotenv.config({ path: envPath });
dotenv.config({ path: path.resolve(process.cwd(), '.env.development') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

console.log('📋 Environment Variables:\n');

// 4. 检查关键环境变量
const requiredVars = [
  'DATABASE_URL',
  'AUTH_SECRET',
  'NEXT_PUBLIC_APP_URL',
];

const optionalVars = [
  'AUTH_URL',
  'DATABASE_PROVIDER',
  'NEXT_PUBLIC_RAPIDAPI_KEY',
  'GEMINI_API_KEY',
  'QSTASH_TOKEN',
  'QSTASH_URL',
];

let allRequiredPresent = true;

console.log('🔴 Required Variables:');
for (const varName of requiredVars) {
  const value = process.env[varName];
  if (value) {
    const maskedValue = varName === 'DATABASE_URL' || varName === 'AUTH_SECRET'
      ? `${value.substring(0, 20)}... (length: ${value.length})`
      : value;
    console.log(`   ✅ ${varName}: ${maskedValue}`);
  } else {
    console.log(`   ❌ ${varName}: 未设置`);
    allRequiredPresent = false;
  }
}

console.log('\n🟡 Optional Variables:');
for (const varName of optionalVars) {
  const value = process.env[varName];
  if (value) {
    const maskedValue = varName.includes('TOKEN') || varName.includes('KEY') || varName.includes('SECRET')
      ? `${value.substring(0, 20)}... (length: ${value.length})`
      : value;
    console.log(`   ✅ ${varName}: ${maskedValue}`);
  } else {
    console.log(`   ⚠️  ${varName}: 未设置`);
  }
}

console.log('\n═══════════════════════════════════════════════════════════');

if (!allRequiredPresent) {
  console.error('\n❌ 错误: 缺少必需的环境变量！');
  console.error('💡 请检查 .env.local 文件内容');
  process.exit(1);
} else {
  console.log('\n✅ 所有必需的环境变量已正确加载！\n');
  process.exit(0);
}

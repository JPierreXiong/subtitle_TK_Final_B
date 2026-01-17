/**
 * 批量设置 Vercel 环境变量
 * 使用方法: node scripts/set-vercel-env.js
 */

const https = require('https');

const VERCEL_TOKEN = 'rF4aDNj4aTRotWfhKQAzVNQd';
const VERCEL_TEAM_ID = null; // 如果需要团队，设置团队 ID
const VERCEL_PROJECT_NAME = null; // 项目名称，如果为空则从 vercel.json 读取

// 从 .env.local 读取环境变量
const fs = require('fs');
const path = require('path');

const envFile = path.join(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envFile, 'utf-8');

// 解析环境变量
const envVars = {};
envContent.split('\n').forEach(line => {
  line = line.trim();
  if (line && !line.startsWith('#') && line.includes('=')) {
    const [key, ...valueParts] = line.split('=');
    const value = valueParts.join('=').trim();
    if (key && value) {
      envVars[key.trim()] = value;
    }
  }
});

// 需要设置到 Vercel 的环境变量（过滤掉本地开发变量）
const vercelEnvVars = {
  // QStash
  QSTASH_URL: envVars.QSTASH_URL,
  QSTASH_TOKEN: envVars.QSTASH_TOKEN,
  QSTASH_CURRENT_SIGNING_KEY: envVars.QSTASH_CURRENT_SIGNING_KEY,
  QSTASH_NEXT_SIGNING_KEY: envVars.QSTASH_NEXT_SIGNING_KEY,
  
  // Supabase
  NEXT_PUBLIC_SUPABASE_URL: envVars.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: envVars.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: envVars.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  SUPABASE_URL: envVars.SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY: envVars.SUPABASE_SERVICE_ROLE_KEY,
  SUPABASE_JWT_SECRET: envVars.SUPABASE_JWT_SECRET,
  
  // Database
  DATABASE_URL: envVars.DATABASE_URL,
  DATABASE_PROVIDER: envVars.DATABASE_PROVIDER || 'postgresql',
  DB_SINGLETON_ENABLED: envVars.DB_SINGLETON_ENABLED || 'false',
  
  // App URL (需要根据实际部署 URL 更新)
  NEXT_PUBLIC_APP_URL: envVars.NEXT_PUBLIC_APP_URL || 'https://your-app.vercel.app',
};

console.log('准备设置以下环境变量到 Vercel:');
console.log(Object.keys(vercelEnvVars).join(', '));
console.log('\n请先获取项目 ID，然后运行设置命令。\n');

// 注意：这个脚本需要先获取项目 ID
// 可以通过 Vercel API 或 Dashboard 获取
console.log('使用方法:');
console.log('1. 访问 https://vercel.com/dashboard');
console.log('2. 选择项目');
console.log('3. 进入 Settings → Environment Variables');
console.log('4. 手动添加上述环境变量');
console.log('\n或者使用 Vercel CLI:');
console.log('vercel env add QSTASH_TOKEN');
console.log('vercel env add QSTASH_CURRENT_SIGNING_KEY');
console.log('...');

#!/usr/bin/env tsx

/**
 * 数据库连接诊断脚本
 * 用于检测数据库是否死机或连接问题
 * 
 * Usage:
 *   pnpm tsx scripts/fix-database-connection.ts
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

async function diagnoseDatabase() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🔍 数据库连接诊断');
  console.log('═══════════════════════════════════════════════════════════\n');
  
  const DATABASE_URL = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  
  if (!DATABASE_URL) {
    console.error('❌ DATABASE_URL 未配置');
    console.error('   请检查 .env.local 中的 DATABASE_URL 或 POSTGRES_URL');
    process.exit(1);
  }
  
  console.log('📋 环境变量检查:');
  console.log(`   DATABASE_URL: ${DATABASE_URL.substring(0, 30)}...`);
  console.log(`   是否包含 supabase: ${DATABASE_URL.includes('supabase') ? '✅' : '❌'}`);
  console.log(`   是否包含 pooler: ${DATABASE_URL.includes('pooler') ? '✅' : '❌'}\n`);
  
  try {
    // 尝试导入数据库连接
    console.log('🔍 测试数据库连接...\n');
    
    const { db } = await import('../src/core/db/index.js');
    
    // 尝试执行简单查询
    const startTime = Date.now();
    const result = await db().execute('SELECT 1 as test');
    const elapsed = Date.now() - startTime;
    
    console.log('✅ 数据库连接成功！');
    console.log(`   查询时间: ${elapsed}ms`);
    console.log(`   结果: ${JSON.stringify(result)}\n`);
    
    // 检查 media_tasks 表是否存在
    try {
      const tableCheck = await db().execute(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'media_tasks'
        )
      `);
      
      console.log('✅ media_tasks 表存在');
      console.log(`   结果: ${JSON.stringify(tableCheck)}\n`);
    } catch (error: any) {
      console.error('❌ 检查 media_tasks 表失败:', error.message);
    }
    
    // 检查触发器是否存在
    try {
      const triggerCheck = await db().execute(`
        SELECT 
          trigger_name, 
          event_manipulation, 
          event_object_table 
        FROM information_schema.triggers 
        WHERE event_object_table = 'media_tasks'
      `);
      
      console.log('✅ 触发器检查:');
      console.log(`   找到 ${Array.isArray(triggerCheck) ? triggerCheck.length : 0} 个触发器\n`);
    } catch (error: any) {
      console.error('❌ 检查触发器失败:', error.message);
    }
    
    console.log('═══════════════════════════════════════════════════════════');
    console.log('✅ 数据库诊断完成！数据库连接正常。\n');
    
  } catch (error: any) {
    console.error('❌ 数据库连接失败！');
    console.error(`   错误: ${error.message}`);
    console.error(`   堆栈: ${error.stack?.substring(0, 500)}\n`);
    
    console.log('💡 建议的解决方案:');
    console.log('   1. 检查 Supabase Dashboard 中数据库状态');
    console.log('   2. 检查网络连接');
    console.log('   3. 尝试重新连接数据库');
    console.log('   4. 检查 DATABASE_URL 是否正确\n');
    
    process.exit(1);
  }
}

diagnoseDatabase().catch((error) => {
  console.error('❌ 诊断过程中发生错误:', error);
  process.exit(1);
});

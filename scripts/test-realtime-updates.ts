#!/usr/bin/env tsx

/**
 * Supabase Realtime 测试脚本
 * 测试 media_tasks 表的实时更新功能
 * 
 * Usage:
 *   pnpm tsx scripts/test-realtime-updates.ts
 */

import * as dotenv from 'dotenv';
import path from 'path';
import { existsSync } from 'fs';
import { createClient } from '@supabase/supabase-js';

// Load .env.local
const envPath = path.resolve(process.cwd(), '.env.local');
if (existsSync(envPath)) {
  dotenv.config({ path: envPath });
} else {
  console.error(`❌ Environment file not found: ${envPath}`);
  process.exit(1);
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ Missing Supabase environment variables:');
  console.error('   NEXT_PUBLIC_SUPABASE_URL:', SUPABASE_URL ? '✅' : '❌');
  console.error('   NEXT_PUBLIC_SUPABASE_ANON_KEY:', SUPABASE_ANON_KEY ? '✅' : '❌');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function testRealtimeUpdates() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🧪 Supabase Realtime 测试');
  console.log('═══════════════════════════════════════════════════════════\n');
  
  console.log('📋 配置信息:');
  console.log(`   Supabase URL: ${SUPABASE_URL}`);
  console.log(`   Anon Key: ${SUPABASE_ANON_KEY ? SUPABASE_ANON_KEY.substring(0, 20) + '...' : 'NOT SET'}\n`);

  // 1. 测试数据库连接
  console.log('🔍 1. 测试数据库连接\n');
  try {
    const { data, error } = await supabase
      .from('media_tasks')
      .select('id, status, progress')
      .limit(1);
    
    if (error) {
      console.error('❌ 数据库连接失败:', error.message);
      console.error('   可能原因:');
      console.error('   1. RLS 策略阻止访问');
      console.error('   2. 表不存在');
      console.error('   3. 权限不足\n');
      return false;
    }
    
    console.log('✅ 数据库连接成功');
    console.log(`   找到 ${data?.length || 0} 条记录\n`);
  } catch (error: any) {
    console.error('❌ 数据库连接错误:', error.message);
    return false;
  }

  // 2. 测试 Realtime 订阅
  console.log('🔍 2. 测试 Realtime 订阅\n');
  
  // 创建一个测试任务 ID（使用一个不存在的 ID 来测试订阅）
  const testTaskId = `test-${Date.now()}`;
  
  return new Promise<boolean>((resolve) => {
    let subscriptionReceived = false;
    let subscriptionError = false;
    
    const channel = supabase
      .channel(`test-realtime-${testTaskId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'media_tasks',
          filter: `id=eq.${testTaskId}`,
        },
        (payload) => {
          console.log('✅ 收到实时更新:', payload);
          subscriptionReceived = true;
          resolve(true);
        }
      )
      .subscribe((status) => {
        console.log(`   订阅状态: ${status}`);
        
        if (status === 'SUBSCRIBED') {
          console.log('✅ 成功订阅 Realtime 更新\n');
          
          // 3. 测试触发器（更新一条记录）
          console.log('🔍 3. 测试触发器（更新记录）\n');
          
          // 先创建一个测试任务
          supabase
            .from('media_tasks')
            .insert({
              id: testTaskId,
              user_id: 'test-user',
              platform: 'tiktok',
              video_url: 'https://test.com/video',
              status: 'pending',
              progress: 0,
            })
            .then(({ error: insertError }) => {
              if (insertError) {
                console.error('❌ 创建测试任务失败:', insertError.message);
                console.error('   可能原因:');
                console.error('   1. RLS 策略阻止插入');
                console.error('   2. 缺少必需字段');
                console.error('   3. 外键约束失败\n');
                subscriptionError = true;
                resolve(false);
                return;
              }
              
              console.log('✅ 测试任务已创建');
              console.log('   等待 2 秒后更新任务状态...\n');
              
              // 等待 2 秒后更新任务
              setTimeout(async () => {
                const { error: updateError } = await supabase
                  .from('media_tasks')
                  .update({
                    status: 'processing',
                    progress: 50,
                    updated_at: new Date().toISOString(),
                  })
                  .eq('id', testTaskId);
                
                if (updateError) {
                  console.error('❌ 更新任务失败:', updateError.message);
                  subscriptionError = true;
                  resolve(false);
                  return;
                }
                
                console.log('✅ 任务已更新');
                console.log('   等待实时更新...\n');
                
                // 等待 5 秒接收实时更新
                setTimeout(() => {
                  if (!subscriptionReceived && !subscriptionError) {
                    console.log('⚠️  未收到实时更新（5秒超时）');
                    console.log('   可能原因:');
                    console.log('   1. Replication 未启用');
                    console.log('   2. updated_at 触发器未工作');
                    console.log('   3. 网络延迟\n');
                    resolve(false);
                  }
                  
                  // 清理测试数据
                  supabase
                    .from('media_tasks')
                    .delete()
                    .eq('id', testTaskId)
                    .then(() => {
                      console.log('🧹 测试数据已清理\n');
                    });
                  
                  supabase.removeChannel(channel);
                }, 5000);
              }, 2000);
            });
        } else if (status === 'CHANNEL_ERROR') {
          console.error('❌ 订阅失败: CHANNEL_ERROR');
          console.error('   可能原因:');
          console.error('   1. Replication 未启用');
          console.error('   2. RLS 策略阻止访问');
          console.error('   3. 网络连接问题\n');
          subscriptionError = true;
          resolve(false);
        }
      });
  });
}

// 运行测试
testRealtimeUpdates()
  .then((success) => {
    console.log('═══════════════════════════════════════════════════════════');
    console.log('📊 测试结果');
    console.log('═══════════════════════════════════════════════════════════\n');
    
    if (success) {
      console.log('✅ Supabase Realtime 配置成功！');
      console.log('   实时更新功能正常工作。\n');
    } else {
      console.log('❌ Supabase Realtime 配置失败！');
      console.log('   请检查:');
      console.log('   1. SQL 脚本是否已执行');
      console.log('   2. Replication 是否已启用');
      console.log('   3. RLS 策略是否正确配置\n');
    }
    
    process.exit(success ? 0 : 1);
  })
  .catch((error) => {
    console.error('❌ 测试过程中发生错误:', error);
    process.exit(1);
  });

#!/usr/bin/env tsx

/**
 * 通过 API 测试改写功能
 * 自动查找可用任务 → 测试改写功能
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

const API_BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
const TEST_STYLE = 'viral';
const TEST_TARGET_LANG = 'zh-CN';

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function testRewriteViaAPI() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🧪 通过 API 测试改写功能');
  console.log('═══════════════════════════════════════════════════════════\n');
  
  console.log('📋 测试配置:');
  console.log(`   API URL: ${API_BASE_URL}`);
  console.log(`   风格: ${TEST_STYLE}`);
  console.log(`   目标语言: ${TEST_TARGET_LANG}\n`);

  try {
    // Step 1: 获取任务列表（查找可用任务）
    console.log('🔍 步骤 1: 查找可用任务...\n');
    
    let taskId: string | null = null;
    
    try {
      const historyResponse = await fetch(`${API_BASE_URL}/api/media/history?page=1&limit=10`);
      
      if (historyResponse.ok) {
        const historyData = await historyResponse.json();
        
        if (historyData.code === 0 && historyData.data?.list) {
          // 查找状态为 extracted 或 completed 且有字幕的任务
          const availableTask = historyData.data.list.find(
            (task: any) => 
              (task.status === 'extracted' || task.status === 'completed') &&
              task.subtitleRaw &&
              task.subtitleRaw.trim().length > 0
          );

          if (availableTask) {
            taskId = availableTask.id;
            console.log('✅ 找到可用任务');
            console.log(`   任务 ID: ${taskId}`);
            console.log(`   状态: ${availableTask.status}`);
            console.log(`   标题: ${availableTask.title || 'N/A'}`);
            console.log(`   字幕长度: ${availableTask.subtitleRaw?.length || 0} 字符\n`);
          } else {
            console.warn('⚠️  任务列表中没有可用的任务');
            console.warn('   需要状态为 extracted 或 completed，且有字幕内容\n');
          }
        }
      }
    } catch (error: any) {
      console.warn(`⚠️  获取任务列表失败: ${error.message}`);
    }

    // 如果没有找到任务，提示用户手动提供
    if (!taskId) {
      console.log('💡 请手动提供任务 ID：');
      console.log('   1. 访问: http://localhost:3000/activity/media-tasks');
      console.log('   2. 找到一个状态为 "extracted" 或 "completed" 的任务');
      console.log('   3. 从浏览器 Network 标签获取任务 ID');
      console.log('\n   然后运行:');
      console.log(`   pnpm tsx scripts/test-rewrite-feature.ts "YOUR_TASK_ID" ${TEST_STYLE} ${TEST_TARGET_LANG}\n`);
      
      // 尝试使用命令行参数
      const providedTaskId = process.argv[2];
      if (providedTaskId) {
        taskId = providedTaskId;
        console.log(`✅ 使用提供的任务 ID: ${taskId}\n`);
      } else {
        process.exit(1);
      }
    }

    // Step 2: 验证任务状态
    console.log('🔍 步骤 2: 验证任务状态...\n');
    const statusResponse = await fetch(`${API_BASE_URL}/api/media/status?id=${taskId}`);
    
    if (!statusResponse.ok) {
      throw new Error(`Status check failed: ${statusResponse.status} ${statusResponse.statusText}`);
    }

    const statusData = await statusResponse.json();
    if (statusData.code !== 0) {
      throw new Error(`Status check failed: ${statusData.message}`);
    }

    const task = statusData.data;
    console.log('✅ 任务状态验证成功');
    console.log(`   状态: ${task.status}`);
    console.log(`   进度: ${task.progress}%`);
    console.log(`   是否有字幕: ${task.subtitleRaw ? '✅ 是' : '❌ 否'}\n`);

    if (task.status !== 'extracted' && task.status !== 'completed') {
      throw new Error(`任务状态不正确: ${task.status}（需要 extracted 或 completed）`);
    }

    if (!task.subtitleRaw || task.subtitleRaw.trim().length === 0) {
      throw new Error('任务没有字幕内容');
    }

    // Step 3: 触发改写
    console.log('🚀 步骤 3: 触发改写任务...\n');
    const rewriteResponse = await fetch(`${API_BASE_URL}/api/media/rewrite`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        taskId,
        style: TEST_STYLE,
        targetLang: TEST_TARGET_LANG,
      }),
    });

    if (!rewriteResponse.ok) {
      const errorData = await rewriteResponse.json().catch(() => ({}));
      throw new Error(`Rewrite request failed: ${rewriteResponse.status} ${rewriteResponse.statusText}. ${JSON.stringify(errorData)}`);
    }

    const rewriteData = await rewriteResponse.json();
    
    if (rewriteResponse.status === 202 || (rewriteData.code === 0 && rewriteData.data?.success)) {
      console.log('✅ 改写任务已启动');
      console.log(`   响应状态: ${rewriteResponse.status} Accepted`);
      console.log(`   消息: ${rewriteData.data?.message || rewriteData.message}\n`);
    } else {
      throw new Error(`Rewrite failed: ${rewriteData.message || 'Unknown error'}`);
    }

    // Step 4: 等待改写完成
    console.log('⏳ 步骤 4: 等待改写完成（最多 2 分钟）...\n');
    const maxWaitTime = 120000; // 2 minutes
    const pollInterval = 3000; // 3 seconds
    const startTime = Date.now();
    let rewriteCompleted = false;

    while (Date.now() - startTime < maxWaitTime && !rewriteCompleted) {
      await sleep(pollInterval);

      const checkResponse = await fetch(`${API_BASE_URL}/api/media/status?id=${taskId}`);
      if (!checkResponse.ok) {
        console.warn('⚠️  状态检查失败，继续等待...');
        continue;
      }

      const checkData = await checkResponse.json();
      if (checkData.code !== 0) {
        console.warn('⚠️  状态检查返回错误，继续等待...');
        continue;
      }

      const currentTask = checkData.data;
      const elapsed = Math.floor((Date.now() - startTime) / 1000);

      if (elapsed % 10 === 0) {
        console.log(`   等待中... (${elapsed} 秒) | 状态: ${currentTask.status} | 进度: ${currentTask.progress}%`);
      }

      // 检查是否有改写结果
      if (currentTask.rewrittenScripts && Array.isArray(currentTask.rewrittenScripts) && currentTask.rewrittenScripts.length > 0) {
        const latestRewrite = currentTask.rewrittenScripts[currentTask.rewrittenScripts.length - 1];
        
        if (latestRewrite.en && latestRewrite.target) {
          rewriteCompleted = true;
          console.log(`\n✅ 改写完成！（耗时: ${elapsed} 秒）\n`);
          
          // Step 5: 显示结果
          console.log('═══════════════════════════════════════════════════════════');
          console.log('📊 改写结果:');
          console.log('═══════════════════════════════════════════════════════════\n');
          
          console.log('📝 英文母本 (English Master):');
          console.log('───────────────────────────────────────────────────────────');
          const enPreview = latestRewrite.en.length > 800 
            ? latestRewrite.en.substring(0, 800) + '\n...' 
            : latestRewrite.en;
          console.log(enPreview);
          console.log('\n');
          
          console.log(`📝 目标语言版本 (${latestRewrite.lang.toUpperCase()} Localized):`);
          console.log('───────────────────────────────────────────────────────────');
          const targetPreview = latestRewrite.target.length > 800 
            ? latestRewrite.target.substring(0, 800) + '\n...' 
            : latestRewrite.target;
          console.log(targetPreview);
          console.log('\n');
          
          console.log('📋 元数据:');
          console.log(`   风格: ${latestRewrite.style}`);
          console.log(`   目标语言: ${latestRewrite.lang}`);
          console.log(`   创建时间: ${latestRewrite.createdAt}`);
          console.log(`   英文长度: ${latestRewrite.en.length} 字符`);
          console.log(`   目标语言长度: ${latestRewrite.target.length} 字符`);
          
          // 统计行数
          const enLines = latestRewrite.en.split('\n').filter((l: string) => l.trim() && !l.match(/^\d+$/) && !l.match(/^\d{2}:\d{2}:\d{2}/)).length;
          const targetLines = latestRewrite.target.split('\n').filter((l: string) => l.trim() && !l.match(/^\d+$/) && !l.match(/^\d{2}:\d{2}:\d{2}/)).length;
          console.log(`   英文内容行数: ${enLines} 行`);
          console.log(`   目标语言内容行数: ${targetLines} 行\n`);
          
          // 验证 SRT 格式
          const hasEnTimestamps = latestRewrite.en.includes('-->');
          const hasTargetTimestamps = latestRewrite.target.includes('-->');
          console.log('✅ 格式验证:');
          console.log(`   英文版本包含时间戳: ${hasEnTimestamps ? '✅' : '❌'}`);
          console.log(`   目标语言版本包含时间戳: ${hasTargetTimestamps ? '✅' : '❌'}\n`);
          
          console.log('═══════════════════════════════════════════════════════════');
          console.log('✅ 测试通过！改写功能正常工作。');
          console.log('═══════════════════════════════════════════════════════════\n');
          
          process.exit(0);
        }
      }

      // 检查是否失败
      if (currentTask.status === 'failed') {
        throw new Error(`改写失败: ${currentTask.errorMessage || 'Unknown error'}`);
      }
    }

    if (!rewriteCompleted) {
      throw new Error('改写超时：任务未在 2 分钟内完成。请检查 Gemini API Key 和网络连接。');
    }
  } catch (error: any) {
    console.error('\n❌ 测试失败！');
    console.error(`   错误: ${error.message}`);
    if (error.stack) {
      console.error(`   堆栈: ${error.stack.substring(0, 500)}`);
    }
    console.error('\n');
    process.exit(1);
  }
}

testRewriteViaAPI();

#!/usr/bin/env tsx

/**
 * 完整测试改写功能脚本
 * 自动创建测试任务 → 等待提取完成 → 测试改写功能
 * 
 * Usage:
 *   pnpm tsx scripts/test-rewrite-complete.ts
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
const TEST_URL = 'https://www.tiktok.com/@the_shortcut_tsar/video/7415746564376530950';
const TEST_STYLE = 'viral';
const TEST_TARGET_LANG = 'zh-CN';

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function testCompleteRewriteFlow() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🧪 完整测试改写功能（自动创建任务 → 提取 → 改写）');
  console.log('═══════════════════════════════════════════════════════════\n');
  
  console.log('📋 测试配置:');
  console.log(`   API URL: ${API_BASE_URL}`);
  console.log(`   测试 URL: ${TEST_URL}`);
  console.log(`   风格: ${TEST_STYLE}`);
  console.log(`   目标语言: ${TEST_TARGET_LANG}\n`);

  try {
    // Step 1: 创建测试任务
    console.log('🚀 步骤 1: 创建测试任务...\n');
    
    // 注意：需要认证，这里我们尝试直接调用 API
    // 如果失败，会提示用户手动创建任务
    let taskId: string | null = null;
    
    try {
      const submitResponse = await fetch(`${API_BASE_URL}/api/media/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: TEST_URL,
          outputType: 'subtitle',
        }),
      });

      if (submitResponse.ok) {
        const submitData = await submitResponse.json();
        if (submitData.code === 0 && submitData.data?.taskId) {
          taskId = submitData.data.taskId;
          console.log('✅ 测试任务创建成功');
          console.log(`   任务 ID: ${taskId}\n`);
        } else {
          throw new Error(submitData.message || 'Failed to create task');
        }
      } else {
        throw new Error(`Submit failed: ${submitResponse.status}`);
      }
    } catch (error: any) {
      console.warn('⚠️  自动创建任务失败（可能需要认证）');
      console.warn(`   错误: ${error.message}`);
      console.warn('\n💡 请手动创建测试任务：');
      console.warn('   1. 访问: http://localhost:3000/ai-media-extractor');
      console.warn(`   2. 输入 URL: ${TEST_URL}`);
      console.warn('   3. 点击提交');
      console.warn('   4. 从浏览器 Network 标签获取 taskId\n');
      console.warn('   然后运行:');
      console.warn(`   pnpm tsx scripts/test-rewrite-feature.ts "YOUR_TASK_ID" ${TEST_STYLE} ${TEST_TARGET_LANG}\n`);
      process.exit(1);
    }

    if (!taskId) {
      throw new Error('No task ID returned');
    }

    // Step 2: 等待提取完成
    console.log('⏳ 步骤 2: 等待提取完成（最多 3 分钟）...\n');
    const maxExtractTime = 180000; // 3 minutes
    const pollInterval = 5000; // 5 seconds
    const extractStartTime = Date.now();
    let extractCompleted = false;

    while (Date.now() - extractStartTime < maxExtractTime && !extractCompleted) {
      await sleep(pollInterval);

      try {
        const statusResponse = await fetch(`${API_BASE_URL}/api/media/status?id=${taskId}`);
        if (!statusResponse.ok) {
          console.warn('⚠️  状态检查失败，继续等待...');
          continue;
        }

        const statusData = await statusResponse.json();
        if (statusData.code !== 0) {
          console.warn('⚠️  状态检查返回错误，继续等待...');
          continue;
        }

        const task = statusData.data;
        const elapsed = Math.floor((Date.now() - extractStartTime) / 1000);

        console.log(`   状态: ${task.status} | 进度: ${task.progress}% | 已等待: ${elapsed} 秒`);

        if (task.status === 'extracted' || task.status === 'completed') {
          if (task.subtitleRaw && task.subtitleRaw.trim().length > 0) {
            extractCompleted = true;
            console.log(`\n✅ 提取完成！（耗时: ${elapsed} 秒）`);
            console.log(`   字幕长度: ${task.subtitleRaw.length} 字符\n`);
            break;
          }
        }

        if (task.status === 'failed') {
          throw new Error(`提取失败: ${task.errorMessage || 'Unknown error'}`);
        }
      } catch (error: any) {
        console.warn(`⚠️  状态检查错误: ${error.message}，继续等待...`);
      }
    }

    if (!extractCompleted) {
      throw new Error('提取超时：任务未在 3 分钟内完成');
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
    const maxRewriteTime = 120000; // 2 minutes
    const rewriteStartTime = Date.now();
    let rewriteCompleted = false;

    while (Date.now() - rewriteStartTime < maxRewriteTime && !rewriteCompleted) {
      await sleep(pollInterval);

      try {
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
        const elapsed = Math.floor((Date.now() - rewriteStartTime) / 1000);

        if (elapsed % 10 === 0) {
          console.log(`   等待中... (${elapsed} 秒)`);
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
            const enPreview = latestRewrite.en.length > 500 
              ? latestRewrite.en.substring(0, 500) + '...' 
              : latestRewrite.en;
            console.log(enPreview);
            console.log('\n');
            
            console.log(`📝 目标语言版本 (${latestRewrite.lang.toUpperCase()} Localized):`);
            console.log('───────────────────────────────────────────────────────────');
            const targetPreview = latestRewrite.target.length > 500 
              ? latestRewrite.target.substring(0, 500) + '...' 
              : latestRewrite.target;
            console.log(targetPreview);
            console.log('\n');
            
            console.log('📋 元数据:');
            console.log(`   风格: ${latestRewrite.style}`);
            console.log(`   目标语言: ${latestRewrite.lang}`);
            console.log(`   创建时间: ${latestRewrite.createdAt}`);
            console.log(`   英文长度: ${latestRewrite.en.length} 字符`);
            console.log(`   目标语言长度: ${latestRewrite.target.length} 字符`);
            console.log(`   英文行数: ${latestRewrite.en.split('\n').filter((l: string) => l.trim()).length} 行`);
            console.log(`   目标语言行数: ${latestRewrite.target.split('\n').filter((l: string) => l.trim()).length} 行\n`);
            
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
      } catch (error: any) {
        console.warn(`⚠️  状态检查错误: ${error.message}，继续等待...`);
      }
    }

    if (!rewriteCompleted) {
      throw new Error('改写超时：任务未在 2 分钟内完成');
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

testCompleteRewriteFlow();

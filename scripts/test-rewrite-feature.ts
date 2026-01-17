#!/usr/bin/env tsx

/**
 * 测试改写功能脚本
 * 用于验证爆改文案功能是否正常工作
 * 
 * Usage:
 *   pnpm tsx scripts/test-rewrite-feature.ts <taskId> <style> <targetLang>
 * 
 * Example (PowerShell):
 *   pnpm tsx scripts/test-rewrite-feature.ts "abc123-def456" viral zh-CN
 * 
 * Example (Bash):
 *   pnpm tsx scripts/test-rewrite-feature.ts abc123 viral zh-CN
 * 
 * Note: In PowerShell, wrap taskId in quotes if it contains special characters
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
const TEST_TASK_ID = process.argv[2];
const TEST_STYLE = process.argv[3] || 'viral';
const TEST_TARGET_LANG = process.argv[4] || 'zh-CN';

async function testRewriteFeature() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🧪 测试改写功能');
  console.log('═══════════════════════════════════════════════════════════\n');
  
  if (!TEST_TASK_ID) {
    console.error('❌ 缺少参数: taskId');
    console.error('   用法: pnpm tsx scripts/test-rewrite-feature.ts <taskId> [style] [targetLang]');
    console.error('   示例: pnpm tsx scripts/test-rewrite-feature.ts abc123 viral zh-CN\n');
    process.exit(1);
  }

  console.log('📋 测试配置:');
  console.log(`   API URL: ${API_BASE_URL}`);
  console.log(`   Task ID: ${TEST_TASK_ID}`);
  console.log(`   Style: ${TEST_STYLE}`);
  console.log(`   Target Language: ${TEST_TARGET_LANG}\n`);

  try {
    // Step 1: 检查任务状态
    console.log('🔍 1. 检查任务状态...\n');
    const statusResponse = await fetch(`${API_BASE_URL}/api/media/status?id=${TEST_TASK_ID}`);
    
    if (!statusResponse.ok) {
      throw new Error(`Status check failed: ${statusResponse.status} ${statusResponse.statusText}`);
    }

    const statusData = await statusResponse.json();
    if (statusData.code !== 0) {
      throw new Error(`Status check failed: ${statusData.message}`);
    }

    const task = statusData.data;
    console.log('✅ 任务状态检查成功');
    console.log(`   状态: ${task.status}`);
    console.log(`   进度: ${task.progress}%`);
    console.log(`   是否有字幕: ${task.subtitleRaw ? '✅ 是' : '❌ 否'}\n`);

    // 检查任务是否就绪
    if (task.status !== 'extracted' && task.status !== 'completed') {
      console.error(`❌ 任务状态不正确: ${task.status}`);
      console.error('   任务必须是 "extracted" 或 "completed" 状态才能进行改写\n');
      process.exit(1);
    }

    if (!task.subtitleRaw || task.subtitleRaw.trim().length === 0) {
      console.error('❌ 任务没有字幕内容');
      console.error('   请确保任务已成功提取字幕\n');
      process.exit(1);
    }

    // Step 2: 触发改写
    console.log('🚀 2. 触发改写任务...\n');
    const rewriteResponse = await fetch(`${API_BASE_URL}/api/media/rewrite`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        taskId: TEST_TASK_ID,
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

    // Step 3: 轮询检查结果（最多等待 2 分钟）
    console.log('⏳ 3. 等待改写完成（最多 2 分钟）...\n');
    const maxWaitTime = 120000; // 2 minutes
    const pollInterval = 3000; // 3 seconds
    const startTime = Date.now();
    let rewriteCompleted = false;

    while (Date.now() - startTime < maxWaitTime && !rewriteCompleted) {
      await new Promise((resolve) => setTimeout(resolve, pollInterval));

      const checkResponse = await fetch(`${API_BASE_URL}/api/media/status?id=${TEST_TASK_ID}`);
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

      // 检查是否有改写结果
      if (currentTask.rewrittenScripts && Array.isArray(currentTask.rewrittenScripts) && currentTask.rewrittenScripts.length > 0) {
        const latestRewrite = currentTask.rewrittenScripts[currentTask.rewrittenScripts.length - 1];
        
        if (latestRewrite.en && latestRewrite.target) {
          rewriteCompleted = true;
          console.log(`✅ 改写完成！（耗时: ${elapsed} 秒）\n`);
          
          // Step 4: 显示结果
          console.log('📊 4. 改写结果:\n');
          console.log('═══════════════════════════════════════════════════════════');
          console.log('📝 英文母本 (English Master):');
          console.log('═══════════════════════════════════════════════════════════');
          console.log(latestRewrite.en.substring(0, 500) + (latestRewrite.en.length > 500 ? '...' : ''));
          console.log('\n');
          
          console.log('═══════════════════════════════════════════════════════════');
          console.log(`📝 目标语言版本 (${latestRewrite.lang.toUpperCase()} Localized):`);
          console.log('═══════════════════════════════════════════════════════════');
          console.log(latestRewrite.target.substring(0, 500) + (latestRewrite.target.length > 500 ? '...' : ''));
          console.log('\n');
          
          console.log('📋 元数据:');
          console.log(`   风格: ${latestRewrite.style}`);
          console.log(`   目标语言: ${latestRewrite.lang}`);
          console.log(`   创建时间: ${latestRewrite.createdAt}`);
          console.log(`   英文长度: ${latestRewrite.en.length} 字符`);
          console.log(`   目标语言长度: ${latestRewrite.target.length} 字符\n`);
          
          console.log('✅ 测试通过！改写功能正常工作。\n');
          process.exit(0);
        }
      }

      // 检查是否失败
      if (currentTask.status === 'failed') {
        throw new Error(`改写失败: ${currentTask.errorMessage || 'Unknown error'}`);
      }

      // 显示进度
      if (elapsed % 10 === 0) {
        console.log(`   等待中... (${elapsed} 秒)`);
      }
    }

    if (!rewriteCompleted) {
      console.error('❌ 超时：改写任务未在 2 分钟内完成');
      console.error('   请检查：');
      console.error('   1. Gemini API Key 是否配置正确');
      console.error('   2. 网络连接是否正常');
      console.error('   3. 服务器日志是否有错误\n');
      process.exit(1);
    }
  } catch (error: any) {
    console.error('❌ 测试失败！');
    console.error(`   错误: ${error.message}`);
    console.error(`   堆栈: ${error.stack?.substring(0, 500)}\n`);
    process.exit(1);
  }
}

testRewriteFeature();

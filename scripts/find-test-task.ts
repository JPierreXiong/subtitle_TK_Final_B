#!/usr/bin/env tsx

/**
 * 查找可用于测试的任务
 * 查找状态为 extracted 或 completed 的任务
 */

import * as dotenv from 'dotenv';
import path from 'path';
import { existsSync } from 'fs';
import { db } from '../src/core/db';
import { mediaTasks } from '../src/config/db/schema';
import { eq, or, desc } from 'drizzle-orm';

// Load .env.local
const envPath = path.resolve(process.cwd(), '.env.local');
if (existsSync(envPath)) {
  dotenv.config({ path: envPath });
} else {
  console.error(`❌ Environment file not found: ${envPath}`);
  process.exit(1);
}

async function findTestTask() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🔍 查找可用于测试的任务');
  console.log('═══════════════════════════════════════════════════════════\n');

  try {
    // 查找状态为 extracted 或 completed 的任务，且有字幕内容
    const tasks = await db()
      .select({
        id: mediaTasks.id,
        status: mediaTasks.status,
        progress: mediaTasks.progress,
        title: mediaTasks.title,
        platform: mediaTasks.platform,
        subtitleRaw: mediaTasks.subtitleRaw,
        createdAt: mediaTasks.createdAt,
      })
      .from(mediaTasks)
      .where(
        or(
          eq(mediaTasks.status, 'extracted'),
          eq(mediaTasks.status, 'completed')
        )
      )
      .orderBy(desc(mediaTasks.createdAt))
      .limit(5);

    if (tasks.length === 0) {
      console.log('❌ 没有找到可用的测试任务');
      console.log('\n💡 请先创建一个测试任务：');
      console.log('   1. 访问: http://localhost:3000/ai-media-extractor');
      console.log('   2. 提交 TikTok/YouTube URL');
      console.log('   3. 等待提取完成\n');
      process.exit(1);
    }

    console.log(`✅ 找到 ${tasks.length} 个可用任务：\n`);

    // 过滤出有字幕的任务
    const tasksWithSubtitle = tasks.filter(
      (task: typeof tasks[0]) => task.subtitleRaw && task.subtitleRaw.trim().length > 0
    );

    if (tasksWithSubtitle.length === 0) {
      console.log('❌ 没有找到有字幕内容的任务');
      console.log('\n💡 请先创建一个测试任务并等待提取完成\n');
      process.exit(1);
    }

    // 显示任务列表
    tasksWithSubtitle.forEach((task: typeof tasks[0], index: number) => {
      console.log(`${index + 1}. 任务 ID: ${task.id}`);
      console.log(`   状态: ${task.status}`);
      console.log(`   进度: ${task.progress}%`);
      console.log(`   平台: ${task.platform || 'N/A'}`);
      console.log(`   标题: ${task.title || 'N/A'}`);
      console.log(`   字幕长度: ${task.subtitleRaw?.length || 0} 字符`);
      console.log(`   创建时间: ${task.createdAt ? new Date(task.createdAt).toLocaleString() : 'N/A'}`);
      console.log('');
    });

    // 使用第一个任务进行测试
    const testTask = tasksWithSubtitle[0];
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`🚀 使用任务进行测试: ${testTask.id}`);
    console.log('═══════════════════════════════════════════════════════════\n');

    // 运行改写测试
    const { execSync } = require('child_process');
    try {
      const command = `pnpm tsx scripts/test-rewrite-feature.ts "${testTask.id}" viral zh-CN`;
      console.log(`执行命令: ${command}\n`);
      execSync(command, { stdio: 'inherit', cwd: process.cwd() });
    } catch (error: any) {
      console.error('❌ 测试执行失败');
      console.error(`   错误: ${error.message}`);
      process.exit(1);
    }
  } catch (error: any) {
    console.error('❌ 查找任务失败');
    console.error(`   错误: ${error.message}`);
    if (error.stack) {
      console.error(`   堆栈: ${error.stack.substring(0, 500)}`);
    }
    process.exit(1);
  }
}

findTestTask();

#!/usr/bin/env tsx
/**
 * Test script for YouTube video download API
 * Tests the new deep parser and User-Agent functionality
 */

import * as dotenv from 'dotenv';
import path from 'path';
import { existsSync } from 'fs';
import { RapidAPIProvider } from '../src/extensions/media/rapidapi';
import { RapidAPIConfigs } from '../src/extensions/media/rapidapi';

// Load .env.local
const envPath = path.resolve(process.cwd(), '.env.local');
if (existsSync(envPath)) {
  dotenv.config({ path: envPath });
} else {
  console.error(`❌ Environment file not found: ${envPath}`);
  process.exit(1);
}

async function testYouTubeVideoDownload(url: string) {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🚀 开始测试 YouTube 视频下载 API');
  console.log('═══════════════════════════════════════════════════════════\n');
  console.log(`目标 URL: ${url}\n`);

  const apiKey = process.env.NEXT_PUBLIC_RAPIDAPI_KEY;
  if (!apiKey) {
    console.error('❌ NEXT_PUBLIC_RAPIDAPI_KEY is not set in environment variables');
    process.exit(1);
  }

  const configs: RapidAPIConfigs = {
    apiKey: apiKey,
    youtubeVideo: {
      primaryHost: process.env.RAPIDAPI_YOUTUBE_VIDEO_PRIMARY_HOST || 'youtube-video-and-shorts-downloader1.p.rapidapi.com',
      backupHost: process.env.RAPIDAPI_YOUTUBE_VIDEO_BACKUP_HOST || 'cloud-api-hub-youtube-downloader.p.rapidapi.com',
    },
  };

  const rapidApiProvider = new RapidAPIProvider(configs);

  try {
    console.log('📡 调用 API 获取视频 URL...\n');
    const result = await rapidApiProvider.fetchMedia(url, 'video');

    if (result.videoUrl) {
      console.log('✅ YouTube 视频下载 URL 提取成功！');
      console.log('───────────────────────────────────────────────────────────');
      console.log('标题:', result.title);
      console.log('作者:', result.author);
      console.log('时长:', result.duration ? `${result.duration} 秒` : 'N/A');
      console.log('缩略图:', result.thumbnailUrl?.substring(0, 80) + '...');
      console.log('\n📹 视频下载 URL:');
      console.log(result.videoUrl.substring(0, 150) + '...');
      
      // 验证 URL 格式
      if (result.videoUrl.includes('.m3u8')) {
        console.warn('⚠️  警告：URL 包含 .m3u8（HLS 流），浏览器可能无法直接下载');
      } else if (result.videoUrl.includes('.mp4') || result.videoUrl.includes('mp4')) {
        console.log('✅ URL 格式正确：包含 .mp4（静态视频文件）');
      } else {
        console.log('ℹ️  URL 格式：非 .mp4 格式（可能是其他视频格式）');
      }
      
      console.log('\n完整 URL 字符数:', result.videoUrl.length);
      console.log('───────────────────────────────────────────────────────────');
    } else {
      console.error('❌ YouTube 视频下载 URL 提取失败：未获取到视频 URL。');
      console.error('详细信息:', result);
    }
  } catch (error: any) {
    console.error('❌ YouTube 视频下载过程中发生错误:', error.message);
    console.error('错误详情:', error);
  } finally {
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('测试结束');
    console.log('═══════════════════════════════════════════════════════════');
  }
}

const youtubeUrl = process.argv[2];

if (!youtubeUrl) {
  console.error('Usage: pnpm tsx scripts/test-youtube-video-download.ts <youtube_video_url>');
  console.error('Example: pnpm tsx scripts/test-youtube-video-download.ts "https://www.youtube.com/watch?v=pYw23YfUDwY"');
  process.exit(1);
}

testYouTubeVideoDownload(youtubeUrl);

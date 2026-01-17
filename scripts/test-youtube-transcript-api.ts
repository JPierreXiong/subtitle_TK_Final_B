/**
 * Test script for YouTube Transcript API (Flux)
 * Tests the new ai-youtube-transcript-generator-free-online-api-flux.p.rapidapi.com API
 * 
 * Usage:
 *   pnpm tsx scripts/test-youtube-transcript-api.ts <youtubeUrl>
 * 
 * Example:
 *   pnpm tsx scripts/test-youtube-transcript-api.ts "https://www.youtube.com/watch?v=pYw23YfUDwY"
 */

import 'dotenv/config';

const RAPIDAPI_KEY = process.env.NEXT_PUBLIC_RAPIDAPI_KEY || process.env.RAPIDAPI_KEY;
const HOST = 'ai-youtube-transcript-generator-free-online-api-flux.p.rapidapi.com';

async function testYouTubeTranscriptAPI(youtubeUrl: string) {
  if (!RAPIDAPI_KEY) {
    console.error('❌ RAPIDAPI_KEY is not set in environment variables');
    process.exit(1);
  }

  if (!youtubeUrl) {
    console.error('❌ YouTube URL is required');
    console.log('\nUsage: pnpm tsx scripts/test-youtube-transcript-api.ts <youtubeUrl>');
    process.exit(1);
  }

  console.log('🚀 Testing YouTube Transcript API (Flux)');
  console.log(`   Host: ${HOST}`);
  console.log(`   URL: ${youtubeUrl}`);
  console.log(`   API Key: ${RAPIDAPI_KEY.substring(0, 20)}...\n`);

  // Extract video ID from URL
  const videoIdMatch = youtubeUrl.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/);
  if (!videoIdMatch) {
    console.error('❌ Invalid YouTube URL format');
    process.exit(1);
  }
  const videoId = videoIdMatch[1];
  console.log(`📹 Video ID: ${videoId}\n`);

  // Construct API URL
  const apiUrl = `https://${HOST}/transcript`;

  console.log(`📡 Request URL: ${apiUrl}`);
  console.log(`📦 Request Body: {"videoUrl":"${youtubeUrl}","langCode":"en"}\n`);

  try {
    const startTime = Date.now();
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-rapidapi-key': RAPIDAPI_KEY,
        'x-rapidapi-host': HOST,
      },
      body: JSON.stringify({
        videoUrl: youtubeUrl,
        langCode: 'en',
      }),
    });

    const elapsedTime = Date.now() - startTime;

    console.log(`📊 Response Status: ${response.status} ${response.statusText}`);
    console.log(`⏱️  Elapsed Time: ${elapsedTime}ms\n`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ API Request Failed');
      console.error(`   Status: ${response.status}`);
      console.error(`   Response: ${errorText.substring(0, 500)}`);
      process.exit(1);
    }

    const data = await response.json();
    
    // Parse response
    const transcriptArray = Array.isArray(data.transcript) ? data.transcript : [];
    const transcriptText = transcriptArray.length > 0
      ? transcriptArray.map((item: any) => item.text || '').join(' ').trim()
      : (data.transcript || data.transcription || '');

    console.log('📝 Response Structure:');
    console.log(`   Success: ${data.success || 'N/A'}`);
    console.log(`   Video ID: ${data.video_id || videoId}`);
    console.log(`   Title: ${data.title || 'N/A'}`);
    console.log(`   Author: ${data.author || 'N/A'}`);
    console.log(`   Duration: ${data.duration || 'N/A'}`);
    console.log(`   Language: ${data.language || 'N/A'}`);
    console.log(`   Transcript is array: ${Array.isArray(data.transcript)}`);
    console.log(`   Transcript segments: ${transcriptArray.length}`);
    console.log(`   Final transcript length: ${transcriptText.length} characters\n`);

    if (transcriptText) {
      console.log('✅ Transcript extracted successfully!');
      console.log(`\n📄 Transcript Preview (first 300 chars):\n${transcriptText.substring(0, 300)}...\n`);
      
      if (transcriptArray.length > 0) {
        console.log(`📦 Transcript Segments Preview (first 3):`);
        transcriptArray.slice(0, 3).forEach((segment: any, idx: number) => {
          console.log(`   [${idx + 1}] ${segment.start || 0}s - ${(segment.start || 0) + (segment.duration || 0)}s: ${(segment.text || '').substring(0, 60)}...`);
        });
        console.log('');
      }
    } else {
      console.error('❌ No transcript found in response');
      console.log('\n📋 Full Response (first 1000 chars):');
      console.log(JSON.stringify(data, null, 2).substring(0, 1000));
      process.exit(1);
    }

    // Test SRT conversion
    if (transcriptArray.length > 0) {
      console.log('🔄 Testing SRT Conversion...');
      const { SubtitleFormatter } = await import('@/extensions/media/subtitle-formatter');
      
      const segments = transcriptArray.map((item: any) => ({
        start: item.start || item.startTime || 0,
        duration: item.duration || item.dur || 0,
        text: item.text || item.content || '',
      }));
      
      const srtContent = SubtitleFormatter.jsonToSRT(segments);
      
      if (srtContent) {
        console.log('✅ SRT conversion successful!');
        console.log(`   SRT length: ${srtContent.length} characters`);
        console.log(`   SRT lines: ${srtContent.split('\n').length} lines\n`);
        console.log('📄 SRT Preview (first 400 chars):\n');
        console.log(srtContent.substring(0, 400) + '...\n');
      } else {
        console.error('❌ SRT conversion failed');
        process.exit(1);
      }
    }

    console.log('✅ All tests passed!');
  } catch (error: any) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Get YouTube URL from command line arguments
const youtubeUrl = process.argv[2];
testYouTubeTranscriptAPI(youtubeUrl);

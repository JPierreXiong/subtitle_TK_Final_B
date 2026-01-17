/**
 * Test script for TikTok Transcript API (Supadata)
 * Tests the new tiktok-transcripts.p.rapidapi.com API
 * 
 * Usage:
 *   pnpm tsx scripts/test-tiktok-transcript-api.ts <tiktokUrl>
 * 
 * Example:
 *   pnpm tsx scripts/test-tiktok-transcript-api.ts "https://vm.tiktok.com/ZNdfSseUr"
 */

import 'dotenv/config';

const RAPIDAPI_KEY = process.env.NEXT_PUBLIC_RAPIDAPI_KEY || process.env.RAPIDAPI_KEY;
const HOST = 'tiktok-transcripts.p.rapidapi.com';

async function testTikTokTranscriptAPI(tiktokUrl: string) {
  if (!RAPIDAPI_KEY) {
    console.error('❌ RAPIDAPI_KEY is not set in environment variables');
    process.exit(1);
  }

  if (!tiktokUrl) {
    console.error('❌ TikTok URL is required');
    console.log('\nUsage: pnpm tsx scripts/test-tiktok-transcript-api.ts <tiktokUrl>');
    process.exit(1);
  }

  console.log('🚀 Testing TikTok Transcript API (Supadata)');
  console.log(`   Host: ${HOST}`);
  console.log(`   URL: ${tiktokUrl}`);
  console.log(`   API Key: ${RAPIDAPI_KEY.substring(0, 20)}...\n`);

  // Clean URL (remove query parameters)
  let cleanedUrl = tiktokUrl;
  try {
    const urlObj = new URL(tiktokUrl);
    urlObj.search = '';
    cleanedUrl = urlObj.toString();
  } catch (e) {
    console.warn('⚠️  Failed to clean URL, using original URL');
  }

  // Construct API URL
  const encodedUrl = encodeURIComponent(cleanedUrl);
  const apiUrl = `https://${HOST}/transcript?url=${encodedUrl}&chunkSize=500&text=false`;

  console.log(`📡 Request URL: ${apiUrl}\n`);

  try {
    const startTime = Date.now();
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'x-rapidapi-key': RAPIDAPI_KEY,
        'x-rapidapi-host': HOST,
      },
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
    
    // Parse response (support both { content: {...} } and direct format)
    const responseData = data.content || data;
    
    // Extract transcript
    const transcript = 
      responseData.transcript || 
      responseData.text || 
      responseData.transcription || 
      '';
    
    // Extract chunks
    const chunks = responseData.chunks || responseData.segments || [];
    
    // If no transcript but has chunks, extract from chunks
    const finalTranscript = transcript || 
      (chunks.length > 0 ? chunks.map((c: any) => c.text || '').join(' ').trim() : '');

    console.log('📝 Response Structure:');
    console.log(`   Has content field: ${!!data.content}`);
    console.log(`   Has transcript: ${!!transcript}`);
    console.log(`   Has chunks: ${chunks.length > 0} (${chunks.length} chunks)`);
    console.log(`   Final transcript length: ${finalTranscript.length} characters\n`);

    if (finalTranscript) {
      console.log('✅ Transcript extracted successfully!');
      console.log(`\n📄 Transcript Preview (first 200 chars):\n${finalTranscript.substring(0, 200)}...\n`);
      
      if (chunks.length > 0) {
        console.log(`📦 Chunks Preview (first 3):`);
        chunks.slice(0, 3).forEach((chunk: any, idx: number) => {
          console.log(`   [${idx + 1}] ${chunk.start || chunk.startTime || 0}s - ${chunk.end || chunk.endTime || 0}s: ${(chunk.text || '').substring(0, 50)}...`);
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
    if (chunks.length > 0) {
      console.log('🔄 Testing SRT Conversion...');
      const { SubtitleFormatter } = await import('@/extensions/media/subtitle-formatter');
      
      const segments = chunks.map((chunk: any) => ({
        start: chunk.start || chunk.startTime || 0,
        duration: (chunk.end || chunk.endTime || 0) - (chunk.start || chunk.startTime || 0),
        text: chunk.text || chunk.transcript || '',
      }));
      
      const srtContent = SubtitleFormatter.jsonToSRT(segments);
      
      if (srtContent) {
        console.log('✅ SRT conversion successful!');
        console.log(`   SRT length: ${srtContent.length} characters`);
        console.log(`   SRT lines: ${srtContent.split('\n').length} lines\n`);
        console.log('📄 SRT Preview (first 300 chars):\n');
        console.log(srtContent.substring(0, 300) + '...\n');
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

// Get TikTok URL from command line arguments
const tiktokUrl = process.argv[2];
testTikTokTranscriptAPI(tiktokUrl);

/**
 * Media Task Worker Route
 * Handles asynchronous media processing via QStash
 * 
 * Features:
 * - QStash signature verification
 * - Idempotency check (prevents duplicate processing)
 * - Stream processing (memory efficient)
 * - Granular status updates
 * - Automatic credit refund on failure
 * - Comprehensive error logging
 * - Performance metrics tracking
 */

import { verifySignatureAppRouter } from '@upstash/qstash/nextjs';
// Request is a global Web API type, no need to import from 'next/server'
import {
  updateMediaTaskById,
  findMediaTaskById,
} from '@/shared/models/media_task';
import { fetchMediaFromRapidAPI } from '@/shared/services/media/rapidapi';
import { uploadVideoToStorage } from '@/shared/services/media/video-storage';
import { generateVideoFingerprint } from '@/shared/lib/media-url';
import { parseDurationToSeconds, truncateUrl } from '@/shared/lib/duration-utils';
import {
  findValidVideoCache,
  setVideoCache,
} from '@/shared/models/video_cache';

/**
 * POST /api/media/worker
 * Process media task asynchronously (called by QStash)
 * 
 * @returns Response with status 200 on success or handled error (to prevent QStash retry)
 */
export async function POST(req: Request) {
  const workerStartTime = Date.now();
  let taskId: string | null = null;
  let url: string | null = null;
  let outputType: 'subtitle' | 'video' | undefined;
  
  try {
    // 1. Verify QStash signature (security first)
    await verifySignatureAppRouter(req as any);

    const body = await req.json();
    taskId = body.taskId;
    url = body.url;
    outputType = body.outputType;

    if (!taskId || !url) {
      console.error('[Worker] ❌ Missing required parameters:', { taskId: !!taskId, url: !!url });
      return Response.json(
        { error: 'Missing required parameters: taskId, url' },
        { status: 200 } // Return 200 to prevent QStash retry for invalid requests
      );
    }

    console.log(`[Worker] 🟢 Starting task processing: ${taskId}`, {
      url: url.substring(0, 50) + '...',
      outputType: outputType || 'subtitle',
      timestamp: new Date().toISOString(),
    });

    if (!taskId || !url) {
      return Response.json(
        { error: 'Missing required parameters: taskId, url' },
        { status: 400 }
      );
    }

    // 2. 🔑 Idempotency check: Prevent duplicate processing from QStash retries
    const existingTask = await findMediaTaskById(taskId);
    
    if (existingTask) {
      // If task is already in final state, return success (avoid duplicate processing)
      if (existingTask.status === 'completed' || existingTask.status === 'extracted') {
        const elapsedTime = Date.now() - workerStartTime;
        console.log(`[Worker] ⏭️  [Idempotency] Task ${taskId} already completed, skipping`, {
          status: existingTask.status,
          elapsedTime: `${elapsedTime}ms`,
        });
        return Response.json({ 
          success: true, 
          message: 'Task already completed',
          status: existingTask.status 
        });
      }

      // If task is still processing, check processing time
      if (existingTask.status === 'downloading' || existingTask.status === 'processing') {
        const taskUpdatedAt = existingTask.updatedAt ? new Date(existingTask.updatedAt).getTime() : Date.now();
        const processingTime = Date.now() - taskUpdatedAt;
        const MAX_PROCESSING_TIME = 10 * 60 * 1000; // 10 minutes

        if (processingTime < MAX_PROCESSING_TIME) {
          console.log(`[Worker] ⏸️  [Idempotency] Task ${taskId} is still processing, skipping`, {
            status: existingTask.status,
            processingTime: `${Math.round(processingTime / 1000)}s`,
            maxTime: `${MAX_PROCESSING_TIME / 1000}s`,
          });
          return Response.json({ 
            success: true, 
            message: 'Task is already processing',
            status: existingTask.status 
          });
        }
        // If processing time exceeds threshold, allow retry
        console.log(`[Worker] ⚠️  [Idempotency] Task ${taskId} processing timeout, allowing retry`, {
          processingTime: `${Math.round(processingTime / 1000)}s`,
          maxTime: `${MAX_PROCESSING_TIME / 1000}s`,
        });
      }

      // If task failed but retry is happening, log it
      if (existingTask.status === 'failed') {
        console.log(`[Worker] 🔄 [Idempotency] Task ${taskId} previously failed, allowing retry`, {
          previousError: existingTask.errorMessage?.substring(0, 100),
        });
      }
    } else {
      console.error(`[Worker] ❌ Task ${taskId} not found in database`);
      return Response.json(
        { error: 'Task not found' },
        { status: 200 } // Return 200 to prevent QStash retry
      );
    }

    // 3. Update status to downloading (granular state for Realtime)
    const downloadStartTime = Date.now();
    await updateMediaTaskById(taskId, {
      status: 'downloading',
      progress: 10,
    });
    console.log(`[Worker] 📥 [Status] Task ${taskId} → downloading (progress: 10%)`);

    // 4. Check cache for video download tasks (only for 'video' outputType)
    if (outputType === 'video') {
      const fingerprint = generateVideoFingerprint(url);
      const cached = await findValidVideoCache(fingerprint);
      
      if (cached) {
        // ✅ Cache hit: Skip API call
        const cacheLookupTime = Date.now() - downloadStartTime;
        console.log(`[Worker] ✅ [Cache Hit] Skipping API call for ${url}`, {
          cacheLookupTime: `${cacheLookupTime}ms`,
          platform: cached.platform,
        });
        
        await updateMediaTaskById(taskId, {
          progress: 30,
          platform: cached.platform,
        });

        // Handle video URL (use cached download URL)
        await updateMediaTaskById(taskId, {
          progress: 40,
        });

        let videoUrlInternal: string | null = null;
        let expiresAt: Date | null = null;

        // 对于缓存命中，也使用异步上传策略（如果配置了 Vercel Blob）
        if (process.env.BLOB_READ_WRITE_TOKEN) {
          // 异步上传（不 await，不阻塞）
          (async () => {
            try {
              console.log(`[Worker] 📤 [Upload] Starting async upload for cached ${cached.platform} video...`);
              const storageIdentifier = await uploadVideoToStorage(cached.downloadUrl);
              if (storageIdentifier) {
                await updateMediaTaskById(taskId, {
                  videoUrlInternal: storageIdentifier,
                  expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
                  progress: 100,
                  status: 'extracted',
                });
                console.log(`[Worker] ✅ [Upload] Cached video uploaded to Vercel Blob successfully`);
              } else {
                await updateMediaTaskById(taskId, {
                  videoUrlInternal: `original:${cached.downloadUrl}`,
                  expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000),
                  progress: 100,
                  status: 'extracted',
                });
                console.log(`[Worker] ⚠️ [Upload] Cached video upload failed, using original URL`);
              }
            } catch (error: any) {
              console.error(`[Worker] ❌ [Upload] Cached video upload error:`, error.message);
              await updateMediaTaskById(taskId, {
                videoUrlInternal: `original:${cached.downloadUrl}`,
                expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000),
                progress: 100,
                status: 'extracted',
              });
            }
          })();
          
          // 先使用原始 URL，上传完成后会更新
          videoUrlInternal = `original:${cached.downloadUrl}`;
          expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000);
          await updateMediaTaskById(taskId, { 
            progress: 70,
            status: 'downloading', // 上传进行中
            videoUrlInternal,
            expiresAt,
          });
        } else {
          // 没有配置 Blob，直接使用原始 URL
          videoUrlInternal = `original:${cached.downloadUrl}`;
          expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000);
          await updateMediaTaskById(taskId, { 
            progress: 70,
            videoUrlInternal,
            expiresAt,
          });
        }

        // Mark as extracted
        await updateMediaTaskById(taskId, {
          status: process.env.BLOB_READ_WRITE_TOKEN ? 'downloading' : 'extracted',
          progress: process.env.BLOB_READ_WRITE_TOKEN ? 70 : 100,
          videoUrlInternal,
          expiresAt,
        });

        const totalTime = Date.now() - workerStartTime;
        console.log(`[Worker] ✅ [Success] Task ${taskId} completed (cache hit)`, {
          totalTime: `${Math.round(totalTime / 1000)}s`,
          status: 'extracted',
        });

        return Response.json({ success: true, message: 'Task completed (cache hit)' });
      }
    }

    // 5. ❌ Cache miss: Normal API call flow
    const apiStartTime = Date.now();
    console.log(`[Worker] 📡 [Cache Miss] Fetching from RapidAPI for ${url}`);

    // Update status to processing (granular state: extracting transcript)
    await updateMediaTaskById(taskId, {
      status: 'processing',
      progress: 20,
    });
    console.log(`[Worker] 🔄 [Status] Task ${taskId} → processing (progress: 20%)`);

    let mediaData;
    try {
      // 对于视频下载任务，设置较短的超时时间（8秒），确保 Worker 在 10 秒内返回
      // 如果超时，返回 500 触发 QStash 重试
      const fetchPromise = fetchMediaFromRapidAPI(url, outputType || 'subtitle');
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error('API_TIMEOUT: Video download API call exceeded 8 seconds. Will retry via QStash.'));
        }, 8000); // 8 秒超时（留 2 秒给 Worker 处理）
      });
      
      mediaData = await Promise.race([fetchPromise, timeoutPromise]);
    } catch (apiError: any) {
      // Check if error is due to API still processing or timeout
      const errorMessage = apiError.message || '';
      
      // Check if error is due to timeout (for video download tasks)
      if (errorMessage.includes('API_TIMEOUT') || errorMessage.includes('exceeded')) {
        // ⏱️ API call timed out: return 500 to trigger QStash retry
        console.log(`[Worker] ⏱️ [Timeout] API call timed out for ${url}, will retry via QStash`);
        
        // Update status to processing (for frontend Realtime display)
        await updateMediaTaskById(taskId, {
          status: 'processing',
          progress: 25,
          errorMessage: 'API call is taking longer than expected, will retry...'
        });
        
        // Return 500 to trigger QStash retry (with exponential backoff)
        return Response.json(
          { 
            success: false, 
            message: 'API call timed out, will retry via QStash',
            retryAfter: 30, // QStash will retry after ~30 seconds
          },
          { status: 500 }
        );
      }
      
      if (errorMessage.includes('PROCESSING') || errorMessage.includes('still being processed')) {
        // ⏳ API is still processing: return 500 to trigger QStash retry
        console.log(`[Worker] ⏳ [Processing] API is still processing transcript for ${url}, will retry via QStash`);
        
        // Update status to processing (for frontend Realtime display)
        await updateMediaTaskById(taskId, {
          status: 'processing',
          progress: 30,
          errorMessage: 'Transcript is still being processed, please wait...',
        });
        
        // Return 500 to trigger QStash retry (QStash will retry after delay)
        return Response.json(
          { 
            success: false, 
            message: 'API is still processing, will retry via QStash',
            retryAfter: 30, // QStash will retry after ~30 seconds
          },
          { status: 500 } // 500 status triggers QStash retry
        );
      }
      // Re-throw other errors to be handled by outer catch block
      throw apiError;
    }
    
    // Check if subtitle is empty (API may still be processing)
    // For TikTok + subtitle extraction, if subtitleRaw is empty, it might still be processing
    if (outputType === 'subtitle' && mediaData.platform === 'tiktok' && !mediaData.subtitleRaw) {
      // ⏳ TikTok API may still be processing: return 500 to trigger QStash retry
      console.log(`[Worker] ⏳ [Processing] TikTok transcript is still processing for ${url}, will retry via QStash`);
      
      // Update status to processing (for frontend Realtime display)
      await updateMediaTaskById(taskId, {
        status: 'processing',
        progress: 30,
        errorMessage: 'Transcript is still being processed, please wait...',
      });
      
      // Return 500 to trigger QStash retry (QStash will retry after delay)
      return Response.json(
        { 
          success: false, 
          message: 'Transcript is still being processed, will retry via QStash',
          retryAfter: 30, // QStash will retry after ~30 seconds
        },
        { status: 500 } // 500 status triggers QStash retry
      );
    }
    
    const apiFetchTime = Date.now() - apiStartTime;
    console.log(`[Worker] ✅ [RapidAPI] Fetched media data`, {
      platform: mediaData.platform,
      hasVideoUrl: !!mediaData.videoUrl,
      hasSubtitle: !!mediaData.subtitleRaw,
      apiFetchTime: `${Math.round(apiFetchTime / 1000)}s`,
    });

    // 6. Cache the video download URL if this is a video task
    if (outputType === 'video' && mediaData.videoUrl) {
      const fingerprint = generateVideoFingerprint(url);
      setVideoCache(fingerprint, {
        originalUrl: url,
        downloadUrl: mediaData.videoUrl,
        platform: mediaData.platform,
        expiresInHours: 12,
      }).catch((error) => {
        console.error('Failed to cache video URL:', error);
      });
    }

    // 7. Update progress with metadata
    // Convert duration to integer seconds (handle various formats: "01:46", milliseconds, etc.)
    const durationInSeconds = parseDurationToSeconds(mediaData.duration);
    
    // Truncate thumbnail URL if too long (TikTok URLs can be very long with signatures)
    const thumbnailUrl = truncateUrl(mediaData.thumbnailUrl, 1000);
    
    // Prepare update data with proper type conversions and null handling
    const updateData: any = {
      progress: 30,
      platform: mediaData.platform,
      sourceLang: mediaData.sourceLang || 'auto',
    };
    
    // Only set fields if they have valid values (avoid empty strings and null)
    if (mediaData.title) {
      updateData.title = mediaData.title.substring(0, 500);
    }
    
    if (mediaData.author && mediaData.author.trim()) {
      updateData.author = mediaData.author.substring(0, 255);
    }
    
    if (durationInSeconds !== undefined && durationInSeconds !== null) {
      updateData.duration = durationInSeconds;
    }
    
    if (thumbnailUrl) {
      updateData.thumbnailUrl = thumbnailUrl;
    }
    
    if (mediaData.publishedAt) {
      updateData.publishedAt = mediaData.publishedAt;
    }
    
    // Ensure numeric fields are integers (not null or undefined)
    updateData.likes = typeof mediaData.likes === 'number' 
      ? mediaData.likes 
      : (parseInt(String(mediaData.likes || 0), 10) || 0);
    updateData.views = typeof mediaData.views === 'number' 
      ? mediaData.views 
      : (parseInt(String(mediaData.views || 0), 10) || 0);
    updateData.shares = typeof mediaData.shares === 'number' 
      ? mediaData.shares 
      : (parseInt(String(mediaData.shares || 0), 10) || 0);
    
    await updateMediaTaskById(taskId, updateData);

    // 8. Handle video upload if needed (TikTok + YouTube video output type)
    // 使用异步上传策略：Worker 立即返回，上传在后台进行
    if (outputType === 'video' && mediaData.videoUrl) {
      await updateMediaTaskById(taskId, {
        status: 'downloading', // 更新状态为 downloading（表示正在上传）
        progress: 40,
        videoUrl: mediaData.videoUrl, // 先保存原始 URL，供下载使用
      });

      // 异步上传到 Vercel Blob（不 await，不阻塞 Worker）
      // 如果配置了 Vercel Blob，尝试上传；否则使用原始 URL
      if (process.env.BLOB_READ_WRITE_TOKEN) {
        (async () => {
          try {
            console.log(`[Worker] 📤 [Upload] Starting async upload for ${mediaData.platform} video...`);
            const storageIdentifier = await uploadVideoToStorage(mediaData.videoUrl || '');

            if (storageIdentifier) {
              // 上传成功：使用 Vercel Blob URL（永久有效）
              const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
              await updateMediaTaskById(taskId, {
                videoUrlInternal: storageIdentifier,
                expiresAt,
                progress: 100,
                status: 'extracted',
              });
              console.log(`[Worker] ✅ [Upload] Video uploaded to Vercel Blob successfully`);
            } else {
              // 上传失败：使用原始 URL（2小时过期）
              const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2 hours
              await updateMediaTaskById(taskId, {
                videoUrlInternal: `original:${mediaData.videoUrl}`,
                expiresAt,
                progress: 100,
                status: 'extracted',
              });
              console.log(`[Worker] ⚠️ [Upload] Upload failed, using original URL`);
            }
          } catch (uploadError: any) {
            // 上传出错：使用原始 URL（2小时过期）
            console.error(`[Worker] ❌ [Upload] Upload error:`, uploadError.message);
            const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2 hours
            await updateMediaTaskById(taskId, {
              videoUrlInternal: `original:${mediaData.videoUrl}`,
              expiresAt,
              progress: 100,
              status: 'extracted',
            });
          }
        })();
      } else {
        // 没有配置 Vercel Blob：直接使用原始 URL
        const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2 hours
        await updateMediaTaskById(taskId, {
          videoUrlInternal: `original:${mediaData.videoUrl}`,
          expiresAt,
          progress: 70,
        });
      }
    }

    // 9. Save subtitle content
    await updateMediaTaskById(taskId, {
      progress: outputType === 'video' && process.env.BLOB_READ_WRITE_TOKEN ? 50 : 90, // 如果是视频任务且配置了 Blob，进度稍低（因为上传在后台进行）
      subtitleRaw: mediaData.subtitleRaw || null,
    });

    // 10. Mark as extracted (ready for translation)
    // 注意：如果是视频任务且配置了 Vercel Blob，videoUrlInternal 会在异步上传完成后更新
    // 这里先使用原始 URL 或 null，确保 Worker 可以立即返回
    if (outputType === 'video' && mediaData.videoUrl) {
      // 视频任务：如果配置了 Vercel Blob，上传在后台进行，这里不等待
      // 如果没有配置 Vercel Blob，videoUrlInternal 已经在上面设置了
      if (!process.env.BLOB_READ_WRITE_TOKEN) {
        // 没有配置 Blob，直接标记为完成
        await updateMediaTaskById(taskId, {
          status: 'extracted',
          progress: 100,
        });
      } else {
        // 配置了 Blob，上传在后台进行，这里只更新进度
        // videoUrlInternal 和 status 会在上传完成后更新
        await updateMediaTaskById(taskId, {
          progress: 60, // 上传进行中
        });
      }
    } else {
      // 字幕任务：直接标记为完成
      await updateMediaTaskById(taskId, {
        status: 'extracted',
        progress: 100,
      });
    }

    const totalTime = Date.now() - workerStartTime;
    console.log(`[Worker] ✅ [Success] Task ${taskId} completed successfully`, {
      totalTime: `${Math.round(totalTime / 1000)}s`,
      status: outputType === 'video' && process.env.BLOB_READ_WRITE_TOKEN ? 'downloading (uploading in background)' : 'extracted',
      hasVideo: !!mediaData.videoUrl,
      hasSubtitle: !!mediaData.subtitleRaw,
      platform: mediaData.platform,
      uploadStrategy: outputType === 'video' && process.env.BLOB_READ_WRITE_TOKEN ? 'async' : 'sync',
    });

    // Worker 立即返回（不等待视频上传完成）
    return Response.json({ success: true, message: 'Task completed successfully' });
  } catch (error: any) {
    const totalTime = Date.now() - workerStartTime;
    const errorMessage = error.message || 'Processing failed';
    
    console.error(`[Worker] ❌ [Error] Task processing failed: ${taskId || 'unknown'}`, {
      error: {
        message: errorMessage,
        code: error.code,
        name: error.name,
        stack: error.stack?.substring(0, 500),
      },
      context: {
        url: url?.substring(0, 50) || 'unknown',
        outputType: outputType || 'unknown',
        totalTime: `${Math.round(totalTime / 1000)}s`,
        timestamp: new Date().toISOString(),
      },
    });

    // Update task status to failed and trigger automatic credit refund
    // updateMediaTaskById automatically handles credit refund when status is 'failed'
    if (taskId) {
      try {
        await updateMediaTaskById(taskId, {
          status: 'failed',
          errorMessage: errorMessage,
          progress: 0,
        });
        console.log(`[Worker] 💰 [Refund] Credit refund triggered for task ${taskId}`);
      } catch (updateError: any) {
        console.error(`[Worker] ❌ [Error] Failed to update task status to failed:`, {
          taskId,
          updateError: updateError.message,
          originalError: errorMessage,
        });
      }
    } else {
      console.error(`[Worker] ❌ [Error] Cannot update task status: taskId is null`);
    }

    // Return 200 instead of 500 to prevent QStash from retrying
    // Error has been logged and task status updated, no need to retry
    return Response.json(
      { 
        success: false,
        error: errorMessage,
        message: 'Error handled, task marked as failed, credits refunded (if applicable)',
      },
      { status: 200 }
    );
  }
}

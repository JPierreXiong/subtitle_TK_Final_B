/**
 * Media Rewrite API Route
 * Handles viral script rewriting (async, no timeout risk)
 * 
 * Flow:
 * 1. API immediately returns 202 Accepted
 * 2. Background process: Original → English Master → Target Language
 * 3. Updates database via Supabase Realtime
 */

import { NextRequest } from 'next/server';
import { respData, respErr } from '@/shared/lib/resp';
import { getUserInfo } from '@/shared/models/user';
import {
  findMediaTaskById,
  updateMediaTaskById,
} from '@/shared/models/media_task';
import { processViralRewrite } from '@/shared/services/media/gemini-rewriter';

/**
 * POST /api/media/rewrite
 * Start viral rewrite task (async, returns immediately)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { taskId, style, targetLang } = body;

    // Validation
    if (!taskId) {
      return respErr('Task ID is required');
    }

    if (!style) {
      return respErr('Rewrite style is required (e.g., "funny", "professional", "viral")');
    }

    if (!targetLang) {
      return respErr('Target language is required');
    }

    // Get current user
    const user = await getUserInfo();
    if (!user) {
      return respErr('no auth, please sign in');
    }

    // Find task
    const task = await findMediaTaskById(taskId);
    if (!task) {
      return respErr('Task not found');
    }

    // Check permission
    if (task.userId !== user.id) {
      return respErr('no permission');
    }

    // Check task status (must be extracted or completed)
    if (task.status !== 'extracted' && task.status !== 'completed') {
      return respErr(
        `Task is not ready for rewriting. Current status: ${task.status}`
      );
    }

    // Check if subtitle exists
    if (!task.subtitleRaw || task.subtitleRaw.trim().length === 0) {
      return respErr('No subtitle content to rewrite. Please ensure the video extraction completed successfully.');
    }

    // Immediately update status to 'processing' (for Realtime display)
    await updateMediaTaskById(taskId, {
      status: 'processing',
      progress: 50, // Indicate rewriting in progress
    });

    // Start async rewrite process (don't await - prevents timeout)
    // This runs in background, updates database when complete
    processRewriteAsync(taskId, task.subtitleRaw, style, targetLang).catch(
      (error) => {
        console.error('[Rewrite API] Background rewrite failed:', error);
        // Error handling is done in processRewriteAsync
      }
    );

    // Immediately return success (202 Accepted pattern)
    return Response.json(
      {
        code: 0,
        message: 'ok',
        data: {
          success: true,
          message: 'Rewrite task started. Results will be available via Realtime updates.',
        },
      },
      { status: 202 } // HTTP 202 Accepted
    );
  } catch (error: any) {
    console.error('Media rewrite failed:', error);
    return respErr(error.message || 'Failed to start rewrite task');
  }
}

/**
 * Async rewrite process (runs in background)
 * Updates database when complete, triggers Realtime notification
 */
async function processRewriteAsync(
  taskId: string,
  originalText: string,
  style: string,
  targetLang: string
) {
  try {
    console.log(`[Rewrite] Starting rewrite for task ${taskId}`, {
      style,
      targetLang,
    });

    // Step 1: Generate English master + translate to target language
    const { enScript, tlScript } = await processViralRewrite(
      originalText,
      style,
      targetLang
    );

    console.log(`[Rewrite] Rewrite completed for task ${taskId}`);

    // Step 2: Get current task to read existing rewrittenScripts
    const task = await findMediaTaskById(taskId);
    if (!task) {
      throw new Error('Task not found during rewrite');
    }

    // Step 3: Parse existing rewrittenScripts (JSONB field)
    let existingScripts: any[] = [];
    try {
      if (task.rewrittenScripts && typeof task.rewrittenScripts === 'string') {
        existingScripts = JSON.parse(task.rewrittenScripts);
      } else if (Array.isArray(task.rewrittenScripts)) {
        existingScripts = task.rewrittenScripts;
      }
    } catch (e) {
      console.warn('[Rewrite] Failed to parse existing rewrittenScripts, using empty array');
      existingScripts = [];
    }

    // Step 4: Create new rewrite entry
    const newEntry = {
      style,
      en: enScript,
      target: tlScript,
      lang: targetLang,
      createdAt: new Date().toISOString(),
    };

    // Step 5: Append to existing scripts array
    const updatedScripts = [...existingScripts, newEntry];

    // Step 6: Update database (triggers Realtime notification)
    await updateMediaTaskById(taskId, {
      rewrittenScripts: updatedScripts as any, // Store as JSONB array
      status: 'completed',
      progress: 100,
    });

    console.log(`[Rewrite] ✅ Successfully saved rewrite for task ${taskId}`);
  } catch (error: any) {
    console.error(`[Rewrite] ❌ Failed for task ${taskId}:`, error);

    // Update status to failed
    await updateMediaTaskById(taskId, {
      status: 'failed',
      errorMessage: `Rewrite failed: ${error.message}`,
      progress: 0,
    });
  }
}

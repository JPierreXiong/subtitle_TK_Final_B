'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { RealtimeChannel } from '@supabase/supabase-js';
import { getSupabaseClientSingleton } from '@/shared/lib/supabase';
import { toast } from 'sonner';

import type { MediaTaskStatus } from './use-media-task';

const GENERATION_TIMEOUT = 300000; // 5 minutes

/**
 * Hook to subscribe to real-time updates for a media task using Supabase Realtime
 * 
 * This hook replaces polling with real-time database change notifications.
 * When the task status changes in the database, the frontend receives an immediate update.
 * 
 * @param taskId - The ID of the media task to subscribe to
 * @returns The current task status, loading state, and error state
 * 
 * @example
 * ```tsx
 * const task = useMediaTaskRealtime(taskId);
 * 
 * if (task?.status === 'completed') {
 *   // Task completed, show results
 * }
 * ```
 */
export function useMediaTaskRealtime(taskId: string | null) {
  const [task, setTask] = useState<MediaTaskStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const generationStartTimeRef = useRef<number | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch initial task status
  const fetchTaskStatus = useCallback(async (id: string) => {
    try {
      setIsLoading(true);
      const resp = await fetch(`/api/media/status?id=${id}`);
      
      if (!resp.ok) {
        throw new Error(`Request failed with status: ${resp.status}`);
      }

      const { code, message, data } = await resp.json();
      if (code !== 0) {
        throw new Error(message || 'Query task failed');
      }

      const taskData = data as MediaTaskStatus;
      setTask(taskData);
      setError(null);
      setIsLoading(false);

      // Check if task is in final state
      if (
        taskData.status === 'completed' ||
        taskData.status === 'failed' ||
        taskData.status === 'extracted'
      ) {
        if (taskData.status === 'failed') {
          toast.error(`Task failed: ${taskData.errorMessage || 'Unknown error'}`);
        } else if (taskData.status === 'extracted') {
          toast.success('Extraction completed! You can now translate.');
        } else if (taskData.status === 'completed') {
          toast.success('Translation completed successfully!');
        }
      }

      return taskData;
    } catch (err: any) {
      console.error('[useMediaTaskRealtime] Error fetching task status:', err);
      setError(err.message || 'Failed to query task status');
      setIsLoading(false);
      throw err;
    }
  }, []);

  // Subscribe to real-time updates
  useEffect(() => {
    if (!taskId) {
      // Reset state when taskId is null
      setTask(null);
      setError(null);
      setIsLoading(false);
      return;
    }

    const supabase = getSupabaseClientSingleton();
    generationStartTimeRef.current = Date.now();

    // Fetch initial status
    fetchTaskStatus(taskId).catch((err) => {
      console.error('[useMediaTaskRealtime] Failed to fetch initial status:', err);
    });

    // Subscribe to real-time changes on the media_tasks table
    if (!supabase) return;
    const channel = supabase
      .channel(`media_task_${taskId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'media_tasks',
          filter: `id=eq.${taskId}`,
        },
        (payload: any) => {
          console.log('[useMediaTaskRealtime] Received real-time update:', payload);
          
          // Update task state with new data
          const updatedTask = payload.new as any;
          const taskData: MediaTaskStatus = {
            id: updatedTask.id,
            status: updatedTask.status,
            progress: updatedTask.progress || 0,
            srtUrl: updatedTask.srt_url || undefined,
            translatedSrtUrl: updatedTask.translated_srt_url || undefined,
            resultVideoUrl: updatedTask.result_video_url || undefined,
            errorMessage: updatedTask.error_message || undefined,
            sourceLang: updatedTask.source_lang || undefined,
            targetLang: updatedTask.target_lang || undefined,
            title: updatedTask.title || undefined,
            platform: updatedTask.platform || undefined,
            subtitleRaw: updatedTask.subtitle_raw || undefined,
            subtitleTranslated: updatedTask.subtitle_translated || undefined,
            videoUrlInternal: updatedTask.video_url_internal || undefined,
            expiresAt: updatedTask.expires_at ? new Date(updatedTask.expires_at).toISOString() : undefined,
            outputType: updatedTask.output_type || undefined,
            author: updatedTask.author || undefined,
            likes: updatedTask.likes || undefined,
            views: updatedTask.views || undefined,
            shares: updatedTask.shares || undefined,
            thumbnailUrl: updatedTask.thumbnail_url || undefined,
            createdAt: updatedTask.created_at ? new Date(updatedTask.created_at).toISOString() : undefined,
            updatedAt: updatedTask.updated_at ? new Date(updatedTask.updated_at).toISOString() : undefined,
            // Parse rewrittenScripts (JSONB field)
            rewrittenScripts: (() => {
              try {
                if (!updatedTask.rewritten_scripts) return undefined;
                if (typeof updatedTask.rewritten_scripts === 'string') {
                  return JSON.parse(updatedTask.rewritten_scripts);
                }
                if (Array.isArray(updatedTask.rewritten_scripts)) {
                  return updatedTask.rewritten_scripts;
                }
                return undefined;
              } catch (e) {
                console.warn('[useMediaTaskRealtime] Failed to parse rewrittenScripts:', e);
                return undefined;
              }
            })(),
          };

          setTask(taskData);

          // Handle final states
          if (
            taskData.status === 'completed' ||
            taskData.status === 'failed' ||
            taskData.status === 'extracted'
          ) {
            if (taskData.status === 'failed') {
              toast.error(`Task failed: ${taskData.errorMessage || 'Unknown error'}`);
            } else if (taskData.status === 'extracted') {
              toast.success('Extraction completed! You can now translate.');
            } else if (taskData.status === 'completed') {
              toast.success('Translation completed successfully!');
            }
          }
        }
      )
      .subscribe((status: any) => {
        console.log('[useMediaTaskRealtime] Subscription status:', status);
        
        if (status === 'SUBSCRIBED') {
          console.log('[useMediaTaskRealtime] ✅ Successfully subscribed to real-time updates');
        } else if (status === 'CHANNEL_ERROR') {
          console.error('[useMediaTaskRealtime] ❌ Channel error, falling back to polling');
          setError('Realtime connection failed, using polling fallback');
        }
      });

    channelRef.current = channel;

    // Set up timeout check
    timeoutRef.current = setInterval(() => {
      if (generationStartTimeRef.current) {
        const elapsedTime = Date.now() - generationStartTimeRef.current;
        if (elapsedTime > GENERATION_TIMEOUT) {
          setError('Task timed out. Please try again.');
          toast.error('Task timed out. Please try again.');
          if (channelRef.current && supabase) {
            supabase.removeChannel(channelRef.current);
            channelRef.current = null;
          }
        }
      }
    }, 5000); // Check every 5 seconds

    // Cleanup function
    return () => {
      if (timeoutRef.current) {
        clearInterval(timeoutRef.current);
        timeoutRef.current = null;
      }
      
      if (channelRef.current && supabase) {
        console.log('[useMediaTaskRealtime] Unsubscribing from real-time updates');
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [taskId, fetchTaskStatus]);

  return {
    task,
    isLoading,
    error,
  };
}

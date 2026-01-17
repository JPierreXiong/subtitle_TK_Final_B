'use client';

import { useMediaTaskRealtime } from '@/shared/hooks/use-media-task-realtime';
import { Button } from '@/shared/components/ui/button';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { Copy, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

interface RewriteDisplayProps {
  taskId: string;
}

interface RewriteEntry {
  style: string;
  en: string;
  target: string;
  lang: string;
  createdAt: string;
}

/**
 * RewriteDisplay Component
 * Displays rewritten scripts in English Master + Target Language format
 * Uses Supabase Realtime to automatically update when rewrite completes
 */
export function RewriteDisplay({ taskId }: RewriteDisplayProps) {
  const { task, isLoading } = useMediaTaskRealtime(taskId);

  // Get latest rewrite entry
  const latestRewrite: RewriteEntry | undefined = task?.rewrittenScripts?.slice(-1)[0];

  // Check if currently rewriting
  const isRewriting = task?.status === 'processing' && task?.progress === 50;

  // Copy to clipboard helper
  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} copied to clipboard!`);
    } catch (error) {
      toast.error('Failed to copy to clipboard');
    }
  };

  // Loading state
  if (isLoading && !latestRewrite) {
    return (
      <div className="space-y-4 p-4 border rounded-xl bg-slate-50">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  // Rewriting state
  if (isRewriting) {
    return (
      <div className="space-y-4 p-4 border rounded-xl bg-gradient-to-r from-blue-50 to-purple-50">
        <div className="flex items-center gap-2">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
          <p className="text-sm font-medium text-primary">
            Gemini is rewriting your script and localizing it...
          </p>
        </div>
        <div className="space-y-2">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      </div>
    );
  }

  // No rewrite yet
  if (!latestRewrite) {
    return null;
  }

  return (
    <div className="mt-6 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-primary" />
        <h3 className="text-lg font-semibold">Viral Script Rewrite</h3>
        <span className="text-xs text-muted-foreground">
          Style: {latestRewrite.style}
        </span>
      </div>

      {/* Dual Column Layout: English Master + Target Language */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* English Master - Core SEO Asset */}
        <div className="group relative p-4 bg-white border-2 border-blue-100 rounded-xl hover:shadow-lg transition-all">
          <div className="flex justify-between items-center mb-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-blue-600 bg-blue-50 px-2 py-1 rounded">
                English Master
              </span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => copyToClipboard(latestRewrite.en, 'English Master')}
              className="h-7 w-7 p-0"
            >
              <Copy className="h-4 w-4" />
            </Button>
          </div>
          <div className="prose prose-sm max-w-none">
            <p className="text-slate-800 leading-relaxed whitespace-pre-wrap font-medium">
              {latestRewrite.en}
            </p>
          </div>
          <div className="mt-3 pt-3 border-t border-blue-100">
            <p className="text-xs text-muted-foreground">
              This English version is optimized for SEO and global reach
            </p>
          </div>
        </div>

        {/* Target Language - Localized Version */}
        <div className="group relative p-4 bg-gradient-to-br from-primary/5 to-primary/10 border-2 border-primary/20 rounded-xl hover:shadow-lg transition-all">
          <div className="flex justify-between items-center mb-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-primary bg-primary/10 px-2 py-1 rounded">
                {latestRewrite.lang.toUpperCase()} Localized
              </span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => copyToClipboard(latestRewrite.target, `${latestRewrite.lang} Version`)}
              className="h-7 w-7 p-0"
            >
              <Copy className="h-4 w-4" />
            </Button>
          </div>
          <div className="prose prose-sm max-w-none">
            <p className="text-slate-800 leading-relaxed whitespace-pre-wrap font-semibold">
              {latestRewrite.target}
            </p>
          </div>
          <div className="mt-3 pt-3 border-t border-primary/20">
            <p className="text-xs text-muted-foreground">
              Natural, culturally-appropriate translation with local expressions
            </p>
          </div>
        </div>
      </div>

      {/* Metadata */}
      <div className="text-xs text-muted-foreground text-center">
        Created at {new Date(latestRewrite.createdAt).toLocaleString()}
      </div>
    </div>
  );
}

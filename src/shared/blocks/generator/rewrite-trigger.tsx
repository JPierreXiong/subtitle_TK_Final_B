'use client';

import { useState } from 'react';
import { Button } from '@/shared/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/shared/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Sparkles, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface RewriteTriggerProps {
  taskId: string;
  currentStatus: string;
  onRewriteStart?: () => void;
}

/**
 * RewriteTrigger Component
 * Button and dialog to trigger viral script rewrite
 */
export function RewriteTrigger({
  taskId,
  currentStatus,
  onRewriteStart,
}: RewriteTriggerProps) {
  const [open, setOpen] = useState(false);
  const [style, setStyle] = useState('viral');
  const [targetLang, setTargetLang] = useState('zh-CN');
  const [customStyle, setCustomStyle] = useState('');
  const [loading, setLoading] = useState(false);

  // Check if task is ready for rewriting
  const canRewrite = currentStatus === 'extracted' || currentStatus === 'completed';

  const handleRewrite = async () => {
    if (!style && !customStyle.trim()) {
      toast.error('Please select or enter a rewrite style');
      return;
    }

    if (!targetLang) {
      toast.error('Please select a target language');
      return;
    }

    setLoading(true);
    try {
      const finalStyle = customStyle.trim() || style;

      const response = await fetch('/api/media/rewrite', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          taskId,
          style: finalStyle,
          targetLang,
        }),
      });

      const data = await response.json();

      if (response.status === 202 || (data.code === 0 && data.data?.success)) {
        toast.success('Rewrite task started! Results will appear automatically.');
        setOpen(false);
        onRewriteStart?.();
      } else {
        throw new Error(data.message || 'Failed to start rewrite task');
      }
    } catch (error: any) {
      console.error('Rewrite failed:', error);
      toast.error(error.message || 'Failed to start rewrite task');
    } finally {
      setLoading(false);
    }
  };

  if (!canRewrite) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Sparkles className="h-4 w-4" />
          Rewrite Script
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Viral Script Rewrite</DialogTitle>
          <DialogDescription>
            Transform your subtitle into a viral script. We'll create an English master version, then translate it to your target language.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Style Selection */}
          <div className="space-y-2">
            <Label htmlFor="style">Rewrite Style</Label>
            <Select value={style} onValueChange={setStyle}>
              <SelectTrigger id="style">
                <SelectValue placeholder="Select a style" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="viral">Viral (Engaging & Shareable)</SelectItem>
                <SelectItem value="funny">Funny (Humorous & Entertaining)</SelectItem>
                <SelectItem value="professional">Professional (Formal & Polished)</SelectItem>
                <SelectItem value="casual">Casual (Conversational & Friendly)</SelectItem>
                <SelectItem value="dramatic">Dramatic (Emotional & Impactful)</SelectItem>
                <SelectItem value="custom">Custom (Enter your own)</SelectItem>
              </SelectContent>
            </Select>
            {style === 'custom' && (
              <Input
                placeholder="e.g., motivational, educational, storytelling..."
                value={customStyle}
                onChange={(e) => setCustomStyle(e.target.value)}
                className="mt-2"
              />
            )}
          </div>

          {/* Target Language */}
          <div className="space-y-2">
            <Label htmlFor="targetLang">Target Language</Label>
            <Select value={targetLang} onValueChange={setTargetLang}>
              <SelectTrigger id="targetLang">
                <SelectValue placeholder="Select target language" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="zh-CN">简体中文 (Simplified Chinese)</SelectItem>
                <SelectItem value="zh-TW">繁體中文 (Traditional Chinese)</SelectItem>
                <SelectItem value="es">Español (Spanish)</SelectItem>
                <SelectItem value="fr">Français (French)</SelectItem>
                <SelectItem value="de">Deutsch (German)</SelectItem>
                <SelectItem value="ja">日本語 (Japanese)</SelectItem>
                <SelectItem value="ko">한국어 (Korean)</SelectItem>
                <SelectItem value="pt">Português (Portuguese)</SelectItem>
                <SelectItem value="ru">Русский (Russian)</SelectItem>
                <SelectItem value="ar">العربية (Arabic)</SelectItem>
                <SelectItem value="hi">हिन्दी (Hindi)</SelectItem>
                <SelectItem value="it">Italiano (Italian)</SelectItem>
                <SelectItem value="nl">Nederlands (Dutch)</SelectItem>
                <SelectItem value="pl">Polski (Polish)</SelectItem>
                <SelectItem value="tr">Türkçe (Turkish)</SelectItem>
                <SelectItem value="vi">Tiếng Việt (Vietnamese)</SelectItem>
                <SelectItem value="th">ไทย (Thai)</SelectItem>
                <SelectItem value="id">Bahasa Indonesia (Indonesian)</SelectItem>
                <SelectItem value="ms">Bahasa Melayu (Malay)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button onClick={handleRewrite} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Starting...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                Start Rewrite
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

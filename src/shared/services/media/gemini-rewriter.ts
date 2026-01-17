/**
 * Gemini Rewriter Service
 * Rewrites subtitle content into viral scripts using Gemini API
 * Process: Original → English Master → Target Language
 */

import { Configs, getAllConfigs } from '@/shared/models/config';

/**
 * Gemini Rewriter configuration
 */
export interface GeminiRewriterConfigs {
  apiKey: string;
  model?: string;
  baseUrl?: string;
}

/**
 * Rewrite result interface
 */
export interface RewriteResult {
  enScript: string; // English master version
  tlScript: string; // Target language version
}

/**
 * Gemini Rewriter class
 * Handles viral script rewriting using Gemini API
 */
export class GeminiRewriter {
  private configs: GeminiRewriterConfigs;
  private readonly DEFAULT_MODEL = 'gemini-1.5-flash';
  private readonly DEFAULT_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';
  private readonly DEFAULT_TIMEOUT = 180000; // 3 minutes (longer for two-step process)

  constructor(configs: GeminiRewriterConfigs) {
    this.configs = configs;
  }

  /**
   * Process viral rewrite: Original → English Master → Target Language
   * @param originalText Original SRT subtitle content
   * @param style Rewrite style (e.g., "funny", "professional", "viral")
   * @param targetLang Target language code (e.g., 'zh-CN', 'es', 'fr')
   * @returns Rewrite result with English master and target language versions
   */
  async processViralRewrite(
    originalText: string,
    style: string,
    targetLang: string
  ): Promise<RewriteResult> {
    if (!originalText || !originalText.trim()) {
      throw new Error('Original subtitle content is empty');
    }

    if (!style) {
      throw new Error('Rewrite style is required');
    }

    if (!targetLang) {
      throw new Error('Target language is required');
    }

    try {
      // Step 1: Generate English viral master script
      const enScript = await this.generateEnglishMaster(originalText, style);

      // Step 2: Translate English master to target language
      const tlScript = await this.translateToTargetLanguage(enScript, targetLang);

      return {
        enScript,
        tlScript,
      };
    } catch (error: any) {
      console.error('[Gemini Rewriter] Error:', error);
      throw new Error(`Rewrite failed: ${error.message}`);
    }
  }

  /**
   * Generate English viral master script
   * @param originalText Original SRT subtitle content
   * @param style Rewrite style
   * @returns English master script (SRT format)
   */
  private async generateEnglishMaster(
    originalText: string,
    style: string
  ): Promise<string> {
    const model = this.configs.model || this.DEFAULT_MODEL;
    const apiKey = this.configs.apiKey;
    const baseUrl = this.configs.baseUrl || this.DEFAULT_BASE_URL;

    const url = `${baseUrl}/models/${model}:generateContent?key=${apiKey}`;

    const prompt = this.buildEnglishMasterPrompt(originalText, style);

    const requestBody = {
      contents: [
        {
          parts: [
            {
              text: prompt,
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.7, // Higher temperature for creative rewriting
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 8192,
      },
    };

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
        signal: AbortSignal.timeout(this.DEFAULT_TIMEOUT),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          `Gemini API failed: ${response.status} ${response.statusText}. ${JSON.stringify(errorData)}`
        );
      }

      const data = await response.json();
      const generatedText =
        data.candidates?.[0]?.content?.parts?.[0]?.text || '';

      if (!generatedText) {
        throw new Error('No rewrite result from Gemini API');
      }

      // Clean up the response
      return this.cleanRewriteResult(generatedText);
    } catch (error: any) {
      if (error.name === 'AbortError') {
        throw new Error('English master generation timed out');
      }
      throw error;
    }
  }

  /**
   * Translate English master to target language
   * @param enScript English master script
   * @param targetLang Target language code
   * @returns Translated script (SRT format)
   */
  private async translateToTargetLanguage(
    enScript: string,
    targetLang: string
  ): Promise<string> {
    const model = this.configs.model || this.DEFAULT_MODEL;
    const apiKey = this.configs.apiKey;
    const baseUrl = this.configs.baseUrl || this.DEFAULT_BASE_URL;

    const url = `${baseUrl}/models/${model}:generateContent?key=${apiKey}`;

    const prompt = this.buildTranslationPrompt(enScript, targetLang);

    const requestBody = {
      contents: [
        {
          parts: [
            {
              text: prompt,
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.5, // Moderate temperature for natural translation
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 8192,
      },
    };

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
        signal: AbortSignal.timeout(this.DEFAULT_TIMEOUT),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          `Gemini API failed: ${response.status} ${response.statusText}. ${JSON.stringify(errorData)}`
        );
      }

      const data = await response.json();
      const translatedText =
        data.candidates?.[0]?.content?.parts?.[0]?.text || '';

      if (!translatedText) {
        throw new Error('No translation result from Gemini API');
      }

      // Clean up the response
      return this.cleanRewriteResult(translatedText);
    } catch (error: any) {
      if (error.name === 'AbortError') {
        throw new Error('Translation timed out');
      }
      throw error;
    }
  }

  /**
   * Build prompt for English master generation
   * Focus on strong opening hook and short, punchy sentences for high retention
   */
  private buildEnglishMasterPrompt(originalText: string, style: string): string {
    return `You are a viral TikTok creator. Rewrite the following transcript into a high-retention English script optimized for TikTok/Reels algorithm.

Style: ${style}

Original SRT Content:
${originalText}

Critical Instructions:
1. Keep all timestamps (e.g., 00:00:01,000 --> 00:00:03,000) EXACTLY unchanged
2. Keep all sequence numbers (e.g., 1, 2, 3) EXACTLY unchanged
3. STRONG OPENING HOOK: First 3 seconds must grab attention immediately
4. SHORT, PUNCHY SENTENCES: Break long sentences into short, impactful phrases
5. HIGH RETENTION: Use curiosity gaps, emotional triggers, and pattern interrupts
6. ALGORITHM OPTIMIZED: Include viral keywords and trending phrases naturally
7. Maintain SRT format structure (sequence number, timestamp, text)
8. Return ONLY the SRT content, no explanations, no markdown, no code blocks

Rewritten English Master SRT Content:`;
  }

  /**
   * Build prompt for translation
   * Focus on localization with internet slang and conversational tones
   */
  private buildTranslationPrompt(enScript: string, targetLang: string): string {
    const langName = this.getLanguageName(targetLang);

    return `Task: Localization (NOT literal translation)

Translate the following viral English script into ${langName} (${targetLang}).

English Master Script:
${enScript}

Critical Instructions:
1. Keep all timestamps (e.g., 00:00:01,000 --> 00:00:03,000) EXACTLY unchanged
2. Keep all sequence numbers (e.g., 1, 2, 3) EXACTLY unchanged
3. DO NOT use literal translation - adapt to local culture and internet culture
4. Use internet slang, trending phrases, and memes appropriate for ${langName} short videos
5. Use conversational tones and natural speaking patterns native to ${langName} speakers
6. Maintain the viral energy and engagement hooks from the English version
7. Make it sound like a native ${langName} creator wrote it, not a translation
8. Maintain the same SRT format structure
9. Return ONLY the SRT content, no explanations, no markdown, no code blocks

Localized ${langName} SRT Content:`;
  }

  /**
   * Clean rewrite result (remove markdown, explanations, etc.)
   */
  private cleanRewriteResult(text: string): string {
    let cleaned = text.trim();

    // Remove markdown code blocks
    cleaned = cleaned.replace(/```srt\n?/gi, '');
    cleaned = cleaned.replace(/```\n?/g, '');
    cleaned = cleaned.replace(/```/g, '');

    // Remove common AI explanations
    const explanationPatterns = [
      /^Here's the rewritten.*?:?\n?/i,
      /^Here is the.*?:?\n?/i,
      /^The rewritten.*?:?\n?/i,
      /^Rewritten.*?:?\n?/i,
      /^Translated.*?:?\n?/i,
    ];

    explanationPatterns.forEach((pattern) => {
      cleaned = cleaned.replace(pattern, '');
    });

    return cleaned.trim();
  }

  /**
   * Get language name from code
   */
  private getLanguageName(langCode: string): string {
    const languageMap: Record<string, string> = {
      'zh-CN': 'Simplified Chinese',
      'zh-TW': 'Traditional Chinese',
      'en': 'English',
      'es': 'Spanish',
      'fr': 'French',
      'de': 'German',
      'ja': 'Japanese',
      'ko': 'Korean',
      'pt': 'Portuguese',
      'ru': 'Russian',
      'ar': 'Arabic',
      'hi': 'Hindi',
      'it': 'Italian',
      'nl': 'Dutch',
      'pl': 'Polish',
      'tr': 'Turkish',
      'vi': 'Vietnamese',
      'th': 'Thai',
      'id': 'Indonesian',
      'ms': 'Malay',
    };

    return languageMap[langCode] || langCode;
  }
}

/**
 * Get Gemini rewriter service with configs
 */
export function getGeminiRewriterWithConfigs(
  configs: Configs
): GeminiRewriter {
  const apiKey =
    process.env.GEMINI_API_KEY || configs.gemini_api_key || '';

  if (!apiKey) {
    throw new Error('Gemini API key is not configured');
  }

  return new GeminiRewriter({
    apiKey,
    model: configs.gemini_model || 'gemini-1.5-flash',
    baseUrl: process.env.GEMINI_BASE_URL,
  });
}

/**
 * Global Gemini rewriter instance
 */
let geminiRewriter: GeminiRewriter | null = null;

/**
 * Get Gemini rewriter service
 */
export async function getGeminiRewriter(): Promise<GeminiRewriter> {
  if (geminiRewriter) {
    return geminiRewriter;
  }

  const configs = await getAllConfigs();
  geminiRewriter = getGeminiRewriterWithConfigs(configs);

  return geminiRewriter;
}

/**
 * Process viral rewrite using Gemini
 * @param originalText Original SRT subtitle content
 * @param style Rewrite style
 * @param targetLang Target language code
 * @returns Rewrite result
 */
export async function processViralRewrite(
  originalText: string,
  style: string,
  targetLang: string
): Promise<RewriteResult> {
  const rewriter = await getGeminiRewriter();
  return await rewriter.processViralRewrite(originalText, style, targetLang);
}

/**
 * RapidAPI Provider for YouTube and TikTok media extraction
 * Handles video metadata and subtitle extraction from RapidAPI services
 */

import { SubtitleFormatter } from './subtitle-formatter';

/**
 * RapidAPI configuration interface
 */
export interface RapidAPIConfigs {
  apiKey: string;
  // 主备配置（从环境变量读取）
  tiktokTranscript?: {
    primaryHost: string;
    backupHost: string;
  };
  tiktokVideo?: {
    primaryHost: string;
    backupHost: string;
  };
  youtubeTranscript?: {
    primaryHost: string;
    backupHost: string;
  };
  youtubeVideo?: {
    primaryHost: string;
    backupHost: string;
  };
  // 向后兼容的旧配置（如果新配置不存在，使用这些）
  hostTikTokDownload?: string;
  hostTikTokTranscript?: string;
  hostYouTubeTranscript?: string;
  hostYouTubeDownload?: string;
}

/**
 * Normalized media data output interface
 * Standardized format for database storage
 */
export interface NormalizedMediaData {
  platform: 'youtube' | 'tiktok';
  title: string;
  author?: string;
  likes: number;
  views: number;
  shares: number;
  duration?: number;
  publishedAt?: Date;
  thumbnailUrl?: string;
  videoUrl?: string; // Original video download URL (for R2 upload)
  subtitleRaw?: string; // Formatted SRT string
  sourceLang?: string; // Detected source language
  // Additional metadata
  subtitleCharCount?: number; // Character count of subtitle (for translation estimation)
  subtitleLineCount?: number; // Line count of subtitle (for translation estimation)
  isTikTokVideo?: boolean; // Flag to indicate if this is a TikTok video with downloadable URL
}

/**
 * RapidAPI Provider class
 * Handles media extraction from YouTube and TikTok via RapidAPI
 */
export class RapidAPIProvider {
  private configs: RapidAPIConfigs;
  private readonly DEFAULT_TIMEOUT = 180000; // 3 minutes
  
  // 统一的 User-Agent（确保所有请求使用相同的指纹）
  private readonly DEFAULT_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

  constructor(configs: RapidAPIConfigs) {
    this.configs = configs;
  }

  /**
   * Main entry point: Automatically identify platform and extract media data
   * @param url Video URL (YouTube or TikTok)
   * @param outputType Output type: 'subtitle' for subtitle extraction, 'video' for video download
   * @returns Normalized media data
   */
  async fetchMedia(url: string, outputType: 'subtitle' | 'video' = 'subtitle'): Promise<NormalizedMediaData> {
    const platform = this.identifyPlatform(url);

    if (platform === 'tiktok') {
      // For TikTok, use different APIs based on outputType
      if (outputType === 'video') {
        return await this.fetchTikTokVideo(url);
      } else {
        return await this.fetchTikTokMedia(url);
      }
    } else if (platform === 'youtube') {
      // For YouTube, use different APIs based on outputType
      if (outputType === 'video') {
        return await this.fetchYouTubeVideo(url);
      } else {
        return await this.fetchYouTubeMedia(url);
      }
    } else {
      throw new Error(`Unsupported platform for URL: ${url}`);
    }
  }

  /**
   * Identify platform from URL
   * @param url Video URL
   * @returns Platform type
   */
  private identifyPlatform(url: string): 'youtube' | 'tiktok' {
    if (url.includes('tiktok.com') || url.includes('vm.tiktok.com')) {
      return 'tiktok';
    }
    if (url.includes('youtube.com') || url.includes('youtu.be')) {
      return 'youtube';
    }
    throw new Error(`Cannot identify platform from URL: ${url}`);
  }

  /**
   * Extract YouTube video metadata and subtitles
   * Implements fallback strategy: Free API first, then Paid API if failed
   * @param url YouTube video URL
   * @returns Normalized media data
   */
  private async fetchYouTubeMedia(url: string): Promise<NormalizedMediaData> {
    // 只使用 Flux API (ai-youtube-transcript-generator-free-online-api-flux.p.rapidapi.com)
    // 屏蔽旧的 Free API 和 Paid API
    console.log('[YouTube Transcript] Using Flux API only (ai-youtube-transcript-generator-free-online-api-flux.p.rapidapi.com)...');
    
    // Format URL (convert shorts to watch format for API compatibility)
    const formattedUrl = this.formatYouTubeUrl(url);
    
    // Extract video ID for validation
    const videoId = this.extractYouTubeVideoId(formattedUrl);
    if (!videoId) {
      throw new Error(`Invalid YouTube URL: ${url}`);
    }

    // 直接调用 Flux API
    const result = await this.fetchYouTubeTranscriptFluxAPI(formattedUrl);
    
    if (!result.success || !result.transcriptData) {
      throw new Error(`Failed to fetch YouTube transcript: ${result.reason || result.message}`);
    }
    
    const transcriptData = result.transcriptData;
    const metadata = result.metadata || {};

    // Normalize subtitle
    const subtitleRaw = transcriptData
      ? this.normalizeSubtitles(transcriptData, 'youtube')
      : null;

    // Extract metadata from transcript response if available
    const normalizedMetadata = this.normalizeMetadata(transcriptData || metadata || {}, 'youtube');

    // Calculate subtitle statistics
    const subtitleStats = subtitleRaw
      ? this.calculateSubtitleStats(subtitleRaw)
      : { charCount: 0, lineCount: 0 };

    return {
      platform: 'youtube',
      title: normalizedMetadata.title || '',
      author: normalizedMetadata.author,
      likes: normalizedMetadata.likes || 0,
      views: normalizedMetadata.views || 0,
      shares: normalizedMetadata.shares || 0,
      duration: normalizedMetadata.duration,
      publishedAt: normalizedMetadata.publishedAt,
      thumbnailUrl: normalizedMetadata.thumbnailUrl,
      subtitleRaw: subtitleRaw || undefined,
      sourceLang: normalizedMetadata.sourceLang || 'auto',
      subtitleCharCount: subtitleStats.charCount,
      subtitleLineCount: subtitleStats.lineCount,
      isTikTokVideo: false,
    };
  }

  /**
   * Fetch YouTube video download via RapidAPI (for video download only)
   * @param url YouTube video URL
   * @returns Normalized media data with video URL
   */
  private async fetchYouTubeVideo(url: string): Promise<NormalizedMediaData> {
    // Format URL (convert shorts to watch format for API compatibility)
    const formattedUrl = this.formatYouTubeUrl(url);
    
    // 使用配置中的主 API Host（从环境变量读取）
    const primaryHost =
      this.configs.youtubeVideo?.primaryHost ||
      this.configs.hostYouTubeDownload ||
      'youtube-video-and-shorts-downloader1.p.rapidapi.com';
    
    // 使用配置中的备选 API Host（从环境变量读取）
    const backupHost =
      this.configs.youtubeVideo?.backupHost ||
      'cloud-api-hub-youtube-downloader.p.rapidapi.com';

    // Extract video ID from URL
    const videoId = this.extractYouTubeVideoId(formattedUrl);
    if (!videoId) {
      throw new Error(`Invalid YouTube URL: ${url}`);
    }

    // Try primary API first
    let videoData: any = null;
    let lastError: Error | null = null;
    
    try {
      console.log(`[YouTube Video Download] Attempting primary API: ${primaryHost}...`);
      videoData = await this.fetchYouTubeVideoDownload(formattedUrl, videoId, primaryHost);
    } catch (error: any) {
      console.warn(`[YouTube Video Download] Primary API failed: ${error.message}`);
      lastError = error;
      
      // Try backup API
      try {
        console.log(`[YouTube Video Download] Switching to backup API: ${backupHost}...`);
        videoData = await this.fetchYouTubeVideoDownload(formattedUrl, videoId, backupHost);
      } catch (backupError: any) {
        console.error(`[YouTube Video Download] Backup API also failed: ${backupError.message}`);
        throw new Error(`Both APIs failed. Primary: ${lastError?.message || 'Unknown error'}, Backup: ${backupError.message}`);
      }
    }

    // Normalize metadata
    const metadata = this.normalizeMetadata(videoData, 'youtube');

    // Extract video URL using deep parser (supports all possible response formats)
    // 使用深度解析器提取视频 URL（优先 MP4，过滤 .m3u8）
    const videoUrl = this.parseYouTubeVideoUrl(videoData);
    
    if (process.env.NODE_ENV === 'development' && videoUrl) {
      console.log(`[YouTube Video Download] Parsed video URL:`, videoUrl.substring(0, 100) + '...');
    }

    // Try to get subtitle if available (optional for video download)
    let subtitleRaw: string | null = null;
    if (videoData.subtitles || videoData.transcript) {
      subtitleRaw = this.normalizeSubtitles(videoData, 'youtube');
    }

    const subtitleStats = subtitleRaw
      ? this.calculateSubtitleStats(subtitleRaw)
      : { charCount: 0, lineCount: 0 };

    return {
      platform: 'youtube',
      title: metadata.title || '',
      author: metadata.author,
      likes: metadata.likes || 0,
      views: metadata.views || 0,
      shares: metadata.shares || 0,
      duration: metadata.duration,
      publishedAt: metadata.publishedAt,
      thumbnailUrl: metadata.thumbnailUrl,
      videoUrl: videoUrl || undefined,
      subtitleRaw: subtitleRaw || undefined,
      sourceLang: metadata.sourceLang || 'auto',
      subtitleCharCount: subtitleStats.charCount,
      subtitleLineCount: subtitleStats.lineCount,
      isTikTokVideo: false, // YouTube video flag
    };
  }

  /**
   * Fetch YouTube video download via RapidAPI
   * Uses the video download API endpoint
   * API: https://youtube-video-and-shorts-downloader1.p.rapidapi.com/
   * Tries multiple possible endpoints
   * @param url YouTube video URL
   * @param videoId YouTube video ID
   * @param host RapidAPI host
   * @returns Video download data
   */
  private async fetchYouTubeVideoDownload(url: string, videoId: string, host: string): Promise<any> {
    // Try multiple possible endpoints based on API provider
    // Support for different API endpoint formats:
    // 1. youtube-video-and-shorts-downloader1: /youtube/video/download?videoId=...
    // 2. cloud-api-hub-youtube-downloader: /download?id=...&filter=...&quality=...
    
    // Check if this is cloud-api-hub-youtube-downloader API
    const isCloudApiHub = host.includes('cloud-api-hub-youtube-downloader');
    
    // Increase timeout for video download (may take longer)
    const VIDEO_DOWNLOAD_TIMEOUT = 30000; // 30 seconds
    
    let apiUrl: string;
    let response: Response;
    
    if (isCloudApiHub) {
      // cloud-api-hub-youtube-downloader API format
      // GET /download?id=VIDEO_ID&filter=audioandvideo&quality=lowest
      apiUrl = `https://${host}/download?id=${videoId}&filter=audioandvideo&quality=lowest`;
      
      console.log(`[YouTube Video Download] Using Cloud API Hub: ${apiUrl}`);
      
      response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'x-rapidapi-host': host,
          'x-rapidapi-key': this.configs.apiKey,
        },
        signal: AbortSignal.timeout(VIDEO_DOWNLOAD_TIMEOUT),
      });
    } else {
      // Standard API format (youtube-video-and-shorts-downloader1, etc.)
      // Endpoint 1: Direct video download endpoint with videoId
      apiUrl = `https://${host}/youtube/video/download?videoId=${videoId}`;
      
      console.log(`[YouTube Video Download] Using Standard API: ${apiUrl}`);
      
      response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'x-rapidapi-host': host,
          'x-rapidapi-key': this.configs.apiKey,
          'User-Agent': this.DEFAULT_USER_AGENT, // 添加 User-Agent
        },
        signal: AbortSignal.timeout(VIDEO_DOWNLOAD_TIMEOUT),
      });

      // If first endpoint fails, try alternative endpoint with URL
      if (!response.ok) {
        console.log(`[YouTube Video Download] First endpoint failed, trying POST with URL...`);
        apiUrl = `https://${host}/youtube/video/download`;
        response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-rapidapi-host': host,
            'x-rapidapi-key': this.configs.apiKey,
            'User-Agent': this.DEFAULT_USER_AGENT, // 添加 User-Agent
          },
          body: JSON.stringify({ url }),
          signal: AbortSignal.timeout(VIDEO_DOWNLOAD_TIMEOUT),
        });
      }

      // If still fails, try with videoId in POST body
      if (!response.ok) {
        console.log(`[YouTube Video Download] Second endpoint failed, trying POST with videoId...`);
        apiUrl = `https://${host}/youtube/video/download`;
        response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-rapidapi-host': host,
            'x-rapidapi-key': this.configs.apiKey,
            'User-Agent': this.DEFAULT_USER_AGENT, // 添加 User-Agent
          },
          body: JSON.stringify({ videoId }),
          signal: AbortSignal.timeout(VIDEO_DOWNLOAD_TIMEOUT),
        });
      }
    }

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      
      // 增强错误处理：详细的 HTTP 错误信息
      const errorInfo = {
        status: response.status,
        statusText: response.statusText,
        url: apiUrl,
        errorText: errorText.substring(0, 500),
      };
      
      console.error(`[YouTube Video Download] HTTP Error:`, errorInfo);
      
      if (response.status === 403) {
        throw new Error('HTTP_ERROR_403: Forbidden (可能缺少 User-Agent 或 API 权限不足)');
      }
      if (response.status === 429) {
        throw new Error('HTTP_ERROR_429: Rate limit exceeded. Please try again later.');
      }
      if (response.status === 404) {
        throw new Error('HTTP_ERROR_404: Endpoint not found (请检查 API 路径)');
      }
      
      throw new Error(`HTTP_ERROR_${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    
    // 日志分级：开发环境打印完整结构，生产环境限制长度
    const logLength = process.env.NODE_ENV === 'development' ? 2000 : 500;
    if (process.env.NODE_ENV === 'development') {
      console.log('[YouTube Video Download] DEBUG_RESPONSE:', JSON.stringify(data, null, 2).substring(0, logLength));
    } else {
      console.log('[YouTube Video Download] API response received (length:', JSON.stringify(data).length, ')');
    }
    
    return data;
  }

  /**
   * Fetch TikTok video download via RapidAPI (for video download only)
   * Implements fallback strategy: Free API first, then Paid API if failed
   * @param url TikTok video URL
   * @returns Normalized media data with video URL
   */
  private async fetchTikTokVideo(url: string): Promise<NormalizedMediaData> {
    // Clean URL by removing query parameters (improves API compatibility)
    const cleanedUrl = this.cleanTikTokUrl(url);
    
    // Extract video ID from URL (for validation)
    const videoId = this.extractTikTokVideoId(cleanedUrl);
    if (!videoId) {
      throw new Error(`Invalid TikTok URL: ${url}`);
    }

    // Step 1: Try Free API first (only call once)
    let videoData: any = null;
    let metadata: any = {};
    
    try {
      console.log('[TikTok Video Download] Attempting Free API...');
      const freeApiResult = await this.fetchTikTokVideoDownloadFreeAPI(cleanedUrl);
      
      if (freeApiResult.success && freeApiResult.videoData) {
        console.log('[TikTok Video Download] Free API succeeded!');
        videoData = freeApiResult.videoData;
        metadata = freeApiResult.metadata || {};
      } else {
        // Free API failed, log reason and switch to Paid API
        console.warn(`[TikTok Video Download] Free API failed: ${freeApiResult.reason} - ${freeApiResult.message}`);
        throw new Error(`Free API failed: ${freeApiResult.reason}`);
      }
    } catch (error: any) {
      // Free API failed, try Paid API (only call once)
      console.log('[TikTok Video Download] Switching to Paid API as fallback...');
      
      try {
        const paidApiResult = await this.fetchTikTokVideoDownloadPaidAPI(cleanedUrl);
        
        if (paidApiResult.success && paidApiResult.videoData) {
          console.log('[TikTok Video Download] Paid API succeeded!');
          videoData = paidApiResult.videoData;
          metadata = paidApiResult.metadata || {};
        } else {
          // Paid API also failed, try Reel-AI API as last resort (it may return downloadUrl)
          console.log('[TikTok Video Download] Trying Reel-AI API as last resort (may have downloadUrl)...');
          try {
            const reelApiResult = await this.fetchTikTokTranscriptSupadataAPI(cleanedUrl);
            
            if (reelApiResult.success && reelApiResult.transcriptData?.downloadUrl) {
              console.log('[TikTok Video Download] Reel-AI API provided downloadUrl!');
              // Use Reel-AI API response for video URL
              videoData = {
                downloadUrl: reelApiResult.transcriptData.downloadUrl,
                ...reelApiResult.transcriptData,
              };
              metadata = reelApiResult.metadata || {};
            } else {
              // All APIs failed
              console.error(`[TikTok Video Download] All APIs failed. Free: ${error.message}, Paid: ${paidApiResult.message}, Reel-AI: ${reelApiResult.reason || 'No downloadUrl'}`);
              throw new Error(`Both APIs failed. Free: ${error.message}, Paid: ${paidApiResult.message}`);
            }
          } catch (reelError: any) {
            // All APIs failed
            console.error(`[TikTok Video Download] All APIs failed. Free: ${error.message}, Paid: ${paidApiResult.message}, Reel-AI: ${reelError.message}`);
            throw new Error(`Both APIs failed. Free: ${error.message}, Paid: ${paidApiResult.message}`);
          }
        }
      } catch (paidError: any) {
        // Both APIs failed, throw error
        console.error('[TikTok Video Download] All APIs failed');
        throw new Error(`Failed to fetch TikTok video: ${paidError.message}`);
      }
    }

    // Normalize metadata
    const normalizedMetadata = this.normalizeMetadata(videoData || metadata || {}, 'tiktok');

    // Extract video URL using deep parser (supports all possible response formats)
    const videoUrl = this.parseTikTokVideoUrl(videoData);

    // Try to get subtitle if available (optional for video download)
    let subtitleRaw: string | null = null;
    if (videoData.subtitles || videoData.transcript) {
      subtitleRaw = this.normalizeSubtitles(videoData, 'tiktok');
    }

    const subtitleStats = subtitleRaw
      ? this.calculateSubtitleStats(subtitleRaw)
      : { charCount: 0, lineCount: 0 };

    return {
      platform: 'tiktok',
      title: normalizedMetadata.title || '',
      author: normalizedMetadata.author,
      likes: normalizedMetadata.likes || 0,
      views: normalizedMetadata.views || 0,
      shares: normalizedMetadata.shares || 0,
      duration: normalizedMetadata.duration,
      publishedAt: normalizedMetadata.publishedAt,
      thumbnailUrl: normalizedMetadata.thumbnailUrl,
      videoUrl: videoUrl || undefined,
      subtitleRaw: subtitleRaw || undefined,
      sourceLang: normalizedMetadata.sourceLang || 'auto',
      subtitleCharCount: subtitleStats.charCount,
      subtitleLineCount: subtitleStats.lineCount,
      isTikTokVideo: !!videoUrl,
    };
  }

  /**
   * Extract TikTok video metadata and subtitles (for subtitle extraction only)
   * Implements fallback strategy: Free API first, then Paid API if failed
   * @param url TikTok video URL
   * @returns Normalized media data
   */
  private async fetchTikTokMedia(url: string): Promise<NormalizedMediaData> {
    // 只使用 Reel-AI API (tiktok-reel-ai-transcript-extractor.p.rapidapi.com)
    // 支持 AI 语音转文字，成功率更高，支持无字幕视频
    // 屏蔽旧的 Free API 和 Paid API
    console.log('[TikTok Transcript] Using Reel-AI API only (tiktok-reel-ai-transcript-extractor.p.rapidapi.com)...');
    
    // Clean URL by removing query parameters
    const cleanedUrl = this.cleanTikTokUrl(url);
    
    // 直接调用 Supadata API
    const result = await this.fetchTikTokTranscriptSupadataAPI(cleanedUrl);
    
    if (!result.success || !result.transcriptData) {
      throw new Error(`Failed to fetch TikTok transcript: ${result.reason || result.message}`);
    }
    
    const transcriptData = result.transcriptData;
    const metadata = result.metadata || {};

    // Normalize subtitle
    const subtitleRaw = transcriptData
      ? this.normalizeSubtitles(transcriptData, 'tiktok')
      : null;

    // Extract metadata from transcript response
    const normalizedMetadata = this.normalizeMetadata(transcriptData || metadata || {}, 'tiktok');

    // If video download is needed, fetch video URL (no-watermark)
    let videoUrl: string | undefined;
    const hasVideoUrl =
      transcriptData &&
      (transcriptData.play || transcriptData.download_addr || transcriptData.video_url);
    if (hasVideoUrl) {
      // Prefer no-watermark URL
      videoUrl =
        transcriptData.play ||
        transcriptData.download_addr ||
        transcriptData.video_url;
    }

    // Calculate subtitle statistics
    const subtitleStats = subtitleRaw
      ? this.calculateSubtitleStats(subtitleRaw)
      : { charCount: 0, lineCount: 0 };

    return {
      platform: 'tiktok',
      title: normalizedMetadata.title || '',
      author: normalizedMetadata.author,
      likes: normalizedMetadata.likes || 0,
      views: normalizedMetadata.views || 0,
      shares: normalizedMetadata.shares || 0,
      duration: normalizedMetadata.duration,
      publishedAt: normalizedMetadata.publishedAt,
      thumbnailUrl: normalizedMetadata.thumbnailUrl,
      videoUrl: videoUrl || undefined,
      subtitleRaw: subtitleRaw || undefined,
      sourceLang: normalizedMetadata.sourceLang || 'auto',
      subtitleCharCount: subtitleStats.charCount,
      subtitleLineCount: subtitleStats.lineCount,
      isTikTokVideo: !!videoUrl, // Flag to indicate TikTok video is available for download
    };
  }

  /**
   * Fetch YouTube transcript via Free API (YouTube Video Summarizer)
   * Only called once per request
   * @param videoId YouTube video ID
   * @returns Result with transcript data or failure reason
   */
  private async fetchYouTubeTranscriptFreeAPI(
    videoId: string
  ): Promise<{
    success: boolean;
    transcriptData?: any;
    metadata?: any;
    reason?: string;
    message?: string;
  }> {
    const FREE_API_TIMEOUT = 20000; // 20 seconds timeout (increased for POST request)
    const MIN_TRANSCRIPT_LENGTH = 100; // Minimum transcript length (characters)
    
    // 使用配置中的主 API Host（从环境变量读取）
    // 新 API: ai-youtube-transcript-generator-free-online-api-flux.p.rapidapi.com
    const host = this.configs.youtubeTranscript?.primaryHost || 
                 this.configs.hostYouTubeTranscript || 
                 'ai-youtube-transcript-generator-free-online-api-flux.p.rapidapi.com';
    
    // 检查是否使用新的 Flux API (POST 请求)
    const isFluxAPI = host.includes('ai-youtube-transcript-generator-free-online-api-flux');
    
    // 构建完整的 YouTube URL（新 API 需要完整 URL）
    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
    
    let apiUrl: string;
    let fetchOptions: RequestInit;

    if (isFluxAPI) {
      // 新 Flux API: POST /transcript
      // Body: {"videoUrl":"...","langCode":"en"}
      apiUrl = `https://${host}/transcript`;
      
      fetchOptions = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-rapidapi-key': this.configs.apiKey,
          'x-rapidapi-host': host,
        },
        body: JSON.stringify({
          videoUrl: videoUrl || undefined,
          langCode: 'en', // 默认使用英文，可以根据需要调整
        }),
        signal: AbortSignal.timeout(FREE_API_TIMEOUT),
      };
    } else {
      // Legacy API: GET request
      apiUrl = `https://${host}/api/v1/get-transcript-v2?video_id=${videoId}&platform=youtube`;
      
      fetchOptions = {
        method: 'GET',
        headers: {
          'x-rapidapi-key': this.configs.apiKey,
          'x-rapidapi-host': host,
        },
        signal: AbortSignal.timeout(FREE_API_TIMEOUT),
      };
    }

    try {
      const response = await fetch(apiUrl, fetchOptions);

      // HTTP层面失败判断
      if (!response.ok) {
        if (response.status === 429) {
          return {
            success: false,
            reason: 'RATE_LIMIT',
            message: 'Free API rate limit exceeded',
          };
        }
        if (response.status === 403) {
          return {
            success: false,
            reason: 'QUOTA_EXCEEDED',
            message: 'Free API quota exceeded or disabled',
          };
        }
        if (response.status === 404) {
          return {
            success: false,
            reason: 'VIDEO_NOT_FOUND',
            message: 'Video not found or transcript unavailable',
          };
        }
        return {
          success: false,
          reason: 'HTTP_ERROR',
          message: `HTTP ${response.status}: ${response.statusText}`,
        };
      }

      const data = await response.json();

      // 业务层面失败判断
      // Flux API 响应格式：
      // - 成功: { success: true, transcript: [{text, start, duration}], title, author, ... }
      // - 失败: { success: false, error: "..." } 或 { error: "..." }
      
      // 如果 API 明确返回 success: false，先检查错误信息
      if (data.success === false) {
        const errorMsg = (data.error || data.message || 'Unknown error').toLowerCase();
        console.log(`[YouTube Free API] API returned success: false, error: ${data.error || data.message}`);
        // 检查视频不存在
        if (
          errorMsg.includes('video not found') ||
          errorMsg.includes('invalid url') ||
          errorMsg.includes('video not available') ||
          errorMsg.includes('cannot find video') ||
          errorMsg.includes('video does not exist')
        ) {
          console.log(`[YouTube Free API] Video not found error detected: ${errorMsg}`);
          return {
            success: false,
            reason: 'VIDEO_NOT_FOUND',
            message: 'Video not found or invalid URL',
          };
        }
        // 其他错误
        console.log(`[YouTube Free API] API error: ${data.error || data.message}`);
        return {
          success: false,
          reason: 'API_ERROR',
          message: data.error || data.message || 'API returned error',
        };
      }
      
      const errorMessage = (data.error || data.message || '').toLowerCase();
      
      // 检查额度/限额
      if (
        errorMessage.includes('quota') ||
        errorMessage.includes('limit') ||
        errorMessage.includes('free plan disabled') ||
        errorMessage.includes('exceeded')
      ) {
        return {
          success: false,
          reason: 'QUOTA_EXCEEDED',
          message: 'Free API quota exceeded or disabled',
        };
      }

      // 检查视频不存在或无效URL
      if (
        errorMessage.includes('video not found') ||
        errorMessage.includes('invalid url') ||
        errorMessage.includes('video not available') ||
        errorMessage.includes('cannot find video') ||
        errorMessage.includes('video does not exist')
      ) {
        console.log(`[YouTube Free API] Video not found error detected in error message: ${errorMessage}`);
        return {
          success: false,
          reason: 'VIDEO_NOT_FOUND',
          message: 'Video not found or invalid URL',
        };
      }

      // 数据层面失败判断
      // 新 Flux API 返回格式: { transcript: [{text, start, duration}], title, author, ... }
      // Legacy API 返回格式: { transcript: "text", transcription: "text", ... }
      let transcriptArray: any[] = [];
      let transcriptText = '';
      
      if (isFluxAPI) {
        // 新 Flux API: transcript 是数组格式
        transcriptArray = Array.isArray(data.transcript) ? data.transcript : [];
        
        // 从数组中提取文本
        if (transcriptArray.length > 0) {
          transcriptText = transcriptArray.map((item: any) => item.text || '').join(' ').trim();
        } else {
          // 如果没有数组，尝试其他字段
          transcriptText = data.transcript || data.transcription || '';
        }
      } else {
        // Legacy API: transcript 可能是字符串或数组
        if (Array.isArray(data.transcript)) {
          transcriptArray = data.transcript;
          transcriptText = transcriptArray.map((item: any) => item.text || '').join(' ').trim();
        } else {
          transcriptText = data.transcript || data.transcription || '';
        }
      }
      
      // 检查是否有transcript
      if (!transcriptText || transcriptText.trim().length === 0) {
        return {
          success: false,
          reason: 'NO_TRANSCRIPT',
          message: 'No transcript available in response',
        };
      }

      // 检查transcript长度
      if (transcriptText.length < MIN_TRANSCRIPT_LENGTH) {
        // 如果只有summary但transcript太短，判定为失败
        if (data.summary && data.summary.length > transcriptText.length) {
          return {
            success: false,
            reason: 'ONLY_SUMMARY',
            message: 'Only summary available, transcript too short',
          };
        }
      }

      // ✅ 成功：返回transcript数据（包含数组格式，便于后续SRT转换）
      return {
        success: true,
        transcriptData: {
          // 保留原始 transcript 数组（如果存在）
          transcript: transcriptArray.length > 0 ? transcriptArray : transcriptText,
          // 保留其他字段
          title: data.title,
          author: data.author,
          description: data.description,
          duration: data.duration,
          language: data.language || 'en',
          video_id: data.video_id || videoId,
          // 兼容旧格式
          transcription: transcriptText,
          summary: data.summary,
        },
        metadata: {
          title: data.title,
          author: data.author,
          description: data.description,
          duration: data.duration,
          language: data.language || 'en',
          summary: data.summary, // 额外bonus
        },
      };
    } catch (error: any) {
      // 网络错误/超时
      if (error.name === 'AbortError' || error.name === 'TimeoutError') {
        return {
          success: false,
          reason: 'TIMEOUT',
          message: 'Free API request timeout',
        };
      }
      return {
        success: false,
        reason: 'NETWORK_ERROR',
        message: error.message || 'Network error',
      };
    }
  }

  /**
   * Fetch YouTube transcript via Flux API only
   * API: ai-youtube-transcript-generator-free-online-api-flux.p.rapidapi.com
   * Method: POST /transcript
   * Body: {"videoUrl":"...","langCode":"en"}
   * @param url YouTube video URL (formatted, e.g., https://www.youtube.com/watch?v=VIDEO_ID)
   * @returns Result with transcript data or failure reason
   */
  private async fetchYouTubeTranscriptFluxAPI(
    url: string
  ): Promise<{
    success: boolean;
    transcriptData?: any;
    metadata?: any;
    reason?: string;
    message?: string;
  }> {
    const API_TIMEOUT = 20000; // 20 seconds timeout
    const MIN_TRANSCRIPT_LENGTH = 100; // Minimum transcript length (characters)
    
    // 强制使用 Flux API
    const host = 'ai-youtube-transcript-generator-free-online-api-flux.p.rapidapi.com';
    const apiUrl = `https://${host}/transcript`;
    
    console.log(`[YouTube Flux API] Request URL: ${apiUrl}`);
    console.log(`[YouTube Flux API] Video URL: ${url}`);

    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-rapidapi-key': this.configs.apiKey,
          'x-rapidapi-host': host,
        },
        body: JSON.stringify({
          videoUrl: url,
          langCode: 'en',
        }),
        signal: AbortSignal.timeout(API_TIMEOUT),
      });

      // HTTP层面失败判断
      if (!response.ok) {
        // 尝试读取响应体以获取更详细的错误信息
        // 注意：响应流只能读取一次，所以先读取文本，然后尝试解析 JSON
        let errorDetails = '';
        try {
          const errorText = await response.text();
          if (errorText) {
            // 尝试解析为 JSON
            try {
              const errorData = JSON.parse(errorText);
              errorDetails = errorData.error || errorData.message || errorText.substring(0, 200);
              console.log(`[YouTube Flux API] HTTP ${response.status} error details:`, errorData);
            } catch (e) {
              // 如果不是 JSON，直接使用文本
              errorDetails = errorText.substring(0, 200); // 限制长度
              console.log(`[YouTube Flux API] HTTP ${response.status} error text:`, errorText.substring(0, 200));
            }
          }
        } catch (e) {
          // 如果无法读取响应体，忽略
          console.log(`[YouTube Flux API] Could not read error response body:`, e);
        }

        console.log(`[YouTube Flux API] HTTP Error: ${response.status} ${response.statusText}`);
        if (errorDetails) {
          console.log(`[YouTube Flux API] Error details: ${errorDetails}`);
        }

        if (response.status === 429) {
          return {
            success: false,
            reason: 'RATE_LIMIT',
            message: errorDetails || 'API rate limit exceeded. Please try again later.',
          };
        }
        if (response.status === 403) {
          return {
            success: false,
            reason: 'QUOTA_EXCEEDED',
            message: errorDetails || 'API quota exceeded or disabled. Please check your API key and quota.',
          };
        }
        if (response.status === 404) {
          return {
            success: false,
            reason: 'VIDEO_NOT_FOUND',
            message: errorDetails || 'Video not found or transcript unavailable',
          };
        }
        if (response.status === 401) {
          return {
            success: false,
            reason: 'AUTH_ERROR',
            message: errorDetails || 'API authentication failed. Please check your API key.',
          };
        }
        if (response.status === 500 || response.status === 502 || response.status === 503) {
          return {
            success: false,
            reason: 'SERVER_ERROR',
            message: errorDetails || `Server error (${response.status}). Please try again later.`,
          };
        }
        // 其他 HTTP 错误
        return {
          success: false,
          reason: 'HTTP_ERROR',
          message: errorDetails || `HTTP ${response.status}: ${response.statusText}`,
        };
      }

      const data = await response.json();

      // 业务层面失败判断
      // Flux API 响应格式：
      // - 成功: { success: true, transcript: [{text, start, duration}], title, author, ... }
      // - 失败: { success: false, error: "..." } 或 { error: "..." }
      
      // 如果 API 明确返回 success: false，先检查错误信息
      if (data.success === false) {
        const errorMsg = (data.error || data.message || 'Unknown error').toLowerCase();
        console.log(`[YouTube Flux API] API returned success: false, error: ${data.error || data.message}`);
        // 检查视频不存在
        if (
          errorMsg.includes('video not found') ||
          errorMsg.includes('invalid url') ||
          errorMsg.includes('video not available') ||
          errorMsg.includes('cannot find video') ||
          errorMsg.includes('video does not exist')
        ) {
          console.log(`[YouTube Flux API] Video not found error detected: ${errorMsg}`);
          return {
            success: false,
            reason: 'VIDEO_NOT_FOUND',
            message: 'Video not found or invalid URL',
          };
        }
        // 其他错误
        console.log(`[YouTube Flux API] API error: ${data.error || data.message}`);
        return {
          success: false,
          reason: 'API_ERROR',
          message: data.error || data.message || 'API returned error',
        };
      }
      
      const errorMessage = (data.error || data.message || '').toLowerCase();
      
      // 检查额度/限额
      if (
        errorMessage.includes('quota') ||
        errorMessage.includes('limit') ||
        errorMessage.includes('free plan disabled') ||
        errorMessage.includes('exceeded')
      ) {
        return {
          success: false,
          reason: 'QUOTA_EXCEEDED',
          message: 'API quota exceeded or disabled',
        };
      }

      // 检查视频不存在或无效URL
      if (
        errorMessage.includes('video not found') ||
        errorMessage.includes('invalid url') ||
        errorMessage.includes('video not available') ||
        errorMessage.includes('cannot find video') ||
        errorMessage.includes('video does not exist')
      ) {
        console.log(`[YouTube Flux API] Video not found error detected in error message: ${errorMessage}`);
        return {
          success: false,
          reason: 'VIDEO_NOT_FOUND',
          message: 'Video not found or invalid URL',
        };
      }

      // 数据层面失败判断
      // Flux API 返回格式: { success: true, transcript: [{text, start, duration}], title, author, ... }
      let transcriptArray: any[] = [];
      let transcriptText = '';
      
      // 提取 transcript 数组
      transcriptArray = Array.isArray(data.transcript) ? data.transcript : [];
      
      // 从数组中提取文本
      if (transcriptArray.length > 0) {
        transcriptText = transcriptArray.map((item: any) => item.text || '').join(' ').trim();
      } else {
        // 如果没有数组，尝试其他字段
        transcriptText = data.transcript || data.transcription || '';
      }
      
      // 检查是否有transcript
      if (!transcriptText || transcriptText.trim().length === 0) {
        return {
          success: false,
          reason: 'NO_TRANSCRIPT',
          message: 'No transcript available in response',
        };
      }

      // 检查transcript长度
      if (transcriptText.length < MIN_TRANSCRIPT_LENGTH) {
        // 如果transcript太短，可能是错误响应
        if (errorMessage && errorMessage.length > 0) {
          return {
            success: false,
            reason: 'INVALID_RESPONSE',
            message: 'Transcript too short or invalid response',
          };
        }
      }

      // ✅ 成功：返回transcript数据（包含数组格式，便于后续SRT转换）
      return {
        success: true,
        transcriptData: {
          // 保留原始 transcript 数组（如果存在）
          transcript: transcriptArray.length > 0 ? transcriptArray : transcriptText,
          // 保留其他字段
          title: data.title,
          author: data.author,
          description: data.description,
          duration: data.duration,
          language: data.language || 'en',
          video_id: data.video_id,
          // 兼容旧格式
          transcription: transcriptText,
        },
        metadata: {
          title: data.title,
          author: data.author,
          description: data.description,
          duration: data.duration,
          language: data.language || 'en',
        },
      };
    } catch (error: any) {
      // 网络错误/超时
      if (error.name === 'AbortError' || error.name === 'TimeoutError') {
        return {
          success: false,
          reason: 'TIMEOUT',
          message: 'API request timeout',
        };
      }
      return {
        success: false,
        reason: 'NETWORK_ERROR',
        message: error.message || 'Network error',
      };
    }
  }

  /**
   * Fetch YouTube transcript via Paid API (Youtube Transcripts)
   * Only called once per request (as fallback)
   * @param url YouTube video URL
   * @returns Result with transcript data or failure reason
   * @deprecated Use fetchYouTubeTranscriptFluxAPI instead
   */
  private async fetchYouTubeTranscriptPaidAPI(
    url: string
  ): Promise<{
    success: boolean;
    transcriptData?: any;
    metadata?: any;
    reason?: string;
    message?: string;
  }> {
    const PAID_API_TIMEOUT = 20000; // 20 seconds timeout
    
    // 使用配置中的备 API Host（从环境变量读取）
    const host = this.configs.youtubeTranscript?.backupHost || 
                 this.configs.hostYouTubeTranscript || 
                 'youtube-transcripts-transcribe-youtube-video-to-text.p.rapidapi.com';
    const apiUrl = `https://${host}/transcribe`;

    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-rapidapi-key': this.configs.apiKey,
          'x-rapidapi-host': host,
        },
        body: JSON.stringify({ url }),
        signal: AbortSignal.timeout(PAID_API_TIMEOUT),
      });

      // HTTP层面失败判断
      if (!response.ok) {
        return {
          success: false,
          reason: 'HTTP_ERROR',
          message: `HTTP ${response.status}: ${response.statusText}`,
        };
      }

      const data = await response.json();

      // 业务层面失败判断
      // 如果 API 明确返回 success: false，先检查错误信息
      if (data.success === false) {
        const errorMsg = (data.error || data.message || 'Unknown error').toLowerCase();
        console.log(`[YouTube Paid API] API returned success: false, error: ${data.error || data.message}`);
        // 检查视频不存在
        if (
          errorMsg.includes('video not found') ||
          errorMsg.includes('invalid url') ||
          errorMsg.includes('video not available') ||
          errorMsg.includes('cannot find video') ||
          errorMsg.includes('video does not exist')
        ) {
          console.log(`[YouTube Paid API] Video not found error detected: ${errorMsg}`);
          return {
            success: false,
            reason: 'VIDEO_NOT_FOUND',
            message: 'Video not found or invalid URL',
          };
        }
        // 其他错误
        console.log(`[YouTube Paid API] API error: ${data.error || data.message}`);
        return {
          success: false,
          reason: 'API_ERROR',
          message: data.error || data.message || 'API returned error',
        };
      }

      const transcription = data.transcription || '';
      const errorMsg = data.error || data.message || '';

      if (!transcription || transcription.trim().length === 0) {
        return {
          success: false,
          reason: 'NO_TRANSCRIPTION',
          message: errorMsg || 'No transcription available',
        };
      }

      // 检查特定错误信息
      const errorMessage = errorMsg.toLowerCase();
      if (
        errorMessage.includes('video not found') ||
        errorMessage.includes('invalid url') ||
        errorMessage.includes('video not available') ||
        errorMessage.includes('cannot find video') ||
        errorMessage.includes('video does not exist')
      ) {
        console.log(`[YouTube Paid API] Video not found error detected in error message: ${errorMessage}`);
        return {
          success: false,
          reason: 'VIDEO_NOT_FOUND',
          message: 'Video not found or invalid URL',
        };
      }

      if (
        errorMessage.includes('private video') ||
        errorMessage.includes('access denied')
      ) {
        return {
          success: false,
          reason: 'PRIVATE_VIDEO',
          message: 'Video is private or access denied',
        };
      }

      if (errorMessage.includes('no subtitle')) {
        return {
          success: false,
          reason: 'NO_SUBTITLE',
          message: 'Video has no subtitle available',
        };
      }

      // ✅ 成功：返回transcription数据
      return {
        success: true,
        transcriptData: data,
        metadata: {},
      };
    } catch (error: any) {
      // 网络错误/超时
      if (error.name === 'AbortError' || error.name === 'TimeoutError') {
        return {
          success: false,
          reason: 'TIMEOUT',
          message: 'Paid API request timeout',
        };
      }
      return {
        success: false,
        reason: 'NETWORK_ERROR',
        message: error.message || 'Network error',
      };
    }
  }

  /**
   * Fetch YouTube transcript via RapidAPI (Legacy method, kept for compatibility)
   * @param url YouTube video URL
   * @param host RapidAPI host
   * @returns Transcript data
   * @deprecated Use fetchYouTubeTranscriptFreeAPI or fetchYouTubeTranscriptPaidAPI instead
   */
  private async fetchYouTubeTranscript(
    url: string,
    host: string
  ): Promise<any> {
    const apiUrl = `https://${host}/transcribe`;

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-rapidapi-host': host,
        'x-rapidapi-key': this.configs.apiKey,
      },
      body: JSON.stringify({ url }),
      signal: AbortSignal.timeout(this.DEFAULT_TIMEOUT),
    });

    if (!response.ok) {
      if (response.status === 429) {
        throw new Error('RapidAPI rate limit exceeded. Please try again later.');
      }
      throw new Error(
        `YouTube transcript API failed: ${response.status} ${response.statusText}`
      );
    }

    return await response.json();
  }

  /**
   * Fetch TikTok transcript via Free API (TikTok Transcripts - GET request)
   * Supports multiple API formats:
   * 1. tiktok-transcripts.p.rapidapi.com (GET with URL params)
   * 2. tiktok-transcriptor-api3.p.rapidapi.com (POST JSON - legacy)
   * @param url TikTok video URL
   * @returns Result with transcript data or failure reason
   */
  private async fetchTikTokTranscriptFreeAPI(
    url: string
  ): Promise<{
    success: boolean;
    transcriptData?: any;
    metadata?: any;
    reason?: string;
    message?: string;
  }> {
    const FREE_API_TIMEOUT = 15000; // 15 seconds timeout
    const MIN_TRANSCRIPT_LENGTH = 100; // Minimum transcript length (characters) - TikTok videos are usually shorter
    
    // 使用配置中的主 API Host（从环境变量读取）
    const host = this.configs.tiktokTranscript?.primaryHost || 
                 this.configs.hostTikTokTranscript || 
                 'tiktok-transcripts.p.rapidapi.com';
    
    // Check if this is the new GET-based API
    const isGetBasedAPI = host.includes('tiktok-transcripts.p.rapidapi.com');
    
    let apiUrl: string;
    let fetchOptions: RequestInit;

    if (isGetBasedAPI) {
      // New API: GET request with URL parameters
      const encodedUrl = encodeURIComponent(url);
      apiUrl = `https://${host}/transcript?url=${encodedUrl}&chunkSize=500&text=false`;
      
      fetchOptions = {
        method: 'GET',
        headers: {
          'x-rapidapi-key': this.configs.apiKey,
          'x-rapidapi-host': host,
        },
        signal: AbortSignal.timeout(FREE_API_TIMEOUT),
      };
    } else {
      // Legacy API: POST JSON
      apiUrl = `https://${host}/index.php`;
      
      fetchOptions = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-rapidapi-key': this.configs.apiKey,
          'x-rapidapi-host': host,
        },
        body: JSON.stringify({ url }),
        signal: AbortSignal.timeout(FREE_API_TIMEOUT),
      };
    }

    try {
      const response = await fetch(apiUrl, fetchOptions);

      // HTTP层面失败判断
      if (!response.ok) {
        if (response.status === 429) {
          return {
            success: false,
            reason: 'RATE_LIMIT',
            message: 'Free API rate limit exceeded',
          };
        }
        if (response.status === 403) {
          return {
            success: false,
            reason: 'QUOTA_EXCEEDED',
            message: 'Free API quota exceeded or disabled',
          };
        }
        return {
          success: false,
          reason: 'HTTP_ERROR',
          message: `HTTP ${response.status}: ${response.statusText}`,
        };
      }

      const data = await response.json();

      // 业务层面失败判断
      const errorMessage = (data.error || data.message || '').toLowerCase();
      
      // 检查额度/限额
      if (
        errorMessage.includes('quota') ||
        errorMessage.includes('limit') ||
        errorMessage.includes('free plan disabled') ||
        errorMessage.includes('exceeded')
      ) {
        return {
          success: false,
          reason: 'QUOTA_EXCEEDED',
          message: 'Free API quota exceeded or disabled',
        };
      }

      // 数据层面失败判断
      // Supadata TikTok Transcript API (tiktok-transcripts.p.rapidapi.com) 响应格式：
      // - 可能包含 { content: { transcript: "...", chunks: [...] } }
      // - 或直接返回 { transcript: "...", chunks: [...] }
      // - 当 text=false 时，返回 chunks 数组，每个chunk包含 start, end, text
      let transcriptData: any = null;
      let transcript = '';
      let chunks: any[] = [];
      
      if (isGetBasedAPI) {
        // New Supadata API format
        // 首先检查是否有 content 字段（根据API文档示例）
        const responseData = data.content || data;
        
        // 提取 transcript 文本（如果存在）
        transcript = 
          responseData.transcript || 
          responseData.text || 
          responseData.transcription || 
          responseData.subtitle || 
          responseData.caption || 
          '';
        
        // 提取 chunks 数组（当 text=false 时，这是主要数据）
        chunks = responseData.chunks || responseData.segments || [];
        
        // 如果只有chunks没有transcript文本，从chunks中提取文本
        if (!transcript && chunks.length > 0) {
          transcript = chunks.map((c: any) => c.text || c.transcript || '').join(' ').trim();
        }
        
        // 构建完整的transcriptData对象，包含chunks信息（用于SRT转换）
        transcriptData = {
          transcript: transcript,
          chunks: chunks.length > 0 ? chunks : undefined,
          // 保留原始响应中的其他字段
          ...responseData,
        };
      } else {
        // Legacy API format
        transcript = 
          data.transcript || 
          data.subtitle || 
          data.text || 
          data.transcription || 
          data.caption || 
          '';
        transcriptData = data;
      }

      // 检查是否有transcript
      if (!transcript || transcript.trim().length === 0) {
        return {
          success: false,
          reason: 'NO_TRANSCRIPT',
          message: 'No transcript available in response',
        };
      }

      // 检查transcript长度（TikTok视频通常较短，所以阈值较低）
      // Note: New API with text=false may return chunks instead, which is OK
      if (transcript.length < MIN_TRANSCRIPT_LENGTH && !isGetBasedAPI) {
        // 如果transcript太短，可能是错误响应（仅对非GET API）
        if (errorMessage && errorMessage.length > 0) {
          return {
            success: false,
            reason: 'INVALID_RESPONSE',
            message: 'Transcript too short or invalid response',
          };
        }
      }

      // ✅ 成功：返回transcript数据（包含chunks信息，便于后续SRT转换）
      return {
        success: true,
        transcriptData: transcriptData,
        metadata: {
          title: data.title || transcriptData.title,
          author: data.author || transcriptData.author,
          description: data.description || transcriptData.description,
        },
      };
    } catch (error: any) {
      // 网络错误/超时
      if (error.name === 'AbortError' || error.name === 'TimeoutError') {
        return {
          success: false,
          reason: 'TIMEOUT',
          message: 'Free API request timeout',
        };
      }
      return {
        success: false,
        reason: 'NETWORK_ERROR',
        message: error.message || 'Network error',
      };
    }
  }

  /**
   * Fetch TikTok transcript via Backup API
   * Supports multiple API formats:
   * 1. tiktok-reel-ai-transcript-extractor.p.rapidapi.com (new - need to find transcript endpoint)
   * 2. tiktok-transcript.p.rapidapi.com (POST form - legacy)
   * @param url TikTok video URL
   * @returns Result with transcript data or failure reason
   */
  /**
   * Clean TikTok URL by removing query parameters
   * Official API documentation uses clean URLs like: https://www.tiktok.com/@username/video/1234567890
   * @param url Original TikTok URL (may contain query parameters)
   * @returns Cleaned URL without query parameters
   */
  private cleanTikTokUrl(url: string): string {
    try {
      // Remove query parameters (everything after ?)
      // Example: https://www.tiktok.com/@username/video/1234567890?is_from_webapp=1&sender_device=pc
      // Result:  https://www.tiktok.com/@username/video/1234567890
      const urlObj = new URL(url);
      urlObj.search = ''; // Remove query string
      return urlObj.toString();
    } catch (e) {
      // If URL parsing fails, return original URL
      return url;
    }
  }

  /**
   * 深度解析 YouTube 视频 URL（万能解析器）
   * 支持所有可能的响应格式和字段名
   * 优先选择 MP4 格式，过滤 HLS 流（.m3u8）
   * @param data API 响应数据
   * @returns 视频 URL 或 null
   */
  private parseYouTubeVideoUrl(data: any): string | null {
    if (!data) return null;

    // 1. 优先从 formats 数组中提取（支持质量选择）
    if (data?.formats && Array.isArray(data.formats)) {
      // 优先选择 MP4 格式的最高画质（排除 HLS 流 .m3u8）
      const mp4Formats = data.formats.filter((f: any) => {
        const url = f.url || f.link || '';
        const container = f.container || f.ext || '';
        // 排除 HLS 流（.m3u8）和纯音频
        return url && 
               !url.includes('.m3u8') && 
               !url.includes('audio') &&
               (container === 'mp4' || url.endsWith('.mp4') || container === 'video/mp4');
      });

      if (mp4Formats.length > 0) {
        // 按画质排序（quality 字段，数字越大越好）
        const sortedFormats = mp4Formats.sort((a: any, b: any) => {
          const qualityA = parseInt(a.quality || a.height || '0', 10);
          const qualityB = parseInt(b.quality || b.height || '0', 10);
          return qualityB - qualityA;
        });
        
        const bestFormat = sortedFormats[0];
        const videoUrl = bestFormat.url || bestFormat.link;
        if (videoUrl && typeof videoUrl === 'string' && videoUrl.startsWith('http')) {
          return videoUrl.trim();
        }
      }
      
      // 如果没有 MP4 格式，尝试其他格式（但排除 .m3u8）
      const nonHlsFormats = data.formats.filter((f: any) => {
        const url = f.url || f.link || '';
        return url && !url.includes('.m3u8');
      });
      
      if (nonHlsFormats.length > 0) {
        const videoUrl = nonHlsFormats[0].url || nonHlsFormats[0].link;
        if (videoUrl && typeof videoUrl === 'string' && videoUrl.startsWith('http')) {
          return videoUrl.trim();
        }
      }
    }

    // 2. 常见嵌套结构
    const nestedPaths = [
      data?.data?.data?.video_url,
      data?.data?.data?.url,
      data?.data?.data?.download_url,
      data?.data?.data?.link,
      data?.data?.video_url,
      data?.data?.url,
      data?.data?.download_url,
      data?.data?.link,
      data?.data?.download,
      data?.video?.url,
      data?.video?.video_url,
      data?.video?.download_url,
      data?.video?.link,
      data?.result?.url,
      data?.result?.video_url,
      data?.result?.download_url,
      data?.result?.link,
    ];

    // 3. 直接字段
    const directPaths = [
      data?.url,
      data?.video_url,
      data?.download_url,
      data?.download,
      data?.link,
    ];

    // 4. 合并所有可能的路径
    const allPaths = [...nestedPaths, ...directPaths].filter(Boolean);

    // 5. 验证并返回第一个有效的 URL（优先 MP4，排除 .m3u8）
    for (const path of allPaths) {
      if (typeof path === 'string' && path.trim().length > 0) {
        // 排除 HLS 流
        if (path.includes('.m3u8')) {
          continue;
        }
        
        // 验证是否是有效的 HTTP/HTTPS URL
        if (path.startsWith('http://') || path.startsWith('https://')) {
          // 优先返回 MP4 格式
          if (path.endsWith('.mp4') || path.includes('.mp4?')) {
            return path.trim();
          }
        }
        // 如果是相对路径，尝试补全
        if (path.startsWith('//')) {
          return `https:${path}`;
        }
      }
    }

    // 6. 如果没有 MP4，返回第一个非 .m3u8 的有效 URL
    for (const path of allPaths) {
      if (typeof path === 'string' && path.trim().length > 0) {
        if (path.includes('.m3u8')) {
          continue;
        }
        if (path.startsWith('http://') || path.startsWith('https://')) {
          return path.trim();
        }
      }
    }

    // 7. 如果所有路径都失败，返回 null
    if (process.env.NODE_ENV === 'development') {
      console.warn('[YouTube Video URL Parser] No valid video URL found in response structure');
    }
    return null;
  }

  /**
   * 深度解析 TikTok 视频 URL（万能解析器）
   * 支持所有可能的响应格式和字段名
   * @param data API 响应数据
   * @returns 视频 URL 或 null
   */
  private parseTikTokVideoUrl(data: any): string | null {
    if (!data) return null;

    // 1. 常见付费版结构 (Supadata/RapidAPI)
    // 深度嵌套结构：data.data.data.video_url
    const paidPaths = [
      data?.data?.data?.data?.video_url,
      data?.data?.data?.video_url,
      data?.data?.data?.play_addr?.url_list?.[0],
      data?.data?.data?.play_addr?.url_list?.[1],
      data?.data?.data?.play,
      data?.data?.data?.downloadUrl,
      data?.data?.data?.download_url,
      data?.data?.video?.play_addr?.url_list?.[0],
      data?.data?.video?.play_addr?.url_list?.[1],
      data?.data?.video?.play,
      data?.data?.video?.download_addr,
      data?.data?.video?.video_url,
      data?.data?.video?.url,
      data?.data?.play,
      data?.data?.download_addr,
      data?.data?.video_url,
      data?.data?.url,
      data?.data?.nwm_video_url,
      data?.data?.no_watermark,
    ];

    // 2. 常见免费版结构
    const freePaths = [
      data?.video_url,
      data?.play,
      data?.download_addr,
      data?.downloadUrl,
      data?.download_url,
      data?.url,
      data?.nwm_video_url,
      data?.no_watermark,
      data?.links?.[0]?.url,
      data?.links?.[1]?.url,
      data?.medias?.[0]?.url,
      data?.medias?.[1]?.url,
      data?.video?.url,
      data?.video?.play,
      data?.video?.download_addr,
      data?.result?.url,
      data?.result?.video_url,
      data?.result?.download_url,
    ];

    // 3. 备选路径 (针对部分 API 返回的 format 数组)
    let formatPath: string | null = null;
    if (Array.isArray(data?.formats)) {
      // 优先选择有视频编码的格式（排除纯音频）
      formatPath = data.formats.find((f: any) => f.vcodec && f.vcodec !== 'none')?.url ||
                   data.formats.find((f: any) => f.url && !f.url.includes('audio'))?.url ||
                   data.formats[0]?.url;
    }

    // 4. 合并所有可能的路径
    const allPaths = [...paidPaths, ...freePaths, formatPath].filter(Boolean);

    // 5. 验证并返回第一个有效的 URL
    for (const path of allPaths) {
      if (typeof path === 'string' && path.trim().length > 0) {
        // 验证是否是有效的 HTTP/HTTPS URL
        if (path.startsWith('http://') || path.startsWith('https://')) {
          return path.trim();
        }
        // 如果是相对路径，尝试补全
        if (path.startsWith('//')) {
          return `https:${path}`;
        }
      }
    }

    // 6. 如果所有路径都失败，返回 null
    console.warn('[TikTok Video URL Parser] No valid video URL found in response structure');
    return null;
  }

  /**
   * Fetch TikTok transcript via Reel-AI API only
   * API: tiktok-reel-ai-transcript-extractor.p.rapidapi.com
   * Method: POST /api/tiktok/extract
   * Body: { url: "..." }
   * Response: { success: true, data: { data: { transcript: "...", segments: [...] } } }
   * @param url TikTok video URL (cleaned, without query parameters)
   * @returns Result with transcript data or failure reason
   */
  private async fetchTikTokTranscriptSupadataAPI(
    url: string
  ): Promise<{
    success: boolean;
    transcriptData?: any;
    metadata?: any;
    reason?: string;
    message?: string;
  }> {
    const API_TIMEOUT = 60000; // 60 seconds timeout (API may take 10-15 seconds)
    const MIN_TRANSCRIPT_LENGTH = 50; // Minimum transcript length (characters)
    
    // 强制使用 Reel-AI API (支持 AI 语音转文字，成功率更高)
    const host = 'tiktok-reel-ai-transcript-extractor.p.rapidapi.com';
    
    // Clean URL by removing query parameters
    const cleanedUrl = this.cleanTikTokUrl(url);
    
    // Construct API URL: POST /api/tiktok/extract
    const apiUrl = `https://${host}/api/tiktok/extract`;
    
    console.log(`[TikTok Reel-AI API] Request URL: ${apiUrl}`);
    console.log(`[TikTok Reel-AI API] Video URL: ${cleanedUrl.substring(0, 80)}...`);

    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-rapidapi-key': this.configs.apiKey,
          'x-rapidapi-host': host,
        },
        body: JSON.stringify({ url: cleanedUrl }),
        signal: AbortSignal.timeout(API_TIMEOUT),
      });

      // HTTP层面失败判断
      if (!response.ok) {
        if (response.status === 429) {
          return {
            success: false,
            reason: 'RATE_LIMIT',
            message: 'API rate limit exceeded',
          };
        }
        if (response.status === 403) {
          return {
            success: false,
            reason: 'QUOTA_EXCEEDED',
            message: 'API quota exceeded or disabled',
          };
        }
        if (response.status === 404) {
          return {
            success: false,
            reason: 'VIDEO_NOT_FOUND',
            message: 'Video not found or transcript unavailable',
          };
        }
        return {
          success: false,
          reason: 'HTTP_ERROR',
          message: `HTTP ${response.status}: ${response.statusText}`,
        };
      }

      const data = await response.json();

      // 业务层面失败判断
      // Reel-AI API 响应格式：
      // - 成功: { success: true, data: { data: { transcript: "...", segments: [...] } } }
      // - 处理中: { success: true, data: { jobId: "...", data: "" } } (需要重试)
      // - 失败: { success: false, error: "..." } 或 { error: "..." }
      
      // 如果 API 明确返回 success: false，先检查错误信息
      if (data.success === false) {
        const errorMsg = (data.error || data.message || 'Unknown error').toLowerCase();
        console.log(`[TikTok Reel-AI API] API returned success: false, error: ${data.error || data.message}`);
        // 检查视频不存在
        if (
          errorMsg.includes('video not found') ||
          errorMsg.includes('invalid url') ||
          errorMsg.includes('video not available') ||
          errorMsg.includes('cannot find video') ||
          errorMsg.includes('video does not exist')
        ) {
          console.log(`[TikTok Reel-AI API] Video not found error detected: ${errorMsg}`);
          return {
            success: false,
            reason: 'VIDEO_NOT_FOUND',
            message: 'Video not found or invalid URL',
          };
        }
        // 其他错误
        console.log(`[TikTok Reel-AI API] API error: ${data.error || data.message}`);
        return {
          success: false,
          reason: 'API_ERROR',
          message: data.error || data.message || 'API returned error',
        };
      }
      
      const errorMessage = (data.error || data.message || '').toLowerCase();
      
      // 检查额度/限额
      if (
        errorMessage.includes('quota') ||
        errorMessage.includes('limit') ||
        errorMessage.includes('free plan disabled') ||
        errorMessage.includes('exceeded')
      ) {
        return {
          success: false,
          reason: 'QUOTA_EXCEEDED',
          message: 'API quota exceeded or disabled',
        };
      }

      // 检查视频不存在或无效URL
      if (
        errorMessage.includes('video not found') ||
        errorMessage.includes('invalid url') ||
        errorMessage.includes('video not available') ||
        errorMessage.includes('cannot find video') ||
        errorMessage.includes('video does not exist')
      ) {
        console.log(`[TikTok Reel-AI API] Video not found error detected in error message: ${errorMessage}`);
        return {
          success: false,
          reason: 'VIDEO_NOT_FOUND',
          message: 'Video not found or invalid URL',
        };
      }

      // 检查是否还在处理中（返回 jobId）
      if (data.success && data.data?.jobId && (!data.data?.data || data.data.data === '' || typeof data.data.data === 'string')) {
        // ⏳ Still processing: API returned jobId but no transcript yet
        // This is expected for first request, need to retry after 10-15 seconds
        return {
          success: false,
          reason: 'PROCESSING',
          message: 'Transcript is still being processed, please retry after 10-15 seconds',
          metadata: {
            isProcessing: true,
            jobId: data.data.jobId,
            estimatedTime: data.data.estimatedProcessingTime || '10-15 seconds',
          },
        };
      }

      // 数据层面失败判断
      // 提取 transcript 数据（支持多种响应格式）
      let transcript = '';
      let segments: any[] = [];
      let reelData: any = null;
      
      if (data.success && data.data?.data && typeof data.data.data === 'object') {
        // 新 Reel-AI API 格式: { success: true, data: { data: { transcript: "...", segments: [...] } } }
        reelData = data.data.data;
        transcript = 
          reelData.transcript || 
          reelData.transcription || 
          (Array.isArray(reelData.segments) 
            ? reelData.segments.map((s: any) => s.text || '').join(' ').trim() 
            : '') ||
          '';
        segments = reelData.segments || [];
      } else if (data.content) {
        // 兼容 Supadata 格式: { content: { transcript: "...", chunks: [...] } }
        const contentData = data.content;
        transcript = contentData.transcript || contentData.text || '';
        segments = contentData.chunks || contentData.segments || [];
        reelData = contentData;
      } else if (data.transcript) {
        // 直接格式: { transcript: "...", segments: [...] }
        transcript = Array.isArray(data.transcript) 
          ? data.transcript.map((item: any) => item.text || '').join(' ').trim()
          : (data.transcript || '');
        segments = Array.isArray(data.transcript) ? data.transcript : (data.segments || []);
        reelData = data;
      } else {
        // 尝试其他字段
        transcript = data.text || data.transcription || data.subtitle || '';
        segments = data.segments || data.chunks || [];
        reelData = data;
      }

      // 如果只有segments没有transcript文本，从segments中提取文本
      if (!transcript && segments.length > 0) {
        transcript = segments.map((s: any) => s.text || s.transcript || '').join(' ').trim();
      }

      // 检查是否有transcript
      if (!transcript || transcript.trim().length === 0) {
        return {
          success: false,
          reason: 'NO_TRANSCRIPT',
          message: 'No transcript available in response. Video may not have captions or AI transcription failed.',
        };
      }

      // 检查transcript长度
      if (transcript.length < MIN_TRANSCRIPT_LENGTH) {
        // 如果transcript太短，可能是错误响应
        if (errorMessage && errorMessage.length > 0) {
          return {
            success: false,
            reason: 'INVALID_RESPONSE',
            message: 'Transcript too short or invalid response',
          };
        }
      }

      // ✅ 成功：返回transcript数据（包含segments信息，便于后续SRT转换）
      return {
        success: true,
        transcriptData: {
          transcript: transcript.trim(), // 清理空格
          segments: segments.length > 0 ? segments : undefined,
          chunks: segments.length > 0 ? segments : undefined, // 兼容 chunks 字段名
          // 保留原始响应中的其他字段
          videoId: reelData?.videoId,
          videoDescription: reelData?.videoDescription,
          downloadUrl: reelData?.downloadUrl || reelData?.videoUrl,
          coverImageUrl: reelData?.coverImageUrl,
          author: reelData?.authorMeta?.name || reelData?.authorMeta?.username || reelData?.author,
          title: reelData?.videoDescription || reelData?.title,
          likes: reelData?.likesCount || reelData?.likes,
          views: reelData?.playsCount || reelData?.views,
          shares: reelData?.sharesCount || reelData?.shares,
          ...reelData,
        },
        metadata: {
          title: reelData?.videoDescription || reelData?.title || data.title,
          author: reelData?.authorMeta?.name || reelData?.authorMeta?.username || reelData?.author || data.author,
          description: reelData?.videoDescription || reelData?.description || data.description,
          videoId: reelData?.videoId,
          downloadUrl: reelData?.downloadUrl || reelData?.videoUrl,
        },
      };
    } catch (error: any) {
      // 网络错误/超时
      if (error.name === 'AbortError' || error.name === 'TimeoutError') {
        return {
          success: false,
          reason: 'TIMEOUT',
          message: 'API request timeout',
        };
      }
      return {
        success: false,
        reason: 'NETWORK_ERROR',
        message: error.message || 'Network error',
      };
    }
  }

  private async fetchTikTokTranscriptPaidAPI(
    url: string
  ): Promise<{
    success: boolean;
    transcriptData?: any;
    metadata?: any;
    reason?: string;
    message?: string;
  }> {
    const PAID_API_TIMEOUT = 20000; // 20 seconds timeout
    
    // 使用配置中的备 API Host（从环境变量读取）
    // 优先使用新的 Supadata API (tiktok-transcripts.p.rapidapi.com) 作为备选
    const host = this.configs.tiktokTranscript?.backupHost || 
                 this.configs.tiktokTranscript?.primaryHost || 
                 this.configs.hostTikTokTranscript || 
                 'tiktok-transcripts.p.rapidapi.com';
    
    // Check if this is the new Supadata API (GET request)
    const isSupadataAPI = host.includes('tiktok-transcripts.p.rapidapi.com');
    // Check if this is the new reel-ai API (POST request)
    const isReelAI = host.includes('tiktok-reel-ai-transcript-extractor');
    
    // Clean URL by removing query parameters (official API prefers clean URLs)
    const cleanedUrl = (isReelAI || isSupadataAPI) ? this.cleanTikTokUrl(url) : url;
    
    let apiUrl: string;
    let fetchOptions: RequestInit;

    if (isSupadataAPI) {
      // New Supadata API: GET /transcript?url=...&chunkSize=500&text=false
      // Response format: { content: { transcript: "...", chunks: [...] } } or { transcript: "...", chunks: [...] }
      const encodedUrl = encodeURIComponent(cleanedUrl);
      apiUrl = `https://${host}/transcript?url=${encodedUrl}&chunkSize=500&text=false`;
      
      fetchOptions = {
        method: 'GET',
        headers: {
          'x-rapidapi-key': this.configs.apiKey,
          'x-rapidapi-host': host,
        },
        signal: AbortSignal.timeout(PAID_API_TIMEOUT),
      };
    } else if (isReelAI) {
      // New reel-ai API: POST /api/tiktok/extract (returns transcript directly, but may take 10-15 seconds)
      // Response format: { success: true, data: { data: { transcript: "...", segments: [...], downloadUrl: "..." } } }
      apiUrl = `https://${host}/api/tiktok/extract`;
      
      fetchOptions = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-RapidAPI-Key': this.configs.apiKey, // 使用大写（与官方文档一致）
          'X-RapidAPI-Host': host, // 使用大写（与官方文档一致）
        },
        body: JSON.stringify({ url: cleanedUrl }), // 使用清理后的 URL（去掉查询参数，与官方示例格式一致）
        // Increase timeout to 60s since API may take 10-15 seconds
        signal: AbortSignal.timeout(60000), // 60 seconds
      };
    } else {
      // Legacy API: POST form-urlencoded
      apiUrl = `https://${host}/transcribe-tiktok-audio`;
      
      // Note: This API uses form-urlencoded format
      const formData = new URLSearchParams();
      formData.append('url', url);
      
      fetchOptions = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'x-rapidapi-key': this.configs.apiKey,
          'x-rapidapi-host': host,
        },
        body: formData.toString(),
        signal: AbortSignal.timeout(PAID_API_TIMEOUT),
      };
    }

    try {
      const response = await fetch(apiUrl, fetchOptions);

      // HTTP层面失败判断
      if (!response.ok) {
        return {
          success: false,
          reason: 'HTTP_ERROR',
          message: `HTTP ${response.status}: ${response.statusText}`,
        };
      }

      const data = await response.json();

      // 业务层面失败判断
      // Handle new Supadata API response format: { content: { transcript: "...", chunks: [...] } } or { transcript: "...", chunks: [...] }
      // Handle new reel-ai API response format: { success: true, data: { data: { transcript: "...", segments: [...] } } }
      let transcription = '';
      let errorMsg = data.error || data.message || '';
      let transcriptData: any = null;
      
      if (isSupadataAPI) {
        // New Supadata API format (same as Free API)
        const responseData = data.content || data;
        
        // 提取 transcript 文本
        transcription = 
          responseData.transcript || 
          responseData.text || 
          responseData.transcription || 
          responseData.subtitle || 
          responseData.caption || 
          '';
        
        // 提取 chunks 数组
        const chunks = responseData.chunks || responseData.segments || [];
        
        // 如果只有chunks没有transcript文本，从chunks中提取文本
        if (!transcription && chunks.length > 0) {
          transcription = chunks.map((c: any) => c.text || c.transcript || '').join(' ').trim();
        }
        
        // 构建完整的transcriptData对象
        transcriptData = {
          transcript: transcription,
          chunks: chunks.length > 0 ? chunks : undefined,
          segments: chunks.length > 0 ? chunks : undefined, // 兼容 segments 字段名
          ...responseData,
        };
        
        // 检查是否有transcript
        if (!transcription || transcription.trim().length === 0) {
          return {
            success: false,
            reason: 'NO_TRANSCRIPTION',
            message: errorMsg || 'No transcription available',
          };
        }
        
        // ✅ 成功：返回transcript数据
        return {
          success: true,
          transcriptData: transcriptData,
          metadata: {
            title: responseData.title,
            author: responseData.author,
            description: responseData.description,
          },
        };
      } else if (isReelAI && data.success) {
        // New reel-ai API format: nested data structure
        // Response format: { success: true, data: { data: { transcript: "...", segments: [...] } } }
        // OR first request: { success: true, data: { jobId: "...", data: "" } } (still processing)
        
        // Check if API returned jobId (still processing)
        if (data.data?.jobId && (!data.data?.data || data.data.data === '' || typeof data.data.data === 'string')) {
          // ⏳ Still processing: API returned jobId but no transcript yet
          // This is expected for first request, need to retry after 10-15 seconds
          return {
            success: false,
            reason: 'PROCESSING',
            message: 'Transcript is still being processed, please retry after 10-15 seconds',
            metadata: {
              isProcessing: true,
              jobId: data.data.jobId,
              estimatedTime: data.data.estimatedProcessingTime || '10-15 seconds',
            },
          };
        }
        
        // Check if we have actual transcript data
        if (data.data?.data && typeof data.data.data === 'object') {
          const reelData = data.data.data;
          transcription = 
            reelData.transcript || 
            reelData.transcription || 
            (Array.isArray(reelData.segments) 
              ? reelData.segments.map((s: any) => s.text || '').join(' ').trim() 
              : '') ||
            '';
          
          // Extract metadata from reel-ai API response
          if (transcription && transcription.trim().length > 0) {
            // ✅ Success: Transcript is ready
            return {
              success: true,
              transcriptData: {
                transcript: transcription,
                segments: reelData.segments || [],
                videoId: reelData.videoId,
                videoDescription: reelData.videoDescription,
                downloadUrl: reelData.downloadUrl || reelData.videoUrl,
                coverImageUrl: reelData.coverImageUrl,
                author: reelData.authorMeta?.name || reelData.authorMeta?.username,
                title: reelData.videoDescription,
                likes: reelData.likesCount,
                views: reelData.playsCount,
                shares: reelData.sharesCount,
              },
              metadata: {
                author: reelData.authorMeta?.name || reelData.authorMeta?.username,
                title: reelData.videoDescription,
                description: reelData.videoDescription,
                videoId: reelData.videoId,
                downloadUrl: reelData.downloadUrl || reelData.videoUrl,
              },
            };
          }
        }
      } else {
        // Legacy API format or non-reel-ai API
        transcription = 
          data.transcription || 
          data.transcript || 
          data.text || 
          data.subtitle || 
          '';
      }

      if (!transcription || transcription.trim().length === 0) {
        return {
          success: false,
          reason: 'NO_TRANSCRIPTION',
          message: errorMsg || 'No transcription available',
        };
      }

      // 检查特定错误信息
      const errorMessage = errorMsg.toLowerCase();
      if (
        errorMessage.includes('video not found') ||
        errorMessage.includes('invalid url')
      ) {
        return {
          success: false,
          reason: 'VIDEO_NOT_FOUND',
          message: 'Video not found or invalid URL',
        };
      }

      if (
        errorMessage.includes('private video') ||
        errorMessage.includes('access denied')
      ) {
        return {
          success: false,
          reason: 'PRIVATE_VIDEO',
          message: 'Video is private or access denied',
        };
      }

      if (errorMessage.includes('no subtitle') || errorMessage.includes('no transcript')) {
        return {
          success: false,
          reason: 'NO_SUBTITLE',
          message: 'Video has no subtitle available',
        };
      }

      // ✅ 成功：返回transcription数据
      return {
        success: true,
        transcriptData: data,
        metadata: {},
      };
    } catch (error: any) {
      // 网络错误/超时
      if (error.name === 'AbortError' || error.name === 'TimeoutError') {
        return {
          success: false,
          reason: 'TIMEOUT',
          message: 'Paid API request timeout',
        };
      }
      return {
        success: false,
        reason: 'NETWORK_ERROR',
        message: error.message || 'Network error',
      };
    }
  }

  /**
   * Fetch TikTok transcript via RapidAPI (Legacy method, kept for compatibility)
   * @param url TikTok video URL
   * @param host RapidAPI host
   * @returns Transcript data
   * @deprecated Use fetchTikTokTranscriptFreeAPI or fetchTikTokTranscriptPaidAPI instead
   */
  private async fetchTikTokTranscript(url: string, host: string): Promise<any> {
    const apiUrl = `https://${host}/index.php`;

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-rapidapi-host': host,
        'x-rapidapi-key': this.configs.apiKey,
      },
      body: JSON.stringify({ url }),
      signal: AbortSignal.timeout(this.DEFAULT_TIMEOUT),
    });

    if (!response.ok) {
      if (response.status === 429) {
        throw new Error('RapidAPI rate limit exceeded. Please try again later.');
      }
      throw new Error(
        `TikTok transcript API failed: ${response.status} ${response.statusText}`
      );
    }

    return await response.json();
  }

  /**
   * Normalize metadata from different API responses
   * Handles field name differences between platforms
   * @param rawResponse Raw API response
   * @param platform Platform type
   * @returns Normalized metadata
   */
  private normalizeMetadata(
    rawResponse: any,
    platform: 'youtube' | 'tiktok'
  ): Partial<NormalizedMediaData> {
    if (platform === 'tiktok') {
      return {
        title:
          rawResponse.desc ||
          rawResponse.title ||
          rawResponse.description ||
          '',
        author:
          rawResponse.author?.nickname ||
          rawResponse.author?.uniqueId ||
          rawResponse.author ||
          '',
        likes:
          rawResponse.statistics?.digg_count ||
          rawResponse.digg_count ||
          rawResponse.likes ||
          0,
        views:
          rawResponse.statistics?.play_count ||
          rawResponse.play_count ||
          rawResponse.views ||
          0,
        shares:
          rawResponse.statistics?.share_count ||
          rawResponse.share_count ||
          rawResponse.shares ||
          0,
        // Handle duration: convert milliseconds to seconds, or parse time string "MM:SS"
        // TikTok reel-ai API returns videoDuration in milliseconds (e.g., 15200)
        // Legacy APIs may return duration as "01:46" format
        duration: rawResponse.videoDuration 
          ? Math.floor(rawResponse.videoDuration / 1000) // Convert milliseconds to seconds
          : rawResponse.duration || rawResponse.video?.duration,
        publishedAt: rawResponse.create_time
          ? new Date(rawResponse.create_time * 1000)
          : undefined,
        thumbnailUrl:
          rawResponse.cover ||
          rawResponse.thumbnail ||
          rawResponse.video?.cover,
        sourceLang: rawResponse.language || rawResponse.lang || 'en',
      };
    } else {
      // YouTube
      return {
        title:
          rawResponse.title ||
          rawResponse.snippet?.title ||
          rawResponse.videoDetails?.title ||
          '',
        author:
          rawResponse.author ||
          rawResponse.channelTitle ||
          rawResponse.snippet?.channelTitle ||
          '',
        likes:
          rawResponse.statistics?.likeCount ||
          rawResponse.likeCount ||
          rawResponse.likes ||
          0,
        views:
          rawResponse.statistics?.viewCount ||
          rawResponse.viewCount ||
          rawResponse.views ||
          0,
        shares:
          rawResponse.statistics?.shareCount ||
          rawResponse.shareCount ||
          rawResponse.shares ||
          0,
        duration: rawResponse.duration || rawResponse.contentDetails?.duration,
        publishedAt: rawResponse.publishedAt
          ? new Date(rawResponse.publishedAt)
          : undefined,
        thumbnailUrl:
          rawResponse.thumbnail ||
          rawResponse.snippet?.thumbnails?.high?.url ||
          rawResponse.videoDetails?.thumbnail?.thumbnails?.[0]?.url,
        sourceLang: rawResponse.language || rawResponse.lang || 'en',
      };
    }
  }

  /**
   * Normalize subtitles from different API responses
   * Converts various formats to standard SRT
   * @param rawResponse Raw API response
   * @param platform Platform type
   * @returns SRT format string or null
   */
  private normalizeSubtitles(
    rawResponse: any,
    platform: 'youtube' | 'tiktok'
  ): string | null {
    if (!rawResponse) {
      return null;
    }

    // Try to find subtitle data in response
    let subtitleData: any = null;

    // ===== YouTube 平台处理 =====
    if (platform === 'youtube') {
      // 优先处理新 Flux API 的 transcript 数组格式
      // transcript 数组格式: [{ text: "...", start: 0.0, duration: 3.5 }, ...]
      if (Array.isArray(rawResponse.transcript) && rawResponse.transcript.length > 0) {
        const segments = rawResponse.transcript.map((item: any) => ({
          start: item.start || item.startTime || 0,
          duration: item.duration || item.dur || 0,
          text: item.text || item.content || '',
        }));
        return SubtitleFormatter.jsonToSRT(segments);
      }
      
      // 处理其他可能的数组格式
      if (Array.isArray(rawResponse.subtitles) && rawResponse.subtitles.length > 0) {
        const segments = rawResponse.subtitles.map((item: any) => ({
          start: item.start || item.startTime || 0,
          duration: item.duration || item.dur || 0,
          text: item.text || item.content || '',
        }));
        return SubtitleFormatter.jsonToSRT(segments);
      }
    }

    // ===== TikTok 平台处理 =====
    if (platform === 'tiktok') {
      // 优先处理新 Supadata API 的 chunks 格式（tiktok-transcripts.p.rapidapi.com）
      // chunks 数组格式: [{ start: 0.0, end: 2.46, text: "..." }, ...]
      if (Array.isArray(rawResponse.chunks) && rawResponse.chunks.length > 0) {
        // 将 chunks 转换为 SubtitleSegment 格式
        const segments = rawResponse.chunks.map((chunk: any) => ({
          start: chunk.start || chunk.startTime || 0,
          duration: (chunk.end || chunk.endTime || 0) - (chunk.start || chunk.startTime || 0),
          text: chunk.text || chunk.transcript || '',
        }));
        return SubtitleFormatter.jsonToSRT(segments);
      }

      // 处理 segments 数组格式（reel-ai API）
      if (Array.isArray(rawResponse.segments) && rawResponse.segments.length > 0) {
        const segments = rawResponse.segments.map((seg: any) => ({
          start: seg.start || seg.startTime || 0,
          duration: (seg.end || seg.endTime || 0) - (seg.start || seg.startTime || 0),
          text: seg.text || seg.transcript || '',
        }));
        return SubtitleFormatter.jsonToSRT(segments);
      }
    }

    // ===== 标准处理流程（兼容旧格式）=====
    if (rawResponse.subtitles || rawResponse.transcript) {
      subtitleData = rawResponse.subtitles || rawResponse.transcript;
    } else if (rawResponse.text) {
      // If response has direct text, try to parse it
      subtitleData = rawResponse.text;
    } else if (Array.isArray(rawResponse)) {
      subtitleData = rawResponse;
    } else if (rawResponse.data) {
      subtitleData = rawResponse.data;
    }

    if (!subtitleData) {
      return null;
    }

    // Use SubtitleFormatter to convert to SRT
    const srtContent = SubtitleFormatter.autoConvertToSRT(subtitleData);
    return srtContent || null;
  }

  /**
   * Extract TikTok video ID from URL
   * @param url TikTok URL
   * @returns Video ID or null
   */
  private extractTikTokVideoId(url: string): string | null {
    // TikTok URL patterns:
    // https://www.tiktok.com/@username/video/1234567890
    // https://vm.tiktok.com/xxxxx/
    const patterns = [
      /tiktok\.com\/@[\w.-]+\/video\/(\d+)/,
      /vm\.tiktok\.com\/([\w]+)/,
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }

    // If no pattern matches, return the full URL as identifier
    return url;
  }

  /**
   * Fetch TikTok video download via Free API (Snap Video3)
   * Only called once per request
   * @param url TikTok video URL
   * @returns Result with video data or failure reason
   */
  private async fetchTikTokVideoDownloadFreeAPI(
    url: string
  ): Promise<{
    success: boolean;
    videoData?: any;
    metadata?: any;
    reason?: string;
    message?: string;
  }> {
    const FREE_API_TIMEOUT = 20000; // 20 seconds timeout (increased for reliability)
    
    // 使用配置中的主 API Host（从环境变量读取）
    const host = this.configs.tiktokVideo?.primaryHost || 
                 this.configs.hostTikTokDownload || 
                 'snap-video3.p.rapidapi.com';
    
    // Clean URL by removing query parameters (improves API compatibility)
    const cleanedUrl = this.cleanTikTokUrl(url);
    const apiUrl = `https://${host}/download`;

    try {
      // Create form data with URL parameter
      const formData = new URLSearchParams();
      formData.append('url', cleanedUrl);

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'x-rapidapi-key': this.configs.apiKey,
          'x-rapidapi-host': host,
          'User-Agent': this.DEFAULT_USER_AGENT, // 添加 User-Agent
        },
        body: formData.toString(),
        signal: AbortSignal.timeout(FREE_API_TIMEOUT),
      });

      // HTTP层面失败判断
      if (!response.ok) {
        if (response.status === 429) {
          return {
            success: false,
            reason: 'RATE_LIMIT',
            message: 'Free API rate limit exceeded',
          };
        }
        if (response.status === 403) {
          return {
            success: false,
            reason: 'QUOTA_EXCEEDED',
            message: 'Free API quota exceeded or disabled',
          };
        }
        return {
          success: false,
          reason: 'HTTP_ERROR',
          message: `HTTP ${response.status}: ${response.statusText}`,
        };
      }

      const data = await response.json();

      // 日志分级：开发环境打印完整结构，生产环境限制长度
      const logLength = process.env.NODE_ENV === 'development' ? 2000 : 500;
      if (process.env.NODE_ENV === 'development') {
        console.log(`[TikTok Video Download Free API] DEBUG_RESPONSE:`, JSON.stringify(data, null, 2).substring(0, logLength));
      } else {
        console.log(`[TikTok Video Download Free API] Response received (length:`, JSON.stringify(data).length, ')');
      }

      // 业务层面失败判断
      const errorMessage = (data.error || data.message || '').toLowerCase();
      
      // 检查额度/限额
      if (
        errorMessage.includes('quota') ||
        errorMessage.includes('limit') ||
        errorMessage.includes('free plan disabled') ||
        errorMessage.includes('exceeded')
      ) {
        return {
          success: false,
          reason: 'QUOTA_EXCEEDED',
          message: 'Free API quota exceeded or disabled',
        };
      }

      // 数据层面失败判断
      // 使用深度解析器提取视频URL（支持所有可能的响应格式）
      const videoUrl = this.parseTikTokVideoUrl(data);

      // 检查是否有视频URL
      if (!videoUrl || videoUrl.trim().length === 0) {
        return {
          success: false,
          reason: 'NO_VIDEO_URL',
          message: 'No video URL available in response',
        };
      }

      // 检查视频URL是否有效（应该是http/https链接）
      if (!videoUrl.startsWith('http://') && !videoUrl.startsWith('https://')) {
        return {
          success: false,
          reason: 'INVALID_VIDEO_URL',
          message: 'Invalid video URL format',
        };
      }

      // ✅ 成功：返回视频数据
      return {
        success: true,
        videoData: data,
        metadata: {
          title: data.title,
          author: data.author,
          description: data.description,
        },
      };
    } catch (error: any) {
      // 网络错误/超时
      if (error.name === 'AbortError' || error.name === 'TimeoutError') {
        return {
          success: false,
          reason: 'TIMEOUT',
          message: 'Free API request timeout',
        };
      }
      return {
        success: false,
        reason: 'NETWORK_ERROR',
        message: error.message || 'Network error',
      };
    }
  }

  /**
   * Fetch TikTok video download via Paid API (TikTok Video No Watermark)
   * Only called once per request (as fallback)
   * @param url TikTok video URL
   * @returns Result with video data or failure reason
   */
  private async fetchTikTokVideoDownloadPaidAPI(
    url: string
  ): Promise<{
    success: boolean;
    videoData?: any;
    metadata?: any;
    reason?: string;
    message?: string;
  }> {
    const PAID_API_TIMEOUT = 20000; // 20 seconds timeout
    
    // 使用配置中的备 API Host（从环境变量读取）
    const host = this.configs.tiktokVideo?.backupHost || 
                 this.configs.hostTikTokDownload || 
                 'tiktok-video-no-watermark2.p.rapidapi.com';
    
    // Clean URL by removing query parameters (improves API compatibility)
    const cleanedUrl = this.cleanTikTokUrl(url);
    
    // Try multiple possible endpoints based on host
    let apiUrl = `https://${host}/`;
    if (host.includes('tiktok-video-no-watermark')) {
      apiUrl = `https://${host}/`;
    } else if (host.includes('snap-video')) {
      apiUrl = `https://${host}/download`;
    }

    try {
      // Create form data with URL parameter
      const formData = new URLSearchParams();
      formData.append('url', cleanedUrl);

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'x-rapidapi-key': this.configs.apiKey,
          'x-rapidapi-host': host,
          'User-Agent': this.DEFAULT_USER_AGENT, // 添加 User-Agent
        },
        body: formData.toString(),
        signal: AbortSignal.timeout(PAID_API_TIMEOUT),
      });

      // HTTP层面失败判断
      if (!response.ok) {
        // 增强错误处理：详细的 HTTP 错误信息
        const errorText = await response.text().catch(() => 'Unknown error');
        const errorInfo = {
          status: response.status,
          statusText: response.statusText,
          url: apiUrl,
          errorText: errorText.substring(0, 500),
        };
        
        console.error(`[TikTok Video Download Paid API] HTTP Error:`, errorInfo);
        
        if (response.status === 403) {
          return {
            success: false,
            reason: 'HTTP_ERROR_403',
            message: 'Forbidden (可能缺少 User-Agent 或 API 权限不足)',
          };
        }
        if (response.status === 429) {
          return {
            success: false,
            reason: 'HTTP_ERROR_429',
            message: 'Rate limit exceeded',
          };
        }
        if (response.status === 404) {
          return {
            success: false,
            reason: 'HTTP_ERROR_404',
            message: 'Endpoint not found (请检查 API 路径)',
          };
        }
        
        return {
          success: false,
          reason: 'HTTP_ERROR',
          message: `HTTP ${response.status}: ${response.statusText}`,
        };
      }

      const data = await response.json();

      // 日志分级：开发环境打印完整结构，生产环境限制长度
      const logLength = process.env.NODE_ENV === 'development' ? 2000 : 500;
      if (process.env.NODE_ENV === 'development') {
        console.log(`[TikTok Video Download Paid API] DEBUG_RESPONSE:`, JSON.stringify(data, null, 2).substring(0, logLength));
      } else {
        console.log(`[TikTok Video Download Paid API] Response received (length:`, JSON.stringify(data).length, ')');
      }

      // 业务层面失败判断
      const errorMsg = data.error || data.message || '';

      // 使用深度解析器提取视频URL（支持所有可能的响应格式）
      const videoUrl = this.parseTikTokVideoUrl(data);

      if (!videoUrl || videoUrl.trim().length === 0) {
        return {
          success: false,
          reason: 'NO_VIDEO_URL',
          message: errorMsg || 'No video URL available',
        };
      }

      // 检查视频URL是否有效
      if (!videoUrl.startsWith('http://') && !videoUrl.startsWith('https://')) {
        return {
          success: false,
          reason: 'INVALID_VIDEO_URL',
          message: 'Invalid video URL format',
        };
      }

      // 检查特定错误信息
      const errorMessage = errorMsg.toLowerCase();
      if (
        errorMessage.includes('video not found') ||
        errorMessage.includes('invalid url')
      ) {
        return {
          success: false,
          reason: 'VIDEO_NOT_FOUND',
          message: 'Video not found or invalid URL',
        };
      }

      if (
        errorMessage.includes('private video') ||
        errorMessage.includes('access denied')
      ) {
        return {
          success: false,
          reason: 'PRIVATE_VIDEO',
          message: 'Video is private or access denied',
        };
      }

      // ✅ 成功：返回视频数据
      return {
        success: true,
        videoData: data,
        metadata: {},
      };
    } catch (error: any) {
      // 网络错误/超时
      if (error.name === 'AbortError' || error.name === 'TimeoutError') {
        return {
          success: false,
          reason: 'TIMEOUT',
          message: 'Paid API request timeout',
        };
      }
      return {
        success: false,
        reason: 'NETWORK_ERROR',
        message: error.message || 'Network error',
      };
    }
  }

  /**
   * Fetch TikTok video download via RapidAPI (Legacy method, kept for compatibility)
   * Uses the video download API endpoint (POST request with form data)
   * API: https://tiktok-video-no-watermark2.p.rapidapi.com/
   * @param url TikTok video URL
   * @param host RapidAPI host
   * @returns Video download data
   * @deprecated Use fetchTikTokVideoDownloadFreeAPI or fetchTikTokVideoDownloadPaidAPI instead
   */
  private async fetchTikTokVideoDownload(url: string, host: string): Promise<any> {
    // Call TikTok video download API using POST with form data
    const apiUrl = `https://${host}/`;
    
    // Create form data with URL parameter
    const formData = new URLSearchParams();
    formData.append('url', url);
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'x-rapidapi-host': host,
        'x-rapidapi-key': this.configs.apiKey,
      },
      body: formData.toString(),
      signal: AbortSignal.timeout(this.DEFAULT_TIMEOUT),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      if (response.status === 429) {
        throw new Error('RapidAPI rate limit exceeded. Please try again later.');
      }
      throw new Error(
        `TikTok video download API failed: ${response.status} ${response.statusText}. ${errorText}`
      );
    }

    const data = await response.json();
    
    // Log response for debugging (can be removed in production)
    console.log('TikTok video download API response:', JSON.stringify(data, null, 2));
    
    return data;
  }

  /**
   * Format YouTube URL to standard watch?v= format
   * Converts shorts/ URLs to watch?v= format for API compatibility
   * @param url YouTube URL
   * @returns Formatted URL
   */
  private formatYouTubeUrl(url: string): string {
    // Convert YouTube Shorts URL to standard watch?v= format for API compatibility
    if (url.includes('/shorts/')) {
      // Extract video ID from shorts URL
      // Support formats:
      // - https://www.youtube.com/shorts/VIDEO_ID
      // - https://youtube.com/shorts/VIDEO_ID
      // - https://m.youtube.com/shorts/VIDEO_ID
      const shortsMatch = url.match(/(?:www\.|m\.)?youtube\.com\/shorts\/([^&\n?#\/]+)/);
      if (shortsMatch && shortsMatch[1]) {
        const videoId = shortsMatch[1];
        // Convert to watch?v= format
        // Preserve the original domain (www. or m. or none)
        const domain = url.match(/https?:\/\/(?:www\.|m\.)?youtube\.com/)?.[0] || 'https://www.youtube.com';
        return `${domain}/watch?v=${videoId}`;
      }
    }
    return url;
  }

  /**
   * Extract YouTube video ID from URL
   * Supports multiple YouTube URL formats including Shorts
   * @param url YouTube URL
   * @returns Video ID or null
   */
  private extractYouTubeVideoId(url: string): string | null {
    // Format URL first (convert shorts to watch format)
    const formattedUrl = this.formatYouTubeUrl(url);
    
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/,
      /youtube\.com\/embed\/([^&\n?#]+)/,
      /youtube\.com\/shorts\/([^&\n?#\/]+)/, // Support shorts format directly
    ];

    for (const pattern of patterns) {
      const match = formattedUrl.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }

    return null;
  }

  /**
   * Calculate subtitle statistics (character count and line count)
   * @param srtContent SRT format subtitle content
   * @returns Statistics object
   */
  private calculateSubtitleStats(srtContent: string): {
    charCount: number;
    lineCount: number;
  } {
    if (!srtContent) {
      return { charCount: 0, lineCount: 0 };
    }

    // Count lines (subtitles entries, not including timestamps and sequence numbers)
    const lines = srtContent.split('\n');
    let subtitleLineCount = 0;
    let inSubtitleText = false;

    for (const line of lines) {
      const trimmed = line.trim();
      // Skip empty lines, sequence numbers, and timestamps
      if (
        !trimmed ||
        /^\d+$/.test(trimmed) ||
        /\d{2}:\d{2}:\d{2}[.,]\d{3}\s*-->\s*\d{2}:\d{2}:\d{2}[.,]\d{3}/.test(
          trimmed
        )
      ) {
        inSubtitleText = false;
        continue;
      }
      // This is subtitle text
      if (!inSubtitleText) {
        subtitleLineCount++;
        inSubtitleText = true;
      }
    }

    // Count characters (excluding timestamps and sequence numbers)
    const textOnly = srtContent
      .split('\n')
      .filter(
        (line) =>
          line.trim() &&
          !/^\d+$/.test(line.trim()) &&
          !/\d{2}:\d{2}:\d{2}[.,]\d{3}\s*-->\s*\d{2}:\d{2}:\d{2}[.,]\d{3}/.test(
            line.trim()
          )
      )
      .join('\n');

    return {
      charCount: textOnly.length,
      lineCount: subtitleLineCount,
    };
  }
}

/**
 * Create RapidAPI provider with configs
 */
export function createRapidAPIProvider(
  configs: RapidAPIConfigs
): RapidAPIProvider {
  return new RapidAPIProvider(configs);
}


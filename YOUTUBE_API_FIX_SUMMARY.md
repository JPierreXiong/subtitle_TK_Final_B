# YouTube 字幕提取 API 修复总结

## 问题分析

根据错误信息和新的 API 文档，主要问题包括：

1. **API 方法不匹配**: 新 API 使用 POST 请求而不是 GET
2. **请求格式错误**: 需要传递完整的 `videoUrl` 和 `langCode`，而不是 `video_id`
3. **响应格式未适配**: 新 API 返回 `transcript` 数组格式，需要转换为 SRT

## 修复内容

### 1. 更新 Free API 请求方法 (`fetchYouTubeTranscriptFreeAPI`)

**文件**: `src/extensions/media/rapidapi.ts`

**修复点**:
- ✅ 检测新 Flux API (`ai-youtube-transcript-generator-free-online-api-flux.p.rapidapi.com`)
- ✅ 使用 POST 请求替代 GET
- ✅ 请求体格式: `{"videoUrl":"...","langCode":"en"}`
- ✅ 正确解析 `transcript` 数组格式
- ✅ 保留 transcript 数组用于 SRT 转换

**关键代码**:
```typescript
// 检测新 Flux API
const isFluxAPI = host.includes('ai-youtube-transcript-generator-free-online-api-flux');

if (isFluxAPI) {
  // POST /transcript
  apiUrl = `https://${host}/transcript`;
  
  fetchOptions = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-rapidapi-key': this.configs.apiKey,
      'x-rapidapi-host': host,
    },
    body: JSON.stringify({
      videoUrl: videoUrl, // 完整 URL
      langCode: 'en',
    }),
    signal: AbortSignal.timeout(FREE_API_TIMEOUT),
  };
}
```

### 2. 更新字幕标准化方法 (`normalizeSubtitles`)

**文件**: `src/extensions/media/rapidapi.ts`

**修复点**:
- ✅ 优先处理 YouTube 的 `transcript` 数组格式
- ✅ 正确转换时间戳格式（`start`/`duration` → SRT）
- ✅ 支持多种数组格式（`transcript`, `subtitles`）

**关键代码**:
```typescript
// 优先处理新 Flux API 的 transcript 数组格式
if (platform === 'youtube' && Array.isArray(rawResponse.transcript) && rawResponse.transcript.length > 0) {
  const segments = rawResponse.transcript.map((item: any) => ({
    start: item.start || item.startTime || 0,
    duration: item.duration || item.dur || 0,
    text: item.text || item.content || '',
  }));
  return SubtitleFormatter.jsonToSRT(segments);
}
```

### 3. 响应数据解析优化

**修复点**:
- ✅ 正确处理 `transcript` 数组格式
- ✅ 从数组中提取文本用于验证
- ✅ 保留完整数组数据用于 SRT 转换

**关键代码**:
```typescript
// 新 Flux API: transcript 是数组格式
transcriptArray = Array.isArray(data.transcript) ? data.transcript : [];

// 从数组中提取文本
if (transcriptArray.length > 0) {
  transcriptText = transcriptArray.map((item: any) => item.text || '').join(' ').trim();
}
```

## API 配置

### 环境变量配置

确保 `.env.local` 中包含：

```env
# YouTube 字幕提取 API Host - 主配置（推荐：免费）
RAPIDAPI_YOUTUBE_TRANSCRIPT_PRIMARY_HOST=ai-youtube-transcript-generator-free-online-api-flux.p.rapidapi.com
RAPIDAPI_YOUTUBE_TRANSCRIPT_BACKUP_HOST=youtube-video-summarizer-gpt-ai.p.rapidapi.com

# RapidAPI API Key
NEXT_PUBLIC_RAPIDAPI_KEY=your-rapidapi-key
```

### API 端点信息

**AI YouTube Transcript Generator (Flux)**:
- **Host**: `ai-youtube-transcript-generator-free-online-api-flux.p.rapidapi.com`
- **Method**: `POST`
- **Endpoint**: `/transcript`
- **Request Body**:
  ```json
  {
    "videoUrl": "https://www.youtube.com/watch?v=VIDEO_ID",
    "langCode": "en"
  }
  ```
- **Headers**:
  - `Content-Type: application/json`
  - `x-rapidapi-key`: Your RapidAPI key
  - `x-rapidapi-host`: `ai-youtube-transcript-generator-free-online-api-flux.p.rapidapi.com`

**响应格式**:
```json
{
  "success": true,
  "video_id": "pYw23YfUDwY",
  "title": "Video Title Here",
  "author": "Channel Name",
  "duration": "10:25",
  "language": "en",
  "transcript": [
    {
      "text": "Hello and welcome to this video",
      "start": 0.0,
      "duration": 3.5
    },
    {
      "text": "Today we're going to talk about...",
      "start": 3.5,
      "duration": 4.2
    }
  ]
}
```

## SRT 转换

### 转换逻辑

新 API 返回的 `transcript` 数组会自动转换为标准 SRT 格式：

```typescript
// 数组格式: [{ text: "...", start: 0.0, duration: 3.5 }, ...]
// 转换为 SRT:
// 1
// 00:00:00,000 --> 00:00:03,500
// Hello and welcome to this video
//
// 2
// 00:00:03,500 --> 00:00:07,700
// Today we're going to talk about...
```

### 为什么需要 SRT 格式？

1. **时间戳保留**: 保持原始视频的时间轴信息
2. **爆改文案兼容**: Gemini 改写时可以保持时间戳不变
3. **视频同步**: 改写后的文案可以直接关联到视频预览
4. **SEO 优势**: 带时间戳的文案被视为高质量视频转录资产

## 测试步骤

1. **配置环境变量**:
   ```bash
   # 确保 .env.local 中包含 RAPIDAPI_KEY
   NEXT_PUBLIC_RAPIDAPI_KEY=your-key-here
   ```

2. **运行测试脚本**:
   ```bash
   pnpm tsx scripts/test-youtube-transcript-api.ts "https://www.youtube.com/watch?v=pYw23YfUDwY"
   ```

3. **前端测试**:
   - 访问 `http://localhost:3000/ai-media-extractor`
   - 提交 YouTube URL
   - 等待提取完成
   - 检查字幕是否正确显示（SRT 格式）

## 预期结果

修复后，系统应该能够：

1. ✅ 正确调用新 Flux API (`ai-youtube-transcript-generator-free-online-api-flux.p.rapidapi.com`)
2. ✅ 使用 POST 请求传递完整的 `videoUrl` 和 `langCode`
3. ✅ 正确解析响应（`transcript` 数组格式）
4. ✅ 将 `transcript` 数组转换为标准 SRT 格式
5. ✅ 在数据库中存储 SRT 格式的字幕，便于后续 Gemini 改写

## 注意事项

1. **URL 格式**: API 需要完整的 YouTube URL，系统会自动从 videoId 构建
2. **超时设置**: Free API 超时设置为 20 秒（POST 请求可能需要更长时间）
3. **错误处理**: 如果 API 返回错误，系统会自动退款并返回错误信息
4. **语言代码**: 默认使用 `en`，可以根据需要调整 `langCode`

## 相关文件

- `src/extensions/media/rapidapi.ts` - 主要修复文件
- `src/extensions/media/subtitle-formatter.ts` - SRT 转换工具
- `scripts/test-youtube-transcript-api.ts` - 测试脚本
- `env.example.txt` - 环境变量配置示例

## 与 TikTok API 修复的对比

| 特性 | YouTube API | TikTok API |
|------|------------|------------|
| 请求方法 | POST | GET |
| 参数格式 | JSON Body | URL Query |
| 响应格式 | `transcript` 数组 | `chunks` 数组 |
| 时间戳格式 | `start` + `duration` | `start` + `end` |
| SRT 转换 | ✅ 支持 | ✅ 支持 |

两个 API 都已修复并支持 SRT 格式转换，确保与 Gemini 改写功能完全兼容。

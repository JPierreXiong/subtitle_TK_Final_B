# YouTube 字幕提取 API 单一化修复

## 问题分析

用户报告 YouTube 字幕提取失败：
- Free API 失败: `NO_TRANSCRIPT`
- Paid API 失败: `HTTP 429: Too Many Requests`

用户要求：
1. **屏蔽旧的 Free API 和 Paid API**
2. **只使用 Flux API**: `ai-youtube-transcript-generator-free-online-api-flux.p.rapidapi.com/transcript`

## 修复内容

### 1. 修改 `fetchYouTubeMedia` 方法

**文件**: `src/extensions/media/rapidapi.ts`

**修复点**:
- ✅ 移除 Free API 和 Paid API 的 fallback 逻辑
- ✅ 直接使用 Flux API (`fetchYouTubeTranscriptFluxAPI`)
- ✅ 自动格式化 URL（转换 Shorts 为 watch 格式）

**关键代码**:
```typescript
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
  // ... 后续处理
}
```

### 2. 新增专用 Flux API 方法

**文件**: `src/extensions/media/rapidapi.ts`

**方法**: `fetchYouTubeTranscriptFluxAPI`

**特点**:
- ✅ 强制使用 `ai-youtube-transcript-generator-free-online-api-flux.p.rapidapi.com`
- ✅ POST 请求: `/transcript`
- ✅ 请求体格式: `{"videoUrl":"...","langCode":"en"}`
- ✅ 正确解析响应格式（`transcript` 数组）
- ✅ 自动转换为 SRT 格式

**API 请求格式**:
```typescript
// POST 请求
const apiUrl = `https://ai-youtube-transcript-generator-free-online-api-flux.p.rapidapi.com/transcript`;

fetch(apiUrl, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-rapidapi-key': this.configs.apiKey,
    'x-rapidapi-host': 'ai-youtube-transcript-generator-free-online-api-flux.p.rapidapi.com',
  },
  body: JSON.stringify({
    videoUrl: url, // 完整 URL，如: https://www.youtube.com/watch?v=VIDEO_ID
    langCode: 'en',
  }),
});
```

**响应解析**:
```typescript
// Flux API 返回格式: { success: true, transcript: [{text, start, duration}], title, author, ... }
const transcriptArray = Array.isArray(data.transcript) ? data.transcript : [];

// 从数组中提取文本
if (transcriptArray.length > 0) {
  transcriptText = transcriptArray.map((item: any) => item.text || '').join(' ').trim();
}
```

### 3. URL 格式化逻辑

**方法**: `formatYouTubeUrl`

**功能**:
- 将 YouTube Shorts URL 转换为标准 watch 格式
- 确保 API 接收到正确格式的 URL

**示例**:
```
输入: https://www.youtube.com/shorts/VIDEO_ID
输出: https://www.youtube.com/watch?v=VIDEO_ID
```

## API 配置

### 环境变量

确保 `.env.local` 中包含：

```env
# RapidAPI API Key
NEXT_PUBLIC_RAPIDAPI_KEY=your-rapidapi-key

# YouTube 字幕提取 API Host（已不再使用，但保留用于兼容）
RAPIDAPI_YOUTUBE_TRANSCRIPT_PRIMARY_HOST=ai-youtube-transcript-generator-free-online-api-flux.p.rapidapi.com
```

**注意**: 代码中已硬编码使用 `ai-youtube-transcript-generator-free-online-api-flux.p.rapidapi.com`，不再依赖环境变量。

### API 端点信息

**AI YouTube Transcript Generator (Flux)**:
- **Host**: `ai-youtube-transcript-generator-free-online-api-flux.p.rapidapi.com` (硬编码)
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

**cURL 示例**:
```bash
curl --request POST \
  --url https://ai-youtube-transcript-generator-free-online-api-flux.p.rapidapi.com/transcript \
  --header 'Content-Type: application/json' \
  --header 'x-rapidapi-host: ai-youtube-transcript-generator-free-online-api-flux.p.rapidapi.com' \
  --header 'x-rapidapi-key: YOUR_API_KEY' \
  --data '{"videoUrl":"https://www.youtube.com/watch?v=pYw23YfUDwY","langCode":"en"}'
```

## 响应格式

### 成功响应

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

### 错误响应

```json
{
  "error": "Error message"
}
```

## SRT 转换

### 转换逻辑

Flux API 返回的 `transcript` 数组会自动转换为标准 SRT 格式：

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

转换由 `normalizeSubtitles` 方法处理，该方法会：
1. 检测 `transcript` 数组格式
2. 将数组转换为 `SubtitleSegment[]` 格式
3. 使用 `SubtitleFormatter.jsonToSRT` 转换为 SRT 字符串

## 测试步骤

1. **配置环境变量**:
   ```bash
   # 确保 .env.local 中包含 RAPIDAPI_KEY
   NEXT_PUBLIC_RAPIDAPI_KEY=your-key-here
   ```

2. **测试脚本**:
   ```bash
   pnpm tsx scripts/test-youtube-transcript-api.ts "https://www.youtube.com/watch?v=pYw23YfUDwY"
   ```

3. **前端测试**:
   - 访问 `http://localhost:3000/ai-media-extractor`
   - 提交 YouTube URL: `https://www.youtube.com/watch?v=pYw23YfUDwY`
   - 等待提取完成
   - 检查字幕是否正确显示（SRT 格式）

## 预期结果

修复后，系统应该能够：

1. ✅ **只使用 Flux API**，不再尝试 Free/Paid API
2. ✅ **自动格式化 URL**，支持 Shorts 和标准格式
3. ✅ **正确解析响应**（`transcript` 数组格式）
4. ✅ **将 `transcript` 数组转换为标准 SRT 格式**
5. ✅ **提供清晰的错误信息**（如果 API 失败）

## 已屏蔽的 API

以下 API 已被屏蔽，不再使用：

1. **Free API** (`fetchYouTubeTranscriptFreeAPI`):
   - 旧逻辑：尝试多个 API Host（包括 GET 请求）
   - 状态：已屏蔽，不再调用

2. **Paid API** (`fetchYouTubeTranscriptPaidAPI`):
   - 旧逻辑：包括多个备用 API
   - 状态：已屏蔽，不再调用

## 注意事项

1. **URL 格式**: API 需要完整的 YouTube URL（watch 格式），系统会自动转换 Shorts 格式
2. **超时设置**: API 超时设置为 20 秒
3. **错误处理**: 如果 API 失败，系统会返回清晰的错误信息
4. **SRT 转换**: `transcript` 数组会自动转换为标准 SRT 格式
5. **语言代码**: 默认使用 `en`，可以根据需要调整 `langCode`

## 相关文件

- `src/extensions/media/rapidapi.ts` - 主要修复文件
  - `fetchYouTubeMedia` - 修改为只使用 Flux API
  - `fetchYouTubeTranscriptFluxAPI` - 新增专用方法
  - `formatYouTubeUrl` - URL 格式化工具
- `scripts/test-youtube-transcript-api.ts` - 测试脚本
- `env.example.txt` - 环境变量配置示例

## 修复前后对比

| 特性 | 修复前 | 修复后 |
|------|--------|--------|
| API 数量 | 2个（Free + Paid） | 1个（Flux） |
| Fallback 逻辑 | ✅ 有 | ❌ 无 |
| 请求方法 | GET (Free) / POST (Paid) | POST (Flux) |
| URL 格式 | videoId (Free) / URL (Paid) | URL (Flux) |
| 错误信息 | 复杂（多个 API） | 清晰（单一 API） |
| 代码复杂度 | 高 | 低 |

## 总结

通过这次修复：
- ✅ **简化了代码逻辑**：只使用一个 API
- ✅ **提高了成功率**：使用经过验证的 Flux API
- ✅ **改善了错误处理**：清晰的错误信息
- ✅ **保持了兼容性**：SRT 格式转换逻辑不变
- ✅ **支持多种 URL 格式**：自动转换 Shorts 为 watch 格式

现在系统只使用 Flux API (`ai-youtube-transcript-generator-free-online-api-flux.p.rapidapi.com`)，不再尝试其他 API，确保稳定性和可预测性。

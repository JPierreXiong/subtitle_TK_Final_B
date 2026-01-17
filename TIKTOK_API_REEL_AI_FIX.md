# TikTok 字幕提取 API 切换到 Reel-AI 修复

## 问题分析

用户报告 TikTok 字幕提取失败：
- `NO_TRANSCRIPT`: 视频没有可提取的字幕数据
- `404 Not Found`: API 端点路径错误

**根本原因**:
1. 旧的 GET API (`tiktok-transcripts.p.rapidapi.com`) 只能提取已有字幕，无法处理无字幕视频
2. API 端点路径可能不正确

## 解决方案

切换到 **Reel-AI API** (`tiktok-reel-ai-transcript-extractor.p.rapidapi.com`)，该 API：
- ✅ 支持 **AI 语音转文字**，可以处理无字幕视频
- ✅ 使用 POST 请求，端点路径明确：`/api/tiktok/extract`
- ✅ 成功率更高，支持异步处理

## 修复内容

### 1. 修改 `fetchTikTokMedia` 方法

**文件**: `src/extensions/media/rapidapi.ts`

**修复点**:
- ✅ 更新日志信息，说明使用 Reel-AI API
- ✅ 保持调用 `fetchTikTokTranscriptSupadataAPI`（方法名保持不变，但内部实现已切换）

**关键代码**:
```typescript
private async fetchTikTokMedia(url: string): Promise<NormalizedMediaData> {
  // 只使用 Reel-AI API (tiktok-reel-ai-transcript-extractor.p.rapidapi.com)
  // 支持 AI 语音转文字，成功率更高，支持无字幕视频
  console.log('[TikTok Transcript] Using Reel-AI API only (tiktok-reel-ai-transcript-extractor.p.rapidapi.com)...');
  
  // Clean URL by removing query parameters
  const cleanedUrl = this.cleanTikTokUrl(url);
  
  // 直接调用 Reel-AI API
  const result = await this.fetchTikTokTranscriptSupadataAPI(cleanedUrl);
  // ... 后续处理
}
```

### 2. 更新 `fetchTikTokTranscriptSupadataAPI` 方法

**文件**: `src/extensions/media/rapidapi.ts`

**修复点**:
- ✅ 切换到 Reel-AI API: `tiktok-reel-ai-transcript-extractor.p.rapidapi.com`
- ✅ 使用 POST 请求: `/api/tiktok/extract`
- ✅ 请求体格式: `{ url: "..." }`
- ✅ 正确解析响应格式（支持 `data.data.data.transcript` 嵌套结构）
- ✅ 处理 PROCESSING 状态（返回 jobId 时需要重试）
- ✅ 增加超时时间到 60 秒（API 可能需要 10-15 秒处理）

**API 请求格式**:
```typescript
// POST 请求
const apiUrl = `https://tiktok-reel-ai-transcript-extractor.p.rapidapi.com/api/tiktok/extract`;

fetch(apiUrl, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-rapidapi-key': this.configs.apiKey,
    'x-rapidapi-host': 'tiktok-reel-ai-transcript-extractor.p.rapidapi.com',
  },
  body: JSON.stringify({ url: cleanedUrl }),
  signal: AbortSignal.timeout(60000), // 60 seconds
});
```

**响应解析**:
```typescript
// 成功响应: { success: true, data: { data: { transcript: "...", segments: [...] } } }
// 处理中: { success: true, data: { jobId: "...", data: "" } } (需要重试)
// 失败: { success: false, error: "..." }

if (data.success && data.data?.data && typeof data.data.data === 'object') {
  const reelData = data.data.data;
  transcript = reelData.transcript || 
    (Array.isArray(reelData.segments) 
      ? reelData.segments.map((s: any) => s.text || '').join(' ').trim() 
      : '');
  segments = reelData.segments || [];
}
```

### 3. 处理 PROCESSING 状态

**修复点**:
- ✅ 检测 `jobId` 响应（API 仍在处理中）
- ✅ 返回 `PROCESSING` 状态，提示需要重试
- ✅ Worker 可以通过 QStash 自动重试

**关键代码**:
```typescript
// 检查是否还在处理中（返回 jobId）
if (data.success && data.data?.jobId && (!data.data?.data || data.data.data === '' || typeof data.data.data === 'string')) {
  return {
    success: false,
    reason: 'PROCESSING',
    message: 'Transcript is still being processed, please retry after 10-15 seconds',
    metadata: {
      isProcessing: true,
      jobId: data.data.jobId,
      estimatedTime: '10-15 seconds',
    },
  };
}
```

### 4. 数据清理

**修复点**:
- ✅ 自动清理 transcript 文本（`.trim()`）
- ✅ 提取完整的元数据（title, author, likes, views, shares 等）

## API 配置

### 环境变量

确保 `.env.local` 中包含：

```env
# RapidAPI API Key
NEXT_PUBLIC_RAPIDAPI_KEY=your-rapidapi-key

# TikTok 字幕提取 API Host（已不再使用，但保留用于兼容）
RAPIDAPI_TIKTOK_TRANSCRIPT_PRIMARY_HOST=tiktok-reel-ai-transcript-extractor.p.rapidapi.com
```

**注意**: 代码中已硬编码使用 `tiktok-reel-ai-transcript-extractor.p.rapidapi.com`，不再依赖环境变量。

### API 端点信息

**TikTok Reel-AI Transcript Extractor**:
- **Host**: `tiktok-reel-ai-transcript-extractor.p.rapidapi.com` (硬编码)
- **Method**: `POST`
- **Endpoint**: `/api/tiktok/extract`
- **Request Body**:
  ```json
  {
    "url": "https://vm.tiktok.com/ZNdfSseUr"
  }
  ```
- **Headers**:
  - `Content-Type: application/json`
  - `x-rapidapi-key`: Your RapidAPI key
  - `x-rapidapi-host`: `tiktok-reel-ai-transcript-extractor.p.rapidapi.com`

**cURL 示例**:
```bash
curl --request POST \
  --url https://tiktok-reel-ai-transcript-extractor.p.rapidapi.com/api/tiktok/extract \
  --header 'Content-Type: application/json' \
  --header 'x-rapidapi-host: tiktok-reel-ai-transcript-extractor.p.rapidapi.com' \
  --header 'x-rapidapi-key: YOUR_API_KEY' \
  --data '{"url":"https://vm.tiktok.com/ZNdfSseUr"}'
```

## 响应格式

### 成功响应

```json
{
  "success": true,
  "data": {
    "data": {
      "transcript": "Full transcript text...",
      "segments": [
        {
          "text": "Segment text...",
          "start": 0.0,
          "end": 2.46
        }
      ],
      "videoId": "1234567890",
      "videoDescription": "Video description...",
      "downloadUrl": "https://...",
      "authorMeta": {
        "name": "Author Name",
        "username": "author_username"
      },
      "likesCount": 1000,
      "playsCount": 5000,
      "sharesCount": 100
    }
  }
}
```

### 处理中响应

```json
{
  "success": true,
  "data": {
    "jobId": "job-12345",
    "data": "",
    "estimatedProcessingTime": "10-15 seconds"
  }
}
```

### 错误响应

```json
{
  "success": false,
  "error": "Error message"
}
```

## 优势对比

| 特性 | 旧 API (Supadata GET) | 新 API (Reel-AI POST) |
|------|----------------------|----------------------|
| **支持无字幕视频** | ❌ 否 | ✅ 是（AI 语音转文字） |
| **成功率** | 较低（依赖已有字幕） | 较高（AI 生成字幕） |
| **请求方法** | GET | POST |
| **端点路径** | `/transcript?url=...` | `/api/tiktok/extract` |
| **处理时间** | 即时 | 10-15 秒（异步） |
| **元数据** | 有限 | 丰富（author, likes, views 等） |

## 测试步骤

1. **配置环境变量**:
   ```bash
   # 确保 .env.local 中包含 RAPIDAPI_KEY
   NEXT_PUBLIC_RAPIDAPI_KEY=your-key-here
   ```

2. **测试脚本**:
   ```bash
   pnpm tsx scripts/test-tiktok-transcript-api.ts "https://vm.tiktok.com/ZNdfSseUr"
   ```

3. **前端测试**:
   - 访问 `http://localhost:3000/ai-media-extractor`
   - 提交 TikTok URL
   - 等待提取完成（可能需要 10-15 秒）
   - 检查字幕是否正确显示（SRT 格式）

## 预期结果

修复后，系统应该能够：

1. ✅ **使用 Reel-AI API**，支持 AI 语音转文字
2. ✅ **处理无字幕视频**，通过 AI 生成字幕
3. ✅ **正确解析响应**（支持嵌套的 `data.data.data.transcript` 结构）
4. ✅ **处理 PROCESSING 状态**，支持异步重试
5. ✅ **提取完整元数据**（title, author, likes, views, shares 等）
6. ✅ **将 segments 数组转换为标准 SRT 格式**

## 注意事项

1. **处理时间**: API 可能需要 10-15 秒处理，超时设置为 60 秒
2. **PROCESSING 状态**: 如果返回 `jobId`，需要等待后重试（Worker 可以通过 QStash 自动处理）
3. **URL 清理**: 系统会自动清理 TikTok URL，移除查询参数
4. **SRT 转换**: `segments` 数组会自动转换为标准 SRT 格式
5. **数据清理**: transcript 文本会自动清理空格（`.trim()`）

## 相关文件

- `src/extensions/media/rapidapi.ts` - 主要修复文件
  - `fetchTikTokMedia` - 更新日志信息
  - `fetchTikTokTranscriptSupadataAPI` - 切换到 Reel-AI API
  - `cleanTikTokUrl` - URL 清理工具
- `scripts/test-tiktok-transcript-api.ts` - 测试脚本
- `env.example.txt` - 环境变量配置示例

## 修复前后对比

| 特性 | 修复前 | 修复后 |
|------|--------|--------|
| API Host | `tiktok-transcripts.p.rapidapi.com` | `tiktok-reel-ai-transcript-extractor.p.rapidapi.com` |
| 请求方法 | GET | POST |
| 端点路径 | `/transcript?url=...` | `/api/tiktok/extract` |
| 支持无字幕视频 | ❌ | ✅ |
| AI 语音转文字 | ❌ | ✅ |
| 处理时间 | 即时 | 10-15 秒 |
| 元数据丰富度 | 有限 | 丰富 |
| 成功率 | 较低 | 较高 |

## 总结

通过这次修复：
- ✅ **解决了 404 错误**：使用正确的 POST 端点和路径
- ✅ **解决了 NO_TRANSCRIPT 问题**：支持 AI 语音转文字，可以处理无字幕视频
- ✅ **提高了成功率**：使用经过验证的 Reel-AI API
- ✅ **改善了用户体验**：支持更多视频类型，提取更丰富的元数据
- ✅ **保持了兼容性**：SRT 格式转换逻辑不变

现在系统使用 Reel-AI API (`tiktok-reel-ai-transcript-extractor.p.rapidapi.com`)，支持 AI 语音转文字，可以处理无字幕视频，大大提高了提取成功率。

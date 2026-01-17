# TikTok 字幕提取 API 修复总结

## 问题分析

根据错误信息和 API 文档分析，主要问题包括：

1. **Paid API 返回 404**: 端点路径或 Host 配置不正确
2. **Free API 返回 NO_TRANSCRIPT**: 响应解析逻辑不完整
3. **新 API 格式未适配**: Supadata API (`tiktok-transcripts.p.rapidapi.com`) 的响应格式未正确处理

## 修复内容

### 1. 修复 Free API 响应解析 (`fetchTikTokTranscriptFreeAPI`)

**文件**: `src/extensions/media/rapidapi.ts`

**修复点**:
- ✅ 支持 `content` 字段包装的响应格式
- ✅ 正确处理 `chunks` 数组（当 `text=false` 时）
- ✅ 从 `chunks` 中提取 transcript 文本
- ✅ 保留完整的 `transcriptData` 对象，包含 `chunks` 信息用于 SRT 转换

**关键代码**:
```typescript
// 支持 { content: { transcript: "...", chunks: [...] } } 格式
const responseData = data.content || data;

// 提取 transcript 文本
transcript = responseData.transcript || responseData.text || ...;

// 提取 chunks 数组
chunks = responseData.chunks || responseData.segments || [];

// 如果只有chunks没有transcript文本，从chunks中提取
if (!transcript && chunks.length > 0) {
  transcript = chunks.map((c: any) => c.text || '').join(' ').trim();
}
```

### 2. 更新字幕标准化方法 (`normalizeSubtitles`)

**文件**: `src/extensions/media/rapidapi.ts`

**修复点**:
- ✅ 优先处理 `chunks` 数组格式（新 Supadata API）
- ✅ 支持 `segments` 数组格式（reel-ai API）
- ✅ 正确转换时间戳格式（`start`/`end` 转 `start`/`duration`）

**关键代码**:
```typescript
// 优先处理新 Supadata API 的 chunks 格式
if (platform === 'tiktok' && Array.isArray(rawResponse.chunks) && rawResponse.chunks.length > 0) {
  const segments = rawResponse.chunks.map((chunk: any) => ({
    start: chunk.start || chunk.startTime || 0,
    duration: (chunk.end || chunk.endTime || 0) - (chunk.start || chunk.startTime || 0),
    text: chunk.text || chunk.transcript || '',
  }));
  return SubtitleFormatter.jsonToSRT(segments);
}
```

### 3. 更新 Paid API 支持新 Supadata API

**文件**: `src/extensions/media/rapidapi.ts`

**修复点**:
- ✅ 将 `tiktok-transcripts.p.rapidapi.com` 设为默认备选 Host
- ✅ 添加 Supadata API 的 GET 请求支持
- ✅ 正确处理 Supadata API 的响应格式

**关键代码**:
```typescript
// 检测 Supadata API
const isSupadataAPI = host.includes('tiktok-transcripts.p.rapidapi.com');

if (isSupadataAPI) {
  // GET /transcript?url=...&chunkSize=500&text=false
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
}
```

### 4. 创建测试脚本

**文件**: `scripts/test-tiktok-transcript-api.ts`

**功能**:
- 测试 Supadata API 的 GET 请求
- 验证响应解析（`content` 字段和 `chunks` 数组）
- 测试 SRT 转换功能

**使用方法**:
```bash
pnpm tsx scripts/test-tiktok-transcript-api.ts "https://vm.tiktok.com/ZNdfSseUr"
```

## API 配置

### 环境变量配置

确保 `.env.local` 中包含：

```env
# TikTok 字幕提取 API Host - 主配置（推荐：免费）
RAPIDAPI_TIKTOK_TRANSCRIPT_PRIMARY_HOST=tiktok-transcripts.p.rapidapi.com
RAPIDAPI_TIKTOK_TRANSCRIPT_BACKUP_HOST=tiktok-reel-ai-transcript-extractor.p.rapidapi.com

# RapidAPI API Key
NEXT_PUBLIC_RAPIDAPI_KEY=your-rapidapi-key
```

### API 端点信息

**Supadata TikTok Transcript API**:
- **Host**: `tiktok-transcripts.p.rapidapi.com`
- **Method**: `GET`
- **Endpoint**: `/transcript`
- **Parameters**:
  - `url` (required): TikTok video URL
  - `chunkSize` (optional): Maximum characters per chunk (default: 500)
  - `text` (optional): Return plain text (default: false)
- **Headers**:
  - `x-rapidapi-key`: Your RapidAPI key
  - `x-rapidapi-host`: `tiktok-transcripts.p.rapidapi.com`

**响应格式**:
```json
{
  "content": {
    "transcript": "Full transcript text...",
    "chunks": [
      {
        "start": 0.0,
        "end": 2.46,
        "text": "Chunk text..."
      }
    ]
  }
}
```

或直接格式：
```json
{
  "transcript": "Full transcript text...",
  "chunks": [...]
}
```

## 测试步骤

1. **配置环境变量**:
   ```bash
   # 确保 .env.local 中包含 RAPIDAPI_KEY
   NEXT_PUBLIC_RAPIDAPI_KEY=your-key-here
   ```

2. **运行测试脚本**:
   ```bash
   pnpm tsx scripts/test-tiktok-transcript-api.ts "https://vm.tiktok.com/ZNdfSseUr"
   ```

3. **前端测试**:
   - 访问 `http://localhost:3000/ai-media-extractor`
   - 提交 TikTok URL
   - 等待提取完成
   - 检查字幕是否正确显示

## 预期结果

修复后，系统应该能够：

1. ✅ 正确调用 Supadata API (`tiktok-transcripts.p.rapidapi.com`)
2. ✅ 正确解析响应（支持 `content` 字段和 `chunks` 数组）
3. ✅ 将 `chunks` 数组转换为标准 SRT 格式
4. ✅ 在 Free API 失败时，Paid API 也能使用 Supadata API 作为备选

## 注意事项

1. **URL 清理**: 系统会自动清理 TikTok URL，移除查询参数（如 `?is_from_webapp=1`）
2. **超时设置**: Free API 超时为 15 秒，Paid API 超时为 20 秒（reel-ai API 为 60 秒）
3. **错误处理**: 如果两个 API 都失败，系统会自动退款并返回错误信息

## 相关文件

- `src/extensions/media/rapidapi.ts` - 主要修复文件
- `src/extensions/media/subtitle-formatter.ts` - SRT 转换工具
- `scripts/test-tiktok-transcript-api.ts` - 测试脚本
- `env.example.txt` - 环境变量配置示例

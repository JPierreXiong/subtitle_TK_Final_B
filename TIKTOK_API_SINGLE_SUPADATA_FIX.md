# TikTok 字幕提取 API 单一化修复

## 问题分析

用户报告 TikTok 字幕提取仍然失败：
- Free API 失败: `NO_TRANSCRIPT`
- Paid API 失败: `HTTP 404: Not Found`

用户要求：
1. **屏蔽旧的 Free API 和 Paid API**
2. **只使用 Supadata API**: `tiktok-transcripts.p.rapidapi.com`

## 修复内容

### 1. 修改 `fetchTikTokMedia` 方法

**文件**: `src/extensions/media/rapidapi.ts`

**修复点**:
- ✅ 移除 Free API 和 Paid API 的 fallback 逻辑
- ✅ 直接使用 Supadata API (`fetchTikTokTranscriptSupadataAPI`)
- ✅ 自动清理 URL（移除查询参数）

**关键代码**:
```typescript
private async fetchTikTokMedia(url: string): Promise<NormalizedMediaData> {
  // 只使用 Supadata API (tiktok-transcripts.p.rapidapi.com)
  // 屏蔽旧的 Free API 和 Paid API
  console.log('[TikTok Transcript] Using Supadata API only (tiktok-transcripts.p.rapidapi.com)...');
  
  // Clean URL by removing query parameters
  const cleanedUrl = this.cleanTikTokUrl(url);
  
  // 直接调用 Supadata API
  const result = await this.fetchTikTokTranscriptSupadataAPI(cleanedUrl);
  
  if (!result.success || !result.transcriptData) {
    throw new Error(`Failed to fetch TikTok transcript: ${result.reason || result.message}`);
  }
  
  const transcriptData = result.transcriptData;
  const metadata = result.metadata || {};
  // ... 后续处理
}
```

### 2. 新增专用 Supadata API 方法

**文件**: `src/extensions/media/rapidapi.ts`

**方法**: `fetchTikTokTranscriptSupadataAPI`

**特点**:
- ✅ 强制使用 `tiktok-transcripts.p.rapidapi.com`
- ✅ GET 请求: `/transcript?url=...&chunkSize=500&text=false`
- ✅ 正确解析响应格式（支持 `content` 字段和 `chunks` 数组）
- ✅ 自动清理 URL（移除查询参数）

**API 请求格式**:
```typescript
// URL 清理
const cleanedUrl = this.cleanTikTokUrl(url); // 移除 ?is_from_webapp=1 等参数

// 构建请求
const encodedUrl = encodeURIComponent(cleanedUrl);
const apiUrl = `https://tiktok-transcripts.p.rapidapi.com/transcript?url=${encodedUrl}&chunkSize=500&text=false`;

// GET 请求
fetch(apiUrl, {
  method: 'GET',
  headers: {
    'x-rapidapi-key': this.configs.apiKey,
    'x-rapidapi-host': 'tiktok-transcripts.p.rapidapi.com',
  },
});
```

**响应解析**:
```typescript
// 支持两种响应格式：
// 1. { content: { transcript: "...", chunks: [...] } }
// 2. { transcript: "...", chunks: [...] }

const responseData = data.content || data;
const transcript = responseData.transcript || responseData.text || '';
const chunks = responseData.chunks || responseData.segments || [];

// 如果只有chunks没有transcript文本，从chunks中提取
if (!transcript && chunks.length > 0) {
  transcript = chunks.map((c: any) => c.text || '').join(' ').trim();
}
```

### 3. URL 清理逻辑

**方法**: `cleanTikTokUrl`

**功能**:
- 移除 URL 查询参数（如 `?is_from_webapp=1&sender_device=pc`）
- 确保 API 接收到干净的 URL

**示例**:
```
输入: https://vm.tiktok.com/ZNdfSseUr?is_from_webapp=1&sender_device=pc
输出: https://vm.tiktok.com/ZNdfSseUr
```

## API 配置

### 环境变量

确保 `.env.local` 中包含：

```env
# RapidAPI API Key
NEXT_PUBLIC_RAPIDAPI_KEY=your-rapidapi-key

# TikTok 字幕提取 API Host（已不再使用，但保留用于兼容）
RAPIDAPI_TIKTOK_TRANSCRIPT_PRIMARY_HOST=tiktok-transcripts.p.rapidapi.com
```

**注意**: 代码中已硬编码使用 `tiktok-transcripts.p.rapidapi.com`，不再依赖环境变量。

### API 端点信息

**Supadata TikTok Transcript API**:
- **Host**: `tiktok-transcripts.p.rapidapi.com` (硬编码)
- **Method**: `GET`
- **Endpoint**: `/transcript`
- **Query Parameters**:
  - `url` (required): TikTok video URL (已清理，无查询参数)
  - `chunkSize` (optional): 500 (默认)
  - `text` (optional): false (默认，返回 chunks 数组)
- **Headers**:
  - `x-rapidapi-key`: Your RapidAPI key
  - `x-rapidapi-host`: `tiktok-transcripts.p.rapidapi.com`

**cURL 示例**:
```bash
curl --request GET \
  --url 'https://tiktok-transcripts.p.rapidapi.com/transcript?url=https%3A%2F%2Fvm.tiktok.com%2FZNdfSseUr&chunkSize=500&text=false' \
  --header 'x-rapidapi-host: tiktok-transcripts.p.rapidapi.com' \
  --header 'x-rapidapi-key: YOUR_API_KEY'
```

## 响应格式

### 成功响应

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
  "chunks": [
    {
      "start": 0.0,
      "end": 2.46,
      "text": "Chunk text..."
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
   - 提交 TikTok URL: `https://vm.tiktok.com/ZNdfSseUr`
   - 等待提取完成
   - 检查字幕是否正确显示（SRT 格式）

## 预期结果

修复后，系统应该能够：

1. ✅ **只使用 Supadata API**，不再尝试 Free/Paid API
2. ✅ **自动清理 URL**，移除查询参数
3. ✅ **正确解析响应**（支持 `content` 字段和 `chunks` 数组）
4. ✅ **将 `chunks` 数组转换为标准 SRT 格式**
5. ✅ **提供清晰的错误信息**（如果 API 失败）

## 已屏蔽的 API

以下 API 已被屏蔽，不再使用：

1. **Free API** (`fetchTikTokTranscriptFreeAPI`):
   - 旧逻辑：尝试多个 API Host
   - 状态：已屏蔽，不再调用

2. **Paid API** (`fetchTikTokTranscriptPaidAPI`):
   - 旧逻辑：包括 reel-ai API 等
   - 状态：已屏蔽，不再调用

## 注意事项

1. **URL 清理**: 系统会自动清理 TikTok URL，移除所有查询参数
2. **超时设置**: API 超时设置为 20 秒
3. **错误处理**: 如果 API 失败，系统会返回清晰的错误信息
4. **SRT 转换**: `chunks` 数组会自动转换为标准 SRT 格式

## 相关文件

- `src/extensions/media/rapidapi.ts` - 主要修复文件
  - `fetchTikTokMedia` - 修改为只使用 Supadata API
  - `fetchTikTokTranscriptSupadataAPI` - 新增专用方法
  - `cleanTikTokUrl` - URL 清理工具
- `scripts/test-tiktok-transcript-api.ts` - 测试脚本
- `env.example.txt` - 环境变量配置示例

## 修复前后对比

| 特性 | 修复前 | 修复后 |
|------|--------|--------|
| API 数量 | 2个（Free + Paid） | 1个（Supadata） |
| Fallback 逻辑 | ✅ 有 | ❌ 无 |
| URL 清理 | ⚠️ 部分 | ✅ 完整 |
| 错误信息 | 复杂（多个 API） | 清晰（单一 API） |
| 代码复杂度 | 高 | 低 |

## 总结

通过这次修复：
- ✅ **简化了代码逻辑**：只使用一个 API
- ✅ **提高了成功率**：使用经过验证的 Supadata API
- ✅ **改善了错误处理**：清晰的错误信息
- ✅ **保持了兼容性**：SRT 格式转换逻辑不变

现在系统只使用 Supadata API (`tiktok-transcripts.p.rapidapi.com`)，不再尝试其他 API，确保稳定性和可预测性。

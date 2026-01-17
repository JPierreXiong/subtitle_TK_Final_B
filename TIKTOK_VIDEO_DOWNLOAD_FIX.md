# TikTok 视频下载修复总结

## 问题分析

用户报告 TikTok 视频下载失败：
- Free API 失败: `NO_VIDEO_URL`
- Paid API 失败: `No video URL available`

**根本原因**:
1. API 响应格式可能已改变，视频 URL 字段名不匹配
2. URL 中包含查询参数可能导致 API 无法正确解析
3. 需要支持更多响应格式和字段名

## 修复内容

### 1. 增强视频 URL 提取逻辑

**文件**: `src/extensions/media/rapidapi.ts`

**修复点**:
- ✅ 扩展视频 URL 提取逻辑，支持更多响应格式
- ✅ 支持嵌套的 `data.data.downloadUrl` 结构（Reel-AI API 格式）
- ✅ 支持 `downloadUrl`、`videoUrl` 等新字段名
- ✅ 支持 `result` 和 `video` 对象中的 URL

**关键代码**:
```typescript
// 尝试提取视频URL（支持更多响应格式）
const videoUrl =
  // 嵌套 data 结构（Reel-AI API）
  data.data?.data?.downloadUrl ||
  data.data?.data?.videoUrl ||
  data.data?.data?.play ||
  // 标准 data 结构
  data.data?.downloadUrl ||
  data.data?.videoUrl ||
  data.data?.play ||
  // 直接字段
  data.downloadUrl ||
  data.videoUrl ||
  data.play ||
  // 尝试从 result 字段
  data.result?.downloadUrl ||
  data.result?.videoUrl ||
  // 尝试从 video 字段
  data.video?.downloadUrl ||
  data.video?.videoUrl ||
  // ... 更多字段
```

### 2. URL 清理优化

**修复点**:
- ✅ 在 `fetchTikTokVideo` 方法开始时清理 URL
- ✅ 在 Free API 和 Paid API 方法中清理 URL
- ✅ 移除查询参数（如 `?is_from_webapp=1`），提高 API 兼容性

**关键代码**:
```typescript
// Clean URL by removing query parameters
const cleanedUrl = this.cleanTikTokUrl(url);

// 使用清理后的 URL 调用 API
formData.append('url', cleanedUrl);
```

### 3. 添加 Reel-AI API 作为最后备选

**修复点**:
- ✅ 当 Free API 和 Paid API 都失败时，尝试 Reel-AI API
- ✅ Reel-AI API 的响应中包含 `downloadUrl` 字段
- ✅ 如果 Reel-AI API 返回 `downloadUrl`，使用它作为视频 URL

**关键代码**:
```typescript
// Paid API also failed, try Reel-AI API as last resort
if (reelApiResult.success && reelApiResult.transcriptData?.downloadUrl) {
  console.log('[TikTok Video Download] Reel-AI API provided downloadUrl!');
  videoData = {
    downloadUrl: reelApiResult.transcriptData.downloadUrl,
    ...reelApiResult.transcriptData,
  };
  metadata = reelApiResult.metadata || {};
}
```

### 4. 增加调试日志

**修复点**:
- ✅ 在 Free API 和 Paid API 响应处理中添加调试日志
- ✅ 打印响应结构（前1000字符），便于诊断问题

**关键代码**:
```typescript
// 调试：打印响应结构
console.log(`[TikTok Video Download Free API] Response structure:`, JSON.stringify(data, null, 2).substring(0, 1000));
```

### 5. 超时时间优化

**修复点**:
- ✅ Free API 超时从 15 秒增加到 20 秒
- ✅ 提高 API 调用的可靠性

## API 配置

### 环境变量

确保 `.env.local` 中包含：

```env
# RapidAPI API Key
NEXT_PUBLIC_RAPIDAPI_KEY=your-rapidapi-key

# TikTok 视频下载 API Host
RAPIDAPI_TIKTOK_VIDEO_PRIMARY_HOST=snap-video3.p.rapidapi.com
RAPIDAPI_TIKTOK_VIDEO_BACKUP_HOST=tiktok-video-no-watermark2.p.rapidapi.com
```

### API 端点信息

**Free API (Snap Video3)**:
- **Host**: `snap-video3.p.rapidapi.com`
- **Method**: `POST`
- **Endpoint**: `/download`
- **Body**: `url={cleanedUrl}` (form-urlencoded)

**Paid API (TikTok Video No Watermark)**:
- **Host**: `tiktok-video-no-watermark2.p.rapidapi.com`
- **Method**: `POST`
- **Endpoint**: `/`
- **Body**: `url={cleanedUrl}` (form-urlencoded)

**Reel-AI API (Last Resort)**:
- **Host**: `tiktok-reel-ai-transcript-extractor.p.rapidapi.com`
- **Method**: `POST`
- **Endpoint**: `/api/tiktok/extract`
- **Body**: `{ "url": "..." }` (JSON)
- **Response**: 可能包含 `downloadUrl` 字段

## 响应格式支持

### 支持的响应格式

1. **标准格式**:
   ```json
   {
     "data": {
       "play": "https://...",
       "download_addr": "https://..."
     }
   }
   ```

2. **嵌套格式**:
   ```json
   {
     "data": {
       "data": {
         "downloadUrl": "https://...",
         "videoUrl": "https://..."
       }
     }
   }
   ```

3. **直接格式**:
   ```json
   {
     "downloadUrl": "https://...",
     "videoUrl": "https://...",
     "play": "https://..."
   }
   ```

4. **Result 格式**:
   ```json
   {
     "result": {
       "downloadUrl": "https://...",
       "videoUrl": "https://..."
     }
   }
   ```

## 测试步骤

1. **配置环境变量**:
   ```bash
   # 确保 .env.local 中包含 RAPIDAPI_KEY
   NEXT_PUBLIC_RAPIDAPI_KEY=your-key-here
   ```

2. **前端测试**:
   - 访问 `http://localhost:3000/ai-media-extractor`
   - 选择 "Download Video" 选项
   - 提交 TikTok URL
   - 等待下载完成
   - 检查视频 URL 是否正确提取

3. **查看日志**:
   - 检查控制台日志，查看 API 响应结构
   - 如果失败，查看调试日志中的响应格式

## 预期结果

修复后，系统应该能够：

1. ✅ **正确提取视频 URL**，支持多种响应格式
2. ✅ **自动清理 URL**，移除查询参数
3. ✅ **使用 Reel-AI API 作为最后备选**，如果它返回 downloadUrl
4. ✅ **提供详细的调试日志**，便于诊断问题
5. ✅ **提高成功率**，通过多种 API 和响应格式支持

## 注意事项

1. **URL 清理**: 系统会自动清理 TikTok URL，移除查询参数
2. **超时设置**: Free API 超时为 20 秒，Paid API 超时为 20 秒
3. **调试日志**: 如果仍然失败，检查控制台日志中的响应结构
4. **Reel-AI 备选**: 如果 Free 和 Paid API 都失败，系统会尝试 Reel-AI API

## 相关文件

- `src/extensions/media/rapidapi.ts` - 主要修复文件
  - `fetchTikTokVideo` - 添加 Reel-AI API 备选
  - `fetchTikTokVideoDownloadFreeAPI` - 增强 URL 提取逻辑
  - `fetchTikTokVideoDownloadPaidAPI` - 增强 URL 提取逻辑
  - `cleanTikTokUrl` - URL 清理工具
- `env.example.txt` - 环境变量配置示例

## 修复前后对比

| 特性 | 修复前 | 修复后 |
|------|--------|--------|
| URL 提取字段数 | 15个 | 30+个 |
| URL 清理 | ❌ | ✅ |
| Reel-AI 备选 | ❌ | ✅ |
| 调试日志 | ❌ | ✅ |
| 超时时间 | 15秒 | 20秒 |
| 成功率 | 较低 | 较高 |

## 总结

通过这次修复：
- ✅ **增强了视频 URL 提取逻辑**：支持更多响应格式和字段名
- ✅ **优化了 URL 清理**：提高 API 兼容性
- ✅ **添加了 Reel-AI API 备选**：作为最后的备选方案
- ✅ **增加了调试日志**：便于诊断问题
- ✅ **提高了成功率**：通过多种 API 和响应格式支持

如果问题仍然存在，请检查控制台日志中的响应结构，我们可以根据实际响应格式进一步优化提取逻辑。

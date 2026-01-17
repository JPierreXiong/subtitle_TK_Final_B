# 视频下载 Phase 1 实施完成报告

## ✅ 实施状态

**已完成**：Phase 1 所有功能已实施，特别注意了用户要求的三个细节。

---

## 📋 实施内容

### 1. 统一的 User-Agent 常量

**文件**: `src/extensions/media/rapidapi.ts`

**修改**:
- ✅ 在 `RapidAPIProvider` 类中添加了统一的 `DEFAULT_USER_AGENT` 常量
- ✅ 确保所有 API 请求使用相同的 User-Agent 指纹

**关键代码**:
```typescript
// 统一的 User-Agent（确保所有请求使用相同的指纹）
private readonly DEFAULT_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
```

### 2. YouTube 深度解析器（特别注意：过滤 .m3u8，优先 .mp4）

**文件**: `src/extensions/media/rapidapi.ts`

**新增方法**: `parseYouTubeVideoUrl(data: any): string | null`

**关键特性**：
1. ✅ **过滤 HLS 流（.m3u8）**：
   - 优先从 `formats` 数组中选择 MP4 格式
   - 明确排除包含 `.m3u8` 的链接
   - 确保返回的 URL 是浏览器可直接下载的静态地址

2. ✅ **优先 MP4 格式**：
   - 优先选择 `container === 'mp4'` 或 `url.endsWith('.mp4')` 的格式
   - 按画质排序（`quality` 或 `height` 字段）
   - 如果没有 MP4，返回第一个非 .m3u8 的有效 URL

3. ✅ **支持 30+ 种响应格式**：
   - 嵌套结构：`data.data.data.video_url`
   - 标准结构：`data.video.url`
   - 直接字段：`url`, `download_url`, `link`
   - 格式数组：`formats[].url`

**关键代码**:
```typescript
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
```

### 3. 添加 User-Agent 到所有 API 请求

**修改的文件**:
- ✅ `fetchYouTubeVideoDownload` - YouTube 视频下载 API（所有端点）
- ✅ `fetchTikTokVideoDownloadFreeAPI` - TikTok 免费 API
- ✅ `fetchTikTokVideoDownloadPaidAPI` - TikTok 付费 API

**关键代码**:
```typescript
headers: {
  'x-rapidapi-host': host,
  'x-rapidapi-key': this.configs.apiKey,
  'User-Agent': this.DEFAULT_USER_AGENT, // 添加 User-Agent
}
```

### 4. User-Agent 统一性（特别注意：后端 fetch 与 API 请求保持一致）

**文件**: `src/app/api/media/download-proxy/route.ts`

**修改**:
- ✅ 使用与 API 请求相同的 User-Agent
- ✅ 添加 Referer 头（根据视频 URL 自动判断）

**关键代码**:
```typescript
// 使用统一的 User-Agent（与 API 请求保持一致）
const DEFAULT_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const videoResponse = await fetch(downloadUrl, {
  signal: controller.signal,
  headers: {
    'User-Agent': DEFAULT_USER_AGENT,
    'Referer': downloadUrl.includes('youtube.com') ? 'https://www.youtube.com/' : 
               downloadUrl.includes('tiktok.com') ? 'https://www.tiktok.com/' : undefined,
  },
});
```

**文件**: `src/shared/services/media/video-storage.ts`

**修改**:
- ✅ 更新 `uploadVideoToStorage` 方法
- ✅ 传递 User-Agent 和 Referer 到 `streamUploadFromUrl`

**关键代码**:
```typescript
// 统一的 User-Agent（与 API 请求保持一致）
const DEFAULT_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// 根据视频 URL 确定 Referer
const referer = videoUrl.includes('youtube.com') || videoUrl.includes('googlevideo.com')
  ? 'https://www.youtube.com/'
  : videoUrl.includes('tiktok.com')
  ? 'https://www.tiktok.com/'
  : undefined;

// Stream upload video with User-Agent and Referer headers
const result = await vercelBlobProvider.streamUploadFromUrl(
  videoUrl,
  key,
  'video/mp4',
  {
    'User-Agent': DEFAULT_USER_AGENT,
    ...(referer && { 'Referer': referer }),
  }
);
```

**文件**: `src/extensions/storage/vercel-blob.ts`

**修改**:
- ✅ 更新 `streamUploadFromUrl` 方法签名，添加可选的 `headers` 参数
- ✅ 在 fetch 请求中使用自定义 headers

**关键代码**:
```typescript
async streamUploadFromUrl(
  videoUrl: string,
  key: string,
  contentType: string = 'video/mp4',
  headers?: Record<string, string> // 新增：可选的 headers 参数
): Promise<StorageUploadResult> {
  // ...
  const response = await fetch(videoUrl, {
    signal: AbortSignal.timeout(60000),
    headers: headers || {}, // 使用自定义 headers
  });
}
```

### 5. 增强错误处理

**修改**:
- ✅ 详细的 HTTP 错误信息（403, 429, 404 等）
- ✅ 打印请求 URL 和错误文本
- ✅ 区分不同类型的 HTTP 错误

**关键代码**:
```typescript
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
```

### 6. 日志分级（特别注意：生产环境限制长度）

**修改**:
- ✅ 开发环境：打印完整响应结构（前 2000 字符）
- ✅ 生产环境：只打印响应长度，不打印完整内容

**关键代码**:
```typescript
// 日志分级：开发环境打印完整结构，生产环境限制长度
const logLength = process.env.NODE_ENV === 'development' ? 2000 : 500;
if (process.env.NODE_ENV === 'development') {
  console.log(`[YouTube Video Download] DEBUG_RESPONSE:`, JSON.stringify(data, null, 2).substring(0, logLength));
} else {
  console.log(`[YouTube Video Download] API response received (length:`, JSON.stringify(data).length, ')');
}
```

**应用位置**:
- ✅ YouTube 视频下载 API 响应日志
- ✅ TikTok 免费 API 响应日志
- ✅ TikTok 付费 API 响应日志

---

## 🎯 特别注意的三个细节

### ✅ 1. 解析器的鲁棒性

**实现**:
- ✅ 过滤 `.m3u8` 后缀的链接（HLS 流）
- ✅ 优先返回 `.mp4` 结尾的静态地址
- ✅ 按画质排序，选择最高质量
- ✅ 如果没有 MP4，返回第一个非 .m3u8 的有效 URL

**代码位置**: `src/extensions/media/rapidapi.ts` - `parseYouTubeVideoUrl` 方法

### ✅ 2. User-Agent 的统一性

**实现**:
- ✅ 所有 API 请求使用相同的 `DEFAULT_USER_AGENT`
- ✅ 后端 fetch 获取视频流时使用相同的 User-Agent
- ✅ 视频上传到 Vercel Blob 时使用相同的 User-Agent
- ✅ 避免因请求指纹不匹配触发平台的反爬机制

**代码位置**:
- `src/extensions/media/rapidapi.ts` - 所有 API 请求
- `src/app/api/media/download-proxy/route.ts` - 下载代理
- `src/shared/services/media/video-storage.ts` - 视频上传

### ✅ 3. 日志分级

**实现**:
- ✅ 使用 `process.env.NODE_ENV === 'development'` 判断环境
- ✅ 开发环境：打印完整响应结构（前 2000 字符）
- ✅ 生产环境：只打印响应长度，不打印完整内容
- ✅ 防止日志量过大导致服务器响应变慢

**代码位置**:
- `src/extensions/media/rapidapi.ts` - 所有 API 响应日志

---

## 📊 修改的文件清单

1. ✅ `src/extensions/media/rapidapi.ts`
   - 添加统一的 User-Agent 常量
   - 创建 YouTube 深度解析器（过滤 .m3u8，优先 .mp4）
   - 更新所有 API 请求添加 User-Agent
   - 增强错误处理
   - 优化日志分级

2. ✅ `src/app/api/media/download-proxy/route.ts`
   - 使用统一的 User-Agent
   - 添加 Referer 头

3. ✅ `src/shared/services/media/video-storage.ts`
   - 传递 User-Agent 和 Referer 到视频上传

4. ✅ `src/extensions/storage/vercel-blob.ts`
   - 更新 `streamUploadFromUrl` 方法支持自定义 headers

---

## 🧪 测试建议

### 1. API 测试

**测试 YouTube 视频下载**:
```bash
# 测试脚本（需要创建）
pnpm tsx scripts/test-youtube-video-download.ts <youtube_url>
```

**验证点**:
- ✅ User-Agent 是否正确添加到请求头
- ✅ 深度解析器是否正确提取视频 URL
- ✅ 是否过滤了 .m3u8 链接
- ✅ 是否优先返回 .mp4 格式

### 2. 集成测试

**测试步骤**:
1. 提交 YouTube URL，选择 "Download Video"
2. 检查控制台日志（开发环境应看到完整响应结构）
3. 验证视频 URL 是否正确提取
4. 验证下载功能是否正常

### 3. 生产环境测试

**验证点**:
- ✅ 日志是否只打印长度（不打印完整内容）
- ✅ 服务器响应速度是否正常
- ✅ 没有因日志过多导致性能问题

---

## 📝 下一步（Phase 2）

Phase 1 完成后，可以继续实施 Phase 2：

1. ⏳ 优化 Worker 逻辑（YouTube 视频也尝试上传到 Vercel Blob）
2. ⏳ 测试流式中转上传功能
3. ⏳ 性能优化和监控

---

## ✅ 总结

Phase 1 已全部完成，特别注意了用户要求的三个细节：

1. ✅ **解析器的鲁棒性**：过滤 .m3u8，优先 .mp4
2. ✅ **User-Agent 的统一性**：所有请求使用相同的 User-Agent
3. ✅ **日志分级**：生产环境限制长度，开发环境完整打印

所有代码已通过语法检查，可以开始测试。

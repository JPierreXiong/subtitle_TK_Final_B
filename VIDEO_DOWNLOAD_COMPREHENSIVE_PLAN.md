# TikTok & YouTube 视频下载全盘优化方案

## 📋 当前状态分析

### 1. 现有功能检查

#### ✅ 已实现的功能

1. **TikTok 视频下载**：
   - ✅ 免费 API + 付费 API 降级策略
   - ✅ 深度解析器 `parseTikTokVideoUrl`（支持 40+ 种响应格式）
   - ✅ URL 清理（移除查询参数）
   - ✅ 调试日志（打印完整响应结构）

2. **YouTube 视频下载**：
   - ✅ 主 API + 备选 API 降级策略
   - ✅ 多端点尝试（GET/POST）
   - ✅ 基础响应解析（支持多种格式）
   - ⚠️ **缺少深度解析器**（类似 TikTok）

3. **下载代理**：
   - ✅ `/api/media/download-proxy` 路由
   - ✅ User-Agent 伪装
   - ✅ 流式传输
   - ⚠️ **未实现流式中转上传到 Vercel Blob**

4. **Worker 处理**：
   - ✅ TikTok 视频：尝试上传到 Vercel Blob
   - ✅ YouTube 视频：直接使用原始 URL（2小时过期）

### 2. 发现的问题

#### 🔴 关键问题

1. **YouTube API 请求缺少 User-Agent**：
   - 可能导致 403 Forbidden
   - 需要添加浏览器 User-Agent 头

2. **YouTube 响应解析不够深入**：
   - 没有类似 TikTok 的深度解析器
   - 可能遗漏某些响应格式

3. **视频 URL 过期问题**：
   - YouTube 原始 URL 2小时过期
   - 用户浏览器直接访问可能 403
   - 需要流式中转上传到 Vercel Blob

4. **错误处理不够详细**：
   - HTTP_ERROR 没有详细的错误信息
   - 缺少响应结构调试日志

## 🎯 优化方案

### 方案 1：增强 API 请求（立即实施）

#### 1.1 添加 User-Agent 到所有 API 请求

**文件**: `src/extensions/media/rapidapi.ts`

**修改**:
- 为所有 YouTube API 请求添加 User-Agent
- 为所有 TikTok API 请求添加 User-Agent（如果还没有）
- 使用真实的浏览器 User-Agent 字符串

**关键代码**:
```typescript
const DEFAULT_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// 在 fetchYouTubeVideoDownload 中添加
headers: {
  'x-rapidapi-host': host,
  'x-rapidapi-key': this.configs.apiKey,
  'User-Agent': DEFAULT_USER_AGENT, // 新增
}
```

#### 1.2 创建 YouTube 深度解析器

**文件**: `src/extensions/media/rapidapi.ts`

**新增方法**: `parseYouTubeVideoUrl(data: any): string | null`

**功能**：
- 深度扫描所有可能的视频地址字段
- 支持 30+ 种响应格式
- 优先选择 MP4 格式的最高画质
- 自动验证 URL 有效性

**关键特性**：
1. **格式数组支持**：
   - 从 `formats` 数组中提取视频 URL
   - 优先选择 MP4 格式（`container === 'mp4'` 或 `ext === 'mp4'`）
   - 按画质排序（`quality` 字段）

2. **嵌套结构支持**：
   - `data.data.video_url`
   - `data.video.url`
   - `data.download_url`
   - 等 20+ 种路径

3. **直接字段支持**：
   - `url`
   - `download_url`
   - `link`
   - `download`
   - 等 10+ 种字段

### 方案 2：流式中转上传（核心优化）

#### 2.1 优化 Worker 逻辑

**文件**: `src/app/api/media/worker/route.ts`

**修改**:
- 对于 YouTube 视频，也尝试上传到 Vercel Blob
- 使用异步上传（不阻塞 Worker）
- 如果上传失败，回退到原始 URL

**关键代码**:
```typescript
if (outputType === 'video' && mediaData.videoUrl) {
  // 立即更新数据库，不等待上传
  await updateMediaTaskById(taskId, {
    status: 'downloading',
    videoUrl: mediaData.videoUrl,
    progress: 50,
  });
  
  // 异步上传到 Vercel Blob（不 await）
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    (async () => {
      try {
        const storageIdentifier = await uploadVideoToStorage(mediaData.videoUrl);
        if (storageIdentifier) {
          await updateMediaTaskById(taskId, {
            videoUrlInternal: storageIdentifier,
            status: 'extracted',
            progress: 100,
          });
        } else {
          // 上传失败，使用原始 URL
          await updateMediaTaskById(taskId, {
            videoUrlInternal: `original:${mediaData.videoUrl}`,
            status: 'extracted',
            progress: 100,
          });
        }
      } catch (error) {
        // 上传失败，使用原始 URL
        await updateMediaTaskById(taskId, {
          videoUrlInternal: `original:${mediaData.videoUrl}`,
          status: 'extracted',
          progress: 100,
        });
      }
    })();
  } else {
    // 没有配置 Blob，直接使用原始 URL
    await updateMediaTaskById(taskId, {
      videoUrlInternal: `original:${mediaData.videoUrl}`,
      status: 'extracted',
      progress: 100,
    });
  }
  
  // Worker 立即返回（不等待上传完成）
  return Response.json({ success: true });
}
```

#### 2.2 优化视频存储服务

**文件**: `src/shared/services/media/video-storage.ts`

**修改**:
- 增强 `uploadVideoToStorage` 方法
- 添加 User-Agent 到视频流请求
- 添加 Referer 头（如果需要）
- 增加重试逻辑

**关键代码**:
```typescript
export async function uploadVideoToStorage(
  videoUrl: string
): Promise<string | null> {
  const storageService = await getStorageService();
  const vercelBlobProvider = storageService.getProvider('vercel-blob') as VercelBlobProvider;
  
  if (vercelBlobProvider) {
    try {
      const key = `videos/${nanoid()}-${Date.now()}.mp4`;
      
      // 使用增强的流式上传（添加 User-Agent）
      const result = await vercelBlobProvider.streamUploadFromUrl(
        videoUrl,
        key,
        'video/mp4',
        {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Referer': videoUrl.includes('youtube.com') ? 'https://www.youtube.com/' : 'https://www.tiktok.com/',
          },
        }
      );
      
      if (result.success && result.url) {
        return `vercel-blob:${result.url}`;
      }
    } catch (error: any) {
      console.warn('Vercel Blob upload error:', error.message);
    }
  }
  
  return null;
}
```

### 方案 3：增强错误处理和调试

#### 3.1 增强 HTTP 错误处理

**文件**: `src/extensions/media/rapidapi.ts`

**修改**:
- 为所有 API 请求添加详细的错误日志
- 打印响应状态码和错误文本
- 区分不同类型的 HTTP 错误（403, 429, 404 等）

**关键代码**:
```typescript
if (!response.ok) {
  const errorText = await response.text().catch(() => 'Unknown error');
  console.error(`[YouTube Video Download] HTTP Error:`, {
    status: response.status,
    statusText: response.statusText,
    url: apiUrl,
    errorText: errorText.substring(0, 500),
  });
  
  if (response.status === 403) {
    throw new Error('HTTP_ERROR_403: Forbidden (可能缺少 User-Agent 或 API 权限不足)');
  }
  if (response.status === 429) {
    throw new Error('HTTP_ERROR_429: Rate limit exceeded');
  }
  if (response.status === 404) {
    throw new Error('HTTP_ERROR_404: Endpoint not found (请检查 API 路径)');
  }
  
  throw new Error(`HTTP_ERROR_${response.status}: ${response.statusText}`);
}
```

#### 3.2 增强调试日志

**文件**: `src/extensions/media/rapidapi.ts`

**修改**:
- 为 YouTube API 添加完整的响应结构日志
- 打印请求 URL 和参数
- 打印解析后的视频 URL

**关键代码**:
```typescript
const data = await response.json();

// 调试：打印完整响应结构（前2000字符）
console.log(`[YouTube Video Download] DEBUG_RESPONSE:`, JSON.stringify(data, null, 2).substring(0, 2000));

// 使用深度解析器提取视频 URL
const videoUrl = this.parseYouTubeVideoUrl(data);

console.log(`[YouTube Video Download] Parsed video URL:`, videoUrl ? videoUrl.substring(0, 100) + '...' : 'null');
```

## 📊 实施优先级

### Phase 1: 立即实施（解决 HTTP_ERROR）

1. ✅ **添加 User-Agent 到所有 API 请求**
   - YouTube API 请求
   - TikTok API 请求（如果还没有）

2. ✅ **创建 YouTube 深度解析器**
   - 实现 `parseYouTubeVideoUrl` 方法
   - 更新 `fetchYouTubeVideo` 使用深度解析器

3. ✅ **增强错误处理和调试日志**
   - 详细的 HTTP 错误信息
   - 完整的响应结构日志

### Phase 2: 核心优化（解决下载问题）

1. ⏳ **优化 Worker 逻辑**
   - YouTube 视频也尝试上传到 Vercel Blob
   - 异步上传，不阻塞 Worker

2. ⏳ **优化视频存储服务**
   - 增强 `uploadVideoToStorage` 方法
   - 添加 User-Agent 和 Referer 头

### Phase 3: 后续优化（可选）

1. ⏳ **添加重试逻辑**
   - 对于临时性错误（429, 503）自动重试

2. ⏳ **添加缓存机制**
   - 缓存已下载的视频 URL
   - 减少重复 API 调用

## 🔍 测试计划

### 1. API 测试

**测试脚本**: `scripts/test-youtube-video-download.ts`

**测试内容**:
- 测试主 API 和备选 API
- 验证 User-Agent 是否生效
- 验证深度解析器是否正确提取视频 URL
- 打印完整的响应结构

### 2. 集成测试

**测试步骤**:
1. 提交 YouTube URL，选择 "Download Video"
2. 验证 Worker 快速返回（< 10秒）
3. 验证数据库状态更新
4. 验证视频 URL 是否正确提取
5. 验证下载功能是否正常

### 3. 错误场景测试

**测试内容**:
- 测试无效的 YouTube URL
- 测试私有视频
- 测试已删除的视频
- 测试 API 限流（429）
- 测试 API 权限不足（403）

## 📝 实施清单

### Phase 1 清单

- [ ] 添加 User-Agent 常量定义
- [ ] 更新 `fetchYouTubeVideoDownload` 添加 User-Agent
- [ ] 更新 `fetchTikTokVideoDownloadFreeAPI` 添加 User-Agent（如果还没有）
- [ ] 更新 `fetchTikTokVideoDownloadPaidAPI` 添加 User-Agent（如果还没有）
- [ ] 创建 `parseYouTubeVideoUrl` 方法
- [ ] 更新 `fetchYouTubeVideo` 使用深度解析器
- [ ] 增强 HTTP 错误处理
- [ ] 添加调试日志

### Phase 2 清单

- [ ] 更新 Worker 逻辑（YouTube 视频也尝试上传）
- [ ] 优化 `uploadVideoToStorage` 方法
- [ ] 添加 User-Agent 和 Referer 头到视频流请求
- [ ] 测试流式中转上传功能

## ⚠️ 注意事项

1. **不改变 ShipAny 结构**：
   - 所有修改都在现有文件内部
   - 不改变对外接口
   - 不改变数据库结构

2. **向后兼容**：
   - 保持现有功能正常工作
   - 新功能作为增强，不影响旧功能

3. **性能考虑**：
   - Worker 必须快速返回（< 10秒）
   - 使用异步上传，不阻塞 Worker
   - 视频上传在后台进行

4. **成本考虑**：
   - Vercel Blob 存储有成本
   - 可以考虑只对 TikTok 视频上传（YouTube 视频较大）
   - 或者设置过期时间（24小时）

## 🎯 预期效果

### 修复后

1. ✅ **解决 HTTP_ERROR**：
   - 添加 User-Agent 后，403 错误应该减少
   - 详细的错误信息便于诊断

2. ✅ **提高视频 URL 提取成功率**：
   - 深度解析器支持更多响应格式
   - 减少 `NO_VIDEO_URL` 错误

3. ✅ **解决下载问题**：
   - 流式中转上传到 Vercel Blob
   - 用户获得永久有效的下载链接
   - 避免原始 URL 过期或 403 错误

4. ✅ **更好的调试能力**：
   - 完整的响应结构日志
   - 详细的错误信息
   - 便于快速定位问题

## 📌 下一步行动

**请批准此方案后，我将立即开始实施 Phase 1**：

1. 添加 User-Agent 到所有 API 请求
2. 创建 YouTube 深度解析器
3. 增强错误处理和调试日志

**Phase 2 将在 Phase 1 测试通过后实施**。

---

**需要我现在开始实施 Phase 1 吗？**

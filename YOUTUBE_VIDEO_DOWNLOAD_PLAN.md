# YouTube 视频下载功能激活方案

## 需求分析

1. **激活 YouTube 视频下载功能**
2. **支持两个 API**：
   - `youtube-video-and-shorts-downloader1.p.rapidapi.com` (主 API)
   - `cloud-api-hub-youtube-downloader.p.rapidapi.com` (备选 API)
3. **时间管理**：视频下载需要 3-5 分钟甚至更长
4. **下载方式**：提供 URL 或直接点击下载
5. **不改变 ShipAny 结构**

## 当前架构分析

### 现有流程

1. **提交任务** (`/api/media/submit`):
   - 用户提交 YouTube URL
   - 创建 `media_tasks` 记录
   - 通过 QStash 触发 Worker

2. **Worker 处理** (`/api/media/worker`):
   - 调用 `fetchMediaFromRapidAPI()`
   - 根据 `outputType` 决定调用字幕提取或视频下载
   - 更新数据库状态

3. **视频存储**:
   - 如果配置了 Vercel Blob，上传视频
   - 否则使用原始 URL

### 问题点

1. **超时问题**：
   - Vercel Serverless Function 默认超时 10 秒（Hobby 计划）
   - Pro 计划可以到 60 秒
   - 但视频下载需要 3-5 分钟

2. **API 响应格式**：
   - 需要正确解析两个 API 的响应格式
   - 提取视频下载 URL

## 解决方案

### 方案 1：异步处理 + 状态更新（推荐）

**核心思路**：
- Worker 立即返回，不等待视频下载完成
- 使用 QStash 延迟重试机制
- 通过 Supabase Realtime 更新状态

**流程**：

```
1. 用户提交任务
   ↓
2. Worker 调用 API 获取视频 URL（快速，< 10秒）
   ↓
3. 如果 API 返回视频 URL：
   - 立即更新数据库：status = 'downloading', videoUrl = '...'
   - 如果配置了 Vercel Blob，启动异步上传任务
   - 返回成功（Worker 完成）
   ↓
4. 异步上传任务（如果启用）：
   - 使用 Vercel Blob 的 streamUploadFromUrl
   - 上传完成后更新 videoUrlInternal
   - 通过 Supabase Realtime 通知前端
   ↓
5. 前端实时显示下载进度
```

**优点**：
- ✅ 不改变 ShipAny 结构
- ✅ 利用现有的 QStash + Supabase Realtime 架构
- ✅ Worker 快速返回，不超时
- ✅ 支持长时间上传

**缺点**：
- ⚠️ 需要配置 Vercel Blob（可选，也可以直接使用原始 URL）

### 方案 2：直接使用原始 URL（简化版）

**核心思路**：
- 不进行视频上传
- 直接使用 API 返回的视频 URL
- 前端提供下载按钮

**流程**：

```
1. 用户提交任务
   ↓
2. Worker 调用 API 获取视频 URL（快速，< 10秒）
   ↓
3. 立即更新数据库：
   - status = 'completed'
   - videoUrl = API 返回的视频 URL
   - videoUrlInternal = 'original:' + videoUrl
   ↓
4. 前端显示下载按钮
   - 点击后直接下载原始 URL
   - 或在新标签页打开
```

**优点**：
- ✅ 最简单，无需额外配置
- ✅ 不涉及长时间上传
- ✅ Worker 快速返回

**缺点**：
- ⚠️ 依赖 API 返回的 URL 有效期
- ⚠️ 无法控制视频存储和过期时间

## 推荐方案：方案 1（异步处理）

### 实施步骤

#### 1. 更新 API 调用逻辑

**文件**: `src/extensions/media/rapidapi.ts`

**修改**:
- 更新 `fetchYouTubeVideoDownload` 方法
- 支持两个 API：`youtube-video-and-shorts-downloader1` 和 `cloud-api-hub-youtube-downloader`
- 正确解析响应格式

**API 1**: `youtube-video-and-shorts-downloader1.p.rapidapi.com`
```typescript
// GET /youtube/video/download?videoId=VIDEO_ID
const apiUrl = `https://${host}/youtube/video/download?videoId=${videoId}`;
```

**API 2**: `cloud-api-hub-youtube-downloader.p.rapidapi.com`
```typescript
// GET /download?id=VIDEO_ID&filter=audioandvideo&quality=lowest
const apiUrl = `https://${host}/download?id=${videoId}&filter=audioandvideo&quality=lowest`;
```

#### 2. 更新 Worker 逻辑

**文件**: `src/app/api/media/worker/route.ts`

**修改**:
- 检测 `outputType === 'video'`
- 调用 `fetchYouTubeVideo`
- 获取视频 URL 后立即更新数据库
- 如果配置了 Vercel Blob，启动异步上传（不 await）
- Worker 立即返回成功

**关键代码**:
```typescript
if (outputType === 'video') {
  // 获取视频 URL（快速，< 10秒）
  const mediaData = await fetchMediaFromRapidAPI(url, 'video');
  
  // 立即更新数据库
  await updateMediaTaskById(taskId, {
    status: 'downloading',
    videoUrl: mediaData.videoUrl,
    progress: 50,
  });
  
  // 如果配置了 Vercel Blob，启动异步上传（不 await）
  if (mediaData.videoUrl && process.env.BLOB_READ_WRITE_TOKEN) {
    (async () => {
      try {
        const storageKey = await uploadVideoToStorage(mediaData.videoUrl);
        if (storageKey) {
          await updateMediaTaskById(taskId, {
            videoUrlInternal: storageKey,
            status: 'completed',
            progress: 100,
          });
        }
      } catch (error) {
        // 上传失败，使用原始 URL
        await updateMediaTaskById(taskId, {
          videoUrlInternal: `original:${mediaData.videoUrl}`,
          status: 'completed',
          progress: 100,
        });
      }
    })();
  } else {
    // 没有配置 Blob，直接使用原始 URL
    await updateMediaTaskById(taskId, {
      videoUrlInternal: `original:${mediaData.videoUrl}`,
      status: 'completed',
      progress: 100,
    });
  }
  
  // Worker 立即返回（不等待上传完成）
  return Response.json({ success: true });
}
```

#### 3. 前端下载功能

**文件**: `src/shared/blocks/generator/media-task-result.tsx`

**修改**:
- 检测 `videoUrl` 或 `videoUrlInternal`
- 显示下载按钮
- 点击后调用 `/api/media/video-download` 获取下载 URL
- 或直接使用 `videoUrl` 下载

#### 4. 响应格式解析

**API 1 响应格式**（推测）:
```json
{
  "data": {
    "video_url": "https://...",
    "download_url": "https://...",
    "formats": [...]
  }
}
```

**API 2 响应格式**（推测）:
```json
{
  "url": "https://...",
  "download": "https://...",
  "formats": [...]
}
```

需要根据实际响应调整解析逻辑。

## 时间管理策略

### 1. Worker 超时控制

- **API 调用**: 30 秒超时（获取视频 URL）
- **数据库更新**: 立即完成（< 1 秒）
- **异步上传**: 不阻塞 Worker（后台进行）

### 2. 状态管理

- **`downloading`**: 正在上传到 Vercel Blob（如果启用）
- **`completed`**: 视频 URL 已准备好
- **`failed`**: 下载失败

### 3. 前端实时更新

- 使用 `useMediaTaskRealtime` Hook
- 实时显示状态变化
- 显示下载按钮（当 `status === 'completed'`）

## 实施优先级

### Phase 1: 基础功能（立即实施）

1. ✅ 更新 `fetchYouTubeVideoDownload` 支持两个 API
2. ✅ 更新 Worker 逻辑，立即返回视频 URL
3. ✅ 使用原始 URL（不进行上传）
4. ✅ 前端显示下载按钮

### Phase 2: 优化功能（后续）

1. ⏳ 集成 Vercel Blob 异步上传
2. ⏳ 添加上传进度显示
3. ⏳ 添加视频预览功能

## 测试计划

1. **API 测试**:
   - 测试两个 API 的响应格式
   - 验证视频 URL 提取逻辑

2. **集成测试**:
   - 提交 YouTube URL，选择 "Download Video"
   - 验证 Worker 快速返回
   - 验证数据库状态更新
   - 验证前端显示下载按钮

3. **性能测试**:
   - 验证 Worker 在 10 秒内完成
   - 验证长时间视频 URL 的有效性

## 风险与缓解

### 风险 1: API 响应格式不匹配

**缓解**:
- 添加详细的调试日志
- 支持多种响应格式
- 如果解析失败，返回错误信息

### 风险 2: 视频 URL 过期

**缓解**:
- 优先使用 Vercel Blob 存储（永久有效）
- 如果使用原始 URL，添加过期时间提示

### 风险 3: Worker 超时

**缓解**:
- API 调用设置 30 秒超时
- 立即更新数据库，不等待上传
- 使用异步上传，不阻塞 Worker

## 下一步行动

1. **立即实施 Phase 1**:
   - 更新 API 调用逻辑
   - 更新 Worker 逻辑
   - 测试基础功能

2. **验证 API 响应格式**:
   - 运行测试脚本
   - 根据实际响应调整解析逻辑

3. **前端集成**:
   - 添加下载按钮
   - 测试下载功能

**需要我立即开始实施 Phase 1 吗？**

# 📋 TikTok 异步文案提取方案（不改变 ShipAny 结构）

**分析时间**: 2026-01-17  
**API**: TikTok Reel AI Transcript Extractor  
**API Host**: `tiktok-reel-ai-transcript-extractor.p.rapidapi.com`  
**问题**: API 返回 `jobId` 但 `data` 为空，需要异步轮询获取结果

---

## 🔍 问题分析

### 当前情况

从 RapidAPI Hub 测试结果看：
- ✅ **API 端点**: `GET extractTikTokTranscript`（注意是 GET，不是 POST）
- ✅ **请求参数**: `url` (Query Params)
- ✅ **响应结构**:
  ```json
  {
    "success": true,
    "data": {
      "jobId": "f98c7e84-7496-4439-bd4d-a26d942946d1",
      "status": "success",
      "message": "TikTok transcript extraction completed successfully",
      "data": "", // ⚠️ 空字符串，需要轮询获取
      "estimatedProcessingTime": "30-90 seconds",
      "timestamp": "2026-01-17T05:35:30.588Z"
    }
  }
  ```
- ❌ **当前代码问题**: 
  - 使用的是 `/api/transcript` POST 端点（不存在，返回 404）
  - 应该使用 `/extractTikTokTranscript` GET 端点
  - 没有处理 `jobId` 异步轮询逻辑

---

## 💡 解决方案（不改变 ShipAny 结构）

### 方案概述

**核心思路**: 
1. 使用 `metadata` 字段（JSON 格式）存储 `jobId`，不修改数据库 schema
2. 利用 QStash 的延迟重试机制实现异步轮询
3. 在 Worker 路由中检测 `jobId` 状态，决定是提交任务还是查询结果

### 优势

- ✅ **不修改数据库 Schema**: 使用现有的 `metadata` 或临时字段
- ✅ **利用 QStash 重试**: 无需在函数内轮询，节省 Vercel 资源
- ✅ **符合 ShipAny 架构**: 所有逻辑在 Worker 路由中处理
- ✅ **实时更新**: 配合 Supabase Realtime，前端可实时看到状态

---

## 📐 实现方案详解

### 1. 修改 API 端点调用

**当前问题**: 代码中使用 `/api/transcript` POST，但实际应该是 `/extractTikTokTranscript` GET

**解决方案**: 更新 `fetchTikTokTranscriptPaidAPI` 方法中的端点路径

**代码位置**: `src/extensions/media/rapidapi.ts`

**当前代码**（错误）:
```typescript
if (isReelAI) {
  apiUrl = `https://${host}/api/transcript`; // ❌ 错误：端点不存在
  fetchOptions = {
    method: 'POST', // ❌ 错误：应该是 GET
    // ...
  };
}
```

**应改为**（正确）:
```typescript
if (isReelAI) {
  // 根据截图，端点应该是 GET extractTikTokTranscript
  const encodedUrl = encodeURIComponent(url);
  apiUrl = `https://${host}/extractTikTokTranscript?url=${encodedUrl}`;
  
  fetchOptions = {
    method: 'GET', // ✅ 正确：GET 请求
    headers: {
      'x-rapidapi-key': this.configs.apiKey,
      'x-rapidapi-host': host,
    },
    signal: AbortSignal.timeout(PAID_API_TIMEOUT),
  };
}
```

---

### 2. 处理异步 jobId 响应

**当前问题**: 代码期望直接返回 `transcript`，但实际返回的是 `jobId`

**解决方案**: 
- 检测响应中是否有 `jobId` 且 `data` 为空
- 如果有 `jobId`，保存到任务记录，并返回特殊状态
- Worker 路由在重试时检查 `jobId` 并查询结果

**代码位置**: `src/extensions/media/rapidapi.ts` 的 `fetchTikTokTranscriptPaidAPI` 方法

**当前代码**（需要修改）:
```typescript
const data = await response.json();

// 检查是否有 transcript
if (!transcription || transcription.trim().length === 0) {
  return {
    success: false,
    reason: 'NO_TRANSCRIPTION',
    message: 'No transcription available',
  };
}
```

**应改为**（支持异步）:
```typescript
const data = await response.json();

// 检查是否是异步任务（有 jobId 但 data 为空）
if (data.success && data.data?.jobId && (!data.data?.data || data.data.data === '')) {
  // ✅ 异步任务：返回 jobId，等待后续查询
  return {
    success: true, // 标记为成功（任务已提交）
    transcriptData: {
      jobId: data.data.jobId,
      status: 'processing',
      estimatedTime: data.data.estimatedProcessingTime,
    },
    metadata: {
      isAsync: true, // 标记为异步任务
      jobId: data.data.jobId,
    },
  };
}

// 同步返回的情况（有 transcript 数据）
const transcription = data.data?.data || data.transcription || data.transcript || '';
```

---

### 3. 实现结果查询接口

**新功能**: 查询异步任务的结果

**代码位置**: `src/extensions/media/rapidapi.ts`（新增方法）

**实现逻辑**:
```typescript
/**
 * Query TikTok transcript result by jobId
 * @param jobId Job ID returned from extractTikTokTranscript
 * @returns Result with transcript data or processing status
 */
private async queryTikTokTranscriptResult(
  jobId: string
): Promise<{
  success: boolean;
  transcriptData?: any;
  metadata?: any;
  reason?: string;
  message?: string;
  isProcessing?: boolean; // true if still processing
}> {
  const host = this.configs.tiktokTranscript?.backupHost || 
               'tiktok-reel-ai-transcript-extractor.p.rapidapi.com';
  
  // 假设查询端点是 GET /getTaskResult?jobId=xxx
  // 或者 GET /extractTikTokTranscript?jobId=xxx
  // 需要根据 RapidAPI Hub 文档确认实际端点
  const apiUrl = `https://${host}/getTaskResult?jobId=${encodeURIComponent(jobId)}`;
  
  try {
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'x-rapidapi-key': this.configs.apiKey,
        'x-rapidapi-host': host,
      },
      signal: AbortSignal.timeout(20000), // 20 seconds
    });

    if (!response.ok) {
      return {
        success: false,
        reason: 'HTTP_ERROR',
        message: `HTTP ${response.status}: ${response.statusText}`,
      };
    }

    const data = await response.json();

    // 检查状态
    if (data.data?.status === 'processing' || data.data?.status === 'pending') {
      // 仍在处理中
      return {
        success: false,
        isProcessing: true,
        reason: 'PROCESSING',
        message: 'Transcript is still being processed',
      };
    }

    // 检查是否有结果
    const transcript = data.data?.data || data.transcript || '';
    if (transcript && transcript.trim().length > 0) {
      // ✅ 成功获取 transcript
      return {
        success: true,
        transcriptData: data.data || data,
        metadata: {
          jobId,
          status: 'completed',
        },
      };
    }

    // 无结果或失败
    return {
      success: false,
      reason: 'NO_TRANSCRIPT',
      message: 'No transcript available yet or processing failed',
    };
  } catch (error: any) {
    return {
      success: false,
      reason: 'NETWORK_ERROR',
      message: error.message || 'Network error',
    };
  }
}
```

---

### 4. 在 Worker 路由中集成异步逻辑

**代码位置**: `src/app/api/media/worker/route.ts`

**实现逻辑**:

在 Worker 路由中，检测任务是否有 `jobId`：

```typescript
// 在 Worker 路由的 POST 方法中
export async function POST(req: Request) {
  // ... 之前的验证逻辑 ...

  const { taskId, url, outputType } = await req.json();

  // 获取任务记录
  const existingTask = await findMediaTaskById(taskId);
  
  // 检查任务是否有 jobId（异步任务）
  // 如果 metadata 字段中有 jobId，说明这是异步任务
  let jobId: string | null = null;
  try {
    const metadata = existingTask?.metadata ? JSON.parse(existingTask.metadata) : null;
    jobId = metadata?.jobId || null;
  } catch (e) {
    // metadata 不是 JSON 或不存在
  }

  if (jobId) {
    // 情况 A: 已有 jobId，说明需要查询结果
    console.log(`[Worker] 🔄 Querying transcript result for jobId: ${jobId}`);
    
    const result = await queryTikTokTranscriptResult(jobId);
    
    if (result.success && result.transcriptData) {
      // ✅ 成功获取 transcript
      const transcript = result.transcriptData.data || result.transcriptData.transcript || '';
      
      await updateMediaTaskById(taskId, {
        status: 'extracted',
        progress: 100,
        subtitleRaw: transcript,
        // 清除 jobId（任务完成）
        metadata: null, // 或移除 jobId 字段
      });
      
      return Response.json({ success: true, message: 'Transcript retrieved successfully' });
    } else if (result.isProcessing) {
      // ⏳ 仍在处理中，返回 500 触发 QStash 重试（延迟 30-60 秒）
      return Response.json(
        { 
          success: false, 
          message: 'Still processing, will retry',
          retryAfter: 30 // QStash 会在 30 秒后重试
        },
        { status: 500 }
      );
    } else {
      // ❌ 查询失败
      await updateMediaTaskById(taskId, {
        status: 'failed',
        errorMessage: result.message || 'Failed to retrieve transcript',
      });
      return Response.json({ success: false, error: result.message }, { status: 200 });
    }
  } else {
    // 情况 B: 没有 jobId，说明是第一次运行，提交任务
    console.log(`[Worker] 📤 Submitting transcript extraction task for: ${url}`);
    
    // 调用 API 提交任务（使用修正后的端点）
    const service = await getRapidAPIService();
    const result = await service.fetchMedia(url, 'subtitle');
    
    // 检查是否是异步任务
    if (result.metadata?.isAsync && result.metadata?.jobId) {
      // 保存 jobId 到 metadata 字段（如果 media_tasks 有 metadata 字段）
      // 或者使用 subtitleRaw 临时存储（因为此时还没有结果）
      // 注意：如果 media_tasks 表没有 metadata 字段，可以使用 errorMessage 临时存储
      // 更优雅的方式：添加一个 text 字段 jobId 到 media_tasks 表（但这需要修改 schema）
      
      // 临时方案：使用现有的 text 字段（如 errorMessage 的临时存储）
      // 或者：使用 database 的 JSON 支持（如果 PostgreSQL 版本支持）
      
      // 推荐：使用一个临时的 metadata JSON 存储在 subtitleRaw 字段（但这不是最佳实践）
      // 最佳：添加 jobId 字段（但这需要修改 schema，不符合要求）
      
      // 妥协方案：使用 Worker 的状态机制，在 QStash 的 body 中传递 jobId
      // 或者在每次 Worker 调用时，重新调用 API 查询（如果 API 支持根据 URL 查询状态）
      
      // 实际方案：保存 jobId 到数据库的某个字段
      // 如果 media_tasks 表没有合适的字段，建议添加 jobId 字段（但这需要修改 schema）
    }
  }
}
```

---

## ⚠️ 关键挑战与解决方案

### 挑战 1: 存储 jobId（不修改 Schema）

**问题**: `media_tasks` 表没有 `jobId` 字段，不能修改 Schema

**解决方案（按优先级）**:

#### 方案 A: 使用现有字段临时存储（临时方案）

**思路**: 使用 `subtitleRaw` 或 `errorMessage` 临时存储 JSON

```typescript
// 存储 jobId（临时方案）
await updateMediaTaskById(taskId, {
  subtitleRaw: JSON.stringify({ jobId, status: 'processing' }), // 临时存储
  status: 'processing',
  progress: 20,
});

// 查询时解析
const tempData = JSON.parse(existingTask.subtitleRaw || '{}');
const jobId = tempData.jobId;
```

**缺点**: 
- 占用 `subtitleRaw` 字段，获取结果后需要清空
- 不够优雅，但符合"不修改 Schema"的要求

#### 方案 B: 在 Worker 请求体中传递 jobId（推荐）

**思路**: QStash 的请求体包含 `taskId`，我们在 Worker 中检测任务状态

**实现**:
1. 第一次调用：提交任务，获取 `jobId`，保存到 `subtitleRaw` 的临时 JSON
2. 后续重试：检查 `subtitleRaw` 是否为 JSON，如果是则提取 `jobId` 并查询

```typescript
// 第一次：保存 jobId
await updateMediaTaskById(taskId, {
  subtitleRaw: JSON.stringify({ jobId, url, timestamp: Date.now() }),
  status: 'processing',
});

// 后续重试：检查并查询
let jobId: string | null = null;
try {
  const tempData = JSON.parse(existingTask.subtitleRaw || '{}');
  if (tempData.jobId) {
    jobId = tempData.jobId;
  }
} catch (e) {
  // 不是 JSON，说明已有真实的 subtitleRaw
}
```

**优点**:
- 不需要修改 Schema
- 利用现有的 `subtitleRaw` 字段
- 获取结果后覆盖为真实数据

---

### 挑战 2: 确认查询端点

**问题**: 截图只显示 `extractTikTokTranscript`，没有显示查询端点

**解决方案**:

#### 步骤 1: 在 RapidAPI Hub 中查找

1. 打开 RapidAPI Hub: https://rapidapi.com/hub
2. 搜索 "TikTok Reel AI Transcript Extractor"
3. 查看左侧 Endpoints 列表，寻找：
   - `getTaskResult`
   - `checkStatus`
   - `getTranscript`
   - `fetchResult`
   或类似的查询端点

#### 步骤 2: 测试查询端点

使用截图中的 `jobId` 测试：
```
jobId: f98c7e84-7496-4439-bd4d-a26d942946d1
```

可能的端点格式：
- `GET /getTaskResult?jobId={jobId}`
- `GET /extractTikTokTranscript?jobId={jobId}`
- `GET /status/{jobId}`
- `POST /getResult` (with `jobId` in body)

#### 步骤 3: 如果没有查询端点

如果 API 不支持查询端点，可能需要：
- 使用 Webhook（如果 API 支持）
- 或者等待固定时间后重新提交任务（不推荐）

---

### 挑战 3: QStash 重试策略

**问题**: 如何让 QStash 在 30-60 秒后重试？

**解决方案**:

#### 方案 A: 使用 QStash 的延迟功能（推荐）

```typescript
import { Client } from '@upstash/qstash';

// 在 Worker 中，如果任务仍在处理中
if (result.isProcessing) {
  // 发布一个延迟 30 秒的任务
  await qstash.publishJSON({
    url: `${process.env.NEXT_PUBLIC_APP_URL}/api/media/worker`,
    body: { taskId, url, outputType },
    delay: 30, // 延迟 30 秒
  });
  
  return Response.json({ success: false, message: 'Still processing, scheduled retry' }, { status: 200 });
}
```

#### 方案 B: 返回 500 状态码（QStash 自动重试）

```typescript
// QStash 默认会在 5xx 状态码时重试
// 但重试间隔可能不够灵活
if (result.isProcessing) {
  return Response.json(
    { success: false, message: 'Still processing' },
    { status: 500 } // QStash 会自动重试
  );
}
```

---

## 📋 实施步骤（不修改代码）

### 步骤 1: 验证 API 端点

1. **访问 RapidAPI Hub**
   - 打开: https://rapidapi.com/hub
   - 搜索 "TikTok Reel AI Transcript Extractor"

2. **确认端点**
   - ✅ 提交端点: `GET extractTikTokTranscript`（已确认）
   - ❓ 查询端点: 需要在左侧列表查找（如 `getTaskResult`）

3. **测试查询端点**
   - 使用截图中的 `jobId`: `f98c7e84-7496-4439-bd4d-a26d942946d1`
   - 在 RapidAPI Hub 中测试查询端点
   - 确认返回格式

### 步骤 2: 确认环境变量配置

**当前配置**（`.env.local`）:
```env
RAPIDAPI_TIKTOK_TRANSCRIPT_BACKUP_HOST=tiktok-reel-ai-transcript-extractor.p.rapidapi.com
```

**验证**:
- ✅ API Host 正确
- ❓ API Key 是否正确且有效
- ❓ 是否需要订阅计划

### 步骤 3: 确认数据库字段

**检查 `media_tasks` 表是否有可用的 JSON 字段**:
- `subtitleRaw` (text) - 可以用来临时存储 JSON
- `errorMessage` (text) - 不推荐（用于错误信息）
- `metadata` (text) - 如果有，最适合存储 JSON

**如果没有合适的字段**:
- 可以使用 `subtitleRaw` 临时存储（获取结果后覆盖）
- 或者建议添加 `jobId` 字段（但这需要修改 Schema，不符合当前要求）

---

## 🎯 推荐方案总结

### 方案 A: 临时使用 subtitleRaw 存储 jobId（不修改 Schema）

**优点**:
- ✅ 不需要修改数据库 Schema
- ✅ 可以立即实施
- ✅ 符合"不改变 ShipAny 结构"的要求

**缺点**:
- ⚠️ `subtitleRaw` 字段被临时占用
- ⚠️ 需要解析 JSON 来判断是 jobId 还是真实数据

**实施步骤**:
1. 修改 `fetchTikTokTranscriptPaidAPI` 端点（GET `/extractTikTokTranscript`）
2. 检测 `jobId` 响应，保存到 `subtitleRaw` 的临时 JSON
3. Worker 重试时解析 `subtitleRaw`，如果有 `jobId` 则查询结果
4. 获取结果后，覆盖 `subtitleRaw` 为真实数据

### 方案 B: 添加 jobId 字段（需要 Schema 修改）

**优点**:
- ✅ 最优雅的方案
- ✅ 不影响其他字段

**缺点**:
- ❌ 需要修改数据库 Schema（不符合当前要求）

**如果未来允许修改 Schema**:
```sql
ALTER TABLE media_tasks ADD COLUMN job_id TEXT;
```

---

## 📊 当前代码需要修改的地方（仅参考，不执行）

### 1. 修改 API 端点路径

**文件**: `src/extensions/media/rapidapi.ts`  
**位置**: `fetchTikTokTranscriptPaidAPI` 方法（约第 1061 行）

**修改内容**:
- 将 `/api/transcript` POST 改为 `/extractTikTokTranscript` GET
- 处理响应中的 `jobId`

### 2. 添加结果查询方法

**文件**: `src/extensions/media/rapidapi.ts`  
**位置**: 新增私有方法

**功能**: 根据 `jobId` 查询转录结果

### 3. 修改 Worker 路由逻辑

**文件**: `src/app/api/media/worker/route.ts`  
**位置**: `POST` 方法（约第 30 行）

**修改内容**:
- 检测任务是否有 `jobId`
- 如果有，查询结果
- 如果没有，提交任务

---

## ✅ 验证清单

- [ ] **API 端点验证**
  - [ ] 确认 `GET /extractTikTokTranscript` 端点可用
  - [ ] 确认查询端点存在（如 `GET /getTaskResult`）
  - [ ] 测试查询端点是否能获取结果

- [ ] **环境变量验证**
  - [ ] `RAPIDAPI_TIKTOK_TRANSCRIPT_BACKUP_HOST` 配置正确
  - [ ] `NEXT_PUBLIC_RAPIDAPI_KEY` 有效且有权限

- [ ] **代码逻辑验证**
  - [ ] 端点调用方法正确（GET vs POST）
  - [ ] jobId 检测逻辑正确
  - [ ] 轮询逻辑正确（QStash 重试）

---

## 🔧 下一步行动

### 立即执行（P1）

1. **在 RapidAPI Hub 中查找查询端点**
   - 使用截图中的 `jobId` 测试查询端点
   - 确认端点路径和请求格式

2. **验证端点调用**
   - 确认 `GET /extractTikTokTranscript` 返回 `jobId`
   - 确认查询端点能获取结果

### 计划执行（P2）

1. **实施代码修改**（获得批准后）
   - 修改 API 端点路径
   - 添加 jobId 处理逻辑
   - 集成到 Worker 路由

2. **测试验证**
   - 提交任务并获取 `jobId`
   - 验证轮询逻辑
   - 确认能获取最终结果

---

## 📄 参考资料

- **RapidAPI Hub**: https://rapidapi.com/hub?q=tiktok%20reel%20ai%20transcript
- **QStash 延迟文档**: https://docs.upstash.com/qstash
- **当前测试结果**: `jobId: f98c7e84-7496-4439-bd4d-a26d942946d1`

---

**分析完成时间**: 2026-01-17T05:35:00Z  
**结论**: API 是异步的，需要实现 jobId 轮询逻辑，但可以先验证查询端点是否存在。

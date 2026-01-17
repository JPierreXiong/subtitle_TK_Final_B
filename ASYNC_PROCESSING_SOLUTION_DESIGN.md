# 异步处理方案设计文档

## 📋 项目背景

**目标**: 在 Vercel Serverless 环境中处理 3 分钟以上的 TikTok/YouTube 视频提取任务

**约束条件**:
- Vercel Serverless 函数超时限制（免费版 10s，专业版 60s）
- 必须保持 ShipAny 框架结构不变
- 数据库：Supabase PostgreSQL
- 存储：Vercel Blob
- 需要支持高并发和长耗时任务

**专家审查结论**: ✅ 方案已批准，达到工业级标准
- ✅ 资源保护：流式传输避免 OOM
- ✅ 用户心理建设：200ms 响应 + Realtime 推送
- ✅ 系统自愈能力：QStash 重试机制

---

## 🔄 一、核心流程梳理

### 1.1 业务时序流程

```
┌─────────────┐
│   Frontend  │
└──────┬──────┘
       │ 1. POST /api/media/submit {url, outputType}
       ▼
┌─────────────────────────────────────┐
│  /api/media/submit (Vercel API)     │
│  - 4秒熔断: getUserInfo()           │
│  - 创建任务记录 (status: pending)   │
│  - 推送任务到 QStash                │
│  - 立即返回 202 + taskId            │
└──────┬──────────────────────────────┘
       │ 2. 202 Accepted {taskId}
       ▼
┌─────────────┐
│   Frontend  │
│  - 显示"处理中"                     │
│  - 订阅 Supabase Realtime          │
└─────────────┘
       │
       │ 3. QStash 异步调用
       ▼
┌─────────────────────────────────────┐
│  /api/media/worker (Vercel API)    │
│  - 验证 QStash 签名                 │
│  - 调用 RapidAPI (流式)            │
│  - 流式上传到 Vercel Blob           │
│  - 提取字幕/文案                    │
│  - 更新 Supabase 状态               │
└──────┬──────────────────────────────┘
       │ 4. 状态更新 (status: extracted)
       ▼
┌─────────────────────────────────────┐
│  Supabase Realtime                  │
│  - 推送状态变更到前端                │
└──────┬──────────────────────────────┘
       │ 5. 实时通知
       ▼
┌─────────────┐
│   Frontend  │
│  - 显示结果                          │
└─────────────┘
```

### 1.2 关键设计原则

1. **快速响应**: API 在 200ms 内返回，用户体验优先
2. **熔断保护**: 4秒抢占式超时，避免 Vercel 强制中断
3. **流式处理**: 视频文件不加载到内存，直接 Pipe 传输
4. **实时反馈**: Supabase Realtime 替代轮询，降低服务器压力
5. **解耦设计**: QStash 处理异步任务，即使 Vercel 实例回收也能完成
6. **状态机细化**: 精确的状态划分，提供更好的用户反馈
7. **幂等性设计**: 防止 QStash 重试导致的重复处理

---

## 🎯 二、解决方案对比

### 方案一：QStash 任务队列（推荐 ⭐⭐⭐⭐⭐）

#### 2.1 架构设计

```
Frontend → API Submit → QStash Queue → Worker API → Supabase
                ↓                              ↓
           202 Accepted                  Status Update
                ↓                              ↓
        Supabase Realtime ←────────────────────┘
```

#### 2.2 核心优势

✅ **自动重试**: QStash 内置重试机制，失败自动重试  
✅ **解耦设计**: 任务队列与处理逻辑完全分离  
✅ **高可用性**: 即使 Vercel 实例被回收，任务仍能完成  
✅ **延迟调度**: 支持延迟执行和定时任务  
✅ **签名验证**: 内置请求签名验证，安全性高  

#### 2.3 实现细节

**依赖安装**:
```bash
pnpm add @upstash/qstash
```

**环境变量**:
```env
QSTASH_TOKEN=your-qstash-token
QSTASH_CURRENT_SIGNING_KEY=your-signing-key
QSTASH_NEXT_SIGNING_KEY=your-next-signing-key  # 用于密钥轮换
```

**核心代码结构**:
```typescript
// src/app/api/media/submit/route.ts
import { Client } from '@upstash/qstash';

const qstash = new Client({
  token: process.env.QSTASH_TOKEN!,
});

export async function POST(req: Request) {
  // 1. 4秒熔断
  const user = await Promise.race([
    getUserInfo(),
    new Promise((_, reject) => 
      setTimeout(() => reject(new Error('AUTH_TIMEOUT')), 4000)
    )
  ]);

  // 2. 创建任务
  const taskId = getUuid();
  await createMediaTask({ id: taskId, status: 'pending', ... });

  // 3. 推送 QStash（闭包处理）
  await qstash.publishJSON({
    url: `${process.env.NEXT_PUBLIC_APP_URL}/api/media/worker`,
    body: { taskId, url, outputType, userId },
    headers: {
      'Content-Type': 'application/json',
    },
    // 可选：延迟执行
    // delay: 5, // 延迟5秒
  });

  // 4. 立即返回
  return Response.json({ taskId }, { status: 202 });
}
```

```typescript
// src/app/api/media/worker/route.ts
import { verifySignatureAppRouter } from '@upstash/qstash/nextjs';

export async function POST(req: Request) {
  // 1. 验证 QStash 签名
  await verifySignatureAppRouter(req);

  const { taskId, url, outputType, userId } = await req.json();

  try {
    // 2. 更新状态
    await updateMediaTaskById(taskId, { status: 'processing', progress: 10 });

    // 3. 流式获取视频
    const videoRes = await fetch(RAPID_API_URL, {
      headers: { 'x-rapidapi-key': API_KEY },
    });

    if (!videoRes.ok || !videoRes.body) {
      throw new Error('Failed to fetch video');
    }

    // 4. 流式上传到 Vercel Blob（关键：不占用内存）
    const { put } = await import('@vercel/blob');
    const blobUrl = await put(`videos/${taskId}.mp4`, videoRes.body, {
      access: 'public',
      contentType: 'video/mp4',
    });

    // 5. 提取字幕/文案
    const transcript = await extractTranscript(url);

    // 6. 更新数据库
    await updateMediaTaskById(taskId, {
      status: 'extracted',
      progress: 100,
      subtitleRaw: transcript,
      videoUrlInternal: `vercel-blob:${blobUrl}`,
    });

    return Response.json({ success: true });
  } catch (error) {
    await updateMediaTaskById(taskId, {
      status: 'failed',
      errorMessage: error.message,
    });
    throw error;
  }
}
```

#### 2.4 配置 Worker 超时

在 `vercel.json` 中配置 Worker 路由的超时时间：

```json
{
  "functions": {
    "src/app/api/media/worker/route.ts": {
      "maxDuration": 300
    }
  }
}
```

**注意**: Vercel Pro 计划支持最长 300 秒（5分钟），足够处理 3 分钟的视频。

---

### 方案二：Upstash Workflow 状态机（适合复杂流程）

#### 2.1 架构设计

```
Frontend → API Submit → Workflow → Step 1 → Step 2 → Step 3 → Supabase
                ↓                                         ↓
           202 Accepted                            Status Update
```

#### 2.2 核心优势

✅ **状态机模式**: 复杂流程可视化，易于维护  
✅ **状态快照**: 每一步都有状态保存，失败可恢复  
✅ **同步代码**: 编写像同步代码，底层完全异步  
✅ **错误恢复**: 支持从失败步骤重新开始  

#### 2.3 实现细节

**依赖安装**:
```bash
pnpm add @upstash/workflow
```

**核心代码结构**:
```typescript
// src/app/api/media/workflow/route.ts
import { Workflow } from '@upstash/workflow';

const workflow = new Workflow({
  baseUrl: process.env.NEXT_PUBLIC_APP_URL!,
});

export async function POST(req: Request) {
  const { taskId, url, outputType, userId } = await req.json();

  // 启动工作流
  const run = await workflow.run({
    id: taskId,
    steps: [
      {
        name: 'fetch-video',
        url: '/api/media/workflow/fetch-video',
        method: 'POST',
        body: { taskId, url },
      },
      {
        name: 'upload-blob',
        url: '/api/media/workflow/upload-blob',
        method: 'POST',
        body: { taskId },
      },
      {
        name: 'extract-transcript',
        url: '/api/media/workflow/extract-transcript',
        method: 'POST',
        body: { taskId },
      },
    ],
  });

  return Response.json({ runId: run.id });
}
```

#### 2.4 适用场景

- ✅ 需要多步骤处理（下载 → 转码 → 提取 → 翻译）
- ✅ 需要步骤间的数据传递
- ✅ 需要可视化工作流状态
- ❌ 简单任务（推荐使用 QStash）

---

## 🔧 三、关键技术实现

### 3.0 状态机细化（State Granularity）

**专家建议**: 细化状态字段，提供更精准的前端文案显示

#### 状态定义

```typescript
export type MediaTaskStatus =
  | 'pending'      // 已入队，等待处理
  | 'downloading'  // 正在从平台下载视频流
  | 'processing'   // 正在提取文案（ASR）
  | 'extracted'    // 提取完成，等待翻译
  | 'translating'  // 正在翻译
  | 'completed'   // 处理完成
  | 'failed';      // 处理失败
```

#### 状态流转图

```
pending → downloading → processing → extracted → translating → completed
   ↓           ↓             ↓            ↓            ↓
 failed     failed        failed       failed       failed
```

#### 前端文案映射

```typescript
const statusMessages = {
  pending: '任务已提交，等待处理...',
  downloading: '正在下载视频...',
  processing: '正在提取字幕...',
  extracted: '字幕提取完成，可以开始翻译',
  translating: '正在翻译字幕...',
  completed: '处理完成！',
  failed: '处理失败，请重试',
};
```

### 3.0.1 幂等性设计（Idempotency）

**专家建议**: 防止 QStash 重试导致的重复处理

#### 幂等性检查逻辑

```typescript
// src/app/api/media/worker/route.ts
export async function POST(req: Request) {
  await verifySignatureAppRouter(req);
  const { taskId, url, outputType, userId } = await req.json();

  // 🔑 幂等性检查：如果任务已完成，直接返回
  const existingTask = await findMediaTaskById(taskId);
  
  if (existingTask) {
    // 如果任务已经是最终状态，直接返回成功（避免重复处理）
    if (existingTask.status === 'completed' || existingTask.status === 'extracted') {
      console.log(`[Idempotency] Task ${taskId} already completed, skipping`);
      return Response.json({ 
        success: true, 
        message: 'Task already completed',
        status: existingTask.status 
      });
    }

    // 如果任务正在处理中，检查是否应该继续
    if (existingTask.status === 'downloading' || existingTask.status === 'processing') {
      // 可选：检查处理时间，如果超过阈值，允许重试
      const processingTime = Date.now() - new Date(existingTask.updatedAt).getTime();
      const MAX_PROCESSING_TIME = 10 * 60 * 1000; // 10分钟

      if (processingTime < MAX_PROCESSING_TIME) {
        console.log(`[Idempotency] Task ${taskId} is still processing, skipping`);
        return Response.json({ 
          success: true, 
          message: 'Task is already processing',
          status: existingTask.status 
        });
      }
    }
  }

  // 继续正常处理流程...
}
```

#### 幂等性保证点

1. **数据库层面**: 使用 `taskId` 作为唯一标识
2. **状态检查**: 处理前检查任务状态
3. **原子操作**: 使用数据库事务确保状态更新原子性
4. **重试安全**: QStash 重试时不会重复消耗资源

### 3.1 熔断机制（Circuit Breaker）

**目标**: 在 4 秒内完成用户认证，超时立即返回错误

```typescript
// src/app/api/media/submit/route.ts
async function getUserInfoWithTimeout(timeoutMs: number = 4000) {
  return Promise.race([
    getUserInfo(),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('AUTH_TIMEOUT')), timeoutMs)
    ),
  ]);
}

export async function POST(req: Request) {
  try {
    // 4秒抢占式超时
    const user = await getUserInfoWithTimeout(4000);
    
    // 继续处理...
  } catch (error) {
    if (error.message === 'AUTH_TIMEOUT') {
      return Response.json(
        { error: 'Authentication timeout. Please try again.' },
        { status: 504 }
      );
    }
    throw error;
  }
}
```

### 3.2 流式处理（Stream Processing）

**目标**: 视频文件不加载到内存，直接 Pipe 传输

```typescript
// src/app/api/media/worker/route.ts
export async function POST(req: Request) {
  const { taskId, videoUrl } = await req.json();

  // 1. 获取视频流（不等待完整下载）
  const videoRes = await fetch(videoUrl, {
    signal: AbortSignal.timeout(300000), // 5分钟超时
  });

  if (!videoRes.ok || !videoRes.body) {
    throw new Error('Failed to fetch video');
  }

  // 2. 直接流式上传（关键：使用 response.body）
  const { put } = await import('@vercel/blob');
  const blobUrl = await put(
    `videos/${taskId}.mp4`,
    videoRes.body, // ReadableStream，不占用内存
    {
      access: 'public',
      contentType: 'video/mp4',
    }
  );

  // 3. 继续处理...
}
```

**内存优化**:
- ✅ 使用 `response.body` 直接传递流
- ✅ 不调用 `response.blob()` 或 `response.arrayBuffer()`
- ✅ Vercel Blob 的 `put()` 支持 `ReadableStream`

### 3.3 Supabase Realtime 订阅（替代轮询）

**目标**: 实时接收状态更新，降低服务器压力

#### 前端实现

```typescript
// src/shared/hooks/use-media-task-realtime.ts
'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export function useMediaTaskRealtime(taskId: string | null) {
  const [task, setTask] = useState<MediaTaskStatus | null>(null);

  useEffect(() => {
    if (!taskId) return;

    // 订阅 media_tasks 表的变化
    const channel = supabase
      .channel(`media-task-${taskId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'media_tasks',
          filter: `id=eq.${taskId}`,
        },
        (payload) => {
          // 实时更新任务状态
          setTask(payload.new as MediaTaskStatus);
        }
      )
      .subscribe();

    // 初始加载
    fetchTaskStatus(taskId).then(setTask);

    return () => {
      supabase.removeChannel(channel);
    };
  }, [taskId]);

  return task;
}
```

#### 数据库配置

在 Supabase Dashboard 中启用 Realtime：

1. 进入 **Database** → **Replication**
2. 为 `media_tasks` 表启用 Replication
3. 确保 `id`, `status`, `progress` 字段被复制

#### 环境变量

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

---

## 📊 四、方案对比总结

| 特性 | QStash 方案 | Workflow 方案 | 当前方案（Fire-and-forget） |
|------|------------|---------------|---------------------------|
| **实现复杂度** | ⭐⭐ 简单 | ⭐⭐⭐⭐ 复杂 | ⭐ 最简单 |
| **可靠性** | ⭐⭐⭐⭐⭐ 高 | ⭐⭐⭐⭐⭐ 高 | ⭐⭐ 低（可能被中断） |
| **重试机制** | ✅ 自动重试 | ✅ 步骤级重试 | ❌ 无 |
| **超时支持** | ✅ 支持 | ✅ 支持 | ❌ 受 Vercel 限制 |
| **适用场景** | 简单到中等复杂度 | 复杂多步骤流程 | 仅开发测试 |
| **成本** | 💰 按消息计费 | 💰 按执行计费 | 💰 免费但不可靠 |

**推荐**: 使用 **QStash 方案**，简单可靠，适合当前需求。

---

## 🚀 五、实施步骤

### 5.1 安装依赖

```bash
# QStash 方案
pnpm add @upstash/qstash

# Supabase Realtime（如果还没有）
pnpm add @supabase/supabase-js
```

### 5.2 配置环境变量

```env
# QStash
QSTASH_TOKEN=qst_xxx
QSTASH_CURRENT_SIGNING_KEY=sig_xxx
QSTASH_NEXT_SIGNING_KEY=sig_xxx

# Supabase Realtime
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxx
```

### 5.3 创建 Worker 路由

创建 `src/app/api/media/worker/route.ts`（见方案一代码）

### 5.4 修改 Submit 路由

修改 `src/app/api/media/submit/route.ts`：
- 添加 4 秒熔断
- 集成 QStash 推送
- 返回 202 Accepted

### 5.5 配置 Vercel

在 `vercel.json` 中配置 Worker 超时：

```json
{
  "functions": {
    "src/app/api/media/worker/route.ts": {
      "maxDuration": 300
    }
  }
}
```

### 5.6 启用 Supabase Realtime

1. 在 Supabase Dashboard 启用 Replication
2. 更新前端 Hook 使用 Realtime 替代轮询

### 5.7 测试验证

- [ ] 测试 4 秒熔断机制
- [ ] 测试 QStash 任务推送
- [ ] 测试 Worker 流式处理
- [ ] 测试 Supabase Realtime 订阅
- [ ] 测试 3 分钟以上视频处理
- [ ] 测试错误重试机制

---

## ⚠️ 六、注意事项

### 6.1 Vercel 限制

- **免费版**: 10 秒超时
- **Pro 版**: 60 秒超时（可配置到 300 秒）
- **Enterprise**: 支持更长超时

**建议**: 使用 Vercel Pro 计划，配置 Worker 路由为 300 秒。

### 6.2 QStash 限制

- **消息大小**: 最大 256KB
- **重试次数**: 默认 3 次
- **延迟执行**: 最长 1 年

**注意**: 任务数据应保持在 256KB 以内，大文件使用 URL 引用。

### 6.3 内存优化

- ✅ 使用流式处理，避免加载完整文件
- ✅ 使用 `response.body` 直接传递
- ✅ 避免 `blob()` 或 `arrayBuffer()` 调用

### 6.4 错误处理

- **QStash 重试**: 自动重试失败任务
- **数据库回滚**: 任务失败时回滚积分
- **用户通知**: 通过 Realtime 推送错误信息

---

## 📈 七、性能优化建议

### 7.1 缓存策略

- **视频 URL 缓存**: 相同 URL 的视频使用缓存（已有实现）
- **字幕缓存**: 相同视频的字幕结果缓存

### 7.2 并发控制

- **QStash 限流**: 配置并发任务数
- **数据库连接池**: Supabase 连接池优化

### 7.3 监控告警

- **QStash Dashboard**: 监控任务状态
- **Vercel Analytics**: 监控 API 性能
- **Supabase Logs**: 监控数据库查询

---

## ✅ 八、实施检查清单

### 代码变更
- [ ] 安装 QStash 依赖
- [ ] 创建 Worker 路由
- [ ] 修改 Submit 路由（熔断 + QStash）
- [ ] 更新前端 Hook（Realtime 替代轮询）
- [ ] 配置 `vercel.json`

### 环境配置
- [ ] 配置 QStash Token
- [ ] 配置 Supabase Realtime
- [ ] 配置 Vercel 函数超时

### 数据库配置
- [ ] 启用 Supabase Replication
- [ ] 验证 `media_tasks` 表索引

### 测试验证
- [ ] 单元测试
- [ ] 集成测试
- [ ] 压力测试
- [ ] 错误场景测试

---

## 📝 九、代码示例汇总

### 9.1 完整的 Submit 路由

```typescript
// src/app/api/media/submit/route.ts
import { Client } from '@upstash/qstash';
import { NextRequest } from 'next/server';
import { respData, respErr } from '@/shared/lib/resp';
import { getUserInfo } from '@/shared/models/user';
import { createMediaTask } from '@/shared/models/media_task';
import { getUuid } from '@/shared/lib/hash';

const qstash = new Client({
  token: process.env.QSTASH_TOKEN!,
});

async function getUserInfoWithTimeout(timeoutMs: number = 4000) {
  return Promise.race([
    getUserInfo(),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('AUTH_TIMEOUT')), timeoutMs)
    ),
  ]);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { url, outputType, targetLang } = body;

    // 验证...
    if (!url || typeof url !== 'string') {
      return respErr('URL is required');
    }

    // 4秒熔断
    let currentUser;
    try {
      currentUser = await getUserInfoWithTimeout(4000);
    } catch (error: any) {
      if (error.message === 'AUTH_TIMEOUT') {
        return respErr('Authentication timeout. Please try again.', 504);
      }
      return respErr('no auth, please sign in');
    }

    if (!currentUser) {
      return respErr('no auth, please sign in');
    }

    // 检查积分和计划限制...
    // ... (保持原有逻辑)

    // 创建任务
    const taskId = getUuid();
    await createMediaTask({
      id: taskId,
      userId: currentUser.id,
      platform: url.includes('tiktok') ? 'tiktok' : 'youtube',
      videoUrl: url,
      outputType: outputType || 'subtitle',
      targetLang: targetLang || null,
      status: 'pending',
      progress: 0,
    }, requiredCredits);

    // 推送 QStash（闭包处理）
    await qstash.publishJSON({
      url: `${process.env.NEXT_PUBLIC_APP_URL}/api/media/worker`,
      body: {
        taskId,
        url,
        outputType: outputType || 'subtitle',
        userId: currentUser.id,
      },
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // 立即返回 202
    return respData(
      { taskId, message: 'Task submitted successfully' },
      202
    );
  } catch (error: any) {
    console.error('Media submit failed:', error);
    return respErr(error.message || 'Failed to submit media task');
  }
}
```

### 9.2 完整的 Worker 路由

```typescript
// src/app/api/media/worker/route.ts
import { verifySignatureAppRouter } from '@upstash/qstash/nextjs';
import { Request } from 'next/server';
import { put } from '@vercel/blob';
import {
  updateMediaTaskById,
  findMediaTaskById,
} from '@/shared/models/media_task';
import { fetchMediaFromRapidAPI } from '@/shared/services/media/rapidapi';
import { uploadVideoToStorage } from '@/shared/services/media/video-storage';

export async function POST(req: Request) {
  try {
    // 1. 验证 QStash 签名
    await verifySignatureAppRouter(req);

    const { taskId, url, outputType, userId } = await req.json();

    // 2. 🔑 幂等性检查：如果任务已完成，直接返回
    const existingTask = await findMediaTaskById(taskId);
    
    if (existingTask) {
      if (existingTask.status === 'completed' || existingTask.status === 'extracted') {
        console.log(`[Idempotency] Task ${taskId} already completed, skipping`);
        return Response.json({ 
          success: true, 
          message: 'Task already completed',
          status: existingTask.status 
        });
      }

      // 如果任务正在处理中，检查处理时间
      if (existingTask.status === 'downloading' || existingTask.status === 'processing') {
        const processingTime = Date.now() - new Date(existingTask.updatedAt).getTime();
        const MAX_PROCESSING_TIME = 10 * 60 * 1000; // 10分钟

        if (processingTime < MAX_PROCESSING_TIME) {
          console.log(`[Idempotency] Task ${taskId} is still processing, skipping`);
          return Response.json({ 
            success: true, 
            message: 'Task is already processing',
            status: existingTask.status 
          });
        }
      }
    }

    // 3. 更新状态为 downloading（细化状态）
    await updateMediaTaskById(taskId, {
      status: 'downloading',
      progress: 10,
    });

    // 4. 调用 RapidAPI（流式获取）
    const mediaData = await fetchMediaFromRapidAPI(url, outputType || 'subtitle');

    // 5. 更新状态为 processing（细化状态：正在提取文案）
    await updateMediaTaskById(taskId, {
      status: 'processing',
      progress: 30,
      platform: mediaData.platform,
      title: mediaData.title,
      author: mediaData.author,
      // ... 其他元数据
    });

    // 6. 处理视频上传（如果需要）
    let videoUrlInternal: string | null = null;
    let expiresAt: Date | null = null;

    if (outputType === 'video' && mediaData.videoUrl) {
      await updateMediaTaskById(taskId, { progress: 40 });

      // 流式上传到 Vercel Blob
      const storageIdentifier = await uploadVideoToStorage(mediaData.videoUrl);

      if (storageIdentifier) {
        videoUrlInternal = storageIdentifier;
        expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
        await updateMediaTaskById(taskId, { progress: 70 });
      }
    }

    // 7. 保存字幕
    await updateMediaTaskById(taskId, {
      progress: 90,
      subtitleRaw: mediaData.subtitleRaw || null,
    });

    // 8. 标记为完成（extracted 状态：等待翻译）
    await updateMediaTaskById(taskId, {
      status: 'extracted',
      progress: 100,
      videoUrlInternal,
      expiresAt,
    });

    return Response.json({ success: true });
  } catch (error: any) {
    console.error('Worker processing failed:', error);

    // 获取 taskId（从请求体或错误上下文）
    const body = await req.json().catch(() => ({}));
    const taskId = body.taskId;

    if (taskId) {
      await updateMediaTaskById(taskId, {
        status: 'failed',
        errorMessage: error.message || 'Processing failed',
        progress: 0,
      });
    }

    return Response.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
```

---

## 🎯 十、总结

### 推荐方案：QStash + Supabase Realtime

**核心优势**:
1. ✅ **简单可靠**: 实现简单，维护成本低
2. ✅ **自动重试**: QStash 内置重试，提高成功率
3. ✅ **实时反馈**: Supabase Realtime 替代轮询，降低服务器压力
4. ✅ **流式处理**: 内存安全，支持大文件
5. ✅ **熔断保护**: 4秒超时，避免 Vercel 强制中断

**实施优先级**:
1. **Phase 1**: 集成 QStash（核心功能）
2. **Phase 2**: 添加熔断机制（稳定性）
3. **Phase 3**: 优化流式处理（性能）
4. **Phase 4**: 集成 Supabase Realtime（用户体验）

---

**文档创建时间**: 2024-12-25  
**状态**: ✅ 方案已设计，等待批准执行

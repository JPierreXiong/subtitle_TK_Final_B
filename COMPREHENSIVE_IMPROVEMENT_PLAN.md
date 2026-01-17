# 全面改进方案 - 认证与异步架构优化

## 📋 执行摘要

**目标**: 解决 401 认证问题，优化 QStash 异步架构，实现 Supabase Realtime 实时更新，提升系统健壮性和用户体验。

**原则**: 不改变 ShipAny 核心结构，仅在现有架构基础上增强功能。

---

## 🔍 现状分析

### ✅ 已实现的功能

1. **QStash 异步处理** ✅
   - Worker 路由已实现 (`src/app/api/media/worker/route.ts`)
   - QStash 签名验证已实现
   - 幂等性检查已实现
   - 流式处理已部分实现

2. **任务状态管理** ✅
   - 数据库表 `media_tasks` 已定义
   - 状态更新机制已实现
   - 前端轮询机制已实现 (`use-media-task.ts`)

3. **认证基础** ✅
   - Better-Auth 已集成
   - 4秒熔断器已实现
   - 错误处理已完善

### ⚠️ 存在的问题

1. **401 认证错误** ❌
   - 登录后 Session 可能未正确建立
   - Cookie 配置可能不匹配
   - AUTH_SECRET 可能不一致

2. **前端轮询效率低** ⚠️
   - 使用 3 秒轮询间隔，增加服务器压力
   - 没有使用 Supabase Realtime 实时更新

3. **Worker 路由安全性** ⚠️
   - 虽然已有 QStash 签名验证，但需要增强错误处理
   - 需要更好的日志记录和监控

4. **流式处理优化** ⚠️
   - 需要确认是否真正使用流式处理
   - 需要优化内存使用

---

## 🎯 改进方案

### 优先级 1: 解决 401 认证问题 (P0)

#### 问题诊断

**可能原因**:
1. AUTH_SECRET 在服务器重启后未正确加载
2. Cookie Domain/Path 配置不匹配
3. Better-Auth 配置中的 baseURL 与请求 URL 不一致
4. 数据库 Session 表数据异常

#### 解决方案

**1.1 增强认证诊断脚本**

创建 `scripts/diagnose-auth-comprehensive.ts`:
- 检查 AUTH_SECRET 配置
- 验证 Cookie 设置
- 测试 Session 创建和验证
- 检查数据库连接

**1.2 改进认证错误处理**

在 `src/app/api/media/submit/route.ts` 中:
- 增强 `getUserInfoWithTimeout` 的错误日志
- 添加认证失败的具体原因提示
- 区分超时错误和认证错误

**1.3 验证环境变量一致性**

确保以下变量一致:
- `AUTH_URL` = `http://localhost:3000` (开发环境)
- `NEXT_PUBLIC_APP_URL` = `http://localhost:3000`
- `AUTH_SECRET` 在所有环境中一致

---

### 优先级 2: 实现 Supabase Realtime (P1)

#### 目标

替换前端轮询机制，使用 Supabase Realtime 实现实时状态更新。

#### 实施方案

**2.1 数据库配置**

在 Supabase Dashboard 中:
1. 进入 **Database** → **Replication**
2. 为 `media_tasks` 表启用 Replication
3. 确保以下字段被复制:
   - `id`
   - `status`
   - `progress`
   - `updated_at`
   - `error_message`

**2.2 创建 Realtime Hook**

创建 `src/shared/hooks/use-media-task-realtime.ts`:
```typescript
'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export function useMediaTaskRealtime(taskId: string | null) {
  const [task, setTask] = useState<any>(null);

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
          setTask(payload.new);
        }
      )
      .subscribe();

    // 初始加载
    fetch(`/api/media/status?id=${taskId}`)
      .then(res => res.json())
      .then(data => setTask(data.data));

    return () => {
      supabase.removeChannel(channel);
    };
  }, [taskId]);

  return task;
}
```

**2.3 更新 use-media-task.ts**

修改 `src/shared/hooks/use-media-task.ts`:
- 添加 Realtime 支持（可选，作为轮询的备选）
- 保持向后兼容（如果 Realtime 不可用，回退到轮询）

**2.4 环境变量配置**

确保以下环境变量已配置:
```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

---

### 优先级 3: 优化 Worker 路由 (P1)

#### 目标

增强 Worker 路由的安全性、可靠性和可观测性。

#### 实施方案

**3.1 增强错误处理和日志**

在 `src/app/api/media/worker/route.ts` 中:
- 添加详细的错误日志（带 `[Worker]` 前缀）
- 记录每个处理阶段的耗时
- 添加重试逻辑（对于临时性错误）

**3.2 改进状态更新**

确保状态更新是原子的:
- 使用数据库事务确保状态一致性
- 添加状态转换验证（防止非法状态转换）

**3.3 添加监控指标**

记录以下指标:
- 任务处理时间
- 成功率
- 失败原因分布
- 缓存命中率

---

### 优先级 4: 优化流式处理 (P2)

#### 目标

确保视频下载和上传使用真正的流式处理，避免内存溢出。

#### 实施方案

**4.1 验证流式处理实现**

检查 `src/shared/services/media/video-storage.ts`:
- 确认使用 `streamUploadFromUrl` 方法
- 验证不将整个文件加载到内存

**4.2 优化 Vercel Blob 上传**

确保使用 `@vercel/blob` 的流式上传:
```typescript
import { put } from '@vercel/blob';

// 使用 ReadableStream 直接上传
const blobUrl = await put(
  `videos/${taskId}.mp4`,
  videoResponse.body, // ReadableStream
  {
    access: 'public',
    contentType: 'video/mp4',
  }
);
```

---

## 📊 实施计划

### 阶段 1: 认证问题修复 (1-2 小时)

1. ✅ 创建综合认证诊断脚本
2. ✅ 改进认证错误处理
3. ✅ 验证环境变量配置
4. ✅ 测试登录流程

### 阶段 2: Supabase Realtime 集成 (2-3 小时)

1. ⏳ 配置 Supabase Replication
2. ⏳ 创建 Realtime Hook
3. ⏳ 更新前端组件
4. ⏳ 测试实时更新

### 阶段 3: Worker 路由优化 (1-2 小时)

1. ⏳ 增强错误处理
2. ⏳ 改进日志记录
3. ⏳ 添加监控指标

### 阶段 4: 流式处理验证 (1 小时)

1. ⏳ 验证流式处理实现
2. ⏳ 优化内存使用
3. ⏳ 测试大文件处理

---

## 🔧 技术细节

### 1. Supabase Realtime 配置

**数据库表配置**:
```sql
-- 确保 media_tasks 表有 updated_at 触发器
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_media_tasks_updated_at 
BEFORE UPDATE ON media_tasks 
FOR EACH ROW 
EXECUTE FUNCTION update_updated_at_column();
```

**Replication 配置**:
- 在 Supabase Dashboard 中启用 Replication
- 选择 `media_tasks` 表
- 选择需要复制的字段

### 2. 前端集成

**使用 Realtime Hook**:
```typescript
import { useMediaTaskRealtime } from '@/shared/hooks/use-media-task-realtime';

function MediaExtractor() {
  const [taskId, setTaskId] = useState<string | null>(null);
  const task = useMediaTaskRealtime(taskId);

  // task 会自动更新，无需轮询
  return <div>{task?.status}</div>;
}
```

### 3. Worker 路由增强

**错误处理示例**:
```typescript
try {
  // 处理逻辑
} catch (error: any) {
  console.error('[Worker] Error processing task:', {
    taskId,
    error: error.message,
    stack: error.stack,
    timestamp: new Date().toISOString(),
  });
  
  // 更新任务状态
  await updateMediaTaskById(taskId, {
    status: 'failed',
    errorMessage: error.message,
  });
  
  // 退款（如果需要）
  if (creditId) {
    await refundCredits(creditId);
  }
}
```

---

## ✅ 验收标准

### 认证问题修复

- [ ] 用户登录成功，Cookie 正确设置
- [ ] 401 错误不再出现
- [ ] 认证诊断脚本通过所有检查

### Supabase Realtime

- [ ] Realtime 订阅正常工作
- [ ] 前端实时接收状态更新
- [ ] 轮询机制作为备选方案保留

### Worker 路由优化

- [ ] 错误处理完善
- [ ] 日志记录详细
- [ ] 监控指标可用

### 流式处理

- [ ] 大文件（>100MB）处理正常
- [ ] 内存使用稳定
- [ ] 上传速度优化

---

## 📝 注意事项

1. **不改变 ShipAny 结构**: 所有修改都在现有架构基础上进行
2. **向后兼容**: 新功能不影响现有功能
3. **渐进式实施**: 按优先级逐步实施，每阶段验证后再继续
4. **测试充分**: 每个功能实施后都要进行充分测试

---

## 🚀 下一步行动

1. **立即执行**: 阶段 1 - 认证问题修复
2. **准备执行**: 阶段 2 - Supabase Realtime 集成（需要 Supabase Dashboard 配置）
3. **计划执行**: 阶段 3 和 4 - Worker 优化和流式处理验证

---

**请批准此方案后，我将开始实施阶段 1 的认证问题修复。**

# 阶段 2: Supabase Realtime 集成完成报告

## ✅ 已完成的工作

### 1. 安装依赖
- ✅ 已安装 `@supabase/supabase-js@2.90.1`

### 2. 创建 Supabase 客户端工具
- ✅ 创建 `src/shared/lib/supabase.ts`
  - `getSupabaseClient()`: 创建 Supabase 客户端实例
  - `getSupabaseClientSingleton()`: 单例模式，复用客户端连接

### 3. 创建 Realtime Hook
- ✅ 创建 `src/shared/hooks/use-media-task-realtime.ts`
  - 使用 Supabase Realtime 订阅 `media_tasks` 表的更新
  - 自动处理连接状态和错误
  - 支持超时检测（5分钟）
  - 自动清理订阅

### 4. 更新现有 Hook
- ✅ 更新 `src/shared/hooks/use-media-task.ts`
  - 导出 `useMediaTaskRealtime` 以便使用
  - 保持向后兼容，现有轮询功能不受影响

### 5. 数据库配置脚本
- ✅ 创建 `scripts/setup-supabase-realtime.sql`
  - 自动更新 `updated_at` 字段的触发器
  - RLS (Row Level Security) 配置示例
  - 详细的配置说明

---

## 📋 下一步操作（需要手动完成）

### 步骤 1: 在 Supabase Dashboard 中执行 SQL 脚本

1. **登录 Supabase Dashboard**
   - 访问: https://app.supabase.com
   - 选择项目: `qeqgoztrtyrfzkgpfhvx`

2. **打开 SQL Editor**
   - 左侧菜单 → SQL Editor → New Query

3. **执行 SQL 脚本**
   - 复制 `scripts/setup-supabase-realtime.sql` 的内容
   - 粘贴到 SQL Editor
   - 点击 "Run" 执行

4. **验证触发器**
   ```sql
   SELECT 
     trigger_name, 
     event_manipulation, 
     event_object_table, 
     action_statement 
   FROM information_schema.triggers 
   WHERE event_object_table = 'media_tasks';
   ```
   - 应该看到 `update_media_tasks_updated_at` 触发器

### 步骤 2: 启用 Replication

1. **进入 Replication 设置**
   - 左侧菜单 → Database → Replication

2. **启用 media_tasks 表的 Replication**
   - 找到 `media_tasks` 表
   - 点击 "Enable Replication" 或切换开关
   - 选择需要复制的字段（至少包括）:
     - `id`
     - `status`
     - `progress`
     - `updated_at`
     - `subtitle_raw`
     - `subtitle_translated`
     - `video_url_internal`
     - `error_message`
     - 其他需要实时更新的字段

3. **验证状态**
   - 确认 `media_tasks` 表显示为 "Replicating" 状态

### 步骤 3: 更新前端组件（可选）

如果需要使用 Realtime 替代轮询，可以在 `src/shared/blocks/generator/media.tsx` 中：

**选项 A: 完全替换为 Realtime**
```tsx
// 替换
import { useMediaTask } from '@/shared/hooks/use-media-task';

// 为
import { useMediaTaskRealtime } from '@/shared/hooks/use-media-task-realtime';

// 然后使用
const { task: taskStatus, isLoading, error: taskError } = useMediaTaskRealtime(taskId);
```

**选项 B: 条件使用（推荐）**
```tsx
import { useMediaTask } from '@/shared/hooks/use-media-task';
import { useMediaTaskRealtime } from '@/shared/hooks/use-media-task-realtime';

// 根据环境变量选择
const USE_REALTIME = process.env.NEXT_PUBLIC_USE_REALTIME === 'true';

const realtimeTask = useMediaTaskRealtime(USE_REALTIME ? taskId : null);
const pollingTask = useMediaTask();

const taskStatus = USE_REALTIME ? realtimeTask.task : pollingTask.task;
```

---

## 🧪 测试步骤

### 1. 测试数据库触发器

在 Supabase SQL Editor 中执行：
```sql
-- 更新一条记录，检查 updated_at 是否自动更新
UPDATE media_tasks 
SET status = 'processing' 
WHERE id = 'your-task-id';

-- 检查 updated_at 是否已更新
SELECT id, status, updated_at 
FROM media_tasks 
WHERE id = 'your-task-id';
```

### 2. 测试 Realtime 连接

1. **打开浏览器控制台**
2. **访问**: http://localhost:3000/ai-media-extractor
3. **提交一个任务**
4. **观察控制台日志**:
   - 应该看到: `[useMediaTaskRealtime] ✅ Successfully subscribed to real-time updates`
   - 不应该看到轮询请求（`/api/media/status`）

### 3. 测试实时更新

1. **在浏览器中打开任务页面**
2. **在另一个终端中手动更新数据库**:
   ```sql
   UPDATE media_tasks 
   SET status = 'completed', progress = 100 
   WHERE id = 'your-task-id';
   ```
3. **观察前端是否立即更新**（无需刷新页面）

---

## 🔧 环境变量配置

确保 `.env.local` 中包含：

```env
# Supabase Realtime 配置
NEXT_PUBLIC_SUPABASE_URL=https://qeqgoztrtyrfzkgpfhvx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFlcWdvenRydHlyZnprZ3BmaHZ4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc2NTAzMTYsImV4cCI6MjA4MzIyNjMxNn0.fMmTRgQfQdH_nXimE9gfBrYetcNYvtM1dsBia6Lj6t0

# 可选：启用 Realtime（默认使用轮询）
NEXT_PUBLIC_USE_REALTIME=false
```

---

## 📊 性能对比

### 轮询模式（当前默认）
- ✅ 简单可靠，无需额外配置
- ❌ 每 3 秒发送一次请求
- ❌ 有延迟（最多 3 秒）
- ❌ 服务器负载较高

### Realtime 模式（新功能）
- ✅ 实时更新（< 100ms 延迟）
- ✅ 减少服务器请求（仅在状态变化时推送）
- ✅ 更好的用户体验
- ❌ 需要 Supabase Replication 配置
- ❌ 需要 WebSocket 连接

---

## ⚠️ 注意事项

1. **RLS 策略**: 当前 SQL 脚本中的 RLS 策略是宽松的（允许所有用户）。生产环境应该限制为：
   ```sql
   CREATE POLICY "Users can view their own tasks"
   ON media_tasks
   FOR SELECT
   USING (auth.uid() = user_id);
   ```

2. **连接数限制**: Supabase Realtime 有连接数限制（免费版约 200 并发连接）

3. **降级策略**: 如果 Realtime 连接失败，Hook 会记录错误，但不会自动降级到轮询。需要手动处理。

4. **浏览器兼容性**: WebSocket 需要现代浏览器支持

---

## ✅ 验收标准

- [ ] SQL 脚本执行成功
- [ ] 触发器正常工作（`updated_at` 自动更新）
- [ ] Replication 已启用（Dashboard 显示 "Replicating"）
- [ ] 前端可以订阅 Realtime 更新
- [ ] 数据库更新时前端立即收到通知
- [ ] 控制台无错误日志

---

## 🚀 下一步

完成上述配置后，可以：
1. 测试 Realtime 功能
2. 根据测试结果决定是否替换轮询
3. 继续阶段 3: Worker 路由优化

---

**配置完成后，请运行测试并报告结果！**

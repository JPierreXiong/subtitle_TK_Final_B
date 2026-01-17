# 📋 Supabase Realtime 配置完整指南

**配置时间**: 2026-01-17  
**功能**: 实时更新 media_tasks 表状态，替代轮询机制

---

## 🎯 配置目标

1. ✅ 在 Supabase 数据库中配置触发器（自动更新 `updated_at`）
2. ✅ 启用 Row Level Security (RLS) 策略
3. ✅ 在 Supabase Dashboard 中启用 Replication
4. ✅ 测试实时更新功能

---

## 📋 步骤 1: 执行 SQL 脚本

### 1.1 登录 Supabase Dashboard

1. 访问: https://app.supabase.com
2. 选择您的项目: `qeqgoztrtyrfzkgpfhvx`
3. 进入 **SQL Editor**

### 1.2 执行 SQL 脚本

1. 打开 `scripts/setup-supabase-realtime.sql` 文件
2. 复制整个 SQL 脚本内容
3. 在 Supabase SQL Editor 中粘贴并执行

**脚本内容**:
```sql
-- 创建或替换更新 updated_at 的函数
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 删除已存在的触发器（如果存在）
DROP TRIGGER IF EXISTS update_media_tasks_updated_at ON media_tasks;

-- 创建触发器，在更新 media_tasks 表时自动更新 updated_at
CREATE TRIGGER update_media_tasks_updated_at 
BEFORE UPDATE ON media_tasks 
FOR EACH ROW 
EXECUTE FUNCTION update_updated_at_column();

-- 启用 RLS（如果尚未启用）
ALTER TABLE media_tasks ENABLE ROW LEVEL SECURITY;

-- 创建策略：允许用户查看自己的任务
CREATE POLICY "Users can view their own tasks"
ON media_tasks
FOR SELECT
USING (true); -- 临时允许所有用户查看（生产环境应限制为当前用户）

-- 创建策略：允许系统更新任务状态
CREATE POLICY "System can update tasks"
ON media_tasks
FOR UPDATE
USING (true); -- 临时允许所有更新（生产环境应限制为系统用户）
```

### 1.3 验证触发器

在 SQL Editor 中运行以下查询验证触发器：

```sql
SELECT 
  trigger_name, 
  event_manipulation, 
  event_object_table, 
  action_statement 
FROM information_schema.triggers 
WHERE event_object_table = 'media_tasks';
```

**预期结果**: 应该看到 `update_media_tasks_updated_at` 触发器

---

## 📋 步骤 2: 启用 Replication

### 2.1 在 Supabase Dashboard 中启用

1. 进入 **Database** → **Replication**
2. 找到 `media_tasks` 表
3. 点击 **Enable Replication** 或切换开关
4. 选择需要复制的字段（至少包括）:
   - ✅ `id`
   - ✅ `status`
   - ✅ `progress`
   - ✅ `updated_at`
   - ✅ `subtitle_raw`
   - ✅ `subtitle_translated`
   - ✅ `video_url_internal`
   - ✅ `error_message`
   - ✅ `title`
   - ✅ `author`
   - ✅ `platform`

### 2.2 验证 Replication 状态

在 **Database** → **Replication** 页面中：
- 确认 `media_tasks` 表显示为 **"Replicating"** 或 **"Enabled"**
- 如果显示为 **"Disabled"**，请点击启用

---

## 📋 步骤 3: 测试实时更新功能

### 3.1 使用测试脚本

运行测试脚本验证实时更新：

```bash
pnpm tsx scripts/test-realtime-updates.ts
```

### 3.2 手动测试步骤

1. **启动开发服务器**:
   ```bash
   pnpm dev
   ```

2. **打开前端页面**:
   - 访问: http://localhost:3000/ai-media-extractor
   - 提交一个媒体提取任务

3. **观察实时更新**:
   - 打开浏览器控制台（F12）
   - 查找 `[useMediaTaskRealtime]` 日志消息
   - 应该看到:
     - `✅ Successfully subscribed to real-time updates`
     - `Received real-time update:` (当任务状态变化时)

4. **验证状态更新**:
   - 任务状态应该实时更新，无需刷新页面
   - 进度条应该实时更新
   - 完成时应该显示成功提示

---

## 🔍 故障排查

### 问题 1: Realtime 订阅失败

**症状**: 控制台显示 `CHANNEL_ERROR`

**解决方案**:
1. 检查 Supabase Replication 是否已启用
2. 检查环境变量:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://qeqgoztrtyrfzkgpfhvx.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```
3. 检查 RLS 策略是否正确配置

### 问题 2: 没有收到实时更新

**症状**: 订阅成功但没有收到更新

**解决方案**:
1. 确认 `updated_at` 触发器正常工作
2. 确认 Replication 已启用
3. 检查数据库更新是否真的触发了（查看 Supabase Logs）

### 问题 3: RLS 策略阻止更新

**症状**: 更新失败，权限错误

**解决方案**:
1. 检查 RLS 策略是否正确
2. 临时使用 `USING (true)` 允许所有操作（仅用于测试）
3. 生产环境应限制为当前用户

---

## ✅ 验证清单

- [ ] SQL 脚本已执行（触发器已创建）
- [ ] RLS 已启用
- [ ] Replication 已启用（media_tasks 表）
- [ ] 环境变量已配置（NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY）
- [ ] 前端 Hook 已集成（useMediaTaskRealtime）
- [ ] 实时更新测试通过

---

## 📊 预期行为

### 配置成功后的行为

1. **任务提交后**:
   - 前端立即订阅实时更新
   - 控制台显示: `✅ Successfully subscribed to real-time updates`

2. **Worker 更新任务状态时**:
   - 前端立即收到更新（无需轮询）
   - 控制台显示: `Received real-time update:`
   - UI 自动更新（进度条、状态文本）

3. **任务完成时**:
   - 前端立即收到完成通知
   - 显示成功提示
   - 自动停止订阅

---

## 🚀 下一步

配置完成后：
1. 测试实时更新功能
2. 验证性能提升（减少 API 轮询请求）
3. 监控 Supabase Realtime 连接状态

---

**配置完成时间**: 待完成  
**状态**: ⏳ 等待配置

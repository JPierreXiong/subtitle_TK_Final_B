# 环境变量配置完成确认

## ✅ 已配置的环境变量

### QStash 配置
```env
QSTASH_URL=https://qstash.upstash.io
QSTASH_TOKEN=eyJVc2VySUQiOiIzNmRlMTBmYy04MzI5LTQ0MjEtOTRjYS0wNjE5MGM0YmEwYTYiLCJQYXNzd29yZCI6ImY3ODM0YWI5YWFjNjQ2ODQ4Y2YzNzliYWI4ODkwMWI0In0=
QSTASH_CURRENT_SIGNING_KEY=sig_4w6GALcpeNi9M46uAEkKVMCFbT7A
QSTASH_NEXT_SIGNING_KEY=sig_6cFSqmcZpCDciLEHfWnxqoZYGJiQ
```

### Supabase 配置
```env
NEXT_PUBLIC_SUPABASE_URL=https://qeqgoztrtyrfzkgpfhvx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFlcWdvenRydHlyZnprZ3BmaHZ4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc2NTAzMTYsImV4cCI6MjA4MzIyNjMxNn0.fMmTRgQfQdH_nXimE9gfBrYetcNYvtM1dsBia6Lj6t0
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_4iu6SMxpT_9mvPcPQkWzHA_VMbPrdIO
SUPABASE_URL=https://qeqgoztrtyrfzkgpfhvx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFlcWdvenRydHlyZnprZ3BmaHZ4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NzY1MDMxNiwiZXhwIjoyMDgzMjI2MzE2fQ.1nfAbadJkNFdbylFwiSzlTmp1SUJRymcVnbusrH9xkw
SUPABASE_JWT_SECRET=DLNmpYyZffgAbnR0Wj9KORdm1gkAtb5d6SYvVjK21evqZ0FVHj+G20pj7rn4QYmMu8sKrP8eWGve+Be+niT3QQ==
```

### 数据库配置（已存在）
```env
DATABASE_URL=postgres://postgres.qeqgoztrtyrfzkgpfhvx:Gnr04RysaFXjGNRF@aws-1-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require&pgbouncer=true
DATABASE_PROVIDER=postgresql
DB_SINGLETON_ENABLED=false
```

---

## 🔧 代码更新

### 1. QStash 客户端配置

**文件**: `src/app/api/media/submit/route.ts`

已更新为使用 `QSTASH_URL` 环境变量：

```typescript
const qstash = new Client({
  token: process.env.QSTASH_TOKEN || '',
  baseUrl: process.env.QSTASH_URL || 'https://qstash.upstash.io',
});
```

---

## ✅ 配置验证清单

- [x] QStash Token 已配置
- [x] QStash Signing Keys 已配置
- [x] Supabase URL 已配置
- [x] Supabase Anon Key 已配置
- [x] Supabase Service Role Key 已配置
- [x] 数据库连接 URL 已配置
- [x] QStash 客户端代码已更新

---

## 🚀 下一步：测试验证

### 1. 重启开发服务器

```bash
# 停止当前服务器（如果正在运行）
# 然后重新启动
pnpm dev
```

### 2. 测试基础握手

1. **提交测试任务**
   - 访问应用
   - 输入一个测试 URL（YouTube 或 TikTok）
   - 提交任务

2. **检查 QStash Dashboard**
   - 访问 [Upstash Console](https://console.upstash.com/)
   - 查看 QStash 任务队列
   - 确认任务已接收

3. **检查 Worker 日志**
   - 查看 Vercel 日志或本地控制台
   - 确认 Worker 路由被调用
   - 检查任务状态更新

4. **验证数据库**
   - 检查 `media_tasks` 表
   - 确认状态正确更新（pending → downloading → processing → extracted）

---

## ⚠️ 注意事项

### QStash 签名验证

如果遇到 `401 Unauthorized` 错误：

1. **检查 Signing Keys**
   - 确认 `QSTASH_CURRENT_SIGNING_KEY` 正确
   - 确认 `QSTASH_NEXT_SIGNING_KEY` 已配置（用于密钥轮换）

2. **检查 Body 解析顺序**
   - Worker 路由必须先验证签名，再解析 body
   - 代码中已正确实现：`await verifySignatureAppRouter(req);`

3. **检查环境变量加载**
   - 确保 `.env.local` 文件在项目根目录
   - 重启开发服务器以加载新环境变量

### Supabase Realtime

如果需要使用 Supabase Realtime 替代轮询：

1. **启用 Replication**
   - 在 Supabase Dashboard → Database → Replication
   - 为 `media_tasks` 表启用 Replication

2. **前端集成**
   - 使用 `@supabase/supabase-js` 客户端
   - 订阅 `media_tasks` 表的变化

---

## 📝 配置完成时间

**配置时间**: 2024-12-25  
**状态**: ✅ 环境变量已配置，代码已更新

---

**准备就绪，可以开始测试！** 🎉

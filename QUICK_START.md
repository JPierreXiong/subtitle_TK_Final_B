# 🚀 快速启动指南

## ✅ 当前状态

- ✅ 环境变量已配置到 `.env.local`
- ✅ 代码已更新（QStash + Worker 路由）
- ✅ 开发服务器已启动

---

## 📋 Vercel 环境变量配置

### 方法：使用 Vercel Dashboard（最简单）

1. **访问**: https://vercel.com/dashboard
2. **登录**: 使用 Token `rF4aDNj4aTRotWfhKQAzVNQd`（如果需要）
3. **选择项目** → **Settings** → **Environment Variables**
4. **添加以下环境变量**:

#### 必需的环境变量

```env
# QStash
QSTASH_URL=https://qstash.upstash.io
QSTASH_TOKEN=eyJVc2VySUQiOiIzNmRlMTBmYy04MzI5LTQ0MjEtOTRjYS0wNjE5MGM0YmEwYTYiLCJQYXNzd29yZCI6ImY3ODM0YWI5YWFjNjQ2ODQ4Y2YzNzliYWI4ODkwMWI0In0=
QSTASH_CURRENT_SIGNING_KEY=sig_4w6GALcpeNi9M46uAEkKVMCFbT7A
QSTASH_NEXT_SIGNING_KEY=sig_6cFSqmcZpCDciLEHfWnxqoZYGJiQ

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://qeqgoztrtyrfzkgpfhvx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFlcWdvenRydHlyZnprZ3BmaHZ4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc2NTAzMTYsImV4cCI6MjA4MzIyNjMxNn0.fMmTRgQfQdH_nXimE9gfBrYetcNYvtM1dsBia6Lj6t0
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFlcWdvenRydHlyZnprZ3BmaHZ4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NzY1MDMxNiwiZXhwIjoyMDgzMjI2MzE2fQ.1nfAbadJkNFdbylFwiSzlTmp1SUJRymcVnbusrH9xkw

# Database
DATABASE_URL=postgres://postgres.qeqgoztrtyrfzkgpfhvx:Gnr04RysaFXjGNRF@aws-1-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require&pgbouncer=true
DATABASE_PROVIDER=postgresql
DB_SINGLETON_ENABLED=false
```

#### ⚠️ 重要：部署后更新

```env
# 部署后，将 URL 更新为实际的 Vercel 部署 URL
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app
```

5. **选择环境**: 为每个变量选择 **Production, Preview, Development**（全选）

---

## 🧪 本地测试

### 1. 访问应用

打开浏览器访问: **http://localhost:3000**

### 2. 测试任务提交

1. 输入一个 YouTube 或 TikTok URL
2. 点击提交
3. 应该立即返回 202 Accepted 和 `taskId`

### 3. 检查日志

查看控制台输出：
- ✅ QStash 任务推送成功
- ✅ Worker 路由被调用（如果 QStash 配置正确）
- ✅ 任务状态更新

### 4. 检查 QStash Dashboard

访问: https://console.upstash.com/
- 查看 QStash → Messages
- 确认任务已入队

---

## 📝 注意事项

### 本地开发

- ✅ 本地使用 `.env.local` 中的环境变量
- ✅ 如果 `QSTASH_TOKEN` 未配置，会自动 fallback 到直接处理
- ✅ 开发服务器已启动在 `http://localhost:3000`

### Vercel 部署

- ⚠️ 必须在 Vercel Dashboard 中配置环境变量
- ⚠️ `NEXT_PUBLIC_APP_URL` 必须设置为实际部署 URL
- ⚠️ 配置后需要重新部署项目

---

## 🎯 下一步

1. **本地测试**: 访问 http://localhost:3000 测试功能
2. **配置 Vercel**: 在 Vercel Dashboard 添加环境变量
3. **部署测试**: 部署到 Vercel 并测试生产环境

---

**开发服务器已启动！可以开始测试了！** 🎉

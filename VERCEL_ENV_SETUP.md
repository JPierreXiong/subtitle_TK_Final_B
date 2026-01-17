# Vercel 环境变量配置指南

## 🚀 快速配置方法

### 方法一：使用 Vercel Dashboard（推荐）

1. **访问 Vercel Dashboard**
   - 打开 https://vercel.com/dashboard
   - 使用 Token: `rF4aDNj4aTRotWfhKQAzVNQd` 登录（如果需要）

2. **选择项目**
   - 找到你的项目（subtitle_TK_Final_F 或类似名称）

3. **进入环境变量设置**
   - 点击项目 → Settings → Environment Variables

4. **批量添加环境变量**

复制以下环境变量并添加到 Vercel：

#### QStash 配置
```
QSTASH_URL=https://qstash.upstash.io
QSTASH_TOKEN=eyJVc2VySUQiOiIzNmRlMTBmYy04MzI5LTQ0MjEtOTRjYS0wNjE5MGM0YmEwYTYiLCJQYXNzd29yZCI6ImY3ODM0YWI5YWFjNjQ2ODQ4Y2YzNzliYWI4ODkwMWI0In0=
QSTASH_CURRENT_SIGNING_KEY=sig_4w6GALcpeNi9M46uAEkKVMCFbT7A
QSTASH_NEXT_SIGNING_KEY=sig_6cFSqmcZpCDciLEHfWnxqoZYGJiQ
```

#### Supabase 配置
```
NEXT_PUBLIC_SUPABASE_URL=https://qeqgoztrtyrfzkgpfhvx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFlcWdvenRydHlyZnprZ3BmaHZ4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc2NTAzMTYsImV4cCI6MjA4MzIyNjMxNn0.fMmTRgQfQdH_nXimE9gfBrYetcNYvtM1dsBia6Lj6t0
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_4iu6SMxpT_9mvPcPQkWzHA_VMbPrdIO
SUPABASE_URL=https://qeqgoztrtyrfzkgpfhvx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFlcWdvenRydHlyZnprZ3BmaHZ4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NzY1MDMxNiwiZXhwIjoyMDgzMjI2MzE2fQ.1nfAbadJkNFdbylFwiSzlTmp1SUJRymcVnbusrH9xkw
SUPABASE_JWT_SECRET=DLNmpYyZffgAbnR0Wj9KORdm1gkAtb5d6SYvVjK21evqZ0FVHj+G20pj7rn4QYmMu8sKrP8eWGve+Be+niT3QQ==
```

#### 数据库配置
```
DATABASE_URL=postgres://postgres.qeqgoztrtyrfzkgpfhvx:Gnr04RysaFXjGNRF@aws-1-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require&pgbouncer=true
DATABASE_PROVIDER=postgresql
DB_SINGLETON_ENABLED=false
```

#### 应用配置（重要：需要更新为实际部署 URL）
```
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app
```

**注意**: `NEXT_PUBLIC_APP_URL` 需要设置为你的实际 Vercel 部署 URL（例如：`https://subtitle-tk.vercel.app`）

5. **选择环境**
   - 为每个变量选择环境：Production, Preview, Development
   - 建议：所有变量都选择所有环境

---

### 方法二：使用 Vercel CLI

如果 Vercel CLI 正常工作，可以使用以下命令：

```bash
# 设置 QStash
vercel env add QSTASH_URL production
vercel env add QSTASH_TOKEN production
vercel env add QSTASH_CURRENT_SIGNING_KEY production
vercel env add QSTASH_NEXT_SIGNING_KEY production

# 设置 Supabase
vercel env add NEXT_PUBLIC_SUPABASE_URL production
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
vercel env add SUPABASE_SERVICE_ROLE_KEY production
# ... 其他变量
```

---

## ⚠️ 重要提示

### 1. NEXT_PUBLIC_APP_URL

**必须更新为实际的 Vercel 部署 URL**，因为 QStash 需要这个 URL 来回调 Worker 路由。

获取方法：
1. 部署项目到 Vercel
2. 在 Vercel Dashboard 查看部署 URL
3. 更新 `NEXT_PUBLIC_APP_URL` 环境变量

### 2. 环境变量作用域

- **Production**: 生产环境
- **Preview**: 预览环境（PR 部署）
- **Development**: 本地开发（通过 `vercel dev`）

建议：所有关键变量都设置为所有环境。

---

## 🧪 验证配置

配置完成后：

1. **重新部署项目**
   - 在 Vercel Dashboard 点击 "Redeploy"
   - 或推送代码触发自动部署

2. **检查环境变量**
   - 在部署日志中检查环境变量是否加载
   - 检查是否有相关错误

3. **测试功能**
   - 访问部署的应用
   - 提交测试任务
   - 检查 QStash Dashboard 确认任务入队

---

## 📝 配置清单

- [ ] QStash 环境变量已添加
- [ ] Supabase 环境变量已添加
- [ ] 数据库环境变量已添加
- [ ] `NEXT_PUBLIC_APP_URL` 已更新为实际部署 URL
- [ ] 所有变量已设置为正确的环境（Production/Preview/Development）
- [ ] 项目已重新部署
- [ ] 功能测试通过

---

**配置完成后，可以开始测试异步处理功能！** 🎉

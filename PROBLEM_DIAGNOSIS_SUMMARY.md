# 问题诊断总结报告

## 📋 问题概述

**错误信息**: `FAILED_TO_GET_SESSION`

**错误位置**: `src/shared/models/user.ts` 的 `getSignUser()` 函数

**错误代码**: `{"code":"FAILED_TO_GET_SESSION","message":"Failed to get session"}`

---

## 🔍 已完成的调查

### ✅ 1. 数据库连接检查
- **状态**: ✅ 正常
- **测试脚本**: `scripts/test-db-connection.ts`
- **结果**: Supabase 连接成功，better-auth 表存在

### ✅ 2. 代码改进
- **位置**: `src/shared/models/user.ts`
- **改进内容**:
  - 添加 try-catch 错误捕获
  - 添加详细错误日志
  - 区分数据库错误和会话不存在
  - 会话不存在时返回 `null`（正常业务状态）

---

## 🎯 潜在问题分析（待排查）

### 问题 1: Headers/Cookie 传递问题 ⚠️

#### 可能原因
- **Cookie 未正确传递到服务器**
- **代理层（Nginx/Vercel Edge）过滤了 Cookie 头**
- **CORS/SameSite 策略阻止 Cookie 传递**

#### 排查步骤

**A. 检查浏览器 Cookie**
1. 打开浏览器开发者工具 (F12)
2. Application → Cookies → `http://localhost:3000`
3. 查找 `better-auth.session_token`
4. **预期**: 如果用户已登录，应该存在；如果不存在，说明未登录或 Cookie 被清除

**B. 检查请求头传递**

在服务器日志中查找：
```typescript
// 在 getSignUser() 中添加（临时调试）
const headersList = await headers();
const cookieHeader = headersList.get('cookie');
console.debug('[getSignUser] Cookie header:', cookieHeader?.substring(0, 100));
```

**检查点**:
- ✅ Cookie 是否完整传递到服务器
- ✅ Cookie 格式是否正确（`better-auth.session_token=xxx; ...`）
- ✅ 是否存在多个 Cookie（可能冲突）

---

### 问题 2: AUTH_URL 与域名不匹配 ⚠️

#### 可能原因
- **AUTH_URL 与实际访问地址不一致**
- **域名校验失败（localhost vs 127.0.0.1）**
- **端口号不一致**

#### 排查步骤

**A. 检查环境变量一致性**

```bash
# 检查 .env.local
grep -E "AUTH_URL|NEXT_PUBLIC_APP_URL" .env.local
```

**预期配置**:
```env
AUTH_URL=http://localhost:3000
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

**常见问题**:
- ❌ `AUTH_URL=http://localhost:3000` 但通过 `http://127.0.0.1:3000` 访问
- ❌ `AUTH_URL` 包含端口但访问地址不包含（或反之）
- ❌ 生产环境 `AUTH_URL` 与实际域名不匹配

**B. 验证 better-auth baseURL 配置**

查看 `src/core/auth/config.ts`:
```typescript
baseURL: envConfigs.auth_url,  // 必须与实际访问地址完全匹配
trustedOrigins: envConfigs.app_url ? [envConfigs.app_url] : [],
```

**验证方法**:
1. 确保访问地址与 `AUTH_URL` 完全匹配（包括协议、域名、端口）
2. 本地开发时统一使用 `http://localhost:3000`（避免使用 `127.0.0.1`）

---

### 问题 3: AUTH_SECRET 变更 🔴

#### 可能原因
- **AUTH_SECRET 在用户登录后被更改**
- **不同环境文件使用不同的 AUTH_SECRET**
- **AUTH_SECRET 格式不正确**

#### 排查步骤

**A. 检查 AUTH_SECRET 一致性**

```bash
# 检查当前值
grep AUTH_SECRET .env.local

# 检查是否有多个环境文件使用不同的值
grep AUTH_SECRET .env* 2>/dev/null
```

**预期结果**:
- ✅ 所有环境（`.env.local`, `.env.development`, `.env.production`）应该使用**相同的** `AUTH_SECRET`
- ✅ `AUTH_SECRET` 应该是 base64 编码的随机字符串（长度 >= 32 字符）

**关键点**:
- 🔒 **不要**在生产环境中随意更改 `AUTH_SECRET`（会导致所有现有 session 失效）
- 🔄 如需轮换，需要先让所有用户重新登录
- 📝 使用版本控制记录 `AUTH_SECRET` 变更历史（但不要提交真实值到 Git）

**B. 验证 AUTH_SECRET 格式**

```bash
# AUTH_SECRET 应该是 base64 编码
# 长度通常为 32-64 字符
echo $AUTH_SECRET | wc -c  # 应该 >= 32
```

---

### 问题 4: 异步竞争条件 (Race Condition) ⚠️

#### 可能原因
- **signOut() 调用后立即刷新页面**
- **Cookie 删除是异步的（浏览器端）**
- **session 删除是同步的（数据库）**
- **导致时序不一致**

#### 排查步骤

**A. 检查 signOut 流程**

查看 `src/shared/blocks/sign/sign-user.tsx`:
```typescript
signOut({
  fetchOptions: {
    onSuccess: () => {
      router.push('/');  // ⚠️ 可能在 Cookie 删除前就跳转
    },
  },
})
```

**时间线问题**:
1. 用户点击 "登出"
2. `signOut()` 调用 `/api/auth/sign-out`
3. 后端删除 session（数据库）✅
4. **但 Cookie 删除是异步的**（浏览器端）⏱️
5. 如果页面立即刷新或跳转，可能携带旧的 Cookie ❌
6. 新请求到达服务器，Cookie 中的 session token 已失效
7. → `FAILED_TO_GET_SESSION`

**改进建议**:
```typescript
signOut({
  fetchOptions: {
    onSuccess: async () => {
      // 等待一小段时间确保 Cookie 被清除
      await new Promise(resolve => setTimeout(resolve, 200));
      router.push('/');
      // 或者使用强制刷新（推荐）
      // window.location.href = '/';
    },
  },
})
```

---

### 问题 5: Session 表结构不匹配 ⚠️

#### 可能原因
- **better-auth 版本升级但迁移未执行**
- **表结构不完整或字段类型不匹配**
- **数据库 schema 与代码不同步**

#### 排查步骤

**A. 检查 session 表结构**

运行诊断脚本：
```bash
pnpm tsx scripts/diagnose-auth-issues.ts
```

**或直接查询数据库**:
```sql
-- 连接到 Supabase，执行：
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'session'
ORDER BY ordinal_position;
```

**必需字段**:
- `id` (主键)
- `expiresAt` (过期时间)
- `token` (session token)
- `userId` (外键到 user 表)
- `ipAddress` (可选)
- `userAgent` (可选)

**如果结构不匹配**:
```bash
# 重新运行迁移
pnpm db:migrate
# 或
pnpm db:push
```

---

### 问题 6: 异步程序（QStash Worker）相关问题 ⚠️

#### 可能原因
- **QStash Worker 在获取 session 时失败**
- **Worker 路由缺少用户认证**
- **QStash 回调时 session 已过期**

#### 排查步骤

**A. 检查 Worker 路由**

查看 `src/app/api/media/worker/route.ts`:
- ✅ QStash 签名验证（`verifySignatureAppRouter`）
- ❌ **但可能没有处理 session 获取错误**

**关键点**:
- Worker 路由通常不需要用户 session（因为任务已经创建）
- 但如果 worker 需要访问用户信息，可能导致 `FAILED_TO_GET_SESSION`

**B. 检查 QStash 回调 URL**

```typescript
await qstash.publishJSON({
  url: `${process.env.NEXT_PUBLIC_APP_URL}/api/media/worker`,
  // ⚠️ 如果 NEXT_PUBLIC_APP_URL 与 AUTH_URL 不匹配，可能导致 Cookie 问题
});
```

**验证**:
- ✅ 确保 `NEXT_PUBLIC_APP_URL` 与 `AUTH_URL` 一致
- ✅ 确保 QStash 回调 URL 是可访问的

---

## 📊 诊断脚本结果

### 运行诊断脚本

```bash
pnpm tsx scripts/diagnose-auth-issues.ts
```

### 诊断脚本检查项

1. ✅ **环境变量检查**
   - AUTH_SECRET 是否存在且长度足够
   - AUTH_URL 是否配置
   - URL 一致性检查
   - DATABASE_URL 是否配置

2. ✅ **数据库连接检查**
   - Supabase 连接测试
   - 查询执行测试

3. ✅ **Better-Auth 表检查**
   - Session 表结构验证
   - 必需列存在性检查
   - 活跃会话统计

4. ✅ **Better-Auth 配置检查**
   - Auth 实例初始化
   - 数据库适配器配置

5. ✅ **Cookie 配置检查**
   - HTTPS 检查（生产环境）
   - 域名配置验证

6. ✅ **Session 有效性检查**
   - 过期会话统计
   - 孤儿会话检查（无关联用户）

---

## 💡 推荐的排查顺序

### 第一步：运行诊断脚本
```bash
pnpm tsx scripts/diagnose-auth-issues.ts
```
查看所有检查项的通过/失败状态。

### 第二步：检查浏览器 Cookie
在开发者工具中确认 `better-auth.session_token` 是否存在。

### 第三步：检查环境变量一致性
确保 `AUTH_URL`、`NEXT_PUBLIC_APP_URL` 与实际访问地址完全匹配。

### 第四步：查看服务器日志
运行应用并触发错误，查看控制台中的 `[getSignUser] Error getting session:` 日志。

### 第五步：验证 AUTH_SECRET
确保 `AUTH_SECRET` 未被更改，且在所有环境文件中一致。

### 第六步：检查异步程序（QStash Worker）
确认 Worker 路由是否正确处理 session 相关操作。

---

## 🔧 临时调试代码（可选）

如果需要更详细的调试信息，可以临时在 `src/shared/models/user.ts` 中添加：

```typescript
export async function getSignUser() {
  try {
    const auth = await getAuth();
    const headersList = await headers();
    
    // 🔍 临时调试：检查 Cookie
    const cookieHeader = headersList.get('cookie');
    console.debug('[getSignUser] Cookie header present:', !!cookieHeader);
    if (cookieHeader) {
      const hasSessionToken = cookieHeader.includes('better-auth.session_token');
      console.debug('[getSignUser] Session token in cookie:', hasSessionToken);
      console.debug('[getSignUser] Cookie preview:', cookieHeader.substring(0, 100) + '...');
    }
    
    const session = await auth.api.getSession({
      headers: headersList,
    });

    console.debug('[getSignUser] Session retrieved:', !!session);
    return session?.user;
  } catch (error: any) {
    // ... 现有错误处理
  }
}
```

**注意**: 调试完成后应移除这些日志，避免生产环境泄露敏感信息。

---

## 📝 下一步行动

1. **运行诊断脚本** → 获取系统状态快照
2. **检查浏览器 Cookie** → 确认客户端状态
3. **验证环境变量** → 确保配置正确
4. **查看详细日志** → 定位具体错误原因
5. **根据结果调整** → 修复发现的问题

---

## 🎯 预期结果

完成所有检查后，应该能够：
- ✅ 确定 `FAILED_TO_GET_SESSION` 的具体原因
- ✅ 区分"正常业务情况"（用户未登录）和"系统错误"
- ✅ 获得明确的修复方向

---

**诊断脚本位置**: `scripts/diagnose-auth-issues.ts`

**诊断报告位置**: `AUTH_ISSUES_DIAGNOSIS_REPORT.md`

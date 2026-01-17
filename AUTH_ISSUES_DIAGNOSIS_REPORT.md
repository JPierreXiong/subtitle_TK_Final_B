# 认证问题诊断报告

## 📋 问题概述

**错误信息**: `FAILED_TO_GET_SESSION`

**影响范围**: 用户登录状态获取、会话管理

**严重程度**: 中等（已通过错误处理降级，但需要排查根因）

---

## 🔍 已完成的诊断检查

### 1. 数据库连接 ✅
- **状态**: 正常
- **测试**: Supabase 连接成功
- **表结构**: better-auth 表完整（`user`, `session`, `account`, `verification`）

### 2. 代码改进 ✅
- **位置**: `src/shared/models/user.ts` 的 `getSignUser()` 函数
- **改进**: 添加错误捕获和日志记录
- **效果**: 错误被降级为业务状态（返回 `null`），避免崩溃

---

## 🎯 待排查的潜在问题

### 问题 1: Headers/Cookie 传递问题

#### 症状
- `better-auth` 无法从请求头中获取 session token
- Cookie 可能在代理层被过滤

#### 排查步骤

**A. 检查浏览器 Cookie**
1. 打开浏览器开发者工具 (F12)
2. 切换到 **Application** 标签（Chrome）或 **Storage** 标签（Firefox）
3. 检查 **Cookies** → `http://localhost:3000`（或你的域名）
4. 查找以下 Cookie：
   - `better-auth.session_token`（主要 session token）
   - `better-auth._session`（可能的后备 token）

**预期结果**:
- ✅ 如果用户已登录，应该看到 `better-auth.session_token`
- ❌ 如果不存在，说明 Cookie 未设置或被清除

**B. 检查请求头传递**

在 `getSignUser()` 中添加调试日志（临时）：
```typescript
const headersList = await headers();
const cookieHeader = headersList.get('cookie');
console.debug('[getSignUser] Cookie header:', cookieHeader?.substring(0, 100) + '...');
```

**检查点**:
- Cookie 是否完整传递到服务器
- Cookie 格式是否正确（`better-auth.session_token=xxx; ...`）

#### 可能原因
1. **反向代理过滤**: Nginx/Vercel Edge 可能过滤了 Cookie 头
2. **CORS 配置**: 跨域请求时 Cookie 可能被阻止
3. **SameSite 策略**: Cookie 的 `SameSite` 属性可能阻止跨站传递

---

### 问题 2: AUTH_URL 与域名不匹配

#### 症状
- `better-auth` 拒绝解析 session token
- 域名校验失败

#### 排查步骤

**A. 检查环境变量一致性**

运行诊断脚本：
```bash
pnpm tsx scripts/diagnose-auth-issues.ts
```

**关键检查**:
```env
AUTH_URL=http://localhost:3000        # 应该与访问地址一致
NEXT_PUBLIC_APP_URL=http://localhost:3000  # 应该与 AUTH_URL 一致
```

**常见问题**:
- ❌ `AUTH_URL=http://localhost:3000` 但通过 `http://127.0.0.1:3000` 访问
- ❌ `AUTH_URL=https://prod.example.com` 但通过 `https://www.example.com` 访问
- ❌ `AUTH_URL` 包含端口但 `NEXT_PUBLIC_APP_URL` 不包含（或反之）

**B. 检查 better-auth baseURL 配置**

查看 `src/core/auth/config.ts`:
```typescript
baseURL: envConfigs.auth_url,  // 必须与实际访问地址匹配
trustedOrigins: envConfigs.app_url ? [envConfigs.app_url] : [],
```

**验证方法**:
1. 确保 `AUTH_URL` 与实际访问 URL 完全匹配（包括协议、域名、端口）
2. 本地开发时统一使用 `http://localhost:3000`（避免使用 `127.0.0.1`）

---

### 问题 3: AUTH_SECRET 变更

#### 症状
- 用户登录后，AUTH_SECRET 被更改
- 所有旧 session token 失效
- 导致 `FAILED_TO_GET_SESSION`

#### 排查步骤

**A. 检查 AUTH_SECRET 历史**

```bash
# 检查当前 AUTH_SECRET
grep AUTH_SECRET .env.local

# 检查是否有多个环境文件使用不同的值
grep AUTH_SECRET .env* 2>/dev/null
```

**关键点**:
- ✅ 所有环境（`.env.local`, `.env.development`, `.env.production`）应该使用**相同的** `AUTH_SECRET`
- ❌ 如果 `AUTH_SECRET` 被更改，所有现有 session 会失效

**B. 验证 AUTH_SECRET 格式**

```bash
# AUTH_SECRET 应该是 base64 编码的随机字符串
# 长度通常为 32-64 字符
echo $AUTH_SECRET | wc -c  # 应该 >= 32
```

**建议**:
- 🔒 **不要**在生产环境中随意更改 `AUTH_SECRET`
- 🔄 如需轮换，需要先让所有用户重新登录
- 📝 使用版本控制记录 `AUTH_SECRET` 变更历史（但不要提交真实值到 Git）

---

### 问题 4: 异步竞争条件 (Race Condition)

#### 症状
- `signOut()` 调用后立即刷新页面
- 旧的 Cookie 还未删除，但已失效
- 导致 `FAILED_TO_GET_SESSION`

#### 排查步骤

**A. 检查 signOut 流程**

查看 `src/shared/blocks/sign/sign-user.tsx`:
```typescript
signOut({
  fetchOptions: {
    onSuccess: () => {
      router.push('/');  // 可能在 Cookie 删除前就跳转
    },
  },
})
```

**时间线问题**:
1. 用户点击 "登出"
2. `signOut()` 调用 `/api/auth/sign-out`
3. 后端删除 session（数据库）
4. **但 Cookie 删除是异步的**（浏览器端）
5. 如果页面立即刷新或跳转，可能携带旧的 Cookie
6. 新请求到达服务器，Cookie 中的 session token 已失效
7. → `FAILED_TO_GET_SESSION`

**改进建议**:
- ✅ 在 `onSuccess` 回调中等待一小段时间（100-200ms）
- ✅ 或使用 `window.location.href = '/'` 强制全页面刷新（清除所有状态）

---

### 问题 5: Session 表结构不匹配

#### 症状
- better-auth 版本升级但迁移未执行
- 表结构不完整或字段类型不匹配

#### 排查步骤

**运行诊断脚本**:
```bash
pnpm tsx scripts/diagnose-auth-issues.ts
```

**检查点**:
- `session` 表是否存在必需的列：
  - `id` (主键)
  - `expiresAt` (过期时间)
  - `token` (session token)
  - `userId` (外键到 user 表)
  - `ipAddress` (可选)
  - `userAgent` (可选)

**验证方法**:
```sql
-- 连接到 Supabase 数据库，执行：
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'session' 
ORDER BY ordinal_position;
```

**如果结构不匹配**:
```bash
# 重新运行迁移
pnpm db:migrate
# 或
pnpm db:push
```

---

## 📊 诊断脚本使用

### 运行完整诊断

```bash
pnpm tsx scripts/diagnose-auth-issues.ts
```

### 诊断脚本检查项

1. ✅ **环境变量检查**
   - AUTH_SECRET 是否存在且长度足够
   - AUTH_URL 是否配置
   - URL 一致性检查

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
确保 `AUTH_URL` 和 `NEXT_PUBLIC_APP_URL` 匹配，且与实际访问地址一致。

### 第四步：查看服务器日志
运行应用并触发错误，查看控制台中的 `[getSignUser] Error getting session:` 日志。

### 第五步：验证 AUTH_SECRET
确保 `AUTH_SECRET` 未被更改，且在所有环境文件中一致。

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
    }
    
    const session = await auth.api.getSession({
      headers: headersList,
    });

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

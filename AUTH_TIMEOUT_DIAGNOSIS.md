# 认证超时问题诊断

## 🔍 问题分析

### 错误信息
```
Authentication timeout. Please try again.
```

### 触发位置
- **API**: `/api/media/submit`
- **函数**: `getUserInfoWithTimeout(4000)` (4 秒熔断器)
- **状态**: Cookie 存在 (`hasCookies: true`)，但仍超时

---

## 📊 可能原因

### 原因 1: 数据库查询缓慢 ⚠️

**问题**:
- `getSignUser()` 调用 `getAuth()` 和 `auth.api.getSession()`
- Better-auth 需要查询数据库验证 session
- 如果数据库查询超过 4 秒，会触发超时

**检查方法**:
1. 查看服务器日志中的 `[getSignUser]` 消息
2. 检查是否有数据库查询慢的警告
3. 验证 Supabase 连接池配置

**解决方案**:
- ✅ 已修复：`getSignUser()` 对数据库超时返回 `null`（优雅降级）
- ✅ 已添加：详细日志记录超时原因

---

### 原因 2: Cookie 解密失败 ⚠️

**问题**:
- Cookie 存在，但 AUTH_SECRET 不匹配或已变更
- Better-auth 无法解密 session token
- 解密过程可能耗时过长或失败

**检查方法**:
```bash
# 验证 AUTH_SECRET 是否正确
cat .env.local | grep AUTH_SECRET

# 检查是否所有环境文件使用相同的 AUTH_SECRET
grep AUTH_SECRET .env* 2>/dev/null
```

**解决方案**:
- ✅ 确保所有环境使用相同的 `AUTH_SECRET`
- ✅ 如果 AUTH_SECRET 变更，需要让用户重新登录

---

### 原因 3: Session 表查询缓慢 ⚠️

**问题**:
- Session 表数据量大或索引缺失
- Better-auth 查询 session 表时超时

**检查方法**:
```sql
-- 连接到 Supabase，执行：
SELECT COUNT(*) FROM session WHERE "expiresAt" > NOW();

-- 检查索引
SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'session';
```

**解决方案**:
- 清理过期的 session（定期维护）
- 确保 session 表有正确的索引

---

### 原因 4: 域名/Host 不匹配 ⚠️

**问题**:
- Cookie 存在，但 `AUTH_URL` 与请求 Host 不匹配
- Better-auth 拒绝解析 Cookie
- 解析过程可能耗时或失败

**检查方法**:
```bash
# 检查环境变量
cat .env.local | grep -E "AUTH_URL|NEXT_PUBLIC_APP_URL"

# 确保两者一致
AUTH_URL=http://localhost:3000
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

**解决方案**:
- ✅ 确保 `AUTH_URL` 与 `NEXT_PUBLIC_APP_URL` 完全一致
- ✅ 统一使用 `localhost`（不是 `127.0.0.1`）

---

## 🔧 已实施的修复

### 1. getSignUser() 错误处理改进 ✅

**`src/shared/models/user.ts`**:
- ✅ 添加超时检测（`timeout`、`ETIMEDOUT`）
- ✅ 添加数据库连接错误检测
- ✅ 超时时返回 `null`（优雅降级）而不是抛出错误
- ✅ 添加详细日志记录

### 2. Media Submit 错误处理改进 ✅

**`src/app/api/media/submit/route.ts`**:
- ✅ 改进超时错误日志
- ✅ 记录可能的原因（数据库查询慢、网络延迟等）

### 3. 注销测试修复 ✅

**`scripts/test-end-to-end.ts`**:
- ✅ 修复空响应体 JSON 解析错误
- ✅ 检查 `Content-Type` 头部
- ✅ 只解析非空响应体

---

## 🎯 诊断步骤

### 步骤 1: 检查服务器日志

查看服务器终端中的日志：

**成功日志**:
```
[getSignUser] Cookie header present: true
[getSignUser] Session token in cookie: true
[getSignUser] Session retrieved: true
```

**超时日志**:
```
[getSignUser] ⚠️  Database query timeout. Check database connection and network.
[Media Submit] Authentication timeout after 4s. Check database connection.
```

**错误日志**:
```
[getSignUser] Error getting session: {
  message: '...',
  code: 'FAILED_TO_GET_SESSION',
  ...
}
```

### 步骤 2: 验证环境变量

```bash
# 运行环境变量检查
pnpm tsx scripts/check-env.ts

# 验证关键变量
cat .env.local | grep -E "AUTH_SECRET|AUTH_URL|DATABASE_URL"
```

### 步骤 3: 测试数据库连接

```bash
# 运行数据库连接测试
pnpm tsx scripts/test-db-connection.ts
```

**预期结果**:
```
✅ Database connection successful!
✅ better-auth tables exist
```

### 步骤 4: 浏览器手动验证

1. 清除所有 Cookies
2. 访问 `http://localhost:3000`
3. 登录用户
4. 检查 Cookie (`better-auth.session_token`)
5. 提交媒体提取任务
6. 观察服务器日志中的 `[getSignUser]` 消息

---

## 💡 临时解决方案

### 如果超时持续发生

#### 方案 1: 增加超时时间（不推荐）

修改 `getUserInfoWithTimeout` 的超时时间：
```typescript
// 从 4000ms 增加到 8000ms
currentUser = await getUserInfoWithTimeout(8000);
```

**注意**: 这会增加 API 响应时间，不推荐。

#### 方案 2: 优化数据库查询（推荐）

检查并优化 session 表查询：
- 确保有正确的索引
- 清理过期的 session
- 检查数据库连接池配置

#### 方案 3: 使用缓存（推荐）

如果用户已登录，可以考虑缓存用户信息（短期缓存，1-5 分钟）。

---

## ✅ 预期结果

### 成功指标

1. ✅ **Cookie 正常传递**
   - `[getSignUser] Cookie header present: true`
   - `[getSignUser] Session token in cookie: true`

2. ✅ **Session 成功获取**
   - `[getSignUser] Session retrieved: true`
   - 无超时错误

3. ✅ **媒体提取成功**
   - 任务提交成功（返回 taskId）
   - 无认证超时错误

---

## 📝 下一步行动

### 1. 查看服务器日志

运行测试时，观察服务器日志中的：
- `[getSignUser]` 消息
- `[Media Submit]` 消息
- 数据库查询时间

### 2. 验证环境变量

```bash
pnpm tsx scripts/check-env.ts
```

### 3. 浏览器手动测试

1. 登录用户
2. 检查 Cookie
3. 提交媒体提取任务
4. 观察服务器日志

### 4. 如果仍超时

查看服务器日志中的详细错误信息，特别是：
- `[getSignUser] Error getting session:` 的完整日志
- 数据库连接相关的错误
- Better-auth 的内部错误

---

**诊断工具已就绪！** 🔧

按照上述步骤诊断，应该能定位认证超时的具体原因。

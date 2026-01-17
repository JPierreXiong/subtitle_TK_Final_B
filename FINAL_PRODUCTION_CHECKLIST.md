# 生产环境最终检查清单

## 🎯 上线前的最后一次复核

### 关键点 1: localhost vs 127.0.0.1

#### 问题
如果 `AUTH_URL=http://localhost:3000`，但通过 `http://127.0.0.1:3000` 访问，会导致 Cookie 无法匹配。

#### 检查步骤

**1. 检查环境变量**
```bash
cat .env.local | grep -E "AUTH_URL|NEXT_PUBLIC_APP_URL"
```

**预期配置**:
```env
AUTH_URL=http://localhost:3000
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

**❌ 错误配置**:
```env
AUTH_URL=http://localhost:3000      # ❌ localhost
NEXT_PUBLIC_APP_URL=http://127.0.0.1:3000  # ❌ 127.0.0.1
```

**✅ 正确配置**:
```env
AUTH_URL=http://localhost:3000
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

**2. 验证浏览器地址栏**
- ✅ 应该显示: `http://localhost:3000`
- ❌ 不应该显示: `http://127.0.0.1:3000`

**3. 服务端访问检查**
- ✅ 如果服务器通过 `fetch` 访问自身，使用 `localhost`
- ❌ 避免使用 `127.0.0.1`

#### 修复建议
```bash
# 确保所有 URL 使用相同的 hostname
sed -i 's/127.0.0.1/localhost/g' .env.local
```

---

### 关键点 2: Cookie 的 SameSite 与 Secure 属性

#### 问题
在本地开发（非 HTTPS）环境下，如果 Cookie 的 `Secure` 标志为 `true`，浏览器会拒绝在 `http` 协议下发送 Cookie。

#### 检查步骤

**1. 检查 Cookie 配置环境变量**
```bash
cat .env.local | grep -E "BETTER_AUTH_COOKIE|COOKIE_SECURE"
```

**2. 本地开发环境配置**
```env
# .env.local (本地开发)
BETTER_AUTH_COOKIE_SECURE=false  # ✅ 本地开发必须为 false（除非使用 HTTPS）
```

**3. 生产环境配置**
```env
# .env.production (生产环境)
BETTER_AUTH_COOKIE_SECURE=true   # ✅ 生产环境使用 HTTPS，应为 true
```

**4. 验证 Cookie 属性**
在浏览器开发者工具 (F12) 中：
1. Application → Cookies → `http://localhost:3000`
2. 查找 `better-auth.session_token`
3. 检查 Cookie 属性：
   - **Secure**: 本地开发应为 `false`，生产环境为 `true`
   - **SameSite**: 通常为 `Lax` 或 `None`
   - **HttpOnly**: 应为 `true`

#### 调试检查
在 `getSignUser()` 的日志中：
- ✅ 如果看到 `Cookie header present: true` → Cookie 正常传递
- ❌ 如果看到 `Cookie header present: false` → 可能是 `Secure` 配置问题

#### 修复建议
```typescript
// 在 src/shared/models/user.ts 中检查
const cookieHeader = headersList.get('cookie');
if (!cookieHeader && process.env.NODE_ENV === 'development') {
  const cookieSecure = process.env.BETTER_AUTH_COOKIE_SECURE;
  if (cookieSecure === 'true') {
    console.warn('[getSignUser] Cookie Secure=true but using HTTP! Cookies may not be sent.');
  }
}
```

---

### 关键点 3: 环境变量的"热重载"

#### 问题
Next.js 有时不会自动重新读取修改后的 `.env.local` 里的某些核心认证变量（如 `AUTH_SECRET`）。

#### 检查步骤

**1. 完全重启开发服务器**
```bash
# 1. 停止所有 Node.js 进程
Get-Process -Name node | Stop-Process -Force  # Windows
# 或
pkill -f node  # Linux/Mac

# 2. 清理 .next 目录（可选）
Remove-Item -Recurse -Force .next

# 3. 重新启动
pnpm dev
```

**2. 验证环境变量加载**
```bash
# 运行测试脚本验证
pnpm tsx scripts/test-auth-flow.ts
```

**3. 检查进程环境变量**
```bash
# Windows PowerShell
$env:AUTH_SECRET.Length  # 应该显示长度

# Linux/Mac
echo ${#AUTH_SECRET}  # 应该显示长度
```

#### 修复建议

**开发环境**:
```bash
# 每次修改 .env.local 后，完全重启
pnpm dev
```

**生产环境**:
```bash
# Vercel: 通过 Dashboard 更新环境变量后重新部署
# Docker: 重启容器
docker-compose restart
```

---

## 📋 Network 选项卡检查清单

### 运行测试时的验证步骤

#### 1. 登录成功后检查

**打开浏览器开发者工具 → Network 选项卡**

**检查 Response Headers**:
```
Set-Cookie: better-auth.session_token=xxx; Path=/; HttpOnly; SameSite=Lax; Secure=false
```

**关键点**:
- ✅ 应该看到 `set-cookie` 头部
- ✅ Cookie 名称应为 `better-auth.session_token`
- ✅ `Secure=false`（本地开发）或 `Secure=true`（生产环境）

#### 2. 获取 Session 时检查

**检查 Request Headers**:
```
Cookie: better-auth.session_token=xxx; ...
```

**关键点**:
- ✅ 应该看到 `Cookie` 头部
- ✅ 包含 `better-auth.session_token`
- ✅ Cookie 值应该与登录时设置的值匹配

#### 3. 注销后检查

**检查 Response Headers**:
```
Set-Cookie: better-auth.session_token=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT
```

**关键点**:
- ✅ 应该看到 `set-cookie` 头部
- ✅ Cookie 值应为空（清除 Cookie）
- ✅ `Max-Age=0` 或 `Expires` 设置为过去的时间

---

## ✅ 完整验证流程

### 步骤 1: 环境变量检查
```bash
pnpm tsx scripts/test-auth-flow.ts
```

### 步骤 2: 浏览器 Cookie 检查
1. 清除所有 Cookies
2. 访问登录页面
3. 登录
4. 检查 `better-auth.session_token` Cookie

### 步骤 3: Network 选项卡检查
1. 打开开发者工具 → Network
2. 触发登录操作
3. 检查 `set-cookie` 头部
4. 触发获取 Session 操作
5. 检查 `Cookie` 请求头
6. 触发注销操作
7. 检查 `set-cookie` 头部（清除 Cookie）

### 步骤 4: 服务器日志检查
查看服务器日志中的：
- `[getSignUser] Cookie header present: true/false`
- `[getSignUser] Session token in cookie: true/false`
- `[getSignUser] Session retrieved: true/false`

---

## 🎯 预期结果

### 成功指标

1. ✅ **环境变量一致**
   - `AUTH_URL` 与 `NEXT_PUBLIC_APP_URL` 一致
   - 都使用 `localhost`（不是 `127.0.0.1`）

2. ✅ **Cookie 正常传递**
   - 登录后设置 Cookie
   - 获取 Session 时 Cookie 存在
   - 注销后清除 Cookie

3. ✅ **服务器日志正常**
   - `[getSignUser] Cookie header present: true`
   - `[getSignUser] Session retrieved: true`
   - 无 `FAILED_TO_GET_SESSION` 错误

4. ✅ **Network 选项卡验证**
   - `set-cookie` 头部正确设置
   - `Cookie` 请求头正确传递
   - Cookie 清除操作正常

---

## 🚀 部署前检查

### 本地开发环境
- [ ] `AUTH_URL=http://localhost:3000`
- [ ] `NEXT_PUBLIC_APP_URL=http://localhost:3000`
- [ ] `BETTER_AUTH_COOKIE_SECURE=false`
- [ ] 浏览器地址栏使用 `localhost`

### 生产环境
- [ ] `AUTH_URL=https://your-domain.com`
- [ ] `NEXT_PUBLIC_APP_URL=https://your-domain.com`
- [ ] `BETTER_AUTH_COOKIE_SECURE=true`
- [ ] SSL 证书正确配置

---

## 📝 总结

### 关键检查点

1. ✅ **localhost vs 127.0.0.1** - 保持一致性
2. ✅ **Cookie Secure 属性** - 本地 false，生产 true
3. ✅ **环境变量热重载** - 完全重启服务器
4. ✅ **Network 选项卡验证** - 检查 Cookie 传递

### 工具支持

- ✅ `scripts/test-auth-flow.ts` - 自动化配置检查
- ✅ `scripts/diagnose-auth-issues.ts` - 完整诊断
- ✅ `PRACTICAL_DEBUGGING_GUIDE.md` - 排查路径图

---

**所有检查点已完成！** 🚀

按照此清单逐项验证，确保系统在生产环境稳定运行。

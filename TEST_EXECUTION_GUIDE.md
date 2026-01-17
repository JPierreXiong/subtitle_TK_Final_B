# 测试执行指南

## 🎯 测试准备

### 1. 环境变量确认 ✅

**AUTH_SECRET**: `Cll6HE9YpMqhbHU9FW+HIC8E9gq+I7eiqoDTTVky0mA=`

已在 `.env.local` 中配置。

### 2. 服务器状态检查

**检查服务器是否运行**:
```bash
netstat -ano | findstr "3000.*LISTENING"
```

如果未运行，启动服务器：
```bash
pnpm dev
```

---

## 🧪 测试脚本

### 脚本 1: 认证配置测试

```bash
pnpm tsx scripts/test-auth-flow.ts
```

**验证项**:
- ✅ AUTH_SECRET 配置
- ✅ AUTH_URL 一致性
- ✅ Cookie Secure 配置
- ✅ 数据库连接（如果配置）

---

### 脚本 2: 端到端流程测试

```bash
pnpm tsx scripts/test-end-to-end.ts
```

**测试流程**:
1. ✅ 服务器连接测试
2. ✅ 用户注册测试
3. ✅ 用户登录测试（验证 Cookie）
4. ✅ 获取用户信息测试
5. ✅ 媒体提取测试（TikTok URL）
6. ✅ 任务状态检查
7. ✅ 用户注销测试

**测试 URL**: `https://www.tiktok.com/@eharmonyofficial/video/7587079480779296014`

---

## 🔍 浏览器验证

### 检查 Cookie

1. **打开浏览器** → 访问 `http://localhost:3000`
2. **登录用户**
3. **打开开发者工具** (F12)
4. **Application** → **Cookies** → `http://localhost:3000`
5. **查找 Cookie**: `better-auth.session_token`

**预期结果**:
- ✅ Cookie 存在
- ✅ Cookie 未过期
- ✅ Cookie 的 `Secure` 属性为 `false`（本地开发）

---

## 📊 服务器日志检查

### 查看日志

在服务器终端中查找以下日志：

#### 成功日志
```
[getSignUser] Cookie header present: true
[getSignUser] Session token in cookie: true
[getSignUser] Cookie preview: better-auth.session_token=xxx...
[getSignUser] Session retrieved: true
```

#### 警告日志（如果存在）
```
[getSignUser] ⚠️  Cookie Secure=true but using HTTP! Cookies may not be sent.
[getSignUser] 💡 Fix: Set BETTER_AUTH_COOKIE_SECURE=false for local development
```

#### 错误日志（如果存在）
```
[getSignUser] Error getting session: {
  message: '...',
  code: 'FAILED_TO_GET_SESSION',
  name: '...'
}
```

---

## ✅ 验证清单

### 环境变量
- [x] `AUTH_SECRET` 已设置（长度: 44）
- [ ] `AUTH_URL` 已设置（或使用 fallback）
- [ ] `DATABASE_URL` 已设置（如果使用数据库）

### 服务器
- [ ] 服务器运行在 `http://localhost:3000`
- [ ] 服务器日志正常显示

### Cookie
- [ ] `better-auth.session_token` Cookie 存在
- [ ] Cookie 未过期
- [ ] Cookie `Secure` 属性正确

### 功能测试
- [ ] 用户注册成功
- [ ] 用户登录成功（有 Cookie）
- [ ] 获取用户信息成功
- [ ] 媒体提取任务提交成功
- [ ] 用户注销成功

---

## 🚀 执行测试

### 步骤 1: 启动服务器
```bash
pnpm dev
```

### 步骤 2: 运行配置测试
```bash
pnpm tsx scripts/test-auth-flow.ts
```

### 步骤 3: 运行端到端测试
```bash
pnpm tsx scripts/test-end-to-end.ts
```

### 步骤 4: 浏览器验证
1. 访问 `http://localhost:3000`
2. 登录用户
3. 检查 Cookie
4. 提交媒体提取任务
5. 查看服务器日志

---

## 📝 测试结果

### 预期结果

1. ✅ **配置测试**: 所有检查项通过
2. ✅ **端到端测试**: 所有步骤成功
3. ✅ **Cookie 验证**: Cookie 存在且正确
4. ✅ **服务器日志**: 显示正常调试信息

### 如果测试失败

1. **检查服务器是否运行**
   ```bash
   netstat -ano | findstr "3000.*LISTENING"
   ```

2. **检查环境变量**
   ```bash
   cat .env.local | grep -E "AUTH|DATABASE"
   ```

3. **查看服务器日志**
   - 查找 `[getSignUser]` 消息
   - 查找错误信息

4. **检查浏览器 Cookie**
   - 确保 Cookie 存在
   - 确保 Cookie 未过期

---

**测试准备完成！** 🚀

按照此指南执行测试，验证系统功能。

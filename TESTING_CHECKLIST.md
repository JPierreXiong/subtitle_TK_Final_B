# 测试清单 - 认证和媒体提取功能验证

## 📋 测试步骤

### 步骤 1: 验证服务器运行状态 ✅

**命令**:
```bash
# 检查服务器进程
Get-Process -Name node

# 或访问浏览器
http://localhost:3000
```

**预期结果**:
- ✅ 服务器在端口 3000 上运行
- ✅ 浏览器可以访问主页

---

### 步骤 2: 运行认证诊断 ✅

**命令**:
```bash
pnpm tsx scripts/diagnose-auth-comprehensive.ts
```

**预期结果**:
- ✅ AUTH_SECRET: 已配置 (length: 44)
- ✅ APP_URL: http://localhost:3000
- ✅ AUTH_URL: http://localhost:3000
- ✅ URL_CONSISTENCY: 匹配
- ✅ DATABASE_URL: 已配置 (Supabase)
- ✅ SESSION_TABLE: 可访问
- ✅ BETTER_AUTH_INIT: 初始化成功
- ✅ API_ENDPOINT: 可访问（服务器运行后）

**如果 API_ENDPOINT 失败**:
- 检查服务器是否运行：`Get-Process -Name node`
- 访问 `http://localhost:3000` 确认服务器响应
- 重新运行诊断脚本

---

### 步骤 3: 浏览器测试 - 注册流程

#### 3.1 清除浏览器 Cookie

**操作**:
1. 打开浏览器开发者工具 (F12)
2. 进入 `Application` -> `Cookies` -> `http://localhost:3000`
3. 删除所有 Cookie（或使用无痕模式）

#### 3.2 注册新用户

**操作**:
1. 访问 `http://localhost:3000`
2. 点击 "Sign Up" 或访问 `/sign-up`
3. 填写表单：
   - Name: `Test User`
   - Email: `test_$(timestamp)@example.com`
   - Password: `Test123456!`
4. 提交表单

**预期结果**:
- ✅ 注册成功
- ✅ 自动登录
- ✅ 重定向到主页或回调页面
- ✅ 浏览器设置 `better-auth.session_token` Cookie

#### 3.3 验证 Cookie

**操作**:
1. 打开开发者工具 (F12)
2. 进入 `Application` -> `Cookies` -> `http://localhost:3000`
3. 查找 `better-auth.session_token`

**预期值**:
- **Name**: `better-auth.session_token`
- **Domain**: `localhost` (不是 `127.0.0.1`)
- **Path**: `/`
- **Secure**: `false` (HTTP 开发环境)
- **SameSite**: `Lax` 或 `None`
- **Value**: 应该有值（长字符串）

---

### 步骤 4: 浏览器测试 - 登录流程

#### 4.1 登出（如果已登录）

**操作**:
1. 点击 "Sign Out" 或访问 `/sign-out`
2. 确认已登出（Cookie 被清除或失效）

#### 4.2 登录

**操作**:
1. 访问 `http://localhost:3000/sign-in`
2. 使用刚注册的邮箱和密码登录
3. 提交表单

**预期结果**:
- ✅ 登录成功
- ✅ 重定向到主页
- ✅ `better-auth.session_token` Cookie 已设置

#### 4.3 验证登录状态

**操作**:
1. 访问 `http://localhost:3000`
2. 检查页面是否显示用户名或"已登录"状态
3. 查看服务器日志中的 `[getSignUser]` 消息

**预期日志**:
```
[getSignUser] Cookie header present: true
[getSignUser] Session token in cookie: true
[getSignUser] Session retrieved: true
```

---

### 步骤 5: 验证媒体提取 - 无 401 错误

#### 5.1 测试 TikTok 文案提取

**操作**:
1. 确保已登录（见步骤 4）
2. 访问 `http://localhost:3000/ai-media-extractor`
3. 输入 TikTok URL：
   ```
   https://www.tiktok.com/@eharmonyofficial/video/7587079480779296014?is_from_webapp=1&sender_device=pc
   ```
4. 选择输出类型：`Subtitle`
5. 点击提交

**预期结果**:
- ✅ 任务提交成功（返回 202 Accepted）
- ✅ 返回 `taskId`
- ✅ **无 401 错误**
- ✅ 任务状态显示为 `pending` 或 `processing`

**服务器日志**:
```
[Media Submit] Task submitted: {taskId}
[getSignUser] Cookie header present: true
[getSignUser] Session retrieved: true
```

**如果出现 401 错误**:
1. 检查浏览器 Cookie（`better-auth.session_token` 是否存在）
2. 检查服务器日志中的 `[getSignUser]` 消息
3. 检查 `[Media Submit]` 消息中的诊断信息
4. 重新运行诊断脚本：`pnpm tsx scripts/diagnose-auth-comprehensive.ts`

#### 5.2 测试 YouTube 文案提取

**操作**:
1. 输入 YouTube URL（例如）：
   ```
   https://www.youtube.com/watch?v=pYw23YfUDwY
   ```
2. 选择输出类型：`Subtitle`
3. 点击提交

**预期结果**:
- ✅ 任务提交成功
- ✅ **无 401 错误**

#### 5.3 测试视频下载

**操作**:
1. 输入 TikTok 或 YouTube URL
2. 选择输出类型：`Video`
3. 点击提交

**预期结果**:
- ✅ 任务提交成功
- ✅ **无 401 错误**
- ✅ 任务状态显示 `downloading` -> `processing` -> `completed`

---

### 步骤 6: 监控服务器日志

**观察以下日志消息**:

#### 成功日志
```
[getSignUser] Cookie header present: true
[getSignUser] Session token in cookie: true
[getSignUser] Session retrieved: true
[Media Submit] Task submitted successfully: {taskId}
[QStash] Task pushed to queue: {taskId}
[Worker] Processing task: {taskId}
[Worker] Task completed: {taskId}
```

#### 错误日志（需要关注）
```
[getSignUser] ❌ Error getting session: {...}
[Media Submit] ❌ Authentication timeout after 4s
[Media Submit] ⚠️  User is not signed in
[Worker] Error processing task: {...}
```

---

## ✅ 验收标准

### 认证功能
- [ ] 用户注册成功
- [ ] Cookie 正确设置（Domain: localhost, Path: /）
- [ ] 用户登录成功
- [ ] Session 正确验证
- [ ] 无 401 错误

### 媒体提取功能
- [ ] TikTok 文案提取成功（无 401）
- [ ] YouTube 文案提取成功（无 401）
- [ ] 视频下载成功（无 401）
- [ ] 任务状态正常更新

### 诊断脚本
- [ ] 所有检查项通过（10/10）
- [ ] API_ENDPOINT 可访问（服务器运行后）
- [ ] 无关键失败项

---

## 🔍 故障排除

### 问题 1: 401 认证错误

**症状**: `Authentication timeout. Please try again.` 或 `Please sign in to continue.`

**诊断步骤**:
1. 检查浏览器 Cookie（`better-auth.session_token` 是否存在）
2. 检查 Cookie Domain（应该是 `localhost`）
3. 查看服务器日志中的 `[getSignUser]` 消息
4. 运行诊断脚本：`pnpm tsx scripts/diagnose-auth-comprehensive.ts`

**解决方案**:
- 清除浏览器 Cookie 并重新登录
- 确认 `AUTH_SECRET` 配置正确
- 确认 `AUTH_URL` 与浏览器地址栏一致
- 重启服务器

---

### 问题 2: API 端点不可访问

**症状**: 诊断脚本显示 `API_ENDPOINT: Cannot access auth endpoint`

**诊断步骤**:
1. 检查服务器是否运行：`Get-Process -Name node`
2. 访问 `http://localhost:3000` 确认服务器响应
3. 检查端口是否被占用：`netstat -ano | findstr :3000`

**解决方案**:
- 启动服务器：`pnpm dev`
- 如果端口被占用，停止其他进程或更改端口

---

### 问题 3: Cookie 未设置

**症状**: 登录后 Cookie 不存在

**诊断步骤**:
1. 检查浏览器开发者工具中的 Cookie
2. 检查 `BETTER_AUTH_COOKIE_SECURE` 设置（HTTP 应该是 `false`）
3. 检查 Cookie Domain（应该是 `localhost`）

**解决方案**:
- 确认 `BETTER_AUTH_COOKIE_SECURE=false`（HTTP 开发环境）
- 使用 `localhost` 而不是 `127.0.0.1`
- 清除浏览器缓存和 Cookie

---

## 📝 测试记录模板

### 测试日期: __________

#### 1. 诊断脚本结果
- [ ] ✅ 所有检查通过
- [ ] ❌ 失败项: __________

#### 2. 注册测试
- [ ] ✅ 注册成功
- [ ] ✅ Cookie 已设置
- [ ] ❌ 失败: __________

#### 3. 登录测试
- [ ] ✅ 登录成功
- [ ] ✅ Session 验证成功
- [ ] ❌ 失败: __________

#### 4. 媒体提取测试
- [ ] ✅ TikTok 文案提取（无 401）
- [ ] ✅ YouTube 文案提取（无 401）
- [ ] ✅ 视频下载（无 401）
- [ ] ❌ 失败: __________

#### 5. 服务器日志
- [ ] ✅ 无错误日志
- [ ] ❌ 错误日志: __________

---

**测试完成后，记录结果并报告任何问题。** ✅

# 完整测试清单

**测试时间**: 2026-01-17  
**测试范围**: TikTok/YouTube 视频提取、错误处理、数据库修复

---

## 🚀 服务器状态

服务器应该正在启动中。请检查：
- 终端窗口是否显示 `▲ Next.js 16.1.0`
- 是否显示 `Local: http://localhost:3000`
- 是否有任何错误信息

---

## 📋 测试清单

### 1. 数据库修复验证

#### ✅ 检查数据库列是否存在

**方法 1: 使用数据库管理工具**
- 连接到数据库
- 检查 `user` 表是否有以下列：
  - `plan_type` (TEXT, 默认值: 'free')
  - `free_trial_used` (INTEGER, 默认值: 0)
  - `last_checkin_date` (TEXT, 可为空)

**方法 2: 执行 SQL 查询**
```sql
SELECT 
    column_name,
    data_type,
    column_default
FROM information_schema.columns
WHERE table_name = 'user'
AND column_name IN ('plan_type', 'free_trial_used', 'last_checkin_date')
ORDER BY column_name;
```

**如果列不存在**:
- 执行 `scripts/add-plan-type-column.sql` 脚本
- 或手动执行 SQL（见 `DATABASE_PLAN_TYPE_FIX.md`）

---

### 2. TikTok 视频提取测试

#### 测试 2.1: 正常 TikTok 视频（应该成功）

1. **访问应用**:
   - 打开浏览器: http://localhost:3000/ai-media-extractor
   - 或根据路由配置访问相应页面

2. **测试步骤**:
   - 输入有效的 TikTok URL（例如：`https://www.tiktok.com/@username/video/1234567890`）
   - 选择 "Subtitle" 模式
   - 点击 "Extract" 按钮

3. **预期结果**:
   - ✅ 成功提取字幕
   - ✅ 控制台日志显示: `[TikTok Reel-AI API] Request URL: ...`
   - ✅ 没有 `plan_type` 查询错误
   - ✅ 没有 VIDEO_NOT_FOUND 错误

---

#### 测试 2.2: 不存在的 TikTok 视频（应该正确显示错误）

1. **测试步骤**:
   - 输入不存在的 TikTok URL
   - 选择 "Subtitle" 模式
   - 点击 "Extract" 按钮

2. **预期结果**:
   - ✅ 显示明确的错误消息: "Failed to fetch TikTok transcript: VIDEO_NOT_FOUND"
   - ✅ 控制台日志显示: `[TikTok Reel-AI API] Video not found error detected: ...`
   - ✅ 错误消息用户友好
   - ✅ **没有** `plan_type` 查询错误

3. **检查控制台日志**:
   - 打开浏览器开发者工具 (F12)
   - 查看 Console 标签
   - 应该看到类似日志：
     ```
     [TikTok Reel-AI API] API returned success: false, error: video not found
     [TikTok Reel-AI API] Video not found error detected: video not found
     ```

---

### 3. YouTube 视频提取测试

#### 测试 3.1: 正常 YouTube 视频（应该成功）

1. **测试步骤**:
   - 输入有效的 YouTube URL（例如：`https://www.youtube.com/watch?v=dQw4w9WgXcQ`）
   - 选择 "Subtitle" 模式
   - 点击 "Extract" 按钮

2. **预期结果**:
   - ✅ 成功提取字幕
   - ✅ 控制台日志显示: `[YouTube Flux API] Request URL: ...`
   - ✅ 没有 `plan_type` 查询错误
   - ✅ 没有 HTTP_ERROR 错误

---

#### 测试 3.2: 不存在的 YouTube 视频（应该正确显示错误）

1. **测试步骤**:
   - 输入不存在的 YouTube URL
   - 选择 "Subtitle" 模式
   - 点击 "Extract" 按钮

2. **预期结果**:
   - ✅ 显示明确的错误消息: "Failed to fetch YouTube transcript: VIDEO_NOT_FOUND"
   - ✅ 控制台日志显示: `[YouTube Flux API] Video not found error detected: ...`
   - ✅ 错误消息用户友好
   - ✅ **没有** `plan_type` 查询错误

---

#### 测试 3.3: HTTP 错误处理（如果触发）

1. **检查错误处理**:
   - 查看服务器终端日志
   - 查看浏览器控制台日志

2. **预期日志格式**:
   ```
   [YouTube Flux API] HTTP Error: 500 Internal Server Error
   [YouTube Flux API] Error details: {error: "..."}
   ```

---

### 4. 数据库错误处理验证

#### 测试 4.1: 验证错误处理（如果列不存在）

**注意**: 如果数据库列已存在，此测试可能不会触发。

1. **检查服务器日志**:
   - 查看终端输出
   - 如果看到警告: `[getUserPlanType] Error querying plan_type...`
   - 说明错误处理正在工作

2. **预期行为**:
   - ✅ 即使列不存在，功能也能正常工作
   - ✅ 返回默认值 'free'
   - ✅ 记录警告日志

---

## 🔍 调试信息查看

### 服务器日志

在运行 `pnpm dev` 的终端窗口中查看：

**正常请求**:
```
[TikTok Reel-AI API] Request URL: https://tiktok-reel-ai-transcript-extractor.p.rapidapi.com/api/tiktok/extract
[YouTube Flux API] Request URL: https://ai-youtube-transcript-generator-free-online-api-flux.p.rapidapi.com/transcript
```

**错误日志**:
```
[TikTok Reel-AI API] Video not found error detected: video not found
[YouTube Flux API] HTTP Error: 500 Internal Server Error
[getUserPlanType] Error querying plan_type... (如果列不存在)
```

### 浏览器控制台

1. 打开浏览器开发者工具 (F12)
2. 切换到 Console 标签
3. 查看错误消息和日志

---

## ✅ 测试完成标准

所有测试通过的标准：

1. ✅ 数据库列存在或错误处理正常工作
2. ✅ TikTok 正常视频可以成功提取
3. ✅ TikTok 不存在视频显示明确的 VIDEO_NOT_FOUND 错误
4. ✅ YouTube 正常视频可以成功提取
5. ✅ YouTube 不存在视频显示明确的 VIDEO_NOT_FOUND 错误
6. ✅ HTTP 错误时显示详细的错误信息
7. ✅ **没有** `plan_type` 查询错误
8. ✅ 控制台日志提供详细的调试信息

---

## 🐛 如果测试失败

### 问题 1: plan_type 查询错误仍然出现

**解决方案**:
1. 执行 SQL 脚本: `scripts/add-plan-type-column.sql`
2. 或手动执行 SQL（见 `DATABASE_PLAN_TYPE_FIX.md`）
3. 重启服务器

### 问题 2: 服务器无法启动

**检查**:
1. 端口 3000 是否被占用
2. 环境变量是否正确配置
3. 数据库连接是否正常

### 问题 3: API 错误

**检查**:
1. RapidAPI 密钥是否正确配置
2. API 配额是否充足
3. 网络连接是否正常

---

## 📝 测试报告模板

```
测试日期: ___________
测试人员: ___________

数据库状态:
- plan_type 列: [ ] 存在 [ ] 不存在（错误处理工作）
- free_trial_used 列: [ ] 存在 [ ] 不存在
- last_checkin_date 列: [ ] 存在 [ ] 不存在

测试结果:
- TikTok 正常视频: [ ] 通过 [ ] 失败
- TikTok 不存在视频: [ ] 通过 [ ] 失败
- YouTube 正常视频: [ ] 通过 [ ] 失败
- YouTube 不存在视频: [ ] 通过 [ ] 失败
- HTTP 错误处理: [ ] 通过 [ ] 失败
- plan_type 错误处理: [ ] 通过 [ ] 失败

发现的问题:
_________________________________________

备注:
_________________________________________
```

---

**下一步**: 按照上述清单进行测试，记录测试结果。

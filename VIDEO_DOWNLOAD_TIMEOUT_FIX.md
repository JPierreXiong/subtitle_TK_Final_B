# 视频下载 504 超时错误修复

## 🔍 问题诊断

**错误信息**: `Request failed with status: 504`

**根本原因**:
- Vercel Serverless Function 默认超时为 **10 秒**（Hobby 计划）或 **60 秒**（Pro 计划）
- `fetchMediaFromRapidAPI` 的超时设置为 **3 分钟**（180000ms）
- 当视频下载 API 调用耗时超过 10 秒时，Worker 就会超时返回 504

**问题场景**:
- YouTube 视频下载 API 可能需要 3-5 分钟才能返回视频 URL
- TikTok 视频下载 API 也可能需要较长时间
- Worker 在等待 API 响应时超时

---

## ✅ 解决方案

### 1. 添加 API 调用超时保护

**策略**: 在 Worker 中为 `fetchMediaFromRapidAPI` 添加 8 秒超时保护，确保 Worker 在 10 秒内返回。

**实现**:
```typescript
// 对于视频下载任务，设置较短的超时时间（8秒），确保 Worker 在 10 秒内返回
// 如果超时，返回 500 触发 QStash 重试
const fetchPromise = fetchMediaFromRapidAPI(url, outputType || 'subtitle');
const timeoutPromise = new Promise<never>((_, reject) => {
  setTimeout(() => {
    reject(new Error('API_TIMEOUT: Video download API call exceeded 8 seconds. Will retry via QStash.'));
  }, 8000); // 8 秒超时（留 2 秒给 Worker 处理）
});

mediaData = await Promise.race([fetchPromise, timeoutPromise]);
```

### 2. 超时错误处理

**策略**: 当 API 调用超时时，返回 500 状态码，触发 QStash 重试机制。

**实现**:
```typescript
// Check if error is due to timeout (for video download tasks)
if (errorMessage.includes('API_TIMEOUT') || errorMessage.includes('exceeded')) {
  // ⏱️ API call timed out: return 500 to trigger QStash retry
  console.log(`[Worker] ⏱️ [Timeout] API call timed out for ${url}, will retry via QStash`);
  
  // Update status to processing (for frontend Realtime display)
  await updateMediaTaskById(taskId, {
    status: 'processing',
    progress: 25,
    errorMessage: 'API call is taking longer than expected, will retry...'
  });
  
  // Return 500 to trigger QStash retry (with exponential backoff)
  return Response.json(
    { success: false, message: 'API call timed out, will retry...' },
    { status: 500 }
  );
}
```

---

## 📊 工作流程

### 修复后的流程

```
1. Worker 收到视频下载任务
   ↓
2. 调用 fetchMediaFromRapidAPI（8 秒超时保护）
   ↓
3a. 如果 8 秒内返回：
   - 继续处理，保存视频 URL
   - 启动异步上传
   - Worker 立即返回成功
   ↓
3b. 如果 8 秒超时：
   - 返回 500 状态码
   - 触发 QStash 重试（指数退避）
   - 更新任务状态为 'processing'
   ↓
4. QStash 在 20-30 秒后重试
   ↓
5. 重试时，API 可能已经完成，可以获取视频 URL
   ↓
6. 继续处理，保存视频 URL，启动异步上传
```

---

## 🎯 关键改进

### 1. 超时保护

- ✅ **8 秒超时**: 确保 Worker 在 10 秒内返回
- ✅ **Promise.race**: 使用 `Promise.race` 实现超时控制
- ✅ **留 2 秒缓冲**: 8 秒超时 + 2 秒处理时间 = 10 秒总时间

### 2. 错误处理

- ✅ **超时检测**: 检测 `API_TIMEOUT` 错误
- ✅ **状态更新**: 更新任务状态为 `processing`
- ✅ **QStash 重试**: 返回 500 触发 QStash 重试

### 3. 用户体验

- ✅ **实时状态**: 通过 Supabase Realtime 实时更新状态
- ✅ **错误提示**: 显示 "API call is taking longer than expected, will retry..."
- ✅ **自动重试**: QStash 自动重试，用户无需手动操作

---

## 📝 修改的文件

1. ✅ `src/app/api/media/worker/route.ts`
   - 添加 API 调用超时保护（8 秒）
   - 添加超时错误处理
   - 返回 500 触发 QStash 重试

---

## 🧪 测试建议

### 1. 功能测试

**测试步骤**:
1. 提交 YouTube 视频下载任务
2. 验证 Worker 在 10 秒内返回（即使 API 还在处理）
3. 验证任务状态更新为 `processing`
4. 验证 QStash 自动重试（20-30 秒后）
5. 验证最终成功获取视频 URL

### 2. 超时场景测试

**测试内容**:
- 模拟 API 响应时间超过 8 秒
- 验证 Worker 返回 500 状态码
- 验证 QStash 触发重试
- 验证任务状态正确更新

### 3. 成功场景测试

**测试内容**:
- 模拟 API 响应时间小于 8 秒
- 验证 Worker 正常处理
- 验证视频 URL 正确保存
- 验证异步上传正常启动

---

## ⚠️ 注意事项

1. **QStash 重试配置**:
   - 确保 QStash 重试间隔设置合理（建议 20-30 秒）
   - 确保 QStash 最大重试次数足够（建议 3-5 次）

2. **API 响应时间**:
   - YouTube 视频下载 API 可能需要 3-5 分钟
   - TikTok 视频下载 API 可能需要 1-3 分钟
   - 通过 QStash 重试机制，最终可以获取视频 URL

3. **用户体验**:
   - 前端应该显示 "Processing..." 状态
   - 通过 Supabase Realtime 实时更新状态
   - 显示进度提示（"API call is taking longer than expected, will retry..."）

---

## ✅ 总结

通过添加 8 秒超时保护，确保 Worker 在 10 秒内返回，避免 504 超时错误。当 API 调用超时时，通过 QStash 重试机制自动重试，最终可以成功获取视频 URL。

**关键改进**:
1. ✅ **超时保护**: 8 秒超时，确保 Worker 在 10 秒内返回
2. ✅ **错误处理**: 检测超时错误，返回 500 触发 QStash 重试
3. ✅ **用户体验**: 实时状态更新，自动重试，无需手动操作

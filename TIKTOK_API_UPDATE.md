# TikTok API 更新说明

## 📋 更新内容

根据您提供的新 API 信息，已更新 TikTok 文案提取 API 配置，支持新的 GET 请求格式。

---

## 🆕 新的 API 配置

### 主配置（推荐 - 免费）

**API**: `tiktok-transcripts.p.rapidapi.com`  
**方法**: `GET`  
**端点**: `/transcript?url=...&chunkSize=500&text=false`

**请求示例**:
```bash
curl --request GET \
  --url 'https://tiktok-transcripts.p.rapidapi.com/transcript?url=ENCODED_URL&chunkSize=500&text=false' \
  --header 'x-rapidapi-host: tiktok-transcripts.p.rapidapi.com' \
  --header 'x-rapidapi-key: YOUR_API_KEY'
```

**特点**:
- ✅ GET 请求（更简单）
- ✅ URL 参数格式
- ✅ 支持 `chunkSize` 和 `text` 参数
- ✅ 可能返回 chunks 数组格式

---

### 备用配置（新）

**API**: `tiktok-reel-ai-transcript-extractor.p.rapidapi.com`  
**方法**: `GET` (health check), `POST` (transcript - 假设)  
**端点**: `/api/health` (health check), `/api/transcript` (假设)

**注意**: 
- 目前只知道 health check 端点 (`/api/health`)
- Transcript 端点假设为 `/api/transcript`（POST JSON）
- 如果端点不正确，代码会自动回退到其他备用 API

**请求示例**:
```bash
# Health check (已知)
curl --request GET \
  --url 'https://tiktok-reel-ai-transcript-extractor.p.rapidapi.com/api/health' \
  --header 'x-rapidapi-host: tiktok-reel-ai-transcript-extractor.p.rapidapi.com' \
  --header 'x-rapidapi-key: YOUR_API_KEY'

# Transcript (假设 - 需要验证)
curl --request POST \
  --url 'https://tiktok-reel-ai-transcript-extractor.p.rapidapi.com/api/transcript' \
  --header 'Content-Type: application/json' \
  --header 'x-rapidapi-host: tiktok-reel-ai-transcript-extractor.p.rapidapi.com' \
  --header 'x-rapidapi-key: YOUR_API_KEY' \
  --data '{"url":"TIKTOK_URL"}'
```

---

## 🔧 代码更新

### 1. 支持 GET 请求格式 ✅

**文件**: `src/extensions/media/rapidapi.ts`

**更新内容**:
- ✅ 检测 API 类型（GET vs POST）
- ✅ 支持 GET 请求的 URL 参数格式
- ✅ 处理 GET API 的响应格式（可能返回 chunks 数组）
- ✅ 保持向后兼容（旧 API 仍然支持）

**关键代码**:
```typescript
// 检测是否为 GET-based API
const isGetBasedAPI = host.includes('tiktok-transcripts.p.rapidapi.com');

if (isGetBasedAPI) {
  // GET 请求，URL 参数
  const encodedUrl = encodeURIComponent(url);
  apiUrl = `https://${host}/transcript?url=${encodedUrl}&chunkSize=500&text=false`;
  
  fetchOptions = {
    method: 'GET',
    headers: {
      'x-rapidapi-key': this.configs.apiKey,
      'x-rapidapi-host': host,
    },
  };
} else {
  // POST 请求，JSON body
  apiUrl = `https://${host}/index.php`;
  fetchOptions = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...
    },
    body: JSON.stringify({ url }),
  };
}
```

### 2. 处理不同的响应格式 ✅

**更新内容**:
- ✅ 支持 chunks 数组格式（新 API 可能返回）
- ✅ 向后兼容旧 API 的响应格式
- ✅ 灵活提取 transcript 字段

**关键代码**:
```typescript
if (isGetBasedAPI) {
  // 新 API 格式：可能返回 { transcript: "...", chunks: [...] }
  transcript = 
    data.transcript || 
    data.text || 
    (Array.isArray(data.chunks) ? data.chunks.map(c => c.text || c.transcript || '').join(' ') : '') ||
    data.transcription || 
    ...;
} else {
  // 旧 API 格式
  transcript = data.transcript || data.subtitle || ...;
}
```

### 3. 更新默认配置 ✅

**文件**: `src/shared/services/media/rapidapi.ts`

**更新内容**:
- ✅ 默认主配置改为 `tiktok-transcripts.p.rapidapi.com`
- ✅ 默认备用配置改为 `tiktok-reel-ai-transcript-extractor.p.rapidapi.com`

---

## 📝 环境变量配置

### 推荐配置

在 `.env.local` 文件中：

```bash
# TikTok 文案提取 - 新 API（推荐）
RAPIDAPI_TIKTOK_TRANSCRIPT_PRIMARY_HOST=tiktok-transcripts.p.rapidapi.com
RAPIDAPI_TIKTOK_TRANSCRIPT_BACKUP_HOST=tiktok-reel-ai-transcript-extractor.p.rapidapi.com
```

### 如果需要使用旧 API

```bash
# TikTok 文案提取 - 旧 API（备用）
RAPIDAPI_TIKTOK_TRANSCRIPT_PRIMARY_HOST=tiktok-transcriptor-api3.p.rapidapi.com
RAPIDAPI_TIKTOK_TRANSCRIPT_BACKUP_HOST=tiktok-transcript.p.rapidapi.com
```

---

## ✅ 测试建议

### 1. 测试新 API

```bash
# 测试主 API（GET 请求）
curl --request GET \
  --url 'https://tiktok-transcripts.p.rapidapi.com/transcript?url=ENCODED_TIKTOK_URL&chunkSize=500&text=false' \
  --header 'x-rapidapi-host: tiktok-transcripts.p.rapidapi.com' \
  --header 'x-rapidapi-key: YOUR_API_KEY'
```

### 2. 验证响应格式

检查新 API 的响应格式：
- 如果返回 `{ transcript: "..." }`，代码已支持
- 如果返回 `{ chunks: [{ text: "..." }] }`，代码已支持
- 如果返回其他格式，可能需要调整解析逻辑

### 3. 测试备用 API

```bash
# 测试备用 API 的 health check
curl --request GET \
  --url 'https://tiktok-reel-ai-transcript-extractor.p.rapidapi.com/api/health' \
  --header 'x-rapidapi-host: tiktok-reel-ai-transcript-extractor.p.rapidapi.com' \
  --header 'x-rapidapi-key: YOUR_API_KEY'
```

**注意**: 需要查找实际的 transcript 端点。如果 `/api/transcript` 不正确，代码会回退到其他备用 API。

---

## 🔍 API 格式对比

### 旧 API (POST JSON)

```
POST https://tiktok-transcriptor-api3.p.rapidapi.com/index.php
Content-Type: application/json
Body: { "url": "TIKTOK_URL" }
```

### 新 API (GET)

```
GET https://tiktok-transcripts.p.rapidapi.com/transcript?url=ENCODED_URL&chunkSize=500&text=false
```

**优势**:
- ✅ GET 请求更简单
- ✅ 不需要请求体
- ✅ 更容易缓存

---

## ⚠️ 注意事项

### 1. 备用 API 端点未确认

`tiktok-reel-ai-transcript-extractor` 的实际 transcript 端点未确认：
- 当前假设为 `/api/transcript` (POST JSON)
- 如果端点不正确，代码会自动回退到其他备用 API
- 建议先验证实际端点

### 2. 响应格式可能不同

新 API 的响应格式可能与旧 API 不同：
- 可能返回 chunks 数组
- 代码已处理常见格式，但可能需要根据实际响应调整

### 3. 向后兼容

旧 API 仍然支持：
- 如果新 API 失败，会自动回退到旧 API
- 配置可以随时切换

---

## 🚀 下一步行动

1. **更新环境变量**:
   ```bash
   # 在 .env.local 中设置
   RAPIDAPI_TIKTOK_TRANSCRIPT_PRIMARY_HOST=tiktok-transcripts.p.rapidapi.com
   RAPIDAPI_TIKTOK_TRANSCRIPT_BACKUP_HOST=tiktok-reel-ai-transcript-extractor.p.rapidapi.com
   ```

2. **重启服务器**:
   ```bash
   pnpm dev
   ```

3. **测试 TikTok 文案提取**:
   - 提交 TikTok 视频 URL
   - 检查是否使用新 API
   - 观察服务器日志中的 API 调用

4. **验证备用 API**:
   - 如果主 API 失败，测试备用 API
   - 确认 transcript 端点是否正确

---

## 📊 更新文件清单

### 修改的文件

1. `src/extensions/media/rapidapi.ts`
   - ✅ 支持 GET 请求格式
   - ✅ 处理 chunks 数组响应
   - ✅ 自动检测 API 类型

2. `src/shared/services/media/rapidapi.ts`
   - ✅ 更新默认配置

3. `env.example.txt`
   - ✅ 更新配置说明

### 新增文档

1. `TIKTOK_API_UPDATE.md` - 本文档

---

## ✅ 总结

### 已完成的更新

1. ✅ **支持新 GET API** - `tiktok-transcripts.p.rapidapi.com`
2. ✅ **添加备用 API** - `tiktok-reel-ai-transcript-extractor.p.rapidapi.com`
3. ✅ **向后兼容** - 旧 API 仍然支持
4. ✅ **灵活的响应处理** - 支持多种响应格式

### 待验证

1. ⏳ **备用 API 端点** - 需要确认实际的 transcript 端点
2. ⏳ **响应格式** - 需要根据实际响应调整（如果需要）
3. ⏳ **功能测试** - 在实际使用中验证新 API

---

**API 更新完成！** 🚀

代码已支持新的 GET 请求格式，并保持向后兼容。请更新环境变量并测试功能。

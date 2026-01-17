# RapidAPI 环境变量更新说明 (V2)

## 📋 更新内容

根据您提供的最新 API 信息，已更新 `env.example.txt` 文件并增强了代码支持。

---

## 🆕 更新详情

### 1. TikTok 文案提取 API ✅

**主配置** (推荐 - 免费):
```bash
RAPIDAPI_TIKTOK_TRANSCRIPT_PRIMARY_HOST=tiktok-transcriptor-api3.p.rapidapi.com
```

**备用配置** (免费 - POST form):
```bash
RAPIDAPI_TIKTOK_TRANSCRIPT_BACKUP_HOST=tiktok-transcript.p.rapidapi.com
```

**API 端点**:
- 主: `POST https://tiktok-transcriptor-api3.p.rapidapi.com/index.php`
  - Content-Type: `application/json`
  - Body: `{"url":"TIKTOK_URL"}`
  
- 备用: `POST https://tiktok-transcript.p.rapidapi.com/transcribe-tiktok-audio`
  - Content-Type: `application/x-www-form-urlencoded`
  - Body: `url=TIKTOK_URL`

**代码支持**: ✅ 已支持，会自动使用主备配置

---

### 2. YouTube 视频下载 API ✅

**主配置**:
```bash
RAPIDAPI_YOUTUBE_VIDEO_PRIMARY_HOST=youtube-video-and-shorts-downloader1.p.rapidapi.com
```

**备用配置** (新 - 免费):
```bash
RAPIDAPI_YOUTUBE_VIDEO_BACKUP_HOST=cloud-api-hub-youtube-downloader.p.rapidapi.com
```

**API 端点**:
- 主: `GET https://youtube-video-and-shorts-downloader1.p.rapidapi.com/youtube/video/download?videoId=VIDEO_ID`
  - 也支持 POST 格式

- 备用 (新): `GET https://cloud-api-hub-youtube-downloader.p.rapidapi.com/download?id=VIDEO_ID&filter=audioandvideo&quality=lowest`
  - 使用不同的端点格式

**代码支持**: ✅ 已更新，支持新的端点格式

---

## 🔧 代码更新

### YouTube 视频下载端点支持

更新了 `fetchYouTubeVideoDownload` 方法，现在支持：

1. **标准格式** (youtube-video-and-shorts-downloader1):
   - `/youtube/video/download?videoId=...` (GET)
   - `/youtube/video/download` (POST JSON)

2. **新格式** (cloud-api-hub-youtube-downloader):
   - `/download?id=...&filter=audioandvideo&quality=lowest` (GET)

代码会自动检测 API 提供商并使用相应的端点格式。

---

## 📝 环境变量配置

### 完整配置示例

在 `.env.local` 文件中添加或更新以下配置：

```bash
# RapidAPI API Key (必需)
NEXT_PUBLIC_RAPIDAPI_KEY=558c577f30msh4f4e14fdc702b0cp1cf611jsn339fa91dba2b

# TikTok 视频下载 - 主备配置
RAPIDAPI_TIKTOK_VIDEO_PRIMARY_HOST=snap-video3.p.rapidapi.com
RAPIDAPI_TIKTOK_VIDEO_BACKUP_HOST=tiktok-video-no-watermark2.p.rapidapi.com

# TikTok 文案提取 - 主备配置 (免费)
RAPIDAPI_TIKTOK_TRANSCRIPT_PRIMARY_HOST=tiktok-transcriptor-api3.p.rapidapi.com
RAPIDAPI_TIKTOK_TRANSCRIPT_BACKUP_HOST=tiktok-transcript.p.rapidapi.com

# YouTube 视频下载 - 主备配置 (新备用 API)
RAPIDAPI_YOUTUBE_VIDEO_PRIMARY_HOST=youtube-video-and-shorts-downloader1.p.rapidapi.com
RAPIDAPI_YOUTUBE_VIDEO_BACKUP_HOST=cloud-api-hub-youtube-downloader.p.rapidapi.com

# YouTube 字幕提取 - 主备配置
RAPIDAPI_YOUTUBE_TRANSCRIPT_PRIMARY_HOST=ai-youtube-transcript-generator-free-online-api-flux.p.rapidapi.com
RAPIDAPI_YOUTUBE_TRANSCRIPT_BACKUP_HOST=youtube-video-summarizer-gpt-ai.p.rapidapi.com
```

---

## ✅ 验证配置

### 1. 检查环境变量

```bash
# 使用检查脚本
pnpm tsx scripts/check-env.ts

# 或手动检查
cat .env.local | grep RAPIDAPI
```

### 2. 测试功能

1. **TikTok 文案提取**:
   - 提交 TikTok 视频 URL
   - 检查是否使用主配置 API
   - 如果主配置失败，自动切换到备用 API

2. **YouTube 视频下载**:
   - 提交 YouTube 视频 URL
   - 检查是否使用主配置 API
   - 如果主配置失败，自动切换到新备用 API (cloud-api-hub)

### 3. 观察服务器日志

查找以下日志消息：
- `[TikTok Video Download] Attempting Free API...`
- `[TikTok Video Download] Switching to Paid API as fallback...`
- `YouTube video download API response:`

---

## 📚 API 详细信息

### TikTok 文案提取 - tiktok-transcriptor-api3

**端点**: `POST https://tiktok-transcriptor-api3.p.rapidapi.com/index.php`

**请求头**:
```
Content-Type: application/json
x-rapidapi-host: tiktok-transcriptor-api3.p.rapidapi.com
x-rapidapi-key: YOUR_API_KEY
```

**请求体**:
```json
{
  "url": "https://www.tiktok.com/@username/video/VIDEO_ID"
}
```

---

### TikTok 文案提取 - tiktok-transcript (备用)

**端点**: `POST https://tiktok-transcript.p.rapidapi.com/transcribe-tiktok-audio`

**请求头**:
```
Content-Type: application/x-www-form-urlencoded
x-rapidapi-host: tiktok-transcript.p.rapidapi.com
x-rapidapi-key: YOUR_API_KEY
```

**请求体**:
```
url=TIKTOK_URL
```

---

### YouTube 视频下载 - cloud-api-hub (新备用)

**端点**: `GET https://cloud-api-hub-youtube-downloader.p.rapidapi.com/download?id=VIDEO_ID&filter=audioandvideo&quality=lowest`

**请求头**:
```
x-rapidapi-host: cloud-api-hub-youtube-downloader.p.rapidapi.com
x-rapidapi-key: YOUR_API_KEY
```

**查询参数**:
- `id`: YouTube 视频 ID
- `filter`: `audioandvideo` (或 `audio`, `video`)
- `quality`: `lowest`, `highest`, `medium` (或具体质量)

---

## 🔍 故障转移机制

### 自动故障转移

代码实现的主备切换逻辑：

1. **TikTok 文案提取**:
   - 先使用主配置 (`tiktok-transcriptor-api3`)
   - 如果失败（超时、配额限制等），自动切换到备用 (`tiktok-transcript`)

2. **YouTube 视频下载**:
   - 先使用主配置 (`youtube-video-and-shorts-downloader1`)
   - 如果失败，自动切换到备用 (`cloud-api-hub-youtube-downloader`)
   - 备用 API 使用不同的端点格式，代码已自动处理

### 错误处理

- **超时**: 自动切换到备用 API
- **配额限制**: 自动切换到备用 API
- **网络错误**: 自动切换到备用 API
- **无效响应**: 自动切换到备用 API

---

## ⚠️ 注意事项

1. **API Key 必需**: 所有 RapidAPI 调用都需要 `NEXT_PUBLIC_RAPIDAPI_KEY`

2. **免费限额**: 免费 API 通常有使用限额，请注意控制请求频率

3. **端点格式**: 新的 `cloud-api-hub-youtube-downloader` API 使用不同的端点格式，代码已自动处理

4. **向后兼容**: 旧的 `NEXT_PUBLIC_RAPIDAPI_HOST_*` 环境变量仍然支持

5. **优先级**: 环境变量 > 数据库配置 > 默认值

---

## ✅ 下一步

1. 更新 `.env.local` 文件，添加新的环境变量
2. 重启开发服务器：`pnpm dev`
3. 测试 TikTok 文案提取和 YouTube 视频下载功能
4. 观察服务器日志，确认使用的 API 端点和故障转移是否正常工作

---

## 📊 测试清单

- [ ] 更新 `.env.local` 文件
- [ ] 重启服务器
- [ ] 测试 TikTok 文案提取（使用主配置）
- [ ] 测试 TikTok 文案提取（模拟主配置失败，验证备用配置）
- [ ] 测试 YouTube 视频下载（使用主配置）
- [ ] 测试 YouTube 视频下载（模拟主配置失败，验证新备用配置）
- [ ] 观察服务器日志，确认端点格式正确

---

**配置更新完成！** 🚀

现在可以使用新的免费 RapidAPI 服务，代码已支持自动故障转移和不同的端点格式。

# RapidAPI 环境变量更新说明

## 📋 更新内容

根据您提供的 API 信息，已更新 `env.example.txt` 文件，添加了新的 RapidAPI 配置选项。

---

## 🆕 新增环境变量

### TikTok 视频下载（主备配置）

**主配置** (推荐 - 免费):
```bash
RAPIDAPI_TIKTOK_VIDEO_PRIMARY_HOST=snap-video3.p.rapidapi.com
```

**备用配置**:
```bash
RAPIDAPI_TIKTOK_VIDEO_BACKUP_HOST=tiktok-video-no-watermark2.p.rapidapi.com
```

**API 端点**:
- 主: `https://snap-video3.p.rapidapi.com/download`
- 备用: `https://tiktok-video-no-watermark2.p.rapidapi.com/`

---

### YouTube 字幕提取（主备配置）

**主配置** (推荐 - 免费):
```bash
RAPIDAPI_YOUTUBE_TRANSCRIPT_PRIMARY_HOST=ai-youtube-transcript-generator-free-online-api-flux.p.rapidapi.com
```

**备用配置** (免费 - GET 请求):
```bash
RAPIDAPI_YOUTUBE_TRANSCRIPT_BACKUP_HOST=youtube-video-summarizer-gpt-ai.p.rapidapi.com
```

**API 端点**:
- 主: `https://ai-youtube-transcript-generator-free-online-api-flux.p.rapidapi.com/transcript` (POST, JSON)
- 备用: `https://youtube-video-summarizer-gpt-ai.p.rapidapi.com/api/v1/get-transcript-v2` (GET)

---

## 📝 配置优先级

代码中的配置优先级（从高到低）：

1. **环境变量主备配置** (新，推荐)
   - `RAPIDAPI_TIKTOK_VIDEO_PRIMARY_HOST`
   - `RAPIDAPI_TIKTOK_VIDEO_BACKUP_HOST`
   - `RAPIDAPI_YOUTUBE_TRANSCRIPT_PRIMARY_HOST`
   - `RAPIDAPI_YOUTUBE_TRANSCRIPT_BACKUP_HOST`

2. **数据库配置** (从 `config` 表读取)
   - `rapidapi_host_tiktok_download_primary`
   - `rapidapi_host_youtube_transcript_primary`
   - 等等...

3. **向后兼容环境变量** (旧)
   - `NEXT_PUBLIC_RAPIDAPI_HOST_TIKTOK_DOWNLOAD`
   - `NEXT_PUBLIC_RAPIDAPI_HOST_YOUTUBE_TRANSCRIPT`
   - 等等...

4. **默认值** (代码中的硬编码)
   - `snap-video3.p.rapidapi.com`
   - `tiktok-video-no-watermark2.p.rapidapi.com`
   - 等等...

---

## 🚀 使用说明

### 方法 1: 更新 `.env.local` (推荐)

在 `.env.local` 文件中添加或更新以下配置：

```bash
# RapidAPI API Key (必需)
NEXT_PUBLIC_RAPIDAPI_KEY=558c577f30msh4f4e14fdc702b0cp1cf611jsn339fa91dba2b

# TikTok 视频下载 - 主备配置
RAPIDAPI_TIKTOK_VIDEO_PRIMARY_HOST=snap-video3.p.rapidapi.com
RAPIDAPI_TIKTOK_VIDEO_BACKUP_HOST=tiktok-video-no-watermark2.p.rapidapi.com

# YouTube 字幕提取 - 主备配置
RAPIDAPI_YOUTUBE_TRANSCRIPT_PRIMARY_HOST=ai-youtube-transcript-generator-free-online-api-flux.p.rapidapi.com
RAPIDAPI_YOUTUBE_TRANSCRIPT_BACKUP_HOST=youtube-video-summarizer-gpt-ai.p.rapidapi.com
```

### 方法 2: 使用数据库配置

在数据库 `config` 表中设置（如果环境变量未设置）：
- `rapidapi_host_tiktok_download_primary`: `snap-video3.p.rapidapi.com`
- `rapidapi_host_youtube_transcript_primary`: `ai-youtube-transcript-generator-free-online-api-flux.p.rapidapi.com`

---

## ✅ 验证配置

### 1. 检查环境变量

```bash
# 使用检查脚本
pnpm tsx scripts/check-env.ts

# 或手动检查
cat .env.local | grep RAPIDAPI
```

### 2. 测试 API 调用

代码会自动使用主备配置：
- 如果主 API 失败，自动切换到备用 API
- 如果备用 API 也失败，返回错误

---

## 📚 API 详细信息

### 1. TikTok 视频下载 - snap-video3

**端点**: `POST https://snap-video3.p.rapidapi.com/download`

**请求头**:
```
Content-Type: application/x-www-form-urlencoded
x-rapidapi-host: snap-video3.p.rapidapi.com
x-rapidapi-key: YOUR_API_KEY
```

**请求体**:
```
url=YOUR_TIKTOK_URL
```

---

### 2. YouTube 字幕提取 - ai-youtube-transcript-generator

**端点**: `POST https://ai-youtube-transcript-generator-free-online-api-flux.p.rapidapi.com/transcript`

**请求头**:
```
Content-Type: application/json
x-rapidapi-host: ai-youtube-transcript-generator-free-online-api-flux.p.rapidapi.com
x-rapidapi-key: YOUR_API_KEY
```

**请求体**:
```json
{
  "videoUrl": "https://www.youtube.com/watch?v=VIDEO_ID",
  "langCode": "en"
}
```

---

### 3. YouTube 字幕提取 - youtube-video-summarizer (备用)

**端点**: `GET https://youtube-video-summarizer-gpt-ai.p.rapidapi.com/api/v1/get-transcript-v2?video_id=VIDEO_ID&platform=youtube`

**请求头**:
```
x-rapidapi-host: youtube-video-summarizer-gpt-ai.p.rapidapi.com
x-rapidapi-key: YOUR_API_KEY
```

---

## 🔧 代码支持

代码已经在以下文件中支持主备配置：

1. **`src/shared/services/media/rapidapi.ts`**
   - 读取 `RAPIDAPI_*_PRIMARY_HOST` 和 `RAPIDAPI_*_BACKUP_HOST`
   - 自动切换到备用 API（如果主 API 失败）

2. **`src/extensions/media/rapidapi.ts`**
   - `RapidAPIProvider` 类实现主备切换逻辑
   - 支持多个 API 的故障转移

---

## ⚠️ 注意事项

1. **API Key 必需**: 所有 RapidAPI 调用都需要 `NEXT_PUBLIC_RAPIDAPI_KEY`

2. **免费限额**: 免费 API 通常有使用限额，请注意控制请求频率

3. **主备切换**: 代码会自动在主备 API 之间切换，无需手动干预

4. **向后兼容**: 旧的 `NEXT_PUBLIC_RAPIDAPI_HOST_*` 环境变量仍然支持

5. **优先级**: 环境变量 > 数据库配置 > 默认值

---

## ✅ 下一步

1. 更新 `.env.local` 文件，添加新的环境变量
2. 重启开发服务器：`pnpm dev`
3. 测试 TikTok 视频下载和 YouTube 字幕提取功能
4. 观察服务器日志，确认使用的 API 端点

---

**配置更新完成！** 🚀

现在可以使用新的免费 RapidAPI 服务进行 TikTok 视频下载和 YouTube 字幕提取。

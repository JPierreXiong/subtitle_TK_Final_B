# 🔍 RapidAPI 配置分析与改进建议

**分析时间**: 2026-01-17  
**测试视频**: https://www.tiktok.com/@eharmonyofficial/video/7587079480779296014  
**错误信息**: 
- 文案提取: `Failed to fetch TikTok transcript: Both APIs failed. Free: Free API failed: NO_TRANSCRIPT, Paid: HTTP 404: Not Found`
- 视频提取: `Failed to fetch TikTok video: Both APIs failed. Free: Free API failed: NO_VIDEO_URL, Paid: No video URL available`

---

## 📋 当前配置分析

### 1. TikTok 文案提取 API 配置

**主配置** (`RAPIDAPI_TIKTOK_TRANSCRIPT_PRIMARY_HOST`):
- **默认值**: `tiktok-transcripts.p.rapidapi.com`
- **方法**: GET 请求
- **状态**: ❌ 失败（返回 `NO_TRANSCRIPT`）

**备用配置** (`RAPIDAPI_TIKTOK_TRANSCRIPT_BACKUP_HOST`):
- **默认值**: `tiktok-reel-ai-transcript-extractor.p.rapidapi.com`
- **方法**: POST JSON（假设 `/api/transcript` 端点）
- **状态**: ❌ 失败（返回 `HTTP 404: Not Found`）

### 2. TikTok 视频下载 API 配置

**主配置** (`RAPIDAPI_TIKTOK_VIDEO_PRIMARY_HOST`):
- **默认值**: `snap-video3.p.rapidapi.com`
- **方法**: POST form-urlencoded
- **状态**: ❌ 失败（返回 `NO_VIDEO_URL`）

**备用配置** (`RAPIDAPI_TIKTOK_VIDEO_BACKUP_HOST`):
- **默认值**: `tiktok-video-no-watermark2.p.rapidapi.com`
- **方法**: POST form-urlencoded
- **状态**: ❌ 失败（返回 `No video URL available`）

---

## 🔍 问题分析

### 问题 1: TikTok 文案提取 API 失败

#### 主 API (`tiktok-transcripts.p.rapidapi.com`) 失败

**错误**: `NO_TRANSCRIPT`

**可能原因**:
1. **视频没有字幕**: 该 TikTok 视频可能确实没有自动生成的字幕
2. **API 端点不正确**: GET 请求的路径可能不正确
3. **API 格式变化**: RapidAPI 的 API 格式可能已更改
4. **URL 参数格式**: 需要确认正确的 URL 参数格式

**建议检查**:
- 在 RapidAPI Hub 上验证该 API 的实际端点路径
- 确认是否需要特殊的 URL 参数（如 `video_id` 而不是完整 URL）
- 检查 API 文档中关于 `NO_TRANSCRIPT` 错误的条件

#### 备用 API (`tiktok-reel-ai-transcript-extractor.p.rapidapi.com`) 失败

**错误**: `HTTP 404: Not Found`

**可能原因**:
1. **端点路径错误**: `/api/transcript` 端点可能不存在
2. **API 端点已更改**: 该 API 的端点可能已更新
3. **API 不存在**: 该 API 可能在 RapidAPI 上已下架或更改名称

**建议检查**:
- 在 RapidAPI Hub 上搜索 `tiktok-reel-ai-transcript-extractor`
- 验证实际的 API 端点路径
- 检查是否需要不同的请求格式

### 问题 2: TikTok 视频下载 API 失败

#### 主 API (`snap-video3.p.rapidapi.com`) 失败

**错误**: `NO_VIDEO_URL`

**可能原因**:
1. **视频不可下载**: 该视频可能受到版权保护或下载限制
2. **API 端点不正确**: POST 请求的路径可能不正确
3. **请求格式错误**: form-urlencoded 格式可能不正确
4. **API Key 权限不足**: 可能需要订阅该 API 才能使用

**建议检查**:
- 在 RapidAPI Hub 上验证该 API 的实际端点
- 确认请求格式（form-urlencoded vs JSON）
- 检查是否需要特殊的 URL 参数

#### 备用 API (`tiktok-video-no-watermark2.p.rapidapi.com`) 失败

**错误**: `No video URL available`

**可能原因**:
1. **视频不可访问**: 视频可能已删除或设为私密
2. **API 响应格式变化**: API 返回格式可能已更改
3. **需要订阅**: 该 API 可能需要付费订阅

**建议检查**:
- 验证该 API 是否仍然可用
- 检查是否需要订阅计划
- 确认响应格式是否正确解析

---

## 💡 改进建议

### 建议 1: 验证并更新 API 端点（优先级：P1）

**操作步骤**:

1. **访问 RapidAPI Hub**
   - 打开: https://rapidapi.com/hub
   - 搜索 "TikTok transcript" 或 "TikTok subtitle"
   - 搜索 "TikTok video download" 或 "TikTok downloader"

2. **验证 API 端点**
   - 找到可用的 TikTok 文案提取 API
   - 确认正确的端点路径（如 `/transcript`, `/api/transcript`, `/subtitle` 等）
   - 确认请求方法（GET / POST）和格式（JSON / form-urlencoded）
   - 记录实际的 API Host 和端点路径

3. **测试 API**
   - 在 RapidAPI Hub 上直接测试 API
   - 使用测试视频 URL: `https://www.tiktok.com/@eharmonyofficial/video/7587079480779296014`
   - 确认 API 能够成功返回数据

4. **更新环境变量**
   - 根据验证结果更新 `.env.local` 中的 API Host
   - 更新端点路径（如果需要）

### 建议 2: 检查 API Key 权限（优先级：P1）

**可能问题**:
- API Key 可能需要订阅计划才能使用某些 API
- 免费计划可能有请求限制或功能限制

**检查步骤**:
1. **登录 RapidAPI Dashboard**
   - 访问: https://rapidapi.com/developer
   - 检查当前的订阅计划

2. **检查 API 订阅状态**
   - 验证是否已订阅所需的 TikTok APIs
   - 检查是否有使用限制（请求数、功能等）

3. **检查 API Key**
   - 确认 `NEXT_PUBLIC_RAPIDAPI_KEY` 是否正确
   - 验证 API Key 是否有权限访问所需的 API

### 建议 3: 添加 API 端点配置（优先级：P2）

**当前问题**:
- API 端点路径硬编码在代码中
- 不同 API 可能有不同的端点路径

**建议**:
- 添加环境变量配置 API 端点路径（如 `RAPIDAPI_TIKTOK_TRANSCRIPT_ENDPOINT`）
- 这样可以更容易地切换不同的 API 端点，无需修改代码

### 建议 4: 增强错误处理和日志（优先级：P2）

**当前问题**:
- 错误信息不够详细（只显示 `NO_TRANSCRIPT`, `NO_VIDEO_URL`）
- 难以诊断 API 调用失败的具体原因

**建议**:
- 记录完整的 API 响应（包括状态码、响应头、响应体）
- 区分不同类型的错误（网络错误、API 错误、数据错误）
- 提供更详细的错误信息，便于诊断

### 建议 5: 添加 API 健康检查（优先级：P3）

**建议**:
- 在应用启动时检查 API 可用性
- 定期验证 API 端点是否正常
- 自动切换可用的 API（如果主 API 失败，自动尝试备用 API）

---

## 🔧 推荐的新 API 配置

### TikTok 文案提取 API

**选项 1: tiktok-transcriptor-api3.p.rapidapi.com** (推荐测试)
- **端点**: `/index.php`
- **方法**: POST JSON
- **请求格式**: `{ "url": "..." }`
- **状态**: 需要验证

**选项 2: tiktok-transcript.p.rapidapi.com** (备用)
- **端点**: `/transcribe-tiktok-audio`
- **方法**: POST form-urlencoded
- **请求格式**: `url=...`
- **状态**: 需要验证

**选项 3: 其他可用的 API**
- 在 RapidAPI Hub 上搜索并测试新的 API
- 选择稳定且免费（或低成本）的 API

### TikTok 视频下载 API

**选项 1: tiktok-video-no-watermark2.p.rapidapi.com** (当前备用)
- **端点**: `/` (根路径)
- **方法**: POST form-urlencoded
- **状态**: 需要验证

**选项 2: snap-video3.p.rapidapi.com** (当前主配置)
- **端点**: `/download`
- **方法**: POST form-urlencoded
- **状态**: 需要验证

**选项 3: 其他可用的 API**
- 在 RapidAPI Hub 上搜索并测试新的 API
- 选择稳定且免费（或低成本）的 API

---

## 📋 验证清单

### API 配置验证

- [ ] **验证 API Key**
  - 登录 RapidAPI Dashboard
  - 确认 API Key 正确
  - 检查订阅计划

- [ ] **验证 TikTok 文案提取 API**
  - 搜索并找到可用的 API
  - 测试 API 端点
  - 确认请求格式和响应格式
  - 更新环境变量

- [ ] **验证 TikTok 视频下载 API**
  - 搜索并找到可用的 API
  - 测试 API 端点
  - 确认请求格式和响应格式
  - 更新环境变量

### 环境变量配置

**需要检查的环境变量**:
```env
# RapidAPI 基础配置
NEXT_PUBLIC_RAPIDAPI_KEY=your-rapidapi-key-here

# TikTok 文案提取 API
RAPIDAPI_TIKTOK_TRANSCRIPT_PRIMARY_HOST=tiktok-transcripts.p.rapidapi.com
RAPIDAPI_TIKTOK_TRANSCRIPT_BACKUP_HOST=tiktok-reel-ai-transcript-extractor.p.rapidapi.com

# TikTok 视频下载 API
RAPIDAPI_TIKTOK_VIDEO_PRIMARY_HOST=snap-video3.p.rapidapi.com
RAPIDAPI_TIKTOK_VIDEO_BACKUP_HOST=tiktok-video-no-watermark2.p.rapidapi.com
```

### 测试步骤

1. **在 RapidAPI Hub 上测试**
   - 使用测试视频 URL 直接测试 API
   - 确认 API 能够成功返回数据

2. **更新环境变量**
   - 根据测试结果更新 `.env.local`
   - 重启服务器

3. **重新运行测试**
   - 运行: `pnpm tsx scripts/test-media-extraction.ts "https://www.tiktok.com/@eharmonyofficial/video/7587079480779296014"`
   - 验证 API 调用是否成功

---

## 🎯 关键发现

### 1. API 配置可能过时

**问题**: 
- 当前配置的 API Host 可能已经不可用或已更改
- API 端点路径可能不正确

**影响**: 
- 无法提取 TikTok 视频文案和视频

**建议**: 
- 在 RapidAPI Hub 上验证并更新 API 配置

### 2. 错误处理可能需要改进

**问题**: 
- `NO_TRANSCRIPT` 可能表示视频确实没有字幕（不是 API 错误）
- `HTTP 404` 表示端点不存在（API 配置错误）

**建议**: 
- 区分"视频没有字幕"和"API 调用失败"
- 提供更详细的错误信息

### 3. 视频可能确实没有字幕

**可能性**: 
- 该 TikTok 视频可能确实没有自动生成的字幕
- 某些视频类型（如音乐视频）可能没有字幕

**验证方法**: 
- 在 TikTok 应用中手动查看该视频是否有字幕
- 尝试其他有字幕的 TikTok 视频

---

## 📄 参考资料

### RapidAPI Hub 链接

1. **TikTok Transcript APIs**:
   - https://rapidapi.com/hub?q=tiktok%20transcript
   - https://rapidapi.com/hub?q=tiktok%20subtitle

2. **TikTok Video Download APIs**:
   - https://rapidapi.com/hub?q=tiktok%20video%20download
   - https://rapidapi.com/hub?q=tiktok%20downloader

3. **RapidAPI Dashboard**:
   - https://rapidapi.com/developer
   - https://rapidapi.com/developer/apps

---

## 🚀 下一步行动

### 优先级 1: 验证 API 配置（立即执行）

1. **访问 RapidAPI Hub**
   - 搜索并测试可用的 TikTok APIs
   - 确认 API 端点和请求格式

2. **更新环境变量**
   - 根据验证结果更新 `.env.local`
   - 记录新的 API 配置

3. **重新测试**
   - 运行测试脚本验证配置
   - 确认 API 调用成功

### 优先级 2: 增强错误处理（计划执行）

1. **改进错误日志**
   - 记录完整的 API 响应
   - 区分不同类型的错误

2. **添加 API 健康检查**
   - 验证 API 可用性
   - 自动切换可用的 API

---

**分析完成时间**: 2026-01-17T05:15:00Z  
**结论**: API 配置需要验证和更新，可能是 API 端点过时或不可用导致的问题。

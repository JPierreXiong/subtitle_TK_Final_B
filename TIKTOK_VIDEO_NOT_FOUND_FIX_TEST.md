# TikTok & YouTube VIDEO_NOT_FOUND 错误修复测试指南

**修复时间**: 2026-01-17  
**修复内容**: 增强 TikTok 和 YouTube 转录 API 的错误检测，正确处理 VIDEO_NOT_FOUND 错误

---

## 🔧 修复内容

### TikTok API 修复
- ✅ `fetchTikTokTranscriptSupadataAPI` - 增强错误检测
- ✅ 检测 API 返回 `success: false` 的情况
- ✅ 检测响应体中的 "video not found" 错误消息（即使 HTTP 状态为 200）

### YouTube API 修复
- ✅ `fetchYouTubeTranscriptFluxAPI` - 主要使用的 API
- ✅ `fetchYouTubeTranscriptFreeAPI` - 免费 API
- ✅ `fetchYouTubeTranscriptPaidAPI` - 付费 API（已弃用但保持一致性）

### 通用增强功能
- ✅ 支持多种错误消息变体：
  - "video not found"
  - "invalid url"
  - "video not available"
  - "cannot find video"
  - "video does not exist"
- ✅ 添加调试日志：
  - 记录 API 返回的错误信息
  - 记录检测到的 "video not found" 错误
  - 便于后续调试和问题排查

---

## 🚀 服务器重启步骤

### 方法 1: 如果服务器已在运行

1. **停止当前服务器**:
   - 在运行 `pnpm dev` 的终端窗口按 `Ctrl + C`

2. **启动新服务器**:
   ```bash
   cd D:\AIsoftware\subtitle_TK_Final_F
   pnpm dev
   ```

3. **等待服务器启动**:
   - 查看终端输出，应该显示：
     ```
     ▲ Next.js 16.1.0
     - Local:        http://localhost:3000
     ```

### 方法 2: 如果端口被占用

```powershell
# 停止占用端口 3000 的进程
$port = 3000
$process = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
if ($process) {
    $pid = $process.OwningProcess
    Stop-Process -Id $pid -Force
    Write-Output "已停止占用端口 $port 的进程 (PID: $pid)"
}

# 然后启动服务器
cd D:\AIsoftware\subtitle_TK_Final_F
pnpm dev
```

---

## 🧪 测试步骤

### 测试 1: 正常 TikTok 视频（应该成功）

1. **访问应用**:
   - 打开浏览器访问: http://localhost:3000/ai-media-extractor
   - 或根据你的路由配置访问相应页面

2. **测试正常视频**:
   - 输入一个有效的 TikTok URL（例如：`https://www.tiktok.com/@username/video/1234567890`）
   - 选择 "Subtitle" 模式
   - 点击 "Extract" 按钮

3. **预期结果**:
   - ✅ 成功提取字幕
   - ✅ 控制台日志显示: `[TikTok Reel-AI API] Request URL: ...`
   - ✅ 没有 VIDEO_NOT_FOUND 错误

---

### 测试 2: 不存在的视频（应该正确显示错误）

1. **测试无效 URL**:
   - 输入一个不存在的 TikTok 视频 URL
   - 例如：`https://www.tiktok.com/@nonexistent/video/9999999999`
   - 选择 "Subtitle" 模式
   - 点击 "Extract" 按钮

2. **预期结果**:
   - ✅ 显示明确的错误消息: "Failed to fetch TikTok transcript: VIDEO_NOT_FOUND"
   - ✅ 控制台日志显示: `[TikTok Reel-AI API] Video not found error detected: ...`
   - ✅ 错误消息用户友好，说明视频不存在或 URL 无效
   - ✅ 不会显示模糊的错误信息

3. **检查控制台日志**:
   - 打开浏览器开发者工具 (F12)
   - 查看 Console 标签
   - 应该看到类似日志：
     ```
     [TikTok Reel-AI API] API returned success: false, error: video not found
     [TikTok Reel-AI API] Video not found error detected: video not found
     ```

---

### 测试 3: 无效 URL 格式

1. **测试无效格式**:
   - 输入一个格式错误的 URL
   - 例如：`https://invalid-tiktok-url.com`
   - 选择 "Subtitle" 模式
   - 点击 "Extract" 按钮

2. **预期结果**:
   - ✅ 显示错误消息: "Video not found or invalid URL"
   - ✅ 控制台有相应的错误日志

---

### 测试 4: 私有/已删除视频

1. **测试私有视频**:
   - 输入一个私有或已删除的视频 URL
   - 选择 "Subtitle" 模式
   - 点击 "Extract" 按钮

2. **预期结果**:
   - ✅ 正确识别并返回 VIDEO_NOT_FOUND 错误
   - ✅ 错误消息清晰明确

---

## 📊 验证清单

测试时请检查以下项目：

- [ ] 服务器成功启动，无错误
- [ ] 正常 TikTok 视频可以成功提取字幕
- [ ] 不存在的视频显示明确的 VIDEO_NOT_FOUND 错误
- [ ] 控制台日志显示详细的错误信息
- [ ] 错误消息对用户友好，易于理解
- [ ] 没有出现模糊或未处理的错误

---

## 🔍 调试信息

### 查看服务器日志

在运行 `pnpm dev` 的终端窗口中，你应该能看到：

**TikTok API 日志**:
```
[TikTok Reel-AI API] Request URL: https://tiktok-reel-ai-transcript-extractor.p.rapidapi.com/api/tiktok/extract
[TikTok Reel-AI API] Video URL: https://www.tiktok.com/@username/video/1234567890...
```

**YouTube API 日志**:
```
[YouTube Flux API] Request URL: https://ai-youtube-transcript-generator-free-online-api-flux.p.rapidapi.com/transcript
[YouTube Flux API] Video URL: https://www.youtube.com/watch?v=...
```

如果出现错误，会看到：

**TikTok 错误日志**:
```
[TikTok Reel-AI API] API returned success: false, error: video not found
[TikTok Reel-AI API] Video not found error detected: video not found
```

**YouTube 错误日志**:
```
[YouTube Flux API] API returned success: false, error: video not found
[YouTube Flux API] Video not found error detected: video not found
```

### 查看浏览器控制台

1. 打开浏览器开发者工具 (F12)
2. 切换到 Console 标签
3. 查看错误消息和日志

---

## ✅ 测试完成标准

修复成功的标志：

1. ✅ TikTok 和 YouTube 不存在的视频不再显示模糊错误
2. ✅ 错误消息明确说明 "Video not found or invalid URL"
3. ✅ 控制台日志提供详细的调试信息（区分 TikTok 和 YouTube）
4. ✅ 正常视频仍然可以成功提取（TikTok 和 YouTube）

---

## 🐛 如果测试失败

如果测试时仍然出现问题：

1. **检查服务器日志**:
   - 查看终端中的错误信息
   - 确认服务器已正确重启

2. **检查代码修改**:
   - 确认 `src/extensions/media/rapidapi.ts` 文件已保存
   - 确认修改已生效（检查文件时间戳）

3. **清除缓存**:
   ```bash
   # 停止服务器
   # 删除 .next 文件夹
   rm -rf .next
   # 或 Windows PowerShell
   Remove-Item -Recurse -Force .next
   
   # 重新启动服务器
   pnpm dev
   ```

4. **检查环境变量**:
   - 确认 RapidAPI 密钥配置正确
   - 检查 `.env.local` 文件

---

## 📝 测试报告模板

测试完成后，请记录：

```
测试日期: ___________
测试人员: ___________

测试结果:
- TikTok 正常视频: [ ] 通过 [ ] 失败
- TikTok 不存在视频: [ ] 通过 [ ] 失败
- TikTok 无效URL: [ ] 通过 [ ] 失败
- TikTok 私有视频: [ ] 通过 [ ] 失败
- YouTube 正常视频: [ ] 通过 [ ] 失败
- YouTube 不存在视频: [ ] 通过 [ ] 失败
- YouTube 无效URL: [ ] 通过 [ ] 失败

发现的问题:
_________________________________________

备注:
_________________________________________
```

---

**下一步**: 按照上述步骤进行测试，确认修复是否生效。

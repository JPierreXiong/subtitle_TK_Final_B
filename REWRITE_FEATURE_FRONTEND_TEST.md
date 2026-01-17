# 🧪 改写功能前端测试指南

**测试方式**: 通过浏览器前端界面（推荐）

---

## 📋 完整测试流程

### 步骤 1: 访问媒体提取页面

1. **打开浏览器**
   - 访问: http://localhost:3000/ai-media-extractor
   - 确保已登录（如果需要）

### 步骤 2: 创建测试任务

1. **输入测试 URL**
   ```
   https://www.tiktok.com/@the_shortcut_tsar/video/7415746564376530950
   ```

2. **选择输出类型**
   - 选择: `Subtitle`（字幕提取）

3. **点击提交**
   - 等待提取完成（约 30-60 秒）
   - 状态应该变为: `extracted`
   - 进度应该为: `100%`

### 步骤 3: 打开任务详情

1. **查看任务结果**
   - 在任务列表中，找到刚创建的任务
   - 点击 "View Details" 按钮
   - 或访问任务详情页面

2. **验证任务状态**
   - 确认状态为: `extracted` 或 `completed`
   - 确认有字幕内容显示

### 步骤 4: 触发改写功能

1. **点击改写按钮**
   - 在任务详情页面，找到 "Rewrite Script" 按钮
   - 点击按钮，打开对话框

2. **选择改写参数**
   - **风格**: 选择 `Viral`（或其他风格）
   - **目标语言**: 选择 `简体中文 (zh-CN)`（或其他语言）

3. **开始改写**
   - 点击 "Start Rewrite" 按钮
   - 应该立即显示加载状态

### 步骤 5: 观察结果

1. **加载状态**
   - 应该看到: "Gemini is rewriting your script and localizing it..."
   - 进度应该显示为: `50%`

2. **等待完成**
   - 等待时间: 约 30-60 秒
   - 结果应该自动显示（通过 Supabase Realtime）

3. **验证结果**
   - ✅ 左侧卡片: English Master（英文母本）
   - ✅ 右侧卡片: Target Language（目标语言版本）
   - ✅ 两个版本都保持 SRT 格式（时间戳、编号）
   - ✅ 可以点击复制按钮复制内容

---

## 🔍 验证清单

### 功能验证

- [ ] **按钮显示**
  - [ ] "Rewrite Script" 按钮在 `extracted` 或 `completed` 状态时显示
  - [ ] 按钮样式正确（带 Sparkles 图标）

- [ ] **对话框功能**
  - [ ] 点击按钮后对话框正常打开
  - [ ] 风格选择下拉菜单正常
  - [ ] 语言选择下拉菜单正常
  - [ ] "Start Rewrite" 按钮可点击

- [ ] **API 调用**
  - [ ] 点击 "Start Rewrite" 后，Network 标签显示 `/api/media/rewrite` 请求
  - [ ] 响应状态为: `202 Accepted`
  - [ ] 响应体包含: `{ code: 0, data: { success: true } }`

- [ ] **加载状态**
  - [ ] 显示加载动画
  - [ ] 显示提示文字: "Gemini is rewriting..."
  - [ ] 任务状态更新为: `processing`
  - [ ] 进度更新为: `50%`

- [ ] **结果显示**
  - [ ] 等待 30-60 秒后，结果自动显示
  - [ ] 左侧显示英文母本（蓝色边框）
  - [ ] 右侧显示目标语言版本（主色边框）
  - [ ] 两个版本都保持 SRT 格式
  - [ ] 复制按钮正常工作

- [ ] **Realtime 更新**
  - [ ] 浏览器控制台显示: `[useMediaTaskRealtime] Received real-time update`
  - [ ] 结果自动更新，无需刷新页面
  - [ ] 任务状态自动更新为: `completed`

---

## 🐛 故障排查

### 问题 1: 按钮不显示

**可能原因**:
- 任务状态不是 `extracted` 或 `completed`
- 任务没有 `subtitleRaw` 内容

**解决方案**:
1. 检查任务状态（应该是 `extracted` 或 `completed`）
2. 检查任务是否有字幕内容
3. 如果没有，重新提取字幕

### 问题 2: 对话框无法打开

**可能原因**:
- UI 组件未正确导入
- 浏览器控制台有错误

**解决方案**:
1. 打开浏览器开发者工具（F12）
2. 查看 Console 标签是否有错误
3. 检查 Network 标签是否有资源加载失败

### 问题 3: API 返回错误

**可能原因**:
- 未登录
- 任务不存在
- 任务状态不正确

**解决方案**:
1. 确保已登录
2. 检查任务 ID 是否正确
3. 检查任务状态是否为 `extracted` 或 `completed`

### 问题 4: 改写结果不显示

**可能原因**:
- Supabase Realtime 未启用
- Gemini API Key 未配置
- 网络连接问题

**解决方案**:
1. 检查 Supabase Realtime 是否启用（Database → Replication）
2. 检查 `GEMINI_API_KEY` 环境变量
3. 检查浏览器控制台是否有错误
4. 等待更长时间（最多 2 分钟）

### 问题 5: 结果格式不正确

**可能原因**:
- Gemini API 返回格式不正确
- SRT 格式解析失败

**解决方案**:
1. 检查浏览器控制台是否有解析错误
2. 检查 `rewrittenScripts` 字段的数据格式
3. 查看服务器日志中的 Gemini API 响应

---

## 📊 预期结果示例

### 成功场景

**API 响应**:
```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "success": true,
    "message": "Rewrite task started. Results will be available via Realtime updates."
  }
}
```

**数据库更新**:
```json
{
  "rewrittenScripts": [
    {
      "style": "viral",
      "en": "1\n00:00:01,000 --> 00:00:03,000\nStrong opening hook that grabs attention...",
      "target": "1\n00:00:01,000 --> 00:00:03,000\n吸引人的开头，抓住注意力...",
      "lang": "zh-CN",
      "createdAt": "2026-01-17T12:00:00.000Z"
    }
  ]
}
```

**前端显示**:
- 左侧卡片: 英文母本（蓝色边框，SEO 优化）
- 右侧卡片: 简体中文版本（主色边框，本地化）
- 两个版本都保持 SRT 格式
- 复制按钮可正常使用

---

## 🚀 快速测试命令（如果已登录）

如果你已经登录并知道 taskId，可以通过浏览器控制台运行：

```javascript
// 在浏览器控制台运行
fetch('/api/media/rewrite', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    taskId: 'YOUR_TASK_ID',
    style: 'viral',
    targetLang: 'zh-CN'
  })
}).then(r => r.json()).then(console.log);
```

---

**前端测试指南创建时间**: 2026-01-17  
**推荐测试方式**: 通过浏览器前端界面

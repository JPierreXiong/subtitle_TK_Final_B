# ⚡ 快速测试改写功能

**快速开始**: 5 分钟完成测试

---

## 🚀 快速测试步骤

### 1. 确认服务器运行

```bash
# 检查服务器是否运行
curl http://localhost:3000

# 或访问浏览器
# http://localhost:3000
```

---

### 2. 创建测试任务（3 种方法）

#### 方法 A: 前端界面（最简单）

1. 访问: http://localhost:3000/ai-media-extractor
2. 输入 TikTok URL: `https://www.tiktok.com/@the_shortcut_tsar/video/7415746564376530950`
3. 点击提交
4. 等待提取完成（约 30-60 秒）
5. 从浏览器 Network 标签获取 `taskId`

#### 方法 B: API 调用（快速）

```bash
# 提交任务
curl -X POST http://localhost:3000/api/media/submit \
  -H "Content-Type: application/json" \
  -H "Cookie: your-auth-cookie" \
  -d '{
    "url": "https://www.tiktok.com/@the_shortcut_tsar/video/7415746564376530950",
    "outputType": "subtitle"
  }'

# 从响应中复制 taskId
```

#### 方法 C: 使用现有任务

如果你已有 `extracted` 或 `completed` 状态的任务，直接使用其 `taskId`。

---

### 3. 测试改写功能

#### 使用测试脚本（推荐）

```bash
# 替换 <taskId> 为你的实际任务 ID
pnpm tsx scripts/test-rewrite-feature.ts <taskId> viral zh-CN

# 示例
pnpm tsx scripts/test-rewrite-feature.ts abc123-def456-ghi789 viral zh-CN
```

**测试脚本会自动**:
- ✅ 检查任务状态
- ✅ 触发改写任务
- ✅ 等待结果（最多 2 分钟）
- ✅ 显示改写结果

#### 或通过前端界面

1. 打开任务详情（点击 "View Details"）
2. 点击 "Rewrite Script" 按钮
3. 选择风格: `Viral`
4. 选择语言: `简体中文 (zh-CN)`
5. 点击 "Start Rewrite"
6. 等待结果自动显示

---

## ✅ 预期结果

### 成功标志

1. **API 响应**: `202 Accepted`
2. **任务状态**: `processing` → `completed`
3. **数据库字段**: `rewrittenScripts` 有数据
4. **前端显示**: 双语对照卡片自动出现

### 结果格式

```json
{
  "rewrittenScripts": [
    {
      "style": "viral",
      "en": "1\n00:00:01,000 --> 00:00:03,000\nStrong opening hook...",
      "target": "1\n00:00:01,000 --> 00:00:03,000\n吸引人的开头...",
      "lang": "zh-CN",
      "createdAt": "2026-01-17T12:00:00.000Z"
    }
  ]
}
```

---

## 🐛 常见问题

### Q: 服务器无法访问？

**A**: 等待 20-30 秒后重试，或检查端口 3000 是否被占用。

### Q: 改写任务不启动？

**A**: 检查：
- 任务状态是否为 `extracted` 或 `completed`
- 任务是否有 `subtitleRaw` 内容
- `GEMINI_API_KEY` 是否配置

### Q: 结果不显示？

**A**: 检查：
- Supabase Realtime 是否启用
- 浏览器控制台是否有错误
- 等待时间是否足够（通常 30-60 秒）

---

## 📋 测试检查清单

- [ ] 服务器正常运行（http://localhost:3000）
- [ ] 创建了测试任务
- [ ] 任务状态为 `extracted` 或 `completed`
- [ ] 任务有字幕内容
- [ ] 触发改写成功（202 Accepted）
- [ ] 改写结果正确显示
- [ ] 双语对照正确显示
- [ ] Realtime 更新正常工作

---

**快速测试完成！** 🎉

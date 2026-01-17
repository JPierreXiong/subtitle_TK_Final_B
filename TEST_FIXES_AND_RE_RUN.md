# 测试问题修复与重新测试指南

## 🔧 已修复的问题

### 1. ✅ 创建积分脚本
- **文件**: `scripts/add-test-credits.ts`
- **功能**: 为测试用户添加 50 积分
- **用法**: `pnpm tsx scripts/add-test-credits.ts <email> [credits]`

### 2. ✅ 修复轮询 cookies 传递
- **问题**: 轮询状态时 cookies 未传递，导致认证失败
- **修复**: 在 `pollTaskStatus` 函数中添加 cookies 参数支持

### 3. ✅ 优化 session 稳定等待
- **改进**: 将 session 稳定等待时间从 2 秒增加到 3 秒
- **原因**: 新注册用户的 session 需要更多时间稳定

---

## 📋 测试流程

### 步骤 1: 运行完整测试（自动创建用户）
```bash
pnpm tsx scripts/test-media-extraction.ts "https://www.tiktok.com/@eharmonyofficial/video/7587079480779296014?is_from_webapp=1&sender_device=pc"
```

这将：
1. 自动创建测试用户
2. 自动登录
3. 提交文案提取任务
4. 提交视频提取任务（可能因积分不足失败）

### 步骤 2: 为测试用户添加积分
查看测试输出，找到创建的测试用户邮箱（如 `test_1768625629108@example.com`），然后：

```bash
pnpm tsx scripts/add-test-credits.ts test_1768625629108@example.com 50
```

### 步骤 3: 重新运行测试（使用有积分的账户）
如果有环境变量 `TEST_EMAIL`，可以直接使用：

```bash
# 设置测试邮箱
$env:TEST_EMAIL = "test_1768625629108@example.com"
$env:TEST_PASSWORD = "Test123456!"

# 重新运行测试
pnpm tsx scripts/test-media-extraction.ts "https://www.tiktok.com/@eharmonyofficial/video/7587079480779296014?is_from_webapp=1&sender_device=pc"
```

---

## 🎯 预期结果

### ✅ 应该成功的测试
1. **服务器连接** - ✅ 正常
2. **用户认证** - ✅ 成功（注册 + 登录）
3. **文案提取任务提交** - ✅ 成功
4. **文案提取状态轮询** - ✅ 应该成功（已修复 cookies）
5. **视频提取任务提交** - ✅ 应该在添加积分后成功
6. **视频提取状态轮询** - ✅ 应该成功（已修复 cookies）

### ⚠️ 可能的问题

#### 1. 认证超时（部分解决）
- **现象**: 任务提交耗时较长（可能 8-50 秒）
- **原因**: 数据库查询慢或新用户 session 未稳定
- **已优化**:
  - ✅ Session 稳定等待时间增加到 3 秒
  - ✅ 超时时间已设置为 8 秒（允许足够的响应时间）
- **后续优化**: 
  - 优化数据库查询性能
  - 考虑使用缓存

#### 2. 积分不足（已解决）
- **现象**: 视频提取需要 15 积分，新用户无积分
- **解决方案**: ✅ 已创建 `add-test-credits.ts` 脚本
- **使用**: 运行脚本为测试用户添加积分

#### 3. 状态轮询认证失败（已修复）
- **现象**: 轮询时 cookies 未传递
- **修复**: ✅ 已修复 `pollTaskStatus` 函数，现在会传递 cookies

---

## 📊 测试报告

测试完成后，会生成以下报告：
- `MEDIA_EXTRACTION_TEST_REPORT.md` - 详细测试报告
- `MEDIA_EXTRACTION_TEST_SUMMARY.md` - 测试总结（推荐阅读）

---

## 🔍 验证清单

测试完成后，检查以下内容：

- [ ] 服务器连接正常
- [ ] 用户认证成功
- [ ] 文案提取任务提交成功
- [ ] 文案提取状态轮询成功（不再出现 "no auth" 错误）
- [ ] 任务状态正确更新（pending → downloading → processing → extracted）
- [ ] 文案内容正确提取（subtitleRaw 字段有内容）
- [ ] 视频提取任务提交成功（添加积分后）
- [ ] 视频提取状态轮询成功
- [ ] 视频 URL 正确返回（videoUrlInternal 字段有内容）

---

## 💡 调试建议

### 如果任务提交超时
1. 检查服务器日志中的 `[getSignUser]` 消息
2. 验证数据库连接是否正常
3. 考虑增加等待时间或优化数据库查询

### 如果状态轮询失败
1. 确认 cookies 正确传递（查看日志中的 Cookie header）
2. 检查 session 是否仍然有效
3. 验证任务 ID 是否正确

### 如果积分不足
1. 运行 `add-test-credits.ts` 脚本添加积分
2. 确认积分记录已创建（检查数据库）
3. 验证用户 ID 匹配

---

**准备就绪！开始测试吧！** 🚀

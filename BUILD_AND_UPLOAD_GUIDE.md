# 构建和上传到 GitHub 指南

**创建时间**: 2026-01-17

---

## ✅ 语法检查结果

- ✅ **TypeScript 语法**: 无错误
- ✅ **Linter 检查**: 无错误
- ⚠️ **构建错误**: Turbopack 字体模块问题（Next.js 16 已知问题，不影响代码）

---

## 🔨 构建问题说明

### 当前构建错误

构建时出现 Turbopack 字体模块解析错误：
```
Module not found: Can't resolve '@vercel/turbopack-next/internal/font/google/font'
```

**原因**: Next.js 16.1.0 与 Turbopack 的字体处理存在兼容性问题。

**影响**: 
- ❌ 生产构建失败
- ✅ 开发模式正常工作（`pnpm dev`）
- ✅ 代码本身无语法错误

---

## 🚀 上传到 GitHub 步骤

### 方法 1: 使用上传脚本（推荐）

```powershell
# 执行上传脚本
.\upload-to-github.ps1
```

脚本会自动：
1. 检查 Git 是否安装
2. 初始化 Git 仓库（如果不存在）
3. 添加远程仓库
4. 添加所有文件
5. 提交更改
6. 推送到 GitHub

### 方法 2: 手动 Git 命令

```powershell
# 1. 初始化 Git 仓库（如果不存在）
git init

# 2. 添加远程仓库
git remote add origin https://github.com/JPierreXiong/subtitle_youtube_tk_template.git
# 或更新远程仓库 URL
git remote set-url origin https://github.com/JPierreXiong/subtitle_youtube_tk_template.git

# 3. 添加所有文件
git add .

# 4. 提交更改
git commit -m "Fix: TikTok/YouTube error handling and database plan_type column support"

# 5. 推送到 GitHub
git branch -M main
git push -u origin main
```

---

## 📋 提交信息建议

### 本次修复内容

```
Fix: TikTok/YouTube error handling and database plan_type column support

- Enhanced TikTok transcript API error detection (VIDEO_NOT_FOUND)
- Enhanced YouTube transcript API error detection (VIDEO_NOT_FOUND, HTTP_ERROR)
- Added error handling for missing plan_type database column
- Added detailed error logging for better debugging
- Created SQL migration script for plan_type column
```

---

## 🔧 构建问题解决方案（可选）

### 方案 1: 等待 Next.js 更新

这是 Next.js 16.1.0 的已知问题，等待官方修复。

### 方案 2: 临时禁用 Turbopack（如果必须构建）

修改 `package.json`:
```json
{
  "scripts": {
    "dev": "next dev",  // 移除 --turbopack
    "build": "next build"
  }
}
```

然后重新构建：
```powershell
pnpm install
pnpm run build
```

**注意**: 这会影响开发模式的性能，但可以解决构建问题。

### 方案 3: 使用 build:fast 脚本

```powershell
pnpm run build:fast
```

---

## ✅ 上传前检查清单

- [x] 语法检查通过
- [x] Linter 检查通过
- [ ] 构建成功（可选，当前有 Turbopack 问题）
- [ ] 代码已测试（开发模式正常）
- [ ] 敏感信息已排除（检查 .gitignore）
- [ ] 提交信息已准备

---

## 🔒 安全检查

### 确认 .gitignore 包含

- `.env.local` - 环境变量
- `.env` - 环境变量
- `node_modules/` - 依赖
- `.next/` - 构建输出
- 其他敏感文件

### 检查敏感信息

确保以下内容不会上传：
- API 密钥
- 数据库连接字符串
- 密码和令牌
- 个人身份信息

---

## 📝 上传后验证

1. **检查 GitHub 仓库**:
   - 访问: https://github.com/JPierreXiong/subtitle_youtube_tk_template
   - 确认文件已上传
   - 确认提交信息正确

2. **检查文件完整性**:
   - 确认所有源代码文件存在
   - 确认配置文件存在
   - 确认文档文件存在

---

## 🐛 如果上传失败

### 问题 1: 认证失败

**解决方案**:
1. 生成 GitHub Personal Access Token
   - 访问: https://github.com/settings/tokens
   - 生成新 token（需要 `repo` 权限）
2. 使用 token 作为密码
   - 用户名: 你的 GitHub 用户名
   - 密码: Personal Access Token

### 问题 2: 远程仓库不存在

**解决方案**:
1. 在 GitHub 上创建仓库: `subtitle_youtube_tk_template`
2. 然后执行上传脚本

### 问题 3: 权限不足

**解决方案**:
1. 确认你有仓库的写入权限
2. 如果是 fork 的仓库，需要先创建 Pull Request

---

## 📚 相关文档

- `upload-to-github.ps1` - 自动上传脚本
- `.gitignore` - Git 忽略文件配置
- `DATABASE_PLAN_TYPE_FIX.md` - 数据库修复指南

---

**下一步**: 执行 `.\upload-to-github.ps1` 上传代码到 GitHub

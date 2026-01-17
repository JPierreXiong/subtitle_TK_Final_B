# 服务器启动故障排除指南

**创建时间**: 2026-01-17

---

## 🔍 常见启动问题

### 问题 1: 锁文件冲突

**症状**: 
```
Unable to acquire lock at .next\dev\lock, is another instance of next dev running?
```

**解决方案**:
```powershell
# 删除锁文件
Remove-Item -Path ".next\dev\lock" -Force -ErrorAction SilentlyContinue

# 停止所有 Node 进程
Get-Process -Name node -ErrorAction SilentlyContinue | Stop-Process -Force
```

---

### 问题 2: 端口被占用

**症状**: 
```
Port 3000 is already in use
```

**解决方案**:
```powershell
# 检查端口占用
netstat -ano | findstr ":3000"

# 停止占用端口的进程（替换 PID 为实际进程 ID）
Stop-Process -Id <PID> -Force

# 或使用其他端口
# 修改 package.json 中的 dev 脚本为: "dev": "next dev -p 3001"
```

---

### 问题 3: 编译错误

**症状**: 
- TypeScript 类型错误
- 导入路径错误
- 语法错误

**解决方案**:
```powershell
# 检查 TypeScript 错误
pnpm run lint

# 清理并重新编译
Remove-Item -Path ".next" -Recurse -Force -ErrorAction SilentlyContinue
pnpm dev
```

---

### 问题 4: 环境变量缺失

**症状**: 
- 数据库连接错误
- API 密钥错误
- 配置加载失败

**解决方案**:
1. 检查 `.env.local` 文件是否存在
2. 确认所有必需的环境变量已设置
3. 参考 `env.example.txt` 或 `ENVIRONMENT_VARIABLES.md`

---

### 问题 5: 依赖问题

**症状**: 
- 模块未找到错误
- 版本冲突

**解决方案**:
```powershell
# 清理并重新安装依赖
Remove-Item -Path "node_modules" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path "pnpm-lock.yaml" -Force -ErrorAction SilentlyContinue
pnpm install
```

---

## 🛠️ 完整清理和重启流程

### 步骤 1: 停止所有相关进程

```powershell
# 停止所有 Node 进程
Get-Process -Name node -ErrorAction SilentlyContinue | Stop-Process -Force

# 检查端口占用
netstat -ano | findstr ":3000"
```

### 步骤 2: 清理缓存和锁文件

```powershell
# 删除锁文件
Remove-Item -Path ".next\dev\lock" -Force -ErrorAction SilentlyContinue

# 清理 .next 目录（可选，会重新编译）
Remove-Item -Path ".next" -Recurse -Force -ErrorAction SilentlyContinue
```

### 步骤 3: 重新启动

```powershell
# 切换到项目目录
cd D:\AIsoftware\subtitle_TK_Final_F

# 启动开发服务器
pnpm dev
```

---

## 🔍 诊断步骤

### 1. 检查 Node.js 版本

```powershell
node --version
# 应该 >= 22.21.1
```

### 2. 检查 pnpm 版本

```powershell
pnpm --version
# 应该 >= 8.0.0
```

### 3. 检查依赖安装

```powershell
# 检查 node_modules 是否存在
Test-Path "node_modules"

# 如果不存在，安装依赖
pnpm install
```

### 4. 检查环境变量

```powershell
# 检查 .env.local 文件
Test-Path ".env.local"

# 查看环境变量（不显示敏感信息）
Get-Content ".env.local" | Select-String -Pattern "^[^#]" | Select-Object -First 10
```

### 5. 检查数据库连接

```powershell
# 如果使用 PostgreSQL，检查连接
# 需要根据你的数据库配置调整
```

---

## 📋 手动启动步骤

如果自动启动失败，请手动执行：

### 方法 1: 使用 PowerShell

```powershell
# 1. 打开 PowerShell
# 2. 切换到项目目录
cd D:\AIsoftware\subtitle_TK_Final_F

# 3. 清理（如果需要）
Get-Process -Name node -ErrorAction SilentlyContinue | Stop-Process -Force
Remove-Item -Path ".next\dev\lock" -Force -ErrorAction SilentlyContinue

# 4. 启动服务器
pnpm dev
```

### 方法 2: 使用命令提示符 (CMD)

```cmd
cd D:\AIsoftware\subtitle_TK_Final_F
pnpm dev
```

---

## 🐛 查看详细错误信息

### 查看终端输出

启动服务器时，注意查看终端输出的错误信息：
- TypeScript 编译错误
- 模块导入错误
- 环境变量错误
- 数据库连接错误

### 查看日志文件

```powershell
# Next.js 日志（如果存在）
Get-Content ".next\dev\server.log" -ErrorAction SilentlyContinue | Select-Object -Last 50
```

### 启用详细日志

```powershell
# 设置环境变量以启用详细日志
$env:DEBUG="*"
pnpm dev
```

---

## ✅ 成功启动的标志

服务器成功启动后，你应该看到：

```
▲ Next.js 16.1.0
- Local:        http://localhost:3000
- Environments: .env.local

✓ Ready in X seconds
```

然后可以在浏览器中访问：http://localhost:3000

---

## 📞 如果问题仍然存在

如果以上步骤都无法解决问题，请提供：

1. **错误信息**: 完整的错误消息
2. **终端输出**: 启动时的完整输出
3. **环境信息**:
   - Node.js 版本
   - pnpm 版本
   - 操作系统版本
4. **最近更改**: 最近修改了哪些文件或配置

---

## 🔗 相关文档

- `SERVER_STARTUP_ISSUE_RESOLVED.md` - 之前的启动问题解决方案
- `ENVIRONMENT_VARIABLES.md` - 环境变量配置指南
- `QUICK_START.md` - 快速开始指南

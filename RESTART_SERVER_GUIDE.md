# 🔄 服务器重启指南

**更新时间**: 2026-01-17  
**目的**: 确保最新的代码修改生效

---

## 📋 重启步骤

### 方法 1: 手动重启（推荐）

1. **停止当前开发服务器**:
   - 找到运行 `pnpm dev` 的终端窗口
   - 按 `Ctrl + C` 停止服务器

2. **启动新的开发服务器**:
   ```bash
   pnpm dev
   ```

3. **验证服务器已启动**:
   - 查看终端输出，应该显示：
     ```
     ▲ Next.js 16.1.0
     - Local:        http://localhost:3000
     - Environments: .env.local
     ```

---

### 方法 2: 检查端口占用（如果需要）

如果端口 3000 被占用，可以先停止占用该端口的进程：

```powershell
# Windows PowerShell
$port = 3000
$process = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
if ($process) {
    $pid = $process.OwningProcess
    Stop-Process -Id $pid -Force
    Write-Output "已停止占用端口 $port 的进程 (PID: $pid)"
}
```

然后启动服务器：
```bash
pnpm dev
```

---

## ✅ 验证修改是否生效

重启服务器后，可以通过以下方式验证修改：

1. **检查控制台日志**:
   - 查看是否有新的错误信息
   - 确认服务器正常启动

2. **测试功能**:
   - 访问: http://localhost:3000/ai-media-extractor
   - 提交一个 TikTok URL 测试（如：`https://www.tiktok.com/@username/video/123?is_from_webapp=1`）
   - 查看日志，确认：
     - ✅ Duration 字段正确转换为整数秒数
     - ✅ Thumbnail URL 正确截断
     - ✅ 数据库更新成功

---

## 🔍 当前运行的进程

检测到多个 Node.js 进程正在运行（可能是开发服务器、构建进程等）：

- 如果开发服务器正在运行，它会监听端口 3000
- 如果端口 3000 已被占用，新的服务器无法启动

---

## 💡 提示

- **自动重启**: 如果使用 `pnpm dev`，Next.js 会自动检测文件变化并热重载
- **完全重启**: 如果需要完全重新加载（如环境变量更改），需要手动停止并重启
- **端口冲突**: 如果端口 3000 被占用，可以修改 `.env.local` 中的 `PORT` 变量或停止占用进程

---

**下一步**: 执行 `pnpm dev` 启动开发服务器

# 📋 核心组件方案深度分析与实施计划

**分析时间**: 2026-01-17  
**目标**: 检查现有功能实现情况，制定完整实施方案

---

## 🔍 现有功能检查结果

### ✅ A. 存储策略：Vercel Blob（已实现）

#### 当前实现状态

**文件**: `src/shared/services/media/video-storage.ts`

**已实现功能**:
- ✅ **流式上传**: `streamUploadFromUrl()` - 使用 ReadableStream，不占用内存
- ✅ **存储标识符**: `vercel-blob:${url}` 格式
- ✅ **过期时间字段**: `expiresAt` 字段已存在（24小时）
- ✅ **下载 URL 获取**: `getVideoDownloadUrl()` 支持 Vercel Blob

**代码示例**:
```typescript
// 上传视频到 Vercel Blob
const storageIdentifier = await uploadVideoToStorage(mediaData.videoUrl);
// 返回: "vercel-blob:https://xxx.vercel-storage.com/videos/xxx.mp4"

// 获取下载 URL
const downloadUrl = await getVideoDownloadUrl(storageIdentifier);
```

#### ⚠️ 需要补充的功能

1. **自动清理过期视频**（未实现）
   - 需要：定时任务或 API 路由清理 `expiresAt < NOW()` 的视频
   - 方案：使用 Vercel Cron Jobs 或 Supabase Edge Functions

2. **`video_blob_url` 字段**（部分实现）
   - 当前：使用 `videoUrlInternal` 字段存储
   - 建议：保持现有字段，无需修改

---

### ✅ B. 翻译引擎：Gemini 1.5 Flash（已实现）

#### 当前实现状态

**文件**: `src/shared/services/media/gemini-translator.ts`

**已实现功能**:
- ✅ **长上下文支持**: 使用 Gemini 1.5 Flash 模型
- ✅ **单次翻译**: `translateSubtitleSingle()` - 适用于短内容
- ✅ **分片翻译**: `translateSubtitleChunked()` - 超过 5000 字符自动分片
- ✅ **Prompt 策略**: 已实现保持时间戳和编号
- ✅ **SRT 格式保持**: 确保输出为标准 SRT 格式

**Prompt 示例**:
```typescript
const prompt = `Translate the following SRT content into ${targetLanguage}.
Keep the timestamps and numbering exactly the same.
Only translate the text portion.

${srtContent}`;
```

**API 路由**: `src/app/api/media/translate/route.ts`
- ✅ 已实现翻译接口
- ✅ 支持状态检查（`extracted` → `translating` → `completed`）

#### ✅ 完全符合需求

当前实现已满足所有要求，无需修改。

---

### ⚠️ C. 数据库设计（部分实现）

#### 当前 Schema 检查

**文件**: `src/config/db/schema.ts`

**已存在字段**:
- ✅ `videoUrlInternal`: 存储 Vercel Blob URL（格式：`vercel-blob:${url}`）
- ✅ `expiresAt`: 24小时过期时间
- ✅ `status`: 任务状态（`pending`, `processing`, `extracted`, `translating`, `completed`, `failed`）
- ✅ `progress`: 进度（0-100）

**缺失字段**:
- ❌ `processing_step`: 当前使用 `status` 字段，但不够细粒度

#### 建议改进

**方案 1: 使用现有 `status` 字段（推荐）**
- 优点：无需修改数据库 Schema
- 当前状态已足够：`processing` (提取中) → `extracted` (已提取) → `translating` (翻译中) → `completed` (完成)

**方案 2: 新增 `processing_step` 字段（可选）**
```typescript
processingStep: text('processing_step'), // 'extracting' | 'translating' | 'rewriting'
```

**建议**: 使用方案 1，现有 `status` 字段已足够。

---

### ❌ D. 爆改文案功能（未实现）

#### 功能需求

- **输入**: 
  - 原始字幕文案（`subtitleRaw`）
  - 客户输入要求（如："改成搞笑风格"、"改成专业风格"）
- **输出**: 
  - 新文案（保持 SRT 格式，时间戳不变）
- **实现**: 
  - 调用 Gemini API
  - 基于原始文案和客户要求生成新文案

#### 实施计划

**1. 数据库 Schema 扩展**

```typescript
// 在 media_tasks 表中新增字段
rewrittenSubtitle: text('rewritten_subtitle'), // 爆改后的文案（SRT格式）
rewritePrompt: text('rewrite_prompt'), // 客户输入的改写要求
rewriteStatus: text('rewrite_status'), // 'pending' | 'processing' | 'completed' | 'failed'
```

**2. 创建 Gemini Rewriter 服务**

**文件**: `src/shared/services/media/gemini-rewriter.ts`

```typescript
export class GeminiRewriter {
  /**
   * Rewrite subtitle content based on user requirements
   * @param srtContent Original SRT subtitle content
   * @param userPrompt User's rewrite requirements (e.g., "改成搞笑风格")
   * @returns Rewritten SRT content
   */
  async rewriteSubtitle(
    srtContent: string,
    userPrompt: string
  ): Promise<string> {
    // 使用 Gemini 1.5 Flash 的长上下文能力
    // 一次性处理整个字幕文件
  }
}
```

**3. 创建 API 路由**

**文件**: `src/app/api/media/rewrite/route.ts`

```typescript
POST /api/media/rewrite
Body: {
  taskId: string,
  rewritePrompt: string // 客户输入的改写要求
}
```

**4. 前端集成**

- 在任务详情页面添加"爆改文案"按钮
- 输入改写要求
- 调用 API 并显示进度

---

## 📊 功能实现对比表

| 功能 | 需求 | 当前状态 | 完成度 | 需要补充 |
| --- | --- | --- | --- | --- |
| **Vercel Blob 存储** | ✅ | ✅ 已实现 | 90% | 自动清理过期视频 |
| **Gemini 翻译** | ✅ | ✅ 已实现 | 100% | 无 |
| **数据库设计** | ✅ | ✅ 已实现 | 95% | 可选：processing_step |
| **Supabase Realtime** | ✅ | ✅ 已配置 | 100% | 无 |
| **爆改文案功能** | ❌ | ❌ 未实现 | 0% | 全部需要实现 |

---

## 🚀 实施优先级

### 优先级 1: 爆改文案功能（核心新功能）

**实施步骤**:

1. **数据库 Schema 更新**（5分钟）
   - 添加 `rewrittenSubtitle`, `rewritePrompt`, `rewriteStatus` 字段

2. **创建 Gemini Rewriter 服务**（30分钟）
   - 实现 `rewriteSubtitle()` 方法
   - 使用 Gemini 1.5 Flash 长上下文
   - Prompt 设计：基于原始文案 + 客户要求

3. **创建 API 路由**（20分钟）
   - `POST /api/media/rewrite`
   - 状态管理：`extracted` → `rewriting` → `completed`

4. **前端集成**（30分钟）
   - 添加"爆改文案"按钮
   - 输入框（客户要求）
   - 进度显示

**预计时间**: 1.5 小时

---

### 优先级 2: 自动清理过期视频（优化）

**实施步骤**:

1. **创建清理 API 路由**（20分钟）
   - `POST /api/media/cleanup-expired`
   - 查询 `expiresAt < NOW()` 的任务
   - 调用 Vercel Blob API 删除视频

2. **配置 Vercel Cron Job**（10分钟）
   - 每天凌晨 2 点执行
   - 清理过期视频

**预计时间**: 30 分钟

---

### 优先级 3: 细化 processing_step（可选）

**实施步骤**:

1. **数据库 Schema 更新**（5分钟）
   - 添加 `processingStep` 字段

2. **更新 Worker 逻辑**（15分钟）
   - 在状态更新时同时更新 `processingStep`

**预计时间**: 20 分钟

---

## 📝 详细实施代码

### 1. 数据库 Schema 更新

```typescript
// src/config/db/schema.ts
export const mediaTasks = pgTable('media_tasks', {
  // ... 现有字段
  
  // 新增：爆改文案相关字段
  rewrittenSubtitle: text('rewritten_subtitle'), // 爆改后的文案（SRT格式）
  rewritePrompt: text('rewrite_prompt'), // 客户输入的改写要求
  rewriteStatus: text('rewrite_status'), // 'pending' | 'processing' | 'completed' | 'failed'
  
  // 可选：细化处理步骤
  processingStep: text('processing_step'), // 'extracting' | 'translating' | 'rewriting'
});
```

### 2. Gemini Rewriter 服务

```typescript
// src/shared/services/media/gemini-rewriter.ts
export class GeminiRewriter {
  private configs: GeminiTranslationConfigs;
  
  async rewriteSubtitle(
    srtContent: string,
    userPrompt: string
  ): Promise<string> {
    const prompt = `You are an expert content writer. 
Based on the following subtitle content and user requirements, rewrite the text while keeping the SRT format, timestamps, and numbering exactly the same.

User Requirements: ${userPrompt}

Original SRT Content:
${srtContent}

Instructions:
1. Keep all timestamps (e.g., 00:00:01,000 --> 00:00:03,000) unchanged
2. Keep all sequence numbers (e.g., 1, 2, 3) unchanged
3. Only rewrite the text content according to user requirements
4. Maintain the same SRT format
5. Return only the SRT content, no explanations or markdown

Rewritten SRT Content:`;

    // 调用 Gemini API（类似 translateSubtitleSingle）
    // ...
  }
}
```

### 3. API 路由

```typescript
// src/app/api/media/rewrite/route.ts
export async function POST(request: NextRequest) {
  const { taskId, rewritePrompt } = await request.json();
  
  // 1. 验证任务状态（必须是 extracted 或 completed）
  // 2. 检查是否有原始字幕
  // 3. 更新状态为 rewriting
  // 4. 调用 Gemini Rewriter
  // 5. 保存结果到 rewrittenSubtitle
  // 6. 更新状态为 completed
}
```

---

## ✅ 总结

### 已完成功能（90%）

- ✅ Vercel Blob 存储（流式上传、过期时间）
- ✅ Gemini 翻译（长上下文、分片支持）
- ✅ 数据库设计（基本字段完整）
- ✅ Supabase Realtime（已配置）

### 需要补充功能（10%）

1. **爆改文案功能**（核心新功能）
   - 数据库 Schema 扩展
   - Gemini Rewriter 服务
   - API 路由
   - 前端集成

2. **自动清理过期视频**（优化）
   - 清理 API 路由
   - Vercel Cron Job

3. **细化 processing_step**（可选）
   - 数据库字段
   - Worker 逻辑更新

---

**下一步**: 开始实施爆改文案功能

# 爆款文案改写功能设计方案

## 📋 功能概述

在现有的"提取 → 翻译"流程基础上，增加**"改写"**功能，让用户可以将提取的字幕按照爆款模板或自定义需求进行改写，提升文案质量和吸引力。

---

## 🎯 一、功能需求分析

### 1.1 核心功能

1. **爆款模板改写**
   - TikTok 爆款模式（前3秒黄金钩子、强节奏感、高频情绪词）
   - YouTube 深度模式（结构化内容、长线逻辑、干货密度大）
   - 小红书风格（种草文案、emoji 丰富、互动性强）
   - 微博风格（热点结合、话题性强）

2. **自定义需求改写**
   - 用户输入框：允许用户输入特定改写要求
   - 快捷标签：提供常用需求快速选择
   - 混合模式：模板 + 自定义需求

3. **改写结果管理**
   - 保存改写后的文案
   - 支持多次改写（A/B 测试）
   - 对比原文和改写版

### 1.2 用户场景

**场景 1：提取后直接改写**
- 用户提取 TikTok 视频字幕
- 选择"TikTok 爆款模式"改写
- 获得优化后的爆款文案

**场景 2：自定义需求改写**
- 用户提取 YouTube 视频字幕
- 输入："请把这段文案改成脱口秀风格，加入更多吐槽，针对 20 岁左右的年轻人"
- 获得定制化改写结果

**场景 3：改写后翻译**
- 用户提取字幕 → 改写 → 翻译成目标语言
- 流程：提取 → 改写 → 翻译

---

## 🎨 二、UI 设计方案

### 2.1 整体布局

在 `MediaExtractor` 组件中，在"翻译"功能区域下方，新增"改写"功能区域。

```
┌─────────────────────────────────────┐
│  URL 输入框                          │
│  [提取按钮]                          │
├─────────────────────────────────────┤
│  提取结果展示                        │
│  - 视频信息                          │
│  - 字幕预览                          │
├─────────────────────────────────────┤
│  【改写功能区域】（新增）            │
│  ┌───────────────────────────────┐ │
│  │ 改写风格选择器                  │ │
│  │ [TikTok] [YouTube] [小红书]... │ │
│  └───────────────────────────────┘ │
│  ┌───────────────────────────────┐ │
│  │ 自定义需求输入框（紫色呼吸灯） │ │
│  │ [输入你的特定改写要求...]      │ │
│  └───────────────────────────────┘ │
│  [快捷标签: 更幽默/缩短/专业/...]   │
│  [开始改写] 按钮                    │
├─────────────────────────────────────┤
│  【翻译功能区域】（现有）            │
│  [语言选择器] [开始翻译]             │
└─────────────────────────────────────┘
```

### 2.2 改写功能区域详细设计

#### A. 风格选择器

```tsx
<div className="space-y-3">
  <Label>改写风格</Label>
  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
    {REWRITE_STYLES.map((style) => (
      <Button
        key={style.value}
        variant={selectedStyle === style.value ? "default" : "outline"}
        onClick={() => setSelectedStyle(style.value)}
        className="h-auto py-3 flex flex-col items-center gap-1"
      >
        <style.icon className="h-5 w-5" />
        <span className="text-xs">{style.label}</span>
      </Button>
    ))}
  </div>
</div>
```

**风格选项**：
- `tiktok` - TikTok 爆款模式
- `youtube` - YouTube 深度模式
- `xiaohongshu` - 小红书风格
- `weibo` - 微博风格
- `custom` - 仅自定义（不使用模板）

#### B. 自定义需求输入框（紫色呼吸灯效果）

```tsx
<div className="relative group">
  {/* 呼吸灯背景层 */}
  <div className="absolute -inset-0.5 bg-gradient-to-r from-purple-600 to-blue-600 rounded-xl blur opacity-20 group-hover:opacity-40 transition duration-1000 group-focus-within:animate-pulse" />
  
  {/* 输入框 */}
  <textarea
    value={userRequirement}
    onChange={(e) => setUserRequirement(e.target.value)}
    placeholder="输入你的特定改写要求，Gemini 将为您深度定制...&#10;例如：改成幽默吐槽风 / 增加更多 Emoji / 缩短篇幅"
    className="relative w-full min-h-[100px] bg-black/60 backdrop-blur-xl border border-white/10 rounded-xl p-4 text-sm text-purple-50 placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all resize-none"
  />
  
  {/* 右下角状态指示器 */}
  <div className="absolute bottom-3 right-3 flex items-center gap-2">
    {userRequirement.length > 0 && (
      <button 
        onClick={() => setUserRequirement('')}
        className="text-[10px] text-white/40 hover:text-white/80 transition-colors bg-white/5 px-2 py-1 rounded-md"
      >
        重置
      </button>
    )}
    <div className={`w-1.5 h-1.5 rounded-full ${userRequirement ? 'bg-purple-500 animate-ping' : 'bg-white/10'}`} />
  </div>
</div>
```

#### C. 快捷需求标签

```tsx
<div className="flex flex-wrap gap-2">
  {QUICK_REQUIREMENTS.map((req) => (
    <button
      key={req}
      onClick={() => setUserRequirement(req)}
      className="text-xs px-3 py-1.5 rounded-md border border-white/5 bg-white/5 text-white/40 hover:bg-purple-500/20 hover:text-purple-300 hover:border-purple-500/30 transition-all"
    >
      + {req}
    </button>
  ))}
</div>
```

**快捷需求**：
- "更幽默一点"
- "缩短篇幅"
- "增加专业感"
- "加入更多 Emoji"
- "改成口语化"
- "增加互动引导"

#### D. 改写按钮

```tsx
<Button
  onClick={handleRewrite}
  disabled={!canRewrite || isRewriting}
  className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
  size="lg"
>
  {isRewriting ? (
    <>
      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      AI 正在改写中...
    </>
  ) : (
    <>
      <Sparkles className="mr-2 h-4 w-4" />
      {userRequirement ? '按要求改写' : '开始改写'}
    </>
  )}
</Button>
```

### 2.3 改写结果展示

#### A. 改写结果卡片

```tsx
{rewrittenContent && (
  <Card className="border-purple-500/20 bg-gradient-to-br from-purple-950/20 to-blue-950/20">
    <CardHeader>
      <CardTitle className="flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-purple-400" />
        AI 改写结果
      </CardTitle>
    </CardHeader>
    <CardContent>
      {/* 对比滑块 */}
      <div className="space-y-4">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">原文</span>
          <span className="text-muted-foreground">改写版</span>
        </div>
        <div className="relative">
          <input
            type="range"
            min="0"
            max="100"
            value={comparisonSlider}
            onChange={(e) => setComparisonSlider(Number(e.target.value))}
            className="w-full"
          />
        </div>
        {/* 内容展示 */}
        <div className="relative h-[300px] overflow-hidden rounded-lg border">
          <div 
            className="absolute inset-0 p-4 transition-opacity"
            style={{ opacity: comparisonSlider / 100 }}
          >
            <pre className="text-sm whitespace-pre-wrap">{taskStatus.subtitleRaw}</pre>
          </div>
          <div 
            className="absolute inset-0 p-4 bg-purple-950/30 transition-opacity"
            style={{ opacity: 1 - comparisonSlider / 100 }}
          >
            <pre className="text-sm whitespace-pre-wrap">{rewrittenContent}</pre>
          </div>
        </div>
      </div>
      
      {/* 操作按钮 */}
      <div className="flex gap-2 mt-4">
        <Button variant="outline" onClick={() => copyToClipboard(rewrittenContent)}>
          <Copy className="mr-2 h-4 w-4" />
          复制改写版
        </Button>
        <Button variant="outline" onClick={handleDownloadRewritten}>
          <Download className="mr-2 h-4 w-4" />
          下载 SRT
        </Button>
        <Button variant="outline" onClick={handleRewriteAgain}>
          <Sparkles className="mr-2 h-4 w-4" />
          再次改写
        </Button>
      </div>
    </CardContent>
  </Card>
)}
```

---

## 🔧 三、后端设计方案

### 3.1 数据库 Schema 更新

在 `media_tasks` 表中新增字段：

```typescript
// src/config/db/schema.ts
export const mediaTasks = pgTable('media_tasks', {
  // ... 现有字段
  
  // 改写相关字段（新增）
  subtitleRewritten: text('subtitle_rewritten'), // 改写后的字幕内容（SRT格式）
  rewriteStyle: text('rewrite_style'), // 改写风格：tiktok, youtube, xiaohongshu, weibo, custom
  rewriteRequirement: text('rewrite_requirement'), // 用户自定义改写需求
  rewriteStatus: text('rewrite_status'), // rewriting, completed, failed
  rewriteCreditId: text('rewrite_credit_id'), // 改写消耗的积分记录ID（用于退款）
});
```

### 3.2 API 路由设计

#### A. 改写 API：`/api/media/rewrite`

```typescript
// src/app/api/media/rewrite/route.ts
export async function POST(request: NextRequest) {
  const { taskId, style, userRequirement } = await request.json();
  
  // 1. 验证用户和任务
  // 2. 检查任务状态（必须是 extracted）
  // 3. 检查积分（改写消耗 8 积分）
  // 4. 调用 Gemini 改写服务
  // 5. 保存改写结果
  // 6. 更新任务状态
}
```

#### B. 改写服务：扩展 GeminiTranslator

```typescript
// src/shared/services/media/gemini-translator.ts

export class GeminiTranslator {
  /**
   * Rewrite subtitle content with style and custom requirements
   */
  async rewriteSubtitle(
    srtContent: string,
    style: string,
    userRequirement?: string
  ): Promise<string> {
    const prompt = this.buildRewritePrompt(srtContent, style, userRequirement);
    // ... 调用 Gemini API
  }
  
  /**
   * Build rewrite prompt with style and custom requirements
   */
  private buildRewritePrompt(
    text: string,
    style: string,
    userRequirement?: string
  ): string {
    const styleConfigs: Record<string, string> = {
      tiktok: "TikTok 爆款模式：前3秒黄金钩子，强节奏感，高频情绪词，使用口语化表达，加入热门话题标签。",
      youtube: "YouTube 深度模式：结构化内容，长线逻辑，干货密度大，专业术语准确，适合深度观看。",
      xiaohongshu: "小红书风格：种草文案，emoji 丰富，互动性强，使用"姐妹"等亲切称呼，突出产品亮点。",
      weibo: "微博风格：热点结合，话题性强，使用网络流行语，适合快速传播，加入话题标签。",
    };
    
    const baseInstructions = styleConfigs[style] || styleConfigs.tiktok;
    
    // 用户自定义需求优先级最高
    const customSection = userRequirement 
      ? `【用户特定要求】（必须优先满足）：${userRequirement}` 
      : "请按照预设风格进行自由发挥。";
    
    return `
你是一个顶级的短视频文案改写专家。
你的任务是将下方的原始字幕改写成爆款文案。

【核心指导准则】：
1. ${baseInstructions}
2. 严禁 AI 腔调，使用地道口语。
3. 保持时间戳格式不变（SRT 格式）。
4. ${customSection}
5. 改写后的文案要更有吸引力，能提升完播率和互动率。

【原始字幕】：
"""
${text}
"""

请直接输出改写后的 SRT 格式文案，保持时间戳和序号不变，只改写文本内容。
`;
  }
}
```

### 3.3 流式改写（可选，提升用户体验）

如果需要流式返回改写结果（类似打字机效果）：

```typescript
// 使用 Gemini 的流式 API
async rewriteSubtitleStream(
  srtContent: string,
  style: string,
  userRequirement?: string
): Promise<ReadableStream> {
  // 调用 Gemini 流式 API
  // 返回 ReadableStream 供前端实时显示
}
```

---

## 🔄 四、完整业务流程

### 4.1 流程时序图

```
用户操作流程：
1. 输入 URL → 提交提取任务
2. 等待提取完成（status: extracted）
3. 显示字幕预览
4. 【新增】选择改写风格 + 输入自定义需求
5. 【新增】点击"开始改写" → 调用 /api/media/rewrite
6. 【新增】显示改写结果（对比滑块）
7. 可选：选择目标语言 → 翻译改写后的文案
8. 下载最终结果（改写版或翻译版）
```

### 4.2 状态流转

```
pending → processing → extracted → [rewriting] → [rewritten] → [translating] → completed
                                    ↑ 新增状态
```

**新增状态**：
- `rewriting` - 正在改写
- `rewritten` - 改写完成（可选，也可以直接覆盖 `subtitleRaw`）

### 4.3 积分消耗

- **提取字幕**: 10 积分
- **改写文案**: 8 积分（新增）
- **翻译字幕**: 5 积分

**总流程积分**：
- 提取 + 改写：18 积分
- 提取 + 改写 + 翻译：23 积分

---

## 🎨 五、UI 组件详细设计

### 5.1 改写功能区域完整代码

```tsx
{/* 改写功能区域 - 仅在 extracted 状态且存在字幕时显示 */}
{taskStatus?.status === 'extracted' && taskStatus.subtitleRaw && (
  <Card className="border-purple-500/20 bg-gradient-to-br from-purple-950/20 to-blue-950/20">
    <CardHeader>
      <CardTitle className="flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-purple-400" />
        AI 爆款改写
        <Badge variant="secondary" className="ml-auto">
          VIP 功能
        </Badge>
      </CardTitle>
    </CardHeader>
    <CardContent className="space-y-4">
      {/* 风格选择器 */}
      <div className="space-y-2">
        <Label>选择改写风格</Label>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {REWRITE_STYLES.map((style) => (
            <Button
              key={style.value}
              variant={selectedRewriteStyle === style.value ? "default" : "outline"}
              onClick={() => setSelectedRewriteStyle(style.value)}
              className="h-auto py-3"
              disabled={isRewriting}
            >
              {style.label}
            </Button>
          ))}
        </div>
      </div>
      
      {/* 自定义需求输入框 */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <Label className="text-xs font-medium text-purple-300/80 uppercase tracking-wider">
            自定义改写需求（可选）
          </Label>
          <span className="text-[10px] text-white/30 italic">
            例如：改成幽默吐槽风 / 增加更多 Emoji
          </span>
        </div>
        
        <div className="relative group">
          {/* 呼吸灯背景 */}
          <div className="absolute -inset-0.5 bg-gradient-to-r from-purple-600 to-blue-600 rounded-xl blur opacity-20 group-hover:opacity-40 transition duration-1000 group-focus-within:animate-pulse" />
          
          {/* 输入框 */}
          <textarea
            value={rewriteRequirement}
            onChange={(e) => setRewriteRequirement(e.target.value)}
            placeholder="输入你的特定改写要求，Gemini 将为您深度定制..."
            className="relative w-full min-h-[100px] bg-black/60 backdrop-blur-xl border border-white/10 rounded-xl p-4 text-sm text-purple-50 placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all resize-none"
            disabled={isRewriting}
          />
          
          {/* 状态指示器 */}
          <div className="absolute bottom-3 right-3 flex items-center gap-2">
            {rewriteRequirement.length > 0 && (
              <button 
                onClick={() => setRewriteRequirement('')}
                className="text-[10px] text-white/40 hover:text-white/80 transition-colors bg-white/5 px-2 py-1 rounded-md"
              >
                重置
              </button>
            )}
            <div className={`w-1.5 h-1.5 rounded-full ${rewriteRequirement ? 'bg-purple-500 animate-ping' : 'bg-white/10'}`} />
          </div>
        </div>
        
        {/* 快捷需求标签 */}
        <div className="flex flex-wrap gap-2">
          {QUICK_REQUIREMENTS.map((req) => (
            <button
              key={req}
              onClick={() => setRewriteRequirement(req)}
              className="text-xs px-3 py-1.5 rounded-md border border-white/5 bg-white/5 text-white/40 hover:bg-purple-500/20 hover:text-purple-300 transition-all"
              disabled={isRewriting}
            >
              + {req}
            </button>
          ))}
        </div>
      </div>
      
      {/* 改写按钮 */}
      <Button
        onClick={handleRewrite}
        disabled={!selectedRewriteStyle || isRewriting}
        className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
        size="lg"
      >
        {isRewriting ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            AI 正在改写中...
          </>
        ) : (
          <>
            <Sparkles className="mr-2 h-4 w-4" />
            {rewriteRequirement ? '按要求改写' : '开始改写'}
          </>
        )}
      </Button>
      
      {/* 改写结果展示 */}
      {rewrittenContent && (
        <div className="mt-4 space-y-4">
          {/* 对比滑块 */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">原文</span>
              <span className="text-muted-foreground">改写版</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={comparisonSlider}
              onChange={(e) => setComparisonSlider(Number(e.target.value))}
              className="w-full"
            />
          </div>
          
          {/* 内容对比 */}
          <div className="relative h-[300px] overflow-auto rounded-lg border bg-background">
            <div className="p-4">
              <div 
                className="absolute inset-0 p-4 transition-opacity"
                style={{ opacity: comparisonSlider / 100 }}
              >
                <pre className="text-sm whitespace-pre-wrap font-mono">
                  {taskStatus.subtitleRaw}
                </pre>
              </div>
              <div 
                className="absolute inset-0 p-4 bg-purple-950/30 transition-opacity"
                style={{ opacity: 1 - comparisonSlider / 100 }}
              >
                <pre className="text-sm whitespace-pre-wrap font-mono text-purple-100">
                  {rewrittenContent}
                </pre>
              </div>
            </div>
          </div>
          
          {/* 操作按钮 */}
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => copyToClipboard(rewrittenContent)}>
              <Copy className="mr-2 h-4 w-4" />
              复制改写版
            </Button>
            <Button variant="outline" onClick={handleDownloadRewritten}>
              <Download className="mr-2 h-4 w-4" />
              下载 SRT
            </Button>
            <Button variant="outline" onClick={handleRewriteAgain}>
              <Sparkles className="mr-2 h-4 w-4" />
              再次改写
            </Button>
          </div>
        </div>
      )}
    </CardContent>
  </Card>
)}
```

---

## 📊 六、技术实现细节

### 6.1 前端 Hook：`useMediaRewrite`

```typescript
// src/shared/hooks/use-media-rewrite.ts
export function useMediaRewrite() {
  const [isRewriting, setIsRewriting] = useState(false);
  const [rewrittenContent, setRewrittenContent] = useState<string | null>(null);
  
  const rewrite = async (
    taskId: string,
    style: string,
    userRequirement?: string
  ): Promise<boolean> => {
    setIsRewriting(true);
    try {
      const resp = await fetch('/api/media/rewrite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId, style, userRequirement }),
      });
      
      const { code, data } = await resp.json();
      if (code === 0) {
        setRewrittenContent(data.rewrittenContent);
        return true;
      }
      return false;
    } finally {
      setIsRewriting(false);
    }
  };
  
  return { rewrite, isRewriting, rewrittenContent };
}
```

### 6.2 后端 API 实现

```typescript
// src/app/api/media/rewrite/route.ts
export async function POST(request: NextRequest) {
  const { taskId, style, userRequirement } = await request.json();
  
  // 1. 验证
  const user = await getUserInfo();
  const task = await findMediaTaskById(taskId);
  
  // 2. 检查状态
  if (task.status !== 'extracted' || !task.subtitleRaw) {
    return respErr('Task is not ready for rewriting');
  }
  
  // 3. 检查积分（8 积分）
  const requiredCredits = 8;
  const remainingCredits = await getRemainingCredits(user.id);
  if (remainingCredits < requiredCredits) {
    return respErr(`Insufficient credits. Required: ${requiredCredits}`);
  }
  
  // 4. 消耗积分
  const consumedCredit = await consumeCredits({
    userId: user.id,
    credits: requiredCredits,
    scene: 'payment',
    description: `Content rewrite: ${style}`,
  });
  
  // 5. 更新状态
  await updateMediaTaskById(taskId, {
    rewriteStatus: 'rewriting',
    rewriteStyle: style,
    rewriteRequirement: userRequirement || null,
    rewriteCreditId: consumedCredit.id,
  });
  
  try {
    // 6. 调用 Gemini 改写
    const translator = await getGeminiTranslator();
    const rewrittenContent = await translator.rewriteSubtitle(
      task.subtitleRaw,
      style,
      userRequirement
    );
    
    // 7. 保存结果
    await updateMediaTaskById(taskId, {
      subtitleRewritten: rewrittenContent,
      rewriteStatus: 'completed',
    });
    
    return respData({ rewrittenContent });
  } catch (error) {
    await updateMediaTaskById(taskId, {
      rewriteStatus: 'failed',
      errorMessage: error.message,
    });
    throw error;
  }
}
```

---

## 🎯 七、实施计划

### Phase 1: 数据库和基础 API（1-2 天）

1. ✅ 更新数据库 Schema（新增改写相关字段）
2. ✅ 创建 `/api/media/rewrite` 路由
3. ✅ 扩展 `GeminiTranslator` 类（添加改写方法）
4. ✅ 测试 API 功能

### Phase 2: 前端 UI（2-3 天）

1. ✅ 创建 `useMediaRewrite` Hook
2. ✅ 在 `MediaExtractor` 组件中添加改写功能区域
3. ✅ 实现风格选择器
4. ✅ 实现自定义需求输入框（紫色呼吸灯效果）
5. ✅ 实现改写结果展示（对比滑块）
6. ✅ 集成到现有流程

### Phase 3: 优化和测试（1-2 天）

1. ✅ 流式改写（可选，提升用户体验）
2. ✅ 错误处理优化
3. ✅ UI/UX 优化
4. ✅ 完整测试

---

## 📝 八、关键设计决策

### 8.1 改写结果存储

**方案 A**：新增字段 `subtitleRewritten`
- ✅ 保留原文和改写版
- ✅ 支持对比查看
- ✅ 支持多次改写

**方案 B**：直接覆盖 `subtitleRaw`
- ❌ 丢失原文
- ❌ 无法对比

**推荐**：方案 A（新增字段）

### 8.2 改写后翻译

**流程**：
1. 提取 → `subtitleRaw`
2. 改写 → `subtitleRewritten`
3. 翻译 → 可以选择翻译原文或改写版

**实现**：
- 翻译 API 增加参数：`sourceType: 'original' | 'rewritten'`
- 默认翻译改写版（如果存在）

### 8.3 积分策略

- **改写**: 8 积分（中等成本，鼓励使用）
- **免费试用**: 可以包含 1 次改写
- **VIP 功能**: 可以标记为 VIP 专属功能

---

## ✅ 九、实施检查清单

### 数据库
- [ ] 更新 Schema（新增改写字段）
- [ ] 运行数据库迁移
- [ ] 验证字段创建

### 后端
- [ ] 扩展 `GeminiTranslator` 类
- [ ] 创建 `/api/media/rewrite` 路由
- [ ] 实现积分扣除逻辑
- [ ] 实现错误处理和回滚

### 前端
- [ ] 创建 `useMediaRewrite` Hook
- [ ] 添加改写功能区域 UI
- [ ] 实现风格选择器
- [ ] 实现自定义需求输入框
- [ ] 实现改写结果展示
- [ ] 集成到现有流程

### 测试
- [ ] 单元测试
- [ ] 集成测试
- [ ] UI 测试
- [ ] 性能测试

---

## 🚀 十、预期效果

### 用户体验提升

1. **功能完整性**: 从"提取工具"升级为"创作工作站"
2. **个性化**: 支持自定义需求，满足多样化场景
3. **视觉冲击**: 紫色呼吸灯效果，提升产品质感
4. **对比功能**: 滑块对比，直观展示改写效果

### 商业价值

1. **差异化竞争**: 改写功能是独特卖点
2. **付费转化**: VIP 功能，提升付费率
3. **用户粘性**: 多次改写，增加使用频次
4. **SEO 优化**: "AI 文案改写工具"关键词优化

---

**方案设计完成时间**: 2024-12-25  
**状态**: ✅ 方案已设计，等待批准执行

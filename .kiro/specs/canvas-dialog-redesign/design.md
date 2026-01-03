# 设计文档

## 概述

本设计文档描述画布生成图片交互逻辑的重新设计方案。核心目标是移除左侧侧边栏，采用底部对话框作为主要交互入口，实现简洁、现代、工具型产品风格的界面。整体设计参考苹果公司的玻璃化设计语言和 Google 搜索栏的简洁风格。

## 架构

### 整体布局架构

```
┌─────────────────────────────────────────────────────────────┐
│                        顶部导航栏                            │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│                                                             │
│                      全屏画布区域                            │
│                                                             │
│                                                             │
│  ┌──────────┐                                               │
│  │ 缩放控制 │                                               │
│  └──────────┘                                               │
│                    ┌─────────────────────┐                  │
│                    │    参考图预览区域    │                  │
│                    └─────────────────────┘                  │
│                    ┌─────────────────────┐                  │
│                    │     底部对话框       │                  │
│                    └─────────────────────┘                  │
└─────────────────────────────────────────────────────────────┘
```

### 底部对话框内部结构

```
┌─────────────────────────────────────────────────────────────┐
│ [模式] [+] │        提示词输入框           │ [菜单] [生成] │
└─────────────────────────────────────────────────────────────┘
```

## 组件和接口

### 1. CanvasDialogBar 组件

底部对话框主组件，负责整合所有交互元素。

```typescript
interface CanvasDialogBarProps {
  // 生成配置
  settings: GenerationSettings;
  onSettingsChange: (settings: GenerationSettings) => void;
  
  // 参考图片
  refImages: UploadedImage[];
  onRefImagesChange: (images: UploadedImage[]) => void;
  
  // 生成控制
  isGenerating: boolean;
  onGenerate: () => void;
  onCancel: () => void;
  
  // 模式切换（预留扩展）
  mode: 'image' | 'video' | 'chat';
  onModeChange: (mode: string) => void;
}
```

### 2. ModeSwitch 组件

模式切换按钮，位于对话框最左侧。

```typescript
interface ModeSwitchProps {
  currentMode: 'image' | 'video' | 'chat';
  onModeChange: (mode: string) => void;
  disabled?: boolean;
}

// 模式配置
const MODES = [
  { id: 'image', label: '生成图片', icon: ImageIcon, enabled: true },
  { id: 'video', label: '生成视频', icon: VideoIcon, enabled: false },
  { id: 'chat', label: 'AI 对话', icon: MessageIcon, enabled: false },
];
```

### 3. RefImageUploader 组件

参考图上传按钮（+按钮）。

```typescript
interface RefImageUploaderProps {
  onUpload: (images: UploadedImage[]) => void;
  disabled?: boolean;
  maxImages?: number;
}
```

### 4. RefImagePreview 组件

参考图预览区域，显示在对话框上方。

```typescript
interface RefImagePreviewProps {
  images: UploadedImage[];
  onRemove: (imageId: string) => void;
  maxVisible?: number;
}
```

### 5. ConfigPanel 组件

配置面板，以卡片形式展开。

```typescript
interface ConfigPanelProps {
  isOpen: boolean;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLElement>;
  
  // 配置项
  model: string;
  onModelChange: (model: string) => void;
  aspectRatio: string;
  onAspectRatioChange: (ratio: string) => void;
  imageSize: string;
  onImageSizeChange: (size: string) => void;
  generateCount: number;
  onGenerateCountChange: (count: number) => void;
}
```

### 6. CanvasZoomControl 组件

画布缩放控制组件，位于左下角。

```typescript
interface CanvasZoomControlProps {
  scale: number;
  onScaleChange: (scale: number) => void;
  onReset: () => void;
  minScale?: number;
  maxScale?: number;
}
```

## 数据模型

### GenerationSettings（扩展）

```typescript
interface GenerationSettings {
  model: string;
  prompt: string;
  aspectRatio: string;
  imageSize: string;
  refImageUrl?: string;
  refImages?: UploadedImage[];
  generateCount: number;  // 新增：生成数量 1-6
}
```

### DialogState

```typescript
interface DialogState {
  mode: 'image' | 'video' | 'chat';
  isConfigPanelOpen: boolean;
  isGenerating: boolean;
  generationProgress: number;
  error: string | null;
}
```

### 图片生成位置计算

#### 位置计算规则

1. **锚点确定**：以画布中最近一次生成的图片位置作为参考锚点
2. **排列方向**：新生成的图片默认排列在上一次生成图片的下方区域
3. **避免重叠**：确保不与画布中已有的任何图片发生重叠
4. **位置追踪**：若上一次生成的图片已被用户手动拖动，系统通过数据状态获取其最新位置作为下一次生成的参考基准

#### 批量生成排列

当一次生成多张图片时：
- 新生成的图片在该生成区域内按横向顺序自动排列
- 保持统一间距（默认 20px）
- 形成清晰的生成分组结构

```typescript
interface GenerationPosition {
  anchorImageId: string | null;  // 参考锚点图片 ID
  anchorPosition: { x: number; y: number };  // 锚点位置
  direction: 'below' | 'right';  // 排列方向
  spacing: number;  // 图片间距
}

// 计算新图片位置
function calculateNewImagePosition(
  existingImages: CanvasImage[],
  newImageSize: { width: number; height: number },
  batchIndex: number,  // 批量生成中的索引
  batchCount: number   // 批量生成总数
): { x: number; y: number } {
  // 1. 找到最近生成的图片作为锚点
  const latestImage = findLatestGeneratedImage(existingImages);
  
  // 2. 计算新图片的基准位置（锚点下方）
  const baseY = latestImage 
    ? latestImage.y + latestImage.height + VERTICAL_SPACING
    : INITIAL_Y;
  const baseX = latestImage?.x ?? INITIAL_X;
  
  // 3. 批量生成时横向排列
  const horizontalOffset = batchIndex * (newImageSize.width + HORIZONTAL_SPACING);
  
  // 4. 检测并避免重叠
  return findNonOverlappingPosition(
    existingImages,
    { x: baseX + horizontalOffset, y: baseY },
    newImageSize
  );
}
```

#### 视角自动调整

在图片实际生成之前：
1. 系统提前计算并预留即将生成图片所需的完整区域
2. 对画布视角进行轻微自动调整或聚焦
3. 使该区域始终处于当前可视范围内
4. 视角调整应平滑、克制（300ms 缓动动画）

```typescript
function focusOnGenerationArea(
  targetArea: { x: number; y: number; width: number; height: number },
  currentViewport: Viewport,
  setPosition: (pos: { x: number; y: number }) => void,
  setScale: (scale: number) => void
) {
  // 计算目标区域中心
  const targetCenterX = targetArea.x + targetArea.width / 2;
  const targetCenterY = targetArea.y + targetArea.height / 2;
  
  // 检查目标区域是否在当前视口内
  const isInViewport = checkAreaInViewport(targetArea, currentViewport);
  
  if (!isInViewport) {
    // 平滑动画调整视角（300ms）
    animateToPosition(
      { x: targetCenterX, y: targetCenterY },
      currentViewport,
      setPosition,
      300
    );
  }
}
```

## 正确性属性

*属性是系统在所有有效执行中应保持为真的特征或行为——本质上是关于系统应该做什么的正式声明。属性作为人类可读规范和机器可验证正确性保证之间的桥梁。*

### 属性 1: 参考图拖拽上传

*对于任意*有效的图片文件，当用户将其拖拽到输入框区域时，系统应识别并添加该图片到参考图列表中。
**验证: 需求 4.3**

### 属性 2: 参考图上传后显示预览

*对于任意*成功上传的参考图，系统应在对话框上方区域显示该图片的预览。
**验证: 需求 4.4**

### 属性 3: 生成触发验证

*对于任意*非空的提示词输入，当用户点击生成按钮或按回车时，系统应触发图片生成流程。
**验证: 需求 5.4**

### 属性 4: 空输入阻止生成

*对于任意*空白或仅包含空格的提示词输入，当用户尝试触发生成时，系统应阻止生成并显示提示信息。
**验证: 需求 5.5**

### 属性 5: 参考图条件渲染

*对于任意*参考图列表状态，当列表非空时系统应显示预览区域，当列表为空时应隐藏预览区域。
**验证: 需求 6.1**

### 属性 6: 参考图删除

*对于任意*已上传的参考图，当用户点击删除按钮时，该图片应从参考图列表中移除。
**验证: 需求 6.3**

### 属性 7: 生成数量滑动条

*对于任意*滑动条操作，生成数量值应在 1-6 范围内变化，且 UI 应实时显示当前值。
**验证: 需求 7.5**

### 属性 8: 缩放控制实时更新

*对于任意*缩放控制操作，画布缩放比例应实时更新并反映在视图中。
**验证: 需求 8.3**

### 属性 9: 生成中状态保护

*对于任意*正在进行的生成任务，生成按钮和回车触发应被禁用，防止重复提交。
**验证: 需求 9.3**

### 属性 10: 生成完成后画布更新

*对于任意*成功完成的图片生成，生成的图片应自动添加到画布中。
**验证: 需求 9.5**

### 属性 11: 生成失败后状态恢复

*对于任意*失败的生成任务，系统应显示错误信息并恢复到可操作状态。
**验证: 需求 9.6**

### 属性 12: 新图片位置基于锚点计算

*对于任意*新生成的图片，其位置应基于最近一次生成图片的位置作为锚点，排列在其下方区域。
**验证: 需求 9.5（扩展）**

### 属性 13: 批量生成横向排列

*对于任意*批量生成的多张图片，它们应在生成区域内按横向顺序排列，保持统一间距。
**验证: 需求 9.5（扩展）**

### 属性 14: 生成位置不重叠

*对于任意*新生成的图片，其位置应确保不与画布中已有的任何图片发生重叠。
**验证: 需求 9.5（扩展）**

### 属性 15: 视角自动聚焦

*对于任意*图片生成操作，系统应在生成前自动调整视角，使生成区域处于可视范围内。
**验证: 需求 9.5（扩展）**

## 错误处理

### 参考图上传错误

- 文件格式不支持：显示 "仅支持 JPG、PNG、WebP 格式"
- 文件过大：显示 "图片大小不能超过 10MB"
- 上传数量超限：显示 "最多上传 14 张参考图"

### 生成错误

- 网络错误：显示 "网络连接失败，请检查网络后重试"
- API 错误：显示具体错误信息
- 超时错误：显示 "生成超时，请重试"

### 状态恢复

所有错误发生后，系统应：
1. 清除生成中状态
2. 恢复生成按钮可用
3. 保留用户输入的提示词和配置

## 测试策略

### 单元测试

- 测试各组件的渲染和基本交互
- 测试状态管理逻辑
- 测试配置面板的展开/收起逻辑

### 属性测试

使用 fast-check 进行属性测试：
- 测试参考图上传和删除的状态一致性
- 测试生成数量滑动条的值范围约束
- 测试生成状态保护机制

### 集成测试

- 测试完整的生成流程
- 测试拖拽上传功能
- 测试配置面板与生成的联动

## UI 样式规范

### 玻璃化效果

```css
.glass-dialog {
  background: rgba(24, 24, 27, 0.8);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 24px;
  box-shadow: 
    0 4px 6px -1px rgba(0, 0, 0, 0.1),
    0 2px 4px -2px rgba(0, 0, 0, 0.1),
    0 0 0 1px rgba(255, 255, 255, 0.05);
}
```

### 对话框尺寸

- 最大宽度: 800px
- 内边距: 12px
- 圆角: 24px
- 底部间距: 24px

### 按钮样式

- 模式切换按钮: 40px × 40px，圆角 12px
- 上传按钮: 40px × 40px，圆角 12px
- 菜单按钮: 40px × 40px，圆角 12px
- 生成按钮: 44px × 44px，圆形，渐变背景

### 配置面板

- 宽度: 320px
- 向上展开，底部与菜单按钮对齐
- 圆角: 16px
- 内边距: 16px

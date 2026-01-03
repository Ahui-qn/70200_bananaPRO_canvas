# 设计文档

## 概述

本设计文档描述了「持久化画布」功能的技术实现方案。该功能的核心目标是让用户能够在画布上查看项目的所有历史图片，并在重新进入时恢复上次的工作状态。为了在大量图片场景下保持流畅体验，系统采用虚拟渲染和渐进式加载策略。

## 架构

```
┌─────────────────────────────────────────────────────────────────┐
│                        前端 (React)                              │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │  CanvasApp.tsx  │  │CanvasImageLayer │  │ ViewportManager │  │
│  │  (主画布组件)    │  │ (图片渲染层)     │  │ (视口管理器)    │  │
│  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘  │
│           │                    │                    │           │
│  ┌────────▼────────────────────▼────────────────────▼────────┐  │
│  │              useCanvasImages (自定义 Hook)                 │  │
│  │  - 图片数据管理                                            │  │
│  │  - 位置持久化                                              │  │
│  │  - 视口状态管理                                            │  │
│  └────────────────────────────┬─────────────────────────────┘  │
│                               │                                 │
│  ┌────────────────────────────▼─────────────────────────────┐  │
│  │              ImageLoadingManager (图片加载管理器)          │  │
│  │  - 缩略图/高清图切换                                       │  │
│  │  - 加载优先级队列                                          │  │
│  │  - 内存管理                                                │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                        后端 (Express)                            │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │ /api/images     │  │/api/projects    │  │/api/canvas-state│  │
│  │ (图片 CRUD)     │  │(项目管理)        │  │(画布状态)        │  │
│  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘  │
│           │                    │                    │           │
│  ┌────────▼────────────────────▼────────────────────▼────────┐  │
│  │                   DatabaseService                          │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                        数据库 (MySQL)                            │
├─────────────────────────────────────────────────────────────────┤
│  images 表 (新增字段)          │  projects 表 (新增字段)         │
│  - canvas_x: INT              │  - canvas_state: JSON           │
│  - canvas_y: INT              │    (视口位置、缩放比例)          │
│  - thumbnail_url: TEXT        │                                 │
└─────────────────────────────────────────────────────────────────┘
```

## 组件和接口

### 1. 数据库层扩展

#### images 表新增字段
```sql
ALTER TABLE images ADD COLUMN canvas_x INT DEFAULT NULL COMMENT '图片在画布上的 X 坐标';
ALTER TABLE images ADD COLUMN canvas_y INT DEFAULT NULL COMMENT '图片在画布上的 Y 坐标';
ALTER TABLE images ADD COLUMN thumbnail_url TEXT COMMENT '缩略图 URL';
```

#### projects 表新增字段
```sql
ALTER TABLE projects ADD COLUMN canvas_state JSON COMMENT '画布状态（视口位置、缩放比例）';
```

### 2. 后端 API 接口

#### 获取项目画布图片
```typescript
// GET /api/projects/:projectId/canvas-images
interface GetCanvasImagesResponse {
  success: boolean;
  data: {
    images: CanvasImageData[];
    canvasState: CanvasState | null;
  };
}

interface CanvasImageData {
  id: string;
  url: string;
  thumbnailUrl: string | null;
  prompt: string;
  model: string;
  canvasX: number | null;
  canvasY: number | null;
  width: number;
  height: number;
  createdAt: Date;
}

interface CanvasState {
  viewportX: number;
  viewportY: number;
  scale: number;
  lastUpdated: Date;
}
```

#### 更新图片画布位置
```typescript
// PATCH /api/images/:imageId/canvas-position
interface UpdateCanvasPositionRequest {
  canvasX: number;
  canvasY: number;
}
```

#### 保存画布状态
```typescript
// PUT /api/projects/:projectId/canvas-state
interface SaveCanvasStateRequest {
  viewportX: number;
  viewportY: number;
  scale: number;
}
```

### 3. 前端组件

#### useCanvasImages Hook
```typescript
interface UseCanvasImagesReturn {
  // 状态
  images: CanvasImage[];
  isLoading: boolean;
  error: string | null;
  canvasState: CanvasState | null;
  
  // 操作
  loadProjectImages: (projectId: string) => Promise<void>;
  updateImagePosition: (imageId: string, x: number, y: number) => void;
  addNewImage: (image: CanvasImage) => void;
  saveCanvasState: (state: CanvasState) => void;
  
  // 计算
  findNonOverlappingPosition: (width: number, height: number) => { x: number; y: number };
  getVisibleImages: (viewport: Viewport) => CanvasImage[];
}
```

#### ImageLoadingManager
```typescript
interface ImageLoadingManager {
  // 加载控制
  queueImageLoad: (imageId: string, priority: 'high' | 'normal' | 'low') => void;
  cancelImageLoad: (imageId: string) => void;
  
  // 状态查询
  getLoadingState: (imageId: string) => 'thumbnail' | 'loading' | 'loaded';
  isImageInViewport: (imageId: string) => boolean;
  
  // 内存管理
  getMemoryUsage: () => number;
  releaseUnusedImages: () => void;
}
```

## 数据模型

### CanvasImage（画布图片）
```typescript
interface CanvasImage {
  id: string;                    // 图片唯一标识
  url: string;                   // 高清图片 URL
  thumbnailUrl: string | null;   // 缩略图 URL
  prompt: string;                // 提示词
  model: string;                 // 模型名称
  canvasX: number;               // 画布 X 坐标
  canvasY: number;               // 画布 Y 坐标
  width: number;                 // 图片宽度
  height: number;                // 图片高度
  createdAt: Date;               // 创建时间
  
  // 运行时状态（不持久化）
  loadingState: 'placeholder' | 'thumbnail' | 'loading' | 'loaded';
  isVisible: boolean;            // 是否在视口内
}
```

### CanvasState（画布状态）
```typescript
interface CanvasState {
  viewportX: number;             // 视口 X 偏移
  viewportY: number;             // 视口 Y 偏移
  scale: number;                 // 缩放比例 (0.1 - 3.0)
  lastUpdated: Date;             // 最后更新时间
}
```

### Viewport（视口）
```typescript
interface Viewport {
  x: number;                     // 视口左上角 X
  y: number;                     // 视口左上角 Y
  width: number;                 // 视口宽度
  height: number;                // 视口高度
  scale: number;                 // 当前缩放比例
}
```

## 正确性属性

*属性是系统在所有有效执行中应保持为真的特征或行为——本质上是关于系统应该做什么的形式化陈述。属性作为人类可读规范和机器可验证正确性保证之间的桥梁。*

### 属性 1：图片位置往返一致性
*对于任意*图片位置更新操作，保存到数据库后重新加载，应该得到相同的位置坐标
**验证：需求 2.3**

### 属性 2：视口状态往返一致性
*对于任意*视口状态（位置和缩放），保存后重新加载应该得到相同的状态值
**验证：需求 3.2**

### 属性 3：新图片位置不重叠
*对于任意*现有图片集合和新图片尺寸，计算出的新位置不应与任何现有图片重叠
**验证：需求 2.2, 6.1**

### 属性 4：虚拟渲染正确性
*对于任意*视口范围和图片集合，只有与视口相交的图片应该被标记为可见
**验证：需求 4.1, 4.2**

### 属性 5：渐进式加载状态转换
*对于任意*图片，加载状态只能按 placeholder → thumbnail → loading → loaded 顺序转换，不能跳过或回退
**验证：需求 5.1, 5.4**

### 属性 6：项目切换数据隔离
*对于任意*两个不同的项目，切换项目后画布上的图片应该完全来自新项目，不包含旧项目的图片
**验证：需求 1.4**

### 属性 7：位置保存防抖正确性
*对于任意*连续的位置更新操作，在防抖时间窗口内只应该触发一次数据库保存
**验证：需求 2.1**

## 错误处理

### 网络错误
- 图片加载失败：显示错误占位符，提供重试按钮
- 位置保存失败：缓存到 localStorage，网络恢复后自动重试
- 画布状态保存失败：静默重试，不阻塞用户操作

### 数据错误
- 图片位置数据缺失：使用自动布局算法计算位置
- 画布状态数据损坏：重置为默认状态
- 图片 URL 失效：显示占位符，标记为需要重新上传

### 性能保护
- 图片数量超过 1000 张：提示用户清理或归档
- 内存使用超过 500MB：自动卸载不可见的高清图
- 加载队列过长：取消低优先级加载任务

## 测试策略

### 单元测试
- 位置计算算法（findNonOverlappingPosition）
- 视口可见性判断（isImageInViewport）
- 加载状态转换逻辑
- 防抖保存逻辑

### 属性测试
使用 fast-check 库进行属性测试：
- 位置往返一致性测试
- 视口状态往返一致性测试
- 新图片位置不重叠测试
- 虚拟渲染正确性测试
- 加载状态转换测试
- 项目切换数据隔离测试

### 集成测试
- 项目切换时的数据加载和清理
- 图片拖拽后的位置持久化
- 页面刷新后的状态恢复

### 性能测试
- 100 张图片场景下的渲染帧率
- 500 张图片场景下的内存使用
- 快速滚动时的响应延迟


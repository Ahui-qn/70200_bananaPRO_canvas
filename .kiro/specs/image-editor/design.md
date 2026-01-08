# 图片编辑器技术设计

## 架构概述

```
┌─────────────────────────────────────────────────────────┐
│                    ImageEditor 组件                      │
├─────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────────────────────────┐  │
│  │   工具栏     │  │         Canvas 画布              │  │
│  │  Toolbar    │  │    (Fabric.js / Konva.js)       │  │
│  │             │  │                                  │  │
│  │  - 画笔     │  │   ┌─────────────────────────┐   │  │
│  │  - 矩形     │  │   │      原始图片            │   │  │
│  │  - 圆形     │  │   │                         │   │  │
│  │  - 裁剪     │  │   │   + 绘制层（标注）       │   │  │
│  │  - 旋转     │  │   │                         │   │  │
│  │  - 撤销     │  │   └─────────────────────────┘   │  │
│  │  - 重做     │  │                                  │  │
│  └─────────────┘  └─────────────────────────────────┘  │
├─────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────┐   │
│  │              属性面板 / 操作按钮                  │   │
│  │   颜色选择 | 粗细调整 | 保存 | 取消 | 设为参考图  │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

## 技术选型

### Canvas 库选择：Fabric.js

选择理由：
1. 成熟稳定，社区活跃
2. 内置丰富的绑定工具（画笔、形状、文字等）
3. 支持对象选择、移动、缩放
4. 内置撤销/重做支持
5. 导出为图片方便

安装：
```bash
npm install fabric
```

## 组件结构

```
frontend/src/components/
├── ImageEditor/
│   ├── ImageEditor.tsx          # 主组件
│   ├── EditorToolbar.tsx        # 工具栏
│   ├── EditorCanvas.tsx         # Canvas 画布封装
│   ├── ColorPicker.tsx          # 颜色选择器
│   ├── BrushSizeSlider.tsx      # 画笔粗细调节
│   ├── CropOverlay.tsx          # 裁剪遮罩
│   └── index.ts                 # 导出
```

## 数据流

```
用户操作 → 工具状态更新 → Canvas 绑定更新 → 绘制/编辑
                                              ↓
                                         保存操作
                                              ↓
                                    Canvas 导出为 Blob
                                              ↓
                                    storageManager.upload
                                              ↓
                                    创建新图片记录
                                              ↓
                                    刷新画布/设为参考图
```

## 状态管理

```typescript
interface EditorState {
  // 当前工具
  activeTool: 'select' | 'brush' | 'rect' | 'circle' | 'crop' | 'text' | 'arrow' | 'eraser';
  
  // 画笔设置
  brushColor: string;
  brushSize: number;
  
  // 形状设置
  strokeColor: string;
  strokeWidth: number;
  fillColor: string | null;
  
  // 裁剪状态
  isCropping: boolean;
  cropRect: { x: number; y: number; width: number; height: number } | null;
  
  // 历史记录
  canUndo: boolean;
  canRedo: boolean;
  
  // 加载状态
  isLoading: boolean;
  isSaving: boolean;
}
```

## 核心接口

### ImageEditor Props

```typescript
interface ImageEditorProps {
  // 要编辑的图片
  image: CanvasImage;
  
  // 关闭编辑器
  onClose: () => void;
  
  // 保存成功回调
  onSave: (newImage: CanvasImage) => void;
  
  // 设为参考图回调
  onSetAsReference?: (imageUrl: string) => void;
}
```

### 保存流程

```typescript
async function saveEditedImage(canvas: fabric.Canvas, originalImage: CanvasImage) {
  // 1. 导出 Canvas 为 Blob
  const dataUrl = canvas.toDataURL({ format: 'png', quality: 1 });
  const blob = await fetch(dataUrl).then(r => r.blob());
  
  // 2. 上传到存储
  const result = await storageManager.uploadFromBuffer(
    Buffer.from(await blob.arrayBuffer()),
    'image/png'
  );
  
  // 3. 创建图片记录
  const newImage = await apiService.createImage({
    url: result.url,
    thumbnailUrl: result.thumbnailUrl,
    prompt: `编辑自: ${originalImage.prompt}`,
    model: 'edited',
    projectId: originalImage.projectId,
    width: canvas.width,
    height: canvas.height,
  });
  
  return newImage;
}
```

## 工具实现

### 画笔工具

```typescript
function enableBrushMode(canvas: fabric.Canvas, color: string, size: number) {
  canvas.isDrawingMode = true;
  canvas.freeDrawingBrush.color = color;
  canvas.freeDrawingBrush.width = size;
}
```

### 矩形工具

```typescript
function addRectangle(canvas: fabric.Canvas, options: ShapeOptions) {
  const rect = new fabric.Rect({
    left: 100,
    top: 100,
    width: 200,
    height: 150,
    fill: 'transparent',
    stroke: options.strokeColor,
    strokeWidth: options.strokeWidth,
  });
  canvas.add(rect);
  canvas.setActiveObject(rect);
}
```

### 裁剪功能

```typescript
function applyCrop(canvas: fabric.Canvas, cropRect: CropRect) {
  // 1. 获取裁剪区域的图像数据
  const croppedDataUrl = canvas.toDataURL({
    left: cropRect.x,
    top: cropRect.y,
    width: cropRect.width,
    height: cropRect.height,
  });
  
  // 2. 清空画布并加载裁剪后的图片
  fabric.Image.fromURL(croppedDataUrl, (img) => {
    canvas.clear();
    canvas.setWidth(cropRect.width);
    canvas.setHeight(cropRect.height);
    canvas.setBackgroundImage(img, canvas.renderAll.bind(canvas));
  });
}
```

### 旋转功能

```typescript
function rotateCanvas(canvas: fabric.Canvas, angle: 90 | -90) {
  const objects = canvas.getObjects();
  const bgImage = canvas.backgroundImage;
  
  // 旋转背景图
  if (bgImage) {
    bgImage.rotate((bgImage.angle || 0) + angle);
  }
  
  // 交换宽高
  const newWidth = canvas.height;
  const newHeight = canvas.width;
  canvas.setWidth(newWidth);
  canvas.setHeight(newHeight);
  
  canvas.renderAll();
}
```

## 撤销/重做实现

使用 Fabric.js 的状态序列化：

```typescript
class HistoryManager {
  private history: string[] = [];
  private currentIndex = -1;
  private maxHistory = 20;
  
  saveState(canvas: fabric.Canvas) {
    const json = JSON.stringify(canvas.toJSON());
    
    // 删除当前位置之后的历史
    this.history = this.history.slice(0, this.currentIndex + 1);
    this.history.push(json);
    
    // 限制历史长度
    if (this.history.length > this.maxHistory) {
      this.history.shift();
    } else {
      this.currentIndex++;
    }
  }
  
  undo(canvas: fabric.Canvas) {
    if (this.currentIndex > 0) {
      this.currentIndex--;
      canvas.loadFromJSON(this.history[this.currentIndex], canvas.renderAll.bind(canvas));
    }
  }
  
  redo(canvas: fabric.Canvas) {
    if (this.currentIndex < this.history.length - 1) {
      this.currentIndex++;
      canvas.loadFromJSON(this.history[this.currentIndex], canvas.renderAll.bind(canvas));
    }
  }
}
```

## 后端接口

无需新增后端接口，复用现有接口：

1. `POST /api/images/upload` - 上传编辑后的图片
2. `POST /api/ref-images` - 设置参考图

## 性能优化

1. **大图处理**：编辑时限制 Canvas 最大尺寸（如 2000x2000），保存时恢复原始尺寸
2. **防抖保存历史**：绘制过程中不频繁保存历史，绘制结束后保存
3. **懒加载**：编辑器组件使用 React.lazy 动态加载
4. **内存管理**：关闭编辑器时清理 Canvas 资源

## 兼容性

1. 支持本地模式和云端模式（通过 storageManager）
2. 支持触摸设备（Fabric.js 内置支持）
3. 支持键盘快捷键

## 测试要点

1. 各工具功能正常
2. 撤销/重做正确
3. 保存后图片质量无损
4. 大图编辑性能可接受
5. 本地模式和云端模式都能正常保存

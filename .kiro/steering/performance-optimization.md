# 性能优化和成本控制开发规范

## 核心原则

在开发过程中，始终遵循以下优先级：
1. **功能正确性** - 确保功能按预期工作
2. **性能优化** - 减少不必要的计算和渲染
3. **流量节省** - 减少网络请求和数据传输

## 图片加载优化

### 缓存策略

- 使用浏览器缓存：设置合适的 Cache-Control 头
- 使用内存缓存：已加载的图片保存在 Map 中复用
- 避免重复请求：相同 URL 只请求一次

### 防抖和节流

- 缩放操作使用防抖（300ms），避免频繁切换图片源
- 滚动/拖拽操作使用节流，减少重绘次数
- 视口变化检测使用 requestAnimationFrame

### 渐进式加载

- 先显示已有版本（缩略图或原图）
- 新版本加载完成后再切换
- 使用 loading="lazy" 延迟加载视口外图片

### 预加载策略

- 当接近切换阈值时，预加载另一个版本
- 预加载使用低优先级（requestIdleCallback）
- 只预加载视口内的图片

## 网络请求优化

### 减少请求次数

- 合并多个小请求为批量请求
- 使用 WebSocket 替代轮询（如适用）
- 缓存 API 响应，避免重复请求

### 减少传输数据量

- 使用缩略图替代原图（缩小视图时）
- 压缩图片（使用 WebP 格式，如支持）
- 分页加载数据，避免一次加载全部

### OSS 流量控制

- 缩略图较长边限制为 400px
- 原图只在需要时加载
- 使用 CDN 加速，减少源站流量

## 渲染性能优化

### 虚拟化渲染

- 只渲染视口内的图片
- 视口外的图片使用占位符
- 使用 CSS transform 替代 top/left 定位

### 减少重绘

- 使用 will-change 提示浏览器优化
- 批量更新 DOM，避免频繁重排
- 使用 CSS 动画替代 JavaScript 动画

### 内存管理

- 及时清理不再使用的图片缓存
- 限制同时加载的图片数量
- 使用 WeakMap 存储临时数据

## 代码示例

### 防抖函数

```typescript
function debounce<T extends (...args: any[]) => any>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}
```

### 图片缓存管理

```typescript
class ImageCache {
  private cache = new Map<string, HTMLImageElement>();
  private maxSize = 100;

  get(url: string): HTMLImageElement | undefined {
    return this.cache.get(url);
  }

  set(url: string, img: HTMLImageElement): void {
    if (this.cache.size >= this.maxSize) {
      // 删除最早的缓存
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    this.cache.set(url, img);
  }

  cleanup(keepUrls: string[]): void {
    const keepSet = new Set(keepUrls);
    for (const url of this.cache.keys()) {
      if (!keepSet.has(url)) {
        this.cache.delete(url);
      }
    }
  }
}
```

## 监控和调试

- 使用 Performance API 监控关键操作耗时
- 记录网络请求次数和数据量
- 在开发环境显示性能指标


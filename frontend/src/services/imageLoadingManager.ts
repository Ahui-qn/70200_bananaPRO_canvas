/**
 * ImageLoadingManager
 * 管理图片的渐进式加载，实现加载优先级队列和延迟加载逻辑
 * 支持根据缩放比例动态切换缩略图/原图
 * 
 * 需求: 3.1, 3.2, 3.3, 5.1, 5.2
 */

import type { CanvasImage } from '../../../shared/types';

// 加载状态类型
export type LoadingState = 'placeholder' | 'thumbnail' | 'loading' | 'loaded';

// 加载优先级
export type LoadingPriority = 'high' | 'normal' | 'low';

// 图片源类型
export type ImageSourceType = 'thumbnail' | 'original';

// 图片加载任务
interface LoadingTask {
  imageId: string;
  imageUrl: string;
  thumbnailUrl?: string;
  priority: LoadingPriority;
  state: LoadingState;
  enterViewportTime?: number;  // 进入视口的时间戳
  loadStartTime?: number;      // 开始加载的时间戳
}

// 加载状态变化回调
type StateChangeCallback = (imageId: string, state: LoadingState) => void;

// 延迟加载时间（毫秒）
const LOAD_DELAY = 300;

// 缩放比例阈值：低于此值使用缩略图，高于或等于此值使用原图
const SCALE_THRESHOLD = 0.7;

// 防抖延迟时间（毫秒）
const DEBOUNCE_DELAY = 300;

// 优先级权重
const PRIORITY_WEIGHTS: Record<LoadingPriority, number> = {
  high: 3,
  normal: 2,
  low: 1,
};

/**
 * ImageLoadingManager 类
 * 管理图片加载队列和状态，支持根据缩放比例动态切换图片源
 */
export class ImageLoadingManager {
  // 加载任务映射
  private tasks: Map<string, LoadingTask> = new Map();
  
  // 状态变化回调
  private onStateChange: StateChangeCallback | null = null;
  
  // 延迟加载定时器
  private delayTimers: Map<string, NodeJS.Timeout> = new Map();
  
  // 当前正在加载的图片数量
  private loadingCount: number = 0;
  
  // 最大并发加载数
  private maxConcurrent: number = 4;
  
  // 内存使用估算（字节）
  private memoryUsage: number = 0;
  
  // 内存阈值（500MB）
  private memoryThreshold: number = 500 * 1024 * 1024;

  // 图片内存缓存（URL -> HTMLImageElement）
  private imageCache: Map<string, HTMLImageElement> = new Map();
  
  // Blob URL 缓存（原始 URL -> Blob URL）
  // 使用 Blob URL 可以避免浏览器重复请求，因为 Blob URL 指向内存中的数据
  private blobUrlCache: Map<string, string> = new Map();
  
  // 正在加载中的 URL 集合（避免重复请求）
  private loadingUrls: Set<string> = new Set();
  
  // 缓存最大数量
  private maxCacheSize: number = 100;
  
  // 当前缩放比例
  private currentScale: number = 1;
  
  // 缩放防抖定时器
  private scaleDebounceTimer: NodeJS.Timeout | null = null;
  
  // 图片源切换回调
  private onSourceChange: ((imageId: string, sourceType: ImageSourceType) => void) | null = null;

  // 图片序号映射（用于日志）
  private imageIndexMap: Map<string, number> = new Map();
  private nextImageIndex: number = 1;

  /**
   * 设置状态变化回调
   */
  setStateChangeCallback(callback: StateChangeCallback): void {
    this.onStateChange = callback;
  }

  /**
   * 设置图片源切换回调
   */
  setSourceChangeCallback(callback: (imageId: string, sourceType: ImageSourceType) => void): void {
    this.onSourceChange = callback;
  }

  /**
   * 获取缓存的 Blob URL
   * 
   * @param originalUrl 原始图片 URL
   * @returns Blob URL 或 undefined
   */
  getBlobUrl(originalUrl: string): string | undefined {
    return this.blobUrlCache.get(originalUrl);
  }

  /**
   * 添加 Blob URL 到缓存
   */
  private addToBlobCache(originalUrl: string, blobUrl: string): void {
    // 如果缓存已满，删除最早的条目并释放 Blob URL
    if (this.blobUrlCache.size >= this.maxCacheSize) {
      const firstKey = this.blobUrlCache.keys().next().value;
      if (firstKey) {
        const oldBlobUrl = this.blobUrlCache.get(firstKey);
        if (oldBlobUrl) {
          URL.revokeObjectURL(oldBlobUrl);
        }
        this.blobUrlCache.delete(firstKey);
      }
    }
    
    this.blobUrlCache.set(originalUrl, blobUrl);
    console.log(`[BlobCache] 已缓存: ${originalUrl.substring(0, 50)}... -> ${blobUrl}`);
  }

  /**
   * 根据缩放比例获取图片 URL
   * 当 scale < 0.5 时优先返回缩略图 URL，否则返回原图 URL
   * 如果缩略图不存在，回退到原图
   * 
   * @param image 画布图片对象
   * @param scale 当前缩放比例
   * @returns 应该使用的图片 URL
   */
  getImageUrl(image: CanvasImage, scale: number): string {
    const shouldUseThumbnail = this.shouldUseThumbnail(scale);
    
    // 如果应该使用缩略图且缩略图存在，返回缩略图 URL
    if (shouldUseThumbnail && image.thumbnailUrl) {
      return image.thumbnailUrl;
    }
    
    // 否则返回原图 URL（包括缩略图不存在的情况）
    return image.url;
  }

  /**
   * 判断是否应该使用缩略图
   * 
   * @param scale 缩放比例
   * @returns 是否应该使用缩略图
   */
  shouldUseThumbnail(scale: number): boolean {
    return scale < SCALE_THRESHOLD;
  }

  /**
   * 判断是否应该加载原图
   * 
   * @param scale 缩放比例
   * @returns 是否应该加载原图
   */
  shouldLoadOriginal(scale: number): boolean {
    return scale >= SCALE_THRESHOLD;
  }

  /**
   * 获取当前图片源类型
   * 
   * @param scale 缩放比例
   * @returns 图片源类型
   */
  getSourceType(scale: number): ImageSourceType {
    return this.shouldUseThumbnail(scale) ? 'thumbnail' : 'original';
  }

  /**
   * 更新缩放比例（带防抖）
   * 缩放停止 300ms 后才触发图片源切换
   * 
   * @param scale 新的缩放比例
   */
  updateScale(scale: number): void {
    const previousSourceType = this.getSourceType(this.currentScale);
    const newSourceType = this.getSourceType(scale);
    
    this.currentScale = scale;
    
    // 如果图片源类型没有变化，不需要处理
    if (previousSourceType === newSourceType) {
      return;
    }
    
    // 清除之前的防抖定时器
    if (this.scaleDebounceTimer) {
      clearTimeout(this.scaleDebounceTimer);
    }
    
    // 设置新的防抖定时器
    this.scaleDebounceTimer = setTimeout(() => {
      this.scaleDebounceTimer = null;
      const sourceText = newSourceType === 'thumbnail' ? '缩略图' : '原图';
      console.log(`缩放切换：${scale.toFixed(2)} → 使用${sourceText}`);
      this.handleSourceTypeChange(newSourceType);
    }, DEBOUNCE_DELAY);
  }

  /**
   * 获取当前缩放比例
   */
  getCurrentScale(): number {
    return this.currentScale;
  }

  /**
   * 处理图片源类型变化
   * 当从缩略图切换到原图时，触发原图加载
   */
  private handleSourceTypeChange(sourceType: ImageSourceType): void {
    // 通知所有任务图片源类型已变化
    this.tasks.forEach((task, imageId) => {
      if (this.onSourceChange) {
        this.onSourceChange(imageId, sourceType);
      }
      
      // 如果切换到原图模式且图片还未加载完成，安排加载
      if (sourceType === 'original' && task.state !== 'loaded' && task.state !== 'loading') {
        if (task.enterViewportTime !== undefined) {
          this.scheduleHighResLoad(imageId);
        }
      }
    });
  }

  /**
   * 预加载图片到缓存
   * 
   * @param url 图片 URL
   * @returns Promise<HTMLImageElement>
   */
  preloadImage(url: string): Promise<HTMLImageElement> {
    // 如果已经在缓存中，直接返回
    const cached = this.imageCache.get(url);
    if (cached) {
      return Promise.resolve(cached);
    }
    
    return new Promise((resolve, reject) => {
      const img = new Image();
      
      img.onload = () => {
        this.addToCache(url, img);
        resolve(img);
      };
      
      img.onerror = () => {
        reject(new Error(`Failed to load image: ${url}`));
      };
      
      img.src = url;
    });
  }

  /**
   * 从缓存获取图片
   * 
   * @param url 图片 URL
   * @returns HTMLImageElement 或 undefined
   */
  getCachedImage(url: string): HTMLImageElement | undefined {
    return this.imageCache.get(url);
  }

  /**
   * 添加图片到缓存
   */
  private addToCache(url: string, img: HTMLImageElement): void {
    // 如果缓存已满，删除最早的条目
    if (this.imageCache.size >= this.maxCacheSize) {
      const firstKey = this.imageCache.keys().next().value;
      if (firstKey) {
        this.imageCache.delete(firstKey);
      }
    }
    
    this.imageCache.set(url, img);
  }

  /**
   * 清理缓存中不在指定列表中的图片
   * 
   * @param keepUrls 需要保留的 URL 列表
   */
  cleanupCache(keepUrls: string[]): void {
    const keepSet = new Set(keepUrls);
    
    for (const url of this.imageCache.keys()) {
      if (!keepSet.has(url)) {
        this.imageCache.delete(url);
      }
    }
  }

  /**
   * 获取缓存大小
   */
  getCacheSize(): number {
    return this.imageCache.size;
  }

  /**
   * 将图片加入加载队列
   * 
   * @param imageId 图片 ID
   * @param imageUrl 高清图片 URL
   * @param thumbnailUrl 缩略图 URL（可选）
   * @param priority 加载优先级
   */
  queueImageLoad(
    imageId: string,
    imageUrl: string,
    thumbnailUrl?: string,
    priority: LoadingPriority = 'normal'
  ): void {
    // 首先检查 Blob URL 缓存（最高优先级）
    const cachedOriginalBlob = this.blobUrlCache.get(imageUrl);
    const cachedThumbnailBlob = thumbnailUrl ? this.blobUrlCache.get(thumbnailUrl) : undefined;
    
    // 如果原图 Blob URL 已缓存，直接标记为已加载
    if (cachedOriginalBlob) {
      const existingTask = this.tasks.get(imageId);
      if (existingTask) {
        if (existingTask.state !== 'loaded') {
          existingTask.state = 'loaded';
          existingTask.enterViewportTime = Date.now();
          this.notifyStateChange(imageId, 'loaded');
        }
      } else {
        const task: LoadingTask = {
          imageId,
          imageUrl,
          thumbnailUrl,
          priority,
          state: 'loaded',
          enterViewportTime: Date.now(),
        };
        this.tasks.set(imageId, task);
        this.notifyStateChange(imageId, 'loaded');
      }
      return;
    }
    
    // 如果已经在加载或已加载，不重复添加
    const existingTask = this.tasks.get(imageId);
    if (existingTask) {
      // 如果已经加载完成，直接返回
      if (existingTask.state === 'loaded') {
        return;
      }
      // 如果正在加载，更新进入视口时间
      if (existingTask.state === 'loading') {
        existingTask.enterViewportTime = Date.now();
        return;
      }
      // 如果是缩略图状态，检查是否需要加载原图
      if (existingTask.state === 'thumbnail') {
        existingTask.enterViewportTime = Date.now();
        // 如果当前应该显示原图，安排加载
        if (this.shouldLoadOriginal(this.currentScale)) {
          this.scheduleHighResLoad(imageId);
        }
        return;
      }
      // 如果是占位符状态，重新进入视口，继续之前的加载流程
      if (existingTask.state === 'placeholder') {
        existingTask.enterViewportTime = Date.now();
        // 如果有缩略图 Blob URL 缓存，直接使用
        if (cachedThumbnailBlob) {
          existingTask.state = 'thumbnail';
          this.notifyStateChange(imageId, 'thumbnail');
        } else if (thumbnailUrl) {
          // 如果有缩略图 URL 但未缓存，尝试加载缩略图
          this.loadThumbnail(imageId, thumbnailUrl);
        }
        // 如果当前应该显示原图，安排加载
        if (this.shouldLoadOriginal(this.currentScale)) {
          this.scheduleHighResLoad(imageId);
        }
        return;
      }
    }

    // 确定初始状态
    let initialState: LoadingState = 'placeholder';
    if (cachedThumbnailBlob) {
      initialState = 'thumbnail';
    }

    const task: LoadingTask = {
      imageId,
      imageUrl,
      thumbnailUrl,
      priority,
      state: initialState,
      enterViewportTime: Date.now(),
    };

    this.tasks.set(imageId, task);
    this.notifyStateChange(imageId, task.state);

    // 如果有缩略图且未缓存，先加载缩略图
    if (thumbnailUrl && !cachedThumbnailBlob) {
      this.loadThumbnail(imageId, thumbnailUrl);
    }

    // 只有当应该显示原图时才安排加载高清图
    if (this.shouldLoadOriginal(this.currentScale)) {
      this.scheduleHighResLoad(imageId);
    }
  }

  /**
   * 取消图片加载
   */
  cancelImageLoad(imageId: string): void {
    // 清除延迟定时器
    const timer = this.delayTimers.get(imageId);
    if (timer) {
      clearTimeout(timer);
      this.delayTimers.delete(imageId);
    }

    // 从任务列表中移除
    this.tasks.delete(imageId);
  }

  /**
   * 立即加载高清图片（用于双击查看详情）
   */
  loadImmediately(imageId: string): void {
    const task = this.tasks.get(imageId);
    if (!task) return;

    // 清除延迟定时器
    const timer = this.delayTimers.get(imageId);
    if (timer) {
      clearTimeout(timer);
      this.delayTimers.delete(imageId);
    }

    // 立即开始加载
    this.startHighResLoad(imageId);
  }

  /**
   * 获取图片加载状态
   */
  getLoadingState(imageId: string): LoadingState {
    const task = this.tasks.get(imageId);
    return task?.state || 'placeholder';
  }

  /**
   * 检查图片是否在视口内
   */
  isImageInViewport(imageId: string): boolean {
    const task = this.tasks.get(imageId);
    return task?.enterViewportTime !== undefined;
  }

  /**
   * 图片离开视口
   */
  imageLeftViewport(imageId: string): void {
    const task = this.tasks.get(imageId);
    if (task) {
      // 清除延迟定时器
      const timer = this.delayTimers.get(imageId);
      if (timer) {
        clearTimeout(timer);
        this.delayTimers.delete(imageId);
      }
      
      // 保留已加载的高清图片，不进行降级（需求 5.4）
      task.enterViewportTime = undefined;
    }
  }

  /**
   * 获取内存使用量
   */
  getMemoryUsage(): number {
    return this.memoryUsage;
  }

  /**
   * 释放不可见图片的内存
   */
  releaseUnusedImages(): void {
    // 找出长时间不可见的图片
    const now = Date.now();
    const releaseThreshold = 60000; // 60 秒

    this.tasks.forEach((task, imageId) => {
      if (
        task.state === 'loaded' &&
        task.enterViewportTime === undefined &&
        task.loadStartTime &&
        now - task.loadStartTime > releaseThreshold
      ) {
        // 降级为缩略图状态
        if (task.thumbnailUrl) {
          task.state = 'thumbnail';
          this.notifyStateChange(imageId, 'thumbnail');
        } else {
          task.state = 'placeholder';
          this.notifyStateChange(imageId, 'placeholder');
        }
        
        // 减少内存使用估算
        this.memoryUsage -= this.estimateImageSize(task.imageUrl);
      }
    });
  }

  /**
   * 清理所有任务
   */
  clear(): void {
    // 清除所有定时器
    this.delayTimers.forEach(timer => clearTimeout(timer));
    this.delayTimers.clear();
    
    // 清除缩放防抖定时器
    if (this.scaleDebounceTimer) {
      clearTimeout(this.scaleDebounceTimer);
      this.scaleDebounceTimer = null;
    }
    
    // 清除所有任务
    this.tasks.clear();
    
    // 清除图片缓存
    this.imageCache.clear();
    
    // 清除 Blob URL 缓存并释放内存
    this.blobUrlCache.forEach(blobUrl => {
      URL.revokeObjectURL(blobUrl);
    });
    this.blobUrlCache.clear();
    
    // 清除正在加载的 URL 集合
    this.loadingUrls.clear();
    
    // 重置图片序号
    this.imageIndexMap.clear();
    this.nextImageIndex = 1;
    
    // 重置状态
    this.loadingCount = 0;
    this.memoryUsage = 0;
    this.currentScale = 1;
  }


  /**
   * 获取图片的显示序号（用于日志）
   */
  private getImageDisplayIndex(imageId: string): number {
    let index = this.imageIndexMap.get(imageId);
    if (index === undefined) {
      index = this.nextImageIndex++;
      this.imageIndexMap.set(imageId, index);
    }
    return index;
  }

  /**
   * 加载缩略图
   */
  private loadThumbnail(imageId: string, thumbnailUrl: string): void {
    const task = this.tasks.get(imageId);
    if (!task) return;

    // 检查 Blob URL 缓存
    const cachedBlobUrl = this.blobUrlCache.get(thumbnailUrl);
    if (cachedBlobUrl) {
      if (task.state === 'placeholder') {
        task.state = 'thumbnail';
        this.notifyStateChange(imageId, 'thumbnail');
      }
      return;
    }

    // 检查是否已经在加载中（避免重复请求）
    if (task.state !== 'placeholder') {
      return;
    }

    // 检查该 URL 是否正在被其他任务加载
    if (this.loadingUrls.has(thumbnailUrl)) {
      return;
    }

    const imgIndex = this.getImageDisplayIndex(imageId);
    console.log(`图片${imgIndex}：请求缩略图`);

    // 标记为正在加载
    this.loadingUrls.add(thumbnailUrl);

    // 使用 fetch 获取图片数据，然后转换为 Blob URL
    fetch(thumbnailUrl)
      .then(response => {
        if (!response.ok) throw new Error(`Failed to fetch: ${response.status}`);
        return response.blob();
      })
      .then(blob => {
        // 从加载中集合移除
        this.loadingUrls.delete(thumbnailUrl);
        
        // 创建 Blob URL 并缓存
        const blobUrl = URL.createObjectURL(blob);
        this.addToBlobCache(thumbnailUrl, blobUrl);
        console.log(`图片${imgIndex}：缩略图 Blob URL 已缓存`);
        
        // 同时创建 HTMLImageElement 用于兼容
        const img = new Image();
        img.src = blobUrl;
        this.addToCache(thumbnailUrl, img);
        
        const currentTask = this.tasks.get(imageId);
        if (currentTask && currentTask.state === 'placeholder') {
          currentTask.state = 'thumbnail';
          this.notifyStateChange(imageId, 'thumbnail');
        }
      })
      .catch((error) => {
        // 从加载中集合移除
        this.loadingUrls.delete(thumbnailUrl);
        
        const imgIndex = this.getImageDisplayIndex(imageId);
        console.warn(`图片${imgIndex}：缩略图加载失败`, error);
        
        // 如果任务还在 placeholder 状态，尝试直接加载原图
        const currentTask = this.tasks.get(imageId);
        if (currentTask && currentTask.state === 'placeholder') {
          if (this.shouldLoadOriginal(this.currentScale)) {
            this.scheduleHighResLoad(imageId);
          }
        }
      });
  }

  /**
   * 安排高清图片加载（带延迟）
   */
  private scheduleHighResLoad(imageId: string): void {
    // 清除之前的定时器
    const existingTimer = this.delayTimers.get(imageId);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // 设置新的延迟定时器
    const timer = setTimeout(() => {
      this.delayTimers.delete(imageId);
      this.startHighResLoad(imageId);
    }, LOAD_DELAY);

    this.delayTimers.set(imageId, timer);
  }

  /**
   * 开始加载高清图片并转换为 Blob URL
   */
  private startHighResLoad(imageId: string): void {
    const task = this.tasks.get(imageId);
    if (!task || task.state === 'loading' || task.state === 'loaded') {
      return;
    }

    // 检查 Blob URL 缓存
    const cachedBlobUrl = this.blobUrlCache.get(task.imageUrl);
    if (cachedBlobUrl) {
      task.state = 'loaded';
      this.notifyStateChange(imageId, 'loaded');
      return;
    }

    // 检查该 URL 是否正在被其他任务加载
    if (this.loadingUrls.has(task.imageUrl)) {
      // 等待其他任务加载完成后再检查
      setTimeout(() => {
        const cachedAfterWait = this.blobUrlCache.get(task.imageUrl);
        if (cachedAfterWait) {
          task.state = 'loaded';
          this.notifyStateChange(imageId, 'loaded');
        } else if (!this.loadingUrls.has(task.imageUrl)) {
          // 其他任务加载失败，重新尝试
          this.scheduleHighResLoad(imageId);
        }
      }, 100);
      return;
    }

    // 检查并发数限制
    if (this.loadingCount >= this.maxConcurrent) {
      // 重新安排加载
      this.scheduleHighResLoad(imageId);
      return;
    }

    // 检查内存限制
    if (this.memoryUsage >= this.memoryThreshold) {
      this.releaseUnusedImages();
      if (this.memoryUsage >= this.memoryThreshold) {
        // 仍然超过阈值，延迟加载
        this.scheduleHighResLoad(imageId);
        return;
      }
    }

    const imgIndex = this.getImageDisplayIndex(imageId);
    console.log(`图片${imgIndex}：请求原图`);

    // 更新状态为加载中
    task.state = 'loading';
    task.loadStartTime = Date.now();
    this.loadingCount++;
    this.loadingUrls.add(task.imageUrl);
    this.notifyStateChange(imageId, 'loading');

    // 使用 fetch 获取图片数据，然后转换为 Blob URL
    fetch(task.imageUrl)
      .then(response => {
        if (!response.ok) throw new Error(`Failed to fetch: ${response.status}`);
        return response.blob();
      })
      .then(blob => {
        // 从加载中集合移除
        this.loadingUrls.delete(task.imageUrl);
        
        const currentTask = this.tasks.get(imageId);
        if (currentTask) {
          // 创建 Blob URL 并缓存
          const blobUrl = URL.createObjectURL(blob);
          this.addToBlobCache(task.imageUrl, blobUrl);
          console.log(`图片${imgIndex}：原图 Blob URL 已缓存`);
          
          // 同时创建 HTMLImageElement 用于兼容
          const img = new Image();
          img.src = blobUrl;
          this.addToCache(task.imageUrl, img);
          
          currentTask.state = 'loaded';
          this.loadingCount--;
          this.memoryUsage += this.estimateImageSize(task.imageUrl);
          this.notifyStateChange(imageId, 'loaded');
          
          // 处理队列中的下一个任务
          this.processQueue();
        }
      })
      .catch((error) => {
        // 从加载中集合移除
        this.loadingUrls.delete(task.imageUrl);
        
        const imgIndex = this.getImageDisplayIndex(imageId);
        console.warn(`图片${imgIndex}：原图加载失败`, error);
        
        const currentTask = this.tasks.get(imageId);
        if (currentTask) {
          // 加载失败，回退到缩略图或占位符
          currentTask.state = currentTask.thumbnailUrl ? 'thumbnail' : 'placeholder';
          this.loadingCount--;
          this.notifyStateChange(imageId, currentTask.state);
          
          // 处理队列中的下一个任务
          this.processQueue();
        }
      });
  }

  /**
   * 处理加载队列
   */
  private processQueue(): void {
    if (this.loadingCount >= this.maxConcurrent) {
      return;
    }

    // 找出等待加载的任务，按优先级排序
    const pendingTasks = Array.from(this.tasks.values())
      .filter(task => 
        task.state !== 'loading' && 
        task.state !== 'loaded' &&
        task.enterViewportTime !== undefined
      )
      .sort((a, b) => {
        // 按优先级排序
        const priorityDiff = PRIORITY_WEIGHTS[b.priority] - PRIORITY_WEIGHTS[a.priority];
        if (priorityDiff !== 0) return priorityDiff;
        
        // 相同优先级按进入视口时间排序
        return (a.enterViewportTime || 0) - (b.enterViewportTime || 0);
      });

    // 加载下一个任务
    if (pendingTasks.length > 0) {
      this.startHighResLoad(pendingTasks[0].imageId);
    }
  }

  /**
   * 通知状态变化
   */
  private notifyStateChange(imageId: string, state: LoadingState): void {
    if (this.onStateChange) {
      this.onStateChange(imageId, state);
    }
  }

  /**
   * 估算图片大小（字节）
   * 基于 URL 中的尺寸信息或默认值
   */
  private estimateImageSize(imageUrl: string): number {
    // 默认估算：400x400 像素，4 字节/像素（RGBA）
    const defaultSize = 400 * 400 * 4;
    
    // 尝试从 URL 中提取尺寸信息
    const sizeMatch = imageUrl.match(/(\d+)x(\d+)/);
    if (sizeMatch) {
      const width = parseInt(sizeMatch[1], 10);
      const height = parseInt(sizeMatch[2], 10);
      return width * height * 4;
    }
    
    return defaultSize;
  }
}

// 导出单例实例
export const imageLoadingManager = new ImageLoadingManager();

export default imageLoadingManager;

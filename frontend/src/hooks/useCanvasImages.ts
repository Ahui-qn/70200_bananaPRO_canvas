/**
 * useCanvasImages Hook
 * 管理画布图片的加载、位置更新和状态持久化
 * 
 * 需求: 1.1, 2.1, 3.1
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { 
  CanvasImage, 
  CanvasState, 
  Viewport, 
  SavedImage 
} from '../../../shared/types';
import { apiService } from '../services/api';

// 防抖延迟时间（毫秒）
const DEBOUNCE_DELAY = 500;

// 默认图片尺寸
const DEFAULT_IMAGE_WIDTH = 400;
const DEFAULT_IMAGE_HEIGHT = 400;

// 网格布局参数
const GRID_PADDING = 20;
const GRID_START_X = 100;
const GRID_START_Y = 100;
const GRID_COL_WIDTH = 450;
const GRID_ROW_HEIGHT = 450;
const GRID_MAX_COLS = 4;

/**
 * 计算不重叠的位置
 * 使用网格布局算法避免图片重叠
 * 
 * @param existingImages 现有图片列表
 * @param newWidth 新图片宽度
 * @param newHeight 新图片高度
 * @returns 不重叠的位置坐标
 */
export function findNonOverlappingPosition(
  existingImages: CanvasImage[],
  newWidth: number = DEFAULT_IMAGE_WIDTH,
  newHeight: number = DEFAULT_IMAGE_HEIGHT
): { x: number; y: number } {
  // 如果没有现有图片，返回起始位置
  if (existingImages.length === 0) {
    return { x: GRID_START_X, y: GRID_START_Y };
  }

  // 尝试在网格中找到不重叠的位置
  for (let row = 0; row < 100; row++) {
    for (let col = 0; col < GRID_MAX_COLS; col++) {
      const testX = GRID_START_X + col * GRID_COL_WIDTH;
      const testY = GRID_START_Y + row * GRID_ROW_HEIGHT;

      // 检查是否与现有图片重叠
      const overlaps = existingImages.some(img => {
        const imgWidth = img.width || DEFAULT_IMAGE_WIDTH;
        const imgHeight = img.height || DEFAULT_IMAGE_HEIGHT;
        const imgX = img.canvasX ?? img.x ?? 0;
        const imgY = img.canvasY ?? img.y ?? 0;

        const imgRight = imgX + imgWidth;
        const imgBottom = imgY + imgHeight;
        const testRight = testX + newWidth;
        const testBottom = testY + newHeight;

        // 检查矩形是否相交（包含边距）
        return !(
          testX >= imgRight + GRID_PADDING ||
          testRight <= imgX - GRID_PADDING ||
          testY >= imgBottom + GRID_PADDING ||
          testBottom <= imgY - GRID_PADDING
        );
      });

      if (!overlaps) {
        return { x: testX, y: testY };
      }
    }
  }

  // 如果找不到不重叠的位置，在最后一张图片下方放置
  const lastImage = existingImages[existingImages.length - 1];
  const lastY = (lastImage.canvasY ?? lastImage.y ?? 0) + (lastImage.height || DEFAULT_IMAGE_HEIGHT);
  return { x: GRID_START_X, y: lastY + GRID_PADDING };
}

/**
 * 计算视口内可见的图片
 * 
 * @param images 所有图片列表
 * @param viewport 当前视口
 * @param buffer 边距缓冲区（提前加载即将可见的图片）
 * @returns 可见图片列表
 */
export function getVisibleImages(
  images: CanvasImage[],
  viewport: Viewport,
  buffer: number = 100
): CanvasImage[] {
  const viewLeft = viewport.x - buffer;
  const viewTop = viewport.y - buffer;
  const viewRight = viewport.x + viewport.width / viewport.scale + buffer;
  const viewBottom = viewport.y + viewport.height / viewport.scale + buffer;

  return images.filter(img => {
    const imgX = img.canvasX ?? img.x ?? 0;
    const imgY = img.canvasY ?? img.y ?? 0;
    const imgWidth = img.width || DEFAULT_IMAGE_WIDTH;
    const imgHeight = img.height || DEFAULT_IMAGE_HEIGHT;

    const imgRight = imgX + imgWidth;
    const imgBottom = imgY + imgHeight;

    // 检查图片边界框是否与视口相交
    return !(
      imgRight < viewLeft ||
      imgX > viewRight ||
      imgBottom < viewTop ||
      imgY > viewBottom
    );
  });
}

/**
 * useCanvasImages Hook 返回类型
 */
export interface UseCanvasImagesReturn {
  // 状态
  images: CanvasImage[];
  isLoading: boolean;
  error: string | null;
  canvasState: CanvasState | null;

  // 操作
  loadProjectImages: (projectId: string) => Promise<void>;
  updateImagePosition: (imageId: string, x: number, y: number) => void;
  savePendingPositions: () => void;
  getPendingUpdates: () => Map<string, { x: number; y: number }>;
  addNewImage: (image: CanvasImage) => void;
  removeImage: (imageId: string) => void;
  saveCanvasState: (state: CanvasState) => Promise<void>;
  clearImages: () => void;

  // 计算
  findNonOverlappingPosition: (width: number, height: number) => { x: number; y: number };
  getVisibleImages: (viewport: Viewport) => CanvasImage[];
}


/**
 * useCanvasImages Hook
 * 管理画布图片的加载、位置更新和状态持久化
 */
export function useCanvasImages(): UseCanvasImagesReturn {
  // 状态
  const [images, setImages] = useState<CanvasImage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [canvasState, setCanvasState] = useState<CanvasState | null>(null);

  // 当前项目 ID
  const currentProjectIdRef = useRef<string | null>(null);

  // 防抖定时器引用
  const debounceTimersRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  // 待保存的位置更新队列（用于网络失败时的本地缓存）
  const pendingUpdatesRef = useRef<Map<string, { x: number; y: number }>>(new Map());

  // 清理防抖定时器
  useEffect(() => {
    return () => {
      debounceTimersRef.current.forEach(timer => clearTimeout(timer));
      debounceTimersRef.current.clear();
    };
  }, []);

  /**
   * 加载项目图片
   * 需求: 1.1, 1.2
   */
  const loadProjectImages = useCallback(async (projectId: string) => {
    // 如果切换到不同项目，清空当前图片（需求 1.4）
    if (currentProjectIdRef.current !== projectId) {
      setImages([]);
      setCanvasState(null);
    }
    currentProjectIdRef.current = projectId;

    setIsLoading(true);
    setError(null);

    try {
      const response = await apiService.getProjectCanvasImages(projectId);
      
      if (response.success && response.data) {
        const { images: loadedImages, canvasState: loadedState } = response.data;
        
        // 转换为 CanvasImage 格式
        const canvasImages: CanvasImage[] = loadedImages.map((img: SavedImage) => ({
          ...img,
          x: img.canvasX ?? 0,
          y: img.canvasY ?? 0,
          width: img.width || DEFAULT_IMAGE_WIDTH,
          height: img.height || DEFAULT_IMAGE_HEIGHT,
          loadingState: 'placeholder' as const,
          isVisible: false,
        }));

        setImages(canvasImages);
        setCanvasState(loadedState || null);
      } else {
        // API 返回失败状态
        const errorMsg = response.error || '获取项目图片失败';
        console.error('获取项目图片失败:', errorMsg);
        setError(errorMsg);
      }
    } catch (err: any) {
      console.error('加载项目图片失败:', err);
      let errorMessage = '加载图片失败';
      
      // 根据错误类型提供更具体的错误信息
      if (err.name === 'TypeError' && err.message.includes('fetch')) {
        errorMessage = '网络连接失败，请检查网络连接';
      } else if (err.status === 401) {
        errorMessage = '登录已过期，请重新登录';
      } else if (err.status === 403) {
        errorMessage = '没有权限访问此项目';
      } else if (err.status === 404) {
        errorMessage = '项目不存在';
      } else if (err.status >= 500) {
        errorMessage = '服务器错误，请稍后重试';
      } else if (err.message) {
        errorMessage = err.message;
      }
      
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * 更新图片位置（仅更新本地状态，不保存到服务器）
   * 用于拖拽过程中的实时更新
   * 需求: 2.1
   */
  const updateImagePosition = useCallback((imageId: string, x: number, y: number) => {
    // 仅更新本地状态，不触发 API 调用
    setImages(prev => prev.map(img =>
      img.id === imageId
        ? { ...img, x, y, canvasX: x, canvasY: y }
        : img
    ));
    
    // 记录待保存的位置（用于页面卸载时保存）
    pendingUpdatesRef.current.set(imageId, { x, y });
  }, []);

  /**
   * 获取待保存的位置更新
   * 用于在页面卸载时获取最新的待保存数据
   */
  const getPendingUpdates = useCallback(() => {
    return pendingUpdatesRef.current;
  }, []);

  /**
   * 批量保存所有待保存的图片位置
   * 在页面卸载、组件销毁时调用
   * 需求: 2.1
   */
  const savePendingPositions = useCallback(async () => {
    const updates = pendingUpdatesRef.current;
    if (updates.size === 0) return;

    // 使用 Promise.all 并行保存所有待保存的位置
    const savePromises = Array.from(updates.entries()).map(async ([imageId, position]) => {
      try {
        await apiService.updateImageCanvasPosition(imageId, position.x, position.y);
        updates.delete(imageId);
      } catch (err: any) {
        console.error(`保存图片 ${imageId} 位置失败:`, err);
      }
    });

    await Promise.all(savePromises);
  }, []);

  /**
   * 添加新图片
   * 需求: 2.2, 6.1
   */
  const addNewImage = useCallback((image: CanvasImage) => {
    setImages(prev => {
      // 如果图片没有位置，计算不重叠的位置
      if (image.canvasX === undefined || image.canvasY === undefined) {
        const position = findNonOverlappingPosition(
          prev,
          image.width || DEFAULT_IMAGE_WIDTH,
          image.height || DEFAULT_IMAGE_HEIGHT
        );
        return [...prev, {
          ...image,
          x: position.x,
          y: position.y,
          canvasX: position.x,
          canvasY: position.y,
        }];
      }
      return [...prev, image];
    });
  }, []);

  /**
   * 移除图片
   */
  const removeImage = useCallback((imageId: string) => {
    setImages(prev => prev.filter(img => img.id !== imageId));
    // 清除该图片的防抖定时器
    const timer = debounceTimersRef.current.get(imageId);
    if (timer) {
      clearTimeout(timer);
      debounceTimersRef.current.delete(imageId);
    }
    // 从待保存队列中移除
    pendingUpdatesRef.current.delete(imageId);
  }, []);

  /**
   * 保存画布状态
   * 需求: 3.1
   */
  const saveCanvasState = useCallback(async (state: CanvasState) => {
    const projectId = currentProjectIdRef.current;
    if (!projectId) {
      console.warn('无法保存画布状态：没有当前项目');
      return;
    }

    // 立即更新本地状态
    setCanvasState(state);

    try {
      await apiService.saveCanvasState(projectId, state);
    } catch (err: any) {
      console.error('保存画布状态失败:', err);
      // 静默失败，不阻塞用户操作
    }
  }, []);

  /**
   * 清空图片
   */
  const clearImages = useCallback(() => {
    setImages([]);
    // 清除所有防抖定时器
    debounceTimersRef.current.forEach(timer => clearTimeout(timer));
    debounceTimersRef.current.clear();
    pendingUpdatesRef.current.clear();
  }, []);

  /**
   * 计算不重叠位置的包装函数
   */
  const findPosition = useCallback((width: number, height: number) => {
    return findNonOverlappingPosition(images, width, height);
  }, [images]);

  /**
   * 获取可见图片的包装函数
   */
  const getVisible = useCallback((viewport: Viewport) => {
    return getVisibleImages(images, viewport);
  }, [images]);

  return {
    // 状态
    images,
    isLoading,
    error,
    canvasState,

    // 操作
    loadProjectImages,
    updateImagePosition,
    savePendingPositions,
    getPendingUpdates,
    addNewImage,
    removeImage,
    saveCanvasState,
    clearImages,

    // 计算
    findNonOverlappingPosition: findPosition,
    getVisibleImages: getVisible,
  };
}

export default useCanvasImages;

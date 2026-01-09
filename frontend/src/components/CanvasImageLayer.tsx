/**
 * CanvasImageLayer 组件
 * 实现虚拟渲染，只渲染视口内可见的图片
 * 支持渐进式加载：先显示缩略图，再加载高清图
 * 根据缩放比例动态选择缩略图或原图
 * 
 * 需求: 1.3, 2.1, 3.1, 4.1, 4.2, 5.1, 5.2, 5.3
 * 图片选中状态重新设计需求: 1.1-1.5, 2.1-2.5, 3.1-3.5, 4.1-4.6, 5.1-5.4, 6.1-6.5
 */

import React, { useMemo, useCallback, useEffect, useState } from 'react';
import { CanvasImage, Viewport } from '../../../shared/types';
import { getVisibleImages } from '../hooks/useCanvasImages';
import { imageLoadingManager, LoadingState, ImageSourceType } from '../services/imageLoadingManager';
import { downloadImage, generateDownloadFilename } from '../utils/downloadUtils';
import {
  Heart,
  Download,
  Share2,
  X,
  Loader2,
  RefreshCw,
  ImagePlus,
  Pencil,
} from 'lucide-react';

// 默认图片尺寸（当数据库中没有尺寸数据时使用）
const DEFAULT_IMAGE_WIDTH = 400;
const DEFAULT_IMAGE_HEIGHT = 400;

// ============================================
// 图片类型和颜色映射（需求 1.1, 1.2, 1.3）
// ============================================

/**
 * 图片类型定义
 * - generated: AI 生成的图片
 * - edited: 编辑过的图片
 * - uploaded: 用户上传的图片
 */
export type ImageType = 'generated' | 'edited' | 'uploaded';

/**
 * 四角指示器颜色映射
 * - generated: 纯白色
 * - edited: 黄色 (Tailwind yellow-400)
 * - uploaded: 蓝色 (Tailwind blue-500)
 */
export const CORNER_COLORS: Record<ImageType, string> = {
  generated: '#FFFFFF',
  edited: '#FACC15',
  uploaded: '#3B82F6',
} as const;

/**
 * 动画配置常量
 */
export const ANIMATION_CONFIG = {
  duration: 250,         // 动画时长 (ms)
  easing: 'ease-out',    // 缓动函数
  cornerSize: 20,        // 角落线条长度 (px)
  cornerThickness: 3,    // 角落线条粗细 (px)
  expandOffset: 8,       // 动画起始偏移量 (px)
} as const;

/**
 * 获取图片类型
 * 根据 model 字段判断图片类型
 * 
 * @param image 画布图片对象
 * @returns 图片类型
 */
export const getImageType = (image: CanvasImage): ImageType => {
  if (image.model === 'edited') return 'edited';
  if (image.model === 'uploaded') return 'uploaded';
  return 'generated';
};

/**
 * 获取图片类型对应的颜色
 * 
 * @param image 画布图片对象
 * @returns 颜色值（十六进制）
 */
export const getCornerColor = (image: CanvasImage): string => {
  const imageType = getImageType(image);
  return CORNER_COLORS[imageType];
};

/**
 * 格式化尺寸显示
 * 
 * @param width 宽度
 * @param height 高度
 * @returns 格式化的字符串 "宽度 × 高度"
 */
export const formatDimensions = (width: number, height: number): string => {
  return `${Math.round(width)} × ${Math.round(height)}`;
};

/**
 * 判断是否应该显示重新生成按钮
 * 编辑过的图片和上传的图片不显示重新生成按钮
 * 
 * @param image 画布图片对象
 * @returns 是否显示重新生成按钮
 */
export const shouldShowRegenerateButton = (image: CanvasImage): boolean => {
  const imageType = getImageType(image);
  return imageType === 'generated';
};

// ============================================
// SelectionCorners 组件（需求 1.1-1.5, 2.1-2.5）
// ============================================

interface SelectionCornersProps {
  isSelected: boolean;           // 是否被选中
  imageType: ImageType;          // 图片类型
}

/**
 * 四角 L 形选中指示器组件
 * 支持聚焦动画效果
 * 
 * 需求: 1.1, 1.2, 1.3, 1.4, 1.5, 2.1, 2.2, 2.3, 2.4, 2.5
 */
const SelectionCorners: React.FC<SelectionCornersProps> = ({
  isSelected,
  imageType,
}) => {
  // 动画状态：entering（进入）、visible（可见）、exiting（退出）、hidden（隐藏）
  const [animationState, setAnimationState] = useState<'entering' | 'visible' | 'exiting' | 'hidden'>(
    isSelected ? 'visible' : 'hidden'
  );

  // 监听选中状态变化，触发动画
  useEffect(() => {
    if (isSelected) {
      setAnimationState('entering');
      const timer = setTimeout(() => {
        setAnimationState('visible');
      }, ANIMATION_CONFIG.duration);
      return () => clearTimeout(timer);
    } else {
      if (animationState !== 'hidden') {
        setAnimationState('exiting');
        const timer = setTimeout(() => {
          setAnimationState('hidden');
        }, ANIMATION_CONFIG.duration);
        return () => clearTimeout(timer);
      }
    }
  }, [isSelected]);

  // 如果完全隐藏，不渲染
  if (animationState === 'hidden') {
    return null;
  }

  const color = CORNER_COLORS[imageType];
  const { cornerSize, cornerThickness } = ANIMATION_CONFIG;

  // 动画类名
  const animationClass = animationState === 'entering' 
    ? 'selection-corners-entering' 
    : animationState === 'exiting' 
      ? 'selection-corners-exiting' 
      : '';

  return (
    <div 
      className={`absolute inset-0 pointer-events-none ${animationClass}`}
      style={{ 
        color,
        // 动画时添加 will-change 优化
        willChange: animationState === 'entering' || animationState === 'exiting' ? 'transform, opacity' : 'auto',
      }}
    >
      {/* 左上角 */}
      <div 
        className="absolute selection-corner corner-tl"
        style={{
          top: -cornerThickness,
          left: -cornerThickness,
          width: cornerSize,
          height: cornerSize,
        }}
      />
      
      {/* 右上角 */}
      <div 
        className="absolute selection-corner corner-tr"
        style={{
          top: -cornerThickness,
          right: -cornerThickness,
          width: cornerSize,
          height: cornerSize,
        }}
      />
      
      {/* 左下角 */}
      <div 
        className="absolute selection-corner corner-bl"
        style={{
          bottom: -cornerThickness,
          left: -cornerThickness,
          width: cornerSize,
          height: cornerSize,
        }}
      />
      
      {/* 右下角 */}
      <div 
        className="absolute selection-corner corner-br"
        style={{
          bottom: -cornerThickness,
          right: -cornerThickness,
          width: cornerSize,
          height: cornerSize,
        }}
      />
    </div>
  );
};

// ============================================
// DimensionBadge 组件（需求 3.1-3.5）
// ============================================

interface DimensionBadgeProps {
  width: number;                 // 图片实际宽度
  height: number;                // 图片实际高度
  isVisible: boolean;            // 是否显示
  isDragging: boolean;           // 是否正在拖拽
}

/**
 * 像素尺寸标签组件
 * 显示在图片上方左侧
 * 
 * 需求: 3.1, 3.2, 3.3, 3.4, 3.5
 */
const DimensionBadge: React.FC<DimensionBadgeProps> = ({
  width,
  height,
  isVisible,
  isDragging,
}) => {
  // 动画状态
  const [animationState, setAnimationState] = useState<'entering' | 'visible' | 'exiting' | 'hidden'>(
    isVisible && !isDragging ? 'visible' : 'hidden'
  );

  // 监听显示状态变化
  useEffect(() => {
    const shouldShow = isVisible && !isDragging;
    
    if (shouldShow) {
      setAnimationState('entering');
      const timer = setTimeout(() => {
        setAnimationState('visible');
      }, 200);
      return () => clearTimeout(timer);
    } else {
      if (animationState !== 'hidden') {
        setAnimationState('exiting');
        const timer = setTimeout(() => {
          setAnimationState('hidden');
        }, 150);
        return () => clearTimeout(timer);
      }
    }
  }, [isVisible, isDragging]);

  // 如果完全隐藏，不渲染
  if (animationState === 'hidden') {
    return null;
  }

  const animationClass = animationState === 'entering' 
    ? 'selection-ui-entering' 
    : animationState === 'exiting' 
      ? 'selection-ui-exiting' 
      : '';

  return (
    <div className={`dimension-badge ${animationClass}`}>
      {formatDimensions(width, height)}
    </div>
  );
};

// ============================================
// ActionToolbar 组件（需求 4.1-4.6）
// ============================================

interface ActionToolbarProps {
  image: CanvasImage;            // 图片数据
  isVisible: boolean;            // 是否显示
  isDragging: boolean;           // 是否正在拖拽
  onEdit?: () => void;           // 编辑回调
  onRegenerate?: () => void;     // 重新生成回调
  onAddAsReference?: () => void; // 添加为参考图回调
  onFavorite?: () => void;       // 收藏回调
  onDownload?: () => void;       // 下载回调
  onShare?: () => void;          // 分享回调
  onDelete?: () => void;         // 删除回调
}

/**
 * 操作工具栏组件
 * 显示在图片上方右侧，水平排列
 * 
 * 需求: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6
 */
const ActionToolbar: React.FC<ActionToolbarProps> = ({
  image,
  isVisible,
  isDragging,
  onEdit,
  onRegenerate,
  onAddAsReference,
  onFavorite,
  onDownload,
  onShare,
  onDelete,
}) => {
  // 动画状态
  const [animationState, setAnimationState] = useState<'entering' | 'visible' | 'exiting' | 'hidden'>(
    isVisible && !isDragging ? 'visible' : 'hidden'
  );

  // 监听显示状态变化
  useEffect(() => {
    const shouldShow = isVisible && !isDragging;
    
    if (shouldShow) {
      setAnimationState('entering');
      const timer = setTimeout(() => {
        setAnimationState('visible');
      }, 200);
      return () => clearTimeout(timer);
    } else {
      if (animationState !== 'hidden') {
        setAnimationState('exiting');
        const timer = setTimeout(() => {
          setAnimationState('hidden');
        }, 150);
        return () => clearTimeout(timer);
      }
    }
  }, [isVisible, isDragging]);

  // 如果完全隐藏，不渲染
  if (animationState === 'hidden') {
    return null;
  }

  const animationClass = animationState === 'entering' 
    ? 'selection-ui-entering' 
    : animationState === 'exiting' 
      ? 'selection-ui-exiting' 
      : '';

  // 判断是否显示重新生成按钮
  const showRegenerate = shouldShowRegenerateButton(image);

  return (
    <div className={`action-toolbar ${animationClass}`}>
      {/* 编辑按钮 */}
      {onEdit && (
        <button
          className="action-toolbar-btn btn-edit"
          onClick={(e) => {
            e.stopPropagation();
            onEdit();
          }}
          title="编辑图片"
        >
          <Pencil className="w-3.5 h-3.5" />
        </button>
      )}
      
      {/* 添加为参考图按钮 */}
      {onAddAsReference && (
        <button
          className="action-toolbar-btn btn-reference"
          onClick={(e) => {
            e.stopPropagation();
            onAddAsReference();
          }}
          title="添加为参考图"
        >
          <ImagePlus className="w-3.5 h-3.5" />
        </button>
      )}
      
      {/* 重新生成按钮 - 仅对生成的图片显示 */}
      {onRegenerate && showRegenerate && (
        <button
          className="action-toolbar-btn btn-regenerate"
          onClick={(e) => {
            e.stopPropagation();
            onRegenerate();
          }}
          title="重新生成"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      )}
      
      {/* 收藏按钮 */}
      {onFavorite && (
        <button
          className={`action-toolbar-btn btn-favorite ${image.favorite ? 'active' : ''}`}
          onClick={(e) => {
            e.stopPropagation();
            onFavorite();
          }}
          title="收藏"
        >
          <Heart className={`w-3.5 h-3.5 ${image.favorite ? 'fill-current' : ''}`} />
        </button>
      )}
      
      {/* 下载按钮 */}
      {onDownload && (
        <button
          className="action-toolbar-btn"
          onClick={(e) => {
            e.stopPropagation();
            onDownload();
          }}
          title="下载"
        >
          <Download className="w-3.5 h-3.5" />
        </button>
      )}
      
      {/* 分享按钮 */}
      {onShare && (
        <button
          className="action-toolbar-btn"
          onClick={(e) => {
            e.stopPropagation();
            onShare();
          }}
          title="分享"
        >
          <Share2 className="w-3.5 h-3.5" />
        </button>
      )}
      
      {/* 删除按钮 */}
      {onDelete && (
        <button
          className="action-toolbar-btn btn-delete"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          title="删除"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
};

interface CanvasImageLayerProps {
  // 所有图片
  images: CanvasImage[];
  // 当前视口
  viewport: Viewport;
  // 选中的图片 ID（单选，向后兼容）
  selectedImageId: string | null;
  // 选中的图片 ID 集合（多选）
  selectedIds?: Set<string>;
  // 正在拖拽的图片 ID 集合（用于 will-change 优化）
  draggingIds?: Set<string>;
  // 图片点击事件
  onImageMouseDown: (e: React.MouseEvent, imageId: string) => void;
  // 图片双击事件（查看详情）
  onImageDoubleClick: (image: CanvasImage) => void;
  // 删除图片
  onDeleteImage: (imageId: string) => void;
  // 收藏图片
  onFavoriteImage?: (imageId: string) => void;
  // 下载图片
  onDownloadImage?: (image: CanvasImage) => void;
  // 分享图片
  onShareImage?: (image: CanvasImage) => void;
  // 重新生成图片（将图片参数填充到生成对话框）
  onRegenerateImage?: (image: CanvasImage) => void;
  // 添加为参考图
  onAddAsReferenceImage?: (image: CanvasImage) => void;
  // 编辑图片
  onEditImage?: (image: CanvasImage) => void;
}

/**
 * 获取图片的实际尺寸
 * 优先使用数据库中存储的实际尺寸，如果没有则使用预设尺寸
 * 
 * @param image 画布图片对象
 * @returns 图片宽度和高度
 */
const getImageDimensions = (image: CanvasImage): { width: number; height: number } => {
  // 使用数据库中的实际尺寸，如果没有则回退到预设尺寸
  const width = image.width || DEFAULT_IMAGE_WIDTH;
  const height = image.height || DEFAULT_IMAGE_HEIGHT;
  return { width, height };
};

/**
 * 计算画布上的显示尺寸
 * 保持图片的实际宽高比，但限制最大尺寸以适应画布
 * 
 * @param image 画布图片对象
 * @param maxSize 最大尺寸限制（默认400px）
 * @returns 画布显示的宽度和高度
 */
const getCanvasDisplaySize = (image: CanvasImage, maxSize: number = 400): { width: number; height: number } => {
  const { width: actualWidth, height: actualHeight } = getImageDimensions(image);
  
  // 计算宽高比
  const aspectRatio = actualWidth / actualHeight;
  
  // 如果图片尺寸都小于等于最大尺寸，直接使用实际尺寸
  if (actualWidth <= maxSize && actualHeight <= maxSize) {
    return { width: actualWidth, height: actualHeight };
  }
  
  // 根据宽高比计算适合的显示尺寸
  if (aspectRatio > 1) {
    // 宽图：以宽度为准
    const displayWidth = Math.min(actualWidth, maxSize);
    const displayHeight = displayWidth / aspectRatio;
    return { width: displayWidth, height: displayHeight };
  } else {
    // 高图：以高度为准
    const displayHeight = Math.min(actualHeight, maxSize);
    const displayWidth = displayHeight * aspectRatio;
    return { width: displayWidth, height: displayHeight };
  }
};

/**
 * 单个画布图片组件
 * 支持渐进式加载：placeholder → thumbnail → loading → loaded
 * 根据缩放比例动态选择图片源
 */
const CanvasImageItem: React.FC<{
  image: CanvasImage;
  isSelected: boolean;
  isDragging: boolean;  // 是否正在被拖拽（用于 will-change 优化）
  scale: number;  // 当前缩放比例
  onMouseDown: (e: React.MouseEvent) => void;
  onDoubleClick: () => void;
  onDelete: () => void;
  onFavorite?: () => void;
  onDownload?: () => void;
  onShare?: () => void;
  onRegenerate?: () => void;  // 重新生成回调
  onAddAsReference?: () => void;  // 添加为参考图回调
  onEdit?: () => void;  // 编辑图片回调
}> = ({
  image,
  isSelected,
  isDragging,
  scale,
  onMouseDown,
  onDoubleClick,
  onDelete,
  onFavorite,
  onDownload,
  onShare,
  onRegenerate,
  onAddAsReference,
  onEdit,
}) => {
  // 优先使用运行时位置（x），因为它可能被用户拖动更新
  const imgX = image.x ?? image.canvasX ?? 0;
  const imgY = image.y ?? image.canvasY ?? 0;
  
  // 使用按比例计算的显示尺寸
  const { width: imgWidth, height: imgHeight } = getCanvasDisplaySize(image);
  
  // 获取实际尺寸用于显示信息（取整）
  const { width: actualWidth, height: actualHeight } = getImageDimensions(image);
  const displayActualWidth = Math.round(actualWidth);
  const displayActualHeight = Math.round(actualHeight);

  // 悬浮状态 - 用于显示尺寸标签和操作工具栏
  const [isHovered, setIsHovered] = useState(false);

  // 加载状态
  const [loadingState, setLoadingState] = useState<LoadingState>(
    image.loadingState || 'placeholder'
  );
  const [isHighResLoaded, setIsHighResLoaded] = useState(false);
  
  // Blob URL 缓存版本号（用于触发重新渲染）
  const [blobCacheVersion, setBlobCacheVersion] = useState(0);
  
  // 当前图片源类型
  const [currentSourceType, setCurrentSourceType] = useState<ImageSourceType>(
    imageLoadingManager.getSourceType(scale)
  );

  // 判断是否为失败状态（支持 status 字段和 isFailed 字段）
  const isFailed = image.status === 'failed' || image.isFailed === true;

  // 判断是否为占位符（正在生成中）
  const isGenerating = !image.url && !isFailed;

  // 注册到加载管理器（只在首次挂载时执行）
  useEffect(() => {
    if (!image.url) return;

    // 检查是否已有缓存的 Blob URL（避免重复请求）
    // 安全检查：确保 getBlobUrl 方法存在
    const hasCachedOriginal = typeof imageLoadingManager.getBlobUrl === 'function' 
      ? !!imageLoadingManager.getBlobUrl(image.url) 
      : false;
    const hasCachedThumbnail = image.thumbnailUrl && typeof imageLoadingManager.getBlobUrl === 'function'
      ? !!imageLoadingManager.getBlobUrl(image.thumbnailUrl) 
      : false;
    
    // 如果原图已缓存，直接设置为已加载状态
    if (hasCachedOriginal) {
      setLoadingState('loaded');
      setIsHighResLoaded(true);
      // 仍然需要注册任务（用于状态追踪），但不会触发网络请求
      imageLoadingManager.queueImageLoad(image.id, image.url, image.thumbnailUrl);
      return;
    }
    
    // 如果缩略图已缓存，设置为缩略图状态
    if (hasCachedThumbnail) {
      setLoadingState('thumbnail');
    }

    // 将图片加入加载队列（内部会检查缓存，避免重复请求）
    imageLoadingManager.queueImageLoad(
      image.id,
      image.url,
      image.thumbnailUrl
    );

    // 获取当前加载状态
    const currentState = imageLoadingManager.getLoadingState(image.id);
    setLoadingState(currentState);
    if (currentState === 'loaded') {
      setIsHighResLoaded(true);
    }

    // 使用事件驱动的状态更新，替代轮询
    // 注册状态变化回调
    const handleStateChange = (changedImageId: string, newState: LoadingState) => {
      if (changedImageId !== image.id) return;
      
      setLoadingState(prevState => {
        if (newState !== prevState) {
          // 状态变化时，触发重新渲染以获取最新的 Blob URL
          setBlobCacheVersion(v => v + 1);
          
          if (newState === 'loaded') {
            setIsHighResLoaded(true);
          }
          return newState;
        }
        return prevState;
      });
    };
    
    // 注册回调到 imageLoadingManager
    imageLoadingManager.addStateChangeListener(image.id, handleStateChange);

    return () => {
      // 移除回调
      imageLoadingManager.removeStateChangeListener(image.id);
      // 组件卸载时通知离开视口（但不清除缓存）
      imageLoadingManager.imageLeftViewport(image.id);
    };
  }, [image.id]); // 只依赖 image.id，避免重复触发

  // 当缩放比例变化时更新图片源类型
  useEffect(() => {
    const newSourceType = imageLoadingManager.getSourceType(scale);
    if (newSourceType !== currentSourceType) {
      setCurrentSourceType(newSourceType);
    }
  }, [scale, currentSourceType]);

  // 双击时立即加载高清图
  const handleDoubleClick = useCallback(() => {
    if (!isGenerating) {
      imageLoadingManager.loadImmediately(image.id);
      onDoubleClick();
    }
  }, [image.id, isGenerating, onDoubleClick]);

  // 获取当前应该显示的图片 URL
  // 关键：只使用 Blob URL，避免 <img> 标签直接请求 OSS
  const displayUrl = useMemo(() => {
    // 安全检查：确保 getBlobUrl 方法存在
    if (typeof imageLoadingManager.getBlobUrl !== 'function') {
      return null; // 返回 null，显示占位符
    }
    
    // 如果加载失败，返回 null
    if (loadingState === 'failed') {
      return null;
    }
    
    // 策略：尝试获取最佳可用的 Blob URL
    // 1. 如果是缩略图模式，优先用缩略图
    // 2. 如果是原图模式，优先用原图，回退到缩略图
    // 3. 无论哪种模式，只要有可用的 Blob URL 就显示
    
    const originalBlobUrl = imageLoadingManager.getBlobUrl(image.url);
    const thumbnailBlobUrl = image.thumbnailUrl 
      ? imageLoadingManager.getBlobUrl(image.thumbnailUrl) 
      : null;
    
    if (currentSourceType === 'thumbnail') {
      // 缩略图模式：优先缩略图，回退到原图
      return thumbnailBlobUrl || originalBlobUrl || null;
    } else {
      // 原图模式：优先原图，回退到缩略图（渐进式加载）
      if (isHighResLoaded || loadingState === 'loaded') {
        return originalBlobUrl || thumbnailBlobUrl || null;
      } else {
        // 原图还在加载，先用缩略图
        return thumbnailBlobUrl || originalBlobUrl || null;
      }
    }
  }, [image.url, image.thumbnailUrl, loadingState, isHighResLoaded, currentSourceType, blobCacheVersion]);
  
  // 是否有可显示的图片（Blob URL 已缓存）
  const hasDisplayableImage = displayUrl !== null;

  // 获取图片类型用于四角指示器颜色
  const imageType = getImageType(image);

  // 判断是否显示 UI（悬浮或选中时显示）
  const shouldShowUI = isHovered || isSelected;

  return (
    <div
      className={`absolute cursor-move group ${isDragging ? 'dragging' : ''}`}
      style={{
        top: 0,
        left: 0,
        transform: `translate3d(${imgX}px, ${imgY}px, 0)`,
        width: imgWidth,
        height: imgHeight,
        willChange: isDragging ? 'transform' : 'auto',
        // 选中或悬浮的图片提升 z-index，确保操作栏不被其他图片遮挡
        zIndex: shouldShowUI ? 100 : 'auto',
      }}
      onMouseDown={onMouseDown}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onDoubleClick={(e) => {
        e.stopPropagation();
        handleDoubleClick();
      }}
    >
      {/* 四角 L 形选中指示器 - 拖拽时也显示 */}
      <SelectionCorners
        isSelected={isSelected}
        imageType={imageType}
      />
      
      {/* 悬浮/选中状态 UI 容器 - 尺寸标签和操作工具栏 */}
      {shouldShowUI && (
        <div 
          className="selection-ui-container"
          onMouseDown={(e) => {
            // 阻止事件冒泡，防止触发图片的拖拽
            e.stopPropagation();
          }}
        >
          {/* 尺寸标签 - 左侧 */}
          <DimensionBadge
            width={displayActualWidth}
            height={displayActualHeight}
            isVisible={shouldShowUI}
            isDragging={isDragging}
          />
          
          {/* 操作工具栏 - 右侧 */}
          <ActionToolbar
            image={image}
            isVisible={shouldShowUI}
            isDragging={isDragging}
            onEdit={onEdit}
            onAddAsReference={onAddAsReference}
            onRegenerate={onRegenerate}
            onFavorite={onFavorite}
            onDownload={onDownload}
            onShare={onShare}
            onDelete={onDelete}
          />
        </div>
      )}
      {isFailed ? (
        // 失败状态显示
        <div className="w-full h-full glass-card rounded-xl flex flex-col items-center justify-center gap-3 border border-red-500/30 bg-red-500/5">
          <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center">
            <X className="w-6 h-6 text-red-400" />
          </div>
          <div className="text-center px-4">
            <p className="text-sm text-red-400 mb-1">生成失败</p>
            <p className="text-xs text-zinc-500 mb-2">{image.failureReason || '未知错误'}</p>
          </div>
          <p className="text-xs text-zinc-500 max-w-[90%] truncate px-4">{image.prompt}</p>
          <div className="text-xs text-zinc-600 mt-1">
            {image.model} · {image.aspectRatio} · {image.imageSize}
          </div>
          {/* 操作按钮 - 失败状态下显示重新生成和删除按钮 */}
          <div className="absolute top-2 right-2 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
            {onRegenerate && (
              <button
                className="btn-glass p-2 rounded-lg hover:bg-violet-500/20"
                onClick={(e) => {
                  e.stopPropagation();
                  onRegenerate();
                }}
                title="重新生成"
              >
                <RefreshCw className="w-3.5 h-3.5 text-violet-400" />
              </button>
            )}
            <button
              className="btn-glass p-2 rounded-lg hover:bg-red-500/20"
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              title="删除"
            >
              <X className="w-3.5 h-3.5 text-zinc-300" />
            </button>
          </div>
        </div>
      ) : isGenerating ? (
        // 占位符 - 正在生成中
        <div className="w-full h-full glass-card rounded-xl flex flex-col items-center justify-center gap-4">
          <Loader2 className="w-12 h-12 text-violet-400 animate-spin" />
          <div className="text-center">
            <p className="text-sm text-zinc-300 mb-2">正在生成...</p>
            <p className="text-xs text-zinc-500 max-w-[300px] truncate px-4">
              {image.prompt}
            </p>
          </div>
        </div>
      ) : (
        // 真实图片（支持渐进式加载）
        <>
          {/* 加载失败状态显示 */}
          {loadingState === 'failed' && (
            <div className="w-full h-full glass-card rounded-xl flex flex-col items-center justify-center gap-3 border border-orange-500/30 bg-orange-500/5">
              <div className="w-12 h-12 rounded-full bg-orange-500/20 flex items-center justify-center">
                <X className="w-6 h-6 text-orange-400" />
              </div>
              <div className="text-center px-4">
                <p className="text-sm text-orange-400 mb-1">图片加载失败</p>
                <p className="text-xs text-zinc-500">请检查网络连接或存储服务状态</p>
              </div>
              <p className="text-xs text-zinc-500 max-w-[90%] truncate px-4">{image.prompt}</p>
            </div>
          )}
          
          {/* 加载占位符动画 - 当没有可显示的 Blob URL 且未失败时显示 */}
          {!hasDisplayableImage && loadingState !== 'failed' && (
            <LoadingPlaceholder 
              width={imgWidth} 
              height={imgHeight} 
              prompt={image.prompt}
            />
          )}
          
          {/* 图片 - 只在有 Blob URL 时渲染，避免直接请求 OSS */}
          {hasDisplayableImage && (
            <img
              src={displayUrl}
              alt={image.prompt}
              className="w-full h-full object-cover rounded-xl shadow-2xl shadow-black/50 transition-opacity duration-300 opacity-100"
              draggable={false}
            />
          )}
          


          {/* 提示词信息 */}
          <div className="absolute bottom-2 left-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <div className="glass-subtle px-2 py-1 rounded-lg">
              <p className="text-xs text-zinc-300 truncate">{image.prompt}</p>
            </div>
          </div>
        </>
      )}
    </div>
  );
};


/**
 * 视口外图片的轻量级占位符
 * 使用按比例计算的显示尺寸
 * 使用 transform 定位避免 Layout/Reflow
 */
const ImagePlaceholder: React.FC<{
  image: CanvasImage;
}> = ({ image }) => {
  // 优先使用运行时位置（x），因为它可能被用户拖动更新
  const imgX = image.x ?? image.canvasX ?? 0;
  const imgY = image.y ?? image.canvasY ?? 0;
  
  // 使用按比例计算的显示尺寸
  const { width: imgWidth, height: imgHeight } = getCanvasDisplaySize(image);

  return (
    <div
      className="absolute bg-zinc-800/30 rounded-xl border border-zinc-700/30"
      style={{
        top: 0,
        left: 0,
        transform: `translate3d(${imgX}px, ${imgY}px, 0)`,
        width: imgWidth,
        height: imgHeight,
      }}
    />
  );
};

/**
 * 图片加载占位符组件（带动画效果）
 * 需求: 5.1, 13.1
 */
const LoadingPlaceholder: React.FC<{
  width: number;
  height: number;
  prompt?: string;
}> = ({ width, height, prompt }) => {
  return (
    <div 
      className="absolute inset-0 glass-card rounded-xl overflow-hidden"
      style={{ width, height }}
    >
      {/* 骨架屏动画背景 */}
      <div className="absolute inset-0 bg-gradient-to-r from-zinc-800/50 via-zinc-700/50 to-zinc-800/50 animate-shimmer" />
      
      {/* 加载指示器 */}
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
        <div className="w-12 h-12 rounded-full bg-zinc-700/50 flex items-center justify-center">
          <Loader2 className="w-6 h-6 text-violet-400 animate-spin" />
        </div>
        <span className="text-xs text-zinc-500">加载中...</span>
        {prompt && (
          <p className="text-xs text-zinc-600 max-w-[80%] truncate text-center px-4">
            {prompt}
          </p>
        )}
      </div>
    </div>
  );
};

/**
 * CanvasImageLayer 组件
 * 实现虚拟渲染，只渲染视口内可见的图片 DOM 元素
 * 视口外的图片使用轻量级占位符
 * 根据缩放比例动态选择缩略图或原图
 * 
 * 性能优化：
 * - 使用 transform: translate3d() 定位，避免 Layout/Reflow
 * - 拖拽时动态添加 will-change: transform，结束后移除
 */
export const CanvasImageLayer: React.FC<CanvasImageLayerProps> = ({
  images,
  viewport,
  selectedImageId,
  selectedIds,
  draggingIds,
  onImageMouseDown,
  onImageDoubleClick,
  onDeleteImage,
  onFavoriteImage,
  onDownloadImage,
  onShareImage,
  onRegenerateImage,
  onAddAsReferenceImage,
  onEditImage,
}) => {
  // 当前缩放比例
  const scale = viewport.scale;

  // 更新 imageLoadingManager 的缩放比例（带防抖）
  useEffect(() => {
    imageLoadingManager.updateScale(scale);
  }, [scale]);

  // 计算可见图片（使用 useMemo 优化性能）
  const visibleImages = useMemo(() => {
    return getVisibleImages(images, viewport);
  }, [images, viewport]);

  // 创建可见图片 ID 集合，用于快速查找
  const visibleImageIds = useMemo(() => {
    return new Set(visibleImages.map(img => img.id));
  }, [visibleImages]);

  // 处理图片鼠标按下事件
  const handleImageMouseDown = useCallback(
    (e: React.MouseEvent, imageId: string) => {
      e.stopPropagation();
      onImageMouseDown(e, imageId);
    },
    [onImageMouseDown]
  );

  // 处理下载
  const handleDownload = useCallback((image: CanvasImage) => {
    if (onDownloadImage) {
      onDownloadImage(image);
    } else {
      // 使用 blob 方式下载，触发系统保存对话框
      downloadImage(image.url, generateDownloadFilename(image.id));
    }
  }, [onDownloadImage]);

  // 处理分享
  const handleShare = useCallback((image: CanvasImage) => {
    if (onShareImage) {
      onShareImage(image);
    } else {
      // 默认复制链接行为
      navigator.clipboard.writeText(image.url);
    }
  }, [onShareImage]);

  // 判断图片是否被选中（支持单选和多选）
  const isImageSelected = useCallback((imageId: string) => {
    // 优先使用多选集合
    if (selectedIds && selectedIds.size > 0) {
      return selectedIds.has(imageId);
    }
    // 回退到单选
    return selectedImageId === imageId;
  }, [selectedIds, selectedImageId]);

  // 判断图片是否正在被拖拽
  const isImageDragging = useCallback((imageId: string) => {
    return draggingIds?.has(imageId) ?? false;
  }, [draggingIds]);

  return (
    <>
      {/* 渲染视口外的轻量级占位符 */}
      {images
        .filter(img => !visibleImageIds.has(img.id))
        .map(img => (
          <ImagePlaceholder key={`placeholder-${img.id}`} image={img} />
        ))}

      {/* 渲染可见图片的完整 DOM */}
      {visibleImages.map(img => (
        <CanvasImageItem
          key={img.id}
          image={img}
          isSelected={isImageSelected(img.id)}
          isDragging={isImageDragging(img.id)}
          scale={scale}
          onMouseDown={(e) => handleImageMouseDown(e, img.id)}
          onDoubleClick={() => onImageDoubleClick(img)}
          onDelete={() => onDeleteImage(img.id)}
          onFavorite={onFavoriteImage ? () => onFavoriteImage(img.id) : undefined}
          onDownload={() => handleDownload(img)}
          onShare={() => handleShare(img)}
          onRegenerate={onRegenerateImage ? () => onRegenerateImage(img) : undefined}
          onAddAsReference={onAddAsReferenceImage ? () => onAddAsReferenceImage(img) : undefined}
          onEdit={onEditImage ? () => onEditImage(img) : undefined}
        />
      ))}
    </>
  );
};

export default CanvasImageLayer;
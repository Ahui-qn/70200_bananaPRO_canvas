/**
 * CanvasImageLayer 组件
 * 实现虚拟渲染，只渲染视口内可见的图片
 * 支持渐进式加载：先显示缩略图，再加载高清图
 * 根据缩放比例动态选择缩略图或原图
 * 
 * 需求: 1.3, 2.1, 3.1, 4.1, 4.2, 5.1, 5.2, 5.3
 */

import React, { useMemo, useCallback, useEffect, useState } from 'react';
import { CanvasImage, Viewport } from '../../../shared/types';
import { getVisibleImages } from '../hooks/useCanvasImages';
import { imageLoadingManager, LoadingState, ImageSourceType } from '../services/imageLoadingManager';
import {
  Heart,
  Download,
  Share2,
  X,
  Loader2,
  RefreshCw,
  ImagePlus,
} from 'lucide-react';

// 默认图片尺寸（当数据库中没有尺寸数据时使用）
const DEFAULT_IMAGE_WIDTH = 400;
const DEFAULT_IMAGE_HEIGHT = 400;

interface CanvasImageLayerProps {
  // 所有图片
  images: CanvasImage[];
  // 当前视口
  viewport: Viewport;
  // 选中的图片 ID（单选，向后兼容）
  selectedImageId: string | null;
  // 选中的图片 ID 集合（多选）
  selectedIds?: Set<string>;
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
  scale: number;  // 当前缩放比例
  onMouseDown: (e: React.MouseEvent) => void;
  onDoubleClick: () => void;
  onDelete: () => void;
  onFavorite?: () => void;
  onDownload?: () => void;
  onShare?: () => void;
  onRegenerate?: () => void;  // 重新生成回调
  onAddAsReference?: () => void;  // 添加为参考图回调
}> = ({
  image,
  isSelected,
  scale,
  onMouseDown,
  onDoubleClick,
  onDelete,
  onFavorite,
  onDownload,
  onShare,
  onRegenerate,
  onAddAsReference,
}) => {
  // 优先使用运行时位置（x），因为它可能被用户拖动更新
  const imgX = image.x ?? image.canvasX ?? 0;
  const imgY = image.y ?? image.canvasY ?? 0;
  
  // 使用按比例计算的显示尺寸
  const { width: imgWidth, height: imgHeight } = getCanvasDisplaySize(image);
  
  // 获取实际尺寸用于显示信息
  const { width: actualWidth, height: actualHeight } = getImageDimensions(image);

  // 加载状态
  const [loadingState, setLoadingState] = useState<LoadingState>(
    image.loadingState || 'placeholder'
  );
  const [isHighResLoaded, setIsHighResLoaded] = useState(false);
  
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

    // 将图片加入加载队列（内部会检查是否已存在）
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

    // 定期检查加载状态（简单的轮询方式）
    let checkInterval: NodeJS.Timeout | null = null;
    
    // 只有在未加载完成时才需要轮询
    if (currentState !== 'loaded') {
      checkInterval = setInterval(() => {
        const state = imageLoadingManager.getLoadingState(image.id);
        setLoadingState(prevState => {
          if (state !== prevState) {
            if (state === 'loaded') {
              setIsHighResLoaded(true);
              if (checkInterval) {
                clearInterval(checkInterval);
                checkInterval = null;
              }
            }
            return state;
          }
          return prevState;
        });
      }, 100);
    }

    return () => {
      if (checkInterval) {
        clearInterval(checkInterval);
      }
      // 组件卸载时通知离开视口
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
  // 根据缩放比例动态选择图片源（缩小时使用缩略图，放大时使用原图）
  const displayUrl = useMemo(() => {
    // 如果当前应该使用缩略图（缩放 < 0.5）
    if (currentSourceType === 'thumbnail') {
      // 如果缩略图存在，使用缩略图
      if (image.thumbnailUrl) {
        return image.thumbnailUrl;
      }
      // 缩略图不存在，回退到原图
      return image.url;
    }
    
    // 当前应该使用原图（缩放 >= 0.5）
    // 如果高清图已加载，使用原图
    if (isHighResLoaded || loadingState === 'loaded') {
      return image.url;
    }
    
    // 如果有缩略图且正在加载原图，先显示缩略图
    if (image.thumbnailUrl && (loadingState === 'thumbnail' || loadingState === 'loading')) {
      return image.thumbnailUrl;
    }
    
    // 使用 imageLoadingManager 的智能选择
    return imageLoadingManager.getImageUrl(image, scale);
  }, [image, loadingState, isHighResLoaded, currentSourceType, scale]);

  return (
    <div
      className={`absolute cursor-move group ${
        isSelected ? 'ring-2 ring-violet-500 ring-offset-2 ring-offset-transparent' : ''
      }`}
      style={{
        left: imgX,
        top: imgY,
        width: imgWidth,
        height: imgHeight,
      }}
      onMouseDown={onMouseDown}
      onDoubleClick={(e) => {
        e.stopPropagation();
        handleDoubleClick();
      }}
    >
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
          {/* 加载占位符动画（需求 5.1, 13.1） */}
          {loadingState === 'placeholder' && !isHighResLoaded && (
            <LoadingPlaceholder 
              width={imgWidth} 
              height={imgHeight} 
              prompt={image.prompt}
            />
          )}
          
          {/* 图片（带淡入动画） */}
          <img
            src={displayUrl}
            alt={image.prompt}
            className={`w-full h-full object-cover rounded-xl shadow-2xl shadow-black/50 transition-opacity duration-500 ${
              isHighResLoaded || loadingState === 'thumbnail' || loadingState === 'loaded' ? 'opacity-100' : 'opacity-0'
            }`}
            draggable={false}
            loading="lazy"
            onLoad={() => {
              // 当图片加载完成时更新状态
              if (displayUrl === image.url) {
                setIsHighResLoaded(true);
                setLoadingState('loaded');
              } else if (displayUrl === image.thumbnailUrl) {
                setLoadingState('thumbnail');
              }
            }}
          />
          
          {/* 尺寸信息标签 - 左上角 */}
          <div className="absolute -top-2 -left-2 px-2 py-1 bg-black/80 text-white text-xs rounded-md border border-white/20 shadow-lg">
            {actualWidth} × {actualHeight}
          </div>
          
          {/* 操作按钮 */}
          <div className="absolute top-2 right-2 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
            {/* 添加为参考图按钮 - 位于最左侧 */}
            {onAddAsReference && (
              <button
                className="btn-glass p-2 rounded-lg hover:bg-emerald-500/20"
                onClick={(e) => {
                  e.stopPropagation();
                  onAddAsReference();
                }}
                title="添加为参考图"
              >
                <ImagePlus className="w-3.5 h-3.5 text-emerald-400" />
              </button>
            )}
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
            {onFavorite && (
              <button
                className="btn-glass p-2 rounded-lg"
                onClick={(e) => {
                  e.stopPropagation();
                  onFavorite();
                }}
                title="收藏"
              >
                <Heart
                  className={`w-3.5 h-3.5 ${
                    image.favorite ? 'text-red-400 fill-red-400' : 'text-zinc-300'
                  }`}
                />
              </button>
            )}
            {onDownload && (
              <button
                className="btn-glass p-2 rounded-lg"
                onClick={(e) => {
                  e.stopPropagation();
                  onDownload();
                }}
                title="下载"
              >
                <Download className="w-3.5 h-3.5 text-zinc-300" />
              </button>
            )}
            {onShare && (
              <button
                className="btn-glass p-2 rounded-lg"
                onClick={(e) => {
                  e.stopPropagation();
                  onShare();
                }}
                title="分享"
              >
                <Share2 className="w-3.5 h-3.5 text-zinc-300" />
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
        left: imgX,
        top: imgY,
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
 */
export const CanvasImageLayer: React.FC<CanvasImageLayerProps> = ({
  images,
  viewport,
  selectedImageId,
  selectedIds,
  onImageMouseDown,
  onImageDoubleClick,
  onDeleteImage,
  onFavoriteImage,
  onDownloadImage,
  onShareImage,
  onRegenerateImage,
  onAddAsReferenceImage,
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
      // 默认下载行为
      const link = document.createElement('a');
      link.href = image.url;
      link.download = `nano-banana-${image.id}.jpg`;
      link.click();
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
          scale={scale}
          onMouseDown={(e) => handleImageMouseDown(e, img.id)}
          onDoubleClick={() => onImageDoubleClick(img)}
          onDelete={() => onDeleteImage(img.id)}
          onFavorite={onFavoriteImage ? () => onFavoriteImage(img.id) : undefined}
          onDownload={() => handleDownload(img)}
          onShare={() => handleShare(img)}
          onRegenerate={onRegenerateImage ? () => onRegenerateImage(img) : undefined}
          onAddAsReference={onAddAsReferenceImage ? () => onAddAsReferenceImage(img) : undefined}
        />
      ))}
    </>
  );
};

export default CanvasImageLayer;
/**
 * 图片预览模态框组件
 * 点击放大图标后弹出的全屏预览窗口
 * 支持图片缩放查看细节
 */

import React, { useEffect, useCallback, useState, useRef } from 'react';
import { CanvasImage } from '../../../shared/types';
import { X, Download, Heart, Share2, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';

interface ImagePreviewModalProps {
  image: CanvasImage | null;
  isOpen: boolean;
  onClose: () => void;
  onFavorite?: (imageId: string) => void;
  onDownload?: (image: CanvasImage) => void;
  onShare?: (image: CanvasImage) => void;
}

export const ImagePreviewModal: React.FC<ImagePreviewModalProps> = ({
  image,
  isOpen,
  onClose,
  onFavorite,
  onDownload,
  onShare,
}) => {
  // 缩放状态（最小100%，无上限）
  const [scale, setScale] = useState(1);
  // 图片位置（用于拖拽）
  const [position, setPosition] = useState({ x: 0, y: 0 });
  // 拖拽状态
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  // 容器引用
  const containerRef = useRef<HTMLDivElement>(null);

  // 重置缩放和位置
  const resetView = useCallback(() => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  }, []);

  // 打开时重置状态
  useEffect(() => {
    if (isOpen) {
      resetView();
    }
  }, [isOpen, resetView]);

  // ESC 键关闭
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  // 滚轮缩放
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !isOpen) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      setScale(prev => Math.max(1, prev + delta)); // 最小100%
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleWheel);
  }, [isOpen]);

  // 处理下载
  const handleDownload = useCallback(() => {
    if (!image) return;
    if (onDownload) {
      onDownload(image);
    } else {
      const link = document.createElement('a');
      link.href = image.url;
      link.download = `nano-banana-${image.id}.png`;
      link.click();
    }
  }, [image, onDownload]);

  // 处理分享
  const handleShare = useCallback(() => {
    if (!image) return;
    if (onShare) {
      onShare(image);
    } else {
      navigator.clipboard.writeText(image.url).then(() => {
        console.log('图片链接已复制到剪贴板');
      });
    }
  }, [image, onShare]);

  // 缩放控制
  const handleZoomIn = () => setScale(prev => prev + 0.25);
  const handleZoomOut = () => setScale(prev => Math.max(1, prev - 0.25));

  // 拖拽处理
  const handleMouseDown = (e: React.MouseEvent) => {
    if (scale > 1) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging && scale > 1) {
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }
  };

  const handleMouseUp = () => setIsDragging(false);

  // 格式化日期
  const formatDate = (date: Date | string) => {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (!isOpen || !image) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      {/* 半透明背景遮罩 */}
      <div 
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* 卡片容器 - 占屏幕70% */}
      <div className="relative w-[70vw] h-[70vh] flex flex-col bg-zinc-900 rounded-2xl border border-zinc-700/50 shadow-2xl overflow-hidden">
        {/* 顶部工具栏 */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-800 bg-zinc-900">
          {/* 左侧：尺寸信息 */}
          <div className="flex items-center gap-3">
            {image.width && image.height && (
              <div className="flex items-center gap-2 px-2.5 py-1 bg-zinc-800 rounded-lg">
                <span className="text-sm text-zinc-300 font-medium">
                  {image.width} × {image.height}
                </span>
              </div>
            )}
            <div className="flex items-center gap-2 px-2.5 py-1 bg-zinc-800 rounded-lg">
              <span className="text-xs text-zinc-400">缩放:</span>
              <span className="text-sm text-zinc-200 font-medium">{Math.round(scale * 100)}%</span>
            </div>
          </div>

          {/* 右侧：操作按钮 */}
          <div className="flex items-center gap-1.5">
            {/* 缩放控制 */}
            <button
              onClick={handleZoomOut}
              disabled={scale <= 1}
              className="p-2 rounded-lg hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              title="缩小"
            >
              <ZoomOut className="w-4 h-4 text-zinc-400" />
            </button>
            <button
              onClick={handleZoomIn}
              className="p-2 rounded-lg hover:bg-zinc-800 transition-colors"
              title="放大"
            >
              <ZoomIn className="w-4 h-4 text-zinc-400" />
            </button>
            <button
              onClick={resetView}
              className="p-2 rounded-lg hover:bg-zinc-800 transition-colors"
              title="重置视图"
            >
              <RotateCcw className="w-4 h-4 text-zinc-400" />
            </button>

            <div className="w-px h-5 bg-zinc-700 mx-1.5" />

            {/* 收藏按钮 */}
            {onFavorite && (
              <button
                onClick={() => onFavorite(image.id)}
                className="p-2 rounded-lg hover:bg-zinc-800 transition-colors"
                title={image.favorite ? '取消收藏' : '收藏'}
              >
                <Heart
                  className={`w-4 h-4 ${
                    image.favorite ? 'text-red-400 fill-red-400' : 'text-zinc-400'
                  }`}
                />
              </button>
            )}

            {/* 下载按钮 */}
            <button
              onClick={handleDownload}
              className="p-2 rounded-lg hover:bg-zinc-800 transition-colors"
              title="下载"
            >
              <Download className="w-4 h-4 text-zinc-400" />
            </button>

            {/* 分享按钮 */}
            <button
              onClick={handleShare}
              className="p-2 rounded-lg hover:bg-zinc-800 transition-colors"
              title="分享"
            >
              <Share2 className="w-4 h-4 text-zinc-400" />
            </button>

            <div className="w-px h-5 bg-zinc-700 mx-1.5" />

            {/* 关闭按钮 */}
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-red-500/20 transition-colors"
              title="关闭 (ESC)"
            >
              <X className="w-4 h-4 text-zinc-400 hover:text-red-400" />
            </button>
          </div>
        </div>

        {/* 中间：图片区域 */}
        <div
          ref={containerRef}
          className="flex-1 overflow-hidden flex items-center justify-center bg-zinc-950"
          style={{ cursor: scale > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default' }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          <img
            src={image.url}
            alt={image.prompt}
            className="max-w-full max-h-full object-contain select-none transition-transform duration-100"
            style={{
              transform: scale > 1 ? `scale(${scale}) translate(${position.x / scale}px, ${position.y / scale}px)` : 'none',
            }}
            draggable={false}
          />
        </div>

        {/* 底部：信息栏 */}
        <div className="px-5 py-3 border-t border-zinc-800 bg-zinc-900">
          {/* 提示词 */}
          <div className="mb-2">
            <p className="text-zinc-300 text-sm leading-relaxed line-clamp-2">
              {image.prompt || '无提示词'}
            </p>
          </div>

          {/* 元信息 */}
          <div className="flex items-center gap-5 text-xs text-zinc-500">
            <div className="flex items-center gap-1.5">
              <span className="text-zinc-600">模型:</span>
              <span className="text-zinc-400">{image.model || '未知'}</span>
            </div>
            {image.createdAt && (
              <div className="flex items-center gap-1.5">
                <span className="text-zinc-600">创建时间:</span>
                <span className="text-zinc-400">{formatDate(image.createdAt)}</span>
              </div>
            )}
            {image.aspectRatio && (
              <div className="flex items-center gap-1.5">
                <span className="text-zinc-600">宽高比:</span>
                <span className="text-zinc-400">{image.aspectRatio}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ImagePreviewModal;

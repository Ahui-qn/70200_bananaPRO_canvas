import React from 'react';
import { ZoomIn, ZoomOut, Maximize2, FolderOpen, Trash2 } from 'lucide-react';

// ============================================
// 类型定义
// ============================================

export interface CanvasZoomControlProps {
  // 缩放控制
  scale: number;
  onScaleChange: (scale: number) => void;  // 简单缩放（用于按钮）
  onZoomToCenter: (newScale: number) => void;  // 以窗口中心为基准缩放（用于滑动条）
  onFitAll: () => void;  // 适应所有图片
  minScale?: number;
  maxScale?: number;
  
  // 可选的额外按钮
  onOpenImageLibrary?: () => void;
  onOpenTrashBin?: () => void;
}

// ============================================
// CanvasZoomControl 组件 - 画布缩放控制（垂直侧边栏布局）
// ============================================

export const CanvasZoomControl: React.FC<CanvasZoomControlProps> = ({
  scale,
  onScaleChange,
  onZoomToCenter,
  onFitAll,
  minScale = 0.1,
  maxScale = 3,
  onOpenImageLibrary,
  onOpenTrashBin,
}) => {
  // 处理缩放增减（以窗口中心为基准）
  const handleZoom = (delta: number) => {
    const newScale = Math.min(Math.max(minScale, scale + delta), maxScale);
    onZoomToCenter(newScale);
  };

  // 处理滑动条变化（以窗口中心为基准）
  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation();
    const newScale = parseFloat(e.target.value);
    onZoomToCenter(newScale);
  };

  // 阻止事件冒泡，防止触发画布拖拽和选区
  const stopPropagation = (e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
  };

  return (
    <>
      {/* 左侧垂直缩放控制栏 */}
      <div 
        className="absolute left-4 top-1/2 -translate-y-1/2 z-40"
        style={{ pointerEvents: 'auto' }}
        onMouseDown={stopPropagation}
        onTouchStart={stopPropagation}
      >
        <div className="flex flex-col items-center gap-2 px-2 py-3 rounded-2xl glass-floating transition-shadow duration-300 hover:shadow-lg">
          {/* 放大按钮 */}
          <button
            type="button"
            onClick={() => handleZoom(0.1)}
            disabled={scale >= maxScale}
            className="w-8 h-8 rounded-full bg-zinc-800/60 hover:bg-zinc-700/60 border border-zinc-700/50 
                       flex items-center justify-center transition-all duration-200 
                       disabled:opacity-50 disabled:cursor-not-allowed
                       touch-target active:scale-95"
            title="放大"
          >
            <ZoomIn className="w-4 h-4 text-zinc-300" />
          </button>

          {/* 垂直缩放滑动条 */}
          <input
            type="range"
            min={minScale}
            max={maxScale}
            step={0.1}
            value={scale}
            onChange={handleSliderChange}
            onMouseDown={stopPropagation}
            onTouchStart={stopPropagation}
            className="h-24 w-1.5 bg-zinc-700/50 rounded-full appearance-none cursor-pointer touch-slider
                       [&::-webkit-slider-thumb]:appearance-none
                       [&::-webkit-slider-thumb]:w-3
                       [&::-webkit-slider-thumb]:h-3
                       [&::-webkit-slider-thumb]:rounded-full
                       [&::-webkit-slider-thumb]:bg-violet-500
                       [&::-webkit-slider-thumb]:shadow-lg
                       [&::-webkit-slider-thumb]:shadow-violet-500/30
                       [&::-webkit-slider-thumb]:cursor-pointer
                       [&::-webkit-slider-thumb]:transition-transform
                       [&::-webkit-slider-thumb]:hover:scale-110
                       [&::-moz-range-thumb]:w-3
                       [&::-moz-range-thumb]:h-3
                       [&::-moz-range-thumb]:rounded-full
                       [&::-moz-range-thumb]:bg-violet-500
                       [&::-moz-range-thumb]:border-0
                       [&::-moz-range-thumb]:cursor-pointer"
            style={{
              writingMode: 'vertical-lr',
              direction: 'rtl',
            }}
          />

          {/* 缩小按钮 */}
          <button
            type="button"
            onClick={() => handleZoom(-0.1)}
            disabled={scale <= minScale}
            className="w-8 h-8 rounded-full bg-zinc-800/60 hover:bg-zinc-700/60 border border-zinc-700/50 
                       flex items-center justify-center transition-all duration-200 
                       disabled:opacity-50 disabled:cursor-not-allowed
                       touch-target active:scale-95"
            title="缩小"
          >
            <ZoomOut className="w-4 h-4 text-zinc-300" />
          </button>

          {/* 分隔线 */}
          <div className="w-5 h-px bg-zinc-700/50" />

          {/* 缩放百分比显示 */}
          <span className="text-xs text-zinc-500 font-medium">
            {Math.round(scale * 100)}%
          </span>

          {/* 分隔线 */}
          <div className="w-5 h-px bg-zinc-700/50" />

          {/* 适应所有图片按钮 */}
          <button
            type="button"
            onClick={onFitAll}
            className="w-8 h-8 rounded-full bg-zinc-800/60 hover:bg-zinc-700/60 border border-zinc-700/50 
                       flex items-center justify-center transition-all duration-200
                       touch-target active:scale-95"
            title="适应所有图片"
          >
            <Maximize2 className="w-4 h-4 text-zinc-300" />
          </button>
        </div>
      </div>

      {/* 底部左侧：图片库和回收站按钮（保持不变） */}
      <div 
        className="absolute bottom-6 left-6 z-40"
        style={{ pointerEvents: 'auto' }}
        onMouseDown={stopPropagation}
        onTouchStart={stopPropagation}
      >
        <div className="flex items-center gap-2">
          {/* 图片库按钮 */}
          {onOpenImageLibrary && (
            <button
              type="button"
              onClick={onOpenImageLibrary}
              className="w-10 h-10 rounded-full glass-button
                         flex items-center justify-center transition-all duration-200
                         touch-target active:scale-95"
              title="图片库"
            >
              <FolderOpen className="w-5 h-5 text-zinc-300" />
            </button>
          )}
          
          {/* 回收站按钮 */}
          {onOpenTrashBin && (
            <button
              type="button"
              onClick={onOpenTrashBin}
              className="w-10 h-10 rounded-full glass-button
                         flex items-center justify-center transition-all duration-200
                         touch-target active:scale-95"
              title="回收站"
            >
              <Trash2 className="w-5 h-5 text-zinc-300" />
            </button>
          )}
        </div>
      </div>
    </>
  );
};

export default CanvasZoomControl;

import React from 'react';
import { ZoomIn, ZoomOut, RotateCcw, FolderOpen, Trash2 } from 'lucide-react';

// ============================================
// 类型定义
// ============================================

export interface CanvasZoomControlProps {
  // 缩放控制
  scale: number;
  onScaleChange: (scale: number) => void;
  onReset: () => void;
  minScale?: number;
  maxScale?: number;
  
  // 可选的额外按钮
  onOpenImageLibrary?: () => void;
  onOpenTrashBin?: () => void;
}

// ============================================
// CanvasZoomControl 组件 - 画布缩放控制（拆分 UI）
// ============================================

export const CanvasZoomControl: React.FC<CanvasZoomControlProps> = ({
  scale,
  onScaleChange,
  onReset,
  minScale = 0.1,
  maxScale = 3,
  onOpenImageLibrary,
  onOpenTrashBin,
}) => {
  // 处理缩放增减
  const handleZoom = (delta: number) => {
    const newScale = Math.min(Math.max(minScale, scale + delta), maxScale);
    onScaleChange(newScale);
  };

  // 处理滑动条变化
  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newScale = parseFloat(e.target.value);
    onScaleChange(newScale);
  };

  return (
    <div 
      className="absolute bottom-6 left-6 z-40 zoom-control-container"
      style={{
        pointerEvents: 'auto',
      }}
    >
      {/* 使用 flex 布局，将组件拆分为独立按钮 */}
      <div className="flex items-center gap-2">
        {/* 图片库按钮（独立） - 圆形 */}
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
        
        {/* 回收站按钮（独立） - 圆形 */}
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

        {/* 缩放控制组（玻璃化容器） - 圆角更大 */}
        <div className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-2 rounded-full glass-floating transition-shadow duration-300 hover:shadow-lg">
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

          {/* 缩放滑动条 */}
          <input
            type="range"
            min={minScale}
            max={maxScale}
            step={0.1}
            value={scale}
            onChange={handleSliderChange}
            className="w-16 sm:w-24 h-1.5 bg-zinc-700/50 rounded-full appearance-none cursor-pointer touch-slider
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
          />

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

          {/* 分隔线 */}
          <div className="w-px h-5 bg-zinc-700/50 hidden sm:block" />

          {/* 重置视图按钮 */}
          <button
            type="button"
            onClick={onReset}
            className="w-8 h-8 rounded-full bg-zinc-800/60 hover:bg-zinc-700/60 border border-zinc-700/50 
                       flex items-center justify-center transition-all duration-200
                       touch-target active:scale-95"
            title="重置视图"
          >
            <RotateCcw className="w-4 h-4 text-zinc-300" />
          </button>

          {/* 缩放百分比显示 */}
          <span className="text-xs text-zinc-500 min-w-[36px] sm:min-w-[40px] text-center font-medium">
            {Math.round(scale * 100)}%
          </span>
        </div>
      </div>
    </div>
  );
};

export default CanvasZoomControl;

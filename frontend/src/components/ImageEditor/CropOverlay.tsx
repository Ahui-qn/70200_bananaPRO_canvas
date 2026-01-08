/**
 * 裁剪遮罩组件
 * 提供可拖拽调整的裁剪区域
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Check, X } from 'lucide-react';

export interface CropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface CropOverlayProps {
  // 画布尺寸
  canvasWidth: number;
  canvasHeight: number;
  // 初始裁剪区域（默认为整个画布）
  initialCrop?: CropRect;
  // 确认裁剪
  onConfirm: (cropRect: CropRect) => void;
  // 取消裁剪
  onCancel: () => void;
}

// 拖拽手柄类型
type HandleType = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'move';

export const CropOverlay: React.FC<CropOverlayProps> = ({
  canvasWidth,
  canvasHeight,
  initialCrop,
  onConfirm,
  onCancel,
}) => {
  // 裁剪区域状态
  const [cropRect, setCropRect] = useState<CropRect>(
    initialCrop || {
      x: canvasWidth * 0.1,
      y: canvasHeight * 0.1,
      width: canvasWidth * 0.8,
      height: canvasHeight * 0.8,
    }
  );

  // 拖拽状态
  const [isDragging, setIsDragging] = useState(false);
  const [dragHandle, setDragHandle] = useState<HandleType | null>(null);
  const startPosRef = useRef({ x: 0, y: 0 });
  const startRectRef = useRef<CropRect>(cropRect);
  const overlayRef = useRef<HTMLDivElement>(null);

  // 最小裁剪尺寸
  const MIN_SIZE = 50;

  // 开始拖拽
  const handleMouseDown = useCallback((e: React.MouseEvent, handle: HandleType) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
    setDragHandle(handle);
    startPosRef.current = { x: e.clientX, y: e.clientY };
    startRectRef.current = { ...cropRect };
  }, [cropRect]);

  // 拖拽中
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging || !dragHandle) return;

    const deltaX = e.clientX - startPosRef.current.x;
    const deltaY = e.clientY - startPosRef.current.y;
    const start = startRectRef.current;

    let newRect = { ...start };

    switch (dragHandle) {
      case 'move':
        newRect.x = Math.max(0, Math.min(canvasWidth - start.width, start.x + deltaX));
        newRect.y = Math.max(0, Math.min(canvasHeight - start.height, start.y + deltaY));
        break;
      case 'nw':
        newRect.x = Math.max(0, Math.min(start.x + start.width - MIN_SIZE, start.x + deltaX));
        newRect.y = Math.max(0, Math.min(start.y + start.height - MIN_SIZE, start.y + deltaY));
        newRect.width = start.width - (newRect.x - start.x);
        newRect.height = start.height - (newRect.y - start.y);
        break;
      case 'n':
        newRect.y = Math.max(0, Math.min(start.y + start.height - MIN_SIZE, start.y + deltaY));
        newRect.height = start.height - (newRect.y - start.y);
        break;
      case 'ne':
        newRect.y = Math.max(0, Math.min(start.y + start.height - MIN_SIZE, start.y + deltaY));
        newRect.width = Math.max(MIN_SIZE, Math.min(canvasWidth - start.x, start.width + deltaX));
        newRect.height = start.height - (newRect.y - start.y);
        break;
      case 'e':
        newRect.width = Math.max(MIN_SIZE, Math.min(canvasWidth - start.x, start.width + deltaX));
        break;
      case 'se':
        newRect.width = Math.max(MIN_SIZE, Math.min(canvasWidth - start.x, start.width + deltaX));
        newRect.height = Math.max(MIN_SIZE, Math.min(canvasHeight - start.y, start.height + deltaY));
        break;
      case 's':
        newRect.height = Math.max(MIN_SIZE, Math.min(canvasHeight - start.y, start.height + deltaY));
        break;
      case 'sw':
        newRect.x = Math.max(0, Math.min(start.x + start.width - MIN_SIZE, start.x + deltaX));
        newRect.width = start.width - (newRect.x - start.x);
        newRect.height = Math.max(MIN_SIZE, Math.min(canvasHeight - start.y, start.height + deltaY));
        break;
      case 'w':
        newRect.x = Math.max(0, Math.min(start.x + start.width - MIN_SIZE, start.x + deltaX));
        newRect.width = start.width - (newRect.x - start.x);
        break;
    }

    setCropRect(newRect);
  }, [isDragging, dragHandle, canvasWidth, canvasHeight]);


  // 结束拖拽
  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    setDragHandle(null);
  }, []);

  // 绑定全局鼠标事件
  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  // 手柄样式
  const handleStyle = "absolute w-3 h-3 bg-white border-2 border-violet-500 rounded-sm";
  const handleHoverStyle = "hover:bg-violet-500 hover:scale-125 transition-transform";

  return (
    <div
      ref={overlayRef}
      className="absolute inset-0 pointer-events-none"
      style={{ width: canvasWidth, height: canvasHeight }}
    >
      {/* 遮罩层 - 四个区域 */}
      <div
        className="absolute bg-black/60 pointer-events-auto"
        style={{ top: 0, left: 0, right: 0, height: cropRect.y }}
      />
      <div
        className="absolute bg-black/60 pointer-events-auto"
        style={{ top: cropRect.y + cropRect.height, left: 0, right: 0, bottom: 0 }}
      />
      <div
        className="absolute bg-black/60 pointer-events-auto"
        style={{ top: cropRect.y, left: 0, width: cropRect.x, height: cropRect.height }}
      />
      <div
        className="absolute bg-black/60 pointer-events-auto"
        style={{
          top: cropRect.y,
          left: cropRect.x + cropRect.width,
          right: 0,
          height: cropRect.height,
        }}
      />

      {/* 裁剪区域边框 */}
      <div
        className="absolute border-2 border-white/80 border-dashed pointer-events-auto cursor-move"
        style={{
          left: cropRect.x,
          top: cropRect.y,
          width: cropRect.width,
          height: cropRect.height,
        }}
        onMouseDown={(e) => handleMouseDown(e, 'move')}
      >
        {/* 网格线 */}
        <div className="absolute inset-0 grid grid-cols-3 grid-rows-3">
          {[...Array(9)].map((_, i) => (
            <div key={i} className="border border-white/20" />
          ))}
        </div>

        {/* 尺寸信息 */}
        <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-black/70 text-white text-xs px-2 py-1 rounded whitespace-nowrap">
          {Math.round(cropRect.width)} × {Math.round(cropRect.height)}
        </div>
      </div>

      {/* 拖拽手柄 */}
      {/* 四角 */}
      <div
        className={`${handleStyle} ${handleHoverStyle} cursor-nw-resize pointer-events-auto`}
        style={{ left: cropRect.x - 6, top: cropRect.y - 6 }}
        onMouseDown={(e) => handleMouseDown(e, 'nw')}
      />
      <div
        className={`${handleStyle} ${handleHoverStyle} cursor-ne-resize pointer-events-auto`}
        style={{ left: cropRect.x + cropRect.width - 6, top: cropRect.y - 6 }}
        onMouseDown={(e) => handleMouseDown(e, 'ne')}
      />
      <div
        className={`${handleStyle} ${handleHoverStyle} cursor-se-resize pointer-events-auto`}
        style={{ left: cropRect.x + cropRect.width - 6, top: cropRect.y + cropRect.height - 6 }}
        onMouseDown={(e) => handleMouseDown(e, 'se')}
      />
      <div
        className={`${handleStyle} ${handleHoverStyle} cursor-sw-resize pointer-events-auto`}
        style={{ left: cropRect.x - 6, top: cropRect.y + cropRect.height - 6 }}
        onMouseDown={(e) => handleMouseDown(e, 'sw')}
      />

      {/* 四边中点 */}
      <div
        className={`${handleStyle} ${handleHoverStyle} cursor-n-resize pointer-events-auto`}
        style={{ left: cropRect.x + cropRect.width / 2 - 6, top: cropRect.y - 6 }}
        onMouseDown={(e) => handleMouseDown(e, 'n')}
      />
      <div
        className={`${handleStyle} ${handleHoverStyle} cursor-e-resize pointer-events-auto`}
        style={{ left: cropRect.x + cropRect.width - 6, top: cropRect.y + cropRect.height / 2 - 6 }}
        onMouseDown={(e) => handleMouseDown(e, 'e')}
      />
      <div
        className={`${handleStyle} ${handleHoverStyle} cursor-s-resize pointer-events-auto`}
        style={{ left: cropRect.x + cropRect.width / 2 - 6, top: cropRect.y + cropRect.height - 6 }}
        onMouseDown={(e) => handleMouseDown(e, 's')}
      />
      <div
        className={`${handleStyle} ${handleHoverStyle} cursor-w-resize pointer-events-auto`}
        style={{ left: cropRect.x - 6, top: cropRect.y + cropRect.height / 2 - 6 }}
        onMouseDown={(e) => handleMouseDown(e, 'w')}
      />

      {/* 操作按钮 */}
      <div
        className="absolute flex gap-2 pointer-events-auto"
        style={{
          left: cropRect.x + cropRect.width / 2,
          top: cropRect.y + cropRect.height + 16,
          transform: 'translateX(-50%)',
        }}
      >
        <button
          onClick={() => onConfirm(cropRect)}
          className="flex items-center gap-1 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-sm transition-colors"
        >
          <Check className="w-4 h-4" />
          应用
        </button>
        <button
          onClick={onCancel}
          className="flex items-center gap-1 px-3 py-1.5 bg-zinc-600 hover:bg-zinc-500 text-white rounded-lg text-sm transition-colors"
        >
          <X className="w-4 h-4" />
          取消
        </button>
      </div>
    </div>
  );
};

/**
 * 编辑器画布组件
 * 使用 Fabric.js v7 实现图片编辑功能
 */

import { useRef, useEffect, useImperativeHandle, forwardRef, useState, useCallback } from 'react';
import { Canvas, FabricImage, Rect, Ellipse, PencilBrush, FabricObject, TPointerEventInfo, TPointerEvent } from 'fabric';
import { Tool } from './EditorToolbar';
import { CropOverlay, CropRect } from './CropOverlay';
import { Loader2 } from 'lucide-react';

interface EditorCanvasProps {
  imageUrl: string;
  initialTool: Tool;
  initialStrokeColor: string;
  initialStrokeWidth: number;
  // 裁剪相关
  isCropping?: boolean;
  canvasSize?: { width: number; height: number };
  onCropConfirm?: (cropRect: CropRect) => void;
  onCropCancel?: () => void;
}

export interface EditorCanvasRef {
  setTool: (tool: Tool) => void;
  setStrokeColor: (color: string) => void;
  setStrokeWidth: (width: number) => void;
  undo: () => void;
  redo: () => void;
  rotate: (angle: 90 | -90) => void;
  exportImage: () => Promise<{ blob: Blob; width: number; height: number } | null>;
  // 裁剪相关
  startCrop: () => void;
  applyCrop: (cropRect: { x: number; y: number; width: number; height: number }) => void;
  cancelCrop: () => void;
  getCanvasSize: () => { width: number; height: number };
}

// 历史记录状态接口
interface HistoryState {
  json: string;
  width: number;
  height: number;
}

// 历史记录管理器
class HistoryManager {
  private history: HistoryState[] = [];
  private currentIndex = -1;
  private maxHistory = 30;
  private isRestoring = false;

  saveState(canvas: Canvas) {
    if (this.isRestoring) return;
    
    const state: HistoryState = {
      json: JSON.stringify(canvas.toJSON()),
      width: canvas.getWidth(),
      height: canvas.getHeight(),
    };
    
    // 删除当前位置之后的历史
    this.history = this.history.slice(0, this.currentIndex + 1);
    this.history.push(state);
    
    // 限制历史长度
    if (this.history.length > this.maxHistory) {
      this.history.shift();
    } else {
      this.currentIndex++;
    }
  }

  async undo(canvas: Canvas): Promise<boolean> {
    if (this.currentIndex > 0) {
      this.isRestoring = true;
      this.currentIndex--;
      const state = this.history[this.currentIndex];
      
      // 先恢复画布尺寸
      canvas.setDimensions({ width: state.width, height: state.height });
      
      // 再恢复内容
      await canvas.loadFromJSON(state.json);
      canvas.renderAll();
      this.isRestoring = false;
      return true;
    }
    return false;
  }

  async redo(canvas: Canvas): Promise<boolean> {
    if (this.currentIndex < this.history.length - 1) {
      this.isRestoring = true;
      this.currentIndex++;
      const state = this.history[this.currentIndex];
      
      // 先恢复画布尺寸
      canvas.setDimensions({ width: state.width, height: state.height });
      
      // 再恢复内容
      await canvas.loadFromJSON(state.json);
      canvas.renderAll();
      this.isRestoring = false;
      return true;
    }
    return false;
  }

  clear() {
    this.history = [];
    this.currentIndex = -1;
  }
}

export const EditorCanvas = forwardRef<EditorCanvasRef, EditorCanvasProps>(
  ({ imageUrl, initialTool, initialStrokeColor, initialStrokeWidth, isCropping, canvasSize, onCropConfirm, onCropCancel }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const canvasWrapperRef = useRef<HTMLDivElement>(null);
    const fabricRef = useRef<Canvas | null>(null);
    const historyRef = useRef(new HistoryManager());
    
    // 状态
    const [isLoading, setIsLoading] = useState(true);
    const [currentTool, setCurrentTool] = useState<Tool>(initialTool);
    const [strokeColor, setStrokeColor] = useState(initialStrokeColor);
    const [strokeWidth, setStrokeWidth] = useState(initialStrokeWidth);
    // 缩放状态
    const [viewScale, setViewScale] = useState(1);
    // 画布在容器中的位置（用于裁剪遮罩定位）
    const [canvasPosition, setCanvasPosition] = useState({ left: 0, top: 0 });
    
    // 绘制状态
    const isDrawingRef = useRef(false);
    const startPointRef = useRef<{ x: number; y: number } | null>(null);
    const currentShapeRef = useRef<FabricObject | null>(null);

    // 初始化 Canvas
    useEffect(() => {
      if (!canvasRef.current || !containerRef.current) return;

      const container = containerRef.current;
      const canvas = new Canvas(canvasRef.current, {
        selection: true,
        preserveObjectStacking: true,
      });

      fabricRef.current = canvas;

      // 加载图片
      FabricImage.fromURL(imageUrl, { crossOrigin: 'anonymous' })
        .then((img: FabricImage) => {
          if (!img || !container) {
            setIsLoading(false);
            return;
          }

          // 获取原始图片尺寸 - 保持原图尺寸，不缩放画布
          const originalWidth = img.width || 800;
          const originalHeight = img.height || 600;

          // 设置画布尺寸为原图尺寸（保持原始分辨率）
          canvas.setDimensions({ width: originalWidth, height: originalHeight });

          // 设置背景图片 - 1:1 比例，不缩放
          img.set({
            scaleX: 1,
            scaleY: 1,
            left: 0,
            top: 0,
            originX: 'left',
            originY: 'top',
          });
          canvas.backgroundImage = img;
          canvas.renderAll();

          // 计算适合容器的显示缩放比例（用于视图缩放，不影响实际画布尺寸）
          const containerWidth = container.clientWidth;
          const containerHeight = container.clientHeight;
          const scaleX = (containerWidth - 40) / originalWidth;
          const scaleY = (containerHeight - 40) / originalHeight;
          const initialViewScale = Math.min(scaleX, scaleY, 1); // 不放大，只缩小显示
          setViewScale(initialViewScale);

          // 计算画布在容器中的位置
          const left = (containerWidth - originalWidth * initialViewScale) / 2;
          const top = (containerHeight - originalHeight * initialViewScale) / 2;
          setCanvasPosition({ left, top });

          // 保存初始状态
          historyRef.current.saveState(canvas);
          setIsLoading(false);
        })
        .catch((error) => {
          console.error('加载图片失败:', error);
          setIsLoading(false);
        });

      // 清理
      return () => {
        canvas.dispose();
        fabricRef.current = null;
      };
    }, [imageUrl]);

    // 设置工具
    const setTool = useCallback((tool: Tool) => {
      const canvas = fabricRef.current;
      if (!canvas) return;

      setCurrentTool(tool);

      // 重置绘图模式
      canvas.isDrawingMode = false;
      canvas.selection = tool === 'select';

      // 设置所有对象的可选择性
      canvas.getObjects().forEach((obj: FabricObject) => {
        obj.selectable = tool === 'select';
        obj.evented = tool === 'select';
      });

      if (tool === 'brush') {
        canvas.isDrawingMode = true;
        const brush = new PencilBrush(canvas);
        brush.color = strokeColor;
        brush.width = strokeWidth;
        canvas.freeDrawingBrush = brush;
      }

      canvas.renderAll();
    }, [strokeColor, strokeWidth]);

    // 设置颜色
    const setStrokeColorFn = useCallback((color: string) => {
      setStrokeColor(color);
      const canvas = fabricRef.current;
      if (canvas && canvas.isDrawingMode && canvas.freeDrawingBrush && currentTool === 'brush') {
        canvas.freeDrawingBrush.color = color;
      }
    }, [currentTool]);

    // 设置粗细
    const setStrokeWidthFn = useCallback((width: number) => {
      setStrokeWidth(width);
      const canvas = fabricRef.current;
      if (canvas && canvas.isDrawingMode && canvas.freeDrawingBrush) {
        canvas.freeDrawingBrush.width = width;
      }
    }, [currentTool]);

    // 撤销
    const undo = useCallback(() => {
      const canvas = fabricRef.current;
      if (canvas) {
        historyRef.current.undo(canvas);
      }
    }, []);

    // 重做
    const redo = useCallback(() => {
      const canvas = fabricRef.current;
      if (canvas) {
        historyRef.current.redo(canvas);
      }
    }, []);

    // 旋转
    const rotate = useCallback((angle: 90 | -90) => {
      const canvas = fabricRef.current;
      if (!canvas) return;

      // 获取当前尺寸
      const currentWidth = canvas.getWidth();
      const currentHeight = canvas.getHeight();

      // 交换宽高
      canvas.setDimensions({ width: currentHeight, height: currentWidth });

      // 旋转背景图
      const bgImage = canvas.backgroundImage as FabricImage;
      if (bgImage) {
        const currentAngle = bgImage.angle || 0;
        bgImage.rotate(currentAngle + angle);
        
        // 调整位置使图片居中
        bgImage.set({
          left: currentHeight / 2,
          top: currentWidth / 2,
          originX: 'center',
          originY: 'center',
        });
      }

      // 旋转所有对象
      canvas.getObjects().forEach((obj: FabricObject) => {
        const objAngle = obj.angle || 0;
        const objLeft = obj.left || 0;
        const objTop = obj.top || 0;

        // 计算新位置
        if (angle === 90) {
          obj.set({
            left: currentHeight - objTop,
            top: objLeft,
            angle: objAngle + 90,
          });
        } else {
          obj.set({
            left: objTop,
            top: currentWidth - objLeft,
            angle: objAngle - 90,
          });
        }
      });

      canvas.renderAll();
      historyRef.current.saveState(canvas);
    }, []);

    // 导出图片
    const exportImage = useCallback(async (): Promise<{ blob: Blob; width: number; height: number } | null> => {
      const canvas = fabricRef.current;
      if (!canvas) return null;

      return new Promise((resolve) => {
        // 取消选择
        canvas.discardActiveObject();
        canvas.renderAll();

        // 导出为 PNG
        const dataUrl = canvas.toDataURL({
          format: 'png',
          quality: 1,
          multiplier: 1,
        });

        // 转换为 Blob
        fetch(dataUrl)
          .then((res) => res.blob())
          .then((blob) => {
            resolve({
              blob,
              width: canvas.getWidth(),
              height: canvas.getHeight(),
            });
          })
          .catch(() => resolve(null));
      });
    }, []);

    // 开始裁剪模式
    const startCrop = useCallback(() => {
      // 裁剪模式由父组件通过 CropOverlay 处理
    }, []);

    // 应用裁剪
    const applyCrop = useCallback(async (cropRect: { x: number; y: number; width: number; height: number }) => {
      const canvas = fabricRef.current;
      if (!canvas) return;

      // 取消选择
      canvas.discardActiveObject();
      canvas.renderAll();

      // 使用临时 canvas 进行裁剪
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = cropRect.width;
      tempCanvas.height = cropRect.height;
      const tempCtx = tempCanvas.getContext('2d');
      
      if (!tempCtx) {
        console.error('无法创建临时 canvas context');
        return;
      }

      // 先导出整个画布
      const fullDataUrl = canvas.toDataURL({
        format: 'png',
        quality: 1,
        multiplier: 1,
      });

      // 加载完整图片并裁剪
      const fullImg = new Image();
      fullImg.crossOrigin = 'anonymous';
      
      await new Promise<void>((resolve, reject) => {
        fullImg.onload = () => {
          // 在临时 canvas 上绘制裁剪区域
          tempCtx.drawImage(
            fullImg,
            cropRect.x, cropRect.y, cropRect.width, cropRect.height,  // 源区域
            0, 0, cropRect.width, cropRect.height  // 目标区域
          );
          resolve();
        };
        fullImg.onerror = reject;
        fullImg.src = fullDataUrl;
      });

      // 获取裁剪后的图片数据
      const croppedDataUrl = tempCanvas.toDataURL('image/png');

      // 加载裁剪后的图片作为新背景
      try {
        const img = await FabricImage.fromURL(croppedDataUrl, { crossOrigin: 'anonymous' });
        
        // 清空画布
        canvas.clear();
        
        // 设置新尺寸
        canvas.setDimensions({ width: cropRect.width, height: cropRect.height });
        
        // 设置新背景
        img.set({
          scaleX: 1,
          scaleY: 1,
          left: 0,
          top: 0,
          originX: 'left',
          originY: 'top',
        });
        canvas.backgroundImage = img;
        canvas.renderAll();
        
        // 保存历史
        historyRef.current.saveState(canvas);
      } catch (error) {
        console.error('应用裁剪失败:', error);
      }
    }, []);

    // 取消裁剪
    const cancelCrop = useCallback(() => {
      // 裁剪取消由父组件处理
    }, []);

    // 获取画布尺寸
    const getCanvasSize = useCallback(() => {
      const canvas = fabricRef.current;
      if (!canvas) return { width: 0, height: 0 };
      return { width: canvas.getWidth(), height: canvas.getHeight() };
    }, []);

    // 滚轮缩放处理
    const handleWheel = useCallback((e: WheelEvent) => {
      e.preventDefault();
      
      // 计算缩放因子
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      const newScale = Math.max(0.1, Math.min(5, viewScale * delta));
      setViewScale(newScale);
    }, [viewScale]);

    // 绑定滚轮事件
    useEffect(() => {
      const wrapper = canvasWrapperRef.current;
      if (!wrapper) return;

      wrapper.addEventListener('wheel', handleWheel, { passive: false });
      return () => {
        wrapper.removeEventListener('wheel', handleWheel);
      };
    }, [handleWheel]);

    // 更新画布位置（当画布尺寸变化时）
    useEffect(() => {
      const canvas = fabricRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;

      const containerWidth = container.clientWidth;
      const containerHeight = container.clientHeight;
      const canvasWidth = canvas.getWidth();
      const canvasHeight = canvas.getHeight();

      const left = (containerWidth - canvasWidth * viewScale) / 2;
      const top = (containerHeight - canvasHeight * viewScale) / 2;
      setCanvasPosition({ left: Math.max(0, left), top: Math.max(0, top) });
    }, [viewScale, canvasSize]);

    // 暴露方法给父组件
    useImperativeHandle(ref, () => ({
      setTool,
      setStrokeColor: setStrokeColorFn,
      setStrokeWidth: setStrokeWidthFn,
      undo,
      redo,
      rotate,
      exportImage,
      startCrop,
      applyCrop,
      cancelCrop,
      getCanvasSize,
    }), [setTool, setStrokeColorFn, setStrokeWidthFn, undo, redo, rotate, exportImage, startCrop, applyCrop, cancelCrop, getCanvasSize]);

    // 处理形状绘制
    useEffect(() => {
      const canvas = fabricRef.current;
      if (!canvas) return;

      const handleMouseDown = (opt: TPointerEventInfo<TPointerEvent>) => {
        if (currentTool !== 'rect' && currentTool !== 'circle') return;
        
        const pointer = canvas.getViewportPoint(opt.e);
        isDrawingRef.current = true;
        startPointRef.current = { x: pointer.x, y: pointer.y };

        // 创建形状 - 从点击位置开始
        if (currentTool === 'rect') {
          currentShapeRef.current = new Rect({
            left: pointer.x,
            top: pointer.y,
            width: 0,
            height: 0,
            fill: 'transparent',
            stroke: strokeColor,
            strokeWidth: strokeWidth,
            selectable: false,
            evented: false,
          });
        } else if (currentTool === 'circle') {
          currentShapeRef.current = new Ellipse({
            left: pointer.x,
            top: pointer.y,
            rx: 0,
            ry: 0,
            fill: 'transparent',
            stroke: strokeColor,
            strokeWidth: strokeWidth,
            selectable: false,
            evented: false,
          });
        }

        if (currentShapeRef.current) {
          canvas.add(currentShapeRef.current);
        }
      };

      const handleMouseMove = (opt: TPointerEventInfo<TPointerEvent>) => {
        if (!isDrawingRef.current || !startPointRef.current || !currentShapeRef.current) return;

        const pointer = canvas.getViewportPoint(opt.e);
        const startX = startPointRef.current.x;
        const startY = startPointRef.current.y;

        // 计算宽高 - 始终从起点向右下方向扩展
        const width = pointer.x - startX;
        const height = pointer.y - startY;

        if (currentTool === 'rect') {
          const rect = currentShapeRef.current as Rect;
          rect.set({
            left: startX,
            top: startY,
            width: Math.max(0, width),
            height: Math.max(0, height),
          });
        } else if (currentTool === 'circle') {
          const ellipse = currentShapeRef.current as Ellipse;
          // 椭圆的 rx/ry 是半径，所以除以2
          const rx = Math.max(0, width) / 2;
          const ry = Math.max(0, height) / 2;
          ellipse.set({
            left: startX,
            top: startY,
            rx,
            ry,
          });
        }

        canvas.renderAll();
      };

      const handleMouseUp = () => {
        if (!isDrawingRef.current) return;
        
        isDrawingRef.current = false;
        startPointRef.current = null;
        
        if (currentShapeRef.current) {
          // 保存历史
          historyRef.current.saveState(canvas);
        }
        currentShapeRef.current = null;
      };

      canvas.on('mouse:down', handleMouseDown);
      canvas.on('mouse:move', handleMouseMove);
      canvas.on('mouse:up', handleMouseUp);

      // 画笔绘制完成后保存历史
      canvas.on('path:created', () => {
        historyRef.current.saveState(canvas);
      });

      return () => {
        canvas.off('mouse:down', handleMouseDown);
        canvas.off('mouse:move', handleMouseMove);
        canvas.off('mouse:up', handleMouseUp);
        canvas.off('path:created');
      };
    }, [currentTool, strokeColor, strokeWidth]);

    return (
      <div
        ref={containerRef}
        className="w-full h-full flex items-center justify-center bg-zinc-950 overflow-auto"
      >
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-10">
            <div className="flex items-center gap-3 text-white">
              <Loader2 className="w-6 h-6 animate-spin" />
              <span>加载图片中...</span>
            </div>
          </div>
        )}
        
        {/* 画布包装器 - 支持缩放 */}
        <div
          ref={canvasWrapperRef}
          className="relative"
          style={{
            transform: `scale(${viewScale})`,
            transformOrigin: 'center center',
          }}
        >
          <canvas ref={canvasRef} className="shadow-2xl" />
          
          {/* 裁剪遮罩 - 直接覆盖在画布上 */}
          {isCropping && canvasSize && canvasSize.width > 0 && onCropConfirm && onCropCancel && (
            <CropOverlay
              canvasWidth={canvasSize.width}
              canvasHeight={canvasSize.height}
              onConfirm={onCropConfirm}
              onCancel={onCropCancel}
            />
          )}
        </div>
        
        {/* 缩放比例显示 */}
        {viewScale !== 1 && (
          <div className="absolute bottom-4 right-4 px-2 py-1 bg-black/60 text-white text-xs rounded">
            {Math.round(viewScale * 100)}%
          </div>
        )}
      </div>
    );
  }
);

EditorCanvas.displayName = 'EditorCanvas';

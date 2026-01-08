/**
 * 图片编辑器主组件
 * 支持画笔、形状、裁剪、旋转等编辑功能
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { CanvasImage } from '../../../../shared/types';
import { EditorCanvas, EditorCanvasRef } from './EditorCanvas';
import { EditorToolbar, Tool } from './EditorToolbar';
import { ColorPicker } from './ColorPicker';
import { CropRect } from './CropOverlay';
import { X, Save, Image as ImageIcon, Loader2 } from 'lucide-react';

export interface ImageEditorProps {
  // 要编辑的图片
  image: CanvasImage;
  // 关闭编辑器
  onClose: () => void;
  // 保存成功回调，返回新图片和原图位置信息
  onSave: (newImageData: { blob: Blob; width: number; height: number; originalImage: CanvasImage }) => Promise<void>;
  // 设为参考图回调
  onSetAsReference?: (imageUrl: string) => void;
}

export const ImageEditor: React.FC<ImageEditorProps> = ({
  image,
  onClose,
  onSave,
  onSetAsReference,
}) => {
  // 当前工具
  const [activeTool, setActiveTool] = useState<Tool>('select');
  // 画笔/形状颜色
  const [strokeColor, setStrokeColor] = useState('#ff0000');
  // 画笔/形状粗细
  const [strokeWidth, setStrokeWidth] = useState(4);
  // 保存状态
  const [isSaving, setIsSaving] = useState(false);
  // 保存并设为参考图状态
  const [isSavingAsRef, setIsSavingAsRef] = useState(false);
  // 裁剪模式状态
  const [isCropping, setIsCropping] = useState(false);
  // 画布尺寸（用于裁剪遮罩）
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  // Canvas 引用
  const canvasRef = useRef<EditorCanvasRef>(null);

  // 处理工具切换
  const handleToolChange = useCallback((tool: Tool) => {
    // 如果切换到裁剪工具
    if (tool === 'crop') {
      const size = canvasRef.current?.getCanvasSize();
      if (size) {
        setCanvasSize(size);
        setIsCropping(true);
      }
      return;
    }
    
    // 如果从裁剪模式切换到其他工具，取消裁剪
    if (isCropping) {
      setIsCropping(false);
    }
    
    setActiveTool(tool);
    canvasRef.current?.setTool(tool);
  }, [isCropping]);

  // 处理颜色变化
  const handleColorChange = useCallback((color: string) => {
    setStrokeColor(color);
    canvasRef.current?.setStrokeColor(color);
  }, []);

  // 处理粗细变化
  const handleStrokeWidthChange = useCallback((width: number) => {
    setStrokeWidth(width);
    canvasRef.current?.setStrokeWidth(width);
  }, []);

  // 处理撤销
  const handleUndo = useCallback(() => {
    canvasRef.current?.undo();
  }, []);

  // 处理重做
  const handleRedo = useCallback(() => {
    canvasRef.current?.redo();
  }, []);

  // 处理旋转
  const handleRotate = useCallback((angle: 90 | -90) => {
    canvasRef.current?.rotate(angle);
    // 旋转后更新画布尺寸
    setTimeout(() => {
      const size = canvasRef.current?.getCanvasSize();
      if (size) {
        setCanvasSize(size);
      }
    }, 100);
  }, []);

  // 处理裁剪确认
  const handleCropConfirm = useCallback((cropRect: CropRect) => {
    canvasRef.current?.applyCrop(cropRect);
    setIsCropping(false);
    setActiveTool('select');
    // 更新画布尺寸
    setTimeout(() => {
      const size = canvasRef.current?.getCanvasSize();
      if (size) {
        setCanvasSize(size);
      }
    }, 100);
  }, []);

  // 处理裁剪取消
  const handleCropCancel = useCallback(() => {
    setIsCropping(false);
    setActiveTool('select');
  }, []);

  // 处理保存
  const handleSave = useCallback(async () => {
    if (!canvasRef.current || isSaving) return;
    
    setIsSaving(true);
    try {
      const result = await canvasRef.current.exportImage();
      if (result) {
        await onSave({
          blob: result.blob,
          width: result.width,
          height: result.height,
          originalImage: image,
        });
        onClose();
      }
    } catch (error) {
      console.error('保存图片失败:', error);
    } finally {
      setIsSaving(false);
    }
  }, [image, onSave, onClose, isSaving]);

  // 处理保存并设为参考图
  const handleSaveAsReference = useCallback(async () => {
    if (!canvasRef.current || !onSetAsReference || isSavingAsRef) return;
    
    setIsSavingAsRef(true);
    try {
      const result = await canvasRef.current.exportImage();
      if (result) {
        await onSave({
          blob: result.blob,
          width: result.width,
          height: result.height,
          originalImage: image,
        });
        // 创建临时 URL 用于参考图
        const tempUrl = URL.createObjectURL(result.blob);
        onSetAsReference(tempUrl);
        onClose();
      }
    } catch (error) {
      console.error('保存并设为参考图失败:', error);
    } finally {
      setIsSavingAsRef(false);
    }
  }, [image, onSave, onSetAsReference, onClose, isSavingAsRef]);

  // 键盘快捷键
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // ESC 关闭
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      
      // Ctrl/Cmd + Z 撤销
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
        return;
      }
      
      // Ctrl/Cmd + Shift + Z 重做
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && e.shiftKey) {
        e.preventDefault();
        handleRedo();
        return;
      }
      
      // Ctrl/Cmd + Y 重做（Windows 风格）
      if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        e.preventDefault();
        handleRedo();
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, handleUndo, handleRedo]);

  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex flex-col">
      {/* 顶部工具栏 */}
      <div className="flex items-center justify-between px-4 py-3 bg-zinc-900/80 border-b border-white/10">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-white">
            <ImageIcon className="w-5 h-5 text-violet-400" />
            <span className="font-medium">图片编辑器</span>
          </div>
          
          {/* 工具栏 */}
          <EditorToolbar
            activeTool={activeTool}
            onToolChange={handleToolChange}
            onUndo={handleUndo}
            onRedo={handleRedo}
            onRotate={handleRotate}
          />
        </div>

        <div className="flex items-center gap-3">
          {/* 颜色选择器 */}
          <ColorPicker
            color={strokeColor}
            onChange={handleColorChange}
          />
          
          {/* 粗细选择 */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-white/60">粗细</span>
            <select
              value={strokeWidth}
              onChange={(e) => handleStrokeWidthChange(Number(e.target.value))}
              className="bg-zinc-800 text-white text-sm rounded px-2 py-1 border border-white/10"
            >
              <option value={2}>细</option>
              <option value={4}>中</option>
              <option value={8}>粗</option>
              <option value={12}>特粗</option>
            </select>
          </div>

          {/* 操作按钮 */}
          <div className="flex items-center gap-2 ml-4">
            {onSetAsReference && (
              <button
                onClick={handleSaveAsReference}
                disabled={isSavingAsRef || isSaving}
                className="flex items-center gap-2 px-4 py-2 bg-violet-500/20 hover:bg-violet-500/30 text-violet-400 rounded-lg text-sm transition-colors disabled:opacity-50"
              >
                {isSavingAsRef ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <ImageIcon className="w-4 h-4" />
                )}
                保存并设为参考图
              </button>
            )}
            
            <button
              onClick={handleSave}
              disabled={isSaving || isSavingAsRef}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 rounded-lg text-sm transition-colors disabled:opacity-50"
            >
              {isSaving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              保存
            </button>
            
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/10 text-white/60 hover:text-white rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* 画布区域 */}
      <div className="flex-1 overflow-hidden relative">
        <EditorCanvas
          ref={canvasRef}
          imageUrl={image.url}
          initialTool={activeTool}
          initialStrokeColor={strokeColor}
          initialStrokeWidth={strokeWidth}
          isCropping={isCropping}
          canvasSize={canvasSize}
          onCropConfirm={handleCropConfirm}
          onCropCancel={handleCropCancel}
        />
      </div>
    </div>
  );
};

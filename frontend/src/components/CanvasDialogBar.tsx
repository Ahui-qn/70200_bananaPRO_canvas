import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  Image as ImageIcon,
  Video,
  MessageCircle,
  Plus,
  Send,
  Menu,
  X,
  Check,
  Loader2,
  Square,
} from 'lucide-react';
import { GenerationSettings, UploadedImage } from '../../../shared/types';
import { ConfigPanel } from './ConfigPanel';

// ============================================
// 类型定义
// ============================================

// 模式类型
export type DialogMode = 'image' | 'video' | 'chat';

// 模式配置
interface ModeConfig {
  id: DialogMode;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  enabled: boolean;
}

// 模式列表
const MODES: ModeConfig[] = [
  { id: 'image', label: '生成图片', icon: ImageIcon, enabled: true },
  { id: 'video', label: '生成视频', icon: Video, enabled: false },
  { id: 'chat', label: 'AI 对话', icon: MessageCircle, enabled: false },
];

// ============================================
// ModeSwitch 组件 - 模式切换按钮（独立按钮样式）
// ============================================

interface ModeSwitchProps {
  currentMode: DialogMode;
  onModeChange: (mode: DialogMode) => void;
  disabled?: boolean;
}

export const ModeSwitch: React.FC<ModeSwitchProps> = ({
  currentMode,
  onModeChange,
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  const currentModeConfig = MODES.find(m => m.id === currentMode) || MODES[0];
  const CurrentIcon = currentModeConfig.icon;

  // 点击外部关闭下拉框
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleModeSelect = (mode: DialogMode) => {
    const modeConfig = MODES.find(m => m.id === mode);
    if (modeConfig?.enabled) {
      onModeChange(mode);
      setIsOpen(false);
    }
  };

  return (
    <div ref={dropdownRef} className="relative">
      {/* 独立的玻璃化按钮 - 圆形 */}
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className="w-11 h-11 rounded-full glass-button
                   flex items-center justify-center transition-all duration-200 disabled:opacity-50
                   touch-target active:scale-95"
        title={currentModeConfig.label}
      >
        <CurrentIcon className="w-5 h-5 text-zinc-300" />
      </button>

      {isOpen && (
        <div className="absolute bottom-full left-0 mb-2 w-48 glass-card rounded-xl overflow-hidden z-50 animate-dropdown">
          <div className="py-1">
            {MODES.map((mode) => {
              const Icon = mode.icon;
              return (
                <button
                  key={mode.id}
                  onClick={() => handleModeSelect(mode.id)}
                  disabled={!mode.enabled}
                  className={`w-full px-3 py-2.5 flex items-center gap-3 transition-colors duration-150
                    ${mode.enabled ? 'hover:bg-zinc-700/50' : 'opacity-50 cursor-not-allowed'}
                    ${currentMode === mode.id ? 'bg-violet-500/10' : ''}`}
                >
                  <Icon className={`w-4 h-4 ${currentMode === mode.id ? 'text-violet-400' : 'text-zinc-400'}`} />
                  <span className={`text-sm ${currentMode === mode.id ? 'text-violet-300' : 'text-zinc-300'}`}>
                    {mode.label}
                  </span>
                  {!mode.enabled && (
                    <span className="ml-auto text-xs text-zinc-500">即将推出</span>
                  )}
                  {currentMode === mode.id && mode.enabled && (
                    <Check className="w-4 h-4 text-violet-400 ml-auto" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================
// RefImageUploader 组件 - 参考图上传按钮
// ============================================

interface RefImageUploaderProps {
  onUpload: (images: UploadedImage[]) => void;
  disabled?: boolean;
  maxImages?: number;
  currentCount?: number;
}

export const RefImageUploader: React.FC<RefImageUploaderProps> = ({
  onUpload,
  disabled = false,
  maxImages = 14,
  currentCount = 0,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 处理文件选择 - 使用时间戳确保唯一性
  const handleFileSelect = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const remainingSlots = maxImages - currentCount;
    const filesToProcess = Array.from(files).slice(0, remainingSlots);

    const uploadedImages: UploadedImage[] = [];
    const timestamp = Date.now();

    for (let i = 0; i < filesToProcess.length; i++) {
      const file = filesToProcess[i];
      // 验证文件类型
      if (!file.type.startsWith('image/')) continue;
      // 验证文件大小（最大 10MB）
      if (file.size > 10 * 1024 * 1024) continue;

      // 读取文件为 Base64
      const base64 = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });

      // 使用时间戳+索引+随机数确保唯一 ID
      const uniqueId = `ref-${timestamp}-${i}-${Math.random().toString(36).slice(2, 11)}`;

      uploadedImages.push({
        id: uniqueId,
        file,
        base64,
        preview: URL.createObjectURL(file),
        name: file.name,
        size: file.size,
      });
    }

    if (uploadedImages.length > 0) {
      onUpload(uploadedImages);
    }
    
    // 重置 input 以允许重复上传相同文件
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [onUpload, maxImages, currentCount]);

  // 点击上传按钮
  const handleClick = () => {
    if (!disabled && currentCount < maxImages) {
      fileInputRef.current?.click();
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled || currentCount >= maxImages}
        className={`w-8 h-8 flex items-center justify-center transition-all duration-200
          touch-target active:scale-95 hover:bg-zinc-700/40 rounded-full
          ${disabled || currentCount >= maxImages ? 'opacity-50 cursor-not-allowed' : ''}`}
        title={currentCount >= maxImages ? `最多上传 ${maxImages} 张参考图` : '添加参考图'}
      >
        <Plus className="w-5 h-5 text-zinc-400" />
      </button>
      
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        onChange={(e) => handleFileSelect(e.target.files)}
        className="hidden"
      />
    </>
  );
};

// ============================================
// RefImagePreview 组件 - 参考图预览区域
// ============================================

interface RefImagePreviewProps {
  images: UploadedImage[];
  onRemove: (imageId: string) => void;
  disabled?: boolean;
}

export const RefImagePreview: React.FC<RefImagePreviewProps> = ({
  images,
  onRemove,
  disabled = false,
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // 如果没有图片，不渲染任何内容
  if (images.length === 0) {
    return null;
  }

  // 处理删除按钮点击
  const handleRemove = (imageId: string) => {
    if (!disabled) {
      onRemove(imageId);
    }
  };

  return (
    <div 
      className="w-full mb-2"
      style={{
        pointerEvents: 'auto',
      }}
    >
      {/* 横向滚动容器 */}
      <div
        ref={scrollContainerRef}
        className="flex gap-2 overflow-x-auto scrollbar-thin scrollbar-thumb-zinc-600 scrollbar-track-transparent pb-1"
        style={{
          scrollbarWidth: 'thin',
          msOverflowStyle: 'none',
        }}
      >
        {images.map((image) => (
          <div
            key={image.id}
            className="relative flex-shrink-0 group"
          >
            {/* 图片预览 */}
            <div 
              className="w-16 h-16 rounded-lg overflow-hidden border border-zinc-700/50 
                         bg-zinc-800/60 backdrop-blur-sm thumbnail-hover
                         transition-all duration-200 ease-out"
            >
              <img
                src={image.preview || image.base64}
                alt={image.name}
                className="w-full h-full object-cover"
                loading="lazy"
              />
            </div>
            
            {/* 删除按钮 - 悬停时显示 */}
            <button
              type="button"
              onClick={() => handleRemove(image.id)}
              disabled={disabled}
              className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full 
                         bg-zinc-900/90 border border-zinc-700/50
                         flex items-center justify-center
                         opacity-0 group-hover:opacity-100 
                         transition-all duration-150 ease-out
                         hover:bg-red-500/80 hover:border-red-500/50 hover:scale-110
                         disabled:cursor-not-allowed animate-delete-btn"
              title="移除参考图"
            >
              <X className="w-3 h-3 text-zinc-300" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

// ============================================
// CanvasDialogBar 主组件
// ============================================

interface CanvasDialogBarProps {
  // 生成配置
  settings: GenerationSettings;
  onSettingsChange: (settings: GenerationSettings) => void;
  
  // 参考图片
  refImages: UploadedImage[];
  onRefImagesChange: (images: UploadedImage[]) => void;
  
  // 生成控制
  isGenerating: boolean;
  onGenerate: () => void;
  onCancel?: () => void;
  
  // 生成进度（需求 9.2）
  generationProgress?: number;
  generationStatus?: string;
  
  // 生成错误（需求 9.6）
  generationError?: string | null;
  onClearError?: () => void;
  
  // 模式切换（预留扩展）
  mode?: DialogMode;
  onModeChange?: (mode: DialogMode) => void;
  
  // 生成数量
  generateCount?: number;
  onGenerateCountChange?: (count: number) => void;
}

export const CanvasDialogBar: React.FC<CanvasDialogBarProps> = ({
  settings,
  onSettingsChange,
  refImages,
  onRefImagesChange,
  isGenerating,
  onGenerate,
  onCancel,
  generationProgress = 0,
  generationStatus = '',
  generationError = null,
  onClearError,
  mode = 'image',
  onModeChange,
  generateCount = 1,
  onGenerateCountChange,
}) => {
  const [currentMode, setCurrentMode] = useState<DialogMode>(mode);
  const [prompt, setPrompt] = useState(settings.prompt || '');
  const [isFocused, setIsFocused] = useState(false);
  const [showEmptyWarning, setShowEmptyWarning] = useState(false);
  const [isConfigPanelOpen, setIsConfigPanelOpen] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const dialogContainerRef = useRef<HTMLDivElement>(null);

  // 同步外部 mode 变化
  useEffect(() => {
    setCurrentMode(mode);
  }, [mode]);

  // 同步外部 prompt 变化
  useEffect(() => {
    setPrompt(settings.prompt || '');
  }, [settings.prompt]);

  // 自动调整 textarea 高度（最大 240px，约 8-10 行）
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const scrollHeight = textareaRef.current.scrollHeight;
      // 限制最大高度为 240px（约 8-10 行），超出后显示滚动条
      textareaRef.current.style.height = `${Math.min(scrollHeight, 240)}px`;
    }
  }, [prompt]);

  // 处理模式切换
  const handleModeChange = (newMode: DialogMode) => {
    setCurrentMode(newMode);
    onModeChange?.(newMode);
  };

  // 处理参考图上传
  const handleRefImageUpload = (newImages: UploadedImage[]) => {
    const updatedImages = [...refImages, ...newImages];
    onRefImagesChange(updatedImages);
  };

  // 处理参考图删除
  const handleRefImageRemove = (imageId: string) => {
    // 找到要删除的图片，释放其 preview URL
    const imageToRemove = refImages.find(img => img.id === imageId);
    if (imageToRemove?.preview) {
      URL.revokeObjectURL(imageToRemove.preview);
    }
    const updatedImages = refImages.filter(img => img.id !== imageId);
    onRefImagesChange(updatedImages);
  };

  // 处理提示词变化
  const handlePromptChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newPrompt = e.target.value;
    setPrompt(newPrompt);
    onSettingsChange({ ...settings, prompt: newPrompt });
    // 输入内容后清除空输入警告
    if (newPrompt.trim()) {
      setShowEmptyWarning(false);
    }
  };

  // 处理生成
  const handleGenerate = () => {
    if (isGenerating) return;
    
    // 空输入验证
    if (!prompt.trim()) {
      setShowEmptyWarning(true);
      // 3秒后自动隐藏警告
      setTimeout(() => setShowEmptyWarning(false), 3000);
      return;
    }
    
    setShowEmptyWarning(false);
    onGenerate();
  };

  // 处理回车键（Shift+Enter 换行，Enter 发送）
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleGenerate();
    }
  };

  // 处理配置面板开关
  const handleToggleConfigPanel = () => {
    setIsConfigPanelOpen(!isConfigPanelOpen);
  };

  // 处理配置面板关闭
  const handleCloseConfigPanel = () => {
    setIsConfigPanelOpen(false);
  };

  // 处理模型变化
  const handleModelChange = (model: string) => {
    onSettingsChange({ ...settings, model });
  };

  // 处理宽高比变化
  const handleAspectRatioChange = (aspectRatio: string) => {
    onSettingsChange({ ...settings, aspectRatio });
  };

  // 处理尺寸变化
  const handleImageSizeChange = (imageSize: string) => {
    onSettingsChange({ ...settings, imageSize });
  };

  // 处理生成数量变化
  const handleGenerateCountChange = (count: number) => {
    onGenerateCountChange?.(count);
  };

  // 处理拖拽文件上传
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isGenerating) {
      setIsDragOver(true);
    }
  }, [isGenerating]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // 检查是否真的离开了容器
    const rect = dialogContainerRef.current?.getBoundingClientRect();
    if (rect) {
      const { clientX, clientY } = e;
      if (
        clientX < rect.left ||
        clientX > rect.right ||
        clientY < rect.top ||
        clientY > rect.bottom
      ) {
        setIsDragOver(false);
      }
    }
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    
    if (isGenerating) return;

    const files = e.dataTransfer.files;
    if (!files || files.length === 0) return;

    const remainingSlots = 14 - refImages.length;
    const filesToProcess = Array.from(files).slice(0, remainingSlots);

    const uploadedImages: UploadedImage[] = [];
    const timestamp = Date.now();

    for (let i = 0; i < filesToProcess.length; i++) {
      const file = filesToProcess[i];
      // 验证文件类型
      if (!file.type.startsWith('image/')) continue;
      // 验证文件大小（最大 10MB）
      if (file.size > 10 * 1024 * 1024) continue;

      // 读取文件为 Base64
      const base64 = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });

      const uniqueId = `ref-${timestamp}-${i}-${Math.random().toString(36).slice(2, 11)}`;

      uploadedImages.push({
        id: uniqueId,
        file,
        base64,
        preview: URL.createObjectURL(file),
        name: file.name,
        size: file.size,
      });
    }

    if (uploadedImages.length > 0) {
      handleRefImageUpload(uploadedImages);
    }
  }, [isGenerating, refImages.length, handleRefImageUpload]);

  return (
    <div 
      ref={dialogContainerRef}
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 w-full max-w-[800px] px-4 dialog-container sm:bottom-6 sm:px-4"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* 拖拽提示区域 */}
      {isDragOver && (
        <div className="absolute inset-0 -top-20 flex items-center justify-center pointer-events-none z-50">
          <div className="px-6 py-4 rounded-2xl bg-violet-500/20 border-2 border-dashed border-violet-500/50 backdrop-blur-sm">
            <p className="text-violet-300 text-sm font-medium">释放以添加参考图</p>
          </div>
        </div>
      )}

      {/* 生成进度显示区域 - 显示在对话框上方（需求 9.2） */}
      {isGenerating && (
        <div className="mb-2 pl-14 pr-14 animate-fade-in">
          <div className="flex items-center gap-3 px-3 py-2 glass-card" style={{ borderRadius: '9999px' }}>
            <Loader2 className="w-4 h-4 text-violet-400 animate-spin-smooth flex-shrink-0" />
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-zinc-400 animate-pulse-soft">
                  {generationStatus || '正在生成图片...'}
                </span>
                <span className="text-xs text-zinc-500">{Math.round(generationProgress)}%</span>
              </div>
              <div className="w-full h-1.5 bg-zinc-700/50 rounded-full overflow-hidden">
                <div 
                  className="h-full progress-animated transition-all duration-300 ease-out rounded-full"
                  style={{ width: `${generationProgress}%` }}
                />
              </div>
            </div>
            {/* 取消按钮 - 暂时隐藏，保留代码以备后续其他模型使用
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                className="text-xs text-zinc-500 hover:text-red-400 transition-colors duration-150 flex-shrink-0"
              >
                取消
              </button>
            )}
            */}
          </div>
        </div>
      )}

      {/* 参考图预览区域 - 显示在对话框上方，与对话框左对齐 */}
      <div className="pl-14"> {/* 与模式切换按钮宽度 + gap 对齐 */}
        <RefImagePreview
          images={refImages}
          onRemove={handleRefImageRemove}
          disabled={isGenerating}
        />
      </div>

      {/* 对话框区域 - 按钮固定在底部，输入框向上扩展 */}
      <div className="flex items-end gap-2 sm:gap-3">
        {/* 左侧：模式切换按钮（独立按钮） */}
        <ModeSwitch
          currentMode={currentMode}
          onModeChange={handleModeChange}
          disabled={isGenerating}
        />

        {/* 中间：主输入框容器（玻璃化）- 向上扩展高度 */}
        <div className={`flex-1 glass-dialog rounded-3xl px-2 py-1.5 flex flex-col transition-all duration-300 
          ${isDragOver ? 'ring-2 ring-violet-500/50 bg-violet-500/10' : ''}`}>
          {/* 提示词输入框 - 自动调整高度，向上扩展 */}
          <div className="flex-1 relative">
            <textarea
              ref={textareaRef}
              value={prompt}
              onChange={handlePromptChange}
              onKeyDown={handleKeyDown}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              placeholder="描述您想要生成的图片..."
              disabled={isGenerating}
              rows={1}
              className="w-full px-2 py-2 bg-transparent text-zinc-100 placeholder-zinc-500 
                         text-sm outline-none border-none rounded-lg transition-all duration-200
                         resize-none scrollbar-thin scrollbar-thumb-zinc-600 scrollbar-track-transparent
                         leading-6"
              style={{
                minHeight: '36px',
                maxHeight: '240px',
                overflowY: 'auto',
              }}
            />
            {/* 空输入警告提示 */}
            {showEmptyWarning && (
              <div className="absolute left-0 -top-8 px-3 py-1 bg-amber-500/90 text-white text-xs rounded-md 
                             shadow-lg animate-shake whitespace-nowrap">
                请输入提示词后再生成
              </div>
            )}
          </div>

          {/* 底部按钮行 - 固定在底部 */}
          <div className="flex items-center gap-1">
            {/* 参考图上传按钮 */}
            <div className="flex-shrink-0">
              <RefImageUploader
                onUpload={handleRefImageUpload}
                disabled={isGenerating}
                maxImages={14}
                currentCount={refImages.length}
              />
            </div>

            {/* 占位空间 */}
            <div className="flex-1" />

            {/* 配置菜单按钮 */}
            <div className="relative flex-shrink-0">
              <button
                ref={menuButtonRef}
                type="button"
                onClick={handleToggleConfigPanel}
                disabled={isGenerating}
                className={`w-8 h-8 flex items-center justify-center transition-all duration-200 disabled:opacity-50
                touch-target active:scale-95 hover:bg-zinc-700/40 rounded-full
                ${isConfigPanelOpen 
                  ? 'text-violet-300' 
                  : 'text-zinc-400'}`}
              title="生成配置"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* 配置面板 */}
            <ConfigPanel
              isOpen={isConfigPanelOpen}
              onClose={handleCloseConfigPanel}
              anchorRef={menuButtonRef}
              model={settings.model}
              onModelChange={handleModelChange}
              aspectRatio={settings.aspectRatio}
              onAspectRatioChange={handleAspectRatioChange}
              imageSize={settings.imageSize}
              onImageSizeChange={handleImageSizeChange}
              generateCount={generateCount}
              onGenerateCountChange={handleGenerateCountChange}
            />
            </div>
          </div>
        </div>

        {/* 右侧：生成按钮（独立按钮）- 生成中时禁用，不显示停止按钮 */}
        <button
          type="button"
          onClick={handleGenerate}
          disabled={(!prompt.trim() && !isGenerating) || isGenerating}
          className={`w-11 h-11 rounded-full flex items-center justify-center transition-all duration-200
            touch-target active:scale-95 btn-generate flex-shrink-0
            bg-gradient-to-br from-violet-500 to-indigo-600 hover:from-violet-400 hover:to-indigo-500 hover:shadow-xl hover:shadow-violet-500/30
            ${(!prompt.trim() || isGenerating) ? 'opacity-50 cursor-not-allowed' : ''}
            shadow-lg shadow-violet-500/20`}
          title={isGenerating ? '生成中...' : '生成图片'}
        >
          {isGenerating ? (
            <Loader2 className="w-5 h-5 text-white animate-spin" />
          ) : (
            <Send className="w-5 h-5 text-white" />
          )}
        </button>
        
        {/* 停止生成按钮 - 暂时隐藏，保留代码以备后续其他模型使用
        {isGenerating && onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="w-11 h-11 rounded-full flex items-center justify-center transition-all duration-200
              touch-target active:scale-95 flex-shrink-0
              bg-red-500/80 hover:bg-red-500
              shadow-lg shadow-red-500/20"
            title="停止生成"
          >
            <Square className="w-4 h-4 text-white" fill="currentColor" />
          </button>
        )}
        */}
      </div>

      {/* 生成错误提示（需求 9.6） */}
      {generationError && !isGenerating && (
        <div className="mt-2 px-4 animate-fade-in">
          <div className="flex items-center gap-2 px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-lg">
            <X className="w-4 h-4 text-red-400 flex-shrink-0" />
            <span className="text-xs text-red-300 flex-1">{generationError}</span>
            {onClearError && (
              <button
                type="button"
                onClick={onClearError}
                className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                关闭
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default CanvasDialogBar;

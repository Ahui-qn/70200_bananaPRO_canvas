import React, { useRef, useEffect, useCallback } from 'react';
import { X, ChevronDown } from 'lucide-react';

// ============================================
// 类型定义
// ============================================

// 模型选项
export interface ModelOption {
  id: string;
  name: string;
  description?: string;
  supportsResolution?: boolean; // 是否支持分辨率选择
}

// 尺寸选项
export interface SizeOption {
  id: string;
  label: string;
  width: number;
  height: number;
}

// 宽高比选项
export interface AspectRatioOption {
  id: string;
  label: string;
  ratio: string;
}

// 配置面板属性
export interface ConfigPanelProps {
  isOpen: boolean;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLElement | null>;
  
  // 模型选择
  model: string;
  onModelChange: (model: string) => void;
  modelOptions?: ModelOption[];
  
  // 宽高比选择
  aspectRatio: string;
  onAspectRatioChange: (ratio: string) => void;
  aspectRatioOptions?: AspectRatioOption[];
  
  // 尺寸选择
  imageSize: string;
  onImageSizeChange: (size: string) => void;
  sizeOptions?: SizeOption[];
  
  // 生成数量
  generateCount: number;
  onGenerateCountChange: (count: number) => void;
  minCount?: number;
  maxCount?: number;
}

// 默认模型选项 - 只显示 nano-banana-fast 和 nano-banana-pro
const DEFAULT_MODEL_OPTIONS: ModelOption[] = [
  { id: 'nano-banana-fast', name: 'Nano Banana Fast', description: '快速生成', supportsResolution: false },
  { id: 'nano-banana-pro', name: 'Nano Banana Pro', description: '高质量生成', supportsResolution: true },
];

// 默认宽高比选项
const DEFAULT_ASPECT_RATIO_OPTIONS: AspectRatioOption[] = [
  { id: '1:1', label: '1:1', ratio: '1:1' },
  { id: '4:3', label: '4:3', ratio: '4:3' },
  { id: '3:4', label: '3:4', ratio: '3:4' },
  { id: '16:9', label: '16:9', ratio: '16:9' },
  { id: '9:16', label: '9:16', ratio: '9:16' },
  { id: '3:2', label: '3:2', ratio: '3:2' },
  { id: '2:3', label: '2:3', ratio: '2:3' },
];

// 默认尺寸选项
const DEFAULT_SIZE_OPTIONS: SizeOption[] = [
  { id: '1K', label: '1K', width: 1024, height: 1024 },
  { id: '2K', label: '2K', width: 2048, height: 2048 },
  { id: '4K', label: '4K', width: 4096, height: 4096 },
];

// ============================================
// ConfigPanel 组件
// ============================================

export const ConfigPanel: React.FC<ConfigPanelProps> = ({
  isOpen,
  onClose,
  anchorRef,
  model,
  onModelChange,
  modelOptions = DEFAULT_MODEL_OPTIONS,
  aspectRatio,
  onAspectRatioChange,
  aspectRatioOptions = DEFAULT_ASPECT_RATIO_OPTIONS,
  imageSize,
  onImageSizeChange,
  sizeOptions = DEFAULT_SIZE_OPTIONS,
  generateCount,
  onGenerateCountChange,
  minCount = 1,
  maxCount = 6,
}) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const [isModelDropdownOpen, setIsModelDropdownOpen] = React.useState(false);

  // 获取当前选中的模型配置
  const selectedModel = modelOptions.find(m => m.id === model);
  const supportsResolution = selectedModel?.supportsResolution ?? true;

  // 点击外部关闭面板
  const handleClickOutside = useCallback((e: MouseEvent) => {
    const target = e.target as Node;
    
    // 检查是否点击了面板内部
    if (panelRef.current && panelRef.current.contains(target)) {
      return;
    }
    
    // 检查是否点击了锚点按钮
    if (anchorRef.current && anchorRef.current.contains(target)) {
      return;
    }
    
    // 点击外部，关闭面板
    onClose();
  }, [onClose, anchorRef]);

  // 添加/移除点击外部监听器
  useEffect(() => {
    if (isOpen) {
      // 延迟添加监听器，避免立即触发
      const timer = setTimeout(() => {
        document.addEventListener('mousedown', handleClickOutside);
      }, 0);
      
      return () => {
        clearTimeout(timer);
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [isOpen, handleClickOutside]);

  // 处理生成数量变化
  const handleCountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10);
    if (!isNaN(value) && value >= minCount && value <= maxCount) {
      onGenerateCountChange(value);
    }
  };

  // 如果面板未打开，不渲染
  if (!isOpen) {
    return null;
  }

  return (
    <div
      ref={panelRef}
      className="absolute bottom-full right-0 mb-2 w-80 glass-panel rounded-2xl overflow-hidden z-50 animate-panel-open
                 max-sm:fixed max-sm:left-3 max-sm:right-3 max-sm:bottom-20 max-sm:w-auto config-panel-mobile"
    >
      {/* 面板头部 */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-700/50">
        <span className="text-sm font-medium text-zinc-200">生成配置</span>
        <button
          type="button"
          onClick={onClose}
          className="w-6 h-6 rounded-lg hover:bg-zinc-700/50 flex items-center justify-center transition-colors"
        >
          <X className="w-4 h-4 text-zinc-400" />
        </button>
      </div>

      {/* 面板内容 */}
      <div className="p-4 space-y-4">
        {/* 模型选择 */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-zinc-400 uppercase tracking-wide">
            模型
          </label>
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsModelDropdownOpen(!isModelDropdownOpen)}
              className="w-full px-3 py-2.5 bg-zinc-800/60 hover:bg-zinc-700/60 border border-zinc-700/50 
                         rounded-xl text-sm text-zinc-200 text-left flex items-center justify-between
                         transition-colors"
            >
              <span>{selectedModel?.name || '选择模型'}</span>
              <ChevronDown className={`w-4 h-4 text-zinc-400 transition-transform ${isModelDropdownOpen ? 'rotate-180' : ''}`} />
            </button>
            
            {/* 模型下拉列表 */}
            {isModelDropdownOpen && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-zinc-800/95 border border-zinc-700/50 
                              rounded-xl overflow-hidden z-10 animate-dropdown">
                {modelOptions.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => {
                      onModelChange(option.id);
                      setIsModelDropdownOpen(false);
                    }}
                    className={`w-full px-3 py-2.5 text-left text-sm transition-colors duration-150
                      ${model === option.id ? 'bg-violet-500/20 text-violet-300' : 'text-zinc-300 hover:bg-zinc-700/50'}`}
                  >
                    <div className="font-medium">{option.name}</div>
                    {option.description && (
                      <div className="text-xs text-zinc-500 mt-0.5">{option.description}</div>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 尺寸选择 - 仅当模型支持时显示 */}
        {supportsResolution && (
          <div className="space-y-2">
            <label className="text-xs font-medium text-zinc-400 uppercase tracking-wide">
              尺寸
            </label>
            <div className="flex gap-2">
              {sizeOptions.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => onImageSizeChange(option.id)}
                  className={`flex-1 px-3 py-2 rounded-xl text-sm font-medium transition-all
                    ${imageSize === option.id 
                      ? 'bg-violet-500/20 text-violet-300 border border-violet-500/30' 
                      : 'bg-zinc-800/60 text-zinc-400 border border-zinc-700/50 hover:bg-zinc-700/60 hover:text-zinc-300'}`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 宽高比选择 */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-zinc-400 uppercase tracking-wide">
            宽高比
          </label>
          <div className="grid grid-cols-4 gap-2">
            {aspectRatioOptions.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => onAspectRatioChange(option.id)}
                className={`px-2 py-1.5 rounded-lg text-xs font-medium transition-all
                  ${aspectRatio === option.id 
                    ? 'bg-violet-500/20 text-violet-300 border border-violet-500/30' 
                    : 'bg-zinc-800/60 text-zinc-400 border border-zinc-700/50 hover:bg-zinc-700/60 hover:text-zinc-300'}`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {/* 生成数量滑动条 */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-zinc-400 uppercase tracking-wide">
              生成数量
            </label>
            <span className="text-sm font-medium text-violet-400">{generateCount}</span>
          </div>
          <div className="relative">
            <input
              type="range"
              min={minCount}
              max={maxCount}
              value={generateCount}
              onChange={handleCountChange}
              className="w-full h-2 bg-zinc-700/50 rounded-full appearance-none cursor-pointer
                         [&::-webkit-slider-thumb]:appearance-none
                         [&::-webkit-slider-thumb]:w-4
                         [&::-webkit-slider-thumb]:h-4
                         [&::-webkit-slider-thumb]:rounded-full
                         [&::-webkit-slider-thumb]:bg-violet-500
                         [&::-webkit-slider-thumb]:shadow-lg
                         [&::-webkit-slider-thumb]:shadow-violet-500/30
                         [&::-webkit-slider-thumb]:cursor-pointer
                         [&::-webkit-slider-thumb]:transition-transform
                         [&::-webkit-slider-thumb]:hover:scale-110
                         [&::-moz-range-thumb]:w-4
                         [&::-moz-range-thumb]:h-4
                         [&::-moz-range-thumb]:rounded-full
                         [&::-moz-range-thumb]:bg-violet-500
                         [&::-moz-range-thumb]:border-0
                         [&::-moz-range-thumb]:cursor-pointer"
              style={{
                background: `linear-gradient(to right, rgb(139, 92, 246) 0%, rgb(139, 92, 246) ${((generateCount - minCount) / (maxCount - minCount)) * 100}%, rgba(63, 63, 70, 0.5) ${((generateCount - minCount) / (maxCount - minCount)) * 100}%, rgba(63, 63, 70, 0.5) 100%)`,
              }}
            />
            {/* 刻度标记 */}
            <div className="flex justify-between mt-1 px-0.5">
              {Array.from({ length: maxCount - minCount + 1 }, (_, i) => i + minCount).map((num) => (
                <span 
                  key={num} 
                  className={`text-xs ${generateCount === num ? 'text-violet-400' : 'text-zinc-600'}`}
                >
                  {num}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* 模型不支持分辨率时的提示 */}
        {!supportsResolution && (
          <div className="text-xs text-zinc-500 bg-zinc-800/40 rounded-lg px-3 py-2">
            💡 {selectedModel?.name} 使用固定分辨率，无需选择尺寸
          </div>
        )}
      </div>
    </div>
  );
};

export default ConfigPanel;

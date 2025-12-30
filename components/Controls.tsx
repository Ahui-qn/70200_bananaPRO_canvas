import React from 'react';
import { GenerationSettings, AppStatus, UploadedImage } from '../types';
import { Loader2, Sparkles, Image as ImageIcon, Settings2 } from 'lucide-react';
import { ImageUpload } from './ImageUpload';

interface ControlsProps {
  settings: GenerationSettings;
  setSettings: React.Dispatch<React.SetStateAction<GenerationSettings>>;
  onGenerate: () => void;
  status: AppStatus;
  canGenerate: boolean;
}

const ASPECT_RATIOS = [
  { label: '自动', value: 'auto' },
  { label: '1:1 正方形', value: '1:1' },
  { label: '16:9 横屏', value: '16:9' },
  { label: '9:16 竖屏', value: '9:16' },
  { label: '4:3 经典', value: '4:3' },
  { label: '3:4 纵向', value: '3:4' },
  { label: '3:2 相机', value: '3:2' },
  { label: '2:3 纵向相机', value: '2:3' },
  { label: '5:4 中画幅', value: '5:4' },
  { label: '4:5 纵向中画幅', value: '4:5' },
  { label: '21:9 超宽屏', value: '21:9' },
];

const IMAGE_SIZES = [
  { label: '1K (推荐)', value: '1K' },
  { label: '2K (高质量)', value: '2K' },
  { label: '4K (超高清)', value: '4K' },
];

const MODELS = [
  { label: 'Nano Banana Fast (快速)', value: 'nano-banana-fast' },
  { label: 'Nano Banana (标准)', value: 'nano-banana' },
  { label: 'Nano Banana Pro (专业)', value: 'nano-banana-pro' },
  { label: 'Nano Banana Pro VT (视觉增强)', value: 'nano-banana-pro-vt' },
  { label: 'Nano Banana Pro CL (经典)', value: 'nano-banana-pro-cl' },
  { label: 'Nano Banana Pro VIP (高级)', value: 'nano-banana-pro-vip' },
  { label: 'Nano Banana Pro 4K VIP (4K专用)', value: 'nano-banana-pro-4k-vip' },
];

export const Controls: React.FC<ControlsProps> = ({ settings, setSettings, onGenerate, status, canGenerate }) => {
  const isBusy = status === AppStatus.SUBMITTING || status === AppStatus.POLLING;

  const handleChange = (field: keyof GenerationSettings, value: string | UploadedImage[]) => {
    setSettings(prev => ({ 
      ...prev, 
      [field]: value 
    }));
  };

  return (
    <div className="w-[340px] max-h-[calc(100vh-140px)] flex flex-col bg-zinc-950/80 backdrop-blur-xl border border-zinc-800 rounded-3xl shadow-2xl overflow-hidden ring-1 ring-white/5">
      
      {/* Panel Header */}
      <div className="px-5 py-4 border-b border-zinc-800/50 flex items-center justify-between">
        <div className="flex items-center gap-2 text-zinc-100">
          <Settings2 className="w-4 h-4 text-zinc-400" />
          <span className="font-medium text-sm">生成设置</span>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-5 space-y-5 custom-scrollbar">
        
        {/* Prompt Input */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider ml-1">提示词</label>
          <div className="relative">
            <textarea
              value={settings.prompt}
              onChange={(e) => handleChange('prompt', e.target.value)}
              disabled={isBusy}
              placeholder="描述你想看到的画面..."
              className="w-full h-32 bg-zinc-900/50 border border-zinc-800 rounded-xl p-3 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent resize-none transition-all"
            />
            <div className="absolute bottom-2 right-2">
                <div className="w-5 h-5 rounded-md bg-zinc-800 border border-zinc-700 flex items-center justify-center text-[10px] text-zinc-500">
                    ↵
                </div>
            </div>
          </div>
        </div>

        {/* Model Selection */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider ml-1">模型</label>
          <div className="relative">
             <select
                value={settings.model}
                onChange={(e) => handleChange('model', e.target.value)}
                disabled={isBusy}
                className="w-full appearance-none bg-zinc-900/50 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm text-zinc-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
             >
                {MODELS.map(m => (
                <option key={m.value} value={m.value}>{m.label}</option>
                ))}
             </select>
             <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-500">
                <svg width="10" height="6" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
             </div>
          </div>
        </div>

        {/* Parameters Grid */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider ml-1">比例</label>
            <div className="relative">
                <select
                value={settings.aspectRatio}
                onChange={(e) => handleChange('aspectRatio', e.target.value)}
                disabled={isBusy}
                className="w-full appearance-none bg-zinc-900/50 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm text-zinc-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                >
                {ASPECT_RATIOS.map(ar => (
                    <option key={ar.value} value={ar.value}>{ar.label}</option>
                ))}
                </select>
            </div>
          </div>

          <div className="space-y-2">
             <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider ml-1">尺寸</label>
             <div className="relative">
                <select
                value={settings.imageSize}
                onChange={(e) => handleChange('imageSize', e.target.value)}
                disabled={isBusy}
                className="w-full appearance-none bg-zinc-900/50 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm text-zinc-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                >
                {IMAGE_SIZES.map(s => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                ))}
                </select>
            </div>
          </div>
        </div>

        {/* Reference Images */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider ml-1 flex items-center gap-1">
            <ImageIcon className="w-3 h-3" />
            参考图片
          </label>
          <ImageUpload
            images={settings.refImages}
            onImagesChange={(images) => handleChange('refImages', images)}
            maxImages={14}
            disabled={isBusy}
          />
        </div>

        {/* Legacy Reference Image URL (for backward compatibility) */}
        {settings.refImages.length === 0 && (
          <div className="space-y-2">
            <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider ml-1 flex items-center gap-1">
              参考图链接
              <span className="text-xs text-zinc-600">(或使用上方拖拽上传)</span>
            </label>
            <div className="flex items-center gap-2 bg-zinc-900/50 border border-zinc-800 rounded-xl px-3 py-2 focus-within:ring-2 focus-within:ring-blue-500/50 transition-all">
              <ImageIcon className="w-4 h-4 text-zinc-500 flex-shrink-0" />
              <input
                  type="url"
                  value={settings.refImageUrl}
                  onChange={(e) => handleChange('refImageUrl', e.target.value)}
                  disabled={isBusy}
                  placeholder="粘贴图片链接..."
                  className="w-full bg-transparent border-none text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none"
              />
            </div>
          </div>
        )}
      </div>

      {/* Action Footer */}
      <div className="p-5 border-t border-zinc-800/50 bg-zinc-900/30">
        <button
          onClick={onGenerate}
          disabled={isBusy || !canGenerate}
          className={`w-full py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 font-medium text-sm transition-all duration-300 shadow-lg ${
            isBusy || !canGenerate
              ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed shadow-none'
              : 'bg-gradient-to-r from-blue-600 to-violet-600 text-white hover:shadow-blue-500/25 active:scale-[0.98]'
          }`}
        >
          {isBusy ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>正在生成...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              <span>立即生成</span>
            </>
          )}
        </button>
        
        {/* Status Message */}
        {!canGenerate && !isBusy && (
          <div className="text-center mt-3">
            <p className="text-xs text-zinc-500">
              请先在右上角配置 API 密钥
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
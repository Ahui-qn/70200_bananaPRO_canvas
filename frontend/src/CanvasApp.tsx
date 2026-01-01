import { useState, useEffect, useRef, useCallback } from 'react';
import {
  AppStatus,
  GenerationSettings,
  ApiConfig,
  DatabaseConfig,
  OSSConfig,
  UploadedImage,
} from '../../shared/types';
import { apiService } from './services/api';
import { ApiConfigModal } from './components/ApiConfigModal';
import { DatabaseConfigModal } from './components/DatabaseConfigModal';
import { OSSConfigModal } from './components/OSSConfigModal';
import { ImageUpload } from './components/ImageUpload';
import { ImageLibraryPage } from './components/ImageLibraryPage';
import {
  Zap,
  Settings,
  Image as ImageIcon,
  Cloud,
  Database,
  Wand2,
  Download,
  Heart,
  Share2,
  Sparkles,
  Palette,
  FolderOpen,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  ChevronDown,
  Check,
  X,
  Trash2,
  Loader2,
} from 'lucide-react';

// 画布图片类型
interface CanvasImage {
  id: string;
  url: string;
  prompt: string;
  x: number;
  y: number;
  width: number;
  height: number;
  isPlaceholder?: boolean;
  progress?: number;
  refImages?: { url: string; id: string }[];  // 参考图片
  model?: string;
  aspectRatio?: string;
  imageSize?: string;
}

const DEFAULT_SETTINGS: GenerationSettings = {
  model: 'nano-banana-fast',
  prompt: '',
  aspectRatio: 'auto',
  imageSize: '1K',
  refImageUrl: '',
  refImages: [],
};


const DEFAULT_API_CONFIG: ApiConfig = {
  apiKey: '',
  baseUrl: 'https://grsai.dakka.com.cn/v1/draw',
  timeout: 300000,
  retryCount: 3,
  provider: 'Nano Banana',
};

// AI 模型选项
const AI_MODELS = [
  { value: 'nano-banana-fast', label: 'Nano Banana Fast', desc: '快速生成', badge: '快速' },
  { value: 'nano-banana', label: 'Nano Banana', desc: '标准模型' },
  { value: 'nano-banana-pro', label: 'Nano Banana Pro', desc: '专业版', badge: 'Pro' },
  { value: 'nano-banana-pro-vt', label: 'Nano Banana Pro VT', desc: '视觉增强', badge: 'VT' },
  { value: 'nano-banana-pro-cl', label: 'Nano Banana Pro CL', desc: '色彩优化', badge: 'CL' },
  { value: 'nano-banana-pro-vip', label: 'Nano Banana Pro VIP', desc: 'VIP专属', badge: 'VIP' },
  { value: 'nano-banana-pro-4k-vip', label: 'Nano Banana Pro 4K VIP', desc: '4K超清', badge: '4K' },
];

// 宽高比选项
const ASPECT_RATIOS = [
  { value: 'auto', label: '自动', w: 1, h: 1 },
  { value: '1:1', label: '1:1', w: 1, h: 1 },
  { value: '4:3', label: '4:3', w: 4, h: 3 },
  { value: '3:4', label: '3:4', w: 3, h: 4 },
  { value: '16:9', label: '16:9', w: 16, h: 9 },
  { value: '9:16', label: '9:16', w: 9, h: 16 },
  { value: '3:2', label: '3:2', w: 3, h: 2 },
  { value: '2:3', label: '2:3', w: 2, h: 3 },
  { value: '21:9', label: '21:9', w: 21, h: 9 },
];

// 宽高比图标组件
const AspectRatioIcon: React.FC<{ w: number; h: number; isAuto?: boolean }> = ({ w, h, isAuto }) => {
  const maxSize = 16;
  const ratio = maxSize / Math.max(w, h);
  const width = Math.round(w * ratio);
  const height = Math.round(h * ratio);
  
  if (isAuto) {
    return (
      <div className="w-4 h-4 flex items-center justify-center">
        <div className="w-3 h-3 border border-current rounded-sm flex items-center justify-center">
          <span className="text-[6px] font-bold">A</span>
        </div>
      </div>
    );
  }
  
  return (
    <div className="w-4 h-4 flex items-center justify-center">
      <div className="border border-current rounded-[2px]" style={{ width: `${width}px`, height: `${height}px` }} />
    </div>
  );
};


// 自定义模型选择下拉框组件
interface ModelSelectProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

const ModelSelect: React.FC<ModelSelectProps> = ({ value, onChange, disabled }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const selectedModel = AI_MODELS.find(m => m.value === value) || AI_MODELS[0];
  
  // 点击外部关闭下拉框
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside as any);
    }
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside as any);
    };
  }, [isOpen]);
  
  return (
    <div ref={dropdownRef} className="relative">
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className="select-glass w-full px-3.5 py-2.5 rounded-xl text-zinc-100 text-sm flex items-center justify-between gap-2 disabled:opacity-50"
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="truncate">{selectedModel.label}</span>
          {selectedModel.badge && (
            <span className="px-1.5 py-0.5 text-[10px] font-medium bg-violet-500/20 text-violet-400 rounded">
              {selectedModel.badge}
            </span>
          )}
        </div>
        <ChevronDown className={`w-4 h-4 text-zinc-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 glass-card rounded-xl overflow-hidden z-50 animate-fade-in">
          <div className="py-1 max-h-64 overflow-y-auto">
            {AI_MODELS.map((model) => (
              <button
                key={model.value}
                onClick={() => { onChange(model.value); setIsOpen(false); }}
                className={`w-full px-3.5 py-2.5 flex items-center justify-between gap-2 hover:bg-zinc-700/50 transition-colors ${value === model.value ? 'bg-violet-500/10' : ''}`}
              >
                <div className="flex flex-col items-start min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-zinc-100">{model.label}</span>
                    {model.badge && (
                      <span className="px-1.5 py-0.5 text-[10px] font-medium bg-violet-500/20 text-violet-400 rounded">{model.badge}</span>
                    )}
                  </div>
                  {model.desc && <span className="text-xs text-zinc-500">{model.desc}</span>}
                </div>
                {value === model.value && <Check className="w-4 h-4 text-violet-400 flex-shrink-0" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};


// 计算不重叠的位置
const findNonOverlappingPosition = (existingImages: CanvasImage[], newWidth: number, newHeight: number): { x: number; y: number } => {
  const padding = 20;
  const startX = 100;
  const startY = 100;
  
  if (existingImages.length === 0) {
    return { x: startX, y: startY };
  }
  
  // 尝试在现有图片右侧或下方找位置
  let bestX = startX;
  let bestY = startY;
  let found = false;
  
  // 按行排列
  const rowHeight = 450;
  const colWidth = 450;
  const maxCols = 4;
  
  for (let row = 0; row < 10 && !found; row++) {
    for (let col = 0; col < maxCols && !found; col++) {
      const testX = startX + col * colWidth;
      const testY = startY + row * rowHeight;
      
      // 检查是否与现有图片重叠
      const overlaps = existingImages.some(img => {
        const imgRight = img.x + (img.width || 400);
        const imgBottom = img.y + (img.height || 400);
        const testRight = testX + newWidth;
        const testBottom = testY + newHeight;
        
        return !(testX >= imgRight + padding || testRight <= img.x - padding ||
                 testY >= imgBottom + padding || testBottom <= img.y - padding);
      });
      
      if (!overlaps) {
        bestX = testX;
        bestY = testY;
        found = true;
      }
    }
  }
  
  return { x: bestX, y: bestY };
};

function CanvasApp() {
  const [_status, setStatus] = useState<AppStatus>(AppStatus.IDLE);
  const [settings, setSettings] = useState<GenerationSettings>(DEFAULT_SETTINGS);
  const [apiConfig, setApiConfig] = useState<ApiConfig>(DEFAULT_API_CONFIG);
  const [_databaseConfig, setDatabaseConfig] = useState<DatabaseConfig | null>(null);
  const [_ossConfig, setOssConfig] = useState<OSSConfig | null>(null);

  // 模态框状态
  const [showApiConfig, setShowApiConfig] = useState(false);
  const [showDatabaseConfig, setShowDatabaseConfig] = useState(false);
  const [showOSSConfig, setShowOSSConfig] = useState(false);
  const [showImageLibrary, setShowImageLibrary] = useState(false);

  // 连接状态
  const [backendConnected, setBackendConnected] = useState(false);
  const [databaseConnected, setDatabaseConnected] = useState(false);
  const [ossConnected, setOssConnected] = useState(false);
  const [loading, setLoading] = useState(true);

  // 生成状态
  const [canvasImages, setCanvasImages] = useState<CanvasImage[]>([]);
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showImageDetail, setShowImageDetail] = useState<CanvasImage | null>(null);

  // 画布缩放和拖拽状态
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [dragTarget, setDragTarget] = useState<'canvas' | string>('canvas');
  const canvasRef = useRef<HTMLDivElement>(null);
  
  // 用 ref 追踪当前值，以便在事件处理器中获取最新值
  const scaleRef = useRef(scale);
  const positionRef = useRef(position);
  
  useEffect(() => {
    scaleRef.current = scale;
  }, [scale]);
  
  useEffect(() => {
    positionRef.current = position;
  }, [position]);


  // 初始化应用
  useEffect(() => {
    initializeApp();
  }, []);

  // 滚轮缩放 - 以鼠标位置为中心缩放
  useEffect(() => {
    const canvasElement = canvasRef.current;
    if (!canvasElement) return;

    const handleWheelZoom = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
      
      const rect = canvasElement.getBoundingClientRect();
      // 鼠标相对于画布容器的位置
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      
      const oldScale = scaleRef.current;
      const oldPosition = positionRef.current;
      
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      const newScale = Math.min(Math.max(0.1, oldScale + delta), 3);
      
      if (newScale === oldScale) return;
      
      // 计算鼠标在画布内容坐标系中的位置
      const mouseCanvasX = (mouseX - oldPosition.x) / oldScale;
      const mouseCanvasY = (mouseY - oldPosition.y) / oldScale;
      
      // 计算新的位置，使鼠标指向的点保持不变
      const newX = mouseX - mouseCanvasX * newScale;
      const newY = mouseY - mouseCanvasY * newScale;
      
      setScale(newScale);
      setPosition({ x: newX, y: newY });
    };

    canvasElement.addEventListener('wheel', handleWheelZoom, { passive: false });
        return () => {
      canvasElement.removeEventListener('wheel', handleWheelZoom);
    };
  }, [loading, showImageLibrary]); // 当 loading 或 showImageLibrary 状态变化时重新绑定事件

  const initializeApp = async () => {
    try {
      setLoading(true);
      const healthResponse = await apiService.healthCheck();
      setBackendConnected(healthResponse.success);

      if (healthResponse.success) {
        await loadConfigs();
        await checkConnectionStatus();
      }
    } catch (error: any) {
      console.error('应用初始化失败:', error);
      setBackendConnected(false);
    } finally {
      setLoading(false);
    }
  };

  const loadConfigs = async () => {
    try {
      const apiResponse = await apiService.getApiConfig();
      if (apiResponse.success && apiResponse.data) {
        setApiConfig(apiResponse.data);
      }
    } catch (error) {
      console.warn('加载配置失败:', error);
    }
  };

  const checkConnectionStatus = async () => {
    try {
      const dbResponse = await apiService.getDatabaseStatus();
      if (dbResponse.success && dbResponse.data) {
        setDatabaseConnected(dbResponse.data.isConnected || false);
      }
      
      const ossResponse = await apiService.getOSSStatus();
      if (ossResponse.success && ossResponse.data) {
        setOssConnected(ossResponse.data.isConnected || false);
      }
    } catch (error) {
      console.warn('检查连接状态失败:', error);
    }
  };

  const handleImagesChange = (images: UploadedImage[]) => {
    setSettings(prev => ({ ...prev, refImages: images }));
  };

  const handleZoom = useCallback((delta: number) => {
    setScale(prev => Math.min(Math.max(0.1, prev + delta), 3));
  }, []);

  const handleResetView = useCallback(() => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  }, []);


  // 画布/图片拖拽
  const handleMouseDown = useCallback((e: React.MouseEvent, target: 'canvas' | string = 'canvas') => {
    if (e.button === 0) {
      e.stopPropagation();
      setIsDragging(true);
      setDragTarget(target);
      
      if (target === 'canvas') {
        setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
        setSelectedImageId(null);
      } else {
        const img = canvasImages.find(i => i.id === target);
        if (img) {
          setDragStart({ x: e.clientX - img.x, y: e.clientY - img.y });
          setSelectedImageId(target);
        }
      }
    }
  }, [position, canvasImages]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging) return;
    
    if (dragTarget === 'canvas') {
      setPosition({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
    } else {
      setCanvasImages(prev => prev.map(img => 
        img.id === dragTarget ? { ...img, x: e.clientX - dragStart.x, y: e.clientY - dragStart.y } : img
      ));
    }
  }, [isDragging, dragTarget, dragStart]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleDeleteImage = useCallback((id: string) => {
    setCanvasImages(prev => prev.filter(img => img.id !== id));
    if (selectedImageId === id) setSelectedImageId(null);
  }, [selectedImageId]);

  // 生成图片
  const handleGenerate = async () => {
    if (!settings.prompt.trim()) {
      alert('请输入提示词');
      return;
    }

    const placeholderId = `placeholder-${Date.now()}`;
    
    try {
      setIsGenerating(true);
      setStatus(AppStatus.SUBMITTING);

      // 创建占位符
      const placeholderPos = findNonOverlappingPosition(canvasImages, 400, 400);
      const placeholder: CanvasImage = {
        id: placeholderId,
        url: '',
        prompt: settings.prompt,
        x: placeholderPos.x,
        y: placeholderPos.y,
        width: 400,
        height: 400,
        isPlaceholder: true,
        progress: 0,
      };
      setCanvasImages(prev => [...prev, placeholder]);

      const createResponse = await apiService.generateImage({
        prompt: settings.prompt,
        model: settings.model,
        aspectRatio: settings.aspectRatio,
        imageSize: settings.imageSize,
        refImages: settings.refImages?.map(img => img.base64 || img.preview),
      });

      if (!createResponse.success) {
        throw new Error(createResponse.error || '创建生成任务失败');
      }

      const taskId = createResponse.data?.taskId;
      if (!taskId) throw new Error('未获取到任务ID');

      let attempts = 0;
      const maxAttempts = 60;

      while (attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 3000));
        const statusResponse = await apiService.getGenerationStatus(taskId);

        if (statusResponse.success && statusResponse.data) {
          const { status: taskStatus, results, progress } = statusResponse.data;

          // 更新占位符进度
          setCanvasImages(prev => prev.map(img => 
            img.id === placeholderId ? { ...img, progress: progress || 0 } : img
          ));

          if (taskStatus === 'succeeded' && results?.length > 0) {
            const imageUrl = results[0].url;
            
            // 替换占位符为真实图片，保存参考图片信息
            setCanvasImages(prev => prev.map(img => 
              img.id === placeholderId ? { 
                ...img, 
                url: imageUrl, 
                isPlaceholder: false, 
                progress: undefined,
                model: settings.model,
                aspectRatio: settings.aspectRatio,
                imageSize: settings.imageSize,
                // 保存参考图片的预览 URL（用于展示）
                refImages: settings.refImages?.map((refImg, index) => ({
                  url: refImg.preview || refImg.base64 || '',
                  id: `local_ref_${index}`
                }))
              } : img
            ));
            setSelectedImageId(placeholderId);
            setStatus(AppStatus.SUCCESS);

            if (databaseConnected) {
              try {
                const saveResponse = await apiService.saveGeneratedImage(taskId, {
                  imageUrl,
                  prompt: settings.prompt,
                  model: settings.model,
                  aspectRatio: settings.aspectRatio,
                  imageSize: settings.imageSize,
                  refImages: settings.refImages,
                });
                
                // 如果保存成功且返回了处理后的参考图片 URL，更新画布图片
                if (saveResponse.success && saveResponse.data?.refImages) {
                  setCanvasImages(prev => prev.map(img => 
                    img.id === placeholderId ? { 
                      ...img, 
                      refImages: saveResponse.data.refImages 
                    } : img
                  ));
                }
              } catch (saveError) {
                console.warn('保存图片到数据库失败:', saveError);
              }
            }
            return;
          } else if (taskStatus === 'failed') {
            throw new Error('图片生成失败');
          }
        }
        attempts++;
      }
      throw new Error('生成超时，请重试');
    } catch (error: any) {
      console.error('图片生成失败:', error);
      setStatus(AppStatus.ERROR);
      // 移除占位符
      setCanvasImages(prev => prev.filter(img => img.id !== placeholderId));
      alert('图片生成失败: ' + error.message);
    } finally {
      setIsGenerating(false);
    }
  };


  const getStatusIndicator = () => {
    if (!backendConnected) return { color: 'bg-red-500', text: '服务离线', pulse: false };
    if (!apiConfig.apiKey) return { color: 'bg-amber-500', text: '需要配置 API', pulse: false };
    return { color: 'bg-emerald-500', text: '就绪', pulse: true };
  };

  const statusIndicator = getStatusIndicator();
  const gridSize = 24 * scale;

  // 显示图片库页面
  if (showImageLibrary) {
    return (
      <ImageLibraryPage
        onBack={() => setShowImageLibrary(false)}
        onSelectImage={(url) => {
          const pos = findNonOverlappingPosition(canvasImages, 400, 400);
          const newImage: CanvasImage = {
            id: `img-${Date.now()}`,
            url,
            prompt: '从图片库导入',
            x: pos.x,
            y: pos.y,
            width: 400,
            height: 400,
          };
          setCanvasImages(prev => [...prev, newImage]);
          setShowImageLibrary(false);
        }}
      />
    );
  }

  if (loading) {
    return (
      <div className="w-screen h-screen bg-[#09090b] dot-matrix-bg flex items-center justify-center">
        <div className="glass-card rounded-2xl p-8 text-center animate-fade-in">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center">
            <Zap className="w-8 h-8 text-white animate-pulse" />
          </div>
          <p className="text-zinc-300 font-medium">正在初始化画布...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-screen h-screen bg-[#0a0a0b] overflow-hidden text-zinc-100 font-sans">
      {/* 顶部导航栏 */}
      <header className="absolute top-0 left-0 right-0 z-50 px-6 py-4">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-4">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-500/20">
              <Zap className="w-6 h-6 text-white" fill="currentColor" />
            </div>
            <div>
              <h1 className="font-semibold text-lg tracking-tight text-zinc-100">Nano Banana AI</h1>
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${statusIndicator.color} ${statusIndicator.pulse ? 'status-online' : ''}`} />
                <span className="text-xs text-zinc-500">{statusIndicator.text}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button onClick={() => setShowImageLibrary(true)} className="btn-glass flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm text-zinc-300 hover:text-zinc-100">
              <FolderOpen className="w-4 h-4" />
              <span>图片库</span>
            </button>

            <button onClick={() => setShowDatabaseConfig(true)} className={`btn-glass flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm transition-all ${databaseConnected ? 'text-emerald-400 border-emerald-500/30' : 'text-zinc-300 hover:text-zinc-100'}`}>
              <Database className="w-4 h-4" />
              <span>数据库</span>
              {databaseConnected && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />}
            </button>

            <button onClick={() => setShowOSSConfig(true)} className={`btn-glass flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm transition-all ${ossConnected ? 'text-emerald-400 border-emerald-500/30' : 'text-zinc-300 hover:text-zinc-100'}`}>
              <Cloud className="w-4 h-4" />
              <span>云存储</span>
              {ossConnected && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />}
            </button>

            <button onClick={() => setShowApiConfig(true)} className={`btn-glass flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm transition-all ${apiConfig.apiKey ? 'text-emerald-400 border-emerald-500/30' : 'text-zinc-300 hover:text-zinc-100'}`}>
              <Settings className="w-4 h-4" />
              <span>API</span>
              {apiConfig.apiKey && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />}
            </button>
          </div>
        </div>
      </header>


      {/* 主要内容区域 */}
      <div className="flex h-full pt-20">
        {/* 左侧控制面板 */}
        <aside className="w-80 glass border-r border-zinc-800/50 p-5 overflow-y-auto z-10">
          <div className="space-y-5">
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-zinc-300 mb-2.5">
                <Palette className="w-4 h-4 text-violet-400" />
                AI 模型
              </label>
              <ModelSelect value={settings.model} onChange={(value) => setSettings(prev => ({ ...prev, model: value }))} disabled={isGenerating} />
            </div>

            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-zinc-300 mb-2.5">
                <Sparkles className="w-4 h-4 text-violet-400" />
                提示词
              </label>
              <textarea
                value={settings.prompt}
                onChange={(e) => setSettings(prev => ({ ...prev, prompt: e.target.value }))}
                placeholder="描述您想要生成的图片..."
                rows={4}
                className="input-glass w-full px-3.5 py-2.5 rounded-xl text-zinc-100 placeholder-zinc-500 text-sm resize-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2.5">图片尺寸</label>
              <div className="flex gap-2">
                {['1K', '2K', '4K'].map((size) => (
                  <button key={size} onClick={() => setSettings(prev => ({ ...prev, imageSize: size }))} className={`tag-btn flex-1 px-3 py-2 rounded-lg text-sm font-medium ${settings.imageSize === size ? 'active' : ''}`}>
                    {size}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2.5">宽高比</label>
              <div className="grid grid-cols-3 gap-2">
                {ASPECT_RATIOS.map((ratio) => (
                  <button key={ratio.value} onClick={() => setSettings(prev => ({ ...prev, aspectRatio: ratio.value }))} className={`tag-btn px-2 py-2 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 ${settings.aspectRatio === ratio.value ? 'active' : ''}`}>
                    <AspectRatioIcon w={ratio.w} h={ratio.h} isAuto={ratio.value === 'auto'} />
                    <span>{ratio.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-zinc-300 mb-2.5">
                <ImageIcon className="w-4 h-4 text-violet-400" />
                参考图片
              </label>
              <ImageUpload images={settings.refImages || []} onImagesChange={handleImagesChange} maxImages={14} disabled={isGenerating} />
            </div>

            <button onClick={handleGenerate} disabled={isGenerating || !settings.prompt.trim()} className="btn-primary w-full flex items-center justify-center gap-2 px-4 py-3.5 rounded-xl text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed">
              {isGenerating ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>生成中...</span>
                </>
              ) : (
                <>
                  <Wand2 className="w-5 h-5" />
                  <span>生成图片</span>
                </>
              )}
            </button>

            {canvasImages.filter(img => !img.isPlaceholder).length > 0 && (
              <div className="text-xs text-zinc-500 text-center">画布上有 {canvasImages.filter(img => !img.isPlaceholder).length} 张图片</div>
            )}
          </div>
        </aside>


        {/* 右侧画布区域 */}
        <main ref={canvasRef} className="flex-1 relative canvas-container" onMouseDown={(e) => handleMouseDown(e, 'canvas')} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}>
          {/* 点矩阵背景 */}
          <div className="absolute inset-0 opacity-40 pointer-events-none" style={{
            backgroundImage: `radial-gradient(circle, rgba(180, 180, 233, 0.62) 1px, transparent 1px)`,
            backgroundSize: `${gridSize}px ${gridSize}px`,
            backgroundPosition: `${position.x % gridSize}px ${position.y % gridSize}px`,
          }} />

          {/* 画布内容 */}
          <div className="canvas-content absolute inset-0" style={{ transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`, transformOrigin: '0 0' }}>
            {canvasImages.length > 0 ? (
              canvasImages.map((img) => (
                <div key={img.id} className={`absolute cursor-move group ${selectedImageId === img.id ? 'ring-2 ring-violet-500 ring-offset-2 ring-offset-transparent' : ''}`} style={{ left: img.x, top: img.y }} onMouseDown={(e) => { e.stopPropagation(); handleMouseDown(e, img.id); }} onDoubleClick={(e) => { e.stopPropagation(); if (!img.isPlaceholder) setShowImageDetail(img); }}>
                  {img.isPlaceholder ? (
                    // 占位符
                    <div className="w-[400px] h-[400px] glass-card rounded-xl flex flex-col items-center justify-center gap-4">
                      <Loader2 className="w-12 h-12 text-violet-400 animate-spin" />
                      <div className="text-center">
                        <p className="text-sm text-zinc-300 mb-2">正在生成...</p>
                        <div className="w-48 h-2 bg-zinc-700 rounded-full overflow-hidden">
                          <div className="h-full bg-gradient-to-r from-violet-500 to-indigo-500 transition-all duration-300" style={{ width: `${img.progress || 0}%` }} />
                        </div>
                        <p className="text-xs text-zinc-500 mt-1">{img.progress || 0}%</p>
                      </div>
                      <p className="text-xs text-zinc-500 max-w-[300px] truncate px-4">{img.prompt}</p>
                    </div>
                  ) : (
                    // 真实图片
                    <>
                      <img src={img.url} alt={img.prompt} className="max-w-[400px] max-h-[400px] rounded-xl shadow-2xl shadow-black/50" draggable={false} />
                      <div className="absolute top-2 right-2 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button className="btn-glass p-2 rounded-lg" onClick={(e) => { e.stopPropagation(); }}>
                          <Heart className="w-3.5 h-3.5 text-zinc-300" />
                        </button>
                        <button className="btn-glass p-2 rounded-lg" onClick={(e) => { e.stopPropagation(); const link = document.createElement('a'); link.href = img.url; link.download = `nano-banana-${img.id}.png`; link.click(); }}>
                          <Download className="w-3.5 h-3.5 text-zinc-300" />
                        </button>
                        <button className="btn-glass p-2 rounded-lg" onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(img.url); }}>
                          <Share2 className="w-3.5 h-3.5 text-zinc-300" />
                        </button>
                        <button className="btn-glass p-2 rounded-lg hover:bg-red-500/20" onClick={(e) => { e.stopPropagation(); handleDeleteImage(img.id); }}>
                          <X className="w-3.5 h-3.5 text-zinc-300" />
                        </button>
                      </div>
                      <div className="absolute bottom-2 left-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="glass-subtle px-2 py-1 rounded-lg">
                          <p className="text-xs text-zinc-300 truncate">{img.prompt}</p>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              ))
            ) : (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none">
                <div className="text-center">
                  <div className="w-24 h-24 glass-card rounded-3xl flex items-center justify-center mb-6 mx-auto">
                    <ImageIcon className="w-12 h-12 text-zinc-600" />
                  </div>
                  <h2 className="text-2xl font-semibold text-zinc-300 mb-2">开始创作</h2>
                  <p className="text-zinc-500 mb-6 max-w-xs">在左侧输入提示词，点击生成按钮开始创作</p>
                  {!apiConfig.apiKey && (
                    <button onClick={() => setShowApiConfig(true)} className="btn-primary px-6 py-3 rounded-xl font-medium pointer-events-auto">配置 API Key</button>
                  )}
                </div>
              </div>
            )}
          </div>


          {/* 缩放控制器 */}
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 zoom-controls">
            <button onClick={() => handleZoom(-0.1)} className="zoom-btn"><ZoomOut className="w-4 h-4" /></button>
            <input type="range" min="0.1" max="3" step="0.1" value={scale} onChange={(e) => setScale(parseFloat(e.target.value))} className="zoom-slider" />
            <button onClick={() => handleZoom(0.1)} className="zoom-btn"><ZoomIn className="w-4 h-4" /></button>
            <div className="w-px h-5 bg-zinc-700" />
            <button onClick={handleResetView} className="zoom-btn" title="重置视图"><RotateCcw className="w-4 h-4" /></button>
            <span className="text-xs text-zinc-500 min-w-[40px] text-center">{Math.round(scale * 100)}%</span>
          </div>

          {/* 清空画布按钮 */}
          {canvasImages.filter(img => !img.isPlaceholder).length > 0 && (
            <button onClick={() => setCanvasImages(prev => prev.filter(img => img.isPlaceholder))} className="absolute bottom-6 right-6 btn-glass flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-zinc-400 hover:text-red-400">
              <Trash2 className="w-4 h-4" />
              <span>清空画布</span>
            </button>
          )}
        </main>
      </div>

      {/* 图片详情弹窗 */}
      {showImageDetail && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => setShowImageDetail(null)}>
          <div className="glass-card rounded-2xl p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto animate-fade-in" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-zinc-100">图片详情</h3>
              <button onClick={() => setShowImageDetail(null)} className="btn-glass p-2 rounded-lg">
                <X className="w-4 h-4 text-zinc-400" />
              </button>
            </div>
            
            {/* 主图片 */}
            <div className="rounded-xl overflow-hidden mb-4">
              <img src={showImageDetail.url} alt={showImageDetail.prompt} className="w-full" />
            </div>
            
            {/* 提示词 */}
            <div className="mb-4">
              <label className="flex items-center gap-2 text-xs text-zinc-500 mb-2">
                <Sparkles className="w-3.5 h-3.5" />
                提示词
              </label>
              <p className="text-sm text-zinc-300 leading-relaxed bg-zinc-800/50 rounded-lg p-3">
                {showImageDetail.prompt || '无'}
              </p>
            </div>
            
            {/* 详细信息 */}
            <div className="grid grid-cols-3 gap-3 mb-4">
              {showImageDetail.model && (
                <div className="glass-subtle rounded-xl p-3">
                  <label className="text-xs text-zinc-500 block mb-1">模型</label>
                  <p className="text-sm text-zinc-200 font-medium">{showImageDetail.model}</p>
                </div>
              )}
              {showImageDetail.imageSize && (
                <div className="glass-subtle rounded-xl p-3">
                  <label className="text-xs text-zinc-500 block mb-1">尺寸</label>
                  <p className="text-sm text-zinc-200 font-medium">{showImageDetail.imageSize}</p>
                </div>
              )}
              {showImageDetail.aspectRatio && (
                <div className="glass-subtle rounded-xl p-3">
                  <label className="text-xs text-zinc-500 block mb-1">宽高比</label>
                  <p className="text-sm text-zinc-200 font-medium">{showImageDetail.aspectRatio}</p>
                </div>
              )}
            </div>
            
            {/* 参考图片 */}
            {showImageDetail.refImages && showImageDetail.refImages.length > 0 && (
              <div>
                <label className="flex items-center gap-2 text-xs text-zinc-500 mb-2">
                  <ImageIcon className="w-3.5 h-3.5" />
                  参考图片 ({showImageDetail.refImages.length})
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {showImageDetail.refImages.map((refImg, index) => (
                    <div key={refImg.id || index} className="relative group rounded-lg overflow-hidden">
                      <img
                        src={refImg.url}
                        alt={`参考图片 ${index + 1}`}
                        className="w-full aspect-square object-cover"
                        loading="lazy"
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <span className="text-xs text-white">#{index + 1}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* 操作按钮 */}
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => { const link = document.createElement('a'); link.href = showImageDetail.url; link.download = `nano-banana-${showImageDetail.id}.png`; link.click(); }}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 btn-glass rounded-xl text-sm font-medium text-zinc-300"
              >
                <Download className="w-4 h-4" />
                下载
              </button>
              <button
                onClick={() => { navigator.clipboard.writeText(showImageDetail.url); }}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 btn-glass rounded-xl text-sm font-medium text-zinc-300"
              >
                <Share2 className="w-4 h-4" />
                复制链接
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 配置模态框 */}
      <ApiConfigModal isOpen={showApiConfig} onClose={() => setShowApiConfig(false)} onConfigSaved={(config) => { setApiConfig(config); setShowApiConfig(false); }} />
      <DatabaseConfigModal isOpen={showDatabaseConfig} onClose={() => setShowDatabaseConfig(false)} onConfigSaved={(config) => { setDatabaseConfig(config); setDatabaseConnected(config.enabled); setShowDatabaseConfig(false); }} />
      <OSSConfigModal isOpen={showOSSConfig} onClose={() => setShowOSSConfig(false)} onConfigSaved={(config) => { setOssConfig(config); setOssConnected(config.enabled); setShowOSSConfig(false); }} />
    </div>
  );
}

export default CanvasApp;
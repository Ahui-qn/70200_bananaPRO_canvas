import { useState, useEffect, useRef, useCallback } from 'react';
import {
  AppStatus,
  GenerationSettings,
  ApiConfig,
  DatabaseConfig,
  OSSConfig,
  UploadedImage,
  CanvasImage as CanvasImageType,
  Viewport,
  CanvasState,
} from '../../shared/types';
import { apiService } from './services/api';
import { ApiConfigModal } from './components/ApiConfigModal';
import { DatabaseConfigModal } from './components/DatabaseConfigModal';
import { OSSConfigModal } from './components/OSSConfigModal';
import { ImageUpload } from './components/ImageUpload';
import { ImageLibraryPage } from './components/ImageLibraryPage';
import { ImagePreviewModal } from './components/ImagePreviewModal';
import { useAuth, getAuthToken } from './contexts/AuthContext';
import { ProjectProvider, useProject } from './contexts/ProjectContext';
import ProjectSwitcher from './components/ProjectSwitcher';
import TrashBin from './components/TrashBin';
import { useCanvasImages } from './hooks/useCanvasImages';
import { CanvasImageLayer } from './components/CanvasImageLayer';
import { imageLoadingManager } from './services/imageLoadingManager';
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
  LogOut,
  User,
  Crosshair,
} from 'lucide-react';

// 画布图片类型（本地使用，与共享类型兼容）
interface LocalCanvasImage {
  id: string;
  url: string;
  prompt: string;
  x: number;
  y: number;
  width: number;
  height: number;
  isPlaceholder?: boolean;
  progress?: number;
  refImages?: { url: string; id: string }[];  // 参考图片（简化格式）
  model?: string;
  aspectRatio?: string;
  imageSize?: string;
  canvasX?: number;
  canvasY?: number;
  thumbnailUrl?: string;
  loadingState?: 'placeholder' | 'thumbnail' | 'loading' | 'loaded';
  isVisible?: boolean;
  favorite?: boolean;
  createdAt?: Date;
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


// 使用 useCanvasImages Hook 中的 findNonOverlappingPosition 函数
// 此处保留一个本地版本用于占位符计算（不需要持久化的场景）
// 批量生成时，新占位符会按顺序排列成一排
const findLocalNonOverlappingPosition = (existingImages: LocalCanvasImage[], newWidth: number, newHeight: number): { x: number; y: number } => {
  const padding = 10; // 图片之间的间距（减小间距）
  const startX = 100;
  const startY = 100;
  const maxCols = 6; // 每行最多6张图片
  
  // 计算当前图片数量，直接按顺序排列
  const index = existingImages.length;
  const col = index % maxCols;
  const row = Math.floor(index / maxCols);
  
  return { 
    x: startX + col * (newWidth + padding), 
    y: startY + row * (newHeight + padding) 
  };
};

function CanvasApp() {
  const { user, logout } = useAuth();
  const { currentProject } = useProject();  // 获取当前项目（需求 4.1）
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
  const [showTrashBin, setShowTrashBin] = useState(false);
  const [previewImage, setPreviewImage] = useState<CanvasImageType | null>(null);

  // 连接状态
  const [backendConnected, setBackendConnected] = useState(false);
  const [databaseConnected, setDatabaseConnected] = useState(false);
  const [ossConnected, setOssConnected] = useState(false);
  const [loading, setLoading] = useState(true);

  // 使用 useCanvasImages Hook 管理画布图片（需求 1.1, 1.4）
  const {
    images: persistedImages,
    isLoading: isLoadingImages,
    error: imagesError,
    canvasState,
    loadProjectImages,
    updateImagePosition,
    savePendingPositions,
    getPendingUpdates,
    addNewImage,
    removeImage,
    saveCanvasState,
    clearImages,
    getVisibleImages: getVisibleImagesFromHook,
  } = useCanvasImages();

  // 本地画布图片状态（包含占位符等临时图片）
  const [localCanvasImages, setLocalCanvasImages] = useState<LocalCanvasImage[]>([]);
  
  // 合并持久化图片和本地图片
  const canvasImages: LocalCanvasImage[] = [
    ...persistedImages.map(img => ({
      id: img.id,
      url: img.url,
      prompt: img.prompt,
      x: img.canvasX ?? (img as any).x ?? 0,
      y: img.canvasY ?? (img as any).y ?? 0,
      width: img.width || 400,
      height: img.height || 400,
      canvasX: img.canvasX,
      canvasY: img.canvasY,
      model: img.model,
      aspectRatio: img.aspectRatio,
      imageSize: img.imageSize,
      thumbnailUrl: img.thumbnailUrl,
      loadingState: img.loadingState,
      isVisible: img.isVisible,
      favorite: img.favorite,
      createdAt: img.createdAt,
      // 转换参考图片格式
      refImages: img.refImages?.map((ref, idx) => ({
        url: (ref as any).url || (ref as any).preview || '',
        id: (ref as any).id || `ref_${idx}`,
      })),
    })),
    ...localCanvasImages.filter(img => img.isPlaceholder), // 只保留占位符
  ];

  const [selectedImageId, setSelectedImageId] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateCount, setGenerateCount] = useState(1); // 批量生成数量（1-6）
  const [showImageDetail, setShowImageDetail] = useState<LocalCanvasImage | null>(null);

  // 画布缩放和拖拽状态
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [dragTarget, setDragTarget] = useState<'canvas' | string>('canvas');
  const canvasRef = useRef<HTMLDivElement>(null);
  
  // 是否显示「定位到最新」按钮（需求 7.3）
  const [showLocateLatest, setShowLocateLatest] = useState(false);
  
  // 视口状态是否已恢复
  const [viewportRestored, setViewportRestored] = useState(false);
  
  // 双击放大状态（需求 6.1, 6.2, 6.3, 6.4）
  const [zoomState, setZoomState] = useState<{
    isZoomedIn: boolean;
    previousPosition: { x: number; y: number };
    previousScale: number;
    targetImageId: string | null;
  }>({
    isZoomedIn: false,
    previousPosition: { x: 0, y: 0 },
    previousScale: 1,
    targetImageId: null,
  });
  
  // 用 ref 追踪当前值，以便在事件处理器中获取最新值
  const scaleRef = useRef(scale);
  const positionRef = useRef(position);
  
  useEffect(() => {
    scaleRef.current = scale;
  }, [scale]);
  
  useEffect(() => {
    positionRef.current = position;
  }, [position]);

  // 项目切换时加载对应图片（需求 1.1, 1.4）
  useEffect(() => {
    if (currentProject?.id && databaseConnected) {
      loadProjectImages(currentProject.id);
      // 清空本地占位符
      setLocalCanvasImages([]);
      // 重置视口恢复状态
      setViewportRestored(false);
      // 清理图片加载管理器
      imageLoadingManager.clear();
    }
  }, [currentProject?.id, databaseConnected, loadProjectImages]);

  // 恢复视口状态（需求 3.2）
  useEffect(() => {
    if (canvasState && !viewportRestored && !isLoadingImages) {
      // 恢复保存的视口状态
      setPosition({ x: -canvasState.viewportX, y: -canvasState.viewportY });
      setScale(canvasState.scale);
      setViewportRestored(true);
      setShowLocateLatest(false);
    } else if (!canvasState && !viewportRestored && !isLoadingImages && persistedImages.length > 0) {
      // 没有保存的视口状态，定位到最新图片（需求 3.3）
      locateToLatestImage();
      setViewportRestored(true);
    }
  }, [canvasState, viewportRestored, isLoadingImages, persistedImages.length]);

  // 页面卸载时保存视口状态和图片位置（需求 3.1, 2.1）
  // 注意：使用上面定义的 positionRef 和 scaleRef 来获取最新值，避免依赖变化导致频繁保存
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (currentProject?.id && databaseConnected) {
        const token = getAuthToken();
        
        // 1. 保存视口状态
        const state: CanvasState = {
          viewportX: -positionRef.current.x,
          viewportY: -positionRef.current.y,
          scale: scaleRef.current,
        };
        fetch(`/api/projects/${currentProject.id}/canvas-state`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify(state),
          keepalive: true,
        }).catch(() => {});

        // 2. 保存所有待保存的图片位置
        const pendingUpdates = getPendingUpdates();
        pendingUpdates.forEach((position, imageId) => {
          fetch(`/api/images/${imageId}/canvas-position`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify({ canvasX: position.x, canvasY: position.y }),
            keepalive: true,
          }).catch(() => {});
        });
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      // 组件卸载时也保存
      handleBeforeUnload();
    };
  }, [currentProject?.id, databaseConnected, getPendingUpdates]); // 只依赖项目 ID 和数据库连接状态

  // 定位到最新图片（需求 7.1, 7.2）
  const locateToLatestImage = useCallback(() => {
    if (persistedImages.length === 0) return;

    // 找到最新的图片（按创建时间排序）
    const sortedImages = [...persistedImages].sort((a, b) => {
      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return dateB - dateA;
    });
    const latestImage = sortedImages[0];
    
    if (latestImage) {
      const imgX = latestImage.canvasX ?? (latestImage as any).x ?? 0;
      const imgY = latestImage.canvasY ?? (latestImage as any).y ?? 0;
      const imgWidth = latestImage.width || 400;
      const imgHeight = latestImage.height || 400;

      // 计算将图片居中显示的位置
      const canvasElement = canvasRef.current;
      if (canvasElement) {
        const rect = canvasElement.getBoundingClientRect();
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;

        // 使用动画平滑滚动（需求 7.4）
        const targetX = centerX - (imgX + imgWidth / 2) * scale;
        const targetY = centerY - (imgY + imgHeight / 2) * scale;

        // 平滑动画
        const startX = position.x;
        const startY = position.y;
        const duration = 300;
        const startTime = Date.now();

        const animate = () => {
          const elapsed = Date.now() - startTime;
          const progress = Math.min(elapsed / duration, 1);
          // 使用 easeOutCubic 缓动函数
          const easeProgress = 1 - Math.pow(1 - progress, 3);

          const newX = startX + (targetX - startX) * easeProgress;
          const newY = startY + (targetY - startY) * easeProgress;

          setPosition({ x: newX, y: newY });

          if (progress < 1) {
            requestAnimationFrame(animate);
          } else {
            setShowLocateLatest(false);
          }
        };

        requestAnimationFrame(animate);
      }
    }
  }, [persistedImages, scale, position]);

  /**
   * 双击图片显示预览模态框
   */
  const handleImageDoubleClick = useCallback((image: CanvasImageType) => {
    setPreviewImage(image);
  }, []);

  /**
   * 收藏/取消收藏图片
   */
  const handleFavoriteImage = useCallback(async (imageId: string) => {
    try {
      const response = await fetch(`/api/images/${imageId}/favorite`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${getAuthToken()}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        // 刷新画布图片
        if (currentProject?.id) {
          loadProjectImages(currentProject.id);
        }
      }
    } catch (error) {
      console.error('收藏图片失败:', error);
    }
  }, [loadProjectImages]);

  /**
   * 双击放大图片到视口 80%（需求 6.1, 6.2, 6.3, 6.4）
   * 如果已经放大，则恢复到之前的视口状态
   */
  const handleImageZoom = useCallback((image: LocalCanvasImage) => {
    const canvasElement = canvasRef.current;
    if (!canvasElement) return;

    const rect = canvasElement.getBoundingClientRect();
    const viewportWidth = rect.width;
    const viewportHeight = rect.height;

    // 如果已经放大且是同一张图片，恢复到之前的状态
    if (zoomState.isZoomedIn && zoomState.targetImageId === image.id) {
      // 恢复到之前的视口状态（需求 6.3）
      const startX = position.x;
      const startY = position.y;
      const startScale = scale;
      const targetX = zoomState.previousPosition.x;
      const targetY = zoomState.previousPosition.y;
      const targetScale = zoomState.previousScale;
      const duration = 300; // 300ms 平滑动画（需求 6.4）
      const startTime = Date.now();

      const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        // 使用 easeOutCubic 缓动函数
        const easeProgress = 1 - Math.pow(1 - progress, 3);

        const newX = startX + (targetX - startX) * easeProgress;
        const newY = startY + (targetY - startY) * easeProgress;
        const newScale = startScale + (targetScale - startScale) * easeProgress;

        setPosition({ x: newX, y: newY });
        setScale(newScale);

        if (progress < 1) {
          requestAnimationFrame(animate);
        } else {
          // 动画完成，重置放大状态
          setZoomState({
            isZoomedIn: false,
            previousPosition: { x: 0, y: 0 },
            previousScale: 1,
            targetImageId: null,
          });
        }
      };

      requestAnimationFrame(animate);
      return;
    }

    // 保存当前视口状态
    const previousPosition = { x: position.x, y: position.y };
    const previousScale = scale;

    // 计算放大后的缩放比例（图片占据视口 80%）
    const imgWidth = image.width || 400;
    const imgHeight = image.height || 400;
    const targetViewportSize = 0.8; // 80% 的视口大小（需求 6.1）
    
    // 计算需要的缩放比例，使图片占据视口 80%
    const scaleX = (viewportWidth * targetViewportSize) / imgWidth;
    const scaleY = (viewportHeight * targetViewportSize) / imgHeight;
    const targetScale = Math.min(scaleX, scaleY, 3); // 限制最大缩放为 3

    // 计算图片中心在画布坐标系中的位置
    const imgCenterX = image.x + imgWidth / 2;
    const imgCenterY = image.y + imgHeight / 2;

    // 计算将图片居中显示的位置
    const targetX = viewportWidth / 2 - imgCenterX * targetScale;
    const targetY = viewportHeight / 2 - imgCenterY * targetScale;

    // 平滑动画（需求 6.4）
    const startX = position.x;
    const startY = position.y;
    const startScale = scale;
    const duration = 300; // 300ms
    const startTime = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // 使用 easeOutCubic 缓动函数
      const easeProgress = 1 - Math.pow(1 - progress, 3);

      const newX = startX + (targetX - startX) * easeProgress;
      const newY = startY + (targetY - startY) * easeProgress;
      const newScale = startScale + (targetScale - startScale) * easeProgress;

      setPosition({ x: newX, y: newY });
      setScale(newScale);

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        // 动画完成，更新放大状态
        setZoomState({
          isZoomedIn: true,
          previousPosition,
          previousScale,
          targetImageId: image.id,
        });
      }
    };

    requestAnimationFrame(animate);

    // 立即加载原图以保证清晰度（需求 6.2）
    imageLoadingManager.loadImmediately(image.id);
  }, [position, scale, zoomState]);

  /**
   * ESC 键恢复放大状态（需求 6.3）
   */
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && zoomState.isZoomedIn && zoomState.targetImageId) {
        // 找到放大的图片并恢复
        const image = canvasImages.find(img => img.id === zoomState.targetImageId);
        if (image) {
          handleImageZoom(image);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [zoomState, canvasImages, handleImageZoom]);


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
        // 查找图片（可能在持久化图片或本地图片中）
        const img = canvasImages.find(i => i.id === target);
        if (img) {
          // 记录鼠标在画布坐标系中的位置（考虑缩放）
          // 鼠标屏幕坐标转换为画布坐标：(clientX - position.x) / scale
          const mouseCanvasX = (e.clientX - position.x) / scale;
          const mouseCanvasY = (e.clientY - position.y) / scale;
          // 记录鼠标相对于图片左上角的偏移（在画布坐标系中）
          setDragStart({ x: mouseCanvasX - img.x, y: mouseCanvasY - img.y });
          setSelectedImageId(target);
        }
      }
    }
  }, [position, canvasImages, scale]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging) return;
    
    if (dragTarget === 'canvas') {
      setPosition({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
    } else {
      // 将鼠标屏幕坐标转换为画布坐标（考虑缩放）
      const mouseCanvasX = (e.clientX - position.x) / scale;
      const mouseCanvasY = (e.clientY - position.y) / scale;
      // 计算图片新位置（在画布坐标系中）
      const newX = mouseCanvasX - dragStart.x;
      const newY = mouseCanvasY - dragStart.y;
      
      // 检查是否是占位符（本地图片）
      const isPlaceholder = localCanvasImages.some(img => img.id === dragTarget && img.isPlaceholder);
      
      if (isPlaceholder) {
        // 更新本地占位符位置
        setLocalCanvasImages(prev => prev.map(img => 
          img.id === dragTarget ? { ...img, x: newX, y: newY } : img
        ));
      } else {
        // 更新持久化图片位置
        updateImagePosition(dragTarget, newX, newY);
      }
    }
  }, [isDragging, dragTarget, dragStart, localCanvasImages, updateImagePosition, position, scale]);

  const handleMouseUp = useCallback(() => {
    // 如果是拖拽画布，显示「定位到最新」按钮（需求 7.3）
    if (isDragging && dragTarget === 'canvas') {
      setShowLocateLatest(true);
    }
    // 图片位置不在这里保存，而是在页面卸载/组件销毁时统一保存
    setIsDragging(false);
  }, [isDragging, dragTarget]);

  const handleDeleteImage = useCallback(async (id: string) => {
    // 检查是否是占位符
    const isPlaceholder = localCanvasImages.some(img => img.id === id && img.isPlaceholder);
    
    if (isPlaceholder) {
      // 删除本地占位符
      setLocalCanvasImages(prev => prev.filter(img => img.id !== id));
    } else {
      // 调用后端 API 将图片移入回收站（软删除）
      try {
        const response = await apiService.deleteImage(id);
        if (response.success) {
          // 从本地状态中移除图片
          removeImage(id);
          console.log('图片已移入回收站');
        } else {
          console.error('删除图片失败:', response.error);
          alert('删除图片失败: ' + (response.error || '未知错误'));
        }
      } catch (error: any) {
        console.error('删除图片失败:', error);
        alert('删除图片失败: ' + error.message);
      }
    }
    
    if (selectedImageId === id) setSelectedImageId(null);
  }, [selectedImageId, localCanvasImages, removeImage]);

  // 计算当前视口（用于虚拟渲染）
  const getCurrentViewport = useCallback((): Viewport => {
    const canvasElement = canvasRef.current;
    if (!canvasElement) {
      return { x: 0, y: 0, width: 1920, height: 1080, scale: 1 };
    }
    const rect = canvasElement.getBoundingClientRect();
    return {
      x: -position.x / scale,
      y: -position.y / scale,
      width: rect.width,
      height: rect.height,
      scale: scale,
    };
  }, [position, scale]);

  // 当前视口
  const currentViewport = getCurrentViewport();

  // 根据图片尺寸设置和宽高比计算实际像素尺寸
  const calculateImageSize = (
    imageSizeSetting: string,
    aspectRatio: string
  ): { width: number; height: number } => {
    // 不同尺寸设置对应的基准像素（较长边）
    const sizeMap: { [key: string]: number } = {
      '1K': 1024,
      '2K': 2048,
      '4K': 4096,
    };

    const ratioMap: { [key: string]: { w: number; h: number } } = {
      auto: { w: 1, h: 1 },
      '1:1': { w: 1, h: 1 },
      '4:3': { w: 4, h: 3 },
      '3:4': { w: 3, h: 4 },
      '16:9': { w: 16, h: 9 },
      '9:16': { w: 9, h: 16 },
      '3:2': { w: 3, h: 2 },
      '2:3': { w: 2, h: 3 },
      '21:9': { w: 21, h: 9 },
    };

    const basePixels = sizeMap[imageSizeSetting] || 1024;
    const ratio = ratioMap[aspectRatio] || { w: 1, h: 1 };

    // 以较长边为基准计算尺寸
    if (ratio.w >= ratio.h) {
      return {
        width: basePixels,
        height: Math.round((basePixels * ratio.h) / ratio.w),
      };
    } else {
      return {
        width: Math.round((basePixels * ratio.w) / ratio.h),
        height: basePixels,
      };
    }
  };

  // 生成单张图片的核心逻辑
  const generateSingleImage = async (
    placeholderId: string, 
    placeholderPos: { x: number; y: number },
    imageSize: { width: number; height: number }
  ): Promise<{ success: boolean; imageId?: string }> => {
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
        setLocalCanvasImages(prev => prev.map(img => 
          img.id === placeholderId ? { ...img, progress: progress || 0 } : img
        ));

        if (taskStatus === 'succeeded' && results?.length > 0) {
          const imageUrl = results[0].url;
          
          // 移除占位符
          setLocalCanvasImages(prev => prev.filter(img => img.id !== placeholderId));

          if (databaseConnected) {
            try {
              const saveResponse = await apiService.saveGeneratedImage(taskId, {
                imageUrl,
                prompt: settings.prompt,
                model: settings.model,
                aspectRatio: settings.aspectRatio,
                imageSize: settings.imageSize,
                refImages: settings.refImages,
                projectId: currentProject?.id,
                canvasX: placeholderPos.x,
                canvasY: placeholderPos.y,
                width: imageSize.width,
                height: imageSize.height,
              });
              
              // 图片保存成功后立即刷新项目图片列表
              // 先保存所有待保存的位置，避免刷新后丢失拖动的位置
              if (currentProject?.id) {
                await savePendingPositions();
                await loadProjectImages(currentProject.id);
              }
              
              return { success: true, imageId: saveResponse.data?.id };
            } catch (saveError) {
              console.warn('保存图片到数据库失败:', saveError);
              // 添加到本地显示
              const newImage: LocalCanvasImage = {
                id: `local-${Date.now()}-${Math.random()}`,
                url: imageUrl,
                prompt: settings.prompt,
                x: placeholderPos.x,
                y: placeholderPos.y,
                width: imageSize.width,
                height: imageSize.height,
                model: settings.model,
                aspectRatio: settings.aspectRatio,
                imageSize: settings.imageSize,
              };
              setLocalCanvasImages(prev => [...prev, newImage]);
              return { success: true };
            }
          } else {
            const newImage: LocalCanvasImage = {
              id: `local-${Date.now()}-${Math.random()}`,
              url: imageUrl,
              prompt: settings.prompt,
              x: placeholderPos.x,
              y: placeholderPos.y,
              width: imageSize.width,
              height: imageSize.height,
              model: settings.model,
              aspectRatio: settings.aspectRatio,
              imageSize: settings.imageSize,
            };
            setLocalCanvasImages(prev => [...prev, newImage]);
            return { success: true };
          }
        } else if (taskStatus === 'failed') {
          throw new Error('图片生成失败');
        }
      }
      attempts++;
    }
    throw new Error('生成超时');
  };

  // 批量生成图片
  const handleGenerate = async () => {
    if (!settings.prompt.trim()) {
      alert('请输入提示词');
      return;
    }

    try {
      setIsGenerating(true);
      setStatus(AppStatus.SUBMITTING);

      // 根据图片尺寸设置和宽高比计算实际像素尺寸
      const imageSize = calculateImageSize(settings.imageSize, settings.aspectRatio);

      // 为每张图片创建占位符和位置
      const placeholders: { id: string; pos: { x: number; y: number }; size: { width: number; height: number } }[] = [];
      let currentImages = [...canvasImages];
      
      for (let i = 0; i < generateCount; i++) {
        const placeholderId = `placeholder-${Date.now()}-${i}`;
        const placeholderPos = findLocalNonOverlappingPosition(currentImages, imageSize.width, imageSize.height);
        
        const placeholder: LocalCanvasImage = {
          id: placeholderId,
          url: '',
          prompt: settings.prompt,
          x: placeholderPos.x,
          y: placeholderPos.y,
          width: imageSize.width,
          height: imageSize.height,
          isPlaceholder: true,
          progress: 0,
        };
        
        placeholders.push({ id: placeholderId, pos: placeholderPos, size: imageSize });
        currentImages = [...currentImages, placeholder];
      }
      
      // 添加所有占位符
      setLocalCanvasImages(prev => [
        ...prev,
        ...placeholders.map(p => ({
          id: p.id,
          url: '',
          prompt: settings.prompt,
          x: p.pos.x,
          y: p.pos.y,
          width: p.size.width,
          height: p.size.height,
          isPlaceholder: true,
          progress: 0,
        }))
      ]);

      // 并行生成所有图片（每张图片生成完成后会立即刷新显示）
      const generatePromises = placeholders.map(({ id, pos, size }) => 
        generateSingleImage(id, pos, size).catch(error => {
          console.error(`生成图片失败 (${id}):`, error);
          // 移除失败的占位符
          setLocalCanvasImages(prev => prev.filter(img => img.id !== id));
          return { success: false }; // 返回失败状态
        })
      );

      await Promise.all(generatePromises);
      
      setStatus(AppStatus.SUCCESS);
      
    } catch (error: any) {
      console.error('批量生成图片失败:', error);
      setStatus(AppStatus.ERROR);
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
  
  // 网格点配置
  const baseGridSize =50; // 基础网格间距（可调整此值改变网格密度）
  const gridSize = baseGridSize * scale;
  
  // 根据缩放比例计算网格透明度（缩小时渐渐变透明）
  // scale < 0.3 时完全透明，scale > 0.6 时完全显示，中间渐变
  const gridOpacity = Math.min(1, Math.max(0, (scale - 0.3) / 0.3)) * 0.4;

  // 显示图片库页面
  if (showImageLibrary) {
    return (
      <ImageLibraryPage
        onBack={() => setShowImageLibrary(false)}
        onSelectImage={(url) => {
          const pos = findLocalNonOverlappingPosition(canvasImages, 400, 400);
          const newImage: LocalCanvasImage = {
            id: `img-${Date.now()}`,
            url,
            prompt: '从图片库导入',
            x: pos.x,
            y: pos.y,
            width: 400,
            height: 400,
          };
          // 添加到本地图片（非持久化）
          setLocalCanvasImages(prev => [...prev, newImage]);
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
            
            {/* 项目切换器（需求 2.1） */}
            <div className="ml-4 pl-4 border-l border-zinc-700/50">
              <ProjectSwitcher />
            </div>
          </div>

          <div className="flex items-center gap-2">
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

            {/* 用户信息和退出按钮（需求 5.1, 5.2） */}
            <div className="flex items-center gap-3 ml-2 pl-3 border-l border-zinc-700/50">
              <div className="flex items-center gap-2 text-sm text-zinc-300">
                <User className="w-4 h-4 text-violet-400" />
                <span>{user?.displayName || user?.username || '用户'}</span>
              </div>
              <button 
                onClick={logout}
                className="btn-glass flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-zinc-400 hover:text-red-400 transition-colors"
                title="退出登录"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
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
              <label className="block text-sm font-medium text-zinc-300 mb-2.5">生成数量</label>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5, 6].map((count) => (
                  <button 
                    key={count} 
                    onClick={() => setGenerateCount(count)} 
                    className={`tag-btn flex-1 px-2 py-2 rounded-lg text-sm font-medium ${generateCount === count ? 'active' : ''}`}
                    disabled={isGenerating}
                  >
                    {count}
                  </button>
                ))}
              </div>
              <p className="text-xs text-zinc-500 mt-1.5">同时生成多张图片，最多6张</p>
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
                  <span>生成 {generateCount} 张图片</span>
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
          {/* 项目图片加载进度指示器（需求 1.1, 13.1） */}
          {isLoadingImages && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 animate-fade-in">
              <div className="glass-card rounded-xl px-4 py-3 flex items-center gap-3">
                <Loader2 className="w-5 h-5 text-violet-400 animate-spin" />
                <span className="text-sm text-zinc-300">正在加载项目图片...</span>
              </div>
            </div>
          )}
          
          {/* 图片加载错误提示 */}
          {imagesError && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 animate-fade-in">
              <div className="glass-card rounded-xl px-4 py-3 flex items-center gap-3 border-red-500/30">
                <X className="w-5 h-5 text-red-400" />
                <span className="text-sm text-red-300">{imagesError}</span>
                <button
                  onClick={() => {
                    if (currentProject?.id) {
                      loadProjectImages(currentProject.id);
                    }
                  }}
                  className="ml-2 px-3 py-1 text-xs bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-lg transition-colors"
                >
                  重试
                </button>
              </div>
            </div>
          )}
          
          {/* 点矩阵背景（缩小时渐渐变透明） */}
          <div className="absolute inset-0 pointer-events-none transition-opacity duration-150" style={{
            backgroundImage: `radial-gradient(circle, rgba(180, 180, 233, 0.62) 2px, transparent 1px)`,
            backgroundSize: `${gridSize}px ${gridSize}px`,
            backgroundPosition: `${position.x % gridSize}px ${position.y % gridSize}px`,
            opacity: gridOpacity,
          }} />

          {/* 画布内容 */}
          <div className={`canvas-content absolute inset-0 ${!isDragging ? 'with-transition' : ''}`} style={{ 
            transform: `translate3d(${position.x}px, ${position.y}px, 0) scale(${scale})`, 
            transformOrigin: '0 0',
            willChange: isDragging ? 'transform' : 'auto',
          }}>
            {canvasImages.length > 0 ? (
              <>
                {/* 使用 CanvasImageLayer 渲染持久化图片（虚拟渲染 + 渐进式加载）*/}
                <CanvasImageLayer
                  images={persistedImages}
                  viewport={currentViewport}
                  selectedImageId={selectedImageId}
                  onImageMouseDown={(e, imageId) => {
                    e.stopPropagation();
                    handleMouseDown(e, imageId);
                  }}
                  onImageDoubleClick={handleImageDoubleClick}
                  onDeleteImage={(imageId) => handleDeleteImage(imageId)}
                />
                
                {/* 渲染本地占位符（正在生成中的图片）*/}
                {localCanvasImages.filter(img => img.isPlaceholder).map((img) => (
                  <div 
                    key={img.id} 
                    className={`absolute cursor-move group ${selectedImageId === img.id ? 'ring-2 ring-violet-500 ring-offset-2 ring-offset-transparent' : ''}`} 
                    style={{ left: img.x, top: img.y }} 
                    onMouseDown={(e) => { e.stopPropagation(); handleMouseDown(e, img.id); }}
                  >
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
                  </div>
                ))}
              </>
            ) : (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none">
                <div className="text-center max-w-md">
                  {/* 空状态图标 */}
                  <div className="w-28 h-28 glass-card rounded-3xl flex items-center justify-center mb-6 mx-auto relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-br from-violet-500/10 to-indigo-500/10" />
                    <ImageIcon className="w-14 h-14 text-zinc-500" />
                  </div>
                  
                  {/* 标题和描述 */}
                  <h2 className="text-2xl font-semibold text-zinc-200 mb-3">
                    {currentProject?.name ? `「${currentProject.name}」` : '画布'}还没有图片
                  </h2>
                  <p className="text-zinc-400 mb-8 leading-relaxed">
                    在左侧输入提示词，点击生成按钮开始创作。<br />
                    您也可以从图片库导入已有的图片。
                  </p>
                  
                  {/* 快捷操作按钮 */}
                  <div className="flex flex-col sm:flex-row gap-3 justify-center pointer-events-auto">
                    {!apiConfig.apiKey ? (
                      <button 
                        onClick={() => setShowApiConfig(true)} 
                        className="btn-primary px-6 py-3 rounded-xl font-medium flex items-center justify-center gap-2"
                      >
                        <Settings className="w-4 h-4" />
                        配置 API Key
                      </button>
                    ) : (
                      <>
                        <button 
                          onClick={() => {
                            // 聚焦到提示词输入框
                            const textarea = document.querySelector('textarea');
                            if (textarea) {
                              textarea.focus();
                            }
                          }}
                          className="btn-primary px-6 py-3 rounded-xl font-medium flex items-center justify-center gap-2"
                        >
                          <Wand2 className="w-4 h-4" />
                          开始创作
                        </button>
                        <button 
                          onClick={() => setShowImageLibrary(true)}
                          className="btn-glass px-6 py-3 rounded-xl font-medium flex items-center justify-center gap-2 text-zinc-300"
                        >
                          <FolderOpen className="w-4 h-4" />
                          从图片库导入
                        </button>
                      </>
                    )}
                  </div>
                  
                  {/* 提示信息 */}
                  <div className="mt-8 flex items-center justify-center gap-6 text-xs text-zinc-500">
                    <div className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-violet-500" />
                      <span>支持多种 AI 模型</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                      <span>支持参考图片</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      <span>自动保存到云端</span>
                    </div>
                  </div>
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
            <div className="w-px h-5 bg-zinc-700" />
            <button onClick={() => setShowImageLibrary(true)} className="zoom-btn" title="图片库"><FolderOpen className="w-4 h-4" /></button>
            <button onClick={() => setShowTrashBin(true)} className="zoom-btn" title="回收站"><Trash2 className="w-4 h-4" /></button>
          </div>

          {/* 定位到最新按钮（需求 7.1, 7.3） */}
          {showLocateLatest && persistedImages.length > 0 && (
            <button 
              onClick={locateToLatestImage}
              className="absolute bottom-20 right-6 btn-glass flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm text-violet-400 hover:text-violet-300 hover:bg-violet-500/10 border-violet-500/30 animate-fade-in shadow-lg shadow-violet-500/10"
            >
              <Crosshair className="w-4 h-4" />
              <span>定位到最新</span>
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
      
      {/* 回收站弹窗（需求 8.1） */}
      <TrashBin isOpen={showTrashBin} onClose={() => setShowTrashBin(false)} />
      
      {/* 图片预览模态框 */}
      <ImagePreviewModal
        image={previewImage}
        isOpen={!!previewImage}
        onClose={() => setPreviewImage(null)}
        onFavorite={handleFavoriteImage}
        onDownload={(image) => {
          const link = document.createElement('a');
          link.href = image.url;
          link.download = `nano-banana-${image.id}.png`;
          link.click();
        }}
        onShare={(image) => {
          navigator.clipboard.writeText(image.url);
        }}
      />
    </div>
  );
}

// 包装组件，添加 ProjectProvider
function CanvasAppWithProviders() {
  return (
    <ProjectProvider>
      <CanvasApp />
    </ProjectProvider>
  );
}

export default CanvasAppWithProviders;
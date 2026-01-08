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
import { ImageLibraryPage } from './components/ImageLibraryPage';
import { ImagePreviewModal } from './components/ImagePreviewModal';
import { CanvasZoomControl } from './components/CanvasZoomControl';
import { CanvasDialogBar } from './components/CanvasDialogBar';
import { ImageEditor } from './components/ImageEditor';
import { useAuth, getAuthToken } from './contexts/AuthContext';
import { ProjectProvider, useProject } from './contexts/ProjectContext';
import ProjectSwitcher from './components/ProjectSwitcher';
import TrashBin from './components/TrashBin';
import { useCanvasImages, calculateBatchPositions, prepareGenerationAreaAndFocus, calculateGenerationArea } from './hooks/useCanvasImages';
import { CanvasImageLayer } from './components/CanvasImageLayer';
import { imageLoadingManager } from './services/imageLoadingManager';
import { useCanvasSelection } from './hooks/useCanvasSelection';
import { SelectionBox } from './components/SelectionBox';
import { getIntersectingImageIds, normalizeSelectionRect } from './utils/selectionUtils';
import { downloadImage, generateDownloadFilename } from './utils/downloadUtils';
import {
  Zap,
  Settings,
  Image as ImageIcon,
  Cloud,
  Database,
  Wand2,
  Download,
  Share2,
  Sparkles,
  FolderOpen,
  X,
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
  isFailed?: boolean;          // 是否生成失败
  failureReason?: string;      // 失败原因
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
  timeout: 450000,  // 450秒超时
  retryCount: 3,
  provider: 'Nano Banana',
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
  
  // 图片编辑器状态
  const [editingImage, setEditingImage] = useState<CanvasImageType | null>(null);

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
      // 优先使用运行时位置（x/y），因为它可能被用户拖动更新
      x: (img as any).x ?? img.canvasX ?? 0,
      y: (img as any).y ?? img.canvasY ?? 0,
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
      // 失败状态相关字段
      isFailed: img.status === 'failed',
      failureReason: img.failureReason,
      // 转换参考图片格式
      refImages: img.refImages?.map((ref, idx) => ({
        url: (ref as any).url || (ref as any).preview || '',
        id: (ref as any).id || `ref_${idx}`,
      })),
    })),
    ...localCanvasImages.filter(img => img.isPlaceholder || img.isFailed), // 保留占位符和失败的图片
  ];

  const [selectedImageId, setSelectedImageId] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateCount, setGenerateCount] = useState(1); // 批量生成数量（1-6）
  const [showImageDetail, setShowImageDetail] = useState<LocalCanvasImage | null>(null);
  
  // 生成进度和错误状态（需求 9.2, 9.6）
  const [generationProgress, setGenerationProgress] = useState(0);
  const [generationStatus, setGenerationStatus] = useState('');
  const [generationError, setGenerationError] = useState<string | null>(null);

  // Toast 提示状态（用于重新生成等操作反馈）
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error' | 'info' | 'warning'>('info');

  // 使用多选功能 Hook（需求 1.1-1.4, 2.1-2.4, 3.1-3.5, 4.1-4.4, 5.1-5.4, 6.1-6.4, 7.1-7.3）
  const {
    toolMode,
    selection,
    selectionActions,
    selectionBox,
    startSelectionBox,
    updateSelectionBox,
    endSelectionBox,
    batchMove,
    startBatchMove,
    updateBatchMove,
    endBatchMove,
    getCursorStyle,
    handleKeyDown: handleSelectionKeyDown,
    handleKeyUp: handleSelectionKeyUp,
  } = useCanvasSelection();

  // 画布缩放和拖拽状态
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [dragTarget, setDragTarget] = useState<'canvas' | string>('canvas');
  const canvasRef = useRef<HTMLDivElement>(null);
  const canvasContentRef = useRef<HTMLDivElement>(null);  // 画布内容容器 ref（用于 imperative DOM 操作）
  const gridBackgroundRef = useRef<HTMLDivElement>(null);  // 背景点阵 ref（用于滚轮缩放时同步更新）
  
  // 正在拖拽的图片 ID 集合（用于 will-change 优化）
  const [draggingImageIds, setDraggingImageIds] = useState<Set<string>>(new Set());
  
  // 是否正在进行 pan/zoom 交互（用于跳过 React 重渲染）
  const isPanningRef = useRef(false);
  const isZoomingRef = useRef(false);
  const zoomEndTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  // 是否正在滚轮缩放（用于禁用 CSS transition，实现以鼠标为中心的精确缩放）
  const [isWheelZooming, setIsWheelZooming] = useState(false);
  
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
    } else if (!canvasState && !viewportRestored && !isLoadingImages && persistedImages.length === 0) {
      // 没有保存的视口状态且没有图片，使用默认视口状态
      // 直接标记为已恢复，使用当前的默认值（scale=1, position={0,0}）
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
      // 优先使用运行时位置（x/y），因为它可能被用户拖动更新
      const imgX = (latestImage as any).x ?? latestImage.canvasX ?? 0;
      const imgY = (latestImage as any).y ?? latestImage.canvasY ?? 0;
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
   * 重新生成图片 - 将图片参数填充到生成对话框
   * 需求: 2.1, 2.2, 2.3, 2.4, 2.5, 3.1, 3.2, 4.1, 4.2, 4.3
   */
  const handleRegenerateImage = useCallback(async (image: CanvasImageType) => {
    // 检查是否正在生成中（需求 4.1）
    if (isGenerating) {
      setToastMessage('请等待当前生成完成');
      setToastType('info');
      setShowToast(true);
      return;
    }

    try {
      // 提取图片参数并更新设置（需求 2.1, 2.2, 2.3, 2.4, 4.3）
      const newSettings: GenerationSettings = {
        ...settings,
        prompt: image.prompt || '',
        model: image.model || DEFAULT_SETTINGS.model,
        aspectRatio: image.aspectRatio || DEFAULT_SETTINGS.aspectRatio,
        imageSize: image.imageSize || DEFAULT_SETTINGS.imageSize,
        refImageUrl: '',
        refImages: [], // 先清空，后面尝试恢复
      };

      // 尝试恢复参考图（需求 2.5）
      if (image.refImages && image.refImages.length > 0) {
        const restoredRefImages: UploadedImage[] = [];
        let hasFailedImages = false;

        for (const refImg of image.refImages) {
          const refUrl = (refImg as any).url || (refImg as any).preview || '';
          const refId = (refImg as any).id || `ref_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
          
          if (refUrl) {
            // 创建简化的 UploadedImage 对象（无法完全恢复原始文件信息）
            restoredRefImages.push({
              id: refId,
              file: new File([], 'restored-image.jpg'), // 空文件占位
              base64: refUrl.startsWith('data:') ? refUrl : undefined,
              preview: refUrl,
              name: `参考图-${restoredRefImages.length + 1}`,
              size: 0,
            });
          } else {
            hasFailedImages = true;
          }
        }

        if (restoredRefImages.length > 0) {
          newSettings.refImages = restoredRefImages;
        }

        // 如果有参考图恢复失败，显示提示（需求 3.3）
        if (hasFailedImages) {
          setToastMessage('部分参考图无法恢复');
          setToastType('warning');
          setShowToast(true);
        }
      }

      // 更新设置状态
      setSettings(newSettings);

      // 显示成功提示（需求 3.2）
      if (!image.refImages || image.refImages.length === 0 || 
          (image.refImages.length > 0 && newSettings.refImages.length > 0)) {
        setToastMessage('参数已填充，可以开始生成');
        setToastType('success');
        setShowToast(true);
      }

      // 聚焦到生成对话框（需求 3.1）
      // 通过设置一个标志让 CanvasDialogBar 获得焦点
      setTimeout(() => {
        const textarea = document.querySelector('.dialog-container textarea') as HTMLTextAreaElement;
        if (textarea) {
          textarea.focus();
          // 将光标移到文本末尾
          textarea.setSelectionRange(textarea.value.length, textarea.value.length);
        }
      }, 100);

    } catch (error) {
      console.error('重新生成参数填充失败:', error);
      setToastMessage('参数填充失败，请重试');
      setToastType('error');
      setShowToast(true);
    }
  }, [isGenerating, settings]);

  /**
   * 添加为参考图 - 将画布图片添加到参考图列表
   * 需求: 1.1, 2.1, 2.3, 3.1, 3.2, 3.3
   */
  const handleAddAsReferenceImage = useCallback((image: CanvasImageType) => {
    // 参考图最大数量限制
    const MAX_REF_IMAGES = 4;
    const currentRefImages = settings.refImages || [];

    // 检查参考图数量是否达到上限（需求 2.3）
    if (currentRefImages.length >= MAX_REF_IMAGES) {
      setToastMessage(`参考图数量已达上限（最多 ${MAX_REF_IMAGES} 张）`);
      setToastType('warning');
      setShowToast(true);
      return;
    }

    // 检查图片 URL 是否有效
    if (!image.url) {
      setToastMessage('无法添加该图片');
      setToastType('error');
      setShowToast(true);
      return;
    }

    // 检查图片是否已存在于参考图列表（需求 3.3）
    const isDuplicate = currentRefImages.some(
      (refImg) => refImg.preview === image.url || refImg.preview === image.thumbnailUrl
    );
    if (isDuplicate) {
      setToastMessage('该图片已添加为参考图');
      setToastType('info');
      setShowToast(true);
      return;
    }

    // 将图片 URL 转换为 UploadedImage 格式（需求 2.1）
    const newRefImage: UploadedImage = {
      id: `ref-canvas-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      file: new File([], 'canvas-image.jpg'), // 空文件占位
      base64: undefined,
      preview: image.url, // 使用图片 URL 作为预览
      name: `画布图片-${currentRefImages.length + 1}`,
      size: 0,
    };

    // 添加到参考图列表
    const updatedRefImages = [...currentRefImages, newRefImage];
    setSettings((prev) => ({ ...prev, refImages: updatedRefImages }));

    // 显示成功提示（需求 3.1）
    setToastMessage('已添加为参考图');
    setToastType('success');
    setShowToast(true);
  }, [settings.refImages]);

  /**
   * 编辑图片 - 打开图片编辑器
   */
  const handleEditImage = useCallback((image: CanvasImageType) => {
    setEditingImage(image);
  }, []);

  /**
   * 保存编辑后的图片
   * 将编辑后的图片保存到存储，并在原图旁边创建新图片
   */
  const handleSaveEditedImage = useCallback(async (data: {
    blob: Blob;
    width: number;
    height: number;
    originalImage: CanvasImageType;
  }) => {
    const { blob, width, height, originalImage } = data;
    
    try {
      // 1. 上传图片到存储
      const formData = new FormData();
      formData.append('image', blob, `edited-${Date.now()}.png`);
      
      const token = getAuthToken();
      const uploadResponse = await fetch('/api/images/upload', {
        method: 'POST',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: formData,
      });
      
      if (!uploadResponse.ok) {
        throw new Error('上传图片失败');
      }
      
      const uploadResult = await uploadResponse.json();
      if (!uploadResult.success) {
        throw new Error(uploadResult.error || '上传图片失败');
      }
      
      const imageUrl = uploadResult.data.url;
      const thumbnailUrl = uploadResult.data.thumbnailUrl;
      
      // 2. 计算新图片位置（在原图右侧，间距 8px，更贴近原图）
      const originalX = (originalImage as any).x ?? originalImage.canvasX ?? 0;
      const originalY = (originalImage as any).y ?? originalImage.canvasY ?? 0;
      const originalWidth = originalImage.width || 400;
      
      // 计算画布显示尺寸
      const displaySize = calculateCanvasDisplaySize(width, height);
      const newX = Math.round(originalX + originalWidth + 8);  // 间距从 20px 减少到 8px
      const newY = Math.round(originalY);  // 取整
      
      // 3. 保存图片记录到数据库（标记为编辑过的图片）
      const saveResponse = await fetch('/api/images', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          url: imageUrl,
          thumbnailUrl,
          prompt: originalImage.prompt || '',  // 保留原图的 prompt，不添加前缀
          model: 'edited',  // 标记为编辑过的图片
          aspectRatio: originalImage.aspectRatio || 'auto',
          imageSize: originalImage.imageSize || '1K',
          projectId: currentProject?.id,
          canvasX: newX,
          canvasY: newY,
          width: Math.round(width),  // 取整
          height: Math.round(height),  // 取整
        }),
      });
      
      if (!saveResponse.ok) {
        throw new Error('保存图片记录失败');
      }
      
      // 4. 刷新项目图片列表
      if (currentProject?.id) {
        await savePendingPositions();
        await loadProjectImages(currentProject.id);
      }
      
      // 5. 显示成功提示
      setToastMessage('编辑后的图片已保存');
      setToastType('success');
      setShowToast(true);
      
    } catch (error: any) {
      console.error('保存编辑图片失败:', error);
      setToastMessage(error.message || '保存失败');
      setToastType('error');
      setShowToast(true);
      throw error;
    }
  }, [currentProject?.id, savePendingPositions, loadProjectImages]);

  /**
   * 保存编辑后的图片并设为参考图
   */
  const handleSetEditedAsReference = useCallback((imageUrl: string) => {
    // 将编辑后的图片添加到参考图列表
    const currentRefImages = settings.refImages || [];
    const MAX_REF_IMAGES = 4;
    
    if (currentRefImages.length >= MAX_REF_IMAGES) {
      setToastMessage(`参考图数量已达上限（最多 ${MAX_REF_IMAGES} 张）`);
      setToastType('warning');
      setShowToast(true);
      return;
    }
    
    const newRefImage: UploadedImage = {
      id: `ref-edited-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      file: new File([], 'edited-image.png'),
      base64: undefined,
      preview: imageUrl,
      name: `编辑图片-${currentRefImages.length + 1}`,
      size: 0,
    };
    
    const updatedRefImages = [...currentRefImages, newRefImage];
    setSettings((prev) => ({ ...prev, refImages: updatedRefImages }));
    
    setToastMessage('已保存并添加为参考图');
    setToastType('success');
    setShowToast(true);
  }, [settings.refImages]);

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

  // 删除图片函数的 ref（用于键盘事件处理）
  const handleDeleteImageRef = useRef<((id: string) => Promise<void>) | null>(null);

  /**
   * ESC 键恢复放大状态（需求 6.3）和多选功能键盘事件
   */
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 如果正在输入，不处理快捷键
      const activeElement = document.activeElement;
      if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA')) {
        return;
      }

      // ESC 键恢复放大状态
      if (e.key === 'Escape' && zoomState.isZoomedIn && zoomState.targetImageId) {
        const image = canvasImages.find(img => img.id === zoomState.targetImageId);
        if (image) {
          handleImageZoom(image);
          return;
        }
      }

      // 多选功能键盘事件处理（需求 2.1, 7.1, 7.2, 7.3）
      handleSelectionKeyDown(e, persistedImages, async (ids) => {
        // 批量删除选中的图片
        if (handleDeleteImageRef.current) {
          for (const id of ids) {
            await handleDeleteImageRef.current(id);
          }
        }
      });
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      // 多选功能键盘释放事件处理（需求 2.2）
      handleSelectionKeyUp(e);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [zoomState, canvasImages, handleImageZoom, handleSelectionKeyDown, handleSelectionKeyUp, persistedImages]);


  // 初始化应用
  useEffect(() => {
    initializeApp();
  }, []);

  // Toast 自动消失逻辑
  useEffect(() => {
    if (showToast) {
      const timer = setTimeout(() => {
        setShowToast(false);
      }, 2000); // 2秒后自动消失
      return () => clearTimeout(timer);
    }
  }, [showToast]);

  // 滚轮缩放 - 以鼠标位置为中心缩放
  // 缩放时禁用 CSS transition，确保鼠标指向的点保持不变
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
      
      // 使用指数缩放，使缩放更加丝滑和一致
      // 缩放因子：每次滚轮滚动改变 10% 的比例
      const zoomFactor = 1.1;
      const newScale = e.deltaY > 0 
        ? Math.max(0.1, oldScale / zoomFactor)  // 缩小
        : Math.min(3, oldScale * zoomFactor);   // 放大
      
      if (Math.abs(newScale - oldScale) < 0.001) return;
      
      // 计算鼠标在画布内容坐标系中的位置
      const mouseCanvasX = (mouseX - oldPosition.x) / oldScale;
      const mouseCanvasY = (mouseY - oldPosition.y) / oldScale;
      
      // 计算新的位置，使鼠标指向的点保持不变
      const newX = mouseX - mouseCanvasX * newScale;
      const newY = mouseY - mouseCanvasY * newScale;
      
      // 更新 ref 中的实时值
      scaleRef.current = newScale;
      positionRef.current = { x: newX, y: newY };
      
      // 禁用 CSS transition，确保以鼠标为中心的精确缩放
      setIsWheelZooming(true);
      
      // 更新 React state
      setScale(newScale);
      setPosition({ x: newX, y: newY });
      
      // 清除之前的定时器
      if (zoomEndTimerRef.current) {
        clearTimeout(zoomEndTimerRef.current);
      }
      
      // 缩放结束后恢复 CSS transition（200ms 无操作视为结束）
      zoomEndTimerRef.current = setTimeout(() => {
        setIsWheelZooming(false);
      }, 200);
    };

    canvasElement.addEventListener('wheel', handleWheelZoom, { passive: false });
    return () => {
      canvasElement.removeEventListener('wheel', handleWheelZoom);
      if (zoomEndTimerRef.current) {
        clearTimeout(zoomEndTimerRef.current);
      }
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

  // 适应所有图片 - 计算能看到所有图片的缩放和位置
  const handleFitAllImages = useCallback(() => {
    if (persistedImages.length === 0) {
      // 没有图片时重置到默认视图
      setScale(1);
      setPosition({ x: 0, y: 0 });
      return;
    }

    const canvasElement = canvasRef.current;
    if (!canvasElement) return;

    const rect = canvasElement.getBoundingClientRect();
    const viewportWidth = rect.width;
    const viewportHeight = rect.height;

    // 计算所有图片的边界框
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    
    for (const img of persistedImages) {
      const imgX = img.x ?? img.canvasX ?? 0;
      const imgY = img.y ?? img.canvasY ?? 0;
      const imgWidth = img.width || 400;
      const imgHeight = img.height || 400;
      
      minX = Math.min(minX, imgX);
      minY = Math.min(minY, imgY);
      maxX = Math.max(maxX, imgX + imgWidth);
      maxY = Math.max(maxY, imgY + imgHeight);
    }

    // 计算内容的宽高
    const contentWidth = maxX - minX;
    const contentHeight = maxY - minY;

    // 添加边距（10%）
    const padding = 0.1;
    const paddedWidth = contentWidth * (1 + padding * 2);
    const paddedHeight = contentHeight * (1 + padding * 2);

    // 计算适应视口的缩放比例
    const scaleX = viewportWidth / paddedWidth;
    const scaleY = viewportHeight / paddedHeight;
    const targetScale = Math.min(scaleX, scaleY, 1); // 最大不超过 1

    // 计算内容中心
    const contentCenterX = (minX + maxX) / 2;
    const contentCenterY = (minY + maxY) / 2;

    // 计算将内容居中显示的位置
    const targetX = viewportWidth / 2 - contentCenterX * targetScale;
    const targetY = viewportHeight / 2 - contentCenterY * targetScale;

    // 直接设置最终值，避免动画卡顿
    setScale(targetScale);
    setPosition({ x: targetX, y: targetY });
  }, [persistedImages]);

  // 以窗口中心为基准缩放
  const handleZoomToCenter = useCallback((newScale: number) => {
    const canvasElement = canvasRef.current;
    if (!canvasElement) {
      setScale(newScale);
      return;
    }

    const rect = canvasElement.getBoundingClientRect();
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    const oldScale = scaleRef.current;
    const oldPosition = positionRef.current;

    // 计算窗口中心在画布内容坐标系中的位置
    const centerCanvasX = (centerX - oldPosition.x) / oldScale;
    const centerCanvasY = (centerY - oldPosition.y) / oldScale;

    // 计算新的位置，使窗口中心指向的点保持不变
    const newX = centerX - centerCanvasX * newScale;
    const newY = centerY - centerCanvasY * newScale;

    setScale(newScale);
    setPosition({ x: newX, y: newY });
  }, []);


  // 画布/图片拖拽（支持多选功能）
  const handleMouseDown = useCallback((e: React.MouseEvent, target: 'canvas' | string = 'canvas', shiftKey: boolean = false) => {
    if (e.button === 0) {
      e.stopPropagation();
      
      // 抓手模式下只能拖动画布（需求 2.4）
      if (toolMode.currentMode === 'hand') {
        setIsDragging(true);
        setDragTarget('canvas');
        setDragStart({ x: e.clientX - positionRef.current.x, y: e.clientY - positionRef.current.y });
        isPanningRef.current = true;
        return;
      }
      
      if (target === 'canvas') {
        // 点击画布空白处 - 在移动工具模式下启动框选
        // 计算画布坐标
        const canvasElement = canvasRef.current;
        if (canvasElement) {
          const rect = canvasElement.getBoundingClientRect();
          const canvasX = (e.clientX - rect.left - positionRef.current.x) / scaleRef.current;
          const canvasY = (e.clientY - rect.top - positionRef.current.y) / scaleRef.current;
          
          // 开始框选（需求 3.1）
          startSelectionBox({ x: canvasX, y: canvasY });
          
          // 记录拖动起始位置（用于框选）
          setDragStart({ x: e.clientX, y: e.clientY });
        }
        
        // 清除选中状态（需求 4.4）
        if (!shiftKey) {
          selectionActions.clearSelection();
        }
        setSelectedImageId(null);
        // 清除拖拽图片集合
        setDraggingImageIds(new Set());
        
        // 在移动工具模式下，点击空白处只启动框选，不拖动画布
        // isDragging 用于追踪鼠标是否按下
        setIsDragging(true);
        setDragTarget('selection'); // 使用 'selection' 标记框选模式
      } else {
        // 点击图片
        const img = canvasImages.find(i => i.id === target);
        if (img) {
          const isSelected = selection.selectedIds.has(target);
          
          if (shiftKey || e.shiftKey) {
            // Shift+点击：切换选中状态（需求 5.2, 5.3）
            selectionActions.toggleSelection(target);
          } else if (!isSelected) {
            // 点击未选中的图片：仅选中该图片（需求 5.1）
            selectionActions.clearSelection();
            selectionActions.selectImage(target);
          }
          // 点击已选中的图片：保持选中状态以便拖动（需求 5.4）
          
          // 记录鼠标在画布坐标系中的位置
          const mouseCanvasX = (e.clientX - positionRef.current.x) / scaleRef.current;
          const mouseCanvasY = (e.clientY - positionRef.current.y) / scaleRef.current;
          setDragStart({ x: mouseCanvasX - img.x, y: mouseCanvasY - img.y });
          setSelectedImageId(target);
          
          // 设置正在拖拽的图片 ID 集合（用于 will-change 优化）
          if (selection.selectedIds.has(target) && selection.selectedIds.size > 1) {
            // 多选拖拽
            setDraggingImageIds(new Set(selection.selectedIds));
          } else {
            // 单选拖拽
            setDraggingImageIds(new Set([target]));
          }
          
          setIsDragging(true);
          setDragTarget(target);
        }
      }
    }
  }, [canvasImages, toolMode.currentMode, selection.selectedIds, selectionActions, startSelectionBox]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    // 更新框选区域（需求 3.2）
    if (selectionBox.isActive) {
      const canvasElement = canvasRef.current;
      if (canvasElement) {
        const rect = canvasElement.getBoundingClientRect();
        const canvasX = (e.clientX - rect.left - positionRef.current.x) / scaleRef.current;
        const canvasY = (e.clientY - rect.top - positionRef.current.y) / scaleRef.current;
        updateSelectionBox({ x: canvasX, y: canvasY });
      }
      // 框选模式下不执行其他拖动逻辑
      return;
    }
    
    if (!isDragging) return;
    
    if (dragTarget === 'canvas') {
      // 抓手模式下的画布拖动 - 直接更新 React state
      const newX = e.clientX - dragStart.x;
      const newY = e.clientY - dragStart.y;
      
      // 更新 ref 中的实时值
      positionRef.current = { x: newX, y: newY };
      
      // 直接更新 React state（拖拽时 CSS transition 被禁用，所以不会有延迟）
      setPosition({ x: newX, y: newY });
    } else if (dragTarget === 'selection') {
      // 框选模式 - 由上面的 selectionBox.isActive 处理
      // 这里不需要额外处理
    } else {
      // 拖动图片
      const mouseCanvasX = (e.clientX - positionRef.current.x) / scaleRef.current;
      const mouseCanvasY = (e.clientY - positionRef.current.y) / scaleRef.current;
      const newX = mouseCanvasX - dragStart.x;
      const newY = mouseCanvasY - dragStart.y;
      
      // 检查是否是占位符
      const isPlaceholder = localCanvasImages.some(img => img.id === dragTarget && img.isPlaceholder);
      
      if (isPlaceholder) {
        setLocalCanvasImages(prev => prev.map(img => 
          img.id === dragTarget ? { ...img, x: newX, y: newY } : img
        ));
      } else {
        // 如果拖动的是选中的图片，批量移动所有选中的图片（需求 6.1, 6.2）
        if (selection.selectedIds.has(dragTarget) && selection.selectedIds.size > 1) {
          // 计算移动增量
          const draggedImg = canvasImages.find(i => i.id === dragTarget);
          if (draggedImg) {
            const deltaX = newX - draggedImg.x;
            const deltaY = newY - draggedImg.y;
            
            // 更新所有选中图片的位置
            selection.selectedIds.forEach(id => {
              const img = canvasImages.find(i => i.id === id);
              if (img) {
                const imgNewX = img.x + deltaX;
                const imgNewY = img.y + deltaY;
                updateImagePosition(id, imgNewX, imgNewY);
              }
            });
          }
        } else {
          // 单张图片移动
          updateImagePosition(dragTarget, newX, newY);
        }
      }
    }
  }, [isDragging, dragTarget, dragStart, localCanvasImages, updateImagePosition, selectionBox.isActive, updateSelectionBox, selection.selectedIds, canvasImages]);

  const handleMouseUp = useCallback(() => {
    // 结束框选（需求 3.4）
    if (selectionBox.isActive) {
      const rect = endSelectionBox();
      if (rect && rect.width > 5 && rect.height > 5) {
        // 获取与选区框相交的图片（需求 3.3）
        const intersectingIds = getIntersectingImageIds(rect, persistedImages);
        if (intersectingIds.length > 0) {
          selectionActions.setSelectedIds(new Set(intersectingIds));
        } else {
          // 选区框不与任何图片相交，清除选中（需求 3.5）
          selectionActions.clearSelection();
        }
      }
    }
    
    // 如果是拖拽画布（抓手模式），同步 state 并显示「定位到最新」按钮（需求 7.3）
    if (isDragging && dragTarget === 'canvas') {
      isPanningRef.current = false;
      // 同步 state，确保 React 状态与 DOM 一致
      setPosition(positionRef.current);
      setShowLocateLatest(true);
    }
    
    // 清除拖拽图片集合（移除 will-change）
    setDraggingImageIds(new Set());
    
    // 图片位置不在这里保存，而是在页面卸载/组件销毁时统一保存
    setIsDragging(false);
    setDragTarget('canvas'); // 重置拖动目标
  }, [isDragging, dragTarget, selectionBox.isActive, endSelectionBox, persistedImages, selectionActions]);

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
    // 同时从多选集合中移除
    selectionActions.deselectImage(id);
  }, [selectedImageId, localCanvasImages, removeImage, selectionActions]);

  // 更新 handleDeleteImage ref（用于键盘事件处理）
  useEffect(() => {
    handleDeleteImageRef.current = handleDeleteImage;
  }, [handleDeleteImage]);

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

  // 计算画布上的显示尺寸（与 CanvasImageLayer 中的逻辑一致）
  const calculateCanvasDisplaySize = (
    actualWidth: number,
    actualHeight: number,
    maxSize: number = 400
  ): { width: number; height: number } => {
    const aspectRatio = actualWidth / actualHeight;
    
    // 如果图片尺寸都小于等于最大尺寸，直接使用实际尺寸
    if (actualWidth <= maxSize && actualHeight <= maxSize) {
      return { width: actualWidth, height: actualHeight };
    }
    
    // 根据宽高比计算适合的显示尺寸
    if (aspectRatio > 1) {
      // 宽图：以宽度为准
      const displayWidth = Math.min(actualWidth, maxSize);
      const displayHeight = displayWidth / aspectRatio;
      return { width: displayWidth, height: displayHeight };
    } else {
      // 高图：以高度为准
      const displayHeight = Math.min(actualHeight, maxSize);
      const displayWidth = displayHeight * aspectRatio;
      return { width: displayWidth, height: displayHeight };
    }
  };

  // 生成单张图片的核心逻辑
  // displaySize: 画布显示尺寸（用于位置计算和占位符显示）
  // actualSize: 实际像素尺寸（用于保存到数据库）
  const generateSingleImage = async (
    placeholderId: string, 
    placeholderPos: { x: number; y: number },
    displaySize: { width: number; height: number },
    actualSize: { width: number; height: number }
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
          
          // 不立即移除占位符，等图片加载到列表后再移除
          // 先将占位符标记为"加载中"状态
          setLocalCanvasImages(prev => prev.map(img => 
            img.id === placeholderId 
              ? { ...img, isPlaceholder: true, progress: 100 } 
              : img
          ));

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
                width: actualSize.width,  // 保存实际像素尺寸
                height: actualSize.height,
              });
              
              // 图片保存成功后立即刷新项目图片列表
              // 先保存所有待保存的位置，避免刷新后丢失拖动的位置
              if (currentProject?.id) {
                await savePendingPositions();
                await loadProjectImages(currentProject.id);
              }
              
              // 刷新完成后再移除占位符
              setLocalCanvasImages(prev => prev.filter(img => img.id !== placeholderId));
              
              return { success: true, imageId: saveResponse.data?.id };
            } catch (saveError) {
              console.warn('保存图片到数据库失败:', saveError);
              // 移除占位符，添加到本地显示
              setLocalCanvasImages(prev => {
                const filtered = prev.filter(img => img.id !== placeholderId);
                return [...filtered, {
                  id: `local-${Date.now()}-${Math.random()}`,
                  url: imageUrl,
                  prompt: settings.prompt,
                  x: placeholderPos.x,
                  y: placeholderPos.y,
                  width: actualSize.width,
                  height: actualSize.height,
                  model: settings.model,
                  aspectRatio: settings.aspectRatio,
                  imageSize: settings.imageSize,
                }];
              });
              return { success: true };
            }
          } else {
            // 移除占位符，添加到本地显示
            setLocalCanvasImages(prev => {
              const filtered = prev.filter(img => img.id !== placeholderId);
              return [...filtered, {
                id: `local-${Date.now()}-${Math.random()}`,
                url: imageUrl,
                prompt: settings.prompt,
                x: placeholderPos.x,
                y: placeholderPos.y,
                width: actualSize.width,
                height: actualSize.height,
                model: settings.model,
                aspectRatio: settings.aspectRatio,
                imageSize: settings.imageSize,
              }];
            });
            return { success: true };
          }
        } else if (taskStatus === 'failed') {
          // 获取失败原因
          const failureReason = statusResponse.data?.failure_reason || '图片生成失败';
          throw new Error(failureReason);
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
      setGenerationProgress(0);
      setGenerationStatus('正在准备生成任务...');
      setGenerationError(null);
      setStatus(AppStatus.SUBMITTING);

      // 根据图片尺寸设置和宽高比计算实际像素尺寸
      const imageSize = calculateImageSize(settings.imageSize, settings.aspectRatio);
      
      // 计算画布上的显示尺寸（用于位置计算）
      const displaySize = calculateCanvasDisplaySize(imageSize.width, imageSize.height);

      // 获取画布容器尺寸
      const canvasElement = canvasRef.current;
      const viewportSize = canvasElement 
        ? { width: canvasElement.clientWidth, height: canvasElement.clientHeight }
        : { width: 1920, height: 1080 };

      // 使用新的位置计算逻辑（需求 10.1-10.7）
      // 1. 预计算所有图片位置并聚焦到生成区域（使用显示尺寸计算位置）
      const positions = await prepareGenerationAreaAndFocus(
        persistedImages as any,  // 使用持久化图片作为参考
        displaySize,  // 使用画布显示尺寸而不是实际像素尺寸
        generateCount,
        position,
        scale,
        viewportSize,
        setPosition
      );

      // 2. 为每张图片创建占位符（使用显示尺寸）
      const placeholders: { id: string; pos: { x: number; y: number }; size: { width: number; height: number } }[] = [];
      
      for (let i = 0; i < generateCount; i++) {
        const placeholderId = `placeholder-${Date.now()}-${i}`;
        const placeholderPos = positions[i];
        
        // 占位符使用显示尺寸
        placeholders.push({ id: placeholderId, pos: placeholderPos, size: displaySize });
      }
      
      // 添加所有占位符（使用显示尺寸）
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
          model: settings.model,
          aspectRatio: settings.aspectRatio,
          imageSize: settings.imageSize,
        }))
      ]);

      setGenerationStatus(`正在生成 ${generateCount} 张图片...`);

      // 跟踪完成的图片数量
      let completedCount = 0;
      const totalCount = placeholders.length;

      // 并行生成所有图片（每张图片生成完成后会立即刷新显示）
      // 传递显示尺寸和实际像素尺寸
      const generatePromises = placeholders.map(({ id, pos, size }) => 
        generateSingleImage(id, pos, size, imageSize).then(result => {
          completedCount++;
          setGenerationProgress((completedCount / totalCount) * 100);
          setGenerationStatus(`已完成 ${completedCount}/${totalCount} 张图片`);
          return result;
        }).catch(async (error) => {
          console.error(`生成图片失败 (${id}):`, error);
          const failureReason = error.message || '生成失败';
          
          // 保存失败记录到数据库
          if (databaseConnected) {
            try {
              await apiService.saveFailedImage({
                prompt: settings.prompt,
                model: settings.model,
                aspectRatio: settings.aspectRatio,
                imageSize: settings.imageSize,
                projectId: currentProject?.id,
                canvasX: pos.x,
                canvasY: pos.y,
                width: imageSize.width,
                height: imageSize.height,
                failureReason,
              });
              console.log('失败记录已保存到数据库');
              
              // 刷新项目图片列表以显示失败记录
              if (currentProject?.id) {
                await savePendingPositions();
                await loadProjectImages(currentProject.id);
              }
              
              // 移除本地占位符（因为已保存到数据库）
              setLocalCanvasImages(prev => prev.filter(img => img.id !== id));
            } catch (saveError) {
              console.warn('保存失败记录到数据库失败:', saveError);
              // 保存失败，保留本地显示
              setLocalCanvasImages(prev => prev.map(img => 
                img.id === id 
                  ? { 
                      ...img, 
                      isPlaceholder: false,
                      isFailed: true,
                      failureReason,
                      progress: 0,
                    } 
                  : img
              ));
            }
          } else {
            // 数据库未连接，保留本地显示
            setLocalCanvasImages(prev => prev.map(img => 
              img.id === id 
                ? { 
                    ...img, 
                    isPlaceholder: false,
                    isFailed: true,
                    failureReason,
                    progress: 0,
                  } 
                : img
            ));
          }
          
          completedCount++;
          setGenerationProgress((completedCount / totalCount) * 100);
          return { success: false, error: failureReason };
        })
      );

      const results = await Promise.all(generatePromises);
      
      // 检查是否有失败的生成，并收集错误信息
      const failedResults = results.filter(r => !r.success);
      const failedCount = failedResults.length;
      if (failedCount > 0) {
        // 获取第一个失败的错误原因（通常所有失败原因相同）
        const firstError = (failedResults[0] as any)?.error || '';
        if (failedCount < totalCount) {
          setGenerationError(`${failedCount} 张图片生成失败${firstError ? `：${firstError}` : ''}`);
        } else {
          setGenerationError(`所有图片生成失败${firstError ? `：${firstError}` : ''}`);
        }
      }
      
      setStatus(AppStatus.SUCCESS);
      setGenerationStatus('');
      
    } catch (error: any) {
      console.error('批量生成图片失败:', error);
      setStatus(AppStatus.ERROR);
      setGenerationError(error.message || '图片生成失败');
    } finally {
      setIsGenerating(false);
      setGenerationProgress(0);
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
          // 使用新的位置计算逻辑
          const positions = calculateBatchPositions(persistedImages as any, { width: 400, height: 400 }, 1);
          const pos = positions[0] || { x: 100, y: 100 };
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
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center shadow-lg shadow-yellow-500/20">
              <span className="text-2xl">🍌</span>
            </div>
            <div>
              <h1 className="font-semibold text-lg tracking-tight text-zinc-100">元旦三天怒搓一个🍌PRO</h1>
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
              <span>存储</span>
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


      {/* 主要内容区域 - 全屏画布布局（需求 1.1） */}
      <div className="flex h-full pt-20">
        {/* 全屏画布区域 - 移除左侧侧边栏 */}
        <main 
          ref={canvasRef} 
          className="flex-1 relative canvas-container" 
          style={{ cursor: getCursorStyle() }}
          onMouseDown={(e) => handleMouseDown(e, 'canvas', e.shiftKey)} 
          onMouseMove={handleMouseMove} 
          onMouseUp={handleMouseUp} 
          onMouseLeave={handleMouseUp}
        >
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
          <div 
            ref={gridBackgroundRef}
            className={`grid-background absolute inset-0 pointer-events-none ${!isDragging && !isWheelZooming ? 'with-transition' : ''}`}
            style={{
            backgroundImage: `radial-gradient(circle, rgba(180, 180, 233, 0.62) 2px, transparent 1px)`,
            backgroundSize: `${gridSize}px ${gridSize}px`,
            backgroundPosition: `${position.x % gridSize}px ${position.y % gridSize}px`,
            opacity: gridOpacity,
          }} />

          {/* 画布内容 */}
          <div 
            ref={canvasContentRef}
            className={`canvas-content absolute inset-0 ${!isDragging && !isWheelZooming ? 'with-transition' : ''}`} 
            style={{ 
              transform: `translate3d(${position.x}px, ${position.y}px, 0) scale(${scale})`, 
              transformOrigin: '0 0',
              willChange: isDragging ? 'transform' : 'auto',
            }}
          >
            {/* 选区框组件（需求 3.1, 8.1） */}
            <SelectionBox
              startPoint={selectionBox.startPoint}
              endPoint={selectionBox.endPoint}
              isActive={selectionBox.isActive}
            />
            
            {canvasImages.length > 0 ? (
              <>
                {/* 使用 CanvasImageLayer 渲染持久化图片（虚拟渲染 + 渐进式加载）*/}
                {/* 只有在视口状态恢复后才渲染图片，避免初始化时用错误的缩放比例请求图片 */}
                {viewportRestored && (
                  <CanvasImageLayer
                    images={persistedImages}
                    viewport={currentViewport}
                    selectedImageId={selectedImageId}
                    selectedIds={selection.selectedIds}
                    draggingIds={draggingImageIds}
                    onImageMouseDown={(e, imageId) => {
                      e.stopPropagation();
                      handleMouseDown(e, imageId, e.shiftKey);
                    }}
                    onImageDoubleClick={handleImageDoubleClick}
                    onDeleteImage={(imageId) => handleDeleteImage(imageId)}
                    onRegenerateImage={handleRegenerateImage}
                    onAddAsReferenceImage={handleAddAsReferenceImage}
                    onEditImage={handleEditImage}
                  />
                )}
                
                {/* 渲染本地占位符（正在生成中的图片）和失败的图片 */}
                {localCanvasImages.filter(img => img.isPlaceholder || img.isFailed).map((img) => (
                  <div 
                    key={img.id} 
                    className={`absolute cursor-move group ${selectedImageId === img.id ? 'ring-2 ring-violet-500 ring-offset-2 ring-offset-transparent' : ''}`} 
                    style={{ 
                      top: 0, 
                      left: 0, 
                      transform: `translate3d(${img.x}px, ${img.y}px, 0)`,
                      width: img.width, 
                      height: img.height 
                    }} 
                    onMouseDown={(e) => { e.stopPropagation(); handleMouseDown(e, img.id); }}
                  >
                    {img.isFailed ? (
                      // 失败状态显示
                      <div className="w-full h-full glass-card rounded-xl flex flex-col items-center justify-center gap-3 border border-red-500/30 bg-red-500/5">
                        <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center">
                          <X className="w-6 h-6 text-red-400" />
                        </div>
                        <div className="text-center px-4">
                          <p className="text-sm text-red-400 mb-1">生成失败</p>
                          <p className="text-xs text-zinc-500 mb-2">{img.failureReason || '未知错误'}</p>
                        </div>
                        <p className="text-xs text-zinc-500 max-w-[90%] truncate px-4">{img.prompt}</p>
                        <div className="text-xs text-zinc-600 mt-1">
                          {img.model} · {img.aspectRatio} · {img.imageSize}
                        </div>
                        {/* 删除按钮 */}
                        <button
                          className="absolute top-2 right-2 btn-glass p-2 rounded-lg hover:bg-red-500/20 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={(e) => {
                            e.stopPropagation();
                            setLocalCanvasImages(prev => prev.filter(i => i.id !== img.id));
                          }}
                        >
                          <X className="w-3.5 h-3.5 text-zinc-300" />
                        </button>
                      </div>
                    ) : (
                      // 正在生成中的占位符
                      <div className="w-full h-full glass-card rounded-xl flex flex-col items-center justify-center gap-4">
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
                    )}
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
                  
                  {/* 标题 */}
                  <h2 className="text-2xl font-semibold text-zinc-200">
                    {currentProject?.name ? `「${currentProject.name}」` : '画布'}还没有图片
                  </h2>
                </div>
              </div>
            )}
          </div>


          {/* 缩放控制器 - 左侧垂直侧边栏（需求 1.3, 8.1, 8.2, 8.4） */}
          <CanvasZoomControl
            scale={scale}
            onScaleChange={setScale}
            onZoomToCenter={handleZoomToCenter}
            onFitAll={handleFitAllImages}
            minScale={0.1}
            maxScale={3}
            onOpenImageLibrary={() => setShowImageLibrary(true)}
            onOpenTrashBin={() => setShowTrashBin(true)}
          />

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

      {/* 底部对话框（需求 1.2） */}
      <CanvasDialogBar
        settings={settings}
        onSettingsChange={setSettings}
        refImages={settings.refImages || []}
        onRefImagesChange={handleImagesChange}
        isGenerating={isGenerating}
        onGenerate={handleGenerate}
        onCancel={() => {
          setIsGenerating(false);
          setGenerationProgress(0);
          setGenerationStatus('');
        }}
        generationProgress={generationProgress}
        generationStatus={generationStatus}
        generationError={generationError}
        onClearError={() => setGenerationError(null)}
        generateCount={generateCount}
        onGenerateCountChange={setGenerateCount}
      />

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
                onClick={() => { downloadImage(showImageDetail.url, generateDownloadFilename(showImageDetail.id)); }}
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
      <TrashBin 
        isOpen={showTrashBin} 
        onClose={() => setShowTrashBin(false)} 
        onImageRestored={() => {
          // 刷新当前项目的画布图片
          if (currentProject?.id) {
            loadProjectImages(currentProject.id);
          }
        }}
      />
      
      {/* 图片预览模态框 */}
      <ImagePreviewModal
        image={previewImage}
        isOpen={!!previewImage}
        onClose={() => setPreviewImage(null)}
        onFavorite={handleFavoriteImage}
        onDownload={(image) => {
          downloadImage(image.url, generateDownloadFilename(image.id));
        }}
        onShare={(image) => {
          navigator.clipboard.writeText(image.url);
        }}
      />

      {/* 图片编辑器 */}
      {editingImage && (
        <ImageEditor
          image={editingImage}
          onClose={() => setEditingImage(null)}
          onSave={handleSaveEditedImage}
          onSetAsReference={handleSetEditedAsReference}
        />
      )}

      {/* Toast 提示组件 */}
      {showToast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 animate-fade-in">
          <div className={`px-4 py-2.5 rounded-xl shadow-lg backdrop-blur-sm flex items-center gap-2 ${
            toastType === 'success' ? 'bg-emerald-500/90 text-white' :
            toastType === 'error' ? 'bg-red-500/90 text-white' :
            toastType === 'warning' ? 'bg-amber-500/90 text-white' :
            'bg-zinc-700/90 text-zinc-100'
          }`}>
            {toastType === 'success' && (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            )}
            {toastType === 'error' && (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            )}
            {toastType === 'warning' && (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            )}
            {toastType === 'info' && (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}
            <span className="text-sm font-medium">{toastMessage}</span>
          </div>
        </div>
      )}
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
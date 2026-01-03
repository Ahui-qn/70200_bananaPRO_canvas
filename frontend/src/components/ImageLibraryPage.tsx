import React, { useState, useEffect, useRef, useCallback } from 'react';
import { apiService } from '../services/api';
import { SavedImage, CanvasImage } from '../../../shared/types';
import { useProject } from '../contexts/ProjectContext';
import { ImagePreviewModal } from './ImagePreviewModal';
import {
  ArrowLeft,
  Image as ImageIcon,
  Heart,
  Download,
  Trash2,
  RefreshCw,
  AlertCircle,
  Search,
  Grid3X3,
  LayoutGrid,
  Calendar,
  Sparkles,
  X,
  FolderOpen,
  User,
  Loader2,
  Maximize2,
} from 'lucide-react';

interface ImageLibraryPageProps {
  onBack: () => void;
  onSelectImage?: (imageUrl: string) => void;
}

/**
 * 获取图片尺寸显示文本
 */
const getImageSizeText = (image: SavedImage): string => {
  if (image.width && image.height) {
    return `${image.width} × ${image.height}`;
  }
  return image.imageSize || '未知';
};

/**
 * 计算图片的宽高比样式
 */
const getImageAspectStyle = (image: SavedImage): React.CSSProperties => {
  const width = image.width || 400;
  const height = image.height || 400;
  return {
    aspectRatio: `${width} / ${height}`,
  };
};

export const ImageLibraryPage: React.FC<ImageLibraryPageProps> = ({
  onBack,
  onSelectImage,
}) => {
  const { projects } = useProject();
  const [images, setImages] = useState<SavedImage[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false); // 加载更多状态
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true); // 是否还有更多数据
  const [totalCount, setTotalCount] = useState(0);
  const [selectedImage, setSelectedImage] = useState<SavedImage | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterFavorite, setFilterFavorite] = useState<boolean | undefined>(undefined);
  const [filterProjectId, setFilterProjectId] = useState<string | undefined>(undefined);
  const [gridSize, setGridSize] = useState<'small' | 'large'>('large');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [previewImage, setPreviewImage] = useState<CanvasImage | null>(null);  // 预览模态框图片
  
  // 滚动容器引用
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  // 底部观察元素引用
  const loadMoreRef = useRef<HTMLDivElement>(null);

  // 初始加载和筛选条件变化时重置并加载
  useEffect(() => {
    setImages([]);
    setPage(1);
    setHasMore(true);
    loadImages(1, true);
  }, [filterFavorite, filterProjectId, searchQuery]);

  // 使用 Intersection Observer 实现无限滚动
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const first = entries[0];
        if (first.isIntersecting && hasMore && !loading && !loadingMore) {
          loadMoreImages();
        }
      },
      { threshold: 0.1 }
    );

    const currentRef = loadMoreRef.current;
    if (currentRef) {
      observer.observe(currentRef);
    }

    return () => {
      if (currentRef) {
        observer.unobserve(currentRef);
      }
    };
  }, [hasMore, loading, loadingMore, page]);

  // 加载更多图片
  const loadMoreImages = useCallback(() => {
    if (!hasMore || loading || loadingMore) return;
    const nextPage = page + 1;
    setPage(nextPage);
    loadImages(nextPage, false);
  }, [hasMore, loading, loadingMore, page]);

  // 加载图片详情（包含 ref_images）
  const loadImageDetail = async (imageId: string) => {
    try {
      setLoadingDetail(true);
      const response = await apiService.getImage(imageId);
      if (response.success && response.data) {
        setSelectedImage(response.data);
      }
    } catch (err) {
      console.error('加载图片详情失败:', err);
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleSelectImage = (image: SavedImage) => {
    // 先设置基本信息，然后异步加载完整详情
    setSelectedImage(image);
    loadImageDetail(image.id);
  };

  // 点击放大图标打开预览模态框
  const handlePreviewImage = (image: SavedImage, e?: React.MouseEvent) => {
    e?.stopPropagation();
    // 转换为 CanvasImage 格式
    const canvasImage: CanvasImage = {
      ...image,
      x: image.canvasX ?? 0,
      y: image.canvasY ?? 0,
      loadingState: 'loaded',
      isVisible: true,
    };
    setPreviewImage(canvasImage);
  };

  const loadImages = async (pageNum: number = 1, reset: boolean = false) => {
    try {
      if (reset) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }
      setError(null);

      const pageSize = gridSize === 'small' ? 24 : 20;
      const response = await apiService.getImages({
        page: pageNum,
        pageSize,
        sortBy: 'created_at',
        sortOrder: 'DESC',
        filters: {
          favorite: filterFavorite,
          search: searchQuery || undefined,
          projectId: filterProjectId,
        }
      });

      if (response.success && response.data) {
        const newImages = response.data.data || [];
        
        if (reset) {
          setImages(newImages);
        } else {
          setImages(prev => [...prev, ...newImages]);
        }
        
        setTotalCount(response.data.total || 0);
        setHasMore(response.data.hasNext || false);
      } else {
        setError(response.error || '加载图片失败');
      }
    } catch (err: any) {
      setError(err.message || '加载图片失败');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const handleSearch = () => {
    setImages([]);
    setPage(1);
    setHasMore(true);
    loadImages(1, true);
  };

  // 刷新列表
  const handleRefresh = () => {
    setImages([]);
    setPage(1);
    setHasMore(true);
    loadImages(1, true);
  };

  const handleToggleFavorite = async (image: SavedImage, e?: React.MouseEvent) => {
    e?.stopPropagation();
    try {
      const response = await apiService.updateImage(image.id, {
        favorite: !image.favorite,
      });

      if (response.success) {
        setImages((prev) =>
          prev.map((img) =>
            img.id === image.id ? { ...img, favorite: !img.favorite } : img
          )
        );
        if (selectedImage?.id === image.id) {
          setSelectedImage({ ...selectedImage, favorite: !selectedImage.favorite });
        }
      }
    } catch (err) {
      console.error('更新收藏状态失败:', err);
    }
  };

  const handleDelete = async (image: SavedImage) => {
    try {
      const response = await apiService.deleteImage(image.id);

      if (response.success) {
        setImages((prev) => prev.filter((img) => img.id !== image.id));
        if (selectedImage?.id === image.id) {
          setSelectedImage(null);
        }
        setShowDeleteConfirm(null);
      }
    } catch (err) {
      console.error('删除图片失败:', err);
    }
  };

  const handleDownload = (image: SavedImage, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const link = document.createElement('a');
    link.href = image.url;
    link.download = `nano-banana-${image.id}.png`;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const formatDate = (date: Date | string) => {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatRelativeDate = (date: Date | string) => {
    const d = typeof date === 'string' ? new Date(date) : date;
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days === 0) return '今天';
    if (days === 1) return '昨天';
    if (days < 7) return `${days} 天前`;
    if (days < 30) return `${Math.floor(days / 7)} 周前`;
    return `${Math.floor(days / 30)} 月前`;
  };

  return (
    <div className="w-screen h-screen bg-[#0a0a0b] overflow-hidden text-zinc-100 font-sans">
      {/* 点矩阵背景 */}
      <div className="absolute inset-0 dot-matrix-bg opacity-40" />
      
      {/* 顶部导航栏 */}
      <header className="relative z-20 glass border-b border-zinc-800/50">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            {/* 左侧：返回按钮和标题 */}
            <div className="flex items-center gap-4">
              <button
                onClick={onBack}
                className="btn-glass p-2.5 rounded-xl text-zinc-400 hover:text-zinc-100"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center">
                  <FolderIcon className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h1 className="font-semibold text-lg">图片库</h1>
                  <p className="text-xs text-zinc-500">共 {totalCount} 张图片</p>
                </div>
              </div>
            </div>

            {/* 中间：搜索栏 */}
            <div className="flex-1 max-w-xl mx-8">
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  placeholder="搜索提示词..."
                  className="input-glass w-full pl-10 pr-4 py-2.5 rounded-xl text-sm"
                />
              </div>
            </div>

            {/* 右侧：筛选和视图切换 */}
            <div className="flex items-center gap-2">
              {/* 项目筛选下拉框 */}
              <select
                value={filterProjectId || ''}
                onChange={(e) => {
                  setFilterProjectId(e.target.value || undefined);
                }}
                className="btn-glass px-3 py-2.5 rounded-xl text-sm text-zinc-300 bg-transparent border border-zinc-700 focus:outline-none focus:border-violet-500 cursor-pointer"
              >
                <option value="" className="bg-zinc-800">全部项目</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id} className="bg-zinc-800">
                    {project.name}
                  </option>
                ))}
              </select>

              <button
                onClick={() => setFilterFavorite(filterFavorite === true ? undefined : true)}
                className={`btn-glass flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm ${
                  filterFavorite === true ? 'text-red-400 border-red-500/30' : 'text-zinc-400'
                }`}
              >
                <Heart className="w-4 h-4" fill={filterFavorite === true ? 'currentColor' : 'none'} />
                <span>收藏</span>
              </button>
              
              <div className="flex items-center glass rounded-xl p-1">
                <button
                  onClick={() => setGridSize('large')}
                  className={`p-2 rounded-lg transition-colors ${
                    gridSize === 'large' ? 'bg-zinc-700 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  <LayoutGrid className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setGridSize('small')}
                  className={`p-2 rounded-lg transition-colors ${
                    gridSize === 'small' ? 'bg-zinc-700 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  <Grid3X3 className="w-4 h-4" />
                </button>
              </div>
              
              <button
                onClick={handleRefresh}
                disabled={loading}
                className="btn-glass p-2.5 rounded-xl text-zinc-400 hover:text-zinc-100"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* 主内容区域 */}
      <div className="relative z-10 flex h-[calc(100vh-73px)]">
        {/* 图片网格 */}
        <div 
          ref={scrollContainerRef}
          className="flex-1 overflow-y-auto p-6"
        >
          {loading && images.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="w-12 h-12 border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin mx-auto mb-4" />
                <p className="text-zinc-500">加载中...</p>
              </div>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-full">
              <div className="glass-card rounded-2xl p-8 text-center max-w-sm">
                <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
                <p className="text-zinc-300 mb-4">{error}</p>
                <button
                  onClick={handleRefresh}
                  className="btn-primary px-6 py-2.5 rounded-xl text-sm font-medium"
                >
                  重试
                </button>
              </div>
            </div>
          ) : images.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full">
              <div className="glass-card rounded-2xl p-8 text-center max-w-sm">
                <div className="w-16 h-16 glass rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <ImageIcon className="w-8 h-8 text-zinc-600" />
                </div>
                <h3 className="text-lg font-medium text-zinc-300 mb-2">暂无图片</h3>
                <p className="text-sm text-zinc-500">生成的图片将显示在这里</p>
              </div>
            </div>
          ) : (
            <>
              {/* 使用 CSS columns 实现 Masonry 布局，保持真实比例 */}
              <div className={`${
                gridSize === 'small' 
                  ? 'columns-2 sm:columns-3 md:columns-4 lg:columns-6 gap-4' 
                  : 'columns-1 sm:columns-2 md:columns-3 lg:columns-4 gap-4'
              }`}>
                {images.map((image) => (
                  <div
                    key={image.id}
                    className={`image-card relative group cursor-pointer rounded-xl overflow-hidden break-inside-avoid mb-4 ${
                      selectedImage?.id === image.id ? 'ring-2 ring-violet-500' : ''
                    }`}
                    onClick={() => handleSelectImage(image)}
                  >
                    <div className="relative">
                      <img
                        src={image.thumbnailUrl || image.url}
                        alt={image.prompt}
                        className="w-full object-cover"
                        style={getImageAspectStyle(image)}
                        loading="lazy"
                      />
                      
                      {/* 尺寸标签 - 左上角 */}
                      <div className="absolute top-2 left-2 px-1.5 py-0.5 bg-black/70 text-white text-xs rounded border border-white/20 backdrop-blur-sm">
                        {getImageSizeText(image)}
                      </div>
                      
                      {/* 悬浮遮罩 */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                      
                      {/* 悬浮操作按钮 */}
                      <div className="absolute top-2 right-2 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        {/* 放大预览按钮 */}
                        <button
                          onClick={(e) => handlePreviewImage(image, e)}
                          className="p-2 bg-black/40 text-white rounded-lg backdrop-blur-sm hover:bg-violet-500/80 transition-colors"
                          title="放大预览"
                        >
                          <Maximize2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={(e) => handleToggleFavorite(image, e)}
                          className={`p-2 rounded-lg backdrop-blur-sm transition-colors ${
                            image.favorite
                              ? 'bg-red-500/80 text-white'
                              : 'bg-black/40 text-white hover:bg-black/60'
                          }`}
                        >
                          <Heart className="w-3.5 h-3.5" fill={image.favorite ? 'currentColor' : 'none'} />
                        </button>
                        <button
                          onClick={(e) => handleDownload(image, e)}
                          className="p-2 bg-black/40 text-white rounded-lg backdrop-blur-sm hover:bg-black/60 transition-colors"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowDeleteConfirm(image.id);
                          }}
                          className="p-2 bg-black/40 text-white rounded-lg backdrop-blur-sm hover:bg-red-500/80 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* 收藏标记 */}
                      {image.favorite && !selectedImage && (
                        <div className="absolute top-10 left-2">
                          <Heart className="w-4 h-4 text-red-500 drop-shadow-lg" fill="currentColor" />
                        </div>
                      )}

                      {/* 底部信息 */}
                      <div className="absolute bottom-0 left-0 right-0 p-3 opacity-0 group-hover:opacity-100 transition-opacity">
                        <p className="text-xs text-white/80 line-clamp-2">{image.prompt}</p>
                        <div className="flex items-center gap-2 mt-1.5 text-xs text-white/60">
                          <span>{image.model}</span>
                          <span>•</span>
                          <span>{formatRelativeDate(image.createdAt)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* 无限滚动加载更多 */}
              <div 
                ref={loadMoreRef} 
                className="flex items-center justify-center py-8"
              >
                {loadingMore ? (
                  <div className="flex items-center gap-2 text-zinc-500">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span className="text-sm">加载更多...</span>
                  </div>
                ) : hasMore ? (
                  <div className="text-zinc-600 text-sm">向下滚动加载更多</div>
                ) : images.length > 0 ? (
                  <div className="text-zinc-600 text-sm">已加载全部 {totalCount} 张图片</div>
                ) : null}
              </div>
            </>
          )}
        </div>

        {/* 右侧详情面板 */}
        {selectedImage && (
          <aside className="w-96 glass border-l border-zinc-800/50 p-6 overflow-y-auto animate-fade-in">
            <div className="space-y-6">
              {/* 图片预览 */}
              <div className="relative rounded-xl overflow-hidden">
                <img
                  src={selectedImage.url}
                  alt={selectedImage.prompt}
                  className="w-full rounded-xl"
                />
                <button
                  onClick={() => setSelectedImage(null)}
                  className="absolute top-2 right-2 p-2 bg-black/50 rounded-lg backdrop-blur-sm hover:bg-black/70 transition-colors"
                >
                  <X className="w-4 h-4 text-white" />
                </button>
              </div>

              {/* 提示词 */}
              <div>
                <label className="flex items-center gap-2 text-xs text-zinc-500 mb-2">
                  <Sparkles className="w-3.5 h-3.5" />
                  提示词
                </label>
                <p className="text-sm text-zinc-300 leading-relaxed">
                  {selectedImage.prompt || '无'}
                </p>
              </div>

              {/* 详细信息 */}
              <div className="grid grid-cols-2 gap-4">
                <div className="glass-subtle rounded-xl p-3">
                  <label className="text-xs text-zinc-500 block mb-1">模型</label>
                  <p className="text-sm text-zinc-200 font-medium">{selectedImage.model}</p>
                </div>
                <div className="glass-subtle rounded-xl p-3">
                  <label className="text-xs text-zinc-500 block mb-1">像素尺寸</label>
                  <p className="text-sm text-zinc-200 font-medium">{getImageSizeText(selectedImage)}</p>
                </div>
                <div className="glass-subtle rounded-xl p-3">
                  <label className="text-xs text-zinc-500 block mb-1">宽高比</label>
                  <p className="text-sm text-zinc-200 font-medium">{selectedImage.aspectRatio}</p>
                </div>
                <div className="glass-subtle rounded-xl p-3">
                  <label className="text-xs text-zinc-500 block mb-1">创建时间</label>
                  <p className="text-sm text-zinc-200 font-medium">{formatRelativeDate(selectedImage.createdAt)}</p>
                </div>
              </div>

              {/* 完整时间 */}
              <div className="flex items-center gap-2 text-xs text-zinc-500">
                <Calendar className="w-3.5 h-3.5" />
                <span>{formatDate(selectedImage.createdAt)}</span>
              </div>

              {/* 所属项目和创建者信息 */}
              <div className="space-y-2">
                {/* 所属项目 */}
                <div className="flex items-center gap-2 text-xs">
                  <FolderOpen className="w-3.5 h-3.5 text-violet-400" />
                  <span className="text-zinc-500">所属项目：</span>
                  <span className="text-zinc-300">
                    {selectedImage.projectId 
                      ? (projects.find(p => p.id === selectedImage.projectId)?.name || '未知项目')
                      : '未分配'}
                  </span>
                </div>
                {/* 创建者 - 显示用户名称 */}
                {(selectedImage.userName || selectedImage.userId) && (
                  <div className="flex items-center gap-2 text-xs">
                    <User className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-zinc-500">创建者：</span>
                    <span className="text-zinc-300">
                      {selectedImage.userName || (selectedImage.userId === 'default' ? '系统默认' : '未知用户')}
                    </span>
                  </div>
                )}
              </div>

              {/* 参考图片展示 */}
              {loadingDetail ? (
                <div className="flex items-center justify-center py-4">
                  <div className="w-5 h-5 border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin" />
                </div>
              ) : selectedImage.refImages && selectedImage.refImages.length > 0 && (
                <div>
                  <label className="flex items-center gap-2 text-xs text-zinc-500 mb-2">
                    <ImageIcon className="w-3.5 h-3.5" />
                    参考图片 ({selectedImage.refImages.length})
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {selectedImage.refImages.map((refImg: any, index: number) => (
                      <div key={refImg.id || index} className="relative group rounded-lg overflow-hidden">
                        <img
                          src={refImg.url || refImg.ossUrl || refImg.preview || refImg}
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
              <div className="flex gap-2">
                <button
                  onClick={() => handleToggleFavorite(selectedImage)}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
                    selectedImage.favorite
                      ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                      : 'btn-glass text-zinc-300'
                  }`}
                >
                  <Heart className="w-4 h-4" fill={selectedImage.favorite ? 'currentColor' : 'none'} />
                  {selectedImage.favorite ? '已收藏' : '收藏'}
                </button>
                <button
                  onClick={() => handleDownload(selectedImage)}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 btn-glass rounded-xl text-sm font-medium text-zinc-300"
                >
                  <Download className="w-4 h-4" />
                  下载
                </button>
              </div>

              {onSelectImage && (
                <button
                  onClick={() => {
                    onSelectImage(selectedImage.url);
                    onBack();
                  }}
                  className="btn-primary w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-medium"
                >
                  <ImageIcon className="w-4 h-4" />
                  使用此图片
                </button>
              )}

              <button
                onClick={() => setShowDeleteConfirm(selectedImage.id)}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-medium text-red-400 hover:bg-red-500/10 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                删除图片
              </button>
            </div>
          </aside>
        )}
      </div>

      {/* 删除确认弹窗 */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="glass-card rounded-2xl p-6 max-w-sm w-full mx-4 animate-fade-in">
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-4">
                <Trash2 className="w-6 h-6 text-red-400" />
              </div>
              <h3 className="text-lg font-semibold text-zinc-100 mb-2">确认删除</h3>
              <p className="text-sm text-zinc-400 mb-6">删除后将无法恢复，确定要删除这张图片吗？</p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowDeleteConfirm(null)}
                  className="flex-1 btn-glass px-4 py-2.5 rounded-xl text-sm font-medium text-zinc-300"
                >
                  取消
                </button>
                <button
                  onClick={() => {
                    const image = images.find(img => img.id === showDeleteConfirm);
                    if (image) handleDelete(image);
                  }}
                  className="flex-1 bg-red-600 hover:bg-red-700 px-4 py-2.5 rounded-xl text-sm font-medium text-white transition-colors"
                >
                  删除
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 图片预览模态框 */}
      <ImagePreviewModal
        image={previewImage}
        isOpen={!!previewImage}
        onClose={() => setPreviewImage(null)}
        onFavorite={async (imageId) => {
          const image = images.find(img => img.id === imageId);
          if (image) {
            await handleToggleFavorite(image);
            // 更新预览图片的收藏状态
            if (previewImage && previewImage.id === imageId) {
              setPreviewImage({ ...previewImage, favorite: !previewImage.favorite });
            }
          }
        }}
        onDownload={(image) => handleDownload(image as SavedImage)}
      />
    </div>
  );
};

// 文件夹图标组件
const FolderIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
  </svg>
);

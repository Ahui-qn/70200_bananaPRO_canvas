import React, { useState, useEffect } from 'react';
import { apiService } from '../services/api';
import { SavedImage } from '../../../shared/types';
import {
  ArrowLeft,
  Image as ImageIcon,
  Heart,
  Download,
  Trash2,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  Search,
  Grid3X3,
  LayoutGrid,
  Calendar,
  Sparkles,
  X,
} from 'lucide-react';

interface ImageLibraryPageProps {
  onBack: () => void;
  onSelectImage?: (imageUrl: string) => void;
}

export const ImageLibraryPage: React.FC<ImageLibraryPageProps> = ({
  onBack,
  onSelectImage,
}) => {
  const [images, setImages] = useState<SavedImage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [selectedImage, setSelectedImage] = useState<SavedImage | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterFavorite, setFilterFavorite] = useState<boolean | undefined>(undefined);
  const [gridSize, setGridSize] = useState<'small' | 'large'>('large');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  useEffect(() => {
    loadImages();
  }, [page, filterFavorite]);

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

  const loadImages = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await apiService.getImages({
        page,
        pageSize: gridSize === 'small' ? 24 : 12,
        sortBy: 'created_at',
        sortOrder: 'DESC',
        filters: {
          favorite: filterFavorite,
          search: searchQuery || undefined,
        }
      });

      if (response.success && response.data) {
        setImages(response.data.data || []);
        setTotalPages(response.data.totalPages || 1);
        setTotalCount(response.data.total || 0);
      } else {
        setError(response.error || '加载图片失败');
      }
    } catch (err: any) {
      setError(err.message || '加载图片失败');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    setPage(1);
    loadImages();
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
                onClick={loadImages}
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
        <div className="flex-1 overflow-y-auto p-6">
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
                  onClick={loadImages}
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
              <div className={`grid gap-4 ${
                gridSize === 'small' 
                  ? 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6' 
                  : 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4'
              }`}>
                {images.map((image) => (
                  <div
                    key={image.id}
                    className={`image-card relative group cursor-pointer rounded-xl overflow-hidden ${
                      selectedImage?.id === image.id ? 'ring-2 ring-violet-500' : ''
                    }`}
                    onClick={() => handleSelectImage(image)}
                  >
                    <div className={`relative ${gridSize === 'small' ? 'aspect-square' : 'aspect-[4/3]'}`}>
                      <img
                        src={image.url}
                        alt={image.prompt}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                      
                      {/* 悬浮遮罩 */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                      
                      {/* 悬浮操作按钮 */}
                      <div className="absolute top-2 right-2 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
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
                      {image.favorite && (
                        <div className="absolute top-2 left-2">
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

              {/* 分页 */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-4 mt-8 pb-4">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="btn-glass p-2.5 rounded-xl disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <div className="flex items-center gap-2">
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let pageNum;
                      if (totalPages <= 5) {
                        pageNum = i + 1;
                      } else if (page <= 3) {
                        pageNum = i + 1;
                      } else if (page >= totalPages - 2) {
                        pageNum = totalPages - 4 + i;
                      } else {
                        pageNum = page - 2 + i;
                      }
                      return (
                        <button
                          key={pageNum}
                          onClick={() => setPage(pageNum)}
                          className={`w-10 h-10 rounded-xl text-sm font-medium transition-colors ${
                            page === pageNum
                              ? 'bg-violet-600 text-white'
                              : 'btn-glass text-zinc-400 hover:text-zinc-100'
                          }`}
                        >
                          {pageNum}
                        </button>
                      );
                    })}
                  </div>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="btn-glass p-2.5 rounded-xl disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
              )}
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
                  <label className="text-xs text-zinc-500 block mb-1">尺寸</label>
                  <p className="text-sm text-zinc-200 font-medium">{selectedImage.imageSize}</p>
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
    </div>
  );
};

// 文件夹图标组件
const FolderIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
  </svg>
);

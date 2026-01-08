import React, { useState, useEffect } from 'react';
import { apiService } from '../services/api';
import { SavedImage } from '../../../shared/types';
import { downloadImage, generateDownloadFilename } from '../utils/downloadUtils';
import {
  X,
  Image as ImageIcon,
  Heart,
  Download,
  Trash2,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
} from 'lucide-react';

interface ImageLibraryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectImage?: (imageUrl: string) => void;
}

/**
 * 计算图片在网格中的显示尺寸
 * 保持真实宽高比，限制最大高度
 */
const getImageDisplayStyle = (image: SavedImage): React.CSSProperties => {
  const width = image.width || 400;
  const height = image.height || 400;
  const aspectRatio = width / height;
  
  // 基础宽度由 CSS grid 控制，这里只设置宽高比
  return {
    aspectRatio: `${width} / ${height}`,
  };
};

/**
 * 获取图片尺寸显示文本
 */
const getImageSizeText = (image: SavedImage): string => {
  if (image.width && image.height) {
    return `${image.width} × ${image.height}`;
  }
  return image.imageSize || '未知';
};

export const ImageLibraryModal: React.FC<ImageLibraryModalProps> = ({
  isOpen,
  onClose,
  onSelectImage,
}) => {
  const [images, setImages] = useState<SavedImage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedImage, setSelectedImage] = useState<SavedImage | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadImages();
    }
  }, [isOpen, page]);

  const loadImages = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await apiService.getImages({
        page,
        pageSize: 12,
        sortBy: 'created_at',
        sortOrder: 'DESC',
      });

      if (response.success && response.data) {
        setImages(response.data.data || []);
        setTotalPages(response.data.totalPages || 1);
      } else {
        setError(response.error || '加载图片失败');
      }
    } catch (err: any) {
      setError(err.message || '加载图片失败');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleFavorite = async (image: SavedImage) => {
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
      }
    } catch (err) {
      console.error('更新收藏状态失败:', err);
    }
  };

  const handleDelete = async (image: SavedImage) => {
    if (!confirm('确定要删除这张图片吗？')) return;

    try {
      const response = await apiService.deleteImage(image.id);

      if (response.success) {
        setImages((prev) => prev.filter((img) => img.id !== image.id));
        if (selectedImage?.id === image.id) {
          setSelectedImage(null);
        }
      }
    } catch (err) {
      console.error('删除图片失败:', err);
    }
  };

  const handleDownload = (image: SavedImage) => {
    // 使用 blob 方式下载，触发系统保存对话框
    downloadImage(image.url, generateDownloadFilename(image.id));
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-zinc-900 rounded-xl border border-zinc-700 w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* 头部 */}
        <div className="flex items-center justify-between p-6 border-b border-zinc-700">
          <div className="flex items-center gap-3">
            <ImageIcon className="w-5 h-5 text-purple-400" />
            <h2 className="text-lg font-semibold text-zinc-100">图片库</h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={loadImages}
              disabled={loading}
              className="p-2 hover:bg-zinc-800 rounded-lg transition-colors"
              title="刷新"
            >
              <RefreshCw
                className={`w-5 h-5 text-zinc-400 ${loading ? 'animate-spin' : ''}`}
              />
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-zinc-800 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-zinc-400" />
            </button>
          </div>
        </div>

        {/* 内容区域 */}
        <div className="flex-1 overflow-hidden flex">
          {/* 图片网格 */}
          <div className="flex-1 overflow-y-auto p-6">
            {loading ? (
              <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-400"></div>
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center h-64 text-zinc-400">
                <AlertCircle className="w-12 h-12 mb-4 text-red-400" />
                <p>{error}</p>
                <button
                  onClick={loadImages}
                  className="mt-4 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors"
                >
                  重试
                </button>
              </div>
            ) : images.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-zinc-400">
                <ImageIcon className="w-12 h-12 mb-4" />
                <p>暂无图片</p>
                <p className="text-sm mt-2">生成的图片将显示在这里</p>
              </div>
            ) : (
              <div className="columns-2 md:columns-3 lg:columns-4 gap-4 space-y-4">
                {images.map((image) => (
                  <div
                    key={image.id}
                    className={`relative group cursor-pointer rounded-lg overflow-hidden border-2 transition-all break-inside-avoid mb-4 ${
                      selectedImage?.id === image.id
                        ? 'border-purple-500'
                        : 'border-transparent hover:border-zinc-600'
                    }`}
                    onClick={() => setSelectedImage(image)}
                  >
                    <img
                      src={image.thumbnailUrl || image.url}
                      alt={image.prompt}
                      className="w-full object-cover"
                      style={getImageDisplayStyle(image)}
                      loading="lazy"
                    />

                    {/* 尺寸标签 - 左上角 */}
                    <div className="absolute top-2 left-2 px-1.5 py-0.5 bg-black/70 text-white text-xs rounded border border-white/20">
                      {getImageSizeText(image)}
                    </div>

                    {/* 悬浮操作 */}
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleFavorite(image);
                        }}
                        className={`p-2 rounded-full transition-colors ${
                          image.favorite
                            ? 'bg-red-500 text-white'
                            : 'bg-white/20 text-white hover:bg-white/30'
                        }`}
                      >
                        <Heart
                          className="w-4 h-4"
                          fill={image.favorite ? 'currentColor' : 'none'}
                        />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDownload(image);
                        }}
                        className="p-2 bg-white/20 text-white rounded-full hover:bg-white/30 transition-colors"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(image);
                        }}
                        className="p-2 bg-white/20 text-white rounded-full hover:bg-red-500 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    {/* 收藏标记 */}
                    {image.favorite && (
                      <div className="absolute top-2 right-2">
                        <Heart className="w-4 h-4 text-red-500" fill="currentColor" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* 分页 */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-4 mt-6">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="p-2 bg-zinc-800 hover:bg-zinc-700 disabled:bg-zinc-800 disabled:text-zinc-600 rounded-lg transition-colors"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <span className="text-zinc-400">
                  {page} / {totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="p-2 bg-zinc-800 hover:bg-zinc-700 disabled:bg-zinc-800 disabled:text-zinc-600 rounded-lg transition-colors"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            )}
          </div>

          {/* 详情面板 */}
          {selectedImage && (
            <div className="w-80 border-l border-zinc-700 p-6 overflow-y-auto">
              <img
                src={selectedImage.url}
                alt={selectedImage.prompt}
                className="w-full rounded-lg mb-4"
              />

              <div className="space-y-4">
                <div>
                  <label className="block text-xs text-zinc-500 mb-1">提示词</label>
                  <p className="text-sm text-zinc-300">{selectedImage.prompt || '无'}</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-zinc-500 mb-1">模型</label>
                    <p className="text-sm text-zinc-300">{selectedImage.model}</p>
                  </div>
                  <div>
                    <label className="block text-xs text-zinc-500 mb-1">像素尺寸</label>
                    <p className="text-sm text-zinc-300">{getImageSizeText(selectedImage)}</p>
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-zinc-500 mb-1">宽高比</label>
                  <p className="text-sm text-zinc-300">{selectedImage.aspectRatio}</p>
                </div>

                <div>
                  <label className="block text-xs text-zinc-500 mb-1">创建时间</label>
                  <p className="text-sm text-zinc-300">
                    {formatDate(selectedImage.createdAt)}
                  </p>
                </div>

                <div className="flex gap-2 pt-4">
                  <button
                    onClick={() => handleToggleFavorite(selectedImage)}
                    className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg transition-colors ${
                      selectedImage.favorite
                        ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                        : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                    }`}
                  >
                    <Heart
                      className="w-4 h-4"
                      fill={selectedImage.favorite ? 'currentColor' : 'none'}
                    />
                    {selectedImage.favorite ? '已收藏' : '收藏'}
                  </button>
                  <button
                    onClick={() => handleDownload(selectedImage)}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-zinc-800 text-zinc-300 hover:bg-zinc-700 rounded-lg transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    下载
                  </button>
                </div>

                {onSelectImage && (
                  <button
                    onClick={() => {
                      onSelectImage(selectedImage.url);
                      onClose();
                    }}
                    className="w-full px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
                  >
                    使用此图片
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import { SavedImage } from '../types';
import { imageStorage, downloadImage } from '../services/imageStorage';
import { ossStorage, loadOSSConfig } from '../services/ossStorage';
import { 
  X, 
  Search, 
  Download, 
  Heart, 
  Trash2, 
  Filter,
  Calendar,
  Image as ImageIcon,
  Star,
  Grid3X3,
  List,
  MoreVertical,
  Cloud,
  Upload,
  CheckCircle
} from 'lucide-react';

interface ImageLibraryProps {
  isOpen: boolean;
  onClose: () => void;
}

type ViewMode = 'grid' | 'list';
type FilterMode = 'all' | 'favorites' | 'recent';

export const ImageLibrary: React.FC<ImageLibraryProps> = ({ isOpen, onClose }) => {
  const [images, setImages] = useState<SavedImage[]>([]);
  const [filteredImages, setFilteredImages] = useState<SavedImage[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedModel, setSelectedModel] = useState<string>('all');
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [selectedImages, setSelectedImages] = useState<Set<string>>(new Set());
  const [stats, setStats] = useState({
    totalImages: 0,
    favoriteCount: 0,
    modelStats: {} as Record<string, number>,
    recentCount: 0
  });
  const [ossConfigured, setOssConfigured] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ completed: 0, total: 0 });

  // 加载图片数据
  const loadImages = async () => {
    setLoading(true);
    try {
      const allImages = await imageStorage.getAllImages();
      const statsData = await imageStorage.getStats();
      
      setImages(allImages);
      setStats(statsData);
      applyFilters(allImages);
      
      // 检查 OSS 配置状态
      const ossConfig = loadOSSConfig();
      setOssConfigured(ossConfig !== null && ossStorage.isConfigured());
    } catch (error) {
      console.error('加载图片失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // 应用筛选条件
  const applyFilters = (imageList: SavedImage[] = images) => {
    let filtered = [...imageList];

    // 按筛选模式过滤
    switch (filterMode) {
      case 'favorites':
        filtered = filtered.filter(img => img.favorite);
        break;
      case 'recent':
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        filtered = filtered.filter(img => new Date(img.createdAt) > oneDayAgo);
        break;
    }

    // 按模型过滤
    if (selectedModel !== 'all') {
      filtered = filtered.filter(img => img.model === selectedModel);
    }

    // 按搜索词过滤
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(img => 
        img.prompt.toLowerCase().includes(query) ||
        img.model.toLowerCase().includes(query) ||
        (img.tags && img.tags.some(tag => tag.toLowerCase().includes(query)))
      );
    }

    setFilteredImages(filtered);
  };

  // 切换收藏状态
  const toggleFavorite = async (imageId: string) => {
    try {
      const image = images.find(img => img.id === imageId);
      if (!image) return;

      await imageStorage.updateImage(imageId, { favorite: !image.favorite });
      await loadImages(); // 重新加载数据
    } catch (error) {
      console.error('更新收藏状态失败:', error);
    }
  };

  // 删除图片
  const deleteImage = async (imageId: string) => {
    if (!confirm('确定要删除这张图片吗？')) return;

    try {
      await imageStorage.deleteImage(imageId);
      await loadImages(); // 重新加载数据
    } catch (error) {
      console.error('删除图片失败:', error);
    }
  };

  // 下载图片
  const handleDownload = async (image: SavedImage) => {
    try {
      const filename = `${image.prompt.slice(0, 20).replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_')}_${image.id}.jpg`;
      await downloadImage(image.url, filename);
    } catch (error) {
      console.error('下载失败:', error);
      alert('下载失败，请重试');
    }
  };

  // 批量操作
  const handleBatchDownload = async () => {
    const selectedImageList = images.filter(img => selectedImages.has(img.id));
    
    for (const image of selectedImageList) {
      await handleDownload(image);
      // 添加延迟避免浏览器限制
      await new Promise(resolve => setTimeout(resolve, 300));
    }
    
    setSelectedImages(new Set());
  };

  const handleBatchDelete = async () => {
    if (!confirm(`确定要删除选中的 ${selectedImages.size} 张图片吗？`)) return;

    try {
      for (const imageId of selectedImages) {
        await imageStorage.deleteImage(imageId);
      }
      setSelectedImages(new Set());
      await loadImages();
    } catch (error) {
      console.error('批量删除失败:', error);
    }
  };

  // 批量上传到 OSS
  const handleBatchUploadToOSS = async () => {
    if (!ossConfigured) {
      alert('请先配置 OSS 云存储');
      return;
    }

    const selectedImageList = images.filter(img => 
      selectedImages.has(img.id) && !img.ossUploaded
    );

    if (selectedImageList.length === 0) {
      alert('没有需要上传的图片（已选择的图片都已上传到 OSS）');
      return;
    }

    if (!confirm(`确定要将选中的 ${selectedImageList.length} 张图片上传到 OSS 吗？`)) return;

    setUploading(true);
    setUploadProgress({ completed: 0, total: selectedImageList.length });

    try {
      for (let i = 0; i < selectedImageList.length; i++) {
        const image = selectedImageList[i];
        
        try {
          const updatedImage = await ossStorage.saveImageToOSS(image);
          
          // 更新本地记录
          await imageStorage.updateImage(image.id, {
            url: updatedImage.url,
            originalUrl: image.url,
            ossKey: updatedImage.ossKey,
            ossUploaded: true
          });
          
          setUploadProgress({ completed: i + 1, total: selectedImageList.length });
          
        } catch (error) {
          console.error(`上传图片 ${image.id} 失败:`, error);
        }
        
        // 添加延迟避免请求过于频繁
        if (i < selectedImageList.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
      
      // 重新加载数据
      await loadImages();
      setSelectedImages(new Set());
      
    } catch (error) {
      console.error('批量上传失败:', error);
    } finally {
      setUploading(false);
      setUploadProgress({ completed: 0, total: 0 });
    }
  };

  // 切换图片选择
  const toggleImageSelection = (imageId: string) => {
    const newSelection = new Set(selectedImages);
    if (newSelection.has(imageId)) {
      newSelection.delete(imageId);
    } else {
      newSelection.add(imageId);
    }
    setSelectedImages(newSelection);
  };

  // 获取可用的模型列表
  const availableModels = Object.keys(stats.modelStats);

  // 组件挂载时加载数据
  useEffect(() => {
    if (isOpen) {
      loadImages();
    }
  }, [isOpen]);

  // 筛选条件变化时重新应用筛选
  useEffect(() => {
    applyFilters();
  }, [searchQuery, selectedModel, filterMode, images]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* 背景遮罩 */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* 侧边栏 */}
      <div className="relative w-80 bg-zinc-900/95 backdrop-blur-xl border-r border-zinc-700 flex flex-col">
        
        {/* 头部 */}
        <div className="flex items-center justify-between p-6 border-b border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-purple-600/20 rounded-lg flex items-center justify-center">
              <ImageIcon className="w-4 h-4 text-purple-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-zinc-100">图片库</h2>
              <p className="text-sm text-zinc-500">管理生成的图片</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 统计信息 */}
        <div className="p-6 border-b border-zinc-800">
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-zinc-800/50 rounded-lg p-3">
              <div className="text-2xl font-bold text-zinc-100">{stats.totalImages}</div>
              <div className="text-xs text-zinc-500">总图片数</div>
            </div>
            <div className="bg-zinc-800/50 rounded-lg p-3">
              <div className="text-2xl font-bold text-purple-400">{stats.favoriteCount}</div>
              <div className="text-xs text-zinc-500">收藏数</div>
            </div>
          </div>
          
          {/* OSS 状态统计 */}
          {ossConfigured && (
            <div className="mt-4 bg-blue-600/10 border border-blue-600/20 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-2">
                <Cloud className="w-4 h-4 text-blue-400" />
                <span className="text-sm font-medium text-blue-300">云存储状态</span>
              </div>
              <div className="text-xs text-blue-200">
                {images.filter(img => img.ossUploaded).length} / {images.length} 张已上传
              </div>
            </div>
          )}
        </div>

        {/* 筛选选项 */}
        <div className="p-6 space-y-4">
          <div>
            <label className="text-sm font-medium text-zinc-300 mb-2 block">筛选</label>
            <div className="space-y-2">
              <button
                onClick={() => setFilterMode('all')}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                  filterMode === 'all' 
                    ? 'bg-purple-600/20 text-purple-300' 
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
                }`}
              >
                全部图片
              </button>
              <button
                onClick={() => setFilterMode('favorites')}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                  filterMode === 'favorites' 
                    ? 'bg-purple-600/20 text-purple-300' 
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
                }`}
              >
                <Heart className="w-4 h-4 inline mr-2" />
                收藏图片
              </button>
              <button
                onClick={() => setFilterMode('recent')}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                  filterMode === 'recent' 
                    ? 'bg-purple-600/20 text-purple-300' 
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
                }`}
              >
                <Calendar className="w-4 h-4 inline mr-2" />
                最近24小时
              </button>
            </div>
          </div>

          {/* 模型筛选 */}
          {availableModels.length > 0 && (
            <div>
              <label className="text-sm font-medium text-zinc-300 mb-2 block">模型</label>
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                className="w-full bg-zinc-800/50 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
              >
                <option value="all">全部模型</option>
                {availableModels.map(model => (
                  <option key={model} value={model}>
                    {model} ({stats.modelStats[model]})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* 主内容区域 */}
      <div className="flex-1 flex flex-col bg-zinc-900/95 backdrop-blur-xl">
        
        {/* 工具栏 */}
        <div className="flex items-center justify-between p-6 border-b border-zinc-800">
          <div className="flex items-center gap-4">
            {/* 搜索框 */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="搜索图片..."
                className="pl-10 pr-4 py-2 bg-zinc-800/50 border border-zinc-700 rounded-lg text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 w-64"
              />
            </div>

            {/* 视图切换 */}
            <div className="flex items-center bg-zinc-800/50 rounded-lg p-1">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded ${viewMode === 'grid' ? 'bg-purple-600/20 text-purple-300' : 'text-zinc-400 hover:text-zinc-200'}`}
              >
                <Grid3X3 className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 rounded ${viewMode === 'list' ? 'bg-purple-600/20 text-purple-300' : 'text-zinc-400 hover:text-zinc-200'}`}
              >
                <List className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* 批量操作 */}
          {selectedImages.size > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-zinc-400">已选择 {selectedImages.size} 张</span>
              
              {ossConfigured && (
                <button
                  onClick={handleBatchUploadToOSS}
                  disabled={uploading}
                  className="px-3 py-2 bg-blue-600/20 text-blue-300 rounded-lg text-sm hover:bg-blue-600/30 transition-colors disabled:opacity-50"
                >
                  <Cloud className="w-4 h-4 inline mr-1" />
                  {uploading ? `上传中 ${uploadProgress.completed}/${uploadProgress.total}` : '上传到 OSS'}
                </button>
              )}
              
              <button
                onClick={handleBatchDownload}
                className="px-3 py-2 bg-green-600/20 text-green-300 rounded-lg text-sm hover:bg-green-600/30 transition-colors"
              >
                <Download className="w-4 h-4 inline mr-1" />
                下载
              </button>
              <button
                onClick={handleBatchDelete}
                className="px-3 py-2 bg-red-600/20 text-red-300 rounded-lg text-sm hover:bg-red-600/30 transition-colors"
              >
                <Trash2 className="w-4 h-4 inline mr-1" />
                删除
              </button>
            </div>
          )}
        </div>

        {/* 图片列表 */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-zinc-500">加载中...</div>
            </div>
          ) : filteredImages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-zinc-500">
              <ImageIcon className="w-12 h-12 mb-4 opacity-50" />
              <p>暂无图片</p>
              <p className="text-sm">生成一些图片后会显示在这里</p>
            </div>
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {filteredImages.map((image) => (
                <div key={image.id} className="group relative bg-zinc-800/50 rounded-lg overflow-hidden">
                  <div className="aspect-square relative">
                    <img
                      src={image.url}
                      alt={image.prompt}
                      className="w-full h-full object-cover"
                    />
                    
                    {/* 选择框 */}
                    <div className="absolute top-2 left-2">
                      <input
                        type="checkbox"
                        checked={selectedImages.has(image.id)}
                        onChange={() => toggleImageSelection(image.id)}
                        className="w-4 h-4 rounded border-zinc-600 bg-zinc-800/80 text-purple-600 focus:ring-purple-500/50"
                      />
                    </div>

                    {/* 收藏按钮 */}
                    <button
                      onClick={() => toggleFavorite(image.id)}
                      className="absolute top-2 right-2 p-1 bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Heart className={`w-4 h-4 ${image.favorite ? 'text-red-400 fill-current' : 'text-white'}`} />
                    </button>

                    {/* OSS 状态指示器 */}
                    {image.ossUploaded && (
                      <div className="absolute top-2 left-8 p-1 bg-blue-600/80 rounded-full">
                        <Cloud className="w-3 h-3 text-white" />
                      </div>
                    )}

                    {/* 操作按钮 */}
                    <div className="absolute bottom-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => handleDownload(image)}
                        className="p-1 bg-black/50 rounded-full text-white hover:bg-black/70"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => deleteImage(image.id)}
                        className="p-1 bg-black/50 rounded-full text-white hover:bg-black/70"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* 图片信息 */}
                  <div className="p-3">
                    <p className="text-sm text-zinc-200 line-clamp-2 mb-1">{image.prompt}</p>
                    <div className="flex items-center justify-between text-xs text-zinc-500">
                      <span>{image.model}</span>
                      <span>{new Date(image.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {filteredImages.map((image) => (
                <div key={image.id} className="flex items-center gap-4 p-4 bg-zinc-800/50 rounded-lg hover:bg-zinc-800/70 transition-colors">
                  <input
                    type="checkbox"
                    checked={selectedImages.has(image.id)}
                    onChange={() => toggleImageSelection(image.id)}
                    className="w-4 h-4 rounded border-zinc-600 bg-zinc-800/80 text-purple-600 focus:ring-purple-500/50"
                  />
                  
                  <img
                    src={image.url}
                    alt={image.prompt}
                    className="w-16 h-16 object-cover rounded-lg"
                  />
                  
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-zinc-200 truncate">{image.prompt}</p>
                    <div className="flex items-center gap-4 text-xs text-zinc-500 mt-1">
                      <span>{image.model}</span>
                      <span>{image.aspectRatio}</span>
                      <span>{image.imageSize}</span>
                      <span>{new Date(image.createdAt).toLocaleString()}</span>
                      {image.ossUploaded && (
                        <span className="flex items-center gap-1 text-blue-400">
                          <Cloud className="w-3 h-3" />
                          已上传 OSS
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => toggleFavorite(image.id)}
                      className="p-2 hover:bg-zinc-700 rounded-lg transition-colors"
                    >
                      <Heart className={`w-4 h-4 ${image.favorite ? 'text-red-400 fill-current' : 'text-zinc-400'}`} />
                    </button>
                    <button
                      onClick={() => handleDownload(image)}
                      className="p-2 hover:bg-zinc-700 rounded-lg text-zinc-400 hover:text-zinc-200 transition-colors"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => deleteImage(image.id)}
                      className="p-2 hover:bg-zinc-700 rounded-lg text-zinc-400 hover:text-red-400 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
import React, { useState, useEffect } from 'react';
import { SavedImage, PaginationOptions, PaginatedResult } from '../types';
import { databaseService } from '../services/databaseService';
import { downloadImage } from './utils/downloadUtils';
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
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  RefreshCw
} from 'lucide-react';

interface ImageLibraryProps {
  isOpen: boolean;
  onClose: () => void;
}

type ViewMode = 'grid' | 'list';
type FilterMode = 'all' | 'favorites' | 'recent';

export const ImageLibrary: React.FC<ImageLibraryProps> = ({ isOpen, onClose }) => {
  const [paginatedResult, setPaginatedResult] = useState<PaginatedResult<SavedImage>>({
    data: [],
    total: 0,
    page: 1,
    pageSize: 20,
    totalPages: 0,
    hasNext: false,
    hasPrev: false
  });
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
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(20);
  const [isConnected, setIsConnected] = useState(false);

  // 加载图片数据
  const loadImages = async (page: number = currentPage, resetSelection: boolean = true) => {
    setLoading(true);
    
    if (resetSelection) {
      setSelectedImages(new Set());
    }
    
    try {
      // 检查数据库连接状态
      const connectionStatus = databaseService.getConnectionStatus();
      setIsConnected(connectionStatus.isConnected);
      
      if (!connectionStatus.isConnected) {
        console.warn('数据库未连接，无法加载图片');
        setPaginatedResult({
          data: [],
          total: 0,
          page: 1,
          pageSize,
          totalPages: 0,
          hasNext: false,
          hasPrev: false
        });
        setStats({
          totalImages: 0,
          favoriteCount: 0,
          modelStats: {},
          recentCount: 0
        });
        return;
      }

      // 构建分页选项
      const paginationOptions: PaginationOptions = {
        page,
        pageSize,
        sortBy: 'created_at',
        sortOrder: 'DESC',
        filters: {}
      };

      // 应用筛选条件
      if (filterMode === 'favorites') {
        paginationOptions.filters!.favorite = true;
      } else if (filterMode === 'recent') {
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        paginationOptions.filters!.dateRange = {
          start: oneDayAgo,
          end: new Date()
        };
      }

      if (selectedModel !== 'all') {
        paginationOptions.filters!.model = selectedModel;
      }

      if (searchQuery.trim()) {
        paginationOptions.filters!.search = searchQuery.trim();
      }

      // 从数据库获取分页数据
      const result = await databaseService.getImages(paginationOptions);
      setPaginatedResult(result);
      setCurrentPage(page);

      // 获取统计信息
      const imageStats = await databaseService.getImageStatistics();
      setStats({
        totalImages: imageStats.totalImages,
        favoriteCount: imageStats.favoriteImages,
        modelStats: imageStats.byModel,
        recentCount: imageStats.byTimeRange.today
      });
      
      // 检查 OSS 配置状态
      const ossConfig = loadOSSConfig();
      setOssConfigured(ossConfig !== null && ossStorage.isConfigured());
      
    } catch (error) {
      console.error('加载图片失败:', error);
      // 显示错误状态
      setPaginatedResult({
        data: [],
        total: 0,
        page: 1,
        pageSize,
        totalPages: 0,
        hasNext: false,
        hasPrev: false
      });
    } finally {
      setLoading(false);
    }
  };

  // 切换收藏状态
  const toggleFavorite = async (imageId: string) => {
    if (!isConnected) {
      alert('数据库未连接，无法更新收藏状态');
      return;
    }

    try {
      const image = paginatedResult.data.find(img => img.id === imageId);
      if (!image) return;

      await databaseService.updateImage(imageId, { favorite: !image.favorite });
      await loadImages(currentPage, false); // 重新加载当前页数据，不重置选择
    } catch (error) {
      console.error('更新收藏状态失败:', error);
      alert('更新收藏状态失败，请重试');
    }
  };

  // 删除图片
  const deleteImage = async (imageId: string) => {
    if (!isConnected) {
      alert('数据库未连接，无法删除图片');
      return;
    }

    if (!confirm('确定要删除这张图片吗？')) return;

    try {
      await databaseService.deleteImage(imageId, true); // 启用级联删除
      await loadImages(currentPage, false); // 重新加载当前页数据
    } catch (error) {
      console.error('删除图片失败:', error);
      alert('删除图片失败，请重试');
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
    const selectedImageList = paginatedResult.data.filter(img => selectedImages.has(img.id));
    
    for (const image of selectedImageList) {
      await handleDownload(image);
      // 添加延迟避免浏览器限制
      await new Promise(resolve => setTimeout(resolve, 300));
    }
    
    setSelectedImages(new Set());
  };

  const handleBatchDelete = async () => {
    if (!isConnected) {
      alert('数据库未连接，无法删除图片');
      return;
    }

    if (!confirm(`确定要删除选中的 ${selectedImages.size} 张图片吗？`)) return;

    try {
      const deletePromises = Array.from(selectedImages).map(imageId => 
        databaseService.deleteImage(imageId, true)
      );
      
      await Promise.all(deletePromises);
      setSelectedImages(new Set());
      await loadImages(currentPage, false);
    } catch (error) {
      console.error('批量删除失败:', error);
      alert('批量删除失败，请重试');
    }
  };

  // 批量上传到 OSS
  const handleBatchUploadToOSS = async () => {
    if (!ossConfigured) {
      alert('请先配置 OSS 云存储');
      return;
    }

    const selectedImageList = paginatedResult.data.filter(img => 
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
          
          // 更新数据库记录
          if (isConnected) {
            await databaseService.updateImage(image.id, {
              url: updatedImage.url,
              originalUrl: image.url,
              ossKey: updatedImage.ossKey,
              ossUploaded: true
            });
          }
          
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
      await loadImages(currentPage, false);
      setSelectedImages(new Set());
      
    } catch (error) {
      console.error('批量上传失败:', error);
      alert('批量上传失败，请重试');
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

  // 分页处理
  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= paginatedResult.totalPages) {
      loadImages(newPage);
    }
  };

  // 刷新数据
  const handleRefresh = () => {
    loadImages(currentPage);
  };

  // 筛选条件变化时重新加载
  useEffect(() => {
    if (isOpen) {
      loadImages(1); // 重置到第一页
    }
  }, [searchQuery, selectedModel, filterMode]);

  // 获取可用的模型列表
  const availableModels = Object.keys(stats.modelStats);

  // 组件挂载时加载数据
  useEffect(() => {
    if (isOpen) {
      loadImages();
    }
  }, [isOpen]);

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
                {paginatedResult.data.filter(img => img.ossUploaded).length} / {paginatedResult.data.length} 张已上传
              </div>
            </div>
          )}

          {/* 数据库连接状态 */}
          <div className={`mt-4 rounded-lg p-3 ${
            isConnected 
              ? 'bg-green-600/10 border border-green-600/20' 
              : 'bg-red-600/10 border border-red-600/20'
          }`}>
            <div className="flex items-center gap-2 mb-2">
              <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
              <span className={`text-sm font-medium ${isConnected ? 'text-green-300' : 'text-red-300'}`}>
                {isConnected ? '数据库已连接' : '数据库未连接'}
              </span>
            </div>
            {!isConnected && (
              <div className="text-xs text-red-200">
                请检查数据库配置和网络连接
              </div>
            )}
          </div>
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

            {/* 刷新按钮 */}
            <button
              onClick={handleRefresh}
              disabled={loading}
              className="p-2 bg-zinc-800/50 hover:bg-zinc-700 rounded-lg text-zinc-400 hover:text-zinc-200 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
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
                disabled={!isConnected}
                className="px-3 py-2 bg-red-600/20 text-red-300 rounded-lg text-sm hover:bg-red-600/30 transition-colors disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4 inline mr-1" />
                删除
              </button>
            </div>
          )}
        </div>

        {/* 图片列表 */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="flex items-center gap-3 text-zinc-500">
                <RefreshCw className="w-5 h-5 animate-spin" />
                <span>加载中...</span>
              </div>
            </div>
          ) : !isConnected ? (
            <div className="flex flex-col items-center justify-center h-64 text-zinc-500">
              <Database className="w-12 h-12 mb-4 opacity-50" />
              <p className="text-lg mb-2">数据库未连接</p>
              <p className="text-sm">请检查数据库配置和网络连接</p>
            </div>
          ) : paginatedResult.data.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-zinc-500">
              <ImageIcon className="w-12 h-12 mb-4 opacity-50" />
              <p className="text-lg mb-2">暂无图片</p>
              <p className="text-sm">生成一些图片后会显示在这里</p>
            </div>
          ) : (
            <div className="p-6">
              {viewMode === 'grid' ? (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                  {paginatedResult.data.map((image) => (
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
                          disabled={!isConnected}
                          className="absolute top-2 right-2 p-1 bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-30"
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
                            disabled={!isConnected}
                            className="p-1 bg-black/50 rounded-full text-white hover:bg-black/70 disabled:opacity-30"
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
                  {paginatedResult.data.map((image) => (
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
                          disabled={!isConnected}
                          className="p-2 hover:bg-zinc-700 rounded-lg transition-colors disabled:opacity-30"
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
                          disabled={!isConnected}
                          className="p-2 hover:bg-zinc-700 rounded-lg text-zinc-400 hover:text-red-400 transition-colors disabled:opacity-30"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* 分页控件 */}
              {paginatedResult.totalPages > 1 && (
                <div className="flex items-center justify-between mt-6 pt-4 border-t border-zinc-800">
                  <div className="text-sm text-zinc-500">
                    显示 {((currentPage - 1) * pageSize) + 1} - {Math.min(currentPage * pageSize, paginatedResult.total)} 
                    ，共 {paginatedResult.total} 张图片
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handlePageChange(currentPage - 1)}
                      disabled={!paginatedResult.hasPrev || loading}
                      className="p-2 bg-zinc-800/50 hover:bg-zinc-700 rounded-lg text-zinc-400 hover:text-zinc-200 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    
                    <div className="flex items-center gap-1">
                      {Array.from({ length: Math.min(5, paginatedResult.totalPages) }, (_, i) => {
                        let pageNum;
                        if (paginatedResult.totalPages <= 5) {
                          pageNum = i + 1;
                        } else if (currentPage <= 3) {
                          pageNum = i + 1;
                        } else if (currentPage >= paginatedResult.totalPages - 2) {
                          pageNum = paginatedResult.totalPages - 4 + i;
                        } else {
                          pageNum = currentPage - 2 + i;
                        }
                        
                        return (
                          <button
                            key={pageNum}
                            onClick={() => handlePageChange(pageNum)}
                            disabled={loading}
                            className={`px-3 py-1 rounded text-sm transition-colors disabled:cursor-not-allowed ${
                              pageNum === currentPage
                                ? 'bg-purple-600 text-white'
                                : 'bg-zinc-800/50 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200'
                            }`}
                          >
                            {pageNum}
                          </button>
                        );
                      })}
                    </div>
                    
                    <button
                      onClick={() => handlePageChange(currentPage + 1)}
                      disabled={!paginatedResult.hasNext || loading}
                      className="p-2 bg-zinc-800/50 hover:bg-zinc-700 rounded-lg text-zinc-400 hover:text-zinc-200 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
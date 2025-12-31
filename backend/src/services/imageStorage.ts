import { SavedImage, ImageLibrary } from '../types';

const STORAGE_KEY = 'nano-banana-images';
const MAX_IMAGES = 1000; // 最大存储图片数量

/**
 * 图片存储服务类
 * 使用 IndexedDB 存储图片数据
 */
class ImageStorageService {
  private dbName = 'NanoBananaImageDB';
  private dbVersion = 1;
  private db: IDBDatabase | null = null;

  /**
   * 初始化数据库
   */
  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onerror = () => {
        console.error('数据库打开失败:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        // 创建图片存储对象仓库
        if (!db.objectStoreNames.contains('images')) {
          const imageStore = db.createObjectStore('images', { keyPath: 'id' });
          imageStore.createIndex('createdAt', 'createdAt', { unique: false });
          imageStore.createIndex('model', 'model', { unique: false });
          imageStore.createIndex('favorite', 'favorite', { unique: false });
        }
      };
    });
  }

  /**
   * 保存图片到本地存储
   */
  async saveImage(image: SavedImage): Promise<void> {
    if (!this.db) {
      await this.init();
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['images'], 'readwrite');
      const store = transaction.objectStore('images');
      
      const request = store.add(image);
      
      request.onsuccess = () => {
        console.log('图片保存成功:', image.id);
        resolve();
      };
      
      request.onerror = () => {
        console.error('图片保存失败:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * 获取所有保存的图片
   */
  async getAllImages(): Promise<SavedImage[]> {
    if (!this.db) {
      await this.init();
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['images'], 'readonly');
      const store = transaction.objectStore('images');
      const index = store.index('createdAt');
      
      const request = index.getAll();
      
      request.onsuccess = () => {
        // 按创建时间倒序排列
        const images = request.result.sort((a, b) => 
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        resolve(images);
      };
      
      request.onerror = () => {
        console.error('获取图片失败:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * 根据ID获取图片
   */
  async getImageById(id: string): Promise<SavedImage | null> {
    if (!this.db) {
      await this.init();
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['images'], 'readonly');
      const store = transaction.objectStore('images');
      
      const request = store.get(id);
      
      request.onsuccess = () => {
        resolve(request.result || null);
      };
      
      request.onerror = () => {
        console.error('获取图片失败:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * 删除图片
   */
  async deleteImage(id: string): Promise<void> {
    if (!this.db) {
      await this.init();
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['images'], 'readwrite');
      const store = transaction.objectStore('images');
      
      const request = store.delete(id);
      
      request.onsuccess = () => {
        console.log('图片删除成功:', id);
        resolve();
      };
      
      request.onerror = () => {
        console.error('图片删除失败:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * 更新图片信息（如添加标签、收藏等）
   */
  async updateImage(id: string, updates: Partial<SavedImage>): Promise<void> {
    if (!this.db) {
      await this.init();
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['images'], 'readwrite');
      const store = transaction.objectStore('images');
      
      // 先获取现有图片
      const getRequest = store.get(id);
      
      getRequest.onsuccess = () => {
        const existingImage = getRequest.result;
        if (!existingImage) {
          reject(new Error('图片不存在'));
          return;
        }

        // 合并更新
        const updatedImage = { ...existingImage, ...updates };
        
        // 保存更新后的图片
        const putRequest = store.put(updatedImage);
        
        putRequest.onsuccess = () => {
          console.log('图片更新成功:', id);
          resolve();
        };
        
        putRequest.onerror = () => {
          console.error('图片更新失败:', putRequest.error);
          reject(putRequest.error);
        };
      };
      
      getRequest.onerror = () => {
        console.error('获取图片失败:', getRequest.error);
        reject(getRequest.error);
      };
    });
  }

  /**
   * 搜索图片
   */
  async searchImages(query: string): Promise<SavedImage[]> {
    const allImages = await this.getAllImages();
    
    if (!query.trim()) {
      return allImages;
    }

    const searchTerm = query.toLowerCase();
    
    return allImages.filter(image => 
      image.prompt.toLowerCase().includes(searchTerm) ||
      image.model.toLowerCase().includes(searchTerm) ||
      (image.tags && image.tags.some(tag => tag.toLowerCase().includes(searchTerm)))
    );
  }

  /**
   * 按模型筛选图片
   */
  async getImagesByModel(model: string): Promise<SavedImage[]> {
    if (!this.db) {
      await this.init();
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['images'], 'readonly');
      const store = transaction.objectStore('images');
      const index = store.index('model');
      
      const request = index.getAll(model);
      
      request.onsuccess = () => {
        const images = request.result.sort((a, b) => 
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        resolve(images);
      };
      
      request.onerror = () => {
        console.error('按模型获取图片失败:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * 获取收藏的图片
   */
  async getFavoriteImages(): Promise<SavedImage[]> {
    if (!this.db) {
      await this.init();
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['images'], 'readonly');
      const store = transaction.objectStore('images');
      
      const request = store.getAll();
      
      request.onsuccess = () => {
        // 筛选出收藏的图片并按时间排序
        const favoriteImages = request.result
          .filter(image => image.favorite === true)
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        resolve(favoriteImages);
      };
      
      request.onerror = () => {
        console.error('获取收藏图片失败:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * 获取统计信息
   */
  async getStats(): Promise<{
    totalImages: number;
    favoriteCount: number;
    modelStats: Record<string, number>;
    recentCount: number;
  }> {
    const allImages = await this.getAllImages();
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    
    const stats = {
      totalImages: allImages.length,
      favoriteCount: allImages.filter(img => img.favorite).length,
      modelStats: {} as Record<string, number>,
      recentCount: allImages.filter(img => new Date(img.createdAt) > oneDayAgo).length
    };

    // 统计各模型使用次数
    allImages.forEach(image => {
      stats.modelStats[image.model] = (stats.modelStats[image.model] || 0) + 1;
    });

    return stats;
  }

  /**
   * 清理旧图片（保持在最大数量限制内）
   */
  async cleanupOldImages(): Promise<void> {
    const allImages = await this.getAllImages();
    
    if (allImages.length <= MAX_IMAGES) {
      return;
    }

    // 删除最旧的图片（保留收藏的图片）
    const imagesToDelete = allImages
      .filter(img => !img.favorite)
      .slice(MAX_IMAGES)
      .map(img => img.id);

    for (const id of imagesToDelete) {
      await this.deleteImage(id);
    }

    console.log(`清理了 ${imagesToDelete.length} 张旧图片`);
  }

  /**
   * 导出所有图片数据为 JSON
   */
  async exportData(): Promise<string> {
    const allImages = await this.getAllImages();
    const stats = await this.getStats();
    
    const exportData = {
      version: '1.0',
      exportDate: new Date().toISOString(),
      stats,
      images: allImages
    };

    return JSON.stringify(exportData, null, 2);
  }

  /**
   * 清空所有数据
   */
  async clearAllData(): Promise<void> {
    if (!this.db) {
      await this.init();
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['images'], 'readwrite');
      const store = transaction.objectStore('images');
      
      const request = store.clear();
      
      request.onsuccess = () => {
        console.log('所有图片数据已清空');
        resolve();
      };
      
      request.onerror = () => {
        console.error('清空数据失败:', request.error);
        reject(request.error);
      };
    });
  }
}

// 创建单例实例
export const imageStorage = new ImageStorageService();

// 工具函数：将图片URL转换为Blob用于下载
export const downloadImage = async (url: string, filename: string): Promise<void> => {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    
    const downloadUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    URL.revokeObjectURL(downloadUrl);
  } catch (error) {
    console.error('下载图片失败:', error);
    throw new Error('下载失败，请重试');
  }
};

// 工具函数：批量下载图片为ZIP文件
export const downloadImagesAsZip = async (images: SavedImage[]): Promise<void> => {
  // 这里需要引入 JSZip 库来创建 ZIP 文件
  // 暂时提供一个简化版本，后续可以完善
  console.log('批量下载功能需要 JSZip 库支持');
  
  // 简化版：逐个下载
  for (let i = 0; i < images.length; i++) {
    const image = images[i];
    const filename = `${image.prompt.slice(0, 20)}_${image.id}.jpg`;
    await downloadImage(image.url, filename);
    
    // 添加延迟避免浏览器限制
    if (i < images.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
};
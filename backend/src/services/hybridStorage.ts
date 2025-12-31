import { SavedImage } from '../types';
import { imageStorage } from './imageStorage';
import { databaseStorage, loadDatabaseConfig } from './databaseStorage';

/**
 * 混合存储服务
 * 结合本地 IndexedDB 和云端 MySQL 数据库
 * 提供离线优先的数据同步策略
 */
class HybridStorageService {
  private syncInProgress = false;
  private autoSyncEnabled = true;
  private syncInterval: number | null = null;
  private initialized = false;

  constructor() {
    // 延迟初始化，避免启动时阻塞
    setTimeout(() => this.initialize(), 1000);
  }

  /**
   * 初始化服务
   */
  private async initialize() {
    if (this.initialized) return;
    
    try {
      // 启动时加载数据库配置
      await this.initializeDatabase();
      
      // 设置自动同步（每5分钟）
      this.startAutoSync();
      
      this.initialized = true;
      console.log('混合存储服务初始化完成');
    } catch (error) {
      console.warn('混合存储服务初始化失败:', error);
      // 初始化失败不影响基本功能
    }
  }

  /**
   * 初始化数据库连接
   */
  private async initializeDatabase() {
    try {
      const config = loadDatabaseConfig();
      if (config && config.enabled) {
        databaseStorage.setConfig(config);
        
        // 尝试连接数据库
        const connected = await databaseStorage.testConnection();
        if (connected) {
          console.log('数据库连接成功，启用云端同步');
          // 启动后进行一次同步
          setTimeout(() => this.syncFromCloud(), 2000);
        }
      }
    } catch (error) {
      console.warn('数据库初始化失败:', error);
    }
  }

  /**
   * 启动自动同步
   */
  private startAutoSync() {
    if (this.syncInterval) {
      window.clearInterval(this.syncInterval);
    }
    
    // 每5分钟自动同步一次
    this.syncInterval = window.setInterval(() => {
      if (this.autoSyncEnabled && databaseStorage.isConfigured()) {
        this.syncToCloud();
      }
    }, 5 * 60 * 1000);
  }

  /**
   * 停止自动同步
   */
  private stopAutoSync() {
    if (this.syncInterval) {
      window.clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }

  /**
   * 设置自动同步开关
   */
  setAutoSync(enabled: boolean) {
    this.autoSyncEnabled = enabled;
    if (enabled) {
      this.startAutoSync();
    } else {
      this.stopAutoSync();
    }
  }

  /**
   * 保存图片（本地优先，后台同步到云端）
   */
  async saveImage(image: SavedImage): Promise<void> {
    try {
      // 1. 先保存到本地 IndexedDB
      await imageStorage.saveImage(image);
      console.log('图片已保存到本地存储');

      // 2. 如果数据库已配置，后台同步到云端
      if (databaseStorage.isConfigured()) {
        this.syncImageToCloud(image).catch(error => {
          console.warn('后台同步到云端失败:', error);
          // 同步失败不影响本地保存
        });
      }
    } catch (error) {
      console.error('保存图片失败:', error);
      throw error;
    }
  }

  /**
   * 获取所有图片（本地优先，云端补充）
   */
  async getAllImages(): Promise<SavedImage[]> {
    try {
      // 1. 先从本地获取
      const localImages = await imageStorage.getAllImages();
      console.log(`从本地获取到 ${localImages.length} 张图片`);

      // 2. 如果数据库已配置，尝试从云端补充
      if (databaseStorage.isConfigured() && !this.syncInProgress) {
        this.syncFromCloud().catch(error => {
          console.warn('从云端同步失败:', error);
          // 同步失败不影响本地数据显示
        });
      }

      return localImages;
    } catch (error) {
      console.error('获取图片列表失败:', error);
      throw error;
    }
  }

  /**
   * 更新图片信息
   */
  async updateImage(id: string, updates: Partial<SavedImage>): Promise<void> {
    try {
      // 1. 更新本地数据
      await imageStorage.updateImage(id, updates);
      console.log('本地图片更新成功');

      // 2. 如果数据库已配置，同步到云端
      if (databaseStorage.isConfigured()) {
        databaseStorage.updateImage(id, updates).catch(error => {
          console.warn('同步图片更新到云端失败:', error);
        });
      }
    } catch (error) {
      console.error('更新图片失败:', error);
      throw error;
    }
  }

  /**
   * 删除图片
   */
  async deleteImage(id: string): Promise<void> {
    try {
      // 1. 删除本地数据
      await imageStorage.deleteImage(id);
      console.log('本地图片删除成功');

      // 2. 如果数据库已配置，同步到云端
      if (databaseStorage.isConfigured()) {
        databaseStorage.deleteImage(id).catch(error => {
          console.warn('同步图片删除到云端失败:', error);
        });
      }
    } catch (error) {
      console.error('删除图片失败:', error);
      throw error;
    }
  }

  /**
   * 手动同步到云端
   */
  async syncToCloud(): Promise<{ success: boolean; message: string }> {
    if (!databaseStorage.isConfigured()) {
      return { success: false, message: '数据库未配置' };
    }

    if (this.syncInProgress) {
      return { success: false, message: '同步正在进行中' };
    }

    try {
      this.syncInProgress = true;
      console.log('开始同步本地数据到云端...');

      // 获取所有本地图片
      const localImages = await imageStorage.getAllImages();
      
      if (localImages.length === 0) {
        return { success: true, message: '没有需要同步的数据' };
      }

      // 同步到云端
      const result = await databaseStorage.syncToCloud(localImages);
      
      if (result.success) {
        console.log('数据同步到云端成功');
        return { success: true, message: `成功同步 ${localImages.length} 张图片到云端` };
      } else {
        console.error('同步到云端失败:', result.error);
        return { success: false, message: result.error || '同步失败' };
      }
    } catch (error) {
      console.error('同步到云端异常:', error);
      return { success: false, message: '同步过程中发生异常' };
    } finally {
      this.syncInProgress = false;
    }
  }

  /**
   * 手动从云端同步
   */
  async syncFromCloud(): Promise<{ success: boolean; message: string }> {
    if (!databaseStorage.isConfigured()) {
      return { success: false, message: '数据库未配置' };
    }

    if (this.syncInProgress) {
      return { success: false, message: '同步正在进行中' };
    }

    try {
      this.syncInProgress = true;
      console.log('开始从云端同步数据...');

      // 从云端获取数据
      const result = await databaseStorage.syncFromCloud();
      
      if (!result.success) {
        console.error('从云端同步失败:', result.error);
        return { success: false, message: result.error || '同步失败' };
      }

      const cloudImages = result.data || [];
      console.log(`从云端获取到 ${cloudImages.length} 张图片`);

      if (cloudImages.length === 0) {
        return { success: true, message: '云端暂无数据' };
      }

      // 获取本地数据进行对比
      const localImages = await imageStorage.getAllImages();
      const localImageIds = new Set(localImages.map(img => img.id));

      // 找出需要添加到本地的图片
      const imagesToAdd = cloudImages.filter(img => !localImageIds.has(img.id));
      
      // 添加新图片到本地
      for (const image of imagesToAdd) {
        try {
          await imageStorage.saveImage(image);
          console.log(`从云端同步图片到本地: ${image.id}`);
        } catch (error) {
          console.warn(`同步图片 ${image.id} 失败:`, error);
        }
      }

      const message = imagesToAdd.length > 0 
        ? `从云端同步了 ${imagesToAdd.length} 张新图片`
        : '本地数据已是最新';

      console.log('从云端同步完成');
      return { success: true, message };
    } catch (error) {
      console.error('从云端同步异常:', error);
      return { success: false, message: '同步过程中发生异常' };
    } finally {
      this.syncInProgress = false;
    }
  }

  /**
   * 单个图片同步到云端（后台执行）
   */
  private async syncImageToCloud(image: SavedImage): Promise<void> {
    try {
      const result = await databaseStorage.saveImage(image);
      if (result.success) {
        console.log(`图片 ${image.id} 已同步到云端`);
      } else {
        console.warn(`图片 ${image.id} 同步到云端失败:`, result.error);
      }
    } catch (error) {
      console.warn(`图片 ${image.id} 同步到云端异常:`, error);
    }
  }

  /**
   * 获取同步状态
   */
  getSyncStatus() {
    return {
      ...databaseStorage.getSyncStatus(),
      syncInProgress: this.syncInProgress,
      autoSyncEnabled: this.autoSyncEnabled,
      databaseConfigured: databaseStorage.isConfigured()
    };
  }

  /**
   * 清理资源
   */
  destroy() {
    this.stopAutoSync();
  }

  // 代理其他 imageStorage 方法
  async searchImages(query: string): Promise<SavedImage[]> {
    return imageStorage.searchImages(query);
  }

  async getImagesByModel(model: string): Promise<SavedImage[]> {
    return imageStorage.getImagesByModel(model);
  }

  async getFavoriteImages(): Promise<SavedImage[]> {
    return imageStorage.getFavoriteImages();
  }

  async getStats() {
    return imageStorage.getStats();
  }

  async exportData(): Promise<string> {
    return imageStorage.exportData();
  }

  async clearAllData(): Promise<void> {
    // 清理本地数据
    await imageStorage.clearAllData();
    
    // 如果数据库已配置，也清理云端数据（可选）
    // 这里暂时不实现，避免误操作
  }
}

// 创建单例实例
export const hybridStorage = new HybridStorageService();

// 确保在页面卸载时清理资源
window.addEventListener('beforeunload', () => {
  hybridStorage.destroy();
});
import { SavedImage } from '../types';

/**
 * 数据库配置接口
 */
export interface DatabaseConfig {
  host: string;           // 数据库主机地址
  port: number;           // 端口
  database: string;       // 数据库名称
  username: string;       // 用户名
  password: string;       // 密码
  ssl?: boolean;          // 是否使用 SSL
  enabled: boolean;       // 是否启用数据库同步
}

/**
 * 数据库操作结果
 */
export interface DatabaseResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

/**
 * 数据库同步状态
 */
export interface SyncStatus {
  isOnline: boolean;
  lastSync: Date | null;
  pendingUploads: number;
  pendingDownloads: number;
}

/**
 * 数据库存储服务类
 * 使用阿里云函数计算作为中间层，避免在前端直接连接数据库
 */
class DatabaseStorageService {
  private config: DatabaseConfig | null = null;
  private syncStatus: SyncStatus = {
    isOnline: false,
    lastSync: null,
    pendingUploads: 0,
    pendingDownloads: 0
  };

  /**
   * 设置数据库配置
   */
  setConfig(config: DatabaseConfig): void {
    this.config = config;
    this.testConnection();
  }

  /**
   * 获取当前配置
   */
  getConfig(): DatabaseConfig | null {
    return this.config;
  }

  /**
   * 检查是否已配置并启用
   */
  isConfigured(): boolean {
    return this.config !== null && 
           this.config.enabled &&
           this.config.host !== '' && 
           this.config.database !== '' && 
           this.config.username !== '';
  }

  /**
   * 获取同步状态
   */
  getSyncStatus(): SyncStatus {
    return { ...this.syncStatus };
  }

  /**
   * 测试数据库连接
   */
  async testConnection(): Promise<boolean> {
    if (!this.config) {
      return false;
    }

    try {
      console.log('测试数据库连接...');
      
      // 调用云函数测试连接
      const result = await this.callCloudFunction('test-connection', {
        config: this.config
      });

      if (result.success) {
        this.syncStatus.isOnline = true;
        console.log('数据库连接成功');
        return true;
      } else {
        this.syncStatus.isOnline = false;
        console.error('数据库连接失败:', result.error);
        return false;
      }
    } catch (error) {
      this.syncStatus.isOnline = false;
      console.error('数据库连接测试失败:', error);
      return false;
    }
  }

  /**
   * 初始化数据库表结构
   */
  async initializeTables(): Promise<DatabaseResult> {
    if (!this.isConfigured()) {
      return { success: false, error: '数据库未配置' };
    }

    try {
      console.log('初始化数据库表结构...');
      
      const result = await this.callCloudFunction('init-tables', {
        config: this.config
      });

      if (result.success) {
        console.log('数据库表结构初始化成功');
      }

      return result;
    } catch (error) {
      console.error('初始化数据库表失败:', error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  /**
   * 保存图片到数据库
   */
  async saveImage(image: SavedImage): Promise<DatabaseResult<SavedImage>> {
    if (!this.isConfigured()) {
      return { success: false, error: '数据库未配置' };
    }

    try {
      console.log('保存图片到数据库:', image.id);
      
      const result = await this.callCloudFunction('save-image', {
        config: this.config,
        image: this.serializeImage(image)
      });

      if (result.success) {
        this.syncStatus.lastSync = new Date();
        console.log('图片保存到数据库成功');
      }

      return result;
    } catch (error) {
      console.error('保存图片到数据库失败:', error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  /**
   * 从数据库获取所有图片
   */
  async getAllImages(): Promise<DatabaseResult<SavedImage[]>> {
    if (!this.isConfigured()) {
      return { success: false, error: '数据库未配置' };
    }

    try {
      console.log('从数据库获取所有图片...');
      
      const result = await this.callCloudFunction('get-all-images', {
        config: this.config
      });

      if (result.success && result.data) {
        // 反序列化图片数据
        result.data = result.data.map(this.deserializeImage);
        this.syncStatus.lastSync = new Date();
        console.log(`从数据库获取到 ${result.data.length} 张图片`);
      }

      return result;
    } catch (error) {
      console.error('从数据库获取图片失败:', error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  /**
   * 更新图片信息
   */
  async updateImage(id: string, updates: Partial<SavedImage>): Promise<DatabaseResult> {
    if (!this.isConfigured()) {
      return { success: false, error: '数据库未配置' };
    }

    try {
      console.log('更新数据库中的图片:', id);
      
      const result = await this.callCloudFunction('update-image', {
        config: this.config,
        id,
        updates: this.serializeImageUpdates(updates)
      });

      if (result.success) {
        this.syncStatus.lastSync = new Date();
        console.log('图片更新成功');
      }

      return result;
    } catch (error) {
      console.error('更新图片失败:', error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  /**
   * 删除图片
   */
  async deleteImage(id: string): Promise<DatabaseResult> {
    if (!this.isConfigured()) {
      return { success: false, error: '数据库未配置' };
    }

    try {
      console.log('从数据库删除图片:', id);
      
      const result = await this.callCloudFunction('delete-image', {
        config: this.config,
        id
      });

      if (result.success) {
        this.syncStatus.lastSync = new Date();
        console.log('图片删除成功');
      }

      return result;
    } catch (error) {
      console.error('删除图片失败:', error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  /**
   * 同步本地数据到云端
   */
  async syncToCloud(localImages: SavedImage[]): Promise<DatabaseResult> {
    if (!this.isConfigured()) {
      return { success: false, error: '数据库未配置' };
    }

    try {
      console.log(`开始同步 ${localImages.length} 张图片到云端...`);
      this.syncStatus.pendingUploads = localImages.length;
      
      const result = await this.callCloudFunction('sync-to-cloud', {
        config: this.config,
        images: localImages.map(this.serializeImage)
      });

      if (result.success) {
        this.syncStatus.lastSync = new Date();
        this.syncStatus.pendingUploads = 0;
        console.log('数据同步到云端成功');
      }

      return result;
    } catch (error) {
      this.syncStatus.pendingUploads = 0;
      console.error('同步到云端失败:', error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  /**
   * 从云端同步数据到本地
   */
  async syncFromCloud(): Promise<DatabaseResult<SavedImage[]>> {
    if (!this.isConfigured()) {
      return { success: false, error: '数据库未配置' };
    }

    try {
      console.log('从云端同步数据到本地...');
      
      const result = await this.callCloudFunction('sync-from-cloud', {
        config: this.config
      });

      if (result.success && result.data) {
        result.data = result.data.map(this.deserializeImage);
        this.syncStatus.lastSync = new Date();
        this.syncStatus.pendingDownloads = 0;
        console.log(`从云端同步了 ${result.data.length} 张图片`);
      }

      return result;
    } catch (error) {
      console.error('从云端同步失败:', error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  /**
   * 调用阿里云函数计算
   * 注意：这里需要替换为实际的云函数调用方式
   */
  private async callCloudFunction(functionName: string, params: any): Promise<DatabaseResult> {
    // 临时实现：模拟云函数调用
    // 实际使用时需要替换为真实的云函数 URL 和调用方式
    
    console.log(`调用云函数: ${functionName}`, params);
    
    // 模拟网络延迟
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // 模拟成功响应
    switch (functionName) {
      case 'test-connection':
        return { success: true, message: '连接测试成功' };
      
      case 'init-tables':
        return { success: true, message: '表结构初始化成功' };
      
      case 'save-image':
        return { success: true, message: '图片保存成功' };
      
      case 'get-all-images':
        return { success: true, data: [], message: '获取图片列表成功' };
      
      case 'update-image':
        return { success: true, message: '图片更新成功' };
      
      case 'delete-image':
        return { success: true, message: '图片删除成功' };
      
      case 'sync-to-cloud':
        return { success: true, message: '同步到云端成功' };
      
      case 'sync-from-cloud':
        return { success: true, data: [], message: '从云端同步成功' };
      
      default:
        return { success: false, error: '未知的函数名称' };
    }
  }

  /**
   * 序列化图片对象（处理日期等特殊类型）
   */
  private serializeImage(image: SavedImage): any {
    return {
      ...image,
      createdAt: image.createdAt.toISOString(),
      refImages: image.refImages ? JSON.stringify(image.refImages) : null,
      tags: image.tags ? JSON.stringify(image.tags) : null
    };
  }

  /**
   * 反序列化图片对象
   */
  private deserializeImage(data: any): SavedImage {
    return {
      ...data,
      createdAt: new Date(data.createdAt),
      refImages: data.refImages ? JSON.parse(data.refImages) : undefined,
      tags: data.tags ? JSON.parse(data.tags) : undefined
    };
  }

  /**
   * 序列化图片更新数据
   */
  private serializeImageUpdates(updates: Partial<SavedImage>): any {
    const serialized: any = { ...updates };
    
    if (updates.createdAt) {
      serialized.createdAt = updates.createdAt.toISOString();
    }
    
    if (updates.refImages) {
      serialized.refImages = JSON.stringify(updates.refImages);
    }
    
    if (updates.tags) {
      serialized.tags = JSON.stringify(updates.tags);
    }
    
    return serialized;
  }
}

// 创建单例实例
export const databaseStorage = new DatabaseStorageService();

// 工具函数：从本地存储加载数据库配置
export const loadDatabaseConfig = (): DatabaseConfig | null => {
  try {
    const configStr = localStorage.getItem('database-config');
    if (configStr) {
      const config = JSON.parse(configStr);
      databaseStorage.setConfig(config);
      return config;
    }
  } catch (error) {
    console.error('加载数据库配置失败:', error);
  }
  return null;
};

// 工具函数：保存数据库配置到本地存储
export const saveDatabaseConfig = (config: DatabaseConfig): void => {
  try {
    localStorage.setItem('database-config', JSON.stringify(config));
    databaseStorage.setConfig(config);
  } catch (error) {
    console.error('保存数据库配置失败:', error);
    throw error;
  }
};

// 工具函数：清除数据库配置
export const clearDatabaseConfig = (): void => {
  try {
    localStorage.removeItem('database-config');
    databaseStorage.setConfig(undefined as any);
  } catch (error) {
    console.error('清除数据库配置失败:', error);
  }
};
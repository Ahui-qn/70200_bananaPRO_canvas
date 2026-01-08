/**
 * 存储管理器
 * 根据 STORAGE_MODE 环境变量选择使用本地存储或 OSS 存储
 * 提供统一的存储接口，对上层代码透明
 */

import { aliOssService, AliOssService } from './aliOssService.js';
import { localStorageService, LocalStorageService } from './localStorageService.js';

// 存储模式类型
type StorageMode = 'local' | 'oss';

// 上传结果接口（统一格式）
interface UploadResult {
  url: string;           // 访问 URL
  key: string;           // 存储键名（文件路径或 OSS Key）
  size: number;          // 文件大小
}

// 缩略图上传结果
interface ThumbnailResult {
  url: string;
  key: string;
}

// 删除结果
interface DeleteResult {
  success: number;
  failed: number;
}

// 存储接口（统一的存储操作接口）
interface StorageInterface {
  // 初始化存储服务
  initialize(): boolean;
  
  // 检查是否已配置
  isConfigured(): boolean;
  
  // 从 URL 下载并上传图片
  uploadFromUrl(imageUrl: string, customKey?: string): Promise<UploadResult>;
  
  // 从 Buffer 上传图片
  uploadFromBuffer(buffer: Buffer, contentType: string, customKey?: string): Promise<UploadResult>;
  
  // 上传缩略图
  uploadThumbnail(buffer: Buffer, originalKey: string): Promise<ThumbnailResult>;
  
  // 删除文件
  deleteObject(key: string): Promise<boolean>;
  
  // 批量删除文件
  deleteObjects(keys: string[]): Promise<DeleteResult>;
  
  // 测试连接
  testConnection(): Promise<boolean>;
  
  // 获取配置信息
  getConfigInfo(): object | null;
}

/**
 * 存储管理器类
 * 根据配置选择使用哪种存储服务
 */
class StorageManager implements StorageInterface {
  private mode: StorageMode = 'oss';
  private initialized: boolean = false;

  /**
   * 初始化存储管理器
   * 根据 STORAGE_MODE 环境变量选择存储服务
   */
  initialize(): boolean {
    const storageMode = process.env.STORAGE_MODE?.toLowerCase() as StorageMode;
    
    // 默认使用 OSS 模式
    this.mode = storageMode === 'local' ? 'local' : 'oss';
    
    console.log(`📦 存储模式: ${this.mode === 'local' ? '本地存储' : '阿里云 OSS'}`);
    
    let result: boolean;
    
    if (this.mode === 'local') {
      result = localStorageService.initialize();
    } else {
      result = aliOssService.initialize();
    }
    
    this.initialized = result;
    return result;
  }

  /**
   * 检查存储服务是否已配置
   */
  isConfigured(): boolean {
    if (this.mode === 'local') {
      return localStorageService.isConfigured();
    }
    return aliOssService.isConfigured();
  }

  /**
   * 获取当前存储模式
   */
  getMode(): StorageMode {
    return this.mode;
  }

  /**
   * 从 URL 下载并上传图片
   */
  async uploadFromUrl(imageUrl: string, customKey?: string): Promise<UploadResult> {
    if (this.mode === 'local') {
      return localStorageService.uploadFromUrl(imageUrl, customKey);
    }
    
    const result = await aliOssService.uploadFromUrl(imageUrl, customKey);
    return {
      url: result.url,
      key: result.ossKey,
      size: result.size
    };
  }

  /**
   * 从 Buffer 上传图片
   */
  async uploadFromBuffer(buffer: Buffer, contentType: string = 'image/jpeg', customKey?: string): Promise<UploadResult> {
    if (this.mode === 'local') {
      return localStorageService.uploadFromBuffer(buffer, contentType, customKey);
    }
    
    const result = await aliOssService.uploadFromBuffer(buffer, contentType, customKey);
    return {
      url: result.url,
      key: result.ossKey,
      size: result.size
    };
  }

  /**
   * 上传缩略图
   */
  async uploadThumbnail(buffer: Buffer, originalKey: string): Promise<ThumbnailResult> {
    if (this.mode === 'local') {
      return localStorageService.uploadThumbnail(buffer, originalKey);
    }
    
    const result = await aliOssService.uploadThumbnail(buffer, originalKey);
    return {
      url: result.url,
      key: result.ossKey
    };
  }

  /**
   * 生成缩略图
   * 本地存储服务提供此方法，OSS 模式下也可使用
   */
  async generateThumbnail(buffer: Buffer): Promise<Buffer> {
    return localStorageService.generateThumbnail(buffer);
  }

  /**
   * 删除文件
   */
  async deleteObject(key: string): Promise<boolean> {
    if (this.mode === 'local') {
      return localStorageService.deleteObject(key);
    }
    return aliOssService.deleteObject(key);
  }

  /**
   * 批量删除文件
   */
  async deleteObjects(keys: string[]): Promise<DeleteResult> {
    if (this.mode === 'local') {
      return localStorageService.deleteObjects(keys);
    }
    return aliOssService.deleteObjects(keys);
  }

  /**
   * 测试存储连接
   */
  async testConnection(): Promise<boolean> {
    if (this.mode === 'local') {
      return localStorageService.testConnection();
    }
    return aliOssService.testConnection();
  }

  /**
   * 获取存储配置信息
   */
  getConfigInfo(): object | null {
    if (this.mode === 'local') {
      return localStorageService.getConfigInfo();
    }
    return aliOssService.getConfigInfo();
  }

  /**
   * 获取底层存储服务实例
   * 用于需要直接访问特定存储服务的场景
   */
  getLocalStorageService(): LocalStorageService {
    return localStorageService;
  }

  /**
   * 获取 OSS 存储服务实例
   */
  getOssStorageService(): AliOssService {
    return aliOssService;
  }
}

// 导出单例实例
export const storageManager = new StorageManager();
export { StorageManager, StorageMode, StorageInterface, UploadResult, ThumbnailResult, DeleteResult };

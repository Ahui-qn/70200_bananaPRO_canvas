/**
 * 阿里云函数计算 API 调用服务
 * 提供与阿里云函数计算的安全通信接口
 */

import { 
  CloudFunctionAPI, 
  CloudFunctionResult, 
  DatabaseConfig, 
  SavedImage,
  PaginationOptions 
} from '@shared/types';
import { loadEnvironmentConfig, CONFIG_CONSTANTS } from '../config/database';
import { networkErrorHandler } from './networkErrorHandler';
import { databaseErrorHandler } from './databaseErrorHandler';
import { cloudFunctionSecurity } from './cloudFunctionSecurity';

/**
 * 云函数响应接口
 */
interface CloudFunctionResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  code?: number;
  requestId?: string;
}

/**
 * 阿里云函数计算配置
 */
interface FunctionComputeConfig {
  endpoint: string;
  accessKeyId: string;
  accessKeySecret: string;
  timeout: number;
}

/**
 * 云函数 API 实现类
 */
class CloudFunctionAPIImpl implements CloudFunctionAPI {
  private config: FunctionComputeConfig | null = null;
  private initialized = false;

  constructor() {
    this.initialize();
  }

  /**
   * 初始化云函数配置
   */
  private initialize(): void {
    try {
      const env = loadEnvironmentConfig();
      
      if (env.FC_ENDPOINT && env.FC_ACCESS_KEY_ID && env.FC_ACCESS_KEY_SECRET) {
        this.config = {
          endpoint: env.FC_ENDPOINT,
          accessKeyId: env.FC_ACCESS_KEY_ID,
          accessKeySecret: env.FC_ACCESS_KEY_SECRET,
          timeout: CONFIG_CONSTANTS.FUNCTION_TIMEOUT
        };
        this.initialized = true;
        console.log('云函数配置初始化成功');
      } else {
        console.warn('云函数配置不完整，将使用模拟模式');
        this.initialized = false;
      }
    } catch (error) {
      console.error('初始化云函数配置失败:', error);
      this.initialized = false;
    }
  }

  /**
   * 检查是否已正确配置
   */
  isConfigured(): boolean {
    return this.initialized && this.config !== null;
  }

  /**
   * 验证云函数响应
   */
  private validateResponse<T>(response: any): CloudFunctionResponse<T> {
    if (!response || typeof response !== 'object') {
      throw new Error('无效的云函数响应格式');
    }

    return {
      success: Boolean(response.success),
      data: response.data,
      error: response.error,
      message: response.message,
      code: response.code,
      requestId: response.requestId
    };
  }

  /**
   * 调用云函数的核心方法
   */
  async callFunction<T>(functionName: string, params: any): Promise<CloudFunctionResult<T>> {
    try {
      // 检查配置
      if (!this.isConfigured()) {
        console.warn(`云函数未配置，使用模拟模式调用: ${functionName}`);
        return await this.simulateFunction<T>(functionName, params);
      }

      console.log(`调用云函数: ${functionName}`, { params });

      // 生成安全的调用配置
      const callConfig = await cloudFunctionSecurity.generateSecureCallConfig(functionName, params);

      // 发送请求
      const response = await networkErrorHandler.executeWithRetry(async () => {
        const fetchResponse = await fetch(callConfig.url, {
          method: 'POST',
          headers: callConfig.headers,
          body: callConfig.body,
          signal: AbortSignal.timeout(this.config!.timeout)
        });

        if (!fetchResponse.ok) {
          throw new Error(`云函数调用失败: ${fetchResponse.status} ${fetchResponse.statusText}`);
        }

        const responseData = await fetchResponse.json();

        // 验证响应完整性
        if (!cloudFunctionSecurity.verifyResponseIntegrity(responseData, callConfig.requestId)) {
          throw new Error('云函数响应完整性验证失败');
        }

        return responseData;
      });

      // 验证和转换响应
      const validatedResponse = this.validateResponse<T>(response);

      if (!validatedResponse.success) {
        throw new Error(validatedResponse.error || '云函数执行失败');
      }

      console.log(`云函数调用成功: ${functionName}`);
      return {
        success: true,
        data: validatedResponse.data,
        message: validatedResponse.message
      };

    } catch (error: any) {
      console.error(`云函数调用失败: ${functionName}`, error);
      
      const dbError = databaseErrorHandler.handleError(error, {
        operation: 'CLOUD_FUNCTION_CALL',
        tableName: functionName
      });

      return {
        success: false,
        error: dbError.message,
        code: dbError.errno
      };
    }
  }

  /**
   * 模拟云函数调用（用于开发和测试）
   */
  private async simulateFunction<T>(functionName: string, params: any): Promise<CloudFunctionResult<T>> {
    // 模拟网络延迟
    await new Promise(resolve => setTimeout(resolve, 200 + Math.random() * 300));

    console.log(`模拟云函数调用: ${functionName}`, params);

    // 根据函数名返回模拟数据
    switch (functionName) {
      case 'test-connection':
        return {
          success: true,
          data: true as T,
          message: '数据库连接测试成功（模拟）'
        };

      case 'init-tables':
        return {
          success: true,
          message: '数据库表结构初始化成功（模拟）'
        };

      case 'save-image':
        return {
          success: true,
          data: params.image as T,
          message: '图片保存成功（模拟）'
        };

      case 'get-images':
        // 模拟分页数据
        const mockImages = Array.from({ length: 5 }, (_, i) => ({
          id: `mock-image-${i + 1}`,
          url: `https://example.com/image-${i + 1}.jpg`,
          prompt: `模拟图片 ${i + 1}`,
          model: 'nano-banana-fast',
          aspectRatio: 'auto',
          imageSize: '1K',
          createdAt: new Date(Date.now() - i * 24 * 60 * 60 * 1000),
          favorite: i % 2 === 0,
          ossUploaded: i % 3 === 0
        }));

        return {
          success: true,
          data: {
            data: mockImages,
            total: 50,
            page: params.pagination?.page || 1,
            pageSize: params.pagination?.pageSize || 20,
            totalPages: 3,
            hasNext: true,
            hasPrev: false
          } as T,
          message: '获取图片列表成功（模拟）'
        };

      case 'update-image':
        return {
          success: true,
          data: { ...params.updates, id: params.id } as T,
          message: '图片更新成功（模拟）'
        };

      case 'delete-image':
        return {
          success: true,
          message: '图片删除成功（模拟）'
        };

      case 'save-api-config':
        return {
          success: true,
          message: 'API 配置保存成功（模拟）'
        };

      case 'get-api-config':
        return {
          success: true,
          data: {
            apiKey: 'mock-api-key',
            baseUrl: 'https://mock.api.com',
            timeout: 30000,
            retryCount: 3,
            provider: 'Mock Provider'
          } as T,
          message: 'API 配置获取成功（模拟）'
        };

      case 'save-oss-config':
        return {
          success: true,
          message: 'OSS 配置保存成功（模拟）'
        };

      case 'get-oss-config':
        return {
          success: true,
          data: {
            accessKeyId: 'mock-access-key-id',
            accessKeySecret: 'mock-access-key-secret',
            region: 'cn-hangzhou',
            bucket: 'mock-bucket',
            enabled: true
          } as T,
          message: 'OSS 配置获取成功（模拟）'
        };

      default:
        return {
          success: false,
          error: `未知的云函数: ${functionName}`,
          code: 404
        };
    }
  }

  // ==================== 具体的云函数调用方法 ====================

  /**
   * 测试数据库连接
   */
  async testConnection(config: DatabaseConfig): Promise<boolean> {
    const result = await this.callFunction<boolean>('test-connection', { config });
    return result.success && result.data === true;
  }

  /**
   * 初始化数据库表结构
   */
  async initTables(config: DatabaseConfig): Promise<void> {
    const result = await this.callFunction('init-tables', { config });
    if (!result.success) {
      throw new Error(result.error || '初始化数据库表失败');
    }
  }

  /**
   * 保存图片到数据库
   */
  async saveImage(config: DatabaseConfig, image: SavedImage): Promise<SavedImage> {
    const result = await this.callFunction<SavedImage>('save-image', { 
      config, 
      image: this.serializeImage(image) 
    });
    
    if (!result.success) {
      throw new Error(result.error || '保存图片失败');
    }
    
    return result.data || image;
  }

  /**
   * 获取图片列表（分页）
   */
  async getImages(config: DatabaseConfig, pagination: PaginationOptions): Promise<SavedImage[]> {
    const result = await this.callFunction<{ data: SavedImage[] }>('get-images', { 
      config, 
      pagination 
    });
    
    if (!result.success) {
      throw new Error(result.error || '获取图片列表失败');
    }
    
    const images = result.data?.data || [];
    return images.map(this.deserializeImage);
  }

  /**
   * 更新图片信息
   */
  async updateImage(config: DatabaseConfig, id: string, updates: Partial<SavedImage>): Promise<void> {
    const result = await this.callFunction('update-image', { 
      config, 
      id, 
      updates: this.serializeImageUpdates(updates) 
    });
    
    if (!result.success) {
      throw new Error(result.error || '更新图片失败');
    }
  }

  /**
   * 删除图片
   */
  async deleteImage(config: DatabaseConfig, id: string): Promise<void> {
    const result = await this.callFunction('delete-image', { config, id });
    
    if (!result.success) {
      throw new Error(result.error || '删除图片失败');
    }
  }

  /**
   * 保存配置（API 或 OSS）
   */
  async saveConfig(config: DatabaseConfig, type: 'api' | 'oss', data: any): Promise<void> {
    const functionName = type === 'api' ? 'save-api-config' : 'save-oss-config';
    const result = await this.callFunction(functionName, { config, data });
    
    if (!result.success) {
      throw new Error(result.error || `保存${type.toUpperCase()}配置失败`);
    }
  }

  /**
   * 获取配置（API 或 OSS）
   */
  async getConfig(config: DatabaseConfig, type: 'api' | 'oss'): Promise<any> {
    const functionName = type === 'api' ? 'get-api-config' : 'get-oss-config';
    const result = await this.callFunction(functionName, { config });
    
    if (!result.success) {
      throw new Error(result.error || `获取${type.toUpperCase()}配置失败`);
    }
    
    return result.data;
  }

  // ==================== 数据序列化辅助方法 ====================

  /**
   * 序列化图片对象
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

  // ==================== 高级功能方法 ====================

  /**
   * 批量调用云函数
   */
  async batchCall<T>(calls: Array<{ functionName: string; params: any }>): Promise<CloudFunctionResult<T>[]> {
    const results = await Promise.allSettled(
      calls.map(call => this.callFunction<T>(call.functionName, call.params))
    );

    return results.map(result => {
      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        return {
          success: false,
          error: result.reason?.message || '批量调用失败'
        };
      }
    });
  }

  /**
   * 获取云函数调用统计信息
   */
  getCallStatistics(): {
    totalCalls: number;
    successfulCalls: number;
    failedCalls: number;
    averageResponseTime: number;
  } {
    // 这里可以实现调用统计逻辑
    // 为了简化，返回模拟数据
    return {
      totalCalls: 0,
      successfulCalls: 0,
      failedCalls: 0,
      averageResponseTime: 0
    };
  }

  /**
   * 重置统计信息
   */
  resetStatistics(): void {
    // 实现统计重置逻辑
    console.log('云函数调用统计信息已重置');
  }
}

// 创建单例实例
export const cloudFunctionAPI = new CloudFunctionAPIImpl();

// 导出类
export { CloudFunctionAPIImpl };
export default cloudFunctionAPI;
/**
 * 数据库服务实现
 * 提供完整的数据库连接管理和数据操作功能
 */

import mysql from 'mysql2/promise';
import { 
  DatabaseConfig, 
  ConnectionStatus, 
  SavedImage, 
  ApiConfig, 
  OSSConfig,
  PaginationOptions, 
  PaginatedResult,
  DatabaseService,
  OperationLog,
  DatabaseError
} from '../types';
import { 
  validateDatabaseConfig,
  CONFIG_CONSTANTS
} from '../config/database';
import { 
  createConnectionOptions,
  formatDatabaseError,
  isDatabaseConfigComplete,
  delay,
  calculateBackoffDelay
} from '../utils/database';
import { getEncryptionService } from './encryptionService';
import { createDatabaseInitializer } from './databaseInitializer';
import { databaseErrorHandler } from './databaseErrorHandler';
import { networkErrorHandler } from './networkErrorHandler';

/**
 * 数据库服务实现类
 */
export class DatabaseServiceImpl implements DatabaseService {
  private connection: mysql.Connection | null = null;
  private config: DatabaseConfig | null = null;
  private connectionStatus: ConnectionStatus = {
    isConnected: false,
    lastConnected: null,
    error: null,
    latency: undefined
  };
  private retryCount = 0;
  private isConnecting = false;

  /**
   * 连接到数据库
   */
  async connect(config: DatabaseConfig): Promise<boolean> {
    // 防止并发连接
    if (this.isConnecting) {
      console.log('数据库连接正在进行中，等待完成...');
      return false;
    }

    this.isConnecting = true;
    
    try {
      // 验证配置
      const configErrors = validateDatabaseConfig(config);
      if (configErrors.length > 0) {
        throw new Error(`数据库配置错误: ${configErrors.join(', ')}`);
      }

      // 断开现有连接
      await this.disconnect();

      console.log('正在连接数据库...', {
        host: config.host,
        port: config.port,
        database: config.database,
        ssl: config.ssl
      });

      const startTime = Date.now();
      
      // 创建连接选项
      const connectionOptions = createConnectionOptions(config);
      
      // 建立连接
      this.connection = await mysql.createConnection(connectionOptions);
      
      // 测试连接
      await this.connection.ping();
      
      const latency = Date.now() - startTime;
      
      // 更新状态
      this.config = config;
      this.connectionStatus = {
        isConnected: true,
        lastConnected: new Date(),
        error: null,
        latency
      };
      this.retryCount = 0;

      console.log(`数据库连接成功，延迟: ${latency}ms`);
      
      // 记录连接日志
      await this.logOperation('CONNECT', 'database', null, 'SUCCESS', null, latency);
      
      return true;

    } catch (error: any) {
      console.error('数据库连接失败:', error);
      
      const dbError = databaseErrorHandler.handleError(error, {
        operation: 'CONNECT',
        tableName: 'database'
      });
      this.connectionStatus = {
        isConnected: false,
        lastConnected: null,
        error: dbError.message
      };

      // 记录连接失败日志
      await this.logOperation('CONNECT', 'database', null, 'FAILED', dbError.message);
      
      throw dbError;
    } finally {
      this.isConnecting = false;
    }
  }

  /**
   * 断开数据库连接
   */
  async disconnect(): Promise<void> {
    if (this.connection) {
      try {
        await this.connection.end();
        console.log('数据库连接已断开');
      } catch (error) {
        console.error('断开数据库连接时出错:', error);
      } finally {
        this.connection = null;
        this.connectionStatus.isConnected = false;
      }
    }
  }

  /**
   * 测试数据库连接
   */
  async testConnection(): Promise<boolean> {
    if (!this.connection) {
      return false;
    }

    try {
      const startTime = Date.now();
      await this.connection.ping();
      const latency = Date.now() - startTime;
      
      this.connectionStatus.latency = latency;
      this.connectionStatus.error = null;
      
      return true;
    } catch (error: any) {
      console.error('数据库连接测试失败:', error);
      
      const dbError = databaseErrorHandler.handleError(error, {
        operation: 'TEST_CONNECTION',
        tableName: 'database'
      });
      this.connectionStatus.error = dbError.message;
      this.connectionStatus.isConnected = false;
      
      return false;
    }
  }

  /**
   * 获取连接状态
   */
  getConnectionStatus(): ConnectionStatus {
    return { ...this.connectionStatus };
  }

  /**
   * 带重试机制的数据库操作执行器
   */
  private async executeWithRetry<T>(
    operation: () => Promise<T>,
    operationName: string
  ): Promise<T> {
    let lastError: any;
    
    for (let attempt = 1; attempt <= CONFIG_CONSTANTS.MAX_RETRY_COUNT; attempt++) {
      try {
        // 检查连接状态
        if (!this.connection || !await this.testConnection()) {
          if (this.config) {
            console.log(`第 ${attempt} 次尝试重新连接数据库...`);
            await this.connect(this.config);
          } else {
            throw new Error('数据库未配置');
          }
        }

        // 执行操作
        return await operation();

      } catch (error: any) {
        lastError = error;
        console.error(`${operationName} 第 ${attempt} 次尝试失败:`, error);

        // 如果不是最后一次尝试，等待后重试
        if (attempt < CONFIG_CONSTANTS.MAX_RETRY_COUNT) {
          const delay = calculateBackoffDelay(attempt);
          console.log(`等待 ${delay}ms 后重试...`);
          await this.delay(delay);
        }
      }
    }

    // 所有重试都失败了
    const dbError = databaseErrorHandler.handleError(lastError, {
      operation: operationName,
      tableName: 'unknown'
    });
    throw dbError;
  }

  /**
   * 保存图片到数据库
   */
  async saveImage(image: SavedImage): Promise<SavedImage> {
    return this.executeWithRetry(async () => {
      const startTime = Date.now();
      
      try {
        const sql = `
          INSERT INTO images (
            id, url, original_url, prompt, model, aspect_ratio, image_size,
            ref_images, created_at, updated_at, tags, favorite, oss_key, oss_uploaded, user_id
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        
        const values = [
          image.id,
          image.url,
          image.originalUrl || null,
          image.prompt,
          image.model,
          image.aspectRatio || 'auto',
          image.imageSize || '1K',
          image.refImages ? JSON.stringify(image.refImages) : null,
          image.createdAt,
          new Date(), // updated_at
          image.tags ? JSON.stringify(image.tags) : null,
          Boolean(image.favorite),
          image.ossKey || null,
          Boolean(image.ossUploaded),
          'default' // user_id
        ];

        await this.connection!.execute(sql, values);
        
        const duration = Date.now() - startTime;
        await this.logOperation('INSERT', 'images', image.id, 'SUCCESS', null, duration);
        
        console.log(`图片保存成功: ${image.id}`);
        return image;

      } catch (error: any) {
        const duration = Date.now() - startTime;
        await this.logOperation('INSERT', 'images', image.id, 'FAILED', error.message, duration);
        throw error;
      }
    }, '保存图片');
  }

  /**
   * 分页获取图片列表
   */
  async getImages(pagination: PaginationOptions): Promise<PaginatedResult<SavedImage>> {
    return this.executeWithRetry(async () => {
      const startTime = Date.now();
      
      try {
        // 构建查询条件
        const whereConditions: string[] = [];
        const queryParams: any[] = [];
        
        if (pagination.filters) {
          for (const [key, value] of Object.entries(pagination.filters)) {
            if (value === null || value === undefined) continue;
            
            switch (key) {
              case 'model':
                whereConditions.push('model = ?');
                queryParams.push(value);
                break;
              case 'favorite':
                whereConditions.push('favorite = ?');
                queryParams.push(Boolean(value));
                break;
              case 'search':
                whereConditions.push('(prompt LIKE ? OR JSON_SEARCH(tags, "one", ?) IS NOT NULL)');
                const searchTerm = `%${value}%`;
                queryParams.push(searchTerm, `%${value}%`);
                break;
            }
          }
        }
        
        const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
        
        // 构建排序
        const allowedSortFields = ['id', 'created_at', 'updated_at', 'model', 'favorite'];
        const sortBy = allowedSortFields.includes(pagination.sortBy || '') ? pagination.sortBy : 'created_at';
        const sortOrder = pagination.sortOrder === 'ASC' ? 'ASC' : 'DESC';
        const orderClause = `ORDER BY ${sortBy} ${sortOrder}`;
        
        // 分页参数
        const offset = (pagination.page - 1) * pagination.pageSize;
        const limitClause = 'LIMIT ? OFFSET ?';
        
        // 查询总数
        const countSql = `SELECT COUNT(*) as total FROM images ${whereClause}`;
        const [countRows] = await this.connection!.execute(countSql, queryParams);
        const total = (countRows as any[])[0].total;
        
        // 查询数据
        const dataSql = `
          SELECT * FROM images 
          ${whereClause} 
          ${orderClause} 
          ${limitClause}
        `;
        const dataParams = [...queryParams, pagination.pageSize, offset];
        const [dataRows] = await this.connection!.execute(dataSql, dataParams);
        
        // 转换数据格式
        const images = (dataRows as any[]).map(row => this.rowToSavedImage(row));
        
        const result: PaginatedResult<SavedImage> = {
          data: images,
          total,
          page: pagination.page,
          pageSize: pagination.pageSize,
          totalPages: Math.ceil(total / pagination.pageSize),
          hasNext: pagination.page < Math.ceil(total / pagination.pageSize),
          hasPrev: pagination.page > 1
        };
        
        const duration = Date.now() - startTime;
        await this.logOperation('SELECT', 'images', null, 'SUCCESS', null, duration);
        
        console.log(`获取图片列表成功: ${images.length} 条记录`);
        return result;

      } catch (error: any) {
        const duration = Date.now() - startTime;
        await this.logOperation('SELECT', 'images', null, 'FAILED', error.message, duration);
        throw error;
      }
    }, '获取图片列表');
  }

  /**
   * 更新图片信息
   */
  async updateImage(id: string, updates: Partial<SavedImage>): Promise<SavedImage> {
    return this.executeWithRetry(async () => {
      const startTime = Date.now();
      
      try {
        // 构建更新字段
        const updateFields: string[] = [];
        const updateValues: any[] = [];
        
        if (updates.url !== undefined) {
          updateFields.push('url = ?');
          updateValues.push(updates.url);
        }
        if (updates.originalUrl !== undefined) {
          updateFields.push('original_url = ?');
          updateValues.push(updates.originalUrl);
        }
        if (updates.prompt !== undefined) {
          updateFields.push('prompt = ?');
          updateValues.push(updates.prompt);
        }
        if (updates.tags !== undefined) {
          updateFields.push('tags = ?');
          updateValues.push(updates.tags ? JSON.stringify(updates.tags) : null);
        }
        if (updates.favorite !== undefined) {
          updateFields.push('favorite = ?');
          updateValues.push(Boolean(updates.favorite));
        }
        if (updates.ossKey !== undefined) {
          updateFields.push('oss_key = ?');
          updateValues.push(updates.ossKey);
        }
        if (updates.ossUploaded !== undefined) {
          updateFields.push('oss_uploaded = ?');
          updateValues.push(Boolean(updates.ossUploaded));
        }
        
        // 总是更新 updated_at
        updateFields.push('updated_at = ?');
        updateValues.push(new Date());
        
        if (updateFields.length === 1) { // 只有 updated_at
          throw new Error('没有需要更新的字段');
        }
        
        const sql = `UPDATE images SET ${updateFields.join(', ')} WHERE id = ?`;
        updateValues.push(id);
        
        const [result] = await this.connection!.execute(sql, updateValues);
        
        if ((result as any).affectedRows === 0) {
          throw new Error(`图片不存在: ${id}`);
        }
        
        // 获取更新后的数据
        const [rows] = await this.connection!.execute('SELECT * FROM images WHERE id = ?', [id]);
        const updatedImage = this.rowToSavedImage((rows as any[])[0]);
        
        const duration = Date.now() - startTime;
        await this.logOperation('UPDATE', 'images', id, 'SUCCESS', null, duration);
        
        console.log(`图片更新成功: ${id}`);
        return updatedImage;

      } catch (error: any) {
        const duration = Date.now() - startTime;
        await this.logOperation('UPDATE', 'images', id, 'FAILED', error.message, duration);
        throw error;
      }
    }, '更新图片');
  }

  /**
   * 删除图片（支持级联删除）
   */
  async deleteImage(id: string, cascadeDelete: boolean = true): Promise<void> {
    return this.executeWithRetry(async () => {
      const startTime = Date.now();
      
      try {
        // 如果需要级联删除，先获取图片信息
        let imageInfo: SavedImage | null = null;
        if (cascadeDelete) {
          const [rows] = await this.connection!.execute('SELECT * FROM images WHERE id = ?', [id]);
          if ((rows as any[]).length > 0) {
            imageInfo = this.rowToSavedImage((rows as any[])[0]);
          }
        }
        
        // 从数据库删除图片记录
        const sql = 'DELETE FROM images WHERE id = ?';
        const [result] = await this.connection!.execute(sql, [id]);
        
        if ((result as any).affectedRows === 0) {
          throw new Error(`图片不存在: ${id}`);
        }
        
        // 如果启用级联删除且图片已上传到 OSS，尝试删除 OSS 文件
        if (cascadeDelete && imageInfo && imageInfo.ossUploaded && imageInfo.ossKey) {
          try {
            // 注意：这里只是记录需要删除的 OSS 对象，实际删除需要服务端支持
            console.log(`需要删除 OSS 对象: ${imageInfo.ossKey}`);
            // TODO: 调用 OSS 删除 API 或记录到删除队列
            await this.logOperation('DELETE_OSS', 'oss_objects', imageInfo.ossKey, 'SUCCESS', '等待服务端处理');
          } catch (ossError: any) {
            console.warn(`删除 OSS 对象失败: ${ossError.message}`);
            // OSS 删除失败不应该影响数据库删除
          }
        }
        
        const duration = Date.now() - startTime;
        await this.logOperation('DELETE', 'images', id, 'SUCCESS', null, duration);
        
        console.log(`图片删除成功: ${id}${cascadeDelete ? ' (包含级联删除)' : ''}`);

      } catch (error: any) {
        const duration = Date.now() - startTime;
        await this.logOperation('DELETE', 'images', id, 'FAILED', error.message, duration);
        throw error;
      }
    }, '删除图片');
  }

  /**
   * 批量删除图片
   */
  async deleteImages(ids: string[], cascadeDelete: boolean = true): Promise<{ 
    successful: string[], 
    failed: { id: string, error: string }[] 
  }> {
    const successful: string[] = [];
    const failed: { id: string, error: string }[] = [];
    
    console.log(`开始批量删除 ${ids.length} 张图片...`);
    
    for (const id of ids) {
      try {
        await this.deleteImage(id, cascadeDelete);
        successful.push(id);
      } catch (error: any) {
        console.error(`删除图片 ${id} 失败:`, error);
        failed.push({ id, error: error.message });
      }
    }
    
    console.log(`批量删除完成: 成功 ${successful.length} 张，失败 ${failed.length} 张`);
    
    return { successful, failed };
  }

  /**
   * 验证 API 配置
   */
  private validateApiConfig(config: ApiConfig): string[] {
    const errors: string[] = [];
    
    if (!config.apiKey || config.apiKey.trim() === '') {
      errors.push('API 密钥不能为空');
    }
    
    if (!config.baseUrl || config.baseUrl.trim() === '') {
      errors.push('API 基础地址不能为空');
    } else {
      try {
        new URL(config.baseUrl);
      } catch {
        errors.push('API 基础地址格式无效');
      }
    }
    
    if (config.timeout <= 0) {
      errors.push('请求超时时间必须大于 0');
    }
    
    if (config.retryCount < 0) {
      errors.push('重试次数不能为负数');
    }
    
    if (!config.provider || config.provider.trim() === '') {
      errors.push('服务提供商名称不能为空');
    }
    
    return errors;
  }

  /**
   * 清理 API 配置数据
   */
  private cleanApiConfig(config: ApiConfig): ApiConfig {
    return {
      apiKey: config.apiKey.trim(),
      baseUrl: config.baseUrl.trim().replace(/\/$/, ''), // 移除末尾斜杠
      timeout: Math.max(1000, Math.min(300000, config.timeout)), // 限制在 1s-5min 之间
      retryCount: Math.max(0, Math.min(10, config.retryCount)), // 限制在 0-10 之间
      provider: config.provider.trim()
    };
  }

  /**
   * 保存 API 配置
   */
  async saveApiConfig(config: ApiConfig): Promise<void> {
    return this.executeWithRetry(async () => {
      const startTime = Date.now();
      
      try {
        // 验证配置
        const validationErrors = this.validateApiConfig(config);
        if (validationErrors.length > 0) {
          throw new Error(`API 配置验证失败: ${validationErrors.join(', ')}`);
        }
        
        // 清理配置数据
        const cleanedConfig = this.cleanApiConfig(config);
        
        // 加密敏感信息
        const encryptedConfig = {
          ...cleanedConfig,
          apiKey: getEncryptionService().encrypt(cleanedConfig.apiKey)
        };
        
        const sql = `
          INSERT INTO user_configs (user_id, api_config, updated_at) 
          VALUES ('default', ?, ?) 
          ON DUPLICATE KEY UPDATE api_config = VALUES(api_config), updated_at = VALUES(updated_at)
        `;
        
        await this.connection!.execute(sql, [JSON.stringify(encryptedConfig), new Date()]);
        
        const duration = Date.now() - startTime;
        await this.logOperation('UPSERT', 'user_configs', 'default', 'SUCCESS', null, duration);
        
        console.log('API 配置保存成功');

      } catch (error: any) {
        const duration = Date.now() - startTime;
        await this.logOperation('UPSERT', 'user_configs', 'default', 'FAILED', error.message, duration);
        throw error;
      }
    }, '保存 API 配置');
  }

  /**
   * 获取 API 配置
   */
  async getApiConfig(): Promise<ApiConfig | null> {
    return this.executeWithRetry(async () => {
      const startTime = Date.now();
      
      try {
        const sql = 'SELECT api_config FROM user_configs WHERE user_id = ?';
        const [rows] = await this.connection!.execute(sql, ['default']);
        
        if ((rows as any[]).length === 0 || !(rows as any[])[0].api_config) {
          return null;
        }
        
        const encryptedConfig = JSON.parse((rows as any[])[0].api_config);
        
        // 解密敏感信息
        const config: ApiConfig = {
          ...encryptedConfig,
          apiKey: getEncryptionService().decrypt(encryptedConfig.apiKey)
        };
        
        const duration = Date.now() - startTime;
        await this.logOperation('SELECT', 'user_configs', 'default', 'SUCCESS', null, duration);
        
        return config;

      } catch (error: any) {
        const duration = Date.now() - startTime;
        await this.logOperation('SELECT', 'user_configs', 'default', 'FAILED', error.message, duration);
        throw error;
      }
    }, '获取 API 配置');
  }

  /**
   * 验证 OSS 配置
   */
  private validateOSSConfig(config: OSSConfig): string[] {
    const errors: string[] = [];
    
    if (!config.accessKeyId || config.accessKeyId.trim() === '') {
      errors.push('AccessKey ID 不能为空');
    }
    
    if (!config.accessKeySecret || config.accessKeySecret.trim() === '') {
      errors.push('AccessKey Secret 不能为空');
    }
    
    if (!config.region || config.region.trim() === '') {
      errors.push('地域不能为空');
    }
    
    if (!config.bucket || config.bucket.trim() === '') {
      errors.push('存储桶名称不能为空');
    } else {
      // 验证存储桶名称格式（阿里云 OSS 规则）
      const bucketNameRegex = /^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/;
      if (!bucketNameRegex.test(config.bucket)) {
        errors.push('存储桶名称格式无效（只能包含小写字母、数字和连字符，长度3-63字符）');
      }
    }
    
    if (config.endpoint && config.endpoint.trim() !== '') {
      try {
        new URL(config.endpoint);
      } catch {
        errors.push('自定义域名格式无效');
      }
    }
    
    return errors;
  }

  /**
   * 清理 OSS 配置数据
   */
  private cleanOSSConfig(config: OSSConfig): OSSConfig {
    return {
      accessKeyId: config.accessKeyId.trim(),
      accessKeySecret: config.accessKeySecret.trim(),
      region: config.region.trim(),
      bucket: config.bucket.trim().toLowerCase(),
      endpoint: config.endpoint ? config.endpoint.trim().replace(/\/$/, '') : undefined,
      secure: config.secure !== false, // 默认使用 HTTPS
      pathStyle: Boolean(config.pathStyle),
      enabled: Boolean(config.enabled)
    };
  }

  /**
   * 保存 OSS 配置
   */
  async saveOSSConfig(config: OSSConfig): Promise<void> {
    return this.executeWithRetry(async () => {
      const startTime = Date.now();
      
      try {
        // 验证配置
        const validationErrors = this.validateOSSConfig(config);
        if (validationErrors.length > 0) {
          throw new Error(`OSS 配置验证失败: ${validationErrors.join(', ')}`);
        }
        
        // 清理配置数据
        const cleanedConfig = this.cleanOSSConfig(config);
        
        // 加密敏感信息
        const encryptedConfig = {
          ...cleanedConfig,
          accessKeyId: getEncryptionService().encrypt(cleanedConfig.accessKeyId),
          accessKeySecret: getEncryptionService().encrypt(cleanedConfig.accessKeySecret)
        };
        
        const sql = `
          INSERT INTO user_configs (user_id, oss_config, updated_at) 
          VALUES ('default', ?, ?) 
          ON DUPLICATE KEY UPDATE oss_config = VALUES(oss_config), updated_at = VALUES(updated_at)
        `;
        
        await this.connection!.execute(sql, [JSON.stringify(encryptedConfig), new Date()]);
        
        const duration = Date.now() - startTime;
        await this.logOperation('UPSERT', 'user_configs', 'default', 'SUCCESS', null, duration);
        
        console.log('OSS 配置保存成功');

      } catch (error: any) {
        const duration = Date.now() - startTime;
        await this.logOperation('UPSERT', 'user_configs', 'default', 'FAILED', error.message, duration);
        throw error;
      }
    }, '保存 OSS 配置');
  }

  /**
   * 获取 OSS 配置
   */
  async getOSSConfig(): Promise<OSSConfig | null> {
    return this.executeWithRetry(async () => {
      const startTime = Date.now();
      
      try {
        const sql = 'SELECT oss_config FROM user_configs WHERE user_id = ?';
        const [rows] = await this.connection!.execute(sql, ['default']);
        
        if ((rows as any[]).length === 0 || !(rows as any[])[0].oss_config) {
          return null;
        }
        
        const encryptedConfig = JSON.parse((rows as any[])[0].oss_config);
        
        // 解密敏感信息
        const config: OSSConfig = {
          ...encryptedConfig,
          accessKeyId: getEncryptionService().decrypt(encryptedConfig.accessKeyId),
          accessKeySecret: getEncryptionService().decrypt(encryptedConfig.accessKeySecret)
        };
        
        const duration = Date.now() - startTime;
        await this.logOperation('SELECT', 'user_configs', 'default', 'SUCCESS', null, duration);
        
        return config;

      } catch (error: any) {
        const duration = Date.now() - startTime;
        await this.logOperation('SELECT', 'user_configs', 'default', 'FAILED', error.message, duration);
        throw error;
      }
    }, '获取 OSS 配置');
  }

  /**
   * 删除 API 配置
   */
  async deleteApiConfig(requireConfirmation: boolean = true): Promise<void> {
    return this.executeWithRetry(async () => {
      const startTime = Date.now();
      
      try {
        if (requireConfirmation) {
          // 检查配置是否存在
          const existingConfig = await this.getApiConfig();
          if (!existingConfig) {
            console.log('API 配置不存在，无需删除');
            return;
          }
        }
        
        const sql = `
          UPDATE user_configs 
          SET api_config = NULL, updated_at = ? 
          WHERE user_id = ?
        `;
        
        const [result] = await this.connection!.execute(sql, [new Date(), 'default']);
        
        const duration = Date.now() - startTime;
        await this.logOperation('DELETE', 'user_configs', 'api_config', 'SUCCESS', null, duration);
        
        console.log('API 配置删除成功');

      } catch (error: any) {
        const duration = Date.now() - startTime;
        await this.logOperation('DELETE', 'user_configs', 'api_config', 'FAILED', error.message, duration);
        throw error;
      }
    }, '删除 API 配置');
  }

  /**
   * 删除 OSS 配置
   */
  async deleteOSSConfig(requireConfirmation: boolean = true): Promise<void> {
    return this.executeWithRetry(async () => {
      const startTime = Date.now();
      
      try {
        if (requireConfirmation) {
          // 检查配置是否存在
          const existingConfig = await this.getOSSConfig();
          if (!existingConfig) {
            console.log('OSS 配置不存在，无需删除');
            return;
          }
        }
        
        const sql = `
          UPDATE user_configs 
          SET oss_config = NULL, updated_at = ? 
          WHERE user_id = ?
        `;
        
        const [result] = await this.connection!.execute(sql, [new Date(), 'default']);
        
        const duration = Date.now() - startTime;
        await this.logOperation('DELETE', 'user_configs', 'oss_config', 'SUCCESS', null, duration);
        
        console.log('OSS 配置删除成功');

      } catch (error: any) {
        const duration = Date.now() - startTime;
        await this.logOperation('DELETE', 'user_configs', 'oss_config', 'FAILED', error.message, duration);
        throw error;
      }
    }, '删除 OSS 配置');
  }

  /**
   * 删除所有配置
   */
  async deleteAllConfigs(requireConfirmation: boolean = true): Promise<void> {
    return this.executeWithRetry(async () => {
      const startTime = Date.now();
      
      try {
        if (requireConfirmation) {
          // 检查是否有任何配置存在
          const [apiConfig, ossConfig] = await Promise.all([
            this.getApiConfig(),
            this.getOSSConfig()
          ]);
          
          if (!apiConfig && !ossConfig) {
            console.log('没有配置需要删除');
            return;
          }
        }
        
        const sql = `
          UPDATE user_configs 
          SET api_config = NULL, oss_config = NULL, updated_at = ? 
          WHERE user_id = ?
        `;
        
        const [result] = await this.connection!.execute(sql, [new Date(), 'default']);
        
        const duration = Date.now() - startTime;
        await this.logOperation('DELETE', 'user_configs', 'all_configs', 'SUCCESS', null, duration);
        
        console.log('所有配置删除成功');

      } catch (error: any) {
        const duration = Date.now() - startTime;
        await this.logOperation('DELETE', 'user_configs', 'all_configs', 'FAILED', error.message, duration);
        throw error;
      }
    }, '删除所有配置');
  }

  /**
   * 清除用户所有数据（包括配置和偏好设置）
   */
  async clearUserData(requireConfirmation: boolean = true): Promise<void> {
    return this.executeWithRetry(async () => {
      const startTime = Date.now();
      
      try {
        if (requireConfirmation) {
          // 检查用户数据是否存在
          const sql = 'SELECT COUNT(*) as count FROM user_configs WHERE user_id = ?';
          const [rows] = await this.connection!.execute(sql, ['default']);
          
          if ((rows as any[])[0].count === 0) {
            console.log('用户数据不存在，无需清除');
            return;
          }
        }
        
        const sql = 'DELETE FROM user_configs WHERE user_id = ?';
        const [result] = await this.connection!.execute(sql, ['default']);
        
        const duration = Date.now() - startTime;
        await this.logOperation('DELETE', 'user_configs', 'default', 'SUCCESS', null, duration);
        
        console.log('用户数据清除成功');

      } catch (error: any) {
        const duration = Date.now() - startTime;
        await this.logOperation('DELETE', 'user_configs', 'default', 'FAILED', error.message, duration);
        throw error;
      }
    }, '清除用户数据');
  }

  /**
   * 初始化数据库表结构
   */
  async initializeTables(): Promise<void> {
    return this.executeWithRetry(async () => {
      const startTime = Date.now();
      
      try {
        if (!this.connection) {
          throw new Error('数据库未连接');
        }

        // 使用专门的初始化器
        const initializer = createDatabaseInitializer(this.connection);
        await initializer.initializeAllTables();
        
        const duration = Date.now() - startTime;
        await this.logOperation('CREATE', 'database', null, 'SUCCESS', null, duration);
        
        console.log('数据库表结构初始化成功');

      } catch (error: any) {
        const duration = Date.now() - startTime;
        await this.logOperation('CREATE', 'database', null, 'FAILED', error.message, duration);
        throw error;
      }
    }, '初始化数据库表');
  }

  /**
   * 数据库迁移（暂时简单实现）
   */
  async migrateSchema(version: string): Promise<void> {
    console.log(`数据库迁移到版本 ${version}（暂未实现）`);
    // TODO: 实现具体的迁移逻辑
  }

  /**
   * 获取数据库统计信息
   */
  async getDatabaseStats(): Promise<any> {
    return this.executeWithRetry(async () => {
      if (!this.connection) {
        throw new Error('数据库未连接');
      }

      const initializer = createDatabaseInitializer(this.connection);
      return await initializer.getDatabaseStats();
    }, '获取数据库统计信息');
  }

  /**
   * 检查数据库版本兼容性
   */
  async checkDatabaseVersion(): Promise<{ version: string; compatible: boolean }> {
    return this.executeWithRetry(async () => {
      if (!this.connection) {
        throw new Error('数据库未连接');
      }

      const initializer = createDatabaseInitializer(this.connection);
      return await initializer.checkDatabaseVersion();
    }, '检查数据库版本');
  }

  /**
   * 记录操作日志
   */
  private async logOperation(
    operation: string,
    tableName: string,
    recordId: string | null,
    status: 'SUCCESS' | 'FAILED',
    errorMessage?: string | null,
    duration?: number
  ): Promise<void> {
    // 避免在记录日志时出错导致无限递归
    if (!this.connection || tableName === 'operation_logs') {
      return;
    }

    try {
      const sql = `
        INSERT INTO operation_logs (operation, table_name, record_id, user_id, status, error_message, duration)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `;
      
      await this.connection.execute(sql, [
        operation,
        tableName,
        recordId,
        'default',
        status,
        errorMessage || null,
        duration || null
      ]);
    } catch (error) {
      // 记录日志失败不应该影响主要操作
      console.error('记录操作日志失败:', error);
    }
  }

  /**
   * 转换数据库行为 SavedImage 对象
   */
  private rowToSavedImage(row: any): SavedImage {
    return {
      id: row.id,
      url: row.url,
      originalUrl: row.original_url || undefined,
      prompt: row.prompt,
      model: row.model,
      aspectRatio: row.aspect_ratio || 'auto',
      imageSize: row.image_size || '1K',
      refImages: row.ref_images ? JSON.parse(row.ref_images) : undefined,
      createdAt: new Date(row.created_at),
      tags: row.tags ? JSON.parse(row.tags) : undefined,
      favorite: Boolean(row.favorite),
      ossKey: row.oss_key || undefined,
      ossUploaded: Boolean(row.oss_uploaded)
    };
  }

  /**
   * 延迟函数
   */
  private delay(ms: number): Promise<void> {
    return delay(ms);
  }
}

// 创建单例实例
export const databaseService = new DatabaseServiceImpl();
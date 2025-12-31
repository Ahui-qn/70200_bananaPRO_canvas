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
  DatabaseError,
  ImageStatistics,
  DatabaseStatistics,
  StatisticsFilter
} from '../types';
import { 
  validateDatabaseConfig,
  CONFIG_CONSTANTS
} from '../config/database.js';
import { 
  createConnectionOptions,
  formatDatabaseError,
  isDatabaseConfigComplete,
  delay,
  calculateBackoffDelay
} from '../utils/database.js';
import { getEncryptionService } from './encryptionService.js';
import { createDatabaseInitializer } from './databaseInitializer.js';
import { createDatabaseMigrator, DatabaseMigrator, MigrationResult, VersionComparison } from './databaseMigrator.js';
import { databaseErrorHandler } from './databaseErrorHandler.js';
import { networkErrorHandler } from './networkErrorHandler.js';
import { conflictResolver, ConflictResolutionStrategy } from './conflictResolver.js';
import { ConnectionMonitor, createConnectionMonitor, ConnectionStatusListener } from './connectionMonitor.js';

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
  private connectionMonitor: ConnectionMonitor;
  private migrator: DatabaseMigrator | null = null;

  constructor() {
    // 初始化连接监控器
    this.connectionMonitor = createConnectionMonitor(this);
  }

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

      // 初始化迁移器
      this.migrator = createDatabaseMigrator(this.connection);

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
        this.migrator = null;
        this.connectionStatus.isConnected = false;
      }
    }
  }

  /**
   * 测试数据库连接
   */
  async testConnection(config?: DatabaseConfig): Promise<boolean | { success: boolean; latency?: number; error?: string }> {
    // 如果提供了配置，使用新配置测试连接
    if (config) {
      return this.testConnectionWithConfig(config);
    }

    // 否则测试现有连接
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
   * 使用指定配置测试数据库连接
   */
  async testConnectionWithConfig(config: DatabaseConfig): Promise<{ success: boolean; latency?: number; error?: string }> {
    let testConnection: mysql.Connection | null = null;
    
    try {
      // 验证配置
      const configErrors = validateDatabaseConfig(config);
      if (configErrors.length > 0) {
        return {
          success: false,
          error: `配置错误: ${configErrors.join(', ')}`
        };
      }

      console.log('正在测试数据库连接...', {
        host: config.host,
        port: config.port,
        database: config.database,
        ssl: config.ssl
      });

      const startTime = Date.now();
      
      // 创建连接选项
      const connectionOptions = createConnectionOptions(config);
      
      // 建立测试连接
      testConnection = await mysql.createConnection(connectionOptions);
      
      // 测试连接
      await testConnection.ping();
      
      const latency = Date.now() - startTime;
      
      console.log(`数据库连接测试成功，延迟: ${latency}ms`);
      
      return {
        success: true,
        latency
      };

    } catch (error: any) {
      console.error('数据库连接测试失败:', error);
      
      const dbError = databaseErrorHandler.handleError(error, {
        operation: 'TEST_CONNECTION',
        tableName: 'database'
      });
      
      return {
        success: false,
        error: dbError.message
      };
    } finally {
      // 关闭测试连接
      if (testConnection) {
        try {
          await testConnection.end();
        } catch (e) {
          // 忽略关闭连接时的错误
        }
      }
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
        
        // 分页参数 - 确保是整数
        const pageSize = Math.max(1, Math.floor(Number(pagination.pageSize) || 20));
        const page = Math.max(1, Math.floor(Number(pagination.page) || 1));
        const offset = (page - 1) * pageSize;
        
        // 查询总数
        const countSql = `SELECT COUNT(*) as total FROM images ${whereClause}`;
        const [countRows] = await this.connection!.execute(countSql, queryParams);
        const total = (countRows as any[])[0].total;
        
        // 查询数据 - 直接将数字嵌入 SQL（因为 MySQL prepared statement 对 LIMIT/OFFSET 有限制）
        const dataSql = `
          SELECT * FROM images 
          ${whereClause} 
          ${orderClause} 
          LIMIT ${pageSize} OFFSET ${offset}
        `;
        const [dataRows] = await this.connection!.execute(dataSql, queryParams);
        
        // 转换数据格式
        const images = (dataRows as any[]).map(row => this.rowToSavedImage(row));
        
        const result: PaginatedResult<SavedImage> = {
          data: images,
          total,
          page: page,
          pageSize: pageSize,
          totalPages: Math.ceil(total / pageSize),
          hasNext: page < Math.ceil(total / pageSize),
          hasPrev: page > 1
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
   * 更新图片信息（带冲突检测）
   */
  async updateImage(id: string, updates: Partial<SavedImage>): Promise<SavedImage> {
    return this.executeWithRetry(async () => {
      const startTime = Date.now();
      
      try {
        // 首先获取当前数据库中的数据
        const [currentRows] = await this.connection!.execute('SELECT * FROM images WHERE id = ?', [id]);
        
        if ((currentRows as any[]).length === 0) {
          throw new Error(`图片不存在: ${id}`);
        }
        
        const currentData = this.rowToSavedImage((currentRows as any[])[0]);
        
        // 检测冲突（如果更新数据包含时间戳信息）
        if (updates.createdAt || (updates as any).updatedAt) {
          const localData = { ...currentData, ...updates };
          const conflictInfo = conflictResolver.detectConflict(
            localData,
            currentData,
            id,
            'images'
          );
          
          if (conflictInfo) {
            console.log(`检测到图片更新冲突: ${id}`);
            
            // 使用最新时间戳策略解决冲突
            const resolution = conflictResolver.resolveConflict(
              conflictInfo,
              ConflictResolutionStrategy.LATEST_WINS
            );
            
            if (resolution.resolved) {
              console.log(`冲突已解决: ${resolution.message}`);
              // 使用解决后的数据进行更新
              const resolvedUpdates = this.extractUpdatesFromResolvedData(resolution.finalData, currentData);
              return await this.performImageUpdate(id, resolvedUpdates, startTime);
            } else {
              console.warn(`冲突解决失败: ${resolution.message}`);
              // 继续使用原始更新数据
            }
          }
        }
        
        // 没有冲突或冲突解决失败，执行正常更新
        return await this.performImageUpdate(id, updates, startTime);

      } catch (error: any) {
        const duration = Date.now() - startTime;
        await this.logOperation('UPDATE', 'images', id, 'FAILED', error.message, duration);
        throw error;
      }
    }, '更新图片');
  }

  /**
   * 执行图片更新操作
   * @private
   */
  private async performImageUpdate(
    id: string, 
    updates: Partial<SavedImage>, 
    startTime: number
  ): Promise<SavedImage> {
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
  }

  /**
   * 从解决后的数据中提取更新字段
   * @private
   */
  private extractUpdatesFromResolvedData(resolvedData: any, currentData: SavedImage): Partial<SavedImage> {
    const updates: Partial<SavedImage> = {};
    
    // 比较字段并提取差异
    if (resolvedData.url !== currentData.url) {
      updates.url = resolvedData.url;
    }
    if (resolvedData.originalUrl !== currentData.originalUrl) {
      updates.originalUrl = resolvedData.originalUrl;
    }
    if (resolvedData.prompt !== currentData.prompt) {
      updates.prompt = resolvedData.prompt;
    }
    if (JSON.stringify(resolvedData.tags) !== JSON.stringify(currentData.tags)) {
      updates.tags = resolvedData.tags;
    }
    if (resolvedData.favorite !== currentData.favorite) {
      updates.favorite = resolvedData.favorite;
    }
    if (resolvedData.ossKey !== currentData.ossKey) {
      updates.ossKey = resolvedData.ossKey;
    }
    if (resolvedData.ossUploaded !== currentData.ossUploaded) {
      updates.ossUploaded = resolvedData.ossUploaded;
    }
    
    return updates;
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
   * 保存 API 配置（带冲突检测）
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
        
        // 获取当前配置进行冲突检测
        const currentConfig = await this.getApiConfig();
        if (currentConfig) {
          const conflictInfo = conflictResolver.detectConflict(
            { ...cleanedConfig, updatedAt: new Date() },
            { ...currentConfig, updatedAt: new Date(0) }, // 假设当前配置较旧
            'api_config',
            'user_configs'
          );
          
          if (conflictInfo) {
            console.log('检测到 API 配置更新冲突');
            
            const resolution = conflictResolver.resolveConflict(
              conflictInfo,
              ConflictResolutionStrategy.LATEST_WINS
            );
            
            if (resolution.resolved) {
              console.log(`API 配置冲突已解决: ${resolution.message}`);
              // 使用解决后的配置
              const resolvedConfig = resolution.finalData;
              return await this.performApiConfigSave(resolvedConfig, startTime);
            } else {
              console.warn(`API 配置冲突解决失败: ${resolution.message}`);
            }
          }
        }
        
        // 没有冲突或冲突解决失败，执行正常保存
        return await this.performApiConfigSave(cleanedConfig, startTime);

      } catch (error: any) {
        const duration = Date.now() - startTime;
        await this.logOperation('UPSERT', 'user_configs', 'default', 'FAILED', error.message, duration);
        throw error;
      }
    }, '保存 API 配置');
  }

  /**
   * 执行 API 配置保存操作
   * @private
   */
  private async performApiConfigSave(config: ApiConfig, startTime: number): Promise<void> {
    // 加密敏感信息
    const encryptedConfig = {
      ...config,
      apiKey: getEncryptionService().encrypt(config.apiKey)
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
   * 保存 OSS 配置（带冲突检测）
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
        
        // 获取当前配置进行冲突检测
        const currentConfig = await this.getOSSConfig();
        if (currentConfig) {
          const conflictInfo = conflictResolver.detectConflict(
            { ...cleanedConfig, updatedAt: new Date() },
            { ...currentConfig, updatedAt: new Date(0) }, // 假设当前配置较旧
            'oss_config',
            'user_configs'
          );
          
          if (conflictInfo) {
            console.log('检测到 OSS 配置更新冲突');
            
            const resolution = conflictResolver.resolveConflict(
              conflictInfo,
              ConflictResolutionStrategy.LATEST_WINS
            );
            
            if (resolution.resolved) {
              console.log(`OSS 配置冲突已解决: ${resolution.message}`);
              // 使用解决后的配置
              const resolvedConfig = resolution.finalData;
              return await this.performOSSConfigSave(resolvedConfig, startTime);
            } else {
              console.warn(`OSS 配置冲突解决失败: ${resolution.message}`);
            }
          }
        }
        
        // 没有冲突或冲突解决失败，执行正常保存
        return await this.performOSSConfigSave(cleanedConfig, startTime);

      } catch (error: any) {
        const duration = Date.now() - startTime;
        await this.logOperation('UPSERT', 'user_configs', 'default', 'FAILED', error.message, duration);
        throw error;
      }
    }, '保存 OSS 配置');
  }

  /**
   * 执行 OSS 配置保存操作
   * @private
   */
  private async performOSSConfigSave(config: OSSConfig, startTime: number): Promise<void> {
    // 加密敏感信息
    const encryptedConfig = {
      ...config,
      accessKeyId: getEncryptionService().encrypt(config.accessKeyId),
      accessKeySecret: getEncryptionService().encrypt(config.accessKeySecret)
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
   * 数据库迁移到指定版本
   */
  async migrateSchema(version: string): Promise<MigrationResult> {
    return this.executeWithRetry(async () => {
      const startTime = Date.now();
      
      try {
        if (!this.connection || !this.migrator) {
          throw new Error('数据库未连接或迁移器未初始化');
        }

        console.log(`开始迁移数据库到版本 ${version}...`);
        
        const result = await this.migrator.migrateToVersion(version);
        
        const duration = Date.now() - startTime;
        const status = result.success ? 'SUCCESS' : 'FAILED';
        
        await this.logOperation('MIGRATE', 'database', version, status, result.error, duration);
        
        if (result.success) {
          console.log(`数据库迁移成功到版本 ${version}`);
        } else {
          console.error(`数据库迁移失败:`, result.error);
        }
        
        return result;

      } catch (error: any) {
        const duration = Date.now() - startTime;
        await this.logOperation('MIGRATE', 'database', version, 'FAILED', error.message, duration);
        throw error;
      }
    }, '数据库迁移');
  }

  /**
   * 回滚数据库到指定版本
   */
  async rollbackToVersion(version: string): Promise<MigrationResult> {
    return this.executeWithRetry(async () => {
      const startTime = Date.now();
      
      try {
        if (!this.connection || !this.migrator) {
          throw new Error('数据库未连接或迁移器未初始化');
        }

        console.log(`开始回滚数据库到版本 ${version}...`);
        
        const result = await this.migrator.rollbackToVersion(version);
        
        const duration = Date.now() - startTime;
        const status = result.success ? 'SUCCESS' : 'FAILED';
        
        await this.logOperation('ROLLBACK', 'database', version, status, result.error, duration);
        
        if (result.success) {
          console.log(`数据库回滚成功到版本 ${version}`);
        } else {
          console.error(`数据库回滚失败:`, result.error);
        }
        
        return result;

      } catch (error: any) {
        const duration = Date.now() - startTime;
        await this.logOperation('ROLLBACK', 'database', version, 'FAILED', error.message, duration);
        throw error;
      }
    }, '数据库回滚');
  }

  /**
   * 获取当前数据库版本
   */
  async getCurrentDatabaseVersion(): Promise<string | null> {
    return this.executeWithRetry(async () => {
      if (!this.migrator) {
        throw new Error('迁移器未初始化');
      }

      return await this.migrator.getCurrentVersion();
    }, '获取数据库版本');
  }

  /**
   * 获取版本比较结果
   */
  async getVersionComparison(targetVersion: string): Promise<VersionComparison> {
    return this.executeWithRetry(async () => {
      if (!this.migrator) {
        throw new Error('迁移器未初始化');
      }

      return await this.migrator.getVersionComparison(targetVersion);
    }, '版本比较');
  }

  /**
   * 获取所有可用版本
   */
  getAvailableVersions(): any[] {
    if (!this.migrator) {
      return [];
    }

    return this.migrator.getAvailableVersions();
  }

  /**
   * 获取最新版本
   */
  getLatestVersion(): string {
    if (!this.migrator) {
      return '1.0.0';
    }

    return this.migrator.getLatestVersion();
  }

  /**
   * 获取迁移历史
   */
  async getMigrationHistory(limit: number = 50): Promise<any[]> {
    return this.executeWithRetry(async () => {
      if (!this.migrator) {
        throw new Error('迁移器未初始化');
      }

      return await this.migrator.getMigrationHistory(limit);
    }, '获取迁移历史');
  }

  /**
   * 验证数据库完整性
   */
  async validateDatabaseIntegrity(): Promise<{
    valid: boolean;
    issues: string[];
    recommendations: string[];
  }> {
    return this.executeWithRetry(async () => {
      if (!this.migrator) {
        throw new Error('迁移器未初始化');
      }

      return await this.migrator.validateDatabaseIntegrity();
    }, '验证数据库完整性');
  }

  /**
   * 清理过期的迁移日志
   */
  async cleanupMigrationLogs(daysToKeep: number = 30): Promise<number> {
    return this.executeWithRetry(async () => {
      if (!this.migrator) {
        throw new Error('迁移器未初始化');
      }

      return await this.migrator.cleanupMigrationLogs(daysToKeep);
    }, '清理迁移日志');
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
    // 安全解析 JSON 字段
    let refImages = undefined;
    if (row.ref_images) {
      try {
        refImages = typeof row.ref_images === 'string' ? JSON.parse(row.ref_images) : row.ref_images;
      } catch (e) {
        console.warn('解析 ref_images 失败:', e);
      }
    }

    let tags = undefined;
    if (row.tags) {
      try {
        tags = typeof row.tags === 'string' ? JSON.parse(row.tags) : row.tags;
      } catch (e) {
        console.warn('解析 tags 失败:', e);
      }
    }

    return {
      id: row.id,
      url: row.url,
      originalUrl: row.original_url || undefined,
      prompt: row.prompt,
      model: row.model,
      aspectRatio: row.aspect_ratio || 'auto',
      imageSize: row.image_size || '1K',
      refImages,
      createdAt: new Date(row.created_at),
      tags,
      favorite: Boolean(row.favorite),
      ossKey: row.oss_key || undefined,
      ossUploaded: Boolean(row.oss_uploaded)
    };
  }

  /**
   * 获取冲突解决统计信息
   */
  getConflictStats(): {
    total: number;
    byType: Record<string, number>;
    byTable: Record<string, number>;
    recent: number;
  } {
    return conflictResolver.getConflictStats();
  }

  /**
   * 获取冲突日志
   */
  getConflictLogs(limit?: number): any[] {
    return conflictResolver.getConflictLogs(limit);
  }

  /**
   * 清除冲突日志
   */
  clearConflictLogs(): void {
    conflictResolver.clearConflictLogs();
  }

  /**
   * 延迟函数
   */
  private delay(ms: number): Promise<void> {
    return delay(ms);
  }

  // ==================== 连接状态监控方法 ====================

  /**
   * 开始连接状态监控
   */
  startConnectionMonitoring(): void {
    this.connectionMonitor.startMonitoring();
  }

  /**
   * 停止连接状态监控
   */
  stopConnectionMonitoring(): void {
    this.connectionMonitor.stopMonitoring();
  }

  /**
   * 添加连接状态变化监听器
   */
  addConnectionStatusListener(listener: ConnectionStatusListener): void {
    this.connectionMonitor.addStatusListener(listener);
  }

  /**
   * 移除连接状态变化监听器
   */
  removeConnectionStatusListener(listener: ConnectionStatusListener): void {
    this.connectionMonitor.removeStatusListener(listener);
  }

  /**
   * 获取连接质量统计
   */
  getConnectionQualityStats() {
    return this.connectionMonitor.getQualityStats();
  }

  /**
   * 获取连接状态变化历史
   */
  getConnectionStatusHistory(limit?: number) {
    return this.connectionMonitor.getStatusHistory(limit);
  }

  /**
   * 获取当前连接质量
   */
  getCurrentConnectionQuality() {
    return this.connectionMonitor.getCurrentQuality();
  }

  /**
   * 手动触发连接测试
   */
  async triggerConnectionTest() {
    return await this.connectionMonitor.triggerConnectionTest();
  }

  /**
   * 设置监控间隔
   */
  setConnectionMonitoringInterval(intervalMs: number): void {
    this.connectionMonitor.setMonitoringInterval(intervalMs);
  }

  /**
   * 获取监控状态
   */
  getConnectionMonitoringStatus() {
    return this.connectionMonitor.getMonitoringStatus();
  }

  /**
   * 重置连接质量统计
   */
  resetConnectionQualityStats(): void {
    this.connectionMonitor.resetQualityStats();
  }

  /**
   * 清除连接状态历史
   */
  clearConnectionStatusHistory(): void {
    this.connectionMonitor.clearStatusHistory();
  }

  // ==================== 统计和分析功能 ====================

  /**
   * 获取图片统计信息
   */
  async getImageStatistics(filter?: StatisticsFilter): Promise<ImageStatistics> {
    return this.executeWithRetry(async () => {
      const startTime = Date.now();
      
      try {
        // 构建基础查询条件
        const whereConditions: string[] = [];
        const queryParams: any[] = [];
        
        // 应用筛选条件
        if (filter) {
          if (filter.dateRange) {
            whereConditions.push('created_at BETWEEN ? AND ?');
            queryParams.push(filter.dateRange.start, filter.dateRange.end);
          }
          
          if (filter.models && filter.models.length > 0) {
            whereConditions.push(`model IN (${filter.models.map(() => '?').join(', ')})`);
            queryParams.push(...filter.models);
          }
          
          if (filter.favorite !== undefined) {
            whereConditions.push('favorite = ?');
            queryParams.push(Boolean(filter.favorite));
          }
          
          if (filter.ossUploaded !== undefined) {
            whereConditions.push('oss_uploaded = ?');
            queryParams.push(Boolean(filter.ossUploaded));
          }
          
          if (filter.userId) {
            whereConditions.push('user_id = ?');
            queryParams.push(filter.userId);
          } else {
            whereConditions.push('user_id = ?');
            queryParams.push('default');
          }
        } else {
          whereConditions.push('user_id = ?');
          queryParams.push('default');
        }
        
        const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
        
        // 1. 获取基础统计信息
        const basicStatsSql = `
          SELECT 
            COUNT(*) as totalImages,
            SUM(CASE WHEN favorite = 1 THEN 1 ELSE 0 END) as favoriteImages,
            SUM(CASE WHEN oss_uploaded = 1 THEN 1 ELSE 0 END) as uploadedToOSS,
            SUM(CASE WHEN oss_uploaded = 0 THEN 1 ELSE 0 END) as pendingOSSUpload
          FROM images ${whereClause}
        `;
        
        const [basicStatsRows] = await this.connection!.execute(basicStatsSql, queryParams);
        const basicStats = (basicStatsRows as any[])[0];
        
        // 2. 按模型统计
        const modelStatsSql = `
          SELECT model, COUNT(*) as count 
          FROM images ${whereClause}
          GROUP BY model
          ORDER BY count DESC
        `;
        
        const [modelStatsRows] = await this.connection!.execute(modelStatsSql, queryParams);
        const byModel: Record<string, number> = {};
        (modelStatsRows as any[]).forEach(row => {
          byModel[row.model] = row.count;
        });
        
        // 3. 按时间范围统计
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const thisWeek = new Date(today.getTime() - (today.getDay() * 24 * 60 * 60 * 1000));
        const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const thisYear = new Date(now.getFullYear(), 0, 1);
        
        const timeRangeStatsSql = `
          SELECT 
            SUM(CASE WHEN created_at >= ? THEN 1 ELSE 0 END) as today,
            SUM(CASE WHEN created_at >= ? THEN 1 ELSE 0 END) as thisWeek,
            SUM(CASE WHEN created_at >= ? THEN 1 ELSE 0 END) as thisMonth,
            SUM(CASE WHEN created_at >= ? THEN 1 ELSE 0 END) as thisYear
          FROM images ${whereClause}
        `;
        
        const timeRangeParams = [today, thisWeek, thisMonth, thisYear, ...queryParams];
        const [timeRangeRows] = await this.connection!.execute(timeRangeStatsSql, timeRangeParams);
        const timeRangeStats = (timeRangeRows as any[])[0];
        
        // 构建结果
        const statistics: ImageStatistics = {
          totalImages: basicStats.totalImages || 0,
          favoriteImages: basicStats.favoriteImages || 0,
          uploadedToOSS: basicStats.uploadedToOSS || 0,
          pendingOSSUpload: basicStats.pendingOSSUpload || 0,
          byModel,
          byTimeRange: {
            today: timeRangeStats.today || 0,
            thisWeek: timeRangeStats.thisWeek || 0,
            thisMonth: timeRangeStats.thisMonth || 0,
            thisYear: timeRangeStats.thisYear || 0
          },
          byStatus: {
            favorite: basicStats.favoriteImages || 0,
            uploaded: basicStats.uploadedToOSS || 0,
            pending: basicStats.pendingOSSUpload || 0
          }
        };
        
        const duration = Date.now() - startTime;
        await this.logOperation('SELECT', 'images', null, 'SUCCESS', null, duration);
        
        console.log('图片统计信息获取成功:', statistics);
        return statistics;

      } catch (error: any) {
        const duration = Date.now() - startTime;
        await this.logOperation('SELECT', 'images', null, 'FAILED', error.message, duration);
        throw error;
      }
    }, '获取图片统计信息');
  }

  /**
   * 获取数据库统计信息
   */
  async getDatabaseStatistics(filter?: StatisticsFilter): Promise<DatabaseStatistics> {
    return this.executeWithRetry(async () => {
      const startTime = Date.now();
      
      try {
        // 1. 获取图片统计
        const imageStats = await this.getImageStatistics(filter);
        
        // 2. 获取操作统计
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
        
        const operationStatsSql = `
          SELECT 
            COUNT(*) as totalOperations,
            SUM(CASE WHEN status = 'SUCCESS' THEN 1 ELSE 0 END) as successfulOperations,
            SUM(CASE WHEN status = 'FAILED' THEN 1 ELSE 0 END) as failedOperations,
            SUM(CASE WHEN created_at >= ? THEN 1 ELSE 0 END) as recentOperations
          FROM operation_logs
        `;
        
        const [operationStatsRows] = await this.connection!.execute(operationStatsSql, [oneHourAgo]);
        const operationStats = (operationStatsRows as any[])[0];
        
        // 按操作类型统计
        const operationTypeStatsSql = `
          SELECT operation, COUNT(*) as count 
          FROM operation_logs 
          GROUP BY operation
          ORDER BY count DESC
        `;
        
        const [operationTypeRows] = await this.connection!.execute(operationTypeStatsSql);
        const byOperation: Record<string, number> = {};
        (operationTypeRows as any[]).forEach(row => {
          byOperation[row.operation] = row.count;
        });
        
        // 3. 获取性能统计
        const performanceStatsSql = `
          SELECT 
            AVG(duration) as averageResponseTime,
            MAX(duration) as slowestOperation,
            MIN(duration) as fastestOperation
          FROM operation_logs 
          WHERE duration IS NOT NULL AND duration > 0
        `;
        
        const [performanceRows] = await this.connection!.execute(performanceStatsSql);
        const performanceStats = (performanceRows as any[])[0];
        
        // 4. 存储统计（估算）
        const storageStats = {
          totalSize: imageStats.totalImages * 1024 * 1024, // 假设每张图片平均1MB
          averageImageSize: 1024 * 1024, // 1MB
          largestImage: 5 * 1024 * 1024 // 假设最大5MB
        };
        
        // 构建完整统计结果
        const statistics: DatabaseStatistics = {
          images: imageStats,
          operations: {
            totalOperations: operationStats.totalOperations || 0,
            successfulOperations: operationStats.successfulOperations || 0,
            failedOperations: operationStats.failedOperations || 0,
            recentOperations: operationStats.recentOperations || 0,
            byOperation
          },
          storage: storageStats,
          performance: {
            averageResponseTime: performanceStats.averageResponseTime || 0,
            slowestOperation: performanceStats.slowestOperation || 0,
            fastestOperation: performanceStats.fastestOperation || 0
          }
        };
        
        const duration = Date.now() - startTime;
        await this.logOperation('SELECT', 'database', null, 'SUCCESS', null, duration);
        
        console.log('数据库统计信息获取成功');
        return statistics;

      } catch (error: any) {
        const duration = Date.now() - startTime;
        await this.logOperation('SELECT', 'database', null, 'FAILED', error.message, duration);
        throw error;
      }
    }, '获取数据库统计信息');
  }

  /**
   * 获取操作日志（分页）
   */
  async getOperationLogs(pagination: PaginationOptions): Promise<PaginatedResult<OperationLog>> {
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
              case 'operation':
                whereConditions.push('operation = ?');
                queryParams.push(value);
                break;
              case 'status':
                whereConditions.push('status = ?');
                queryParams.push(value);
                break;
              case 'tableName':
                whereConditions.push('table_name = ?');
                queryParams.push(value);
                break;
              case 'userId':
                whereConditions.push('user_id = ?');
                queryParams.push(value);
                break;
              case 'dateRange':
                if (value.start && value.end) {
                  whereConditions.push('created_at BETWEEN ? AND ?');
                  queryParams.push(value.start, value.end);
                }
                break;
            }
          }
        }
        
        const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
        
        // 构建排序
        const allowedSortFields = ['id', 'created_at', 'operation', 'status', 'duration'];
        const sortBy = allowedSortFields.includes(pagination.sortBy || '') ? pagination.sortBy : 'created_at';
        const sortOrder = pagination.sortOrder === 'ASC' ? 'ASC' : 'DESC';
        const orderClause = `ORDER BY ${sortBy} ${sortOrder}`;
        
        // 分页参数
        const offset = (pagination.page - 1) * pagination.pageSize;
        const limitClause = 'LIMIT ? OFFSET ?';
        
        // 查询总数
        const countSql = `SELECT COUNT(*) as total FROM operation_logs ${whereClause}`;
        const [countRows] = await this.connection!.execute(countSql, queryParams);
        const total = (countRows as any[])[0].total;
        
        // 查询数据
        const dataSql = `
          SELECT * FROM operation_logs 
          ${whereClause} 
          ${orderClause} 
          ${limitClause}
        `;
        const dataParams = [...queryParams, pagination.pageSize, offset];
        const [dataRows] = await this.connection!.execute(dataSql, dataParams);
        
        // 转换数据格式
        const logs = (dataRows as any[]).map(row => ({
          id: row.id.toString(),
          operation: row.operation,
          tableName: row.table_name,
          recordId: row.record_id,
          userId: row.user_id,
          status: row.status as 'SUCCESS' | 'FAILED',
          errorMessage: row.error_message,
          createdAt: new Date(row.created_at),
          duration: row.duration
        }));
        
        const result: PaginatedResult<OperationLog> = {
          data: logs,
          total,
          page: pagination.page,
          pageSize: pagination.pageSize,
          totalPages: Math.ceil(total / pagination.pageSize),
          hasNext: pagination.page < Math.ceil(total / pagination.pageSize),
          hasPrev: pagination.page > 1
        };
        
        const duration = Date.now() - startTime;
        await this.logOperation('SELECT', 'operation_logs', null, 'SUCCESS', null, duration);
        
        console.log(`获取操作日志成功: ${logs.length} 条记录`);
        return result;

      } catch (error: any) {
        const duration = Date.now() - startTime;
        await this.logOperation('SELECT', 'operation_logs', null, 'FAILED', error.message, duration);
        throw error;
      }
    }, '获取操作日志');
  }
}

// 创建单例实例
export const databaseService = new DatabaseServiceImpl();
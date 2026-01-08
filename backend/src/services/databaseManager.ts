/**
 * 数据库管理器
 * 根据 DATABASE_MODE 环境变量选择使用 MySQL 或 SQLite 数据库
 * 提供统一的数据库接口，对上层代码透明
 */

import { databaseService, DatabaseServiceImpl } from './databaseService.js';
import { sqliteService, SQLiteServiceImpl } from './sqliteService.js';
import { 
  DatabaseConfig, 
  ConnectionStatus, 
  SavedImage, 
  ApiConfig, 
  OSSConfig,
  PaginationOptions, 
  PaginatedResult,
  DatabaseService
} from '@shared/types';

// 数据库模式类型
type DatabaseMode = 'mysql' | 'sqlite';

/**
 * 数据库管理器类
 * 根据配置选择使用哪种数据库服务
 */
class DatabaseManager implements DatabaseService {
  private mode: DatabaseMode = 'mysql';
  private initialized: boolean = false;

  /**
   * 初始化数据库管理器
   * 根据 DATABASE_MODE 环境变量选择数据库服务
   */
  async initialize(): Promise<boolean> {
    const databaseMode = process.env.DATABASE_MODE?.toLowerCase() as DatabaseMode;
    
    // 默认使用 MySQL 模式
    this.mode = databaseMode === 'sqlite' ? 'sqlite' : 'mysql';
    
    console.log(`🗄️ 数据库模式: ${this.mode === 'sqlite' ? 'SQLite（本地）' : 'MySQL（云端）'}`);
    
    if (this.mode === 'sqlite') {
      // SQLite 模式：使用本地文件数据库
      const sqlitePath = process.env.SQLITE_PATH || './data/database.sqlite';
      const result = await sqliteService.connectSQLite({ path: sqlitePath });
      this.initialized = result;
      return result;
    } else {
      // MySQL 模式：需要从环境变量读取配置
      // 注意：MySQL 连接由 server.ts 中的现有逻辑处理
      // 这里只是标记模式，实际连接在 server.ts 中完成
      this.initialized = true;
      return true;
    }
  }

  /**
   * 获取当前数据库模式
   */
  getMode(): DatabaseMode {
    return this.mode;
  }

  /**
   * 检查是否已初始化
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * 获取当前使用的数据库服务
   */
  private getService(): DatabaseService {
    if (this.mode === 'sqlite') {
      return sqliteService;
    }
    return databaseService;
  }

  // ============================================
  // 以下是 DatabaseService 接口的代理实现
  // ============================================

  async connect(config: DatabaseConfig): Promise<boolean> {
    return this.getService().connect(config);
  }

  async disconnect(): Promise<void> {
    return this.getService().disconnect();
  }

  async testConnection(config?: DatabaseConfig): Promise<boolean | { success: boolean; latency?: number; error?: string }> {
    return this.getService().testConnection(config);
  }

  getConnectionStatus(): ConnectionStatus {
    return this.getService().getConnectionStatus();
  }

  getConnection(): any {
    return this.getService().getConnection();
  }

  async executeQuery(sql: string, params?: any[]): Promise<any[]> {
    return this.getService().executeQuery(sql, params);
  }

  async saveImage(image: SavedImage): Promise<SavedImage> {
    return this.getService().saveImage(image);
  }

  async getImages(pagination: PaginationOptions): Promise<PaginatedResult<SavedImage>> {
    return this.getService().getImages(pagination);
  }

  async getImageById(id: string): Promise<SavedImage | null> {
    return this.getService().getImageById(id);
  }

  async updateImage(id: string, updates: Partial<SavedImage>): Promise<SavedImage> {
    return this.getService().updateImage(id, updates);
  }

  async updateImageCanvasPosition(id: string, canvasX: number, canvasY: number): Promise<SavedImage> {
    return this.getService().updateImageCanvasPosition(id, canvasX, canvasY);
  }

  async deleteImage(id: string, cascadeDelete?: boolean): Promise<void> {
    return this.getService().deleteImage(id, cascadeDelete);
  }

  async deleteImages(ids: string[], cascadeDelete?: boolean): Promise<{
    successful: string[];
    failed: { id: string; error: string }[];
  }> {
    return this.getService().deleteImages(ids, cascadeDelete);
  }

  async saveApiConfig(config: ApiConfig): Promise<void> {
    return this.getService().saveApiConfig(config);
  }

  async getApiConfig(): Promise<ApiConfig | null> {
    return this.getService().getApiConfig();
  }

  async saveOSSConfig(config: OSSConfig): Promise<void> {
    return this.getService().saveOSSConfig(config);
  }

  async getOSSConfig(): Promise<OSSConfig | null> {
    return this.getService().getOSSConfig();
  }

  async deleteApiConfig(requireConfirmation?: boolean): Promise<void> {
    return this.getService().deleteApiConfig(requireConfirmation);
  }

  async deleteOSSConfig(requireConfirmation?: boolean): Promise<void> {
    return this.getService().deleteOSSConfig(requireConfirmation);
  }

  async deleteAllConfigs(requireConfirmation?: boolean): Promise<void> {
    return this.getService().deleteAllConfigs(requireConfirmation);
  }

  async clearUserData(requireConfirmation?: boolean): Promise<void> {
    return this.getService().clearUserData(requireConfirmation);
  }

  async initializeTables(): Promise<void> {
    return this.getService().initializeTables();
  }

  /**
   * 获取图片统计信息
   * SQLite 模式下返回简化的统计数据
   */
  async getImageStatistics(filter?: any): Promise<any> {
    if (this.mode === 'sqlite') {
      // SQLite 模式：返回简化的统计数据
      const connection = this.getConnection();
      if (!connection) {
        return this.getEmptyImageStatistics();
      }
      
      try {
        const totalRow = connection.prepare('SELECT COUNT(*) as count FROM images WHERE is_deleted = 0 OR is_deleted IS NULL').get() as any;
        const favoriteRow = connection.prepare('SELECT COUNT(*) as count FROM images WHERE favorite = 1 AND (is_deleted = 0 OR is_deleted IS NULL)').get() as any;
        
        return {
          totalImages: totalRow?.count || 0,
          favoriteImages: favoriteRow?.count || 0,
          uploadedToOSS: 0,
          pendingOSSUpload: 0,
          byModel: {},
          byTimeRange: {
            today: 0,
            thisWeek: 0,
            thisMonth: 0,
            older: totalRow?.count || 0
          }
        };
      } catch (error) {
        console.warn('获取 SQLite 图片统计失败:', error);
        return this.getEmptyImageStatistics();
      }
    }
    return databaseService.getImageStatistics(filter);
  }

  /**
   * 获取数据库统计信息
   * SQLite 模式下返回简化的统计数据
   */
  async getDatabaseStatistics(filter?: any): Promise<any> {
    if (this.mode === 'sqlite') {
      // SQLite 模式：返回简化的统计数据
      const imageStats = await this.getImageStatistics(filter);
      return {
        images: imageStats,
        operations: {
          totalOperations: 0,
          successfulOperations: 0,
          failedOperations: 0
        },
        performance: {
          averageResponseTime: 0
        }
      };
    }
    return databaseService.getDatabaseStatistics(filter);
  }

  /**
   * 获取操作日志
   * SQLite 模式下返回空列表（本地模式不记录操作日志）
   */
  async getOperationLogs(options: any): Promise<any> {
    if (this.mode === 'sqlite') {
      // SQLite 模式：返回空列表
      return {
        data: [],
        total: 0,
        page: options.page || 1,
        pageSize: options.pageSize || 50,
        totalPages: 0
      };
    }
    return databaseService.getOperationLogs(options);
  }

  /**
   * 返回空的图片统计数据
   */
  private getEmptyImageStatistics() {
    return {
      totalImages: 0,
      favoriteImages: 0,
      uploadedToOSS: 0,
      pendingOSSUpload: 0,
      byModel: {},
      byTimeRange: {
        today: 0,
        thisWeek: 0,
        thisMonth: 0,
        older: 0
      }
    };
  }

  /**
   * 获取底层 MySQL 服务实例
   */
  getMySQLService(): DatabaseServiceImpl {
    return databaseService;
  }

  /**
   * 获取底层 SQLite 服务实例
   */
  getSQLiteService(): SQLiteServiceImpl {
    return sqliteService;
  }
}

// 导出单例实例
export const databaseManager = new DatabaseManager();
export { DatabaseManager, DatabaseMode };

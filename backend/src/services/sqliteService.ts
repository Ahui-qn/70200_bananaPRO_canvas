/**
 * SQLite 数据库服务
 * 提供与 MySQL databaseService 相同的接口，用于本地开发和局域网部署
 * 
 * 设计说明：
 * - 数据库文件存储在本地 SSD（./data/database.sqlite），不放 NAS
 * - SQLite 对网络文件系统支持不好，放 NAS 会有性能和锁问题
 * - 提供与 MySQL 相同的接口，便于模式切换
 */

import Database from 'better-sqlite3';
import * as fs from 'fs';
import * as path from 'path';
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
import { getEncryptionService } from './encryptionService.js';

// SQLite 配置接口
export interface SQLiteConfig {
  path: string;           // 数据库文件路径
  verbose?: boolean;      // 是否输出详细日志
}

/**
 * SQLite 数据库服务实现类
 */
export class SQLiteServiceImpl implements DatabaseService {
  private db: Database.Database | null = null;
  private config: SQLiteConfig | null = null;
  private connectionStatus: ConnectionStatus = {
    isConnected: false,
    lastConnected: null,
    error: null,
    latency: undefined
  };

  /**
   * 连接到 SQLite 数据库
   * 注意：此方法接受 DatabaseConfig 以保持接口兼容，但实际使用 SQLiteConfig
   */
  async connect(config: DatabaseConfig): Promise<boolean> {
    // 从环境变量获取 SQLite 配置
    const sqlitePath = process.env.SQLITE_PATH || './data/database.sqlite';
    
    return this.connectSQLite({ path: sqlitePath });
  }

  /**
   * 使用 SQLite 配置连接数据库
   */
  async connectSQLite(config: SQLiteConfig): Promise<boolean> {
    try {
      // 确保数据目录存在
      const dbDir = path.dirname(config.path);
      if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
        console.log(`📁 创建数据库目录: ${dbDir}`);
      }

      const startTime = Date.now();

      // 创建数据库连接
      this.db = new Database(config.path, {
        verbose: config.verbose ? console.log : undefined
      });

      // 启用 WAL 模式以提高并发性能
      this.db.pragma('journal_mode = WAL');
      // 启用外键约束
      this.db.pragma('foreign_keys = ON');

      const latency = Date.now() - startTime;

      this.config = config;
      this.connectionStatus = {
        isConnected: true,
        lastConnected: new Date(),
        error: null,
        latency
      };

      console.log(`🗄️ SQLite 数据库连接成功: ${config.path}，延迟: ${latency}ms`);

      // 初始化表结构
      await this.initializeTables();

      return true;
    } catch (error: any) {
      console.error('SQLite 数据库连接失败:', error);
      this.connectionStatus = {
        isConnected: false,
        lastConnected: null,
        error: error.message
      };
      throw error;
    }
  }

  /**
   * 断开数据库连接
   */
  async disconnect(): Promise<void> {
    if (this.db) {
      try {
        this.db.close();
        console.log('SQLite 数据库连接已断开');
      } catch (error) {
        console.error('断开 SQLite 连接时出错:', error);
      } finally {
        this.db = null;
        this.connectionStatus.isConnected = false;
      }
    }
  }

  /**
   * 测试数据库连接
   */
  async testConnection(config?: DatabaseConfig): Promise<boolean | { success: boolean; latency?: number; error?: string }> {
    if (!this.db) {
      return false;
    }

    try {
      const startTime = Date.now();
      // 执行简单查询测试连接
      this.db.prepare('SELECT 1').get();
      const latency = Date.now() - startTime;
      
      this.connectionStatus.latency = latency;
      this.connectionStatus.error = null;
      
      return true;
    } catch (error: any) {
      console.error('SQLite 连接测试失败:', error);
      this.connectionStatus.error = error.message;
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
   * 获取数据库连接实例
   */
  getConnection(): Database.Database | null {
    return this.db;
  }

  /**
   * 执行通用 SQL 查询
   * 将 MySQL 风格的 SQL 转换为 SQLite 兼容格式
   */
  async executeQuery(sql: string, params: any[] = []): Promise<any[]> {
    if (!this.db) {
      throw new Error('数据库未连接');
    }

    try {
      // 转换 MySQL 特有语法为 SQLite 兼容格式
      const convertedSql = this.convertMySQLToSQLite(sql);
      
      // 转换参数中的 Date 对象为 ISO 字符串（SQLite 不支持 Date 对象）
      const convertedParams = params.map(param => {
        if (param instanceof Date) {
          return param.toISOString();
        }
        // 布尔值转换为 0/1
        if (typeof param === 'boolean') {
          return param ? 1 : 0;
        }
        return param;
      });
      
      // 判断是查询还是修改操作
      const isSelect = convertedSql.trim().toUpperCase().startsWith('SELECT');
      const isInsert = convertedSql.trim().toUpperCase().startsWith('INSERT');
      const isUpdate = convertedSql.trim().toUpperCase().startsWith('UPDATE');
      const isDelete = convertedSql.trim().toUpperCase().startsWith('DELETE');

      if (isSelect) {
        const stmt = this.db.prepare(convertedSql);
        return stmt.all(...convertedParams);
      } else {
        const stmt = this.db.prepare(convertedSql);
        const result = stmt.run(...convertedParams);
        // 返回与 MySQL 兼容的结果格式
        return [{ 
          affectedRows: result.changes,
          insertId: result.lastInsertRowid
        }] as any;
      }
    } catch (error: any) {
      console.error('SQLite 查询执行失败:', error);
      console.error('SQL:', sql);
      console.error('参数:', params);
      throw error;
    }
  }

  /**
   * 将 MySQL SQL 语法转换为 SQLite 兼容格式
   */
  private convertMySQLToSQLite(sql: string): string {
    let converted = sql;

    // 替换 MySQL 的 ON DUPLICATE KEY UPDATE 为 SQLite 的 ON CONFLICT
    // 这是一个简化处理，实际可能需要更复杂的转换
    if (converted.includes('ON DUPLICATE KEY UPDATE')) {
      // 提取表名和字段
      const insertMatch = converted.match(/INSERT INTO (\w+)\s*\(([^)]+)\)/i);
      if (insertMatch) {
        const tableName = insertMatch[1];
        // 转换为 INSERT OR REPLACE
        converted = converted.replace(
          /INSERT INTO/i,
          'INSERT OR REPLACE INTO'
        ).replace(/ON DUPLICATE KEY UPDATE.*/is, '');
      }
    }

    // 替换 MySQL 的 BOOLEAN 为 INTEGER
    converted = converted.replace(/\bBOOLEAN\b/gi, 'INTEGER');

    // 替换 MySQL 的 TRUE/FALSE 为 1/0
    converted = converted.replace(/\bTRUE\b/g, '1');
    converted = converted.replace(/\bFALSE\b/g, '0');

    // 替换 MySQL 的 NOW() 为 SQLite 的 datetime('now')
    converted = converted.replace(/\bNOW\(\)/gi, "datetime('now')");

    // 替换 MySQL 的 JSON_SEARCH 为简单的 LIKE（简化处理）
    converted = converted.replace(
      /JSON_SEARCH\([^,]+,\s*"one",\s*([^)]+)\)\s*IS NOT NULL/gi,
      'tags LIKE $1'
    );

    return converted;
  }


  /**
   * 初始化数据库表结构
   */
  async initializeTables(): Promise<void> {
    if (!this.db) {
      throw new Error('数据库未连接');
    }

    console.log('📋 初始化 SQLite 表结构...');

    // 创建用户表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        display_name TEXT NOT NULL,
        role TEXT DEFAULT 'user' CHECK(role IN ('user', 'admin')),
        current_project_id TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        last_login_at TEXT,
        is_active INTEGER DEFAULT 1
      )
    `);

    // 创建项目表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        cover_image_url TEXT,
        created_by TEXT NOT NULL,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        is_deleted INTEGER DEFAULT 0,
        deleted_at TEXT,
        deleted_by TEXT,
        canvas_state TEXT
      )
    `);

    // 创建图片表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS images (
        id TEXT PRIMARY KEY,
        url TEXT,
        original_url TEXT,
        prompt TEXT NOT NULL,
        model TEXT NOT NULL,
        aspect_ratio TEXT DEFAULT 'auto',
        image_size TEXT DEFAULT '1K',
        ref_images TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        tags TEXT,
        favorite INTEGER DEFAULT 0,
        oss_key TEXT,
        oss_uploaded INTEGER DEFAULT 0,
        user_id TEXT DEFAULT 'default',
        project_id TEXT,
        updated_at TEXT DEFAULT (datetime('now')),
        is_deleted INTEGER DEFAULT 0,
        deleted_at TEXT,
        deleted_by TEXT,
        canvas_x INTEGER,
        canvas_y INTEGER,
        thumbnail_url TEXT,
        width INTEGER,
        height INTEGER,
        status TEXT DEFAULT 'success' CHECK(status IN ('pending', 'success', 'failed')),
        failure_reason TEXT
      )
    `);

    // 创建用户配置表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS user_configs (
        user_id TEXT PRIMARY KEY,
        api_config TEXT,
        oss_config TEXT,
        preferences TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      )
    `);

    // 创建参考图片表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS reference_images (
        id TEXT PRIMARY KEY,
        hash TEXT NOT NULL UNIQUE,
        oss_key TEXT NOT NULL,
        oss_url TEXT NOT NULL,
        original_name TEXT,
        size INTEGER NOT NULL,
        mime_type TEXT DEFAULT 'image/jpeg',
        width INTEGER,
        height INTEGER,
        use_count INTEGER DEFAULT 1,
        created_at TEXT DEFAULT (datetime('now')),
        last_used_at TEXT DEFAULT (datetime('now'))
      )
    `);

    // 创建同步日志表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sync_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        operation TEXT NOT NULL,
        table_name TEXT NOT NULL,
        record_id TEXT,
        user_id TEXT DEFAULT 'default',
        status TEXT DEFAULT 'SUCCESS' CHECK(status IN ('SUCCESS', 'FAILED')),
        error_message TEXT,
        duration_ms INTEGER,
        created_at TEXT DEFAULT (datetime('now'))
      )
    `);

    // 创建索引
    this.createIndexes();

    // 插入默认用户配置
    const defaultConfig = this.db.prepare(
      'SELECT user_id FROM user_configs WHERE user_id = ?'
    ).get('default');
    
    if (!defaultConfig) {
      this.db.prepare(`
        INSERT INTO user_configs (user_id, preferences) 
        VALUES (?, ?)
      `).run('default', JSON.stringify({
        autoSync: true,
        syncInterval: 300,
        maxLocalImages: 1000,
        theme: 'dark'
      }));
    }

    console.log('✅ SQLite 表结构初始化完成');
  }

  /**
   * 创建索引
   */
  private createIndexes(): void {
    if (!this.db) return;

    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)',
      'CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active)',
      'CREATE INDEX IF NOT EXISTS idx_projects_created_by ON projects(created_by)',
      'CREATE INDEX IF NOT EXISTS idx_projects_is_deleted ON projects(is_deleted)',
      'CREATE INDEX IF NOT EXISTS idx_images_created_at ON images(created_at)',
      'CREATE INDEX IF NOT EXISTS idx_images_model ON images(model)',
      'CREATE INDEX IF NOT EXISTS idx_images_favorite ON images(favorite)',
      'CREATE INDEX IF NOT EXISTS idx_images_user_id ON images(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_images_project_id ON images(project_id)',
      'CREATE INDEX IF NOT EXISTS idx_images_is_deleted ON images(is_deleted)',
      'CREATE INDEX IF NOT EXISTS idx_images_status ON images(status)',
      'CREATE INDEX IF NOT EXISTS idx_reference_images_hash ON reference_images(hash)',
      'CREATE INDEX IF NOT EXISTS idx_sync_logs_created_at ON sync_logs(created_at)'
    ];

    for (const indexSql of indexes) {
      try {
        this.db.exec(indexSql);
      } catch (error) {
        // 索引可能已存在，忽略错误
      }
    }
  }

  /**
   * 保存图片到数据库
   */
  async saveImage(image: SavedImage): Promise<SavedImage> {
    if (!this.db) {
      throw new Error('数据库未连接');
    }

    const startTime = Date.now();

    try {
      const stmt = this.db.prepare(`
        INSERT INTO images (
          id, url, original_url, prompt, model, aspect_ratio, image_size,
          ref_images, created_at, updated_at, tags, favorite, oss_key, oss_uploaded, 
          user_id, project_id, canvas_x, canvas_y, thumbnail_url, width, height, 
          status, failure_reason
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        image.id,
        image.url || null,
        image.originalUrl || null,
        image.prompt,
        image.model,
        image.aspectRatio || 'auto',
        image.imageSize || '1K',
        image.refImages ? JSON.stringify(image.refImages) : null,
        image.createdAt instanceof Date ? image.createdAt.toISOString() : image.createdAt,
        new Date().toISOString(),
        image.tags ? JSON.stringify(image.tags) : null,
        image.favorite ? 1 : 0,
        image.ossKey || null,
        image.ossUploaded ? 1 : 0,
        image.userId || 'default',
        image.projectId || null,
        image.canvasX !== undefined ? image.canvasX : null,
        image.canvasY !== undefined ? image.canvasY : null,
        image.thumbnailUrl || null,
        image.width !== undefined ? image.width : null,
        image.height !== undefined ? image.height : null,
        image.status || 'success',
        image.failureReason || null
      );

      const duration = Date.now() - startTime;
      await this.logOperation('INSERT', 'images', image.id, 'SUCCESS', null, duration);

      console.log(`图片保存成功: ${image.id}`);
      return image;
    } catch (error: any) {
      const duration = Date.now() - startTime;
      await this.logOperation('INSERT', 'images', image.id, 'FAILED', error.message, duration);
      throw error;
    }
  }

  /**
   * 分页获取图片列表
   */
  async getImages(pagination: PaginationOptions): Promise<PaginatedResult<SavedImage>> {
    if (!this.db) {
      throw new Error('数据库未连接');
    }

    const startTime = Date.now();

    try {
      // 构建查询条件
      const whereConditions: string[] = ['(is_deleted = 0 OR is_deleted IS NULL)'];
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
              queryParams.push(value ? 1 : 0);
              break;
            case 'search':
              whereConditions.push('(prompt LIKE ? OR tags LIKE ?)');
              const searchTerm = `%${value}%`;
              queryParams.push(searchTerm, searchTerm);
              break;
            case 'userId':
              whereConditions.push('user_id = ?');
              queryParams.push(value);
              break;
            case 'projectId':
              whereConditions.push('project_id = ?');
              queryParams.push(value);
              break;
          }
        }
      }

      const whereClause = `WHERE ${whereConditions.join(' AND ')}`;

      // 构建排序
      const allowedSortFields = ['id', 'created_at', 'updated_at', 'model', 'favorite'];
      const sortBy = allowedSortFields.includes(pagination.sortBy || '') ? pagination.sortBy : 'created_at';
      const sortOrder = pagination.sortOrder === 'ASC' ? 'ASC' : 'DESC';

      // 分页参数
      const pageSize = Math.max(1, Math.floor(Number(pagination.pageSize) || 20));
      const page = Math.max(1, Math.floor(Number(pagination.page) || 1));
      const offset = (page - 1) * pageSize;

      // 查询总数
      const countStmt = this.db.prepare(`SELECT COUNT(*) as total FROM images ${whereClause}`);
      const countResult = countStmt.get(...queryParams) as { total: number };
      const total = countResult.total;

      // 查询数据
      const dataStmt = this.db.prepare(`
        SELECT i.*, u.display_name as user_name
        FROM images i
        LEFT JOIN users u ON i.user_id = u.id
        ${whereClause}
        ORDER BY i.${sortBy} ${sortOrder}
        LIMIT ? OFFSET ?
      `);
      const rows = dataStmt.all(...queryParams, pageSize, offset) as any[];

      // 转换数据格式
      const images = rows.map(row => this.rowToSavedImage(row));

      const result: PaginatedResult<SavedImage> = {
        data: images,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
        hasNext: page < Math.ceil(total / pageSize),
        hasPrev: page > 1
      };

      const duration = Date.now() - startTime;
      await this.logOperation('SELECT', 'images', null, 'SUCCESS', null, duration);

      return result;
    } catch (error: any) {
      const duration = Date.now() - startTime;
      await this.logOperation('SELECT', 'images', null, 'FAILED', error.message, duration);
      throw error;
    }
  }


  /**
   * 根据 ID 获取单张图片
   */
  async getImageById(id: string): Promise<SavedImage | null> {
    if (!this.db) {
      throw new Error('数据库未连接');
    }

    try {
      const stmt = this.db.prepare('SELECT * FROM images WHERE id = ?');
      const row = stmt.get(id) as any;

      if (!row) {
        return null;
      }

      return this.rowToSavedImage(row);
    } catch (error: any) {
      console.error('获取图片失败:', error);
      throw error;
    }
  }

  /**
   * 更新图片信息
   */
  async updateImage(id: string, updates: Partial<SavedImage>): Promise<SavedImage> {
    if (!this.db) {
      throw new Error('数据库未连接');
    }

    const startTime = Date.now();

    try {
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
        updateValues.push(updates.favorite ? 1 : 0);
      }
      if (updates.ossKey !== undefined) {
        updateFields.push('oss_key = ?');
        updateValues.push(updates.ossKey);
      }
      if (updates.ossUploaded !== undefined) {
        updateFields.push('oss_uploaded = ?');
        updateValues.push(updates.ossUploaded ? 1 : 0);
      }
      if (updates.canvasX !== undefined) {
        updateFields.push('canvas_x = ?');
        updateValues.push(updates.canvasX);
      }
      if (updates.canvasY !== undefined) {
        updateFields.push('canvas_y = ?');
        updateValues.push(updates.canvasY);
      }
      if (updates.thumbnailUrl !== undefined) {
        updateFields.push('thumbnail_url = ?');
        updateValues.push(updates.thumbnailUrl);
      }
      if (updates.width !== undefined) {
        updateFields.push('width = ?');
        updateValues.push(updates.width);
      }
      if (updates.height !== undefined) {
        updateFields.push('height = ?');
        updateValues.push(updates.height);
      }

      // 总是更新 updated_at
      updateFields.push('updated_at = ?');
      updateValues.push(new Date().toISOString());

      if (updateFields.length === 1) {
        throw new Error('没有需要更新的字段');
      }

      const sql = `UPDATE images SET ${updateFields.join(', ')} WHERE id = ?`;
      updateValues.push(id);

      const stmt = this.db.prepare(sql);
      const result = stmt.run(...updateValues);

      if (result.changes === 0) {
        throw new Error(`图片不存在: ${id}`);
      }

      // 获取更新后的数据
      const updatedImage = await this.getImageById(id);
      if (!updatedImage) {
        throw new Error(`获取更新后的图片失败: ${id}`);
      }

      const duration = Date.now() - startTime;
      await this.logOperation('UPDATE', 'images', id, 'SUCCESS', null, duration);

      return updatedImage;
    } catch (error: any) {
      const duration = Date.now() - startTime;
      await this.logOperation('UPDATE', 'images', id, 'FAILED', error.message, duration);
      throw error;
    }
  }

  /**
   * 更新图片画布位置
   */
  async updateImageCanvasPosition(id: string, canvasX: number, canvasY: number): Promise<SavedImage> {
    return this.updateImage(id, { canvasX, canvasY });
  }

  /**
   * 删除图片
   */
  async deleteImage(id: string, cascadeDelete: boolean = true): Promise<void> {
    if (!this.db) {
      throw new Error('数据库未连接');
    }

    const startTime = Date.now();

    try {
      const stmt = this.db.prepare('DELETE FROM images WHERE id = ?');
      const result = stmt.run(id);

      if (result.changes === 0) {
        throw new Error(`图片不存在: ${id}`);
      }

      const duration = Date.now() - startTime;
      await this.logOperation('DELETE', 'images', id, 'SUCCESS', null, duration);

      console.log(`图片删除成功: ${id}`);
    } catch (error: any) {
      const duration = Date.now() - startTime;
      await this.logOperation('DELETE', 'images', id, 'FAILED', error.message, duration);
      throw error;
    }
  }

  /**
   * 批量删除图片
   */
  async deleteImages(ids: string[], cascadeDelete: boolean = true): Promise<{
    successful: string[];
    failed: { id: string; error: string }[];
  }> {
    const successful: string[] = [];
    const failed: { id: string; error: string }[] = [];

    for (const id of ids) {
      try {
        await this.deleteImage(id, cascadeDelete);
        successful.push(id);
      } catch (error: any) {
        failed.push({ id, error: error.message });
      }
    }

    return { successful, failed };
  }

  /**
   * 保存 API 配置
   */
  async saveApiConfig(config: ApiConfig): Promise<void> {
    if (!this.db) {
      throw new Error('数据库未连接');
    }

    const startTime = Date.now();

    try {
      // 加密敏感信息
      const encryptedConfig = {
        ...config,
        apiKey: getEncryptionService().encrypt(config.apiKey)
      };

      const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO user_configs (user_id, api_config, updated_at)
        VALUES (?, ?, ?)
      `);

      stmt.run('default', JSON.stringify(encryptedConfig), new Date().toISOString());

      const duration = Date.now() - startTime;
      await this.logOperation('UPSERT', 'user_configs', 'default', 'SUCCESS', null, duration);

      console.log('API 配置保存成功');
    } catch (error: any) {
      const duration = Date.now() - startTime;
      await this.logOperation('UPSERT', 'user_configs', 'default', 'FAILED', error.message, duration);
      throw error;
    }
  }

  /**
   * 获取 API 配置
   */
  async getApiConfig(): Promise<ApiConfig | null> {
    if (!this.db) {
      throw new Error('数据库未连接');
    }

    try {
      const stmt = this.db.prepare('SELECT api_config FROM user_configs WHERE user_id = ?');
      const row = stmt.get('default') as { api_config: string } | undefined;

      if (!row || !row.api_config) {
        return null;
      }

      const encryptedConfig = JSON.parse(row.api_config);

      // 解密敏感信息
      const config: ApiConfig = {
        ...encryptedConfig,
        apiKey: getEncryptionService().decrypt(encryptedConfig.apiKey)
      };

      return config;
    } catch (error: any) {
      console.error('获取 API 配置失败:', error);
      throw error;
    }
  }

  /**
   * 保存 OSS 配置
   */
  async saveOSSConfig(config: OSSConfig): Promise<void> {
    if (!this.db) {
      throw new Error('数据库未连接');
    }

    const startTime = Date.now();

    try {
      // 加密敏感信息
      const encryptedConfig = {
        ...config,
        accessKeyId: getEncryptionService().encrypt(config.accessKeyId),
        accessKeySecret: getEncryptionService().encrypt(config.accessKeySecret)
      };

      const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO user_configs (user_id, oss_config, updated_at)
        VALUES (?, ?, ?)
      `);

      stmt.run('default', JSON.stringify(encryptedConfig), new Date().toISOString());

      const duration = Date.now() - startTime;
      await this.logOperation('UPSERT', 'user_configs', 'default', 'SUCCESS', null, duration);

      console.log('OSS 配置保存成功');
    } catch (error: any) {
      const duration = Date.now() - startTime;
      await this.logOperation('UPSERT', 'user_configs', 'default', 'FAILED', error.message, duration);
      throw error;
    }
  }

  /**
   * 获取 OSS 配置
   */
  async getOSSConfig(): Promise<OSSConfig | null> {
    if (!this.db) {
      throw new Error('数据库未连接');
    }

    try {
      const stmt = this.db.prepare('SELECT oss_config FROM user_configs WHERE user_id = ?');
      const row = stmt.get('default') as { oss_config: string } | undefined;

      if (!row || !row.oss_config) {
        return null;
      }

      const encryptedConfig = JSON.parse(row.oss_config);

      // 解密敏感信息
      const config: OSSConfig = {
        ...encryptedConfig,
        accessKeyId: getEncryptionService().decrypt(encryptedConfig.accessKeyId),
        accessKeySecret: getEncryptionService().decrypt(encryptedConfig.accessKeySecret)
      };

      return config;
    } catch (error: any) {
      console.error('获取 OSS 配置失败:', error);
      throw error;
    }
  }

  /**
   * 删除 API 配置
   */
  async deleteApiConfig(requireConfirmation: boolean = true): Promise<void> {
    if (!this.db) {
      throw new Error('数据库未连接');
    }

    const stmt = this.db.prepare(`
      UPDATE user_configs SET api_config = NULL, updated_at = ? WHERE user_id = ?
    `);
    stmt.run(new Date().toISOString(), 'default');

    console.log('API 配置删除成功');
  }

  /**
   * 删除 OSS 配置
   */
  async deleteOSSConfig(requireConfirmation: boolean = true): Promise<void> {
    if (!this.db) {
      throw new Error('数据库未连接');
    }

    const stmt = this.db.prepare(`
      UPDATE user_configs SET oss_config = NULL, updated_at = ? WHERE user_id = ?
    `);
    stmt.run(new Date().toISOString(), 'default');

    console.log('OSS 配置删除成功');
  }

  /**
   * 删除所有配置
   */
  async deleteAllConfigs(requireConfirmation: boolean = true): Promise<void> {
    if (!this.db) {
      throw new Error('数据库未连接');
    }

    const stmt = this.db.prepare(`
      UPDATE user_configs SET api_config = NULL, oss_config = NULL, updated_at = ? WHERE user_id = ?
    `);
    stmt.run(new Date().toISOString(), 'default');

    console.log('所有配置删除成功');
  }

  /**
   * 清除用户数据
   */
  async clearUserData(requireConfirmation: boolean = true): Promise<void> {
    if (!this.db) {
      throw new Error('数据库未连接');
    }

    const stmt = this.db.prepare('DELETE FROM user_configs WHERE user_id = ?');
    stmt.run('default');

    console.log('用户数据清除成功');
  }

  /**
   * 记录操作日志
   */
  private async logOperation(
    operation: string,
    tableName: string,
    recordId: string | null,
    status: 'SUCCESS' | 'FAILED',
    errorMessage: string | null,
    durationMs?: number
  ): Promise<void> {
    if (!this.db) return;

    try {
      const stmt = this.db.prepare(`
        INSERT INTO sync_logs (operation, table_name, record_id, status, error_message, duration_ms)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      stmt.run(operation, tableName, recordId, status, errorMessage, durationMs || null);
    } catch (error) {
      // 日志记录失败不应影响主操作
      console.warn('记录操作日志失败:', error);
    }
  }

  /**
   * 将数据库行转换为 SavedImage 对象
   */
  private rowToSavedImage(row: any): SavedImage {
    return {
      id: row.id,
      url: row.url,
      originalUrl: row.original_url,
      prompt: row.prompt,
      model: row.model,
      aspectRatio: row.aspect_ratio,
      imageSize: row.image_size,
      refImages: row.ref_images ? JSON.parse(row.ref_images) : undefined,
      createdAt: new Date(row.created_at),
      tags: row.tags ? JSON.parse(row.tags) : undefined,
      favorite: Boolean(row.favorite),
      ossKey: row.oss_key,
      ossUploaded: Boolean(row.oss_uploaded),
      userId: row.user_id,
      projectId: row.project_id,
      canvasX: row.canvas_x,
      canvasY: row.canvas_y,
      thumbnailUrl: row.thumbnail_url,
      width: row.width,
      height: row.height,
      status: row.status as 'pending' | 'success' | 'failed',
      failureReason: row.failure_reason,
      userName: row.user_name
    };
  }

  /**
   * 延迟函数
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// 导出单例实例
export const sqliteService = new SQLiteServiceImpl();
export { SQLiteServiceImpl as SQLiteService };

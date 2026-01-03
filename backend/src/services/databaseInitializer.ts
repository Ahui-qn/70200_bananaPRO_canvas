/**
 * 数据库表结构初始化服务
 * 负责创建和维护数据库表结构、索引和初始数据
 */

import mysql from 'mysql2/promise';
import { TABLE_NAMES, DEFAULT_VALUES } from '../config/constants';

/**
 * 数据库版本信息
 */
interface DatabaseVersion {
  version: string;
  description: string;
  scripts: string[];
}

/**
 * 表结构检查结果
 */
interface TableCheckResult {
  exists: boolean;
  columns: string[];
  indexes: string[];
  missingColumns: string[];
  missingIndexes: string[];
}

/**
 * 数据库初始化器类
 */
export class DatabaseInitializer {
  private connection: mysql.Connection;
  
  constructor(connection: mysql.Connection) {
    this.connection = connection;
  }

  /**
   * 初始化所有数据库表
   */
  async initializeAllTables(): Promise<void> {
    console.log('开始初始化数据库表结构...');
    
    try {
      // 设置字符集
      await this.setCharacterSet();
      
      // 创建 users 表（用户登录系统）
      await this.createUsersTable();
      
      // 创建 projects 表（项目管理）
      await this.createProjectsTable();
      
      // 创建 images 表
      await this.createImagesTable();
      
      // 更新现有表结构（添加新字段）
      await this.updateExistingTables();
      
      // 创建 user_configs 表
      await this.createUserConfigsTable();
      
      // 创建 operation_logs 表
      await this.createOperationLogsTable();
      
      // 创建 reference_images 表
      await this.createReferenceImagesTable();
      
      // 创建索引
      await this.createIndexes();
      
      // 插入初始数据
      await this.insertInitialData();
      
      // 验证表结构
      await this.validateTableStructure();
      
      console.log('数据库表结构初始化完成');
      
    } catch (error) {
      console.error('数据库表结构初始化失败:', error);
      throw error;
    }
  }

  /**
   * 设置数据库字符集
   */
  private async setCharacterSet(): Promise<void> {
    console.log('设置数据库字符集...');
    
    await this.connection.execute('SET NAMES utf8mb4');
    await this.connection.execute('SET CHARACTER SET utf8mb4');
    await this.connection.execute('SET character_set_connection=utf8mb4');
  }

  /**
   * 创建 users 表（用户登录系统）
   */
  private async createUsersTable(): Promise<void> {
    // 检查表是否已存在
    const [tables] = await this.connection.execute(
      'SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?',
      [TABLE_NAMES.USERS]
    );
    
    if ((tables as any[]).length > 0) {
      console.log('users 表已存在，跳过创建');
      return;
    }
    
    console.log('创建 users 表...');
    
    const sql = `
      CREATE TABLE IF NOT EXISTS ${TABLE_NAMES.USERS} (
        id VARCHAR(36) NOT NULL COMMENT '用户唯一标识符（UUID格式）',
        username VARCHAR(50) NOT NULL COMMENT '登录用户名',
        password_hash VARCHAR(255) NOT NULL COMMENT 'bcrypt加密的密码',
        display_name VARCHAR(100) NOT NULL COMMENT '显示名称',
        role ENUM('user', 'admin') DEFAULT 'user' COMMENT '用户角色',
        current_project_id VARCHAR(36) NULL COMMENT '当前项目ID',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
        last_login_at TIMESTAMP NULL COMMENT '最后登录时间',
        is_active BOOLEAN DEFAULT TRUE COMMENT '账号是否启用',
        
        PRIMARY KEY (id),
        UNIQUE KEY uk_username (username)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户表'
    `;
    
    await this.connection.execute(sql);
    console.log('users 表创建成功');
  }

  /**
   * 创建 projects 表（项目管理）
   */
  private async createProjectsTable(): Promise<void> {
    // 检查表是否已存在
    const [tables] = await this.connection.execute(
      'SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?',
      [TABLE_NAMES.PROJECTS]
    );
    
    if ((tables as any[]).length > 0) {
      console.log('projects 表已存在，跳过创建');
      return;
    }
    
    console.log('创建 projects 表...');
    
    const sql = `
      CREATE TABLE IF NOT EXISTS ${TABLE_NAMES.PROJECTS} (
        id VARCHAR(36) NOT NULL COMMENT '项目唯一标识符（UUID格式）',
        name VARCHAR(100) NOT NULL COMMENT '项目名称',
        description TEXT COMMENT '项目描述',
        cover_image_url TEXT COMMENT '封面图片URL',
        created_by VARCHAR(36) NOT NULL COMMENT '创建者用户ID',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
        is_deleted BOOLEAN DEFAULT FALSE COMMENT '是否已删除（软删除）',
        deleted_at TIMESTAMP NULL COMMENT '删除时间',
        deleted_by VARCHAR(36) NULL COMMENT '删除者用户ID',
        canvas_state JSON COMMENT '画布状态（视口位置、缩放比例）',
        
        PRIMARY KEY (id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='项目表'
    `;
    
    await this.connection.execute(sql);
    console.log('projects 表创建成功');
  }

  /**
   * 创建 images 表
   */
  private async createImagesTable(): Promise<void> {
    // 检查表是否已存在
    const [tables] = await this.connection.execute(
      'SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?',
      [TABLE_NAMES.IMAGES]
    );
    
    if ((tables as any[]).length > 0) {
      console.log('images 表已存在，跳过创建');
      return;
    }
    
    console.log('创建 images 表...');
    
    const sql = `
      CREATE TABLE IF NOT EXISTS ${TABLE_NAMES.IMAGES} (
        id VARCHAR(50) NOT NULL COMMENT '图片唯一标识符',
        url TEXT NOT NULL COMMENT '图片URL地址',
        original_url TEXT COMMENT '原始URL（OSS上传前的临时URL）',
        prompt TEXT NOT NULL COMMENT '生成图片的提示词',
        model VARCHAR(100) NOT NULL COMMENT '使用的AI模型名称',
        aspect_ratio VARCHAR(20) DEFAULT 'auto' COMMENT '图片宽高比',
        image_size VARCHAR(10) DEFAULT '1K' COMMENT '图片尺寸',
        ref_images JSON COMMENT '参考图片信息（JSON格式）',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
        tags JSON COMMENT '图片标签（JSON数组）',
        favorite BOOLEAN DEFAULT FALSE COMMENT '是否收藏',
        oss_key TEXT COMMENT 'OSS对象键名',
        oss_uploaded BOOLEAN DEFAULT FALSE COMMENT '是否已上传到OSS',
        user_id VARCHAR(50) DEFAULT '${DEFAULT_VALUES.DEFAULT_USER_ID}' COMMENT '用户ID',
        project_id VARCHAR(36) NULL COMMENT '所属项目ID',
        is_deleted BOOLEAN DEFAULT FALSE COMMENT '是否已删除（软删除）',
        deleted_at TIMESTAMP NULL COMMENT '删除时间',
        deleted_by VARCHAR(36) NULL COMMENT '删除者用户ID',
        canvas_x INT DEFAULT NULL COMMENT '图片在画布上的 X 坐标',
        canvas_y INT DEFAULT NULL COMMENT '图片在画布上的 Y 坐标',
        thumbnail_url TEXT COMMENT '缩略图 URL',
        
        PRIMARY KEY (id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='图片信息表'
    `;
    
    await this.connection.execute(sql);
    console.log('images 表创建成功');
  }

  /**
   * 更新现有表结构（添加新字段）
   */
  private async updateExistingTables(): Promise<void> {
    console.log('检查并更新现有表结构...');
    
    // 更新 users 表
    await this.addColumnIfNotExists(TABLE_NAMES.USERS, 'role', "ENUM('user', 'admin') DEFAULT 'user' COMMENT '用户角色'");
    await this.addColumnIfNotExists(TABLE_NAMES.USERS, 'current_project_id', "VARCHAR(36) NULL COMMENT '当前项目ID'");
    
    // 更新 images 表
    await this.addColumnIfNotExists(TABLE_NAMES.IMAGES, 'project_id', "VARCHAR(36) NULL COMMENT '所属项目ID'");
    await this.addColumnIfNotExists(TABLE_NAMES.IMAGES, 'is_deleted', "BOOLEAN DEFAULT FALSE COMMENT '是否已删除（软删除）'");
    await this.addColumnIfNotExists(TABLE_NAMES.IMAGES, 'deleted_at', "TIMESTAMP NULL COMMENT '删除时间'");
    await this.addColumnIfNotExists(TABLE_NAMES.IMAGES, 'deleted_by', "VARCHAR(36) NULL COMMENT '删除者用户ID'");
    
    // 更新 images 表 - 添加画布位置字段（持久化画布功能）
    await this.addColumnIfNotExists(TABLE_NAMES.IMAGES, 'canvas_x', "INT DEFAULT NULL COMMENT '图片在画布上的 X 坐标'");
    await this.addColumnIfNotExists(TABLE_NAMES.IMAGES, 'canvas_y', "INT DEFAULT NULL COMMENT '图片在画布上的 Y 坐标'");
    await this.addColumnIfNotExists(TABLE_NAMES.IMAGES, 'thumbnail_url', "TEXT COMMENT '缩略图 URL'");
    
    // 更新 images 表 - 添加图片尺寸字段（图片实际尺寸功能）
    await this.addColumnIfNotExists(TABLE_NAMES.IMAGES, 'width', "INT UNSIGNED COMMENT '图片实际宽度（像素）'");
    await this.addColumnIfNotExists(TABLE_NAMES.IMAGES, 'height', "INT UNSIGNED COMMENT '图片实际高度（像素）'");
    
    // 更新 projects 表 - 添加画布状态字段（持久化画布功能）
    await this.addColumnIfNotExists(TABLE_NAMES.PROJECTS, 'canvas_state', "JSON COMMENT '画布状态（视口位置、缩放比例）'");
    
    console.log('表结构更新完成');
  }

  /**
   * 如果列不存在则添加
   */
  private async addColumnIfNotExists(tableName: string, columnName: string, columnDefinition: string): Promise<void> {
    try {
      const [columns] = await this.connection.execute(
        'SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?',
        [tableName, columnName]
      );
      
      if ((columns as any[]).length === 0) {
        await this.connection.execute(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDefinition}`);
        console.log(`已添加列 ${tableName}.${columnName}`);
      }
    } catch (error: any) {
      // 如果列已存在，忽略错误
      if (!error.message.includes('Duplicate column name')) {
        console.warn(`添加列 ${tableName}.${columnName} 时出现警告:`, error.message);
      }
    }
  }

  /**
   * 创建 user_configs 表
   */
  private async createUserConfigsTable(): Promise<void> {
    // 检查表是否已存在
    const [tables] = await this.connection.execute(
      'SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?',
      [TABLE_NAMES.USER_CONFIGS]
    );
    
    if ((tables as any[]).length > 0) {
      console.log('user_configs 表已存在，跳过创建');
      return;
    }
    
    console.log('创建 user_configs 表...');
    
    const sql = `
      CREATE TABLE IF NOT EXISTS ${TABLE_NAMES.USER_CONFIGS} (
        user_id VARCHAR(50) NOT NULL COMMENT '用户ID',
        api_config JSON COMMENT 'API配置信息（加密存储）',
        oss_config JSON COMMENT 'OSS配置信息（加密存储）',
        preferences JSON COMMENT '用户偏好设置',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
        
        PRIMARY KEY (user_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户配置表'
    `;
    
    await this.connection.execute(sql);
    console.log('user_configs 表创建成功');
  }

  /**
   * 创建 operation_logs 表
   */
  private async createOperationLogsTable(): Promise<void> {
    // 检查表是否已存在
    const [tables] = await this.connection.execute(
      'SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?',
      [TABLE_NAMES.OPERATION_LOGS]
    );
    
    if ((tables as any[]).length > 0) {
      console.log('operation_logs 表已存在，跳过创建');
      return;
    }
    
    console.log('创建 operation_logs 表...');
    
    const sql = `
      CREATE TABLE IF NOT EXISTS ${TABLE_NAMES.OPERATION_LOGS} (
        id BIGINT AUTO_INCREMENT COMMENT '日志ID',
        operation VARCHAR(50) NOT NULL COMMENT '操作类型（INSERT/UPDATE/DELETE/SELECT）',
        table_name VARCHAR(50) NOT NULL COMMENT '操作的表名',
        record_id VARCHAR(50) COMMENT '操作的记录ID',
        user_id VARCHAR(50) DEFAULT '${DEFAULT_VALUES.DEFAULT_USER_ID}' COMMENT '操作用户ID',
        status ENUM('SUCCESS', 'FAILED') DEFAULT 'SUCCESS' COMMENT '操作状态',
        error_message TEXT COMMENT '错误信息（如果操作失败）',
        duration INT COMMENT '操作耗时（毫秒）',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '操作时间',
        
        PRIMARY KEY (id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='操作日志表'
    `;
    
    await this.connection.execute(sql);
    console.log('operation_logs 表创建成功');
  }

  /**
   * 创建 reference_images 表（参考图片去重存储）
   */
  private async createReferenceImagesTable(): Promise<void> {
    // 检查表是否已存在
    const [tables] = await this.connection.execute(
      'SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?',
      ['reference_images']
    );
    
    if ((tables as any[]).length > 0) {
      console.log('reference_images 表已存在，跳过创建');
      return;
    }
    
    console.log('创建 reference_images 表...');
    
    const sql = `
      CREATE TABLE IF NOT EXISTS reference_images (
        id VARCHAR(50) NOT NULL COMMENT '参考图片唯一标识符',
        hash VARCHAR(64) NOT NULL COMMENT '图片内容SHA256哈希（用于去重）',
        oss_key VARCHAR(255) NOT NULL COMMENT 'OSS对象键名',
        oss_url TEXT NOT NULL COMMENT 'OSS访问URL',
        original_name VARCHAR(255) COMMENT '原始文件名',
        size INT UNSIGNED NOT NULL COMMENT '文件大小（字节）',
        mime_type VARCHAR(50) NOT NULL DEFAULT 'image/jpeg' COMMENT 'MIME类型',
        width INT UNSIGNED COMMENT '图片宽度',
        height INT UNSIGNED COMMENT '图片高度',
        use_count INT UNSIGNED DEFAULT 1 COMMENT '使用次数',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
        last_used_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后使用时间',
        
        PRIMARY KEY (id),
        UNIQUE KEY uk_hash (hash)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='参考图片表（去重存储）'
    `;
    
    await this.connection.execute(sql);
    console.log('reference_images 表创建成功');
  }

  /**
   * 创建所有必要的索引
   * 使用兼容阿里云 MySQL 的语法（不使用 IF NOT EXISTS）
   */
  private async createIndexes(): Promise<void> {
    console.log('创建数据库索引...');
    
    // 索引定义：[表名, 索引名, 列名]
    const indexDefinitions: [string, string, string][] = [
      // users 表索引
      [TABLE_NAMES.USERS, 'idx_users_is_active', 'is_active'],
      [TABLE_NAMES.USERS, 'idx_users_created_at', 'created_at'],
      [TABLE_NAMES.USERS, 'idx_users_role', 'role'],
      
      // projects 表索引
      [TABLE_NAMES.PROJECTS, 'idx_projects_created_by', 'created_by'],
      [TABLE_NAMES.PROJECTS, 'idx_projects_is_deleted', 'is_deleted'],
      [TABLE_NAMES.PROJECTS, 'idx_projects_created_at', 'created_at'],
      
      // images 表索引
      [TABLE_NAMES.IMAGES, 'idx_images_created_at', 'created_at'],
      [TABLE_NAMES.IMAGES, 'idx_images_model', 'model'],
      [TABLE_NAMES.IMAGES, 'idx_images_favorite', 'favorite'],
      [TABLE_NAMES.IMAGES, 'idx_images_user_id', 'user_id'],
      [TABLE_NAMES.IMAGES, 'idx_images_project_id', 'project_id'],
      [TABLE_NAMES.IMAGES, 'idx_images_oss_uploaded', 'oss_uploaded'],
      [TABLE_NAMES.IMAGES, 'idx_images_updated_at', 'updated_at'],
      [TABLE_NAMES.IMAGES, 'idx_images_is_deleted', 'is_deleted'],
      
      // operation_logs 表索引
      [TABLE_NAMES.OPERATION_LOGS, 'idx_logs_created_at', 'created_at'],
      [TABLE_NAMES.OPERATION_LOGS, 'idx_logs_operation', 'operation'],
      [TABLE_NAMES.OPERATION_LOGS, 'idx_logs_user_id', 'user_id'],
      [TABLE_NAMES.OPERATION_LOGS, 'idx_logs_status', 'status'],
      [TABLE_NAMES.OPERATION_LOGS, 'idx_logs_table_name', 'table_name'],
      
      // reference_images 表索引
      ['reference_images', 'idx_ref_created_at', 'created_at'],
      ['reference_images', 'idx_ref_use_count', 'use_count'],
      ['reference_images', 'idx_ref_last_used_at', 'last_used_at'],
      
      // 复合索引
      [TABLE_NAMES.IMAGES, 'idx_images_user_favorite', 'user_id, favorite'],
      [TABLE_NAMES.IMAGES, 'idx_images_model_created', 'model, created_at'],
      [TABLE_NAMES.IMAGES, 'idx_images_project_deleted', 'project_id, is_deleted'],
      [TABLE_NAMES.OPERATION_LOGS, 'idx_logs_table_operation', 'table_name, operation'],
    ];
    
    for (const [tableName, indexName, columns] of indexDefinitions) {
      try {
        // 先检查索引是否存在
        const [existingIndexes] = await this.connection.execute(
          `SELECT INDEX_NAME FROM information_schema.STATISTICS 
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?`,
          [tableName, indexName]
        );
        
        if ((existingIndexes as any[]).length === 0) {
          // 索引不存在，创建它
          await this.connection.execute(`CREATE INDEX ${indexName} ON ${tableName} (${columns})`);
          console.log(`索引 ${indexName} 创建成功`);
        } else {
          console.log(`索引 ${indexName} 已存在，跳过`);
        }
      } catch (error: any) {
        // 如果索引已存在（Duplicate key name），忽略错误
        if (error.message.includes('Duplicate key name') || error.code === 'ER_DUP_KEYNAME') {
          console.log(`索引 ${indexName} 已存在，跳过`);
        } else {
          console.warn(`创建索引 ${indexName} 时出现警告:`, error.message);
        }
      }
    }
    
    console.log('数据库索引创建完成');
  }

  /**
   * 插入初始数据
   */
  private async insertInitialData(): Promise<void> {
    console.log('插入初始数据...');
    
    try {
      // 插入默认用户配置
      const defaultPreferences = {
        theme: 'light',
        language: 'zh-CN',
        pageSize: DEFAULT_VALUES.PAGE_SIZE,
        autoSave: true,
        showThumbnails: true,
        defaultModel: DEFAULT_VALUES.DEFAULT_MODEL,
        defaultAspectRatio: DEFAULT_VALUES.DEFAULT_ASPECT_RATIO,
        defaultImageSize: DEFAULT_VALUES.DEFAULT_IMAGE_SIZE
      };
      
      const sql = `
        INSERT IGNORE INTO ${TABLE_NAMES.USER_CONFIGS} (user_id, preferences, created_at) 
        VALUES (?, ?, ?)
      `;
      
      await this.connection.execute(sql, [
        DEFAULT_VALUES.DEFAULT_USER_ID,
        JSON.stringify(defaultPreferences),
        new Date()
      ]);
      
      console.log('初始数据插入完成');
      
    } catch (error) {
      console.error('插入初始数据失败:', error);
      throw error;
    }
  }

  /**
   * 验证表结构完整性
   */
  private async validateTableStructure(): Promise<void> {
    console.log('验证表结构完整性...');
    
    const requiredTables = [TABLE_NAMES.USERS, TABLE_NAMES.PROJECTS, TABLE_NAMES.IMAGES, TABLE_NAMES.USER_CONFIGS, TABLE_NAMES.OPERATION_LOGS];
    
    for (const tableName of requiredTables) {
      const checkResult = await this.checkTableStructure(tableName);
      
      if (!checkResult.exists) {
        throw new Error(`必需的表 ${tableName} 不存在`);
      }
      
      console.log(`表 ${tableName} 结构验证通过，包含 ${checkResult.columns.length} 个字段，${checkResult.indexes.length} 个索引`);
    }
    
    console.log('所有表结构验证通过');
  }

  /**
   * 检查单个表的结构
   */
  private async checkTableStructure(tableName: string): Promise<TableCheckResult> {
    try {
      // 检查表是否存在
      const [tables] = await this.connection.execute(
        'SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?',
        [tableName]
      );
      
      if ((tables as any[]).length === 0) {
        return {
          exists: false,
          columns: [],
          indexes: [],
          missingColumns: [],
          missingIndexes: []
        };
      }
      
      // 获取表的列信息
      const [columns] = await this.connection.execute(
        'SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? ORDER BY ORDINAL_POSITION',
        [tableName]
      );
      
      // 获取表的索引信息
      const [indexes] = await this.connection.execute(
        'SELECT DISTINCT INDEX_NAME FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME != "PRIMARY"',
        [tableName]
      );
      
      const columnNames = (columns as any[]).map(row => row.COLUMN_NAME);
      const indexNames = (indexes as any[]).map(row => row.INDEX_NAME);
      
      return {
        exists: true,
        columns: columnNames,
        indexes: indexNames,
        missingColumns: [],
        missingIndexes: []
      };
      
    } catch (error) {
      console.error(`检查表 ${tableName} 结构失败:`, error);
      throw error;
    }
  }

  /**
   * 获取数据库统计信息
   */
  async getDatabaseStats(): Promise<any> {
    try {
      const stats = {
        tables: {},
        totalSize: 0,
        indexes: {}
      };
      
      // 获取表统计信息
      const [tableStats] = await this.connection.execute(`
        SELECT 
          TABLE_NAME as tableName,
          TABLE_ROWS as rowCount,
          DATA_LENGTH as dataSize,
          INDEX_LENGTH as indexSize,
          (DATA_LENGTH + INDEX_LENGTH) as totalSize,
          TABLE_COMMENT as comment
        FROM information_schema.TABLES 
        WHERE TABLE_SCHEMA = DATABASE() 
          AND TABLE_NAME IN (?, ?, ?, ?, ?)
        ORDER BY TABLE_NAME
      `, [TABLE_NAMES.USERS, TABLE_NAMES.PROJECTS, TABLE_NAMES.IMAGES, TABLE_NAMES.USER_CONFIGS, TABLE_NAMES.OPERATION_LOGS]);
      
      for (const row of tableStats as any[]) {
        (stats.tables as any)[row.tableName] = {
          rowCount: row.rowCount || 0,
          dataSize: row.dataSize || 0,
          indexSize: row.indexSize || 0,
          totalSize: row.totalSize || 0,
          comment: row.comment
        };
        stats.totalSize += row.totalSize || 0;
      }
      
      // 获取索引统计信息
      const [indexStats] = await this.connection.execute(`
        SELECT 
          TABLE_NAME as tableName,
          INDEX_NAME as indexName,
          NON_UNIQUE as nonUnique,
          GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX) as columns
        FROM information_schema.STATISTICS 
        WHERE TABLE_SCHEMA = DATABASE() 
          AND TABLE_NAME IN (?, ?, ?, ?, ?)
        GROUP BY TABLE_NAME, INDEX_NAME
        ORDER BY TABLE_NAME, INDEX_NAME
      `, [TABLE_NAMES.USERS, TABLE_NAMES.PROJECTS, TABLE_NAMES.IMAGES, TABLE_NAMES.USER_CONFIGS, TABLE_NAMES.OPERATION_LOGS]);
      
      for (const row of indexStats as any[]) {
        if (!(stats.indexes as any)[row.tableName]) {
          (stats.indexes as any)[row.tableName] = [];
        }
        (stats.indexes as any)[row.tableName].push({
          name: row.indexName,
          unique: row.nonUnique === 0,
          columns: row.columns.split(',')
        });
      }
      
      return stats;
      
    } catch (error) {
      console.error('获取数据库统计信息失败:', error);
      throw error;
    }
  }

  /**
   * 检查数据库版本兼容性
   */
  async checkDatabaseVersion(): Promise<{ version: string; compatible: boolean }> {
    try {
      const [rows] = await this.connection.execute('SELECT VERSION() as version');
      const version = (rows as any[])[0].version;
      
      // 检查 MySQL 版本是否支持 JSON 类型（MySQL 5.7+）
      const majorVersion = parseInt(version.split('.')[0]);
      const minorVersion = parseInt(version.split('.')[1]);
      
      const compatible = majorVersion > 5 || (majorVersion === 5 && minorVersion >= 7);
      
      return { version, compatible };
      
    } catch (error) {
      console.error('检查数据库版本失败:', error);
      throw error;
    }
  }

  /**
   * 清理过期的操作日志
   */
  async cleanupOldLogs(daysToKeep: number = 30): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
      
      const [result] = await this.connection.execute(
        `DELETE FROM ${TABLE_NAMES.OPERATION_LOGS} WHERE created_at < ?`,
        [cutoffDate]
      );
      
      const deletedRows = (result as any).affectedRows;
      console.log(`清理了 ${deletedRows} 条过期日志记录`);
      
      return deletedRows;
      
    } catch (error) {
      console.error('清理过期日志失败:', error);
      throw error;
    }
  }
}

/**
 * 创建数据库初始化器实例
 */
export function createDatabaseInitializer(connection: mysql.Connection): DatabaseInitializer {
  return new DatabaseInitializer(connection);
}
/**
 * 数据库表结构初始化服务
 * 负责创建和维护数据库表结构、索引和初始数据
 */

import mysql from 'mysql2/promise';
import { DatabaseConfig } from '../types';
import { SQL_TEMPLATES, TABLE_NAMES, DEFAULT_VALUES } from '../config/constants';

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
      
      // 创建 images 表
      await this.createImagesTable();
      
      // 创建 user_configs 表
      await this.createUserConfigsTable();
      
      // 创建 operation_logs 表
      await this.createOperationLogsTable();
      
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
   * 创建 images 表
   */
  private async createImagesTable(): Promise<void> {
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
        user_id VARCHAR(50) DEFAULT '${DEFAULT_VALUES.DEFAULT_USER_ID}' COMMENT '用户ID（预留字段）',
        
        PRIMARY KEY (id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='图片信息表'
    `;
    
    await this.connection.execute(sql);
    console.log('images 表创建成功');
  }

  /**
   * 创建 user_configs 表
   */
  private async createUserConfigsTable(): Promise<void> {
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
   * 创建所有必要的索引
   */
  private async createIndexes(): Promise<void> {
    console.log('创建数据库索引...');
    
    const indexQueries = [
      // images 表索引
      `CREATE INDEX IF NOT EXISTS idx_images_created_at ON ${TABLE_NAMES.IMAGES} (created_at)`,
      `CREATE INDEX IF NOT EXISTS idx_images_model ON ${TABLE_NAMES.IMAGES} (model)`,
      `CREATE INDEX IF NOT EXISTS idx_images_favorite ON ${TABLE_NAMES.IMAGES} (favorite)`,
      `CREATE INDEX IF NOT EXISTS idx_images_user_id ON ${TABLE_NAMES.IMAGES} (user_id)`,
      `CREATE INDEX IF NOT EXISTS idx_images_oss_uploaded ON ${TABLE_NAMES.IMAGES} (oss_uploaded)`,
      `CREATE INDEX IF NOT EXISTS idx_images_updated_at ON ${TABLE_NAMES.IMAGES} (updated_at)`,
      
      // operation_logs 表索引
      `CREATE INDEX IF NOT EXISTS idx_logs_created_at ON ${TABLE_NAMES.OPERATION_LOGS} (created_at)`,
      `CREATE INDEX IF NOT EXISTS idx_logs_operation ON ${TABLE_NAMES.OPERATION_LOGS} (operation)`,
      `CREATE INDEX IF NOT EXISTS idx_logs_user_id ON ${TABLE_NAMES.OPERATION_LOGS} (user_id)`,
      `CREATE INDEX IF NOT EXISTS idx_logs_status ON ${TABLE_NAMES.OPERATION_LOGS} (status)`,
      `CREATE INDEX IF NOT EXISTS idx_logs_table_name ON ${TABLE_NAMES.OPERATION_LOGS} (table_name)`,
      
      // 复合索引
      `CREATE INDEX IF NOT EXISTS idx_images_user_favorite ON ${TABLE_NAMES.IMAGES} (user_id, favorite)`,
      `CREATE INDEX IF NOT EXISTS idx_images_model_created ON ${TABLE_NAMES.IMAGES} (model, created_at)`,
      `CREATE INDEX IF NOT EXISTS idx_logs_table_operation ON ${TABLE_NAMES.OPERATION_LOGS} (table_name, operation)`,
    ];
    
    for (const query of indexQueries) {
      try {
        await this.connection.execute(query);
      } catch (error: any) {
        // 如果索引已存在，忽略错误
        if (!error.message.includes('Duplicate key name')) {
          console.warn('创建索引时出现警告:', error.message);
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
    
    const requiredTables = [TABLE_NAMES.IMAGES, TABLE_NAMES.USER_CONFIGS, TABLE_NAMES.OPERATION_LOGS];
    
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
          AND TABLE_NAME IN (?, ?, ?)
        ORDER BY TABLE_NAME
      `, [TABLE_NAMES.IMAGES, TABLE_NAMES.USER_CONFIGS, TABLE_NAMES.OPERATION_LOGS]);
      
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
          AND TABLE_NAME IN (?, ?, ?)
        GROUP BY TABLE_NAME, INDEX_NAME
        ORDER BY TABLE_NAME, INDEX_NAME
      `, [TABLE_NAMES.IMAGES, TABLE_NAMES.USER_CONFIGS, TABLE_NAMES.OPERATION_LOGS]);
      
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
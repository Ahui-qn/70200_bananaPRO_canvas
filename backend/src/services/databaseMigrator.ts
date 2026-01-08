/**
 * 数据库版本管理和迁移服务
 * 负责数据库版本检查、迁移脚本执行和回滚机制
 */

import * as mysql from 'mysql2/promise';
import { DatabaseConfig } from '@shared/types';

/**
 * 数据库版本信息
 */
export interface DatabaseVersion {
  version: string;                    // 版本号（如 "1.0.0"）
  description: string;                // 版本描述
  releaseDate: Date;                  // 发布日期
  scripts: MigrationScript[];         // 迁移脚本列表
  rollbackScripts?: MigrationScript[]; // 回滚脚本列表（可选）
}

/**
 * 迁移脚本信息
 */
export interface MigrationScript {
  id: string;                         // 脚本唯一标识符
  name: string;                       // 脚本名称
  description: string;                // 脚本描述
  sql: string;                        // SQL 语句
  checksum?: string;                  // 脚本校验和
  executionOrder: number;             // 执行顺序
}

/**
 * 迁移执行结果
 */
export interface MigrationResult {
  success: boolean;                   // 是否成功
  version: string;                    // 目标版本
  executedScripts: string[];          // 已执行的脚本ID列表
  failedScript?: string;              // 失败的脚本ID
  error?: string;                     // 错误信息
  duration: number;                   // 执行耗时（毫秒）
  rollbackAvailable: boolean;         // 是否支持回滚
}

/**
 * 版本比较结果
 */
export interface VersionComparison {
  current: string;                    // 当前版本
  target: string;                     // 目标版本
  needsUpgrade: boolean;              // 是否需要升级
  needsDowngrade: boolean;            // 是否需要降级
  migrationPath: string[];            // 迁移路径（版本列表）
}

/**
 * 数据库迁移器类
 */
export class DatabaseMigrator {
  private connection: mysql.Connection;
  private versions: Map<string, DatabaseVersion> = new Map();
  private currentVersion: string | null = null;

  constructor(connection: mysql.Connection) {
    this.connection = connection;
    this.initializeVersions();
  }

  /**
   * 初始化版本定义
   */
  private initializeVersions(): void {
    // 版本 1.0.0 - 初始版本
    this.versions.set('1.0.0', {
      version: '1.0.0',
      description: '初始数据库结构',
      releaseDate: new Date('2024-12-30'),
      scripts: [
        {
          id: 'create_schema_version_table',
          name: '创建版本管理表',
          description: '创建用于跟踪数据库版本的表',
          sql: `
            CREATE TABLE IF NOT EXISTS schema_versions (
              id INT AUTO_INCREMENT PRIMARY KEY,
              version VARCHAR(20) NOT NULL UNIQUE,
              description TEXT,
              applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              applied_by VARCHAR(100) DEFAULT 'system',
              checksum VARCHAR(64),
              execution_time INT COMMENT '执行时间（毫秒）',
              
              INDEX idx_version (version),
              INDEX idx_applied_at (applied_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='数据库版本管理表';
          `,
          executionOrder: 1
        },
        {
          id: 'create_migration_log_table',
          name: '创建迁移日志表',
          description: '创建用于记录迁移操作的日志表',
          sql: `
            CREATE TABLE IF NOT EXISTS migration_logs (
              id BIGINT AUTO_INCREMENT PRIMARY KEY,
              migration_id VARCHAR(100) NOT NULL,
              version VARCHAR(20) NOT NULL,
              operation ENUM('UPGRADE', 'DOWNGRADE', 'ROLLBACK') NOT NULL,
              status ENUM('STARTED', 'SUCCESS', 'FAILED', 'ROLLED_BACK') NOT NULL,
              started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              completed_at TIMESTAMP NULL,
              error_message TEXT,
              executed_scripts JSON COMMENT '已执行的脚本列表',
              
              INDEX idx_version (version),
              INDEX idx_operation (operation),
              INDEX idx_status (status),
              INDEX idx_started_at (started_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='数据库迁移日志表';
          `,
          executionOrder: 2
        }
      ]
    });

    // 版本 1.1.0 - 添加索引优化
    this.versions.set('1.1.0', {
      version: '1.1.0',
      description: '数据库索引优化',
      releaseDate: new Date('2024-12-31'),
      scripts: [
        {
          id: 'add_composite_indexes',
          name: '添加复合索引',
          description: '为提高查询性能添加复合索引',
          sql: `
            -- 为 images 表添加复合索引
            CREATE INDEX IF NOT EXISTS idx_images_user_favorite ON images (user_id, favorite);
            CREATE INDEX IF NOT EXISTS idx_images_model_created ON images (model, created_at);
            CREATE INDEX IF NOT EXISTS idx_images_oss_status ON images (oss_uploaded, created_at);
            
            -- 为 operation_logs 表添加复合索引
            CREATE INDEX IF NOT EXISTS idx_logs_table_operation ON operation_logs (table_name, operation);
            CREATE INDEX IF NOT EXISTS idx_logs_status_created ON operation_logs (status, created_at);
          `,
          executionOrder: 1
        },
        {
          id: 'optimize_json_columns',
          name: '优化JSON列',
          description: '为JSON列添加虚拟列和索引',
          sql: `
            -- 为 images 表的 tags JSON 字段添加虚拟列（如果MySQL版本支持）
            -- ALTER TABLE images ADD COLUMN tags_count INT GENERATED ALWAYS AS (JSON_LENGTH(tags)) VIRTUAL;
            -- CREATE INDEX IF NOT EXISTS idx_images_tags_count ON images (tags_count);
            
            -- 注意：虚拟列功能需要 MySQL 5.7.6+ 版本支持
            -- 这里先预留，实际执行时会检查版本兼容性
          `,
          executionOrder: 2
        }
      ],
      rollbackScripts: [
        {
          id: 'remove_composite_indexes',
          name: '移除复合索引',
          description: '回滚复合索引的添加',
          sql: `
            DROP INDEX IF EXISTS idx_images_user_favorite ON images;
            DROP INDEX IF EXISTS idx_images_model_created ON images;
            DROP INDEX IF EXISTS idx_images_oss_status ON images;
            DROP INDEX IF EXISTS idx_logs_table_operation ON operation_logs;
            DROP INDEX IF EXISTS idx_logs_status_created ON operation_logs;
          `,
          executionOrder: 1
        }
      ]
    });

    // 版本 1.2.0 - 添加新功能表
    this.versions.set('1.2.0', {
      version: '1.2.0',
      description: '添加用户会话和缓存管理功能',
      releaseDate: new Date('2025-01-01'),
      scripts: [
        {
          id: 'create_user_sessions_table',
          name: '创建用户会话表',
          description: '创建用于管理用户会话的表',
          sql: `
            CREATE TABLE IF NOT EXISTS user_sessions (
              id VARCHAR(64) PRIMARY KEY COMMENT '会话ID',
              user_id VARCHAR(50) NOT NULL COMMENT '用户ID',
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
              last_accessed TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后访问时间',
              expires_at TIMESTAMP NOT NULL COMMENT '过期时间',
              data JSON COMMENT '会话数据',
              
              INDEX idx_user_id (user_id),
              INDEX idx_expires_at (expires_at),
              INDEX idx_last_accessed (last_accessed)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户会话表';
          `,
          executionOrder: 1
        },
        {
          id: 'create_cache_entries_table',
          name: '创建缓存条目表',
          description: '创建用于缓存管理的表',
          sql: `
            CREATE TABLE IF NOT EXISTS cache_entries (
              cache_key VARCHAR(255) PRIMARY KEY COMMENT '缓存键',
              cache_value LONGTEXT NOT NULL COMMENT '缓存值',
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
              expires_at TIMESTAMP NOT NULL COMMENT '过期时间',
              access_count INT DEFAULT 0 COMMENT '访问次数',
              last_accessed TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后访问时间',
              
              INDEX idx_expires_at (expires_at),
              INDEX idx_last_accessed (last_accessed)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='缓存条目表';
          `,
          executionOrder: 2
        }
      ],
      rollbackScripts: [
        {
          id: 'drop_session_cache_tables',
          name: '删除会话和缓存表',
          description: '回滚会话和缓存表的创建',
          sql: `
            DROP TABLE IF EXISTS user_sessions;
            DROP TABLE IF EXISTS cache_entries;
          `,
          executionOrder: 1
        }
      ]
    });
  }

  /**
   * 检查当前数据库版本
   */
  async getCurrentVersion(): Promise<string | null> {
    try {
      // 检查版本管理表是否存在
      const [tables] = await this.connection.execute(
        'SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?',
        ['schema_versions']
      );

      if ((tables as any[]).length === 0) {
        // 版本管理表不存在，说明是全新数据库
        return null;
      }

      // 获取最新的版本记录
      const [rows] = await this.connection.execute(
        'SELECT version FROM schema_versions ORDER BY applied_at DESC LIMIT 1'
      );

      if ((rows as any[]).length === 0) {
        return null;
      }

      this.currentVersion = (rows as any[])[0].version;
      return this.currentVersion;

    } catch (error) {
      console.error('检查数据库版本失败:', error);
      throw error;
    }
  }

  /**
   * 比较版本
   */
  compareVersions(version1: string, version2: string): number {
    const v1Parts = version1.split('.').map(Number);
    const v2Parts = version2.split('.').map(Number);
    
    const maxLength = Math.max(v1Parts.length, v2Parts.length);
    
    for (let i = 0; i < maxLength; i++) {
      const v1Part = v1Parts[i] || 0;
      const v2Part = v2Parts[i] || 0;
      
      if (v1Part < v2Part) return -1;
      if (v1Part > v2Part) return 1;
    }
    
    return 0;
  }

  /**
   * 获取版本比较结果
   */
  async getVersionComparison(targetVersion: string): Promise<VersionComparison> {
    const currentVersion = await this.getCurrentVersion();
    const current = currentVersion || '0.0.0';
    
    const comparison = this.compareVersions(current, targetVersion);
    
    // 计算迁移路径
    const migrationPath: string[] = [];
    const sortedVersions = Array.from(this.versions.keys()).sort((a, b) => this.compareVersions(a, b));
    
    if (comparison < 0) {
      // 需要升级
      for (const version of sortedVersions) {
        if (this.compareVersions(version, current) > 0 && this.compareVersions(version, targetVersion) <= 0) {
          migrationPath.push(version);
        }
      }
    } else if (comparison > 0) {
      // 需要降级
      for (const version of sortedVersions.reverse()) {
        if (this.compareVersions(version, current) < 0 && this.compareVersions(version, targetVersion) >= 0) {
          migrationPath.push(version);
        }
      }
    }

    return {
      current,
      target: targetVersion,
      needsUpgrade: comparison < 0,
      needsDowngrade: comparison > 0,
      migrationPath
    };
  }

  /**
   * 执行数据库迁移到指定版本
   */
  async migrateToVersion(targetVersion: string): Promise<MigrationResult> {
    const startTime = Date.now();
    const executedScripts: string[] = [];
    let migrationLogId: string | null = null;

    try {
      console.log(`开始迁移数据库到版本 ${targetVersion}...`);

      // 获取版本比较结果
      const comparison = await this.getVersionComparison(targetVersion);
      
      if (!comparison.needsUpgrade && !comparison.needsDowngrade) {
        console.log('数据库已经是目标版本，无需迁移');
        return {
          success: true,
          version: targetVersion,
          executedScripts: [],
          duration: Date.now() - startTime,
          rollbackAvailable: false
        };
      }

      // 记录迁移开始
      migrationLogId = await this.logMigrationStart(targetVersion, comparison.needsUpgrade ? 'UPGRADE' : 'DOWNGRADE');

      // 开始事务
      await this.connection.beginTransaction();

      try {
        // 执行迁移路径中的每个版本
        for (const version of comparison.migrationPath) {
          const versionInfo = this.versions.get(version);
          if (!versionInfo) {
            throw new Error(`未找到版本 ${version} 的定义`);
          }

          console.log(`执行版本 ${version} 的迁移脚本...`);

          // 选择要执行的脚本（升级或降级）
          const scripts = comparison.needsUpgrade ? versionInfo.scripts : (versionInfo.rollbackScripts || []);
          
          if (scripts.length === 0 && comparison.needsDowngrade) {
            throw new Error(`版本 ${version} 不支持回滚操作`);
          }

          // 按执行顺序排序脚本
          const sortedScripts = [...scripts].sort((a, b) => a.executionOrder - b.executionOrder);

          // 执行每个脚本
          for (const script of sortedScripts) {
            console.log(`执行脚本: ${script.name}`);
            
            try {
              // 分割SQL语句（处理多条语句）
              const sqlStatements = script.sql
                .split(';')
                .map(stmt => stmt.trim())
                .filter(stmt => stmt.length > 0);

              for (const sql of sqlStatements) {
                await this.connection.execute(sql);
              }

              executedScripts.push(script.id);
              console.log(`脚本 ${script.name} 执行成功`);

            } catch (error: any) {
              console.error(`脚本 ${script.name} 执行失败:`, error);
              throw new Error(`脚本执行失败: ${script.name} - ${error.message}`);
            }
          }

          // 更新版本记录
          if (comparison.needsUpgrade) {
            await this.recordVersionApplied(version, versionInfo.description);
          } else {
            await this.removeVersionRecord(version);
          }
        }

        // 提交事务
        await this.connection.commit();

        // 更新当前版本
        this.currentVersion = targetVersion;

        // 记录迁移成功
        if (migrationLogId) {
          await this.logMigrationComplete(migrationLogId, 'SUCCESS', executedScripts);
        }

        const duration = Date.now() - startTime;
        console.log(`数据库迁移完成，耗时 ${duration}ms`);

        return {
          success: true,
          version: targetVersion,
          executedScripts,
          duration,
          rollbackAvailable: this.isRollbackAvailable(targetVersion)
        };

      } catch (error) {
        // 回滚事务
        await this.connection.rollback();
        throw error;
      }

    } catch (error: any) {
      console.error('数据库迁移失败:', error);

      // 记录迁移失败
      if (migrationLogId) {
        await this.logMigrationComplete(migrationLogId, 'FAILED', executedScripts, error.message);
      }

      return {
        success: false,
        version: targetVersion,
        executedScripts,
        error: error.message,
        duration: Date.now() - startTime,
        rollbackAvailable: false
      };
    }
  }

  /**
   * 回滚到指定版本
   */
  async rollbackToVersion(targetVersion: string): Promise<MigrationResult> {
    const startTime = Date.now();
    let migrationLogId: string | null = null;

    try {
      console.log(`开始回滚数据库到版本 ${targetVersion}...`);

      const currentVersion = await this.getCurrentVersion();
      if (!currentVersion) {
        throw new Error('无法确定当前数据库版本');
      }

      if (this.compareVersions(currentVersion, targetVersion) <= 0) {
        throw new Error('目标版本必须低于当前版本才能执行回滚');
      }

      // 记录回滚开始
      migrationLogId = await this.logMigrationStart(targetVersion, 'ROLLBACK');

      // 执行降级迁移
      const result = await this.migrateToVersion(targetVersion);

      // 更新日志状态
      if (migrationLogId) {
        const status = result.success ? 'ROLLED_BACK' : 'FAILED';
        await this.logMigrationComplete(migrationLogId, status, result.executedScripts, result.error);
      }

      return {
        ...result,
        rollbackAvailable: false // 回滚操作本身不支持再次回滚
      };

    } catch (error: any) {
      console.error('数据库回滚失败:', error);

      if (migrationLogId) {
        await this.logMigrationComplete(migrationLogId, 'FAILED', [], error.message);
      }

      return {
        success: false,
        version: targetVersion,
        executedScripts: [],
        error: error.message,
        duration: Date.now() - startTime,
        rollbackAvailable: false
      };
    }
  }

  /**
   * 检查版本是否支持回滚
   */
  private isRollbackAvailable(version: string): boolean {
    const versionInfo = this.versions.get(version);
    return !!(versionInfo && versionInfo.rollbackScripts && versionInfo.rollbackScripts.length > 0);
  }

  /**
   * 记录版本应用
   */
  private async recordVersionApplied(version: string, description: string): Promise<void> {
    const sql = `
      INSERT INTO schema_versions (version, description, applied_by, checksum) 
      VALUES (?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE 
        description = VALUES(description),
        applied_at = CURRENT_TIMESTAMP,
        applied_by = VALUES(applied_by)
    `;

    // 生成简单的校验和
    const checksum = this.generateChecksum(version + description);

    await this.connection.execute(sql, [version, description, 'system', checksum]);
  }

  /**
   * 移除版本记录
   */
  private async removeVersionRecord(version: string): Promise<void> {
    const sql = 'DELETE FROM schema_versions WHERE version = ?';
    await this.connection.execute(sql, [version]);
  }

  /**
   * 记录迁移开始
   */
  private async logMigrationStart(version: string, operation: 'UPGRADE' | 'DOWNGRADE' | 'ROLLBACK'): Promise<string> {
    const migrationId = `migration_${Date.now()}_${Math.random().toString(36).substring(2)}`;
    
    const sql = `
      INSERT INTO migration_logs (migration_id, version, operation, status) 
      VALUES (?, ?, ?, 'STARTED')
    `;

    await this.connection.execute(sql, [migrationId, version, operation]);
    return migrationId;
  }

  /**
   * 记录迁移完成
   */
  private async logMigrationComplete(
    migrationId: string, 
    status: 'SUCCESS' | 'FAILED' | 'ROLLED_BACK',
    executedScripts: string[],
    errorMessage?: string
  ): Promise<void> {
    const sql = `
      UPDATE migration_logs 
      SET status = ?, completed_at = CURRENT_TIMESTAMP, error_message = ?, executed_scripts = ?
      WHERE migration_id = ?
    `;

    await this.connection.execute(sql, [
      status,
      errorMessage || null,
      JSON.stringify(executedScripts),
      migrationId
    ]);
  }

  /**
   * 生成简单的校验和
   */
  private generateChecksum(data: string): string {
    // 简单的哈希函数（生产环境建议使用更强的哈希算法）
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // 转换为32位整数
    }
    return Math.abs(hash).toString(16);
  }

  /**
   * 获取所有可用版本
   */
  getAvailableVersions(): DatabaseVersion[] {
    return Array.from(this.versions.values()).sort((a, b) => this.compareVersions(a.version, b.version));
  }

  /**
   * 获取最新版本
   */
  getLatestVersion(): string {
    const versions = Array.from(this.versions.keys());
    return versions.sort((a, b) => this.compareVersions(a, b)).pop() || '1.0.0';
  }

  /**
   * 获取迁移历史
   */
  async getMigrationHistory(limit: number = 50): Promise<any[]> {
    try {
      const sql = `
        SELECT * FROM migration_logs 
        ORDER BY started_at DESC 
        LIMIT ?
      `;

      const [rows] = await this.connection.execute(sql, [limit]);
      return rows as any[];

    } catch (error) {
      console.error('获取迁移历史失败:', error);
      return [];
    }
  }

  /**
   * 清理过期的迁移日志
   */
  async cleanupMigrationLogs(daysToKeep: number = 30): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

      const sql = 'DELETE FROM migration_logs WHERE started_at < ?';
      const [result] = await this.connection.execute(sql, [cutoffDate]);

      const deletedRows = (result as any).affectedRows;
      console.log(`清理了 ${deletedRows} 条过期迁移日志`);

      return deletedRows;

    } catch (error) {
      console.error('清理迁移日志失败:', error);
      throw error;
    }
  }

  /**
   * 验证数据库完整性
   */
  async validateDatabaseIntegrity(): Promise<{
    valid: boolean;
    issues: string[];
    recommendations: string[];
  }> {
    const issues: string[] = [];
    const recommendations: string[] = [];

    try {
      // 检查必需的表是否存在
      const requiredTables = ['images', 'user_configs', 'operation_logs', 'schema_versions', 'migration_logs'];
      
      for (const tableName of requiredTables) {
        const [tables] = await this.connection.execute(
          'SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?',
          [tableName]
        );

        if ((tables as any[]).length === 0) {
          issues.push(`缺少必需的表: ${tableName}`);
        }
      }

      // 检查版本一致性
      const currentVersion = await this.getCurrentVersion();
      if (currentVersion) {
        const versionInfo = this.versions.get(currentVersion);
        if (!versionInfo) {
          issues.push(`当前版本 ${currentVersion} 在版本定义中不存在`);
        }
      }

      // 检查索引完整性
      const [indexes] = await this.connection.execute(`
        SELECT TABLE_NAME, INDEX_NAME, COUNT(*) as index_count
        FROM information_schema.STATISTICS 
        WHERE TABLE_SCHEMA = DATABASE() 
          AND TABLE_NAME IN ('images', 'user_configs', 'operation_logs')
        GROUP BY TABLE_NAME, INDEX_NAME
      `);

      if ((indexes as any[]).length < 10) {
        recommendations.push('建议检查数据库索引是否完整，可能影响查询性能');
      }

      return {
        valid: issues.length === 0,
        issues,
        recommendations
      };

    } catch (error: any) {
      issues.push(`验证过程中发生错误: ${error.message}`);
      return {
        valid: false,
        issues,
        recommendations
      };
    }
  }
}

/**
 * 创建数据库迁移器实例
 */
export function createDatabaseMigrator(connection: mysql.Connection): DatabaseMigrator {
  return new DatabaseMigrator(connection);
}
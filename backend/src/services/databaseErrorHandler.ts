/**
 * 数据库错误处理器
 * 提供数据库错误的友好提示、错误分类和日志记录
 */

import { DatabaseError, OperationLog } from '../types';
import { DB_ERROR_CODES, ERROR_MESSAGES, OPERATION_STATUS } from '../config/constants';

/**
 * 数据库错误类型枚举
 */
export enum DatabaseErrorType {
  CONNECTION = 'CONNECTION',        // 连接错误
  AUTHENTICATION = 'AUTHENTICATION', // 认证错误
  PERMISSION = 'PERMISSION',        // 权限错误
  SYNTAX = 'SYNTAX',               // SQL语法错误
  CONSTRAINT = 'CONSTRAINT',        // 约束违反
  DATA = 'DATA',                   // 数据错误
  TIMEOUT = 'TIMEOUT',             // 超时错误
  RESOURCE = 'RESOURCE',           // 资源错误
  UNKNOWN = 'UNKNOWN'              // 未知错误
}

/**
 * 数据库错误详情接口
 */
export interface DatabaseErrorDetails {
  type: DatabaseErrorType;
  code: string;
  message: string;
  userMessage: string;
  retryable: boolean;
  suggestions: string[];
  sqlState?: string;
  errno?: number;
  sql?: string;
}

/**
 * 数据库错误处理器实现
 */
export class DatabaseErrorHandlerImpl {
  private errorLog: OperationLog[] = [];
  private readonly maxLogSize: number;

  constructor(maxLogSize: number = 1000) {
    this.maxLogSize = maxLogSize;
  }

  /**
   * 处理数据库错误，返回标准化的错误信息
   */
  handleError(error: any, context?: {
    operation?: string;
    tableName?: string;
    recordId?: string;
    sql?: string;
  }): DatabaseError {
    const details = this.analyzeError(error);
    
    // 记录错误日志
    this.logError(error, details, context);
    
    // 创建标准化的数据库错误
    const dbError = this.createDatabaseError(details, error);
    
    // 输出错误信息到控制台
    this.logToConsole(details, context);
    
    return dbError;
  }

  /**
   * 分析错误并返回详细信息
   */
  private analyzeError(error: any): DatabaseErrorDetails {
    const code = error.code || 'UNKNOWN_ERROR';
    const message = error.message || '未知数据库错误';
    const sqlState = error.sqlState;
    const errno = error.errno;

    let type: DatabaseErrorType;
    let userMessage: string;
    let retryable: boolean;
    let suggestions: string[] = [];

    switch (code) {
      // 连接相关错误
      case DB_ERROR_CODES.CONNECTION_REFUSED:
        type = DatabaseErrorType.CONNECTION;
        userMessage = ERROR_MESSAGES.DB_CONNECTION_REFUSED;
        retryable = true;
        suggestions = [
          '检查数据库服务器是否正在运行',
          '验证主机地址和端口号是否正确',
          '检查防火墙设置是否阻止了连接',
          '确认网络连接是否正常'
        ];
        break;

      case DB_ERROR_CODES.TIMEOUT:
        type = DatabaseErrorType.TIMEOUT;
        userMessage = ERROR_MESSAGES.DB_TIMEOUT;
        retryable = true;
        suggestions = [
          '检查网络连接稳定性',
          '考虑增加连接超时时间',
          '检查数据库服务器负载',
          '优化查询语句以减少执行时间'
        ];
        break;

      // 认证相关错误
      case DB_ERROR_CODES.ACCESS_DENIED:
        type = DatabaseErrorType.AUTHENTICATION;
        userMessage = ERROR_MESSAGES.DB_ACCESS_DENIED;
        retryable = false;
        suggestions = [
          '检查用户名是否正确',
          '验证密码是否正确',
          '确认用户账户是否被锁定',
          '检查用户是否有访问该数据库的权限'
        ];
        break;

      case DB_ERROR_CODES.BAD_DB_ERROR:
        type = DatabaseErrorType.PERMISSION;
        userMessage = ERROR_MESSAGES.DB_NOT_FOUND;
        retryable = false;
        suggestions = [
          '检查数据库名称是否正确',
          '确认数据库是否已创建',
          '验证用户是否有访问该数据库的权限'
        ];
        break;

      // 数据约束错误
      case DB_ERROR_CODES.DUPLICATE_ENTRY:
        type = DatabaseErrorType.CONSTRAINT;
        userMessage = ERROR_MESSAGES.DUPLICATE_RECORD;
        retryable = false;
        suggestions = [
          '检查是否尝试插入重复的主键或唯一键',
          '考虑使用 INSERT ... ON DUPLICATE KEY UPDATE',
          '验证数据的唯一性约束'
        ];
        break;

      // 表结构错误
      case DB_ERROR_CODES.TABLE_NOT_EXISTS:
        type = DatabaseErrorType.SYNTAX;
        userMessage = '数据表不存在，请先初始化数据库';
        retryable = false;
        suggestions = [
          '运行数据库初始化脚本',
          '检查表名是否正确',
          '确认是否在正确的数据库中操作'
        ];
        break;

      case DB_ERROR_CODES.COLUMN_NOT_EXISTS:
        type = DatabaseErrorType.SYNTAX;
        userMessage = ERROR_MESSAGES.INVALID_DATA_FORMAT;
        retryable = false;
        suggestions = [
          '检查字段名是否正确',
          '确认数据库表结构是否最新',
          '运行数据库迁移脚本'
        ];
        break;

      // 资源相关错误
      case 'ER_CON_COUNT_ERROR':
        type = DatabaseErrorType.RESOURCE;
        userMessage = '数据库连接数已达上限，请稍后重试';
        retryable = true;
        suggestions = [
          '等待一段时间后重试',
          '检查是否有连接泄漏',
          '考虑增加数据库最大连接数',
          '优化应用程序的连接管理'
        ];
        break;

      case 'ER_LOCK_WAIT_TIMEOUT':
        type = DatabaseErrorType.TIMEOUT;
        userMessage = '数据库锁等待超时，请稍后重试';
        retryable = true;
        suggestions = [
          '稍后重试操作',
          '检查是否有长时间运行的事务',
          '优化查询以减少锁定时间',
          '考虑调整事务隔离级别'
        ];
        break;

      case 'ER_LOCK_DEADLOCK':
        type = DatabaseErrorType.RESOURCE;
        userMessage = '检测到死锁，操作已回滚';
        retryable = true;
        suggestions = [
          '重试操作（系统已自动回滚）',
          '优化事务逻辑以避免死锁',
          '按相同顺序访问表和行',
          '缩短事务持续时间'
        ];
        break;

      // 数据类型和格式错误
      case 'ER_TRUNCATED_WRONG_VALUE':
      case 'ER_BAD_NULL_ERROR':
      case 'ER_DATA_TOO_LONG':
        type = DatabaseErrorType.DATA;
        userMessage = '数据格式或长度不符合要求';
        retryable = false;
        suggestions = [
          '检查数据类型是否匹配',
          '验证数据长度是否超出限制',
          '确认必填字段是否提供了值',
          '检查日期时间格式是否正确'
        ];
        break;

      // 默认处理
      default:
        type = DatabaseErrorType.UNKNOWN;
        userMessage = message || ERROR_MESSAGES.OPERATION_FAILED;
        retryable = this.isRetryableByDefault(code, message);
        suggestions = [
          '检查数据库连接状态',
          '验证操作参数是否正确',
          '查看详细错误日志',
          '联系系统管理员'
        ];
        break;
    }

    return {
      type,
      code,
      message,
      userMessage,
      retryable,
      suggestions,
      sqlState,
      errno
    };
  }

  /**
   * 判断未知错误是否可重试
   */
  private isRetryableByDefault(code: string, message: string): boolean {
    // 网络相关错误通常可重试
    const networkErrors = ['ECONNRESET', 'EPIPE', 'ENOTFOUND'];
    if (networkErrors.includes(code)) {
      return true;
    }

    // 根据错误消息判断
    const retryableKeywords = [
      'timeout',
      'connection',
      'network',
      'temporary',
      'busy',
      'lock'
    ];

    const lowerMessage = message.toLowerCase();
    return retryableKeywords.some(keyword => lowerMessage.includes(keyword));
  }

  /**
   * 创建标准化的数据库错误对象
   */
  private createDatabaseError(details: DatabaseErrorDetails, originalError: any): DatabaseError {
    const error = new Error(details.userMessage) as DatabaseError;
    error.name = 'DatabaseError';
    error.code = details.code;
    error.sqlState = details.sqlState;
    error.errno = details.errno;
    error.sql = originalError.sql;
    
    // 添加自定义属性
    (error as any).type = details.type;
    (error as any).retryable = details.retryable;
    (error as any).suggestions = details.suggestions;
    (error as any).originalMessage = details.message;
    
    return error;
  }

  /**
   * 记录错误到内存日志
   */
  private logError(
    error: any, 
    details: DatabaseErrorDetails, 
    context?: {
      operation?: string;
      tableName?: string;
      recordId?: string;
      sql?: string;
    }
  ): void {
    const logEntry: OperationLog = {
      id: this.generateLogId(),
      operation: context?.operation || 'UNKNOWN',
      tableName: context?.tableName || 'unknown',
      recordId: context?.recordId || undefined,
      userId: 'default',
      status: OPERATION_STATUS.FAILED,
      errorMessage: `[${details.type}] ${details.code}: ${details.message}`,
      createdAt: new Date(),
      duration: undefined
    };

    this.errorLog.push(logEntry);

    // 限制日志大小
    if (this.errorLog.length > this.maxLogSize) {
      this.errorLog = this.errorLog.slice(-this.maxLogSize);
    }
  }

  /**
   * 输出错误信息到控制台
   */
  private logToConsole(
    details: DatabaseErrorDetails, 
    context?: {
      operation?: string;
      tableName?: string;
      recordId?: string;
      sql?: string;
    }
  ): void {
    console.error('=== 数据库错误详情 ===');
    console.error(`错误类型: ${details.type}`);
    console.error(`错误代码: ${details.code}`);
    console.error(`用户消息: ${details.userMessage}`);
    console.error(`原始消息: ${details.message}`);
    console.error(`可重试: ${details.retryable ? '是' : '否'}`);
    
    if (context) {
      console.error(`操作上下文:`);
      if (context.operation) console.error(`  - 操作: ${context.operation}`);
      if (context.tableName) console.error(`  - 表名: ${context.tableName}`);
      if (context.recordId) console.error(`  - 记录ID: ${context.recordId}`);
      if (context.sql) console.error(`  - SQL: ${context.sql}`);
    }
    
    if (details.suggestions.length > 0) {
      console.error('建议解决方案:');
      details.suggestions.forEach((suggestion, index) => {
        console.error(`  ${index + 1}. ${suggestion}`);
      });
    }
    
    console.error('==================');
  }

  /**
   * 生成日志ID
   */
  private generateLogId(): string {
    return `log_${Date.now()}_${Math.random().toString(36).substring(2)}`;
  }

  /**
   * 获取错误日志
   */
  getErrorLog(limit?: number): OperationLog[] {
    const logs = [...this.errorLog].reverse(); // 最新的在前
    return limit ? logs.slice(0, limit) : logs;
  }

  /**
   * 清除错误日志
   */
  clearErrorLog(): void {
    this.errorLog = [];
  }

  /**
   * 获取错误统计信息
   */
  getErrorStats(): {
    total: number;
    byType: Record<DatabaseErrorType, number>;
    byCode: Record<string, number>;
    recent: number; // 最近1小时的错误数
  } {
    const stats = {
      total: this.errorLog.length,
      byType: {} as Record<DatabaseErrorType, number>,
      byCode: {} as Record<string, number>,
      recent: 0
    };

    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    // 初始化类型统计
    Object.values(DatabaseErrorType).forEach(type => {
      stats.byType[type] = 0;
    });

    this.errorLog.forEach(log => {
      // 解析错误类型和代码
      const match = log.errorMessage?.match(/^\[(\w+)\] (\w+):/);
      if (match) {
        const [, type, code] = match;
        
        // 统计错误类型
        if (type in stats.byType) {
          stats.byType[type as DatabaseErrorType]++;
        }
        
        // 统计错误代码
        stats.byCode[code] = (stats.byCode[code] || 0) + 1;
      }

      // 统计最近错误
      if (log.createdAt > oneHourAgo) {
        stats.recent++;
      }
    });

    return stats;
  }

  /**
   * 检查错误是否可重试
   */
  isRetryable(error: any): boolean {
    if (error.retryable !== undefined) {
      return error.retryable;
    }

    const details = this.analyzeError(error);
    return details.retryable;
  }

  /**
   * 获取错误建议
   */
  getSuggestions(error: any): string[] {
    const details = this.analyzeError(error);
    return details.suggestions;
  }

  /**
   * 格式化错误消息（用于用户显示）
   */
  formatUserMessage(error: any): string {
    const details = this.analyzeError(error);
    return details.userMessage;
  }
}

/**
 * 创建数据库错误处理器实例
 */
export function createDatabaseErrorHandler(maxLogSize?: number): DatabaseErrorHandlerImpl {
  return new DatabaseErrorHandlerImpl(maxLogSize);
}

/**
 * 默认数据库错误处理器实例
 */
export const databaseErrorHandler = new DatabaseErrorHandlerImpl();

/**
 * 便捷函数：处理数据库操作错误
 */
export function handleDatabaseError(
  error: any,
  context?: {
    operation?: string;
    tableName?: string;
    recordId?: string;
    sql?: string;
  }
): never {
  const dbError = databaseErrorHandler.handleError(error, context);
  throw dbError;
}

/**
 * 便捷函数：包装数据库操作以自动处理错误
 */
export async function withDatabaseErrorHandling<T>(
  operation: () => Promise<T>,
  context?: {
    operation?: string;
    tableName?: string;
    recordId?: string;
    sql?: string;
  }
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    throw databaseErrorHandler.handleError(error, context);
  }
}
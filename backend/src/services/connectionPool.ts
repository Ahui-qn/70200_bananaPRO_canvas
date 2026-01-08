/**
 * 数据库连接池管理器
 * 提供高效的数据库连接管理和复用
 */

import mysql from 'mysql2/promise';
import { DatabaseConfig } from '@shared/types';
import { createConnectionOptions } from '../utils/database';

// 连接池配置接口
interface PoolConfig {
  min: number;           // 最小连接数
  max: number;           // 最大连接数
  acquireTimeoutMillis: number;  // 获取连接超时时间
  createTimeoutMillis: number;   // 创建连接超时时间
  idleTimeoutMillis: number;     // 空闲连接超时时间
  reapIntervalMillis: number;    // 清理间隔时间
  createRetryIntervalMillis: number; // 重试间隔时间
}

// 连接池统计信息
interface PoolStats {
  totalConnections: number;      // 总连接数
  activeConnections: number;     // 活跃连接数
  idleConnections: number;       // 空闲连接数
  pendingRequests: number;       // 等待中的请求数
  totalRequests: number;         // 总请求数
  successfulRequests: number;    // 成功请求数
  failedRequests: number;        // 失败请求数
  averageAcquireTime: number;    // 平均获取连接时间
  peakConnections: number;       // 峰值连接数
}

// 连接包装器
interface PoolConnection {
  connection: mysql.Connection;
  id: string;
  createdAt: Date;
  lastUsedAt: Date;
  isActive: boolean;
  queryCount: number;
}

/**
 * 数据库连接池管理器
 */
export class ConnectionPool {
  private pool: mysql.Pool | null = null;
  private config: DatabaseConfig | null = null;
  private poolConfig: PoolConfig;
  private stats: PoolStats;
  private connections: Map<string, PoolConnection> = new Map();
  private cleanupTimer: NodeJS.Timeout | null = null;
  private isInitialized = false;

  constructor(poolConfig?: Partial<PoolConfig>) {
    this.poolConfig = {
      min: 2,                    // 最小2个连接
      max: 10,                   // 最大10个连接
      acquireTimeoutMillis: 30000,   // 30秒获取超时
      createTimeoutMillis: 30000,    // 30秒创建超时
      idleTimeoutMillis: 300000,     // 5分钟空闲超时
      reapIntervalMillis: 60000,     // 1分钟清理间隔
      createRetryIntervalMillis: 2000, // 2秒重试间隔
      ...poolConfig
    };

    this.stats = {
      totalConnections: 0,
      activeConnections: 0,
      idleConnections: 0,
      pendingRequests: 0,
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageAcquireTime: 0,
      peakConnections: 0
    };
  }

  /**
   * 初始化连接池
   */
  async initialize(config: DatabaseConfig): Promise<void> {
    if (this.isInitialized) {
      console.log('连接池已初始化');
      return;
    }

    try {
      console.log('初始化数据库连接池...');
      
      this.config = config;
      const connectionOptions = createConnectionOptions(config);
      
      // 创建连接池
      this.pool = mysql.createPool({
        ...connectionOptions,
        connectionLimit: this.poolConfig.max,
        timeout: this.poolConfig.createTimeoutMillis,
        queueLimit: 0, // 无限制队列
        reconnect: true,
        multipleStatements: false
      });

      // 测试连接池
      await this.testConnectionPool();
      
      // 启动清理定时器
      this.startCleanupTimer();
      
      this.isInitialized = true;
      console.log('数据库连接池初始化成功');

    } catch (error) {
      console.error('连接池初始化失败:', error);
      throw error;
    }
  }

  /**
   * 获取连接
   */
  async getConnection(): Promise<mysql.PoolConnection> {
    if (!this.pool) {
      throw new Error('连接池未初始化');
    }

    const startTime = Date.now();
    this.stats.totalRequests++;
    this.stats.pendingRequests++;

    try {
      console.log('获取数据库连接...');
      
      const connection = await this.pool.getConnection();
      
      const acquireTime = Date.now() - startTime;
      this.updateAcquireTime(acquireTime);
      
      this.stats.pendingRequests--;
      this.stats.successfulRequests++;
      this.stats.activeConnections++;
      
      // 更新峰值连接数
      if (this.stats.activeConnections > this.stats.peakConnections) {
        this.stats.peakConnections = this.stats.activeConnections;
      }
      
      console.log(`连接获取成功，耗时: ${acquireTime}ms`);
      
      // 包装连接以便统计
      return this.wrapConnection(connection);

    } catch (error) {
      this.stats.pendingRequests--;
      this.stats.failedRequests++;
      console.error('获取连接失败:', error);
      throw error;
    }
  }

  /**
   * 执行查询（自动管理连接）
   */
  async execute<T = any>(
    sql: string, 
    params?: any[]
  ): Promise<[T, mysql.FieldPacket[]]> {
    if (!this.pool) {
      throw new Error('连接池未初始化');
    }

    const startTime = Date.now();
    
    try {
      console.log('执行数据库查询:', sql.substring(0, 100) + '...');
      
      const result = await this.pool.execute(sql, params);
      
      const queryTime = Date.now() - startTime;
      console.log(`查询执行成功，耗时: ${queryTime}ms`);
      
      return result as [T, mysql.FieldPacket[]];

    } catch (error) {
      const queryTime = Date.now() - startTime;
      console.error(`查询执行失败，耗时: ${queryTime}ms`, error);
      throw error;
    }
  }

  /**
   * 执行事务
   */
  async executeTransaction<T>(
    callback: (connection: mysql.PoolConnection) => Promise<T>
  ): Promise<T> {
    const connection = await this.getConnection();
    
    try {
      await connection.beginTransaction();
      console.log('事务开始');
      
      const result = await callback(connection);
      
      await connection.commit();
      console.log('事务提交成功');
      
      return result;

    } catch (error) {
      await connection.rollback();
      console.log('事务回滚');
      throw error;
    } finally {
      connection.release();
      this.stats.activeConnections--;
    }
  }

  /**
   * 获取连接池统计信息
   */
  getStats(): PoolStats & {
    poolConfig: PoolConfig;
    isInitialized: boolean;
  } {
    // 更新实时统计
    if (this.pool) {
      // 注意：mysql2 连接池没有直接暴露这些统计信息
      // 这里我们使用自己维护的统计数据
      this.stats.totalConnections = this.stats.activeConnections + this.stats.idleConnections;
    }

    return {
      ...this.stats,
      poolConfig: this.poolConfig,
      isInitialized: this.isInitialized
    };
  }

  /**
   * 测试连接池健康状态
   */
  async healthCheck(): Promise<{
    healthy: boolean;
    latency: number;
    error?: string;
  }> {
    if (!this.pool) {
      return {
        healthy: false,
        latency: 0,
        error: '连接池未初始化'
      };
    }

    const startTime = Date.now();
    
    try {
      const [rows] = await this.execute('SELECT 1 as test');
      const latency = Date.now() - startTime;
      
      return {
        healthy: true,
        latency
      };
      
    } catch (error: any) {
      const latency = Date.now() - startTime;
      
      return {
        healthy: false,
        latency,
        error: error.message
      };
    }
  }

  /**
   * 测试连接池
   */
  private async testConnectionPool(): Promise<void> {
    if (!this.pool) {
      throw new Error('连接池未创建');
    }

    // 获取一个连接进行测试
    const connection = await this.pool.getConnection();
    try {
      await connection.ping();
      console.log('连接池测试成功');
    } finally {
      connection.release();
    }
  }

  /**
   * 启动清理定时器
   */
  private startCleanupTimer(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }

    this.cleanupTimer = setInterval(() => {
      this.performCleanup();
    }, this.poolConfig.reapIntervalMillis);

    console.log(`连接池清理定时器已启动，间隔: ${this.poolConfig.reapIntervalMillis}ms`);
  }

  /**
   * 执行连接池清理
   */
  private performCleanup(): void {
    // 更新空闲连接数统计
    this.stats.idleConnections = Math.max(0, this.stats.totalConnections - this.stats.activeConnections);
    
    console.log(`连接池清理完成 - 总连接: ${this.stats.totalConnections}, 活跃: ${this.stats.activeConnections}, 空闲: ${this.stats.idleConnections}`);
  }

  /**
   * 更新获取连接时间统计
   */
  private updateAcquireTime(acquireTime: number): void {
    const totalTime = this.stats.averageAcquireTime * (this.stats.successfulRequests - 1) + acquireTime;
    this.stats.averageAcquireTime = totalTime / this.stats.successfulRequests;
  }

  /**
   * 包装连接以便统计
   */
  private wrapConnection(connection: mysql.PoolConnection): mysql.PoolConnection {
    const originalRelease = connection.release.bind(connection);
    
    // 重写 release 方法以更新统计
    connection.release = () => {
      this.stats.activeConnections--;
      originalRelease();
    };

    return connection;
  }

  /**
   * 关闭连接池
   */
  async close(): Promise<void> {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }

    if (this.pool) {
      await this.pool.end();
      this.pool = null;
      console.log('连接池已关闭');
    }

    this.isInitialized = false;
  }
}
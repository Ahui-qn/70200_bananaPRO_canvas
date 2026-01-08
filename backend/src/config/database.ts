/**
 * 数据库配置管理
 * 处理环境变量和数据库连接配置
 */

import { DatabaseConfig, EnvironmentConfig } from '@shared/types';

/**
 * 从环境变量加载配置
 */
export function loadEnvironmentConfig(): EnvironmentConfig {
  // 在浏览器环境中，Vite 会自动处理以 VITE_ 开头的环境变量
  // 但我们需要在运行时访问这些配置，所以使用 import.meta.env
  return {
    API_KEY: import.meta.env.VITE_API_KEY || '',
    API_BASE_URL: import.meta.env.VITE_API_BASE_URL || '',
    
    DB_HOST: import.meta.env.VITE_DB_HOST || '',
    DB_PORT: import.meta.env.VITE_DB_PORT || '3306',
    DB_DATABASE: import.meta.env.VITE_DB_DATABASE || '',
    DB_USERNAME: import.meta.env.VITE_DB_USERNAME || '',
    DB_PASSWORD: import.meta.env.VITE_DB_PASSWORD || '',
    DB_SSL: import.meta.env.VITE_DB_SSL || 'true',
    
    ENCRYPTION_KEY: import.meta.env.VITE_ENCRYPTION_KEY || '',
    
    FC_ENDPOINT: import.meta.env.VITE_FC_ENDPOINT || '',
    FC_ACCESS_KEY_ID: import.meta.env.VITE_FC_ACCESS_KEY_ID || '',
    FC_ACCESS_KEY_SECRET: import.meta.env.VITE_FC_ACCESS_KEY_SECRET || '',
  };
}

/**
 * 创建默认数据库配置
 */
export function createDefaultDatabaseConfig(): DatabaseConfig {
  const env = loadEnvironmentConfig();
  
  return {
    host: env.DB_HOST || '',
    port: parseInt(env.DB_PORT || '3306', 10),
    database: env.DB_DATABASE || '',
    username: env.DB_USERNAME || '',
    password: env.DB_PASSWORD || '',
    ssl: env.DB_SSL === 'true',
    enabled: false, // 默认禁用，需要用户手动启用
  };
}

/**
 * 验证数据库配置的完整性
 */
export function validateDatabaseConfig(config: DatabaseConfig): string[] {
  const errors: string[] = [];
  
  if (!config.host.trim()) {
    errors.push('数据库主机地址不能为空');
  }
  
  if (!config.database.trim()) {
    errors.push('数据库名称不能为空');
  }
  
  if (!config.username.trim()) {
    errors.push('数据库用户名不能为空');
  }
  
  if (!config.password.trim()) {
    errors.push('数据库密码不能为空');
  }
  
  if (config.port <= 0 || config.port > 65535) {
    errors.push('数据库端口必须在 1-65535 范围内');
  }
  
  return errors;
}

/**
 * 生成数据库连接字符串（用于调试，不包含密码）
 */
export function getDatabaseConnectionString(config: DatabaseConfig, hideSensitive = true): string {
  const password = hideSensitive ? '***' : config.password;
  const ssl = config.ssl ? '?ssl=true' : '';
  
  return `mysql://${config.username}:${password}@${config.host}:${config.port}/${config.database}${ssl}`;
}

/**
 * 检查是否为生产环境
 */
export function isProduction(): boolean {
  return import.meta.env.PROD;
}

/**
 * 检查是否为开发环境
 */
export function isDevelopment(): boolean {
  return import.meta.env.DEV;
}

/**
 * 获取加密密钥
 */
export function getEncryptionKey(): string {
  const env = loadEnvironmentConfig();
  const key = env.ENCRYPTION_KEY;
  
  if (!key || key.length < 32) {
    console.warn('警告：加密密钥未设置或长度不足32位，将使用默认密钥（不安全）');
    return 'default-32-character-key-not-secure!!';
  }
  
  return key;
}

/**
 * 配置常量
 */
export const CONFIG_CONSTANTS = {
  // 数据库配置
  DEFAULT_DB_PORT: 3306,
  CONNECTION_TIMEOUT: 30000, // 30秒
  QUERY_TIMEOUT: 60000,      // 60秒
  
  // 分页配置
  DEFAULT_PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,
  
  // 重试配置
  MAX_RETRY_COUNT: 3,
  RETRY_DELAY_BASE: 1000,    // 1秒
  
  // 加密配置
  ENCRYPTION_ALGORITHM: 'aes-256-gcm',
  KEY_LENGTH: 32,
  IV_LENGTH: 16,
  
  // 云函数配置
  FUNCTION_TIMEOUT: 30000,   // 30秒
  
  // 缓存配置
  CACHE_TTL: 300000,         // 5分钟
} as const;
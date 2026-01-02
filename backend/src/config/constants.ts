/**
 * 应用常量定义
 * 包含数据库、API、加密等相关常量
 */

// 数据库表名
export const TABLE_NAMES = {
  USERS: 'users',
  IMAGES: 'images',
  USER_CONFIGS: 'user_configs', 
  OPERATION_LOGS: 'operation_logs',
} as const;

// 数据库字段名
export const FIELD_NAMES = {
  // 通用字段
  ID: 'id',
  CREATED_AT: 'created_at',
  UPDATED_AT: 'updated_at',
  
  // images 表字段
  URL: 'url',
  ORIGINAL_URL: 'original_url',
  PROMPT: 'prompt',
  MODEL: 'model',
  ASPECT_RATIO: 'aspect_ratio',
  IMAGE_SIZE: 'image_size',
  REF_IMAGES: 'ref_images',
  TAGS: 'tags',
  FAVORITE: 'favorite',
  OSS_KEY: 'oss_key',
  OSS_UPLOADED: 'oss_uploaded',
  USER_ID: 'user_id',
  
  // user_configs 表字段
  API_CONFIG: 'api_config',
  OSS_CONFIG: 'oss_config',
  PREFERENCES: 'preferences',
  
  // operation_logs 表字段
  OPERATION: 'operation',
  TABLE_NAME: 'table_name',
  RECORD_ID: 'record_id',
  STATUS: 'status',
  ERROR_MESSAGE: 'error_message',
  DURATION: 'duration',
} as const;

// 操作类型
export const OPERATION_TYPES = {
  INSERT: 'INSERT',
  UPDATE: 'UPDATE',
  DELETE: 'DELETE',
  SELECT: 'SELECT',
  CONNECT: 'CONNECT',
  DISCONNECT: 'DISCONNECT',
} as const;

// 操作状态
export const OPERATION_STATUS = {
  SUCCESS: 'SUCCESS',
  FAILED: 'FAILED',
} as const;

// 数据库错误代码
export const DB_ERROR_CODES = {
  ACCESS_DENIED: 'ER_ACCESS_DENIED_ERROR',
  BAD_DB_ERROR: 'ER_BAD_DB_ERROR',
  CONNECTION_REFUSED: 'ECONNREFUSED',
  TIMEOUT: 'ETIMEDOUT',
  DUPLICATE_ENTRY: 'ER_DUP_ENTRY',
  TABLE_NOT_EXISTS: 'ER_NO_SUCH_TABLE',
  COLUMN_NOT_EXISTS: 'ER_BAD_FIELD_ERROR',
} as const;

// 支持的图片模型
export const SUPPORTED_MODELS = [
  'nano-banana-fast',
  'nano-banana-hd',
  'nano-banana-ultra',
] as const;

// 支持的图片比例
export const SUPPORTED_ASPECT_RATIOS = [
  'auto',
  '1:1',
  '4:3',
  '3:4',
  '16:9',
  '9:16',
] as const;

// 支持的图片尺寸
export const SUPPORTED_IMAGE_SIZES = [
  '1K',
  '2K',
  '4K',
] as const;

// 默认配置值
export const DEFAULT_VALUES = {
  // 分页
  PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,
  
  // 超时时间（毫秒）
  CONNECTION_TIMEOUT: 30000,
  QUERY_TIMEOUT: 60000,
  API_TIMEOUT: 30000,
  
  // 重试配置
  MAX_RETRY_COUNT: 3,
  RETRY_DELAY: 1000,
  
  // 用户ID（单用户应用）
  DEFAULT_USER_ID: 'default',
  
  // 图片配置
  DEFAULT_MODEL: 'nano-banana-fast',
  DEFAULT_ASPECT_RATIO: 'auto',
  DEFAULT_IMAGE_SIZE: '1K',
  
  // 缓存时间（毫秒）
  CACHE_TTL: 300000, // 5分钟
} as const;

// SQL 语句模板
export const SQL_TEMPLATES = {
  // 创建 images 表
  CREATE_IMAGES_TABLE: `
    CREATE TABLE IF NOT EXISTS images (
      id VARCHAR(50) PRIMARY KEY,
      url TEXT NOT NULL,
      original_url TEXT,
      prompt TEXT NOT NULL,
      model VARCHAR(100) NOT NULL,
      aspect_ratio VARCHAR(20) DEFAULT 'auto',
      image_size VARCHAR(10) DEFAULT '1K',
      ref_images JSON,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      tags JSON,
      favorite BOOLEAN DEFAULT FALSE,
      oss_key TEXT,
      oss_uploaded BOOLEAN DEFAULT FALSE,
      user_id VARCHAR(50) DEFAULT 'default',
      
      INDEX idx_created_at (created_at),
      INDEX idx_model (model),
      INDEX idx_favorite (favorite),
      INDEX idx_user_id (user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `,
  
  // 创建 user_configs 表
  CREATE_USER_CONFIGS_TABLE: `
    CREATE TABLE IF NOT EXISTS user_configs (
      user_id VARCHAR(50) PRIMARY KEY,
      api_config JSON,
      oss_config JSON,
      preferences JSON,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `,
  
  // 创建 operation_logs 表
  CREATE_OPERATION_LOGS_TABLE: `
    CREATE TABLE IF NOT EXISTS operation_logs (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      operation VARCHAR(50) NOT NULL,
      table_name VARCHAR(50) NOT NULL,
      record_id VARCHAR(50),
      user_id VARCHAR(50) DEFAULT 'default',
      status ENUM('SUCCESS', 'FAILED') DEFAULT 'SUCCESS',
      error_message TEXT,
      duration INT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      
      INDEX idx_created_at (created_at),
      INDEX idx_operation (operation),
      INDEX idx_user_id (user_id),
      INDEX idx_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `,
} as const;

// 验证规则
export const VALIDATION_RULES = {
  // 字符串长度限制
  MAX_PROMPT_LENGTH: 2000,
  MAX_URL_LENGTH: 2048,
  MAX_MODEL_NAME_LENGTH: 100,
  MAX_TAG_LENGTH: 50,
  MAX_TAGS_COUNT: 20,
  
  // 数据库配置验证
  MIN_PORT: 1,
  MAX_PORT: 65535,
  MIN_PASSWORD_LENGTH: 6,
  
  // 加密密钥长度
  ENCRYPTION_KEY_LENGTH: 32,
  
  // 文件大小限制（字节）
  MAX_IMAGE_SIZE: 10 * 1024 * 1024, // 10MB
  MAX_REF_IMAGES_COUNT: 14,
} as const;

// 错误消息
export const ERROR_MESSAGES = {
  // 数据库连接错误
  DB_CONNECTION_FAILED: '数据库连接失败',
  DB_ACCESS_DENIED: '数据库访问被拒绝，请检查用户名和密码',
  DB_NOT_FOUND: '数据库不存在，请检查数据库名称',
  DB_CONNECTION_REFUSED: '无法连接到数据库服务器，请检查主机地址和端口',
  DB_TIMEOUT: '数据库连接超时，请检查网络连接',
  
  // 数据验证错误
  INVALID_CONFIG: '配置信息无效',
  MISSING_REQUIRED_FIELD: '缺少必填字段',
  INVALID_DATA_FORMAT: '数据格式无效',
  
  // 操作错误
  OPERATION_FAILED: '操作失败',
  RECORD_NOT_FOUND: '记录不存在',
  DUPLICATE_RECORD: '记录已存在',
  
  // 网络错误
  NETWORK_ERROR: '网络连接错误',
  REQUEST_TIMEOUT: '请求超时',
  
  // 加密错误
  ENCRYPTION_FAILED: '数据加密失败',
  DECRYPTION_FAILED: '数据解密失败',
  INVALID_ENCRYPTION_KEY: '加密密钥无效',
} as const;
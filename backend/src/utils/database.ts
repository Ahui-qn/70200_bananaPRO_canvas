/**
 * 数据库工具函数
 * 提供数据库操作相关的辅助函数
 */

import { DatabaseConfig, SavedImage, PaginationOptions, PaginatedResult } from '@shared/types';
import { DEFAULT_VALUES, VALIDATION_RULES, ERROR_MESSAGES } from '../config/constants';

/**
 * 生成唯一ID
 */
export function generateId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2);
  return `${timestamp}_${random}`;
}

/**
 * 验证分页参数
 */
export function validatePaginationOptions(options: Partial<PaginationOptions>): PaginationOptions {
  const page = Math.max(1, options.page || 1);
  const pageSize = Math.min(
    DEFAULT_VALUES.MAX_PAGE_SIZE,
    Math.max(1, options.pageSize || DEFAULT_VALUES.PAGE_SIZE)
  );
  
  return {
    page,
    pageSize,
    sortBy: options.sortBy || 'created_at',
    sortOrder: options.sortOrder || 'DESC',
    filters: options.filters || {},
  };
}

/**
 * 创建分页结果对象
 */
export function createPaginatedResult<T>(
  data: T[],
  total: number,
  page: number,
  pageSize: number
): PaginatedResult<T> {
  const totalPages = Math.ceil(total / pageSize);
  
  return {
    data,
    total,
    page,
    pageSize,
    totalPages,
    hasNext: page < totalPages,
    hasPrev: page > 1,
  };
}

/**
 * 验证图片数据
 */
export function validateImageData(image: Partial<SavedImage>): string[] {
  const errors: string[] = [];
  
  if (!image.url?.trim()) {
    errors.push('图片URL不能为空');
  } else if (image.url.length > VALIDATION_RULES.MAX_URL_LENGTH) {
    errors.push(`图片URL长度不能超过${VALIDATION_RULES.MAX_URL_LENGTH}字符`);
  }
  
  if (!image.prompt?.trim()) {
    errors.push('提示词不能为空');
  } else if (image.prompt.length > VALIDATION_RULES.MAX_PROMPT_LENGTH) {
    errors.push(`提示词长度不能超过${VALIDATION_RULES.MAX_PROMPT_LENGTH}字符`);
  }
  
  if (!image.model?.trim()) {
    errors.push('模型名称不能为空');
  } else if (image.model.length > VALIDATION_RULES.MAX_MODEL_NAME_LENGTH) {
    errors.push(`模型名称长度不能超过${VALIDATION_RULES.MAX_MODEL_NAME_LENGTH}字符`);
  }
  
  // 验证标签
  if (image.tags) {
    if (image.tags.length > VALIDATION_RULES.MAX_TAGS_COUNT) {
      errors.push(`标签数量不能超过${VALIDATION_RULES.MAX_TAGS_COUNT}个`);
    }
    
    for (const tag of image.tags) {
      if (tag.length > VALIDATION_RULES.MAX_TAG_LENGTH) {
        errors.push(`标签"${tag}"长度不能超过${VALIDATION_RULES.MAX_TAG_LENGTH}字符`);
      }
    }
  }
  
  return errors;
}

/**
 * 清理图片数据（移除无效字段）
 */
export function sanitizeImageData(image: Partial<SavedImage>): Partial<SavedImage> {
  const sanitized: Partial<SavedImage> = {};
  
  // 复制有效字段
  if (image.id) sanitized.id = image.id.trim();
  if (image.url) sanitized.url = image.url.trim();
  if (image.originalUrl) sanitized.originalUrl = image.originalUrl.trim();
  if (image.prompt) sanitized.prompt = image.prompt.trim();
  if (image.model) sanitized.model = image.model.trim();
  if (image.aspectRatio) sanitized.aspectRatio = image.aspectRatio;
  if (image.imageSize) sanitized.imageSize = image.imageSize;
  if (image.refImages) sanitized.refImages = image.refImages;
  if (image.createdAt) sanitized.createdAt = image.createdAt;
  if (image.tags) sanitized.tags = image.tags.filter(tag => tag.trim().length > 0);
  if (typeof image.favorite === 'boolean') sanitized.favorite = image.favorite;
  if (image.ossKey) sanitized.ossKey = image.ossKey.trim();
  if (typeof image.ossUploaded === 'boolean') sanitized.ossUploaded = image.ossUploaded;
  
  return sanitized;
}

/**
 * 构建 WHERE 子句
 */
export function buildWhereClause(filters: Record<string, any>): { clause: string; params: any[] } {
  const conditions: string[] = [];
  const params: any[] = [];
  
  for (const [key, value] of Object.entries(filters)) {
    if (value === null || value === undefined) continue;
    
    switch (key) {
      case 'model':
        conditions.push('model = ?');
        params.push(value);
        break;
        
      case 'favorite':
        conditions.push('favorite = ?');
        params.push(Boolean(value));
        break;
        
      case 'ossUploaded':
        conditions.push('oss_uploaded = ?');
        params.push(Boolean(value));
        break;
        
      case 'dateFrom':
        conditions.push('created_at >= ?');
        params.push(value);
        break;
        
      case 'dateTo':
        conditions.push('created_at <= ?');
        params.push(value);
        break;
        
      case 'search':
        conditions.push('(prompt LIKE ? OR tags LIKE ?)');
        const searchTerm = `%${value}%`;
        params.push(searchTerm, searchTerm);
        break;
        
      default:
        // 忽略未知的筛选条件
        break;
    }
  }
  
  const clause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  return { clause, params };
}

/**
 * 构建 ORDER BY 子句
 */
export function buildOrderByClause(sortBy: string, sortOrder: 'ASC' | 'DESC'): string {
  // 验证排序字段，防止 SQL 注入
  const allowedSortFields = [
    'id', 'created_at', 'updated_at', 'model', 'favorite', 'oss_uploaded'
  ];
  
  if (!allowedSortFields.includes(sortBy)) {
    sortBy = 'created_at';
  }
  
  const order = sortOrder === 'ASC' ? 'ASC' : 'DESC';
  return `ORDER BY ${sortBy} ${order}`;
}

/**
 * 构建 LIMIT 子句
 */
export function buildLimitClause(page: number, pageSize: number): { clause: string; params: number[] } {
  const offset = (page - 1) * pageSize;
  return {
    clause: 'LIMIT ? OFFSET ?',
    params: [pageSize, offset],
  };
}

/**
 * 格式化数据库错误消息
 */
export function formatDatabaseError(error: any): string {
  if (!error) return ERROR_MESSAGES.OPERATION_FAILED;
  
  // 根据错误代码返回友好的错误消息
  switch (error.code) {
    case 'ER_ACCESS_DENIED_ERROR':
      return ERROR_MESSAGES.DB_ACCESS_DENIED;
    case 'ER_BAD_DB_ERROR':
      return ERROR_MESSAGES.DB_NOT_FOUND;
    case 'ECONNREFUSED':
      return ERROR_MESSAGES.DB_CONNECTION_REFUSED;
    case 'ETIMEDOUT':
      return ERROR_MESSAGES.DB_TIMEOUT;
    case 'ER_DUP_ENTRY':
      return ERROR_MESSAGES.DUPLICATE_RECORD;
    case 'ER_NO_SUCH_TABLE':
      return '数据表不存在，请先初始化数据库';
    case 'ER_BAD_FIELD_ERROR':
      return '数据字段错误，请检查数据格式';
    default:
      return error.message || ERROR_MESSAGES.OPERATION_FAILED;
  }
}

/**
 * 检查数据库连接配置是否完整
 */
export function isDatabaseConfigComplete(config: DatabaseConfig): boolean {
  return !!(
    config.host?.trim() &&
    config.database?.trim() &&
    config.username?.trim() &&
    config.password?.trim() &&
    config.port > 0
  );
}

/**
 * 创建数据库连接选项
 */
export function createConnectionOptions(config: DatabaseConfig) {
  return {
    host: config.host,
    port: config.port,
    user: config.username,
    password: config.password,
    database: config.database,
    ssl: config.ssl ? { rejectUnauthorized: false } : undefined,
    connectTimeout: DEFAULT_VALUES.CONNECTION_TIMEOUT,
    acquireTimeout: DEFAULT_VALUES.CONNECTION_TIMEOUT,
    timeout: DEFAULT_VALUES.QUERY_TIMEOUT,
    charset: 'utf8mb4',
    timezone: '+08:00', // 中国时区
  };
}

/**
 * 转换数据库行为 SavedImage 对象
 */
export function rowToSavedImage(row: any): SavedImage {
  return {
    id: row.id,
    url: row.url,
    originalUrl: row.original_url || undefined,
    prompt: row.prompt,
    model: row.model,
    aspectRatio: row.aspect_ratio || 'auto',
    imageSize: row.image_size || '1K',
    refImages: row.ref_images ? JSON.parse(row.ref_images) : undefined,
    createdAt: new Date(row.created_at),
    tags: row.tags ? JSON.parse(row.tags) : undefined,
    favorite: Boolean(row.favorite),
    ossKey: row.oss_key || undefined,
    ossUploaded: Boolean(row.oss_uploaded),
  };
}

/**
 * 转换 SavedImage 对象为数据库行
 */
export function savedImageToRow(image: SavedImage): any {
  return {
    id: image.id,
    url: image.url,
    original_url: image.originalUrl || null,
    prompt: image.prompt,
    model: image.model,
    aspect_ratio: image.aspectRatio || 'auto',
    image_size: image.imageSize || '1K',
    ref_images: image.refImages ? JSON.stringify(image.refImages) : null,
    created_at: image.createdAt,
    updated_at: new Date(),
    tags: image.tags ? JSON.stringify(image.tags) : null,
    favorite: Boolean(image.favorite),
    oss_key: image.ossKey || null,
    oss_uploaded: Boolean(image.ossUploaded),
    user_id: DEFAULT_VALUES.DEFAULT_USER_ID,
  };
}

/**
 * 延迟函数（用于重试机制）
 */
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 计算指数退避延迟时间
 */
export function calculateBackoffDelay(attempt: number, baseDelay = DEFAULT_VALUES.RETRY_DELAY): number {
  return Math.min(baseDelay * Math.pow(2, attempt - 1), 30000); // 最大30秒
}
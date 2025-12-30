// API Request Types
export interface NanoBananaRequest {
  model: string;                    // 必填：支持的模型名称
  prompt: string;                   // 必填：提示词
  urls?: string[];                  // 选填：参考图URL或Base64
  aspectRatio?: string;             // 选填：输出图像比例
  imageSize?: string;               // 选填：输出图像大小
  webHook?: string;                 // 选填：回调链接，"-1"表示立即返回ID
  shutProgress?: boolean;           // 选填：关闭进度回复
}

export interface NanoBananaCreateResponse {
  code: number;                     // 状态码：0为成功
  msg: string;                      // 状态信息
  data: {
    id: string;                     // 程序任务ID
  };
}

// API Result Polling Types
export interface NanoBananaResultRequest {
  id: string;                       // 任务ID
}

export interface ImageResult {
  url: string;                      // 图片URL（有效期2小时）
  content: string;                  // 回复内容
}

export interface NanoBananaResultData {
  id: string;                       // 任务ID
  results: ImageResult[];           // 结果数组
  progress: number;                 // 任务进度 0~100
  status: string;                   // 任务状态：running/succeeded/failed
  failure_reason?: string;          // 失败原因
  error?: string;                   // 失败详细信息
}

export interface NanoBananaResultResponse {
  code: number;                     // 状态码：0成功，-22任务不存在
  msg: string;                      // 状态信息
  data: NanoBananaResultData;       // 绘画结果数据
}

// Application State Types
export enum AppStatus {
  IDLE = 'IDLE',
  SUBMITTING = 'SUBMITTING',
  POLLING = 'POLLING',
  SUCCESS = 'SUCCESS',
  ERROR = 'ERROR'
}

// API 配置信息
export interface ApiConfig {
  apiKey: string;                   // API 密钥
  baseUrl: string;                  // API 基础地址
  timeout: number;                  // 请求超时时间（毫秒）
  retryCount: number;               // 重试次数
  provider: string;                 // 服务提供商名称
}

export interface GenerationSettings {
  model: string;                    // 模型名称
  prompt: string;                   // 提示词
  aspectRatio: string;              // 图像比例
  imageSize: string;                // 图像大小
  refImageUrl: string;              // 参考图片URL（UI辅助字段，已废弃）
  refImages: UploadedImage[];       // 参考图片列表（最多14张）
}

// 上传的图片信息
export interface UploadedImage {
  id: string;                       // 唯一标识符
  file: File;                       // 原始文件
  preview: string;                  // 预览URL（blob URL）
  base64?: string;                  // Base64编码（用于API调用）
  name: string;                     // 文件名
  size: number;                     // 文件大小（字节）
}

// 保存的图片记录
export interface SavedImage {
  id: string;                       // 唯一标识符
  url: string;                      // 图片URL
  originalUrl?: string;             // 原始URL（OSS上传前的临时URL）
  thumbnail?: string;               // 缩略图（可选）
  prompt: string;                   // 生成提示词
  model: string;                    // 使用的模型
  aspectRatio: string;              // 图像比例
  imageSize: string;                // 图像尺寸
  refImages?: UploadedImage[];      // 参考图片
  createdAt: Date;                  // 创建时间
  tags?: string[];                  // 标签
  favorite?: boolean;               // 是否收藏
  ossKey?: string;                  // OSS 对象键名（如果上传到了OSS）
  ossUploaded?: boolean;            // 是否已上传到OSS
}

// 图片库状态
export interface ImageLibrary {
  images: SavedImage[];             // 图片列表
  totalCount: number;               // 总数量
  lastUpdated: Date;                // 最后更新时间
}

// 数据库配置信息
export interface DatabaseConfig {
  host: string;                     // 数据库主机地址
  port: number;                     // 端口
  database: string;                 // 数据库名称
  username: string;                 // 用户名
  password: string;                 // 密码
  ssl?: boolean;                    // 是否使用 SSL
  enabled: boolean;                 // 是否启用数据库同步
}

// OSS 配置信息
export interface OSSConfig {
  accessKeyId: string;              // 访问密钥 ID
  accessKeySecret: string;          // 访问密钥 Secret
  region: string;                   // 地域
  bucket: string;                   // 存储桶名称
  endpoint?: string;                // 自定义域名
  secure?: boolean;                 // 是否使用 HTTPS
  pathStyle?: boolean;              // 是否使用路径样式
  enabled: boolean;                 // 是否启用 OSS 存储
}

// 数据库连接状态
export interface ConnectionStatus {
  isConnected: boolean;             // 是否已连接
  lastConnected: Date | null;       // 最后连接时间
  error: string | null;             // 错误信息
  latency?: number;                 // 连接延迟（毫秒）
}

// 分页选项
export interface PaginationOptions {
  page: number;                     // 页码（从1开始）
  pageSize: number;                 // 每页大小
  sortBy?: string;                  // 排序字段
  sortOrder?: 'ASC' | 'DESC';       // 排序方向
  filters?: Record<string, any>;    // 筛选条件
}

// 分页结果
export interface PaginatedResult<T> {
  data: T[];                        // 数据列表
  total: number;                    // 总记录数
  page: number;                     // 当前页码
  pageSize: number;                 // 每页大小
  totalPages: number;               // 总页数
  hasNext: boolean;                 // 是否有下一页
  hasPrev: boolean;                 // 是否有上一页
}

// 云函数调用结果
export interface CloudFunctionResult<T = any> {
  success: boolean;                 // 是否成功
  data?: T;                         // 返回数据
  error?: string;                   // 错误信息
  message?: string;                 // 消息
  code?: number;                    // 错误代码
}

// 数据库操作日志
export interface OperationLog {
  id: string;                       // 日志ID
  operation: string;                // 操作类型（INSERT, UPDATE, DELETE, SELECT）
  tableName: string;                // 表名
  recordId?: string;                // 记录ID
  userId: string;                   // 用户ID
  status: 'SUCCESS' | 'FAILED';     // 操作状态
  errorMessage?: string;            // 错误信息
  createdAt: Date;                  // 创建时间
  duration?: number;                // 操作耗时（毫秒）
}

// 数据库错误类型
export interface DatabaseError extends Error {
  code: string;                     // 错误代码
  sqlState?: string;                // SQL状态码
  errno?: number;                   // 错误号
  sql?: string;                     // 执行的SQL语句
}

// 加密服务接口
export interface EncryptionService {
  encrypt(data: string, key?: string): string;
  decrypt(encryptedData: string, key?: string): string;
  generateKey(): string;
  hashPassword(password: string): string;
  verifyPassword(password: string, hash: string): boolean;
}

// 数据库服务接口
export interface DatabaseService {
  // 连接管理
  connect(config: DatabaseConfig): Promise<boolean>;
  disconnect(): Promise<void>;
  testConnection(): Promise<boolean>;
  getConnectionStatus(): ConnectionStatus;
  
  // 图片数据操作
  saveImage(image: SavedImage): Promise<SavedImage>;
  getImages(pagination: PaginationOptions): Promise<PaginatedResult<SavedImage>>;
  updateImage(id: string, updates: Partial<SavedImage>): Promise<SavedImage>;
  deleteImage(id: string, cascadeDelete?: boolean): Promise<void>;
  deleteImages(ids: string[], cascadeDelete?: boolean): Promise<{ 
    successful: string[], 
    failed: { id: string, error: string }[] 
  }>;
  
  // 配置管理
  saveApiConfig(config: ApiConfig): Promise<void>;
  getApiConfig(): Promise<ApiConfig | null>;
  saveOSSConfig(config: OSSConfig): Promise<void>;
  getOSSConfig(): Promise<OSSConfig | null>;
  deleteApiConfig(requireConfirmation?: boolean): Promise<void>;
  deleteOSSConfig(requireConfirmation?: boolean): Promise<void>;
  deleteAllConfigs(requireConfirmation?: boolean): Promise<void>;
  clearUserData(requireConfirmation?: boolean): Promise<void>;
  
  // 表结构管理
  initializeTables(): Promise<void>;
  migrateSchema(version: string): Promise<void>;
}

// 云函数API接口
export interface CloudFunctionAPI {
  callFunction<T>(functionName: string, params: any): Promise<CloudFunctionResult<T>>;
  
  // 具体函数调用
  testConnection(config: DatabaseConfig): Promise<boolean>;
  initTables(config: DatabaseConfig): Promise<void>;
  saveImage(config: DatabaseConfig, image: SavedImage): Promise<SavedImage>;
  getImages(config: DatabaseConfig, pagination: PaginationOptions): Promise<SavedImage[]>;
  updateImage(config: DatabaseConfig, id: string, updates: Partial<SavedImage>): Promise<void>;
  deleteImage(config: DatabaseConfig, id: string): Promise<void>;
  saveConfig(config: DatabaseConfig, type: 'api' | 'oss', data: any): Promise<void>;
  getConfig(config: DatabaseConfig, type: 'api' | 'oss'): Promise<any>;
}

// 网络错误处理器
export interface NetworkErrorHandler {
  executeWithRetry<T>(operation: () => Promise<T>): Promise<T>;
  shouldRetry(error: any): boolean;
}

// 数据库错误处理器
export interface DatabaseErrorHandler {
  handleError(error: any, context?: {
    operation?: string;
    tableName?: string;
    recordId?: string;
    sql?: string;
  }): DatabaseError;
  isRetryable(error: any): boolean;
  getSuggestions(error: any): string[];
  formatUserMessage(error: any): string;
  getErrorLog(limit?: number): OperationLog[];
  clearErrorLog(): void;
  getErrorStats(): {
    total: number;
    byType: Record<string, number>;
    byCode: Record<string, number>;
    recent: number;
  };
}

// 环境变量类型
export interface EnvironmentConfig {
  // API 配置
  API_KEY?: string;
  API_BASE_URL?: string;
  
  // 数据库配置
  DB_HOST?: string;
  DB_PORT?: string;
  DB_DATABASE?: string;
  DB_USERNAME?: string;
  DB_PASSWORD?: string;
  DB_SSL?: string;
  
  // 加密配置
  ENCRYPTION_KEY?: string;
  
  // 云函数配置
  FC_ENDPOINT?: string;
  FC_ACCESS_KEY_ID?: string;
  FC_ACCESS_KEY_SECRET?: string;
}

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

// 数据库版本管理相关类型
export interface DatabaseVersion {
  version: string;                    // 版本号（如 "1.0.0"）
  description: string;                // 版本描述
  releaseDate: Date;                  // 发布日期
  scripts: MigrationScript[];         // 迁移脚本列表
  rollbackScripts?: MigrationScript[]; // 回滚脚本列表（可选）
}

export interface MigrationScript {
  id: string;                         // 脚本唯一标识符
  name: string;                       // 脚本名称
  description: string;                // 脚本描述
  sql: string;                        // SQL 语句
  checksum?: string;                  // 脚本校验和
  executionOrder: number;             // 执行顺序
}

export interface MigrationResult {
  success: boolean;                   // 是否成功
  version: string;                    // 目标版本
  executedScripts: string[];          // 已执行的脚本ID列表
  failedScript?: string;              // 失败的脚本ID
  error?: string;                     // 错误信息
  duration: number;                   // 执行耗时（毫秒）
  rollbackAvailable: boolean;         // 是否支持回滚
}

export interface VersionComparison {
  current: string;                    // 当前版本
  target: string;                     // 目标版本
  needsUpgrade: boolean;              // 是否需要升级
  needsDowngrade: boolean;            // 是否需要降级
  migrationPath: string[];            // 迁移路径（版本列表）
}

// 数据库服务接口
export interface DatabaseService {
  // 连接管理
  connect(config: DatabaseConfig): Promise<boolean>;
  disconnect(): Promise<void>;
  testConnection(): Promise<boolean>;
  getConnectionStatus(): ConnectionStatus;
  
  // 连接状态监控
  startConnectionMonitoring(): void;
  stopConnectionMonitoring(): void;
  addConnectionStatusListener(listener: any): void;
  removeConnectionStatusListener(listener: any): void;
  getConnectionQualityStats(): any;
  getConnectionStatusHistory(limit?: number): any[];
  getCurrentConnectionQuality(): any;
  triggerConnectionTest(): Promise<any>;
  setConnectionMonitoringInterval(intervalMs: number): void;
  getConnectionMonitoringStatus(): any;
  resetConnectionQualityStats(): void;
  clearConnectionStatusHistory(): void;
  
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
  
  // 统计和分析功能
  getImageStatistics(filter?: StatisticsFilter): Promise<ImageStatistics>;
  getDatabaseStatistics(filter?: StatisticsFilter): Promise<DatabaseStatistics>;
  getOperationLogs(pagination: PaginationOptions): Promise<PaginatedResult<OperationLog>>;
  
  // 表结构管理
  initializeTables(): Promise<void>;
  migrateSchema(version: string): Promise<MigrationResult>;
  
  // 数据库版本管理
  getCurrentDatabaseVersion(): Promise<string | null>;
  getVersionComparison(targetVersion: string): Promise<VersionComparison>;
  rollbackToVersion(version: string): Promise<MigrationResult>;
  getAvailableVersions(): DatabaseVersion[];
  getLatestVersion(): string;
  getMigrationHistory(limit?: number): Promise<any[]>;
  validateDatabaseIntegrity(): Promise<{
    valid: boolean;
    issues: string[];
    recommendations: string[];
  }>;
  cleanupMigrationLogs(daysToKeep?: number): Promise<number>;
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

// 数据统计接口
export interface ImageStatistics {
  totalImages: number;                  // 图片总数
  favoriteImages: number;               // 收藏图片数
  uploadedToOSS: number;                // 已上传到OSS的图片数
  pendingOSSUpload: number;             // 待上传到OSS的图片数
  byModel: Record<string, number>;      // 按模型分组统计
  byTimeRange: {
    today: number;                      // 今日新增
    thisWeek: number;                   // 本周新增
    thisMonth: number;                  // 本月新增
    thisYear: number;                   // 本年新增
  };
  byStatus: {
    favorite: number;                   // 收藏状态
    uploaded: number;                   // 上传状态
    pending: number;                    // 待处理状态
  };
}

export interface DatabaseStatistics {
  images: ImageStatistics;              // 图片统计
  operations: {
    totalOperations: number;            // 总操作数
    successfulOperations: number;       // 成功操作数
    failedOperations: number;           // 失败操作数
    recentOperations: number;           // 最近1小时操作数
    byOperation: Record<string, number>; // 按操作类型统计
  };
  storage: {
    totalSize: number;                  // 总存储大小（估算）
    averageImageSize: number;           // 平均图片大小
    largestImage: number;               // 最大图片大小
  };
  performance: {
    averageResponseTime: number;        // 平均响应时间
    slowestOperation: number;           // 最慢操作时间
    fastestOperation: number;           // 最快操作时间
  };
}

export interface StatisticsFilter {
  dateRange?: {
    start: Date;
    end: Date;
  };
  models?: string[];                    // 筛选特定模型
  favorite?: boolean;                   // 筛选收藏状态
  ossUploaded?: boolean;                // 筛选上传状态
  userId?: string;                      // 筛选用户（默认为'default'）
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

// 共享类型定义 - 前后端通用

// API 响应基础类型
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// 分页响应类型
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

// 应用状态类型
export enum AppStatus {
  IDLE = 'IDLE',
  SUBMITTING = 'SUBMITTING',
  POLLING = 'POLLING',
  SUCCESS = 'SUCCESS',
  ERROR = 'ERROR'
}

// 生成设置
export interface GenerationSettings {
  model: string;
  prompt: string;
  aspectRatio: string;
  imageSize: string;
  refImageUrl: string;
  refImages: UploadedImage[];
}

// 上传的图片
export interface UploadedImage {
  id: string;
  file: File;
  base64?: string;
  preview: string;
  name: string;
  size: number;
}

// API 配置
export interface ApiConfig {
  apiKey: string;
  baseUrl: string;
  timeout: number;
  retryCount: number;
  provider: string;
}

// 数据库配置
export interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  ssl: boolean;
  enabled: boolean;
}

// OSS 配置
export interface OSSConfig {
  region: string;
  bucket: string;
  accessKeyId: string;
  accessKeySecret: string;
  endpoint: string;
  customDomain?: string;
  enabled: boolean;
}

// 保存的图片
export interface SavedImage {
  id: string;
  url: string;
  originalUrl?: string;
  prompt: string;
  model: string;
  aspectRatio: string;
  imageSize: string;
  refImages?: UploadedImage[];
  createdAt: Date;
  updatedAt?: Date;
  tags?: string[];
  favorite: boolean;
  ossKey?: string;
  ossUploaded: boolean;
  userId?: string;
}

// 图片结果
export interface ImageResult {
  url: string;
  content: string;
}

// Nano Banana API 结果
export interface NanoBananaResultData {
  id: string;
  results: ImageResult[];
  progress: number;
  status: string;
  failure_reason?: string;
  error?: string;
}

// Nano Banana API 请求参数
export interface NanoBananaRequest {
  model: string;
  prompt: string;
  urls?: string[];           // 参考图 URL 或 Base64
  aspectRatio?: string;      // 输出图像比例
  imageSize?: string;        // 输出图像大小：1K, 2K, 4K
  webHook?: string;          // 回调链接，"-1" 表示立即返回 ID
  shutProgress?: boolean;    // 关闭进度回复
}

// Nano Banana 创建任务响应
export interface NanoBananaCreateResponse {
  code: number;
  msg: string;
  data: {
    id: string;
  };
}

// Nano Banana 获取结果响应
export interface NanoBananaResultResponse {
  code: number;
  msg: string;
  data: NanoBananaResultData;
}

// 统计信息
export interface ImageStatistics {
  totalImages: number;
  favoriteImages: number;
  modelStats: Record<string, number>;
  recentImages: number;
  ossUploadedImages: number;
}

// 数据库统计
export interface DatabaseStatistics {
  connectionStatus: 'connected' | 'disconnected' | 'error';
  totalRecords: number;
  lastBackup?: Date;
  storageSize?: number;
}

// 操作日志
export interface OperationLog {
  id: string;
  operation: string;
  tableName: string;
  recordId?: string;
  userId: string;
  status: 'SUCCESS' | 'FAILED';
  errorMessage?: string;
  duration?: number;
  createdAt: Date;
}

// API 请求类型
export interface CreateImageRequest {
  model: string;
  prompt: string;
  aspectRatio?: string;
  imageSize?: string;
  refImages?: string[]; // Base64 图片数据
}

export interface UpdateImageRequest {
  favorite?: boolean;
  tags?: string[];
}

export interface GetImagesRequest {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
  filters?: {
    model?: string;
    favorite?: boolean;
    dateFrom?: string;
    dateTo?: string;
    search?: string;
  };
}

// 配置相关请求
export interface SaveConfigRequest {
  apiConfig?: ApiConfig;
  databaseConfig?: DatabaseConfig;
  ossConfig?: OSSConfig;
}

export interface TestConnectionRequest {
  databaseConfig: DatabaseConfig;
}
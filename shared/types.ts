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

// 图片生成状态
export type ImageStatus = 'pending' | 'success' | 'failed';

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
  userName?: string;         // 创建者名称
  projectId?: string;        // 所属项目 ID
  isDeleted?: boolean;       // 是否已删除（软删除）
  deletedAt?: Date;          // 删除时间
  deletedBy?: string;        // 删除者用户 ID
  canvasX?: number;          // 图片在画布上的 X 坐标
  canvasY?: number;          // 图片在画布上的 Y 坐标
  thumbnailUrl?: string;     // 缩略图 URL
  width?: number;            // 图片宽度
  height?: number;           // 图片高度
  status?: ImageStatus;      // 图片生成状态
  failureReason?: string;    // 失败原因（status为failed时）
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
    projectId?: string;  // 按项目 ID 筛选
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

// ============================================
// 用户登录系统类型定义
// ============================================

// 用户角色类型
export type UserRole = 'user' | 'admin';

// 完整用户信息（仅后端使用，包含密码哈希）
export interface User {
  id: string;                    // 用户唯一标识符（UUID格式）
  username: string;              // 登录用户名
  passwordHash: string;          // bcrypt 加密的密码
  displayName: string;           // 显示名称
  role: UserRole;                // 用户角色
  createdAt: Date;               // 创建时间
  updatedAt: Date;               // 更新时间
  lastLoginAt: Date | null;      // 最后登录时间
  isActive: boolean;             // 账号是否启用
}

// 公开用户信息（前端使用，不包含密码）
export interface UserInfo {
  id: string;                    // 用户唯一标识符
  username: string;              // 登录用户名
  displayName: string;           // 显示名称
  role: UserRole;                // 用户角色
  lastLoginAt: Date | null;      // 最后登录时间
}

// JWT 令牌载荷
export interface TokenPayload {
  userId: string;                // 用户 ID
  username: string;              // 用户名
  displayName: string;           // 显示名称
  role: UserRole;                // 用户角色
  iat: number;                   // 签发时间（Unix 时间戳）
  exp: number;                   // 过期时间（Unix 时间戳）
}

// 登录请求
export interface LoginRequest {
  username: string;              // 用户名
  password: string;              // 密码
}

// 登录响应
export interface LoginResponse {
  token: string;                 // JWT 令牌
  user: UserInfo;                // 用户信息
}

// 创建用户请求
export interface CreateUserRequest {
  username: string;              // 用户名
  password: string;              // 密码
  displayName: string;           // 显示名称
}


// ============================================
// 项目管理系统类型定义
// ============================================

// 项目接口
export interface Project {
  id: string;                    // 项目唯一标识符（UUID格式）
  name: string;                  // 项目名称
  description?: string;          // 项目描述
  coverImageUrl?: string;        // 封面图片 URL
  createdBy: string;             // 创建者用户 ID
  createdAt: Date;               // 创建时间
  updatedAt: Date;               // 更新时间
  isDeleted: boolean;            // 是否已删除（软删除）
  deletedAt?: Date;              // 删除时间
  deletedBy?: string;            // 删除者用户 ID
  imageCount?: number;           // 图片数量（可选，用于列表展示）
  creatorName?: string;          // 创建者名称（可选，用于列表展示）
}

// 创建项目请求
export interface CreateProjectRequest {
  name: string;                  // 项目名称（必填）
  description?: string;          // 项目描述（可选）
  coverImageUrl?: string;        // 封面图片 URL（可选）
}

// 更新项目请求
export interface UpdateProjectRequest {
  name?: string;                 // 项目名称
  description?: string;          // 项目描述
  coverImageUrl?: string;        // 封面图片 URL
}

// ============================================
// 回收站类型定义
// ============================================

// 已删除的图片
export interface DeletedImage {
  id: string;                    // 图片 ID
  url: string;                   // 图片 URL
  prompt: string;                // 提示词
  model: string;                 // 模型
  projectId: string | null;      // 所属项目 ID
  projectName: string | null;    // 所属项目名称
  userId: string;                // 创建者用户 ID
  userName: string | null;       // 创建者名称
  ossKey: string | null;         // OSS 存储键
  deletedAt: Date;               // 删除时间
  deletedBy: string;             // 删除者用户 ID
  deletedByName: string | null;  // 删除者名称
}

// 已删除的项目
export interface DeletedProject {
  id: string;                    // 项目 ID
  name: string;                  // 项目名称
  description: string | null;    // 项目描述
  coverImageUrl: string | null;  // 封面图片 URL
  createdBy: string;             // 创建者用户 ID
  creatorName: string | null;    // 创建者名称
  imageCount: number;            // 图片数量
  deletedAt: Date;               // 删除时间
  deletedBy: string;             // 删除者用户 ID
  deletedByName: string | null;  // 删除者名称
}

// 回收站内容
export interface TrashContent {
  projects: DeletedProject[];    // 已删除的项目列表
  images: DeletedImage[];        // 已删除的图片列表
}

// ============================================
// 画布持久化类型定义
// ============================================

// 画布状态（视口位置和缩放）
export interface CanvasState {
  viewportX: number;             // 视口 X 偏移
  viewportY: number;             // 视口 Y 偏移
  scale: number;                 // 缩放比例 (0.1 - 3.0)
  lastUpdated?: Date;            // 最后更新时间
}

// 视口定义
export interface Viewport {
  x: number;                     // 视口左上角 X
  y: number;                     // 视口左上角 Y
  width: number;                 // 视口宽度
  height: number;                // 视口高度
  scale: number;                 // 当前缩放比例
}

// 画布图片（包含运行时状态）
export interface CanvasImage extends SavedImage {
  loadingState?: 'placeholder' | 'thumbnail' | 'loading' | 'loaded';
  isVisible?: boolean;           // 是否在视口内
  x?: number;                    // 运行时 X 坐标（与 canvasX 同步）
  y?: number;                    // 运行时 Y 坐标（与 canvasY 同步）
  isFailed?: boolean;            // 是否生成失败（运行时状态，与 status 同步）
}

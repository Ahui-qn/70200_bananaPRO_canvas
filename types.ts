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

// 简化的类型定义，避免任何可能的依赖问题

// Application State Types
export enum AppStatus {
  IDLE = 'IDLE',
  SUBMITTING = 'SUBMITTING',
  POLLING = 'POLLING',
  SUCCESS = 'SUCCESS',
  ERROR = 'ERROR'
}

// Generation Settings
export interface GenerationSettings {
  model: string;
  prompt: string;
  aspectRatio: string;
  imageSize: string;
  refImageUrl: string;
  refImages: UploadedImage[];
}

// Uploaded Image
export interface UploadedImage {
  file: File;
  base64?: string;
  preview: string;
}

// API Configuration
export interface ApiConfig {
  apiKey: string;
  baseUrl: string;
  timeout: number;
  retryCount: number;
  provider: string;
}

// Image Result
export interface ImageResult {
  url: string;
  content: string;
}

// Result Data
export interface NanoBananaResultData {
  id: string;
  results: ImageResult[];
  progress: number;
  status: string;
  failure_reason?: string;
  error?: string;
}

// Saved Image
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
  tags?: string[];
  favorite: boolean;
  ossKey?: string;
  ossUploaded: boolean;
}

// Database Config
export interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  ssl: boolean;
  enabled: boolean;
}
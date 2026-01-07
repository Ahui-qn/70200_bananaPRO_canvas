/**
 * 前端 API 服务
 * 处理与后端的所有通信
 */

import { 
  ApiResponse, 
  PaginatedResponse, 
  SavedImage, 
  GetImagesRequest, 
  CreateImageRequest, 
  UpdateImageRequest,
  ApiConfig,
  DatabaseConfig,
  OSSConfig,
  SaveConfigRequest,
  DatabaseStatistics,
  ImageStatistics,
  Project,
  CreateProjectRequest,
  UpdateProjectRequest,
  TrashContent
} from '../../../shared/types';
import { getAuthToken } from '../contexts/AuthContext';

const API_BASE_URL = '/api';

class ApiService {
  /**
   * 获取认证头
   */
  private getAuthHeaders(): HeadersInit {
    const token = getAuthToken();
    return token ? { 'Authorization': `Bearer ${token}` } : {};
  }

  /**
   * 通用请求方法
   */
  private async request<T = any>(
    endpoint: string, 
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const url = `${API_BASE_URL}${endpoint}`;
    
    const defaultOptions: RequestInit = {
      headers: {
        'Content-Type': 'application/json',
        ...this.getAuthHeaders(),  // 添加认证头（需求 1.4, 2.4）
      },
    };

    const response = await fetch(url, {
      ...defaultOptions,
      ...options,
      headers: {
        ...defaultOptions.headers,
        ...options.headers,
      },
    });

    // 处理 401 响应（需求 2.4）
    if (response.status === 401) {
      // 清除本地存储的令牌
      localStorage.removeItem('auth_token');
      localStorage.removeItem('auth_user');
      // 刷新页面以重定向到登录页
      window.location.reload();
      throw new Error('登录已失效，请重新登录');
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
    }

    return response.json();
  }

  // ========== 健康检查 ==========
  
  async healthCheck(): Promise<ApiResponse> {
    return this.request('/health');
  }

  // ========== 图片管理 ==========
  
  async getImages(params: GetImagesRequest = {}): Promise<ApiResponse<PaginatedResponse<SavedImage>>> {
    const searchParams = new URLSearchParams();
    
    if (params.page) searchParams.set('page', params.page.toString());
    if (params.pageSize) searchParams.set('pageSize', params.pageSize.toString());
    if (params.sortBy) searchParams.set('sortBy', params.sortBy);
    if (params.sortOrder) searchParams.set('sortOrder', params.sortOrder);
    
    if (params.filters) {
      Object.entries(params.filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          searchParams.set(key, value.toString());
        }
      });
    }

    const query = searchParams.toString();
    return this.request(`/images${query ? `?${query}` : ''}`);
  }

  async getImage(id: string): Promise<ApiResponse<SavedImage>> {
    return this.request(`/images/${id}`);
  }

  async createImage(data: CreateImageRequest): Promise<ApiResponse<SavedImage>> {
    return this.request('/images', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateImage(id: string, data: UpdateImageRequest): Promise<ApiResponse<SavedImage>> {
    return this.request(`/images/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteImage(id: string): Promise<ApiResponse> {
    return this.request(`/images/${id}`, {
      method: 'DELETE',
    });
  }

  async deleteImages(ids: string[]): Promise<ApiResponse> {
    return this.request('/images', {
      method: 'DELETE',
      body: JSON.stringify({ ids }),
    });
  }

  async getImageStats(): Promise<ApiResponse<ImageStatistics>> {
    return this.request('/images/stats/summary');
  }

  // ========== 配置管理 ==========
  
  async getConfigs(): Promise<ApiResponse> {
    return this.request('/config');
  }

  async saveConfigs(data: SaveConfigRequest): Promise<ApiResponse> {
    return this.request('/config', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getApiConfig(): Promise<ApiResponse<ApiConfig>> {
    return this.request('/config/api');
  }

  async saveApiConfig(config: ApiConfig): Promise<ApiResponse> {
    return this.request('/config/api', {
      method: 'POST',
      body: JSON.stringify(config),
    });
  }

  async getOSSConfig(): Promise<ApiResponse<OSSConfig>> {
    return this.request('/config/oss');
  }

  async saveOSSConfig(config: OSSConfig): Promise<ApiResponse> {
    return this.request('/config/oss', {
      method: 'POST',
      body: JSON.stringify(config),
    });
  }

  async deleteApiConfig(): Promise<ApiResponse> {
    return this.request('/config/api', {
      method: 'DELETE',
    });
  }

  async deleteOSSConfig(): Promise<ApiResponse> {
    return this.request('/config/oss', {
      method: 'DELETE',
    });
  }

  async testDatabaseConnection(): Promise<ApiResponse> {
    return this.request('/database/test', {
      method: 'POST',
    });
  }

  async testOSSConnection(): Promise<ApiResponse> {
    return this.request('/config/test-oss', {
      method: 'POST',
    });
  }

  // ========== 数据库管理 ==========
  
  async getDatabaseStatus(): Promise<ApiResponse> {
    return this.request('/database/status');
  }

  // OSS 状态信息接口
  async getOSSStatus(): Promise<ApiResponse<{ 
    isConnected: boolean;
    status: 'connected' | 'disconnected' | 'not_configured' | 'auth_error' | 'access_denied' | 'bucket_not_found' | 'time_error' | 'arrears' | 'error';
    message: string;
    errorCode?: string;
    errorDetail?: string;
  }>> {
    return this.request('/config/oss/status');
  }

  async initDatabase(): Promise<ApiResponse> {
    return this.request('/database/init', {
      method: 'POST',
    });
  }

  async getDatabaseStats(): Promise<ApiResponse<DatabaseStatistics>> {
    return this.request('/database/stats');
  }

  async connectDatabase(): Promise<ApiResponse> {
    return this.request('/database/connect', {
      method: 'POST',
    });
  }

  async disconnectDatabase(): Promise<ApiResponse> {
    return this.request('/database/disconnect', {
      method: 'POST',
    });
  }

  async clearUserData(): Promise<ApiResponse> {
    return this.request('/database/clear', {
      method: 'DELETE',
    });
  }

  async getOperationLogs(page = 1, pageSize = 50): Promise<ApiResponse> {
    return this.request(`/database/logs?page=${page}&pageSize=${pageSize}`);
  }

  // ========== 图片生成 ==========
  
  async generateImage(request: CreateImageRequest): Promise<ApiResponse> {
    return this.request('/generate', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  async getGenerationStatus(taskId: string): Promise<ApiResponse> {
    return this.request(`/generate/${taskId}`);
  }

  async saveGeneratedImage(taskId: string, data: any): Promise<ApiResponse> {
    return this.request(`/generate/${taskId}/save`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  /**
   * 保存失败的图片记录
   */
  async saveFailedImage(data: {
    prompt: string;
    model: string;
    aspectRatio: string;
    imageSize: string;
    projectId?: string;
    canvasX?: number;
    canvasY?: number;
    width?: number;
    height?: number;
    failureReason: string;
  }): Promise<ApiResponse> {
    return this.request('/generate/save-failed', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // ========== 测试接口 ==========
  
  async testConnection(data: any = {}): Promise<ApiResponse> {
    return this.request('/test', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // ========== 项目管理（需求 2.3） ==========
  
  async getProjects(): Promise<ApiResponse<Project[]>> {
    return this.request('/projects');
  }

  async getProject(id: string): Promise<ApiResponse<Project>> {
    return this.request(`/projects/${id}`);
  }

  async getCurrentProject(): Promise<ApiResponse<Project>> {
    return this.request('/projects/current');
  }

  async createProject(data: CreateProjectRequest): Promise<ApiResponse<Project>> {
    return this.request('/projects', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateProject(id: string, data: UpdateProjectRequest): Promise<ApiResponse<Project>> {
    return this.request(`/projects/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteProject(id: string): Promise<ApiResponse> {
    return this.request(`/projects/${id}`, {
      method: 'DELETE',
    });
  }

  async switchProject(id: string): Promise<ApiResponse<Project>> {
    return this.request(`/projects/${id}/switch`, {
      method: 'PUT',
    });
  }

  // ========== 回收站管理（需求 8.2） ==========
  
  async getTrashItems(): Promise<ApiResponse<TrashContent>> {
    return this.request('/trash');
  }

  async restoreProject(id: string): Promise<ApiResponse<Project>> {
    return this.request(`/trash/restore/project/${id}`, {
      method: 'POST',
    });
  }

  async restoreImage(id: string): Promise<ApiResponse> {
    return this.request(`/trash/restore/image/${id}`, {
      method: 'POST',
    });
  }

  async hardDeleteProject(id: string): Promise<ApiResponse> {
    return this.request(`/trash/project/${id}`, {
      method: 'DELETE',
    });
  }

  async hardDeleteImage(id: string): Promise<ApiResponse> {
    return this.request(`/trash/image/${id}`, {
      method: 'DELETE',
    });
  }

  async emptyTrash(): Promise<ApiResponse> {
    return this.request('/trash/empty', {
      method: 'DELETE',
    });
  }

  // ========== 画布持久化（需求 1.1, 2.1, 3.1） ==========

  /**
   * 获取项目画布图片
   * 返回项目所有图片及其画布位置，同时返回画布状态
   */
  async getProjectCanvasImages(projectId: string): Promise<ApiResponse<{
    images: SavedImage[];
    canvasState: { viewportX: number; viewportY: number; scale: number; lastUpdated?: Date } | null;
  }>> {
    return this.request(`/projects/${projectId}/canvas-images`);
  }

  /**
   * 更新图片画布位置
   */
  async updateImageCanvasPosition(imageId: string, canvasX: number, canvasY: number): Promise<ApiResponse> {
    return this.request(`/images/${imageId}/canvas-position`, {
      method: 'PATCH',
      body: JSON.stringify({ canvasX, canvasY }),
    });
  }

  /**
   * 获取画布状态
   */
  async getCanvasState(projectId: string): Promise<ApiResponse<{
    viewportX: number;
    viewportY: number;
    scale: number;
    lastUpdated?: Date;
  } | null>> {
    return this.request(`/projects/${projectId}/canvas-state`);
  }

  /**
   * 保存画布状态
   */
  async saveCanvasState(projectId: string, state: {
    viewportX: number;
    viewportY: number;
    scale: number;
  }): Promise<ApiResponse> {
    return this.request(`/projects/${projectId}/canvas-state`, {
      method: 'PUT',
      body: JSON.stringify(state),
    });
  }
}

export const apiService = new ApiService();
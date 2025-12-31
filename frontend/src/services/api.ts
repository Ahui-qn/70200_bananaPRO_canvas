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
  ImageStatistics
} from '../../../shared/types';

const API_BASE_URL = '/api';

class ApiService {
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

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
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

  // ========== 测试接口 ==========
  
  async testConnection(data: any = {}): Promise<ApiResponse> {
    return this.request('/test', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }
}

export const apiService = new ApiService();
/**
 * Nano Banana AI 图片生成服务
 */

import { ApiConfig, NanoBananaRequest, NanoBananaCreateResponse, NanoBananaResultResponse } from '@shared/types';

class NanoBananaService {
  /**
   * 创建图片生成任务
   * 使用 webHook="-1" 参数立即返回任务 ID，然后通过轮询获取结果
   */
  async createTask(request: NanoBananaRequest, apiConfig: ApiConfig): Promise<string> {
    try {
      // 构建请求 URL：baseUrl + /v1/draw/nano-banana
      const url = `${apiConfig.baseUrl}/v1/draw/nano-banana`;
      
      // 添加 webHook="-1" 以立即返回任务 ID
      const requestBody = {
        ...request,
        webHook: '-1'
      };
      
      console.log('创建 Nano Banana 任务:', url, requestBody);
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiConfig.apiKey}`,
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('API 响应错误:', response.status, errorText);
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data: NanoBananaCreateResponse = await response.json();
      console.log('创建任务响应:', data);
      
      if (data.code !== 0) {
        throw new Error(data.msg || '创建任务失败');
      }

      return data.data.id;
    } catch (error: any) {
      console.error('创建 Nano Banana 任务失败:', error);
      throw new Error(`创建任务失败: ${error.message}`);
    }
  }

  /**
   * 获取任务结果
   * 使用 POST /v1/draw/result 接口
   */
  async getTaskResult(taskId: string, apiConfig: ApiConfig): Promise<NanoBananaResultResponse> {
    try {
      // 构建请求 URL：baseUrl + /v1/draw/result
      const url = `${apiConfig.baseUrl}/v1/draw/result`;
      
      console.log('获取任务结果:', url, { id: taskId });
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiConfig.apiKey}`,
        },
        body: JSON.stringify({ id: taskId }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('API 响应错误:', response.status, errorText);
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data: NanoBananaResultResponse = await response.json();
      console.log('获取结果响应:', data);
      
      if (data.code === -22) {
        throw new Error('任务不存在');
      }
      
      if (data.code !== 0) {
        throw new Error(data.msg || '获取任务结果失败');
      }

      return data;
    } catch (error: any) {
      console.error('获取 Nano Banana 任务结果失败:', error);
      throw new Error(`获取任务结果失败: ${error.message}`);
    }
  }

  /**
   * 轮询任务直到完成
   */
  async pollTaskUntilComplete(
    taskId: string, 
    apiConfig: ApiConfig, 
    onProgress?: (progress: number, status: string) => void,
    maxAttempts: number = 60,
    interval: number = 2000
  ): Promise<NanoBananaResultResponse> {
    let attempts = 0;
    
    while (attempts < maxAttempts) {
      try {
        const result = await this.getTaskResult(taskId, apiConfig);
        
        if (onProgress) {
          onProgress(result.data.progress, result.data.status);
        }
        
        if (result.data.status === 'succeeded') {
          return result;
        }
        
        if (result.data.status === 'failed') {
          throw new Error(result.data.failure_reason || '任务执行失败');
        }
        
        // 如果任务还在运行，等待后继续轮询
        if (result.data.status === 'running') {
          await this.delay(interval);
          attempts++;
          continue;
        }
        
        throw new Error(`未知任务状态: ${result.data.status}`);
      } catch (error: any) {
        if (attempts >= maxAttempts - 1) {
          throw error;
        }
        
        await this.delay(interval);
        attempts++;
      }
    }
    
    throw new Error('任务轮询超时');
  }

  /**
   * 延迟函数
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 验证 API 配置
   */
  async validateApiConfig(apiConfig: ApiConfig): Promise<boolean> {
    try {
      // 创建一个简单的测试任务
      const testRequest: NanoBananaRequest = {
        model: 'nano-banana-fast',
        prompt: 'test',
        shutProgress: true
      };
      
      await this.createTask(testRequest, apiConfig);
      return true;
    } catch (error) {
      console.error('API 配置验证失败:', error);
      return false;
    }
  }
}

export const nanoBananaService = new NanoBananaService();
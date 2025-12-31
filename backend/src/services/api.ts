import { 
  NanoBananaRequest, 
  NanoBananaCreateResponse, 
  NanoBananaResultRequest, 
  NanoBananaResultResponse,
  ApiConfig
} from '../types';
import { fetchWithNetworkRetry } from './networkErrorHandler';

// 获取请求头的辅助函数
const getHeaders = (apiKey: string) => {
  if (!apiKey || apiKey.trim() === '') {
    throw new Error('请先配置 API Key');
  }
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey.trim()}`
  };
};

/**
 * 第一步：提交绘画任务
 */
export const createDrawingTask = async (
  params: Omit<NanoBananaRequest, 'webHook'>, 
  config: ApiConfig
): Promise<string> => {
  const payload: NanoBananaRequest = {
    ...params,
    webHook: "-1"  // 立即返回任务ID
  };

  try {
    const response = await fetchWithNetworkRetry(
      `${config.baseUrl}/nano-banana`,
      {
        method: 'POST',
        headers: getHeaders(config.apiKey),
        body: JSON.stringify(payload),
      },
      {
        maxRetries: config.retryCount,
        timeout: config.timeout
      }
    );

    const data: NanoBananaCreateResponse = await response.json();
    
    // 检查API返回的状态码
    if (data.code !== 0) {
       throw new Error(data.msg || '创建任务时发生未知错误');
    }

    return data.data.id;
  } catch (error) {
    console.error('API 创建错误:', error);
    throw error;
  }
};

/**
 * 第二步：轮询获取结果
 */
export const getTaskResult = async (
  taskId: string, 
  config: ApiConfig
): Promise<NanoBananaResultResponse> => {
  const payload: NanoBananaResultRequest = {
    id: taskId
  };

  try {
    const response = await fetchWithNetworkRetry(
      `${config.baseUrl}/result`,
      {
        method: 'POST',
        headers: getHeaders(config.apiKey),
        body: JSON.stringify(payload),
      },
      {
        maxRetries: config.retryCount,
        timeout: config.timeout
      }
    );

    const data: NanoBananaResultResponse = await response.json();
    return data;
  } catch (error) {
    console.error('API 结果错误:', error);
    throw error;
  }
};

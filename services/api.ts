import { 
  NanoBananaRequest, 
  NanoBananaCreateResponse, 
  NanoBananaResultRequest, 
  NanoBananaResultResponse,
  ApiConfig
} from '../types';

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

// 带重试的 fetch 函数
const fetchWithRetry = async (
  url: string, 
  options: RequestInit, 
  retryCount: number = 3,
  timeout: number = 30000
): Promise<Response> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    
    if (retryCount > 0 && (error as Error).name !== 'AbortError') {
      console.warn(`请求失败，剩余重试次数: ${retryCount - 1}`);
      await new Promise(resolve => setTimeout(resolve, 1000)); // 等待1秒后重试
      return fetchWithRetry(url, options, retryCount - 1, timeout);
    }
    
    throw error;
  }
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
    const response = await fetchWithRetry(
      `${config.baseUrl}/nano-banana`,
      {
        method: 'POST',
        headers: getHeaders(config.apiKey),
        body: JSON.stringify(payload),
      },
      config.retryCount,
      config.timeout
    );

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('API Key 无效，请检查配置');
      }
      if (response.status === 404) {
        throw new Error('API 接口地址无效，请检查配置');
      }
      throw new Error(`创建任务失败: ${response.status} ${response.statusText}`);
    }

    const data: NanoBananaCreateResponse = await response.json();
    
    // 检查API返回的状态码
    if (data.code !== 0) {
       throw new Error(data.msg || '创建任务时发生未知错误');
    }

    return data.data.id;
  } catch (error) {
    console.error('API 创建错误:', error);
    if ((error as Error).name === 'AbortError') {
      throw new Error(`请求超时 (${config.timeout / 1000}秒)，请检查网络连接`);
    }
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
    const response = await fetchWithRetry(
      `${config.baseUrl}/result`,
      {
        method: 'POST',
        headers: getHeaders(config.apiKey),
        body: JSON.stringify(payload),
      },
      config.retryCount,
      config.timeout
    );

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('API Key 无效，请检查配置');
      }
      if (response.status === 404) {
        throw new Error('API 接口地址无效，请检查配置');
      }
      throw new Error(`获取结果失败: ${response.status} ${response.statusText}`);
    }

    const data: NanoBananaResultResponse = await response.json();
    return data;
  } catch (error) {
    console.error('API 结果错误:', error);
    if ((error as Error).name === 'AbortError') {
      throw new Error(`请求超时 (${config.timeout / 1000}秒)，请检查网络连接`);
    }
    throw error;
  }
};

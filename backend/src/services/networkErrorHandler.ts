/**
 * 网络错误处理器
 * 提供自动重试机制和指数退避策略
 */

import { NetworkErrorHandler } from '../types';
import { DEFAULT_VALUES, ERROR_MESSAGES } from '../config/constants';

/**
 * 网络错误类型定义
 */
export class NetworkError extends Error {
  constructor(
    message: string,
    public code: string,
    public retryable: boolean = true,
    public statusCode?: number
  ) {
    super(message);
    this.name = 'NetworkError';
  }
}

/**
 * 网络错误处理器实现
 */
export class NetworkErrorHandlerImpl implements NetworkErrorHandler {
  private retryCount = 0;
  private readonly maxRetries: number;
  private readonly baseDelay: number;
  private readonly maxDelay: number;

  constructor(
    maxRetries: number = DEFAULT_VALUES.MAX_RETRY_COUNT,
    baseDelay: number = DEFAULT_VALUES.RETRY_DELAY,
    maxDelay: number = 30000 // 最大延迟30秒
  ) {
    this.maxRetries = maxRetries;
    this.baseDelay = baseDelay;
    this.maxDelay = maxDelay;
  }

  /**
   * 带重试机制的操作执行器
   */
  async executeWithRetry<T>(operation: () => Promise<T>): Promise<T> {
    this.retryCount = 0;
    let lastError: any;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const result = await operation();
        // 操作成功，重置重试计数
        this.retryCount = 0;
        return result;
      } catch (error: any) {
        lastError = error;
        this.retryCount = attempt;

        console.error(`网络操作第 ${attempt} 次尝试失败:`, error);

        // 检查是否应该重试
        if (!this.shouldRetry(error) || attempt >= this.maxRetries) {
          break;
        }

        // 计算延迟时间并等待
        const delay = this.calculateBackoffDelay(attempt);
        console.log(`等待 ${delay}ms 后进行第 ${attempt + 1} 次重试...`);
        await this.delay(delay);
      }
    }

    // 所有重试都失败了，抛出最后一个错误
    throw this.createNetworkError(lastError);
  }

  /**
   * 判断错误是否应该重试
   */
  shouldRetry(error: any): boolean {
    // 如果是 NetworkError 且明确标记为不可重试，则不重试
    if (error instanceof NetworkError && !error.retryable) {
      return false;
    }

    // 检查错误类型和状态码
    if (error.name === 'AbortError') {
      // 请求被取消，不重试
      return false;
    }

    // 网络相关错误，可以重试
    const retryableErrors = [
      'NETWORK_ERROR',
      'TIMEOUT',
      'CONNECTION_LOST',
      'ECONNREFUSED',
      'ENOTFOUND',
      'ETIMEDOUT',
      'ECONNRESET',
      'EPIPE'
    ];

    if (retryableErrors.includes(error.code)) {
      return true;
    }

    // HTTP 状态码相关的重试策略
    if (error.statusCode || error.status) {
      const statusCode = error.statusCode || error.status;
      
      // 5xx 服务器错误，可以重试
      if (statusCode >= 500 && statusCode < 600) {
        return true;
      }
      
      // 429 请求过多，可以重试
      if (statusCode === 429) {
        return true;
      }
      
      // 408 请求超时，可以重试
      if (statusCode === 408) {
        return true;
      }
      
      // 4xx 客户端错误（除了上述特殊情况），不重试
      if (statusCode >= 400 && statusCode < 500) {
        return false;
      }
    }

    // 数据库连接相关错误，可以重试
    const dbRetryableErrors = [
      'ER_LOCK_WAIT_TIMEOUT',
      'ER_LOCK_DEADLOCK',
      'ER_CON_COUNT_ERROR',
      'ER_TOO_MANY_USER_CONNECTIONS'
    ];

    if (dbRetryableErrors.includes(error.code)) {
      return true;
    }

    // 默认情况下，如果是网络相关的错误消息，则重试
    const errorMessage = (error.message || '').toLowerCase();
    const networkKeywords = [
      'network',
      'timeout',
      'connection',
      'socket',
      'dns',
      'resolve',
      'unreachable'
    ];

    return networkKeywords.some(keyword => errorMessage.includes(keyword));
  }

  /**
   * 计算指数退避延迟时间
   */
  private calculateBackoffDelay(attempt: number): number {
    // 指数退避：baseDelay * 2^(attempt-1) + 随机抖动
    const exponentialDelay = this.baseDelay * Math.pow(2, attempt - 1);
    
    // 添加随机抖动（±25%）避免雷群效应
    const jitter = exponentialDelay * 0.25 * (Math.random() - 0.5);
    const delayWithJitter = exponentialDelay + jitter;
    
    // 限制最大延迟时间
    return Math.min(Math.max(delayWithJitter, this.baseDelay), this.maxDelay);
  }

  /**
   * 延迟函数
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 创建标准化的网络错误
   */
  private createNetworkError(originalError: any): NetworkError {
    let message: string = ERROR_MESSAGES.NETWORK_ERROR;
    let code = 'NETWORK_ERROR';
    let retryable = true;
    let statusCode: number | undefined;

    if (originalError) {
      // 保留原始错误信息
      message = originalError.message || message;
      code = originalError.code || code;
      statusCode = originalError.statusCode || originalError.status;

      // 根据错误类型调整消息
      switch (originalError.name) {
        case 'AbortError':
          message = ERROR_MESSAGES.REQUEST_TIMEOUT as string;
          code = 'TIMEOUT';
          retryable = false;
          break;
        case 'TypeError':
          if (message.includes('fetch')) {
            message = '网络请求失败，请检查网络连接';
            code = 'FETCH_ERROR';
          }
          break;
      }

      // 根据错误代码调整消息
      switch (originalError.code) {
        case 'ECONNREFUSED':
          message = '连接被拒绝，请检查服务器地址和端口';
          break;
        case 'ENOTFOUND':
          message = 'DNS 解析失败，请检查域名或网络连接';
          break;
        case 'ETIMEDOUT':
          message = '连接超时，请检查网络连接';
          break;
        case 'ECONNRESET':
          message = '连接被重置，请稍后重试';
          break;
      }

      // 根据 HTTP 状态码调整消息
      if (statusCode) {
        switch (statusCode) {
          case 400:
            message = '请求参数错误';
            retryable = false;
            break;
          case 401:
            message = '身份验证失败，请检查 API 密钥';
            retryable = false;
            break;
          case 403:
            message = '访问被禁止，请检查权限设置';
            retryable = false;
            break;
          case 404:
            message = '请求的资源不存在，请检查 API 地址';
            retryable = false;
            break;
          case 408:
            message = '请求超时，请稍后重试';
            break;
          case 429:
            message = '请求过于频繁，请稍后重试';
            break;
          case 500:
            message = '服务器内部错误，请稍后重试';
            break;
          case 502:
            message = '网关错误，请稍后重试';
            break;
          case 503:
            message = '服务暂时不可用，请稍后重试';
            break;
          case 504:
            message = '网关超时，请稍后重试';
            break;
        }
      }
    }

    return new NetworkError(message, code, retryable, statusCode);
  }

  /**
   * 获取当前重试次数
   */
  getCurrentRetryCount(): number {
    return this.retryCount;
  }

  /**
   * 获取最大重试次数
   */
  getMaxRetries(): number {
    return this.maxRetries;
  }

  /**
   * 重置重试计数
   */
  resetRetryCount(): void {
    this.retryCount = 0;
  }
}

/**
 * 创建网络错误处理器实例
 */
export function createNetworkErrorHandler(
  maxRetries?: number,
  baseDelay?: number,
  maxDelay?: number
): NetworkErrorHandler {
  return new NetworkErrorHandlerImpl(maxRetries, baseDelay, maxDelay);
}

/**
 * 默认网络错误处理器实例
 */
export const networkErrorHandler = new NetworkErrorHandlerImpl();

/**
 * 便捷函数：带网络错误处理的 fetch
 */
export async function fetchWithNetworkRetry(
  url: string,
  options?: RequestInit,
  retryOptions?: {
    maxRetries?: number;
    baseDelay?: number;
    maxDelay?: number;
    timeout?: number;
  }
): Promise<Response> {
  const handler = retryOptions 
    ? createNetworkErrorHandler(retryOptions.maxRetries, retryOptions.baseDelay, retryOptions.maxDelay)
    : networkErrorHandler;

  return handler.executeWithRetry(async () => {
    const controller = new AbortController();
    const timeout = retryOptions?.timeout || DEFAULT_VALUES.API_TIMEOUT;
    
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      // 检查 HTTP 状态
      if (!response.ok) {
        throw new NetworkError(
          `HTTP ${response.status}: ${response.statusText}`,
          'HTTP_ERROR',
          response.status >= 500 || response.status === 429 || response.status === 408,
          response.status
        );
      }
      
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  });
}
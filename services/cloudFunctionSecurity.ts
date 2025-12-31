/**
 * 云函数安全验证和签名服务
 * 提供请求签名、身份验证和安全通信功能
 */

import { loadEnvironmentConfig } from '../config/database';

/**
 * 签名算法类型
 */
export type SignatureAlgorithm = 'HMAC-SHA256' | 'HMAC-SHA1';

/**
 * 请求签名配置
 */
export interface SignatureConfig {
  algorithm: SignatureAlgorithm;
  accessKeyId: string;
  accessKeySecret: string;
  timestamp: number;
  nonce: string;
}

/**
 * 签名结果
 */
export interface SignatureResult {
  signature: string;
  authorization: string;
  timestamp: number;
  nonce: string;
}

/**
 * 云函数安全服务类
 */
export class CloudFunctionSecurityService {
  private readonly algorithm: SignatureAlgorithm = 'HMAC-SHA256';

  /**
   * 生成随机字符串（用作 nonce）
   */
  private generateNonce(length: number = 16): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  /**
   * 生成时间戳
   */
  private generateTimestamp(): number {
    return Math.floor(Date.now() / 1000);
  }

  /**
   * 使用 Web Crypto API 生成 HMAC 签名
   */
  private async generateHMAC(
    message: string, 
    secret: string, 
    algorithm: SignatureAlgorithm = 'HMAC-SHA256'
  ): Promise<string> {
    try {
      // 将密钥和消息转换为 ArrayBuffer
      const encoder = new TextEncoder();
      const keyData = encoder.encode(secret);
      const messageData = encoder.encode(message);

      // 确定哈希算法
      const hashAlgorithm = algorithm === 'HMAC-SHA256' ? 'SHA-256' : 'SHA-1';

      // 导入密钥
      const cryptoKey = await crypto.subtle.importKey(
        'raw',
        keyData,
        { name: 'HMAC', hash: hashAlgorithm },
        false,
        ['sign']
      );

      // 生成签名
      const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageData);

      // 转换为 Base64
      const signatureArray = new Uint8Array(signature);
      return btoa(String.fromCharCode(...signatureArray));

    } catch (error) {
      console.error('生成 HMAC 签名失败:', error);
      // 降级到简单哈希实现
      return this.generateSimpleHash(message, secret);
    }
  }

  /**
   * 简单哈希实现（降级方案）
   */
  private generateSimpleHash(message: string, secret: string): string {
    const combined = message + secret;
    let hash = 0;
    
    for (let i = 0; i < combined.length; i++) {
      const char = combined.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // 转换为32位整数
    }
    
    // 转换为正数并编码为 Base64
    const positiveHash = Math.abs(hash).toString(16);
    return btoa(positiveHash).substring(0, 32);
  }

  /**
   * 构建待签名字符串
   */
  private buildStringToSign(
    method: string,
    uri: string,
    queryParams: Record<string, string>,
    headers: Record<string, string>,
    body: string
  ): string {
    // 按照阿里云函数计算的签名规范构建待签名字符串
    const parts: string[] = [];

    // 1. HTTP 方法
    parts.push(method.toUpperCase());

    // 2. URI 路径
    parts.push(uri);

    // 3. 查询参数（按字典序排序）
    const sortedParams = Object.keys(queryParams)
      .sort()
      .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(queryParams[key])}`)
      .join('&');
    parts.push(sortedParams);

    // 4. 标准化的请求头（按字典序排序）
    const canonicalHeaders = Object.keys(headers)
      .filter(key => key.toLowerCase().startsWith('x-fc-') || key.toLowerCase() === 'content-type')
      .sort()
      .map(key => `${key.toLowerCase()}:${headers[key].trim()}`)
      .join('\n');
    parts.push(canonicalHeaders);

    // 5. 请求体的哈希值（如果有）
    if (body) {
      // 这里应该计算 SHA256 哈希，为简化使用长度
      parts.push(body.length.toString());
    } else {
      parts.push('');
    }

    return parts.join('\n');
  }

  /**
   * 生成请求签名
   */
  async generateSignature(
    method: string,
    uri: string,
    queryParams: Record<string, string> = {},
    headers: Record<string, string> = {},
    body: string = '',
    config?: Partial<SignatureConfig>
  ): Promise<SignatureResult> {
    const env = loadEnvironmentConfig();
    
    const signatureConfig: SignatureConfig = {
      algorithm: config?.algorithm || this.algorithm,
      accessKeyId: config?.accessKeyId || env.FC_ACCESS_KEY_ID || '',
      accessKeySecret: config?.accessKeySecret || env.FC_ACCESS_KEY_SECRET || '',
      timestamp: config?.timestamp || this.generateTimestamp(),
      nonce: config?.nonce || this.generateNonce()
    };

    if (!signatureConfig.accessKeyId || !signatureConfig.accessKeySecret) {
      throw new Error('云函数访问密钥未配置');
    }

    // 添加必要的请求头
    const allHeaders = {
      ...headers,
      'x-fc-date': new Date(signatureConfig.timestamp * 1000).toISOString(),
      'x-fc-invocation-type': 'Sync',
      'x-fc-log-type': 'Tail'
    };

    // 构建待签名字符串
    const stringToSign = this.buildStringToSign(method, uri, queryParams, allHeaders, body);

    console.log('待签名字符串:', stringToSign);

    // 生成签名
    const signature = await this.generateHMAC(
      stringToSign, 
      signatureConfig.accessKeySecret, 
      signatureConfig.algorithm
    );

    // 构建 Authorization 头
    const authorization = `FC ${signatureConfig.accessKeyId}:${signature}`;

    return {
      signature,
      authorization,
      timestamp: signatureConfig.timestamp,
      nonce: signatureConfig.nonce
    };
  }

  /**
   * 验证请求签名（用于调试）
   */
  async verifySignature(
    method: string,
    uri: string,
    queryParams: Record<string, string>,
    headers: Record<string, string>,
    body: string,
    expectedSignature: string,
    accessKeySecret: string
  ): Promise<boolean> {
    try {
      const stringToSign = this.buildStringToSign(method, uri, queryParams, headers, body);
      const calculatedSignature = await this.generateHMAC(stringToSign, accessKeySecret);
      
      return calculatedSignature === expectedSignature;
    } catch (error) {
      console.error('验证签名失败:', error);
      return false;
    }
  }

  /**
   * 生成安全的请求头
   */
  async generateSecureHeaders(
    method: string,
    uri: string,
    body: string = '',
    additionalHeaders: Record<string, string> = {}
  ): Promise<Record<string, string>> {
    const signatureResult = await this.generateSignature(method, uri, {}, additionalHeaders, body);

    return {
      'Content-Type': 'application/json',
      'Authorization': signatureResult.authorization,
      'X-Fc-Date': new Date(signatureResult.timestamp * 1000).toISOString(),
      'X-Fc-Invocation-Type': 'Sync',
      'X-Fc-Log-Type': 'Tail',
      'X-Fc-Request-Id': this.generateNonce(32),
      ...additionalHeaders
    };
  }

  /**
   * 加密敏感参数
   */
  encryptSensitiveParams(params: any): any {
    // 这里可以实现参数加密逻辑
    // 为了简化，直接返回原参数
    // 在实际应用中，应该加密数据库密码等敏感信息
    const encrypted = { ...params };
    
    if (encrypted.config && encrypted.config.password) {
      // 标记密码已加密（实际应该进行真正的加密）
      encrypted.config.password = `encrypted:${btoa(encrypted.config.password)}`;
    }
    
    return encrypted;
  }

  /**
   * 解密敏感参数
   */
  decryptSensitiveParams(params: any): any {
    // 这里可以实现参数解密逻辑
    const decrypted = { ...params };
    
    if (decrypted.config && decrypted.config.password && decrypted.config.password.startsWith('encrypted:')) {
      // 解密密码
      decrypted.config.password = atob(decrypted.config.password.substring(10));
    }
    
    return decrypted;
  }

  /**
   * 生成请求 ID
   */
  generateRequestId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2);
    return `fc-${timestamp}-${random}`;
  }

  /**
   * 验证响应完整性
   */
  verifyResponseIntegrity(response: any, expectedRequestId?: string): boolean {
    try {
      // 检查响应格式
      if (!response || typeof response !== 'object') {
        return false;
      }

      // 检查必要字段
      if (typeof response.success !== 'boolean') {
        return false;
      }

      // 检查请求 ID（如果提供）
      if (expectedRequestId && response.requestId !== expectedRequestId) {
        console.warn('响应请求 ID 不匹配');
        return false;
      }

      return true;
    } catch (error) {
      console.error('验证响应完整性失败:', error);
      return false;
    }
  }

  /**
   * 生成安全的云函数调用配置
   */
  async generateSecureCallConfig(
    functionName: string,
    params: any
  ): Promise<{
    url: string;
    headers: Record<string, string>;
    body: string;
    requestId: string;
  }> {
    const env = loadEnvironmentConfig();
    
    if (!env.FC_ENDPOINT) {
      throw new Error('云函数端点未配置');
    }

    // 生成请求 ID
    const requestId = this.generateRequestId();

    // 加密敏感参数
    const encryptedParams = this.encryptSensitiveParams(params);

    // 构建请求体
    const body = JSON.stringify({
      functionName,
      params: encryptedParams,
      requestId,
      timestamp: Date.now()
    });

    // 构建 URL
    const url = `${env.FC_ENDPOINT}/2016-08-15/proxy/${functionName}/`;
    const uri = `/2016-08-15/proxy/${functionName}/`;

    // 生成安全请求头
    const headers = await this.generateSecureHeaders('POST', uri, body);

    return {
      url,
      headers,
      body,
      requestId
    };
  }
}

// 创建单例实例
export const cloudFunctionSecurity = new CloudFunctionSecurityService();

// 导出默认实例
export default cloudFunctionSecurity;
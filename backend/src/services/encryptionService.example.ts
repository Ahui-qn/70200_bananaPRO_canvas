/**
 * 加密服务使用示例
 * 演示如何在实际应用中使用 AESEncryptionService
 */

import { AESEncryptionService, getEncryptionService } from './encryptionService';
import { ApiConfig, OSSConfig } from '@shared/types';

// 示例：加密和存储 API 配置
export function encryptApiConfig(apiConfig: ApiConfig): string {
  const encryptionService = getEncryptionService();
  
  // 将配置对象序列化为 JSON 字符串
  const configJson = JSON.stringify(apiConfig);
  
  // 加密配置数据
  const encryptedConfig = encryptionService.encrypt(configJson);
  
  console.log('API 配置已加密存储');
  return encryptedConfig;
}

// 示例：解密和加载 API 配置
export function decryptApiConfig(encryptedConfig: string): ApiConfig {
  const encryptionService = getEncryptionService();
  
  try {
    // 解密配置数据
    const configJson = encryptionService.decrypt(encryptedConfig);
    
    // 解析 JSON 字符串为配置对象
    const apiConfig: ApiConfig = JSON.parse(configJson);
    
    console.log('API 配置已成功解密');
    return apiConfig;
  } catch (error) {
    console.error('API 配置解密失败:', error);
    throw new Error('无法解密 API 配置，可能是密钥错误或数据损坏');
  }
}

// 示例：加密 OSS 配置中的敏感信息
export function encryptOSSConfig(ossConfig: OSSConfig): OSSConfig {
  const encryptionService = getEncryptionService();
  
  // 创建配置副本，避免修改原始对象
  const encryptedConfig = { ...ossConfig };
  
  // 加密敏感字段
  if (ossConfig.accessKeyId) {
    encryptedConfig.accessKeyId = encryptionService.encrypt(ossConfig.accessKeyId);
  }
  
  if (ossConfig.accessKeySecret) {
    encryptedConfig.accessKeySecret = encryptionService.encrypt(ossConfig.accessKeySecret);
  }
  
  console.log('OSS 配置中的敏感信息已加密');
  return encryptedConfig;
}

// 示例：解密 OSS 配置中的敏感信息
export function decryptOSSConfig(encryptedConfig: OSSConfig): OSSConfig {
  const encryptionService = getEncryptionService();
  
  try {
    // 创建配置副本
    const decryptedConfig = { ...encryptedConfig };
    
    // 解密敏感字段
    if (encryptedConfig.accessKeyId) {
      decryptedConfig.accessKeyId = encryptionService.decrypt(encryptedConfig.accessKeyId);
    }
    
    if (encryptedConfig.accessKeySecret) {
      decryptedConfig.accessKeySecret = encryptionService.decrypt(encryptedConfig.accessKeySecret);
    }
    
    console.log('OSS 配置中的敏感信息已解密');
    return decryptedConfig;
  } catch (error) {
    console.error('OSS 配置解密失败:', error);
    throw new Error('无法解密 OSS 配置，可能是密钥错误或数据损坏');
  }
}

// 示例：密码哈希和验证
export function hashUserPassword(password: string): string {
  const encryptionService = getEncryptionService();
  
  // 对用户密码进行哈希处理
  const hashedPassword = encryptionService.hashPassword(password);
  
  console.log('用户密码已哈希处理');
  return hashedPassword;
}

export function verifyUserPassword(password: string, hashedPassword: string): boolean {
  const encryptionService = getEncryptionService();
  
  // 验证用户密码
  const isValid = encryptionService.verifyPassword(password, hashedPassword);
  
  if (isValid) {
    console.log('密码验证成功');
  } else {
    console.log('密码验证失败');
  }
  
  return isValid;
}

// 示例：使用自定义密钥进行加密
export function encryptWithCustomKey(data: string, customKey?: string): string {
  const encryptionService = getEncryptionService();
  
  // 如果没有提供自定义密钥，生成一个新的
  const key = customKey || encryptionService.generateKey();
  
  // 使用自定义密钥加密数据
  const encrypted = encryptionService.encrypt(data, key);
  
  console.log('数据已使用自定义密钥加密');
  console.log('密钥:', key);
  
  return encrypted;
}

// 示例：批量加密配置数据
export function encryptConfigBatch(configs: Record<string, any>): Record<string, string> {
  const encryptionService = getEncryptionService();
  const encryptedConfigs: Record<string, string> = {};
  
  for (const [key, value] of Object.entries(configs)) {
    try {
      // 将配置值序列化并加密
      const serializedValue = JSON.stringify(value);
      encryptedConfigs[key] = encryptionService.encrypt(serializedValue);
      
      console.log(`配置 ${key} 已加密`);
    } catch (error) {
      console.error(`配置 ${key} 加密失败:`, error);
      throw new Error(`无法加密配置 ${key}`);
    }
  }
  
  return encryptedConfigs;
}

// 示例：批量解密配置数据
export function decryptConfigBatch(encryptedConfigs: Record<string, string>): Record<string, any> {
  const encryptionService = getEncryptionService();
  const decryptedConfigs: Record<string, any> = {};
  
  for (const [key, encryptedValue] of Object.entries(encryptedConfigs)) {
    try {
      // 解密并反序列化配置值
      const serializedValue = encryptionService.decrypt(encryptedValue);
      decryptedConfigs[key] = JSON.parse(serializedValue);
      
      console.log(`配置 ${key} 已解密`);
    } catch (error) {
      console.error(`配置 ${key} 解密失败:`, error);
      throw new Error(`无法解密配置 ${key}`);
    }
  }
  
  return decryptedConfigs;
}

// 示例：环境变量中的加密密钥管理
export function initializeEncryptionFromEnv(): AESEncryptionService {
  // 从环境变量获取加密密钥
  const encryptionKey = process.env.ENCRYPTION_KEY || 
                       (typeof window !== 'undefined' && (window as any).VITE_ENCRYPTION_KEY) ||
                       undefined;
  
  if (!encryptionKey) {
    console.warn('未找到环境变量中的加密密钥，将生成新的密钥');
    const newService = new AESEncryptionService();
    const newKey = newService.getDefaultKey();
    
    console.log('新生成的加密密钥:', newKey);
    console.log('请将此密钥保存到环境变量 ENCRYPTION_KEY 中');
    
    return newService;
  }
  
  // 验证密钥格式
  const tempService = new AESEncryptionService();
  if (!tempService.isValidKey(encryptionKey)) {
    throw new Error('环境变量中的加密密钥格式无效');
  }
  
  console.log('已从环境变量加载加密密钥');
  return new AESEncryptionService(encryptionKey);
}

// 示例使用方法
export function demonstrateEncryptionService() {
  console.log('=== 加密服务使用示例 ===');
  
  // 1. 初始化加密服务
  const encryptionService = initializeEncryptionFromEnv();
  
  // 2. 加密 API 配置
  const apiConfig: ApiConfig = {
    apiKey: 'sk-test-api-key-12345',
    baseUrl: 'https://api.example.com',
    timeout: 30000,
    retryCount: 3,
    provider: 'Test Provider'
  };
  
  const encryptedApiConfig = encryptApiConfig(apiConfig);
  const decryptedApiConfig = decryptApiConfig(encryptedApiConfig);
  
  console.log('原始 API 配置:', apiConfig);
  console.log('解密后的 API 配置:', decryptedApiConfig);
  
  // 3. 密码哈希和验证
  const userPassword = 'mySecurePassword123';
  const hashedPassword = hashUserPassword(userPassword);
  const isPasswordValid = verifyUserPassword(userPassword, hashedPassword);
  const isWrongPasswordValid = verifyUserPassword('wrongPassword', hashedPassword);
  
  console.log('密码哈希:', hashedPassword);
  console.log('正确密码验证:', isPasswordValid);
  console.log('错误密码验证:', isWrongPasswordValid);
  
  // 4. 批量配置加密
  const configs = {
    database: { host: 'localhost', password: 'db-secret' },
    redis: { host: 'redis-server', password: 'redis-secret' },
    email: { smtp: 'smtp.example.com', password: 'email-secret' }
  };
  
  const encryptedConfigs = encryptConfigBatch(configs);
  const decryptedConfigs = decryptConfigBatch(encryptedConfigs);
  
  console.log('批量加密配置完成');
  console.log('解密后的配置:', decryptedConfigs);
  
  console.log('=== 示例演示完成 ===');
}

// 如果需要直接运行此文件进行测试，可以取消注释下面的代码
// demonstrateEncryptionService();
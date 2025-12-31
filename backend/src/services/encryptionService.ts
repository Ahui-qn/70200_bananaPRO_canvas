import * as CryptoJS from 'crypto-js';
import { EncryptionService } from '../types';

/**
 * AES-256 加密服务实现
 * 提供数据加密、解密、密钥生成和密码哈希功能
 */
export class AESEncryptionService implements EncryptionService {
  private readonly algorithm = 'AES';
  private readonly keySize = 256 / 32; // 256位密钥，32位为一组
  private readonly ivSize = 128 / 32;  // 128位初始化向量
  private readonly iterations = 10000; // PBKDF2 迭代次数
  private defaultKey: string;

  constructor(defaultKey?: string) {
    // 如果没有提供默认密钥，生成一个
    this.defaultKey = defaultKey || this.generateKey();
  }

  /**
   * 加密数据
   * @param data 要加密的明文数据
   * @param key 可选的加密密钥，如果不提供则使用默认密钥
   * @returns 加密后的字符串，格式为 "salt:iv:encrypted"
   */
  encrypt(data: string, key?: string): string {
    try {
      if (!data) {
        throw new Error('加密数据不能为空');
      }

      const encryptionKey = key || this.defaultKey;
      if (!encryptionKey) {
        throw new Error('加密密钥不能为空');
      }

      // 生成随机盐值
      const salt = CryptoJS.lib.WordArray.random(this.keySize);
      
      // 使用 PBKDF2 从密钥和盐值派生加密密钥
      const derivedKey = CryptoJS.PBKDF2(encryptionKey, salt, {
        keySize: this.keySize,
        iterations: this.iterations,
        hasher: CryptoJS.algo.SHA256
      });

      // 生成随机初始化向量
      const iv = CryptoJS.lib.WordArray.random(this.ivSize);

      // 执行 AES-256-CBC 加密
      const encrypted = CryptoJS.AES.encrypt(data, derivedKey, {
        iv: iv,
        mode: CryptoJS.mode.CBC,
        padding: CryptoJS.pad.Pkcs7
      });

      // 将盐值、IV 和加密数据组合成最终结果
      const result = `${salt.toString(CryptoJS.enc.Hex)}:${iv.toString(CryptoJS.enc.Hex)}:${encrypted.toString()}`;
      
      return result;
    } catch (error) {
      console.error('数据加密失败:', error);
      throw new Error(`加密操作失败: ${(error as Error).message}`);
    }
  }

  /**
   * 解密数据
   * @param encryptedData 加密的数据，格式为 "salt:iv:encrypted"
   * @param key 可选的解密密钥，如果不提供则使用默认密钥
   * @returns 解密后的明文字符串
   */
  decrypt(encryptedData: string, key?: string): string {
    try {
      if (!encryptedData) {
        throw new Error('解密数据不能为空');
      }

      const decryptionKey = key || this.defaultKey;
      if (!decryptionKey) {
        throw new Error('解密密钥不能为空');
      }

      // 解析加密数据的各个部分
      const parts = encryptedData.split(':');
      if (parts.length !== 3) {
        throw new Error('加密数据格式无效，应为 "salt:iv:encrypted" 格式');
      }

      const [saltHex, ivHex, encrypted] = parts;

      // 将十六进制字符串转换回 WordArray
      const salt = CryptoJS.enc.Hex.parse(saltHex);
      const iv = CryptoJS.enc.Hex.parse(ivHex);

      // 使用相同的参数重新派生密钥
      const derivedKey = CryptoJS.PBKDF2(decryptionKey, salt, {
        keySize: this.keySize,
        iterations: this.iterations,
        hasher: CryptoJS.algo.SHA256
      });

      // 执行 AES-256-CBC 解密
      const decrypted = CryptoJS.AES.decrypt(encrypted, derivedKey, {
        iv: iv,
        mode: CryptoJS.mode.CBC,
        padding: CryptoJS.pad.Pkcs7
      });

      // 转换为 UTF-8 字符串
      const result = decrypted.toString(CryptoJS.enc.Utf8);
      
      if (!result) {
        throw new Error('解密失败，可能是密钥错误或数据损坏');
      }

      return result;
    } catch (error) {
      console.error('数据解密失败:', error);
      throw new Error(`解密操作失败: ${(error as Error).message}`);
    }
  }

  /**
   * 生成随机加密密钥
   * @returns 256位随机密钥的十六进制字符串
   */
  generateKey(): string {
    try {
      // 生成 256 位（32 字节）的随机密钥
      const key = CryptoJS.lib.WordArray.random(32);
      return key.toString(CryptoJS.enc.Hex);
    } catch (error) {
      console.error('密钥生成失败:', error);
      throw new Error(`密钥生成失败: ${(error as Error).message}`);
    }
  }

  /**
   * 对密码进行哈希处理
   * @param password 原始密码
   * @returns 哈希后的密码字符串，格式为 "salt:hash"
   */
  hashPassword(password: string): string {
    try {
      if (!password) {
        throw new Error('密码不能为空');
      }

      // 生成随机盐值
      const salt = CryptoJS.lib.WordArray.random(32);
      
      // 使用 PBKDF2 对密码进行哈希
      const hash = CryptoJS.PBKDF2(password, salt, {
        keySize: 32,
        iterations: this.iterations,
        hasher: CryptoJS.algo.SHA256
      });

      // 返回盐值和哈希值的组合
      return `${salt.toString(CryptoJS.enc.Hex)}:${hash.toString(CryptoJS.enc.Hex)}`;
    } catch (error) {
      console.error('密码哈希失败:', error);
      throw new Error(`密码哈希失败: ${(error as Error).message}`);
    }
  }

  /**
   * 验证密码是否正确
   * @param password 要验证的密码
   * @param hash 存储的哈希值，格式为 "salt:hash"
   * @returns 密码是否匹配
   */
  verifyPassword(password: string, hash: string): boolean {
    try {
      if (!password || !hash) {
        return false;
      }

      // 解析存储的哈希值
      const parts = hash.split(':');
      if (parts.length !== 2) {
        throw new Error('哈希格式无效，应为 "salt:hash" 格式');
      }

      const [saltHex, storedHashHex] = parts;
      const salt = CryptoJS.enc.Hex.parse(saltHex);

      // 使用相同的盐值和参数重新计算哈希
      const computedHash = CryptoJS.PBKDF2(password, salt, {
        keySize: 32,
        iterations: this.iterations,
        hasher: CryptoJS.algo.SHA256
      });

      // 比较哈希值
      const computedHashHex = computedHash.toString(CryptoJS.enc.Hex);
      return computedHashHex === storedHashHex;
    } catch (error) {
      console.error('密码验证失败:', error);
      return false;
    }
  }

  /**
   * 设置新的默认密钥
   * @param key 新的默认密钥
   */
  setDefaultKey(key: string): void {
    if (!key) {
      throw new Error('默认密钥不能为空');
    }
    this.defaultKey = key;
  }

  /**
   * 获取当前默认密钥
   * @returns 当前默认密钥
   */
  getDefaultKey(): string {
    return this.defaultKey;
  }

  /**
   * 验证密钥格式是否有效
   * @param key 要验证的密钥
   * @returns 密钥是否有效
   */
  isValidKey(key: string): boolean {
    try {
      // 检查密钥是否为有效的十六进制字符串
      if (!key || typeof key !== 'string') {
        return false;
      }

      // 检查长度（256位 = 64个十六进制字符）
      if (key.length !== 64) {
        return false;
      }

      // 检查是否为有效的十六进制
      const hexRegex = /^[0-9a-fA-F]+$/;
      return hexRegex.test(key);
    } catch {
      return false;
    }
  }
}

// 创建默认的加密服务实例
let defaultEncryptionService: AESEncryptionService | null = null;

/**
 * 获取默认的加密服务实例
 * @param key 可选的默认密钥
 * @returns 加密服务实例
 */
export const getEncryptionService = (key?: string): AESEncryptionService => {
  if (!defaultEncryptionService) {
    // 尝试从环境变量获取密钥
    const envKey = process.env.ENCRYPTION_KEY || 
                   (typeof window !== 'undefined' && (window as any).VITE_ENCRYPTION_KEY) ||
                   undefined;
    defaultEncryptionService = new AESEncryptionService(key || envKey);
  } else if (key && key !== defaultEncryptionService.getDefaultKey()) {
    // 如果提供了新的密钥且与当前不同，更新默认密钥
    defaultEncryptionService.setDefaultKey(key);
  }
  
  return defaultEncryptionService;
};

/**
 * 重置默认加密服务实例
 * 主要用于测试或需要重新初始化的场景
 */
export const resetEncryptionService = (): void => {
  defaultEncryptionService = null;
};
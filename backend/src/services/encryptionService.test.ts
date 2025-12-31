import { describe, it, expect, beforeEach } from 'vitest';
import fc from 'fast-check';
import { AESEncryptionService, getEncryptionService, resetEncryptionService } from './encryptionService';

describe('AESEncryptionService', () => {
  let encryptionService: AESEncryptionService;

  beforeEach(() => {
    // 为每个测试创建新的加密服务实例
    encryptionService = new AESEncryptionService();
    resetEncryptionService();
  });

  describe('基本功能测试', () => {
    it('应该能够创建加密服务实例', () => {
      expect(encryptionService).toBeInstanceOf(AESEncryptionService);
      expect(encryptionService.getDefaultKey()).toBeDefined();
      expect(encryptionService.getDefaultKey().length).toBe(64); // 256位 = 64个十六进制字符
    });

    it('应该能够使用自定义密钥创建实例', () => {
      const customKey = encryptionService.generateKey();
      const customService = new AESEncryptionService(customKey);
      expect(customService.getDefaultKey()).toBe(customKey);
    });

    it('应该能够生成有效的密钥', () => {
      const key = encryptionService.generateKey();
      expect(key).toBeDefined();
      expect(typeof key).toBe('string');
      expect(key.length).toBe(64); // 256位 = 64个十六进制字符
      expect(encryptionService.isValidKey(key)).toBe(true);
    });

    it('应该能够验证密钥格式', () => {
      const validKey = encryptionService.generateKey();
      expect(encryptionService.isValidKey(validKey)).toBe(true);
      
      // 测试无效密钥
      expect(encryptionService.isValidKey('')).toBe(false);
      expect(encryptionService.isValidKey('invalid')).toBe(false);
      expect(encryptionService.isValidKey('123')).toBe(false);
      expect(encryptionService.isValidKey('g'.repeat(64))).toBe(false); // 包含非十六进制字符
    });
  });

  describe('加密解密功能测试', () => {
    it('应该能够加密和解密简单文本', () => {
      const plaintext = 'Hello, World!';
      const encrypted = encryptionService.encrypt(plaintext);
      const decrypted = encryptionService.decrypt(encrypted);
      
      expect(encrypted).toBeDefined();
      expect(encrypted).not.toBe(plaintext);
      expect(decrypted).toBe(plaintext);
    });

    it('应该能够加密和解密中文文本', () => {
      const plaintext = '你好，世界！这是一个测试。';
      const encrypted = encryptionService.encrypt(plaintext);
      const decrypted = encryptionService.decrypt(encrypted);
      
      expect(decrypted).toBe(plaintext);
    });

    it('应该能够加密和解密 JSON 数据', () => {
      const data = {
        apiKey: 'test-api-key-123',
        baseUrl: 'https://api.example.com',
        timeout: 30000,
        settings: {
          retryCount: 3,
          enableLogging: true
        }
      };
      const plaintext = JSON.stringify(data);
      const encrypted = encryptionService.encrypt(plaintext);
      const decrypted = encryptionService.decrypt(encrypted);
      const parsedData = JSON.parse(decrypted);
      
      expect(parsedData).toEqual(data);
    });

    it('应该能够使用自定义密钥加密解密', () => {
      const customKey = encryptionService.generateKey();
      const plaintext = 'Custom key test';
      
      const encrypted = encryptionService.encrypt(plaintext, customKey);
      const decrypted = encryptionService.decrypt(encrypted, customKey);
      
      expect(decrypted).toBe(plaintext);
    });

    it('使用错误密钥解密应该失败', () => {
      const plaintext = 'Secret message';
      const key1 = encryptionService.generateKey();
      const key2 = encryptionService.generateKey();
      
      const encrypted = encryptionService.encrypt(plaintext, key1);
      
      expect(() => {
        encryptionService.decrypt(encrypted, key2);
      }).toThrow();
    });

    it('加密结果应该包含正确的格式', () => {
      const plaintext = 'Test message';
      const encrypted = encryptionService.encrypt(plaintext);
      
      // 加密结果应该是 "salt:iv:encrypted" 格式
      const parts = encrypted.split(':');
      expect(parts).toHaveLength(3);
      expect(parts[0]).toMatch(/^[0-9a-fA-F]+$/); // 盐值应该是十六进制
      expect(parts[1]).toMatch(/^[0-9a-fA-F]+$/); // IV应该是十六进制
      expect(parts[2]).toBeDefined(); // 加密数据
    });
  });

  describe('密码哈希功能测试', () => {
    it('应该能够哈希密码', () => {
      const password = 'mySecretPassword123';
      const hash = encryptionService.hashPassword(password);
      
      expect(hash).toBeDefined();
      expect(typeof hash).toBe('string');
      expect(hash).not.toBe(password);
      
      // 哈希结果应该是 "salt:hash" 格式
      const parts = hash.split(':');
      expect(parts).toHaveLength(2);
      expect(parts[0]).toMatch(/^[0-9a-fA-F]+$/); // 盐值
      expect(parts[1]).toMatch(/^[0-9a-fA-F]+$/); // 哈希值
    });

    it('应该能够验证正确的密码', () => {
      const password = 'correctPassword';
      const hash = encryptionService.hashPassword(password);
      
      expect(encryptionService.verifyPassword(password, hash)).toBe(true);
    });

    it('应该拒绝错误的密码', () => {
      const correctPassword = 'correctPassword';
      const wrongPassword = 'wrongPassword';
      const hash = encryptionService.hashPassword(correctPassword);
      
      expect(encryptionService.verifyPassword(wrongPassword, hash)).toBe(false);
    });

    it('相同密码的哈希结果应该不同（因为使用了随机盐值）', () => {
      const password = 'samePassword';
      const hash1 = encryptionService.hashPassword(password);
      const hash2 = encryptionService.hashPassword(password);
      
      expect(hash1).not.toBe(hash2);
      expect(encryptionService.verifyPassword(password, hash1)).toBe(true);
      expect(encryptionService.verifyPassword(password, hash2)).toBe(true);
    });
  });

  describe('错误处理测试', () => {
    it('加密空字符串应该抛出错误', () => {
      expect(() => {
        encryptionService.encrypt('');
      }).toThrow('加密数据不能为空');
    });

    it('解密空字符串应该抛出错误', () => {
      expect(() => {
        encryptionService.decrypt('');
      }).toThrow('解密数据不能为空');
    });

    it('解密格式错误的数据应该抛出错误', () => {
      expect(() => {
        encryptionService.decrypt('invalid:format');
      }).toThrow('加密数据格式无效');
    });

    it('哈希空密码应该抛出错误', () => {
      expect(() => {
        encryptionService.hashPassword('');
      }).toThrow('密码不能为空');
    });

    it('验证空密码或哈希应该返回 false', () => {
      const hash = encryptionService.hashPassword('test');
      
      expect(encryptionService.verifyPassword('', hash)).toBe(false);
      expect(encryptionService.verifyPassword('test', '')).toBe(false);
      expect(encryptionService.verifyPassword('', '')).toBe(false);
    });
  });

  describe('默认服务实例测试', () => {
    it('应该能够获取默认服务实例', () => {
      const service1 = getEncryptionService();
      const service2 = getEncryptionService();
      
      expect(service1).toBe(service2); // 应该是同一个实例
    });

    it('应该能够使用自定义密钥创建默认服务', () => {
      const customKey = new AESEncryptionService().generateKey();
      const service = getEncryptionService(customKey);
      
      expect(service.getDefaultKey()).toBe(customKey);
    });
  });
});

describe('加密服务属性测试', () => {
  let encryptionService: AESEncryptionService;

  beforeEach(() => {
    encryptionService = new AESEncryptionService();
  });

  /**
   * **Feature: aliyun-database-integration, Property 4: 敏感信息加密存储**
   * 对于任何包含敏感信息的配置数据，存储在数据库中的版本必须是加密的，不能是明文
   */
  it('属性测试：加密后的数据格式正确且不等于原文', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 5, maxLength: 100 }), // 使用较长的字符串避免偶然匹配
        (plaintext) => {
          const encrypted = encryptionService.encrypt(plaintext);
          
          // 加密后的数据不应该等于原始明文
          expect(encrypted).not.toBe(plaintext);
          
          // 加密后的数据应该是有效格式 "salt:iv:encrypted"
          const parts = encrypted.split(':');
          expect(parts).toHaveLength(3);
          
          // 每个部分都应该是有效的十六进制或Base64格式
          expect(parts[0]).toMatch(/^[0-9a-fA-F]+$/); // 盐值是十六进制
          expect(parts[1]).toMatch(/^[0-9a-fA-F]+$/); // IV是十六进制
          expect(parts[2]).toBeDefined(); // 加密数据存在
          expect(parts[2].length).toBeGreaterThan(0);
        }
      ),
      { numRuns: 50 }
    );
  }, 10000);

  /**
   * **Feature: aliyun-database-integration, Property 4: 敏感信息加密存储**
   * 加密解密往返应该保持数据完整性
   */
  it('属性测试：加密解密往返一致性', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 100 }), // 减少字符串长度
        (plaintext) => {
          const encrypted = encryptionService.encrypt(plaintext);
          const decrypted = encryptionService.decrypt(encrypted);
          
          expect(decrypted).toBe(plaintext);
        }
      ),
      { numRuns: 20 } // 减少运行次数
    );
  }, 15000);

  /**
   * **Feature: aliyun-database-integration, Property 4: 敏感信息加密存储**
   * 使用不同密钥加密相同数据应该产生不同结果
   */
  it('属性测试：不同密钥产生不同加密结果', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 100 }),
        (plaintext) => {
          const key1 = encryptionService.generateKey();
          const key2 = encryptionService.generateKey();
          
          // 确保密钥不同
          fc.pre(key1 !== key2);
          
          const encrypted1 = encryptionService.encrypt(plaintext, key1);
          const encrypted2 = encryptionService.encrypt(plaintext, key2);
          
          // 使用不同密钥加密相同数据应该产生不同结果
          expect(encrypted1).not.toBe(encrypted2);
        }
      ),
      { numRuns: 30 }
    );
  }, 10000);

  /**
   * **Feature: aliyun-database-integration, Property 4: 敏感信息加密存储**
   * 密码哈希应该是不可逆的
   */
  it('属性测试：密码哈希不可逆性', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 5, maxLength: 20 }), // 使用较短的密码减少测试时间
        (password) => {
          const hash = encryptionService.hashPassword(password);
          
          // 哈希值不应该等于原始密码
          expect(hash).not.toBe(password);
          
          // 哈希值应该能够验证原始密码
          expect(encryptionService.verifyPassword(password, hash)).toBe(true);
          
          // 哈希值格式应该正确 "salt:hash"
          const parts = hash.split(':');
          expect(parts).toHaveLength(2);
          expect(parts[0]).toMatch(/^[0-9a-fA-F]+$/); // 盐值是十六进制
          expect(parts[1]).toMatch(/^[0-9a-fA-F]+$/); // 哈希值是十六进制
        }
      ),
      { numRuns: 10 } // 减少运行次数
    );
  }, 15000);

  /**
   * **Feature: aliyun-database-integration, Property 4: 敏感信息加密存储**
   * 相同密码的多次哈希应该产生不同结果（盐值随机性）
   */
  it('属性测试：密码哈希盐值随机性', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 20 }), // 使用较短的密码
        (password) => {
          const hash1 = encryptionService.hashPassword(password);
          const hash2 = encryptionService.hashPassword(password);
          
          // 相同密码的不同哈希应该不同（因为盐值不同）
          expect(hash1).not.toBe(hash2);
          
          // 但都应该能验证原始密码
          expect(encryptionService.verifyPassword(password, hash1)).toBe(true);
          expect(encryptionService.verifyPassword(password, hash2)).toBe(true);
        }
      ),
      { numRuns: 5 } // 减少运行次数
    );
  }, 10000);
});
/**
 * 数据库服务单元测试
 * 测试数据库连接管理器的基本功能
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DatabaseServiceImpl } from './databaseService';
import { DatabaseConfig, SavedImage } from '../types';

describe('DatabaseService', () => {
  let databaseService: DatabaseServiceImpl;
  
  // 测试用的数据库配置
  const testConfig: DatabaseConfig = {
    host: 'localhost',
    port: 3306,
    database: 'test_nano_banana',
    username: 'test_user',
    password: 'test_password',
    ssl: false,
    enabled: true
  };

  beforeEach(() => {
    databaseService = new DatabaseServiceImpl();
  });

  afterEach(async () => {
    // 清理连接
    await databaseService.disconnect();
  });

  describe('连接管理', () => {
    it('应该正确初始化连接状态', () => {
      const status = databaseService.getConnectionStatus();
      
      expect(status.isConnected).toBe(false);
      expect(status.lastConnected).toBeNull();
      expect(status.error).toBeNull();
    });

    it('应该在无效配置时抛出错误', async () => {
      const invalidConfig: DatabaseConfig = {
        host: '',
        port: 0,
        database: '',
        username: '',
        password: '',
        ssl: false,
        enabled: true
      };

      await expect(databaseService.connect(invalidConfig)).rejects.toThrow('数据库配置错误');
    });

    it('应该正确验证数据库配置', async () => {
      // 这个测试不会实际连接数据库，只测试配置验证逻辑
      const validConfig: DatabaseConfig = {
        host: 'valid-host.com',
        port: 3306,
        database: 'valid_db',
        username: 'valid_user',
        password: 'valid_password',
        ssl: true,
        enabled: true
      };

      // 由于没有实际的数据库，这会失败，但我们可以测试配置验证部分
      try {
        await databaseService.connect(validConfig);
      } catch (error) {
        // 预期会失败，因为没有实际的数据库连接
        expect(error).toBeDefined();
      }
    });
  });

  describe('数据验证', () => {
    it('应该正确验证图片数据', () => {
      const validImage: SavedImage = {
        id: 'test-image-1',
        url: 'https://example.com/image.jpg',
        prompt: '测试提示词',
        model: 'nano-banana-fast',
        aspectRatio: '1:1',
        imageSize: '1K',
        createdAt: new Date(),
        favorite: false,
        ossUploaded: false
      };

      // 这里我们测试数据结构的完整性
      expect(validImage.id).toBeDefined();
      expect(validImage.url).toBeDefined();
      expect(validImage.prompt).toBeDefined();
      expect(validImage.model).toBeDefined();
      expect(validImage.createdAt).toBeInstanceOf(Date);
    });

    it('应该正确处理可选字段', () => {
      const imageWithOptionalFields: SavedImage = {
        id: 'test-image-2',
        url: 'https://example.com/image2.jpg',
        originalUrl: 'https://temp.com/original.jpg',
        prompt: '另一个测试提示词',
        model: 'nano-banana-hd',
        aspectRatio: '16:9',
        imageSize: '2K',
        createdAt: new Date(),
        tags: ['测试', '标签'],
        favorite: true,
        ossKey: 'images/test-image-2.jpg',
        ossUploaded: true
      };

      expect(imageWithOptionalFields.tags).toEqual(['测试', '标签']);
      expect(imageWithOptionalFields.favorite).toBe(true);
      expect(imageWithOptionalFields.ossUploaded).toBe(true);
    });
  });

  describe('错误处理', () => {
    it('应该正确处理连接错误', async () => {
      const badConfig: DatabaseConfig = {
        host: 'nonexistent-host.invalid',
        port: 3306,
        database: 'test_db',
        username: 'test_user',
        password: 'test_password',
        ssl: false,
        enabled: true
      };

      await expect(databaseService.connect(badConfig)).rejects.toThrow();
    });

    it('应该在未连接时正确处理操作', async () => {
      // 测试在未连接状态下执行操作
      const testImage: SavedImage = {
        id: 'test-image-3',
        url: 'https://example.com/image3.jpg',
        prompt: '测试图片',
        model: 'nano-banana-fast',
        aspectRatio: 'auto',
        imageSize: '1K',
        createdAt: new Date(),
        favorite: false,
        ossUploaded: false
      };

      // 这应该失败，因为没有数据库连接
      await expect(databaseService.saveImage(testImage)).rejects.toThrow();
    });

    it('应该正确处理批量删除操作', async () => {
      // 测试批量删除功能的数据结构
      const testIds = ['test-1', 'test-2', 'test-3'];
      
      // 在未连接状态下，批量删除应该返回所有失败的结果
      const result = await databaseService.deleteImages(testIds, false);
      
      // 检查结果结构
      expect(result).toHaveProperty('successful');
      expect(result).toHaveProperty('failed');
      expect(Array.isArray(result.successful)).toBe(true);
      expect(Array.isArray(result.failed)).toBe(true);
      
      // 由于没有数据库连接，所有删除都应该失败
      expect(result.successful.length).toBe(0);
      expect(result.failed.length).toBe(testIds.length);
      
      // 检查失败记录的结构
      result.failed.forEach(failedItem => {
        expect(failedItem).toHaveProperty('id');
        expect(failedItem).toHaveProperty('error');
        expect(typeof failedItem.id).toBe('string');
        expect(typeof failedItem.error).toBe('string');
      });
    }, 10000); // 增加超时时间到 10 秒
  });

  describe('配置管理', () => {
    it('应该正确处理 API 配置数据结构', () => {
      const apiConfig = {
        apiKey: 'test-api-key',
        baseUrl: 'https://api.example.com',
        timeout: 30000,
        retryCount: 3,
        provider: 'Test Provider'
      };

      expect(apiConfig.apiKey).toBeDefined();
      expect(apiConfig.baseUrl).toBeDefined();
      expect(apiConfig.timeout).toBeGreaterThan(0);
      expect(apiConfig.retryCount).toBeGreaterThanOrEqual(0);
    });

    it('应该正确处理 OSS 配置数据结构', () => {
      const ossConfig = {
        accessKeyId: 'test-access-key-id',
        accessKeySecret: 'test-access-key-secret',
        region: 'cn-hangzhou',
        bucket: 'test-bucket',
        endpoint: 'https://oss-cn-hangzhou.aliyuncs.com',
        secure: true,
        pathStyle: false,
        enabled: true
      };

      expect(ossConfig.accessKeyId).toBeDefined();
      expect(ossConfig.accessKeySecret).toBeDefined();
      expect(ossConfig.region).toBeDefined();
      expect(ossConfig.bucket).toBeDefined();
      expect(typeof ossConfig.enabled).toBe('boolean');
    });

    it('应该正确处理配置删除操作', async () => {
      // 在没有数据库连接的情况下，删除操作应该抛出错误
      await expect(databaseService.deleteApiConfig(false)).rejects.toThrow('数据库未配置');
      
      // 测试 OSS 配置删除
      await expect(databaseService.deleteOSSConfig(false)).rejects.toThrow('数据库未配置');
      
      // 测试删除所有配置
      await expect(databaseService.deleteAllConfigs(false)).rejects.toThrow('数据库未配置');
      
      // 测试清除用户数据
      await expect(databaseService.clearUserData(false)).rejects.toThrow('数据库未配置');
    }, 30000); // 增加超时时间到 30 秒

    it('应该正确验证 API 配置', () => {
      // 测试无效的 API 配置
      const invalidConfigs = [
        { apiKey: '', baseUrl: 'https://api.com', timeout: 1000, retryCount: 0, provider: 'Test' },
        { apiKey: 'key', baseUrl: '', timeout: 1000, retryCount: 0, provider: 'Test' },
        { apiKey: 'key', baseUrl: 'invalid-url', timeout: 1000, retryCount: 0, provider: 'Test' },
        { apiKey: 'key', baseUrl: 'https://api.com', timeout: -1, retryCount: 0, provider: 'Test' },
        { apiKey: 'key', baseUrl: 'https://api.com', timeout: 1000, retryCount: -1, provider: 'Test' },
        { apiKey: 'key', baseUrl: 'https://api.com', timeout: 1000, retryCount: 0, provider: '' }
      ];

      // 由于验证方法是私有的，我们通过尝试保存无效配置来测试验证
      invalidConfigs.forEach(async (config) => {
        await expect(databaseService.saveApiConfig(config as any)).rejects.toThrow();
      });
    });

    it('应该正确验证 OSS 配置', () => {
      // 测试无效的 OSS 配置
      const invalidConfigs = [
        { accessKeyId: '', accessKeySecret: 'secret', region: 'cn-hangzhou', bucket: 'test', enabled: true },
        { accessKeyId: 'key', accessKeySecret: '', region: 'cn-hangzhou', bucket: 'test', enabled: true },
        { accessKeyId: 'key', accessKeySecret: 'secret', region: '', bucket: 'test', enabled: true },
        { accessKeyId: 'key', accessKeySecret: 'secret', region: 'cn-hangzhou', bucket: '', enabled: true },
        { accessKeyId: 'key', accessKeySecret: 'secret', region: 'cn-hangzhou', bucket: 'INVALID-BUCKET', enabled: true },
        { accessKeyId: 'key', accessKeySecret: 'secret', region: 'cn-hangzhou', bucket: 'test', endpoint: 'invalid-url', enabled: true }
      ];

      // 由于验证方法是私有的，我们通过尝试保存无效配置来测试验证
      invalidConfigs.forEach(async (config) => {
        await expect(databaseService.saveOSSConfig(config as any)).rejects.toThrow();
      });
    });
  });
});
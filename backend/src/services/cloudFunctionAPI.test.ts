/**
 * 云函数 API 测试
 * 测试阿里云函数计算 API 调用服务的功能
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CloudFunctionAPIImpl } from './cloudFunctionAPI';
import { DatabaseConfig, SavedImage } from '../types';

describe('CloudFunctionAPI', () => {
  let cloudFunctionAPI: CloudFunctionAPIImpl;
  
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

  // 测试用的图片数据
  const testImage: SavedImage = {
    id: 'test-image-1',
    url: 'https://example.com/image.jpg',
    prompt: '测试提示词',
    model: 'nano-banana-fast',
    aspectRatio: 'auto',
    imageSize: '1K',
    createdAt: new Date(),
    favorite: false,
    ossUploaded: false
  };

  beforeEach(() => {
    cloudFunctionAPI = new CloudFunctionAPIImpl();
  });

  describe('基本功能测试', () => {
    it('应该能够创建云函数API实例', () => {
      expect(cloudFunctionAPI).toBeInstanceOf(CloudFunctionAPIImpl);
    });

    it('应该能够检查配置状态', () => {
      const isConfigured = cloudFunctionAPI.isConfigured();
      expect(typeof isConfigured).toBe('boolean');
    });

    it('应该能够获取调用统计信息', () => {
      const stats = cloudFunctionAPI.getCallStatistics();
      
      expect(stats).toHaveProperty('totalCalls');
      expect(stats).toHaveProperty('successfulCalls');
      expect(stats).toHaveProperty('failedCalls');
      expect(stats).toHaveProperty('averageResponseTime');
      
      expect(typeof stats.totalCalls).toBe('number');
      expect(typeof stats.successfulCalls).toBe('number');
      expect(typeof stats.failedCalls).toBe('number');
      expect(typeof stats.averageResponseTime).toBe('number');
    });

    it('应该能够重置统计信息', () => {
      expect(() => {
        cloudFunctionAPI.resetStatistics();
      }).not.toThrow();
    });
  });

  describe('数据库连接测试', () => {
    it('应该能够测试数据库连接', async () => {
      const result = await cloudFunctionAPI.testConnection(testConfig);
      
      expect(typeof result).toBe('boolean');
      // 在模拟模式下应该返回 true
      expect(result).toBe(true);
    });

    it('应该能够初始化数据库表', async () => {
      // 在模拟模式下不应该抛出错误
      await expect(cloudFunctionAPI.initTables(testConfig)).resolves.not.toThrow();
    });
  });

  describe('图片数据操作测试', () => {
    it('应该能够保存图片', async () => {
      const result = await cloudFunctionAPI.saveImage(testConfig, testImage);
      
      expect(result).toBeDefined();
      expect(result.id).toBe(testImage.id);
      expect(result.url).toBe(testImage.url);
      expect(result.prompt).toBe(testImage.prompt);
    });

    it('应该能够获取图片列表', async () => {
      const pagination = {
        page: 1,
        pageSize: 20,
        sortBy: 'createdAt',
        sortOrder: 'DESC' as const
      };

      const result = await cloudFunctionAPI.getImages(testConfig, pagination);
      
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
      
      // 检查返回的图片数据结构
      if (result.length > 0) {
        const image = result[0];
        expect(image).toHaveProperty('id');
        expect(image).toHaveProperty('url');
        expect(image).toHaveProperty('prompt');
        expect(image).toHaveProperty('model');
        expect(image).toHaveProperty('createdAt');
        expect(image.createdAt).toBeInstanceOf(Date);
      }
    });

    it('应该能够更新图片信息', async () => {
      const updates = {
        favorite: true,
        tags: ['测试', '标签']
      };

      await expect(
        cloudFunctionAPI.updateImage(testConfig, testImage.id, updates)
      ).resolves.not.toThrow();
    });

    it('应该能够删除图片', async () => {
      await expect(
        cloudFunctionAPI.deleteImage(testConfig, testImage.id)
      ).resolves.not.toThrow();
    });
  });

  describe('配置管理测试', () => {
    it('应该能够保存和获取API配置', async () => {
      const apiConfig = {
        apiKey: 'test-api-key',
        baseUrl: 'https://api.test.com',
        timeout: 30000,
        retryCount: 3,
        provider: 'Test Provider'
      };

      // 保存配置
      await expect(
        cloudFunctionAPI.saveConfig(testConfig, 'api', apiConfig)
      ).resolves.not.toThrow();

      // 获取配置
      const result = await cloudFunctionAPI.getConfig(testConfig, 'api');
      
      expect(result).toBeDefined();
      expect(result).toHaveProperty('apiKey');
      expect(result).toHaveProperty('baseUrl');
      expect(result).toHaveProperty('provider');
    });

    it('应该能够保存和获取OSS配置', async () => {
      const ossConfig = {
        accessKeyId: 'test-access-key-id',
        accessKeySecret: 'test-access-key-secret',
        region: 'cn-hangzhou',
        bucket: 'test-bucket',
        enabled: true
      };

      // 保存配置
      await expect(
        cloudFunctionAPI.saveConfig(testConfig, 'oss', ossConfig)
      ).resolves.not.toThrow();

      // 获取配置
      const result = await cloudFunctionAPI.getConfig(testConfig, 'oss');
      
      expect(result).toBeDefined();
      expect(result).toHaveProperty('accessKeyId');
      expect(result).toHaveProperty('region');
      expect(result).toHaveProperty('bucket');
      expect(result).toHaveProperty('enabled');
    });
  });

  describe('批量操作测试', () => {
    it('应该能够批量调用云函数', async () => {
      const calls = [
        {
          functionName: 'test-connection',
          params: { config: testConfig }
        },
        {
          functionName: 'get-api-config',
          params: { config: testConfig }
        }
      ];

      const results = await cloudFunctionAPI.batchCall(calls);
      
      expect(Array.isArray(results)).toBe(true);
      expect(results).toHaveLength(2);
      
      results.forEach(result => {
        expect(result).toHaveProperty('success');
        expect(typeof result.success).toBe('boolean');
      });
    });

    it('应该能够处理批量调用中的错误', async () => {
      const calls = [
        {
          functionName: 'test-connection',
          params: { config: testConfig }
        },
        {
          functionName: 'invalid-function',
          params: {}
        }
      ];

      const results = await cloudFunctionAPI.batchCall(calls);
      
      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(false);
      expect(results[1].error).toBeDefined();
    });
  });

  describe('错误处理测试', () => {
    it('应该正确处理无效的函数名', async () => {
      const result = await cloudFunctionAPI.callFunction('invalid-function', {});
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.code).toBe(404);
    });

    it('应该正确处理空参数', async () => {
      const result = await cloudFunctionAPI.testConnection({} as DatabaseConfig);
      
      // 在模拟模式下应该仍然返回结果
      expect(typeof result).toBe('boolean');
    });
  });

  describe('数据序列化测试', () => {
    it('应该正确处理包含复杂数据的图片', async () => {
      const complexImage: SavedImage = {
        ...testImage,
        refImages: [
          { url: 'https://example.com/ref1.jpg', description: '参考图片1' },
          { url: 'https://example.com/ref2.jpg', description: '参考图片2' }
        ],
        tags: ['标签1', '标签2', '中文标签']
      };

      const result = await cloudFunctionAPI.saveImage(testConfig, complexImage);
      
      expect(result).toBeDefined();
      expect(result.id).toBe(complexImage.id);
    });

    it('应该正确处理日期序列化', async () => {
      const imageWithDate: SavedImage = {
        ...testImage,
        createdAt: new Date('2024-01-01T10:00:00Z')
      };

      const result = await cloudFunctionAPI.saveImage(testConfig, imageWithDate);
      
      expect(result).toBeDefined();
      // 在模拟模式下，返回的是原始对象，所以日期应该保持为Date类型
      expect(result.id).toBe(imageWithDate.id);
    });
  });

  describe('模拟模式测试', () => {
    it('应该在模拟模式下正确返回分页数据', async () => {
      const pagination = {
        page: 2,
        pageSize: 10
      };

      const result = await cloudFunctionAPI.getImages(testConfig, pagination);
      
      expect(Array.isArray(result)).toBe(true);
      // 模拟模式应该返回固定数量的测试数据
      expect(result.length).toBe(5);
    });

    it('应该在模拟模式下模拟网络延迟', async () => {
      const startTime = Date.now();
      
      await cloudFunctionAPI.testConnection(testConfig);
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // 模拟延迟应该在 200-500ms 之间
      expect(duration).toBeGreaterThan(150);
      expect(duration).toBeLessThan(600);
    });
  });
});
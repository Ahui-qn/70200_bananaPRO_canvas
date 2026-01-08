/**
 * 本地存储服务单元测试
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import { LocalStorageService } from './localStorageService.js';

// 测试目录
const TEST_BASE_PATH = '/tmp/test-local-storage';
const TEST_SERVER_URL = 'http://localhost:3000';

describe('LocalStorageService', () => {
  let service: LocalStorageService;

  beforeEach(async () => {
    // 创建测试目录
    await fs.mkdir(TEST_BASE_PATH, { recursive: true });
    
    // 设置环境变量
    process.env.LOCAL_STORAGE_PATH = TEST_BASE_PATH;
    process.env.LOCAL_SERVER_URL = TEST_SERVER_URL;
    
    // 创建新的服务实例
    service = new LocalStorageService();
  });

  afterEach(async () => {
    // 清理测试目录
    try {
      await fs.rm(TEST_BASE_PATH, { recursive: true, force: true });
    } catch {
      // 忽略清理错误
    }
    
    // 清理环境变量
    delete process.env.LOCAL_STORAGE_PATH;
    delete process.env.LOCAL_SERVER_URL;
  });

  describe('initialize', () => {
    it('应该成功初始化配置', () => {
      const result = service.initialize();
      
      expect(result).toBe(true);
      expect(service.isConfigured()).toBe(true);
    });

    it('配置不完整时应该返回 false', () => {
      delete process.env.LOCAL_STORAGE_PATH;
      
      const result = service.initialize();
      
      expect(result).toBe(false);
      expect(service.isConfigured()).toBe(false);
    });

    it('应该移除服务器 URL 末尾的斜杠', () => {
      process.env.LOCAL_SERVER_URL = 'http://localhost:3000/';
      service.initialize();
      
      const config = service.getConfigInfo();
      expect(config?.serverUrl).toBe('http://localhost:3000');
    });
  });

  describe('uploadFromBuffer', () => {
    beforeEach(() => {
      service.initialize();
    });

    it('应该成功保存图片到本地', async () => {
      const testBuffer = Buffer.from('test image data');
      
      const result = await service.uploadFromBuffer(testBuffer, 'image/jpeg');
      
      expect(result.url).toContain(TEST_SERVER_URL);
      expect(result.url).toContain('/api/static-images/');
      expect(result.key).toMatch(/nano-banana\/\d{4}\/\d{2}\/\d{2}\/\d+_\w+\.jpg/);
      expect(result.size).toBe(testBuffer.length);
      
      // 验证文件确实被创建
      const fullPath = path.join(TEST_BASE_PATH, result.key);
      const savedContent = await fs.readFile(fullPath);
      expect(savedContent.toString()).toBe('test image data');
    });

    it('应该自动创建不存在的目录', async () => {
      const testBuffer = Buffer.from('test');
      
      const result = await service.uploadFromBuffer(testBuffer, 'image/jpeg');
      
      // 验证目录被创建
      const dirPath = path.dirname(path.join(TEST_BASE_PATH, result.key));
      const stat = await fs.stat(dirPath);
      expect(stat.isDirectory()).toBe(true);
    });

    it('应该支持自定义键名', async () => {
      const testBuffer = Buffer.from('test');
      const customKey = 'custom/path/image.jpg';
      
      const result = await service.uploadFromBuffer(testBuffer, 'image/jpeg', customKey);
      
      expect(result.key).toBe(customKey);
      expect(result.url).toContain(customKey);
    });

    it('未初始化时应该抛出错误', async () => {
      const uninitializedService = new LocalStorageService();
      const testBuffer = Buffer.from('test');
      
      await expect(uninitializedService.uploadFromBuffer(testBuffer, 'image/jpeg'))
        .rejects.toThrow('本地存储服务未初始化');
    });
  });

  describe('uploadThumbnail', () => {
    beforeEach(() => {
      service.initialize();
    });

    it('应该保存缩略图并使用正确的键名', async () => {
      const thumbBuffer = Buffer.from('thumbnail data');
      const originalKey = 'nano-banana/2024/01/02/test.jpg';
      
      const result = await service.uploadThumbnail(thumbBuffer, originalKey);
      
      expect(result.key).toBe('nano-banana/2024/01/02/test_thumb.webp');
      expect(result.url).toContain('test_thumb.webp');
      
      // 验证文件被创建
      const fullPath = path.join(TEST_BASE_PATH, result.key);
      const savedContent = await fs.readFile(fullPath);
      expect(savedContent.toString()).toBe('thumbnail data');
    });
  });

  describe('generateThumbnail', () => {
    beforeEach(() => {
      service.initialize();
    });

    it('应该生成 WebP 格式的缩略图', async () => {
      // 创建一个简单的测试图片（1x1 红色像素的 PNG）
      const sharp = (await import('sharp')).default;
      const testImage = await sharp({
        create: {
          width: 800,
          height: 600,
          channels: 3,
          background: { r: 255, g: 0, b: 0 }
        }
      }).png().toBuffer();
      
      const thumbnail = await service.generateThumbnail(testImage);
      
      // 验证是 WebP 格式（WebP 文件头是 RIFF...WEBP）
      expect(thumbnail.slice(0, 4).toString()).toBe('RIFF');
      expect(thumbnail.slice(8, 12).toString()).toBe('WEBP');
      
      // 验证尺寸被缩小
      const metadata = await sharp(thumbnail).metadata();
      expect(metadata.width).toBeLessThanOrEqual(400);
      expect(metadata.height).toBeLessThanOrEqual(400);
    });
  });

  describe('deleteObject', () => {
    beforeEach(() => {
      service.initialize();
    });

    it('应该删除文件', async () => {
      // 先创建一个文件
      const testBuffer = Buffer.from('test');
      const result = await service.uploadFromBuffer(testBuffer, 'image/jpeg');
      
      // 删除文件
      const deleteResult = await service.deleteObject(result.key);
      
      expect(deleteResult).toBe(true);
      
      // 验证文件不存在
      const fullPath = path.join(TEST_BASE_PATH, result.key);
      await expect(fs.access(fullPath)).rejects.toThrow();
    });

    it('应该同时删除缩略图', async () => {
      // 创建原图和缩略图
      const testBuffer = Buffer.from('test');
      const result = await service.uploadFromBuffer(testBuffer, 'image/jpeg');
      await service.uploadThumbnail(Buffer.from('thumb'), result.key);
      
      // 删除
      await service.deleteObject(result.key);
      
      // 验证缩略图也被删除
      const thumbKey = result.key.replace(/\.[^.]+$/, '_thumb.webp');
      const thumbPath = path.join(TEST_BASE_PATH, thumbKey);
      await expect(fs.access(thumbPath)).rejects.toThrow();
    });

    it('文件不存在时应该返回 true', async () => {
      const result = await service.deleteObject('nonexistent/file.jpg');
      expect(result).toBe(true);
    });
  });

  describe('deleteObjects', () => {
    beforeEach(() => {
      service.initialize();
    });

    it('应该批量删除文件', async () => {
      // 创建多个文件
      const keys: string[] = [];
      for (let i = 0; i < 3; i++) {
        const result = await service.uploadFromBuffer(Buffer.from(`test${i}`), 'image/jpeg');
        keys.push(result.key);
      }
      
      // 批量删除
      const result = await service.deleteObjects(keys);
      
      expect(result.success).toBe(3);
      expect(result.failed).toBe(0);
    });
  });

  describe('testConnection', () => {
    beforeEach(() => {
      service.initialize();
    });

    it('目录可访问时应该返回 true', async () => {
      const result = await service.testConnection();
      expect(result).toBe(true);
    });

    it('目录不存在时应该抛出错误', async () => {
      // 删除测试目录
      await fs.rm(TEST_BASE_PATH, { recursive: true, force: true });
      
      await expect(service.testConnection()).rejects.toThrow();
    });
  });

  describe('getConfigInfo', () => {
    it('初始化后应该返回配置信息', () => {
      service.initialize();
      
      const config = service.getConfigInfo();
      
      expect(config).toEqual({
        basePath: TEST_BASE_PATH,
        serverUrl: TEST_SERVER_URL
      });
    });

    it('未初始化时应该返回 null', () => {
      const uninitializedService = new LocalStorageService();
      
      const config = uninitializedService.getConfigInfo();
      
      expect(config).toBeNull();
    });
  });
});

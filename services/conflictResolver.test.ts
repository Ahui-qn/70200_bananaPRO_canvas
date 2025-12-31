/**
 * 冲突解决器测试
 * 验证数据冲突检测和解决机制的正确性
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { 
  ConflictResolver, 
  ConflictType, 
  ConflictResolutionStrategy 
} from './conflictResolver';
import { SavedImage, ApiConfig } from '../types';

describe('ConflictResolver', () => {
  let conflictResolver: ConflictResolver;

  beforeEach(() => {
    conflictResolver = new ConflictResolver();
    conflictResolver.clearConflictLogs();
  });

  describe('冲突检测', () => {
    it('应该检测到图片数据的字段冲突', () => {
      const localImage: SavedImage = {
        id: 'test-image-1',
        url: 'https://example.com/image1.jpg',
        prompt: '本地提示词',
        model: 'nano-banana-fast',
        aspectRatio: 'auto',
        imageSize: '1K',
        createdAt: new Date('2024-01-01T10:00:00Z'),
        favorite: true
      };

      const remoteImage: SavedImage = {
        id: 'test-image-1',
        url: 'https://example.com/image1.jpg',
        prompt: '远程提示词', // 不同的提示词
        model: 'nano-banana-fast',
        aspectRatio: 'auto',
        imageSize: '1K',
        createdAt: new Date('2024-01-01T09:00:00Z'), // 更早的时间
        favorite: false // 不同的收藏状态
      };

      const conflict = conflictResolver.detectConflict(
        localImage,
        remoteImage,
        'test-image-1',
        'images'
      );

      expect(conflict).not.toBeNull();
      expect(conflict!.type).toBe(ConflictType.IMAGE_UPDATE);
      expect(conflict!.conflictFields).toContain('prompt');
      expect(conflict!.conflictFields).toContain('favorite');
      expect(conflict!.localTimestamp > conflict!.remoteTimestamp).toBe(true);
    });

    it('应该检测到API配置的冲突', () => {
      const localConfig: ApiConfig = {
        apiKey: 'local-key-123',
        baseUrl: 'https://api.local.com',
        timeout: 30000,
        retryCount: 3,
        provider: 'Local Provider'
      };

      const remoteConfig: ApiConfig = {
        apiKey: 'remote-key-456', // 不同的API密钥
        baseUrl: 'https://api.remote.com', // 不同的基础URL
        timeout: 30000,
        retryCount: 3,
        provider: 'Remote Provider' // 不同的提供商
      };

      const conflict = conflictResolver.detectConflict(
        { ...localConfig, updatedAt: new Date('2024-01-01T12:00:00Z') },
        { ...remoteConfig, updatedAt: new Date('2024-01-01T11:00:00Z') },
        'api_config',
        'user_configs'
      );

      expect(conflict).not.toBeNull();
      expect(conflict!.type).toBe(ConflictType.CONFIG_UPDATE);
      expect(conflict!.conflictFields).toContain('apiKey');
      expect(conflict!.conflictFields).toContain('baseUrl');
      expect(conflict!.conflictFields).toContain('provider');
    });

    it('相同数据不应该产生冲突', () => {
      const image1: SavedImage = {
        id: 'test-image-1',
        url: 'https://example.com/image1.jpg',
        prompt: '相同提示词',
        model: 'nano-banana-fast',
        aspectRatio: 'auto',
        imageSize: '1K',
        createdAt: new Date('2024-01-01T10:00:00Z'),
        favorite: true
      };

      const image2: SavedImage = { ...image1 };

      const conflict = conflictResolver.detectConflict(
        image1,
        image2,
        'test-image-1',
        'images'
      );

      expect(conflict).toBeNull();
    });

    it('相同时间戳不应该产生冲突', () => {
      const sameTime = new Date('2024-01-01T10:00:00Z');
      
      const localImage: SavedImage = {
        id: 'test-image-1',
        url: 'https://example.com/image1.jpg',
        prompt: '本地提示词',
        model: 'nano-banana-fast',
        aspectRatio: 'auto',
        imageSize: '1K',
        createdAt: sameTime,
        favorite: true
      };

      const remoteImage: SavedImage = {
        id: 'test-image-1',
        url: 'https://example.com/image1.jpg',
        prompt: '远程提示词',
        model: 'nano-banana-fast',
        aspectRatio: 'auto',
        imageSize: '1K',
        createdAt: sameTime, // 相同时间戳
        favorite: false
      };

      const conflict = conflictResolver.detectConflict(
        localImage,
        remoteImage,
        'test-image-1',
        'images'
      );

      expect(conflict).toBeNull();
    });
  });

  describe('冲突解决', () => {
    it('应该使用最新时间戳策略解决冲突', () => {
      const localImage: SavedImage = {
        id: 'test-image-1',
        url: 'https://example.com/image1.jpg',
        prompt: '本地提示词',
        model: 'nano-banana-fast',
        aspectRatio: 'auto',
        imageSize: '1K',
        createdAt: new Date('2024-01-01T12:00:00Z'), // 更新的时间
        favorite: true
      };

      const remoteImage: SavedImage = {
        id: 'test-image-1',
        url: 'https://example.com/image1.jpg',
        prompt: '远程提示词',
        model: 'nano-banana-fast',
        aspectRatio: 'auto',
        imageSize: '1K',
        createdAt: new Date('2024-01-01T10:00:00Z'), // 较旧的时间
        favorite: false
      };

      const conflict = conflictResolver.detectConflict(
        localImage,
        remoteImage,
        'test-image-1',
        'images'
      );

      expect(conflict).not.toBeNull();

      const resolution = conflictResolver.resolveConflict(
        conflict!,
        ConflictResolutionStrategy.LATEST_WINS
      );

      expect(resolution.resolved).toBe(true);
      expect(resolution.strategy).toBe(ConflictResolutionStrategy.LATEST_WINS);
      expect(resolution.finalData.prompt).toBe('本地提示词'); // 应该使用更新的本地数据
      expect(resolution.finalData.favorite).toBe(true);
    });

    it('应该使用本地优先策略解决冲突', () => {
      const localImage: SavedImage = {
        id: 'test-image-1',
        url: 'https://example.com/image1.jpg',
        prompt: '本地提示词',
        model: 'nano-banana-fast',
        aspectRatio: 'auto',
        imageSize: '1K',
        createdAt: new Date('2024-01-01T10:00:00Z'), // 较旧的时间
        favorite: true
      };

      const remoteImage: SavedImage = {
        id: 'test-image-1',
        url: 'https://example.com/image1.jpg',
        prompt: '远程提示词',
        model: 'nano-banana-fast',
        aspectRatio: 'auto',
        imageSize: '1K',
        createdAt: new Date('2024-01-01T12:00:00Z'), // 更新的时间
        favorite: false
      };

      const conflict = conflictResolver.detectConflict(
        localImage,
        remoteImage,
        'test-image-1',
        'images'
      );

      expect(conflict).not.toBeNull();

      const resolution = conflictResolver.resolveConflict(
        conflict!,
        ConflictResolutionStrategy.LOCAL_WINS
      );

      expect(resolution.resolved).toBe(true);
      expect(resolution.strategy).toBe(ConflictResolutionStrategy.LOCAL_WINS);
      expect(resolution.finalData.prompt).toBe('本地提示词'); // 应该使用本地数据
      expect(resolution.finalData.favorite).toBe(true);
    });

    it('应该使用远程优先策略解决冲突', () => {
      const localImage: SavedImage = {
        id: 'test-image-1',
        url: 'https://example.com/image1.jpg',
        prompt: '本地提示词',
        model: 'nano-banana-fast',
        aspectRatio: 'auto',
        imageSize: '1K',
        createdAt: new Date('2024-01-01T12:00:00Z'), // 更新的时间
        favorite: true
      };

      const remoteImage: SavedImage = {
        id: 'test-image-1',
        url: 'https://example.com/image1.jpg',
        prompt: '远程提示词',
        model: 'nano-banana-fast',
        aspectRatio: 'auto',
        imageSize: '1K',
        createdAt: new Date('2024-01-01T10:00:00Z'), // 较旧的时间
        favorite: false
      };

      const conflict = conflictResolver.detectConflict(
        localImage,
        remoteImage,
        'test-image-1',
        'images'
      );

      expect(conflict).not.toBeNull();

      const resolution = conflictResolver.resolveConflict(
        conflict!,
        ConflictResolutionStrategy.REMOTE_WINS
      );

      expect(resolution.resolved).toBe(true);
      expect(resolution.strategy).toBe(ConflictResolutionStrategy.REMOTE_WINS);
      expect(resolution.finalData.prompt).toBe('远程提示词'); // 应该使用远程数据
      expect(resolution.finalData.favorite).toBe(false);
    });
  });

  describe('批量冲突解决', () => {
    it('应该能够批量解决多个冲突', () => {
      const conflicts = [
        conflictResolver.detectConflict(
          {
            id: 'image-1',
            prompt: '本地提示词1',
            createdAt: new Date('2024-01-01T12:00:00Z')
          },
          {
            id: 'image-1',
            prompt: '远程提示词1',
            createdAt: new Date('2024-01-01T10:00:00Z')
          },
          'image-1',
          'images'
        ),
        conflictResolver.detectConflict(
          {
            id: 'image-2',
            prompt: '本地提示词2',
            createdAt: new Date('2024-01-01T11:00:00Z')
          },
          {
            id: 'image-2',
            prompt: '远程提示词2',
            createdAt: new Date('2024-01-01T13:00:00Z')
          },
          'image-2',
          'images'
        )
      ].filter(c => c !== null);

      const resolutions = conflictResolver.resolveConflicts(
        conflicts,
        ConflictResolutionStrategy.LATEST_WINS
      );

      expect(resolutions).toHaveLength(2);
      expect(resolutions[0].resolved).toBe(true);
      expect(resolutions[1].resolved).toBe(true);
      
      // 第一个冲突：本地数据更新，应该使用本地数据
      expect(resolutions[0].finalData.prompt).toBe('本地提示词1');
      
      // 第二个冲突：远程数据更新，应该使用远程数据
      expect(resolutions[1].finalData.prompt).toBe('远程提示词2');
    });
  });

  describe('冲突日志和统计', () => {
    it('应该记录冲突日志', () => {
      const localImage: SavedImage = {
        id: 'test-image-1',
        url: 'https://example.com/image1.jpg',
        prompt: '本地提示词',
        model: 'nano-banana-fast',
        aspectRatio: 'auto',
        imageSize: '1K',
        createdAt: new Date('2024-01-01T12:00:00Z'),
        favorite: true
      };

      const remoteImage: SavedImage = {
        id: 'test-image-1',
        url: 'https://example.com/image1.jpg',
        prompt: '远程提示词',
        model: 'nano-banana-fast',
        aspectRatio: 'auto',
        imageSize: '1K',
        createdAt: new Date('2024-01-01T10:00:00Z'),
        favorite: false
      };

      conflictResolver.detectConflict(
        localImage,
        remoteImage,
        'test-image-1',
        'images'
      );

      const logs = conflictResolver.getConflictLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0].recordId).toBe('test-image-1');
      expect(logs[0].tableName).toBe('images');
      expect(logs[0].type).toBe(ConflictType.IMAGE_UPDATE);
    });

    it('应该提供正确的冲突统计信息', () => {
      // 创建多个不同类型的冲突
      conflictResolver.detectConflict(
        { id: '1', prompt: 'local1', createdAt: new Date('2024-01-01T12:00:00Z') },
        { id: '1', prompt: 'remote1', createdAt: new Date('2024-01-01T10:00:00Z') },
        '1',
        'images'
      );

      conflictResolver.detectConflict(
        { id: '2', apiKey: 'local-key', updatedAt: new Date('2024-01-01T12:00:00Z') },
        { id: '2', apiKey: 'remote-key', updatedAt: new Date('2024-01-01T10:00:00Z') },
        '2',
        'user_configs'
      );

      const stats = conflictResolver.getConflictStats();
      expect(stats.total).toBe(2);
      expect(stats.byType[ConflictType.IMAGE_UPDATE]).toBe(1);
      expect(stats.byType[ConflictType.CONFIG_UPDATE]).toBe(1);
      expect(stats.byTable['images']).toBe(1);
      expect(stats.byTable['user_configs']).toBe(1);
    });

    it('应该能够清除冲突日志', () => {
      conflictResolver.detectConflict(
        { id: '1', prompt: 'local', createdAt: new Date('2024-01-01T12:00:00Z') },
        { id: '1', prompt: 'remote', createdAt: new Date('2024-01-01T10:00:00Z') },
        '1',
        'images'
      );

      expect(conflictResolver.getConflictLogs()).toHaveLength(1);

      conflictResolver.clearConflictLogs();
      expect(conflictResolver.getConflictLogs()).toHaveLength(0);
    });
  });
});
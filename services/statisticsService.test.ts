/**
 * 统计服务测试
 * 测试数据统计和分析功能
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { statisticsService } from './statisticsService';
import { databaseService } from './databaseService';
import { ImageStatistics, DatabaseStatistics } from '../types';

// 模拟数据库服务
vi.mock('./databaseService', () => ({
  databaseService: {
    getImageStatistics: vi.fn(),
    getDatabaseStatistics: vi.fn(),
    getOperationLogs: vi.fn()
  }
}));

describe('StatisticsService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getImageOverview', () => {
    it('应该返回图片统计概览', async () => {
      // 准备测试数据
      const mockImageStats: ImageStatistics = {
        totalImages: 100,
        favoriteImages: 25,
        uploadedToOSS: 80,
        pendingOSSUpload: 20,
        byModel: {
          'nano-banana-fast': 60,
          'nano-banana-pro': 40
        },
        byTimeRange: {
          today: 5,
          thisWeek: 15,
          thisMonth: 30,
          thisYear: 100
        },
        byStatus: {
          favorite: 25,
          uploaded: 80,
          pending: 20
        }
      };

      // 设置模拟返回值
      vi.mocked(databaseService.getImageStatistics).mockResolvedValue(mockImageStats);

      // 执行测试
      const result = await statisticsService.getImageOverview();

      // 验证结果
      expect(result).toEqual(mockImageStats);
      expect(databaseService.getImageStatistics).toHaveBeenCalledWith();
    });

    it('应该处理数据库错误', async () => {
      // 设置模拟错误
      const mockError = new Error('数据库连接失败');
      vi.mocked(databaseService.getImageStatistics).mockRejectedValue(mockError);

      // 执行测试并验证错误
      await expect(statisticsService.getImageOverview()).rejects.toThrow('数据库连接失败');
    });
  });

  describe('getImageStatsByDateRange', () => {
    it('应该返回指定时间范围的图片统计', async () => {
      // 准备测试数据
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');
      const mockStats: ImageStatistics = {
        totalImages: 50,
        favoriteImages: 10,
        uploadedToOSS: 40,
        pendingOSSUpload: 10,
        byModel: {
          'nano-banana-fast': 30,
          'nano-banana-pro': 20
        },
        byTimeRange: {
          today: 0,
          thisWeek: 0,
          thisMonth: 50,
          thisYear: 50
        },
        byStatus: {
          favorite: 10,
          uploaded: 40,
          pending: 10
        }
      };

      // 设置模拟返回值
      vi.mocked(databaseService.getImageStatistics).mockResolvedValue(mockStats);

      // 执行测试
      const result = await statisticsService.getImageStatsByDateRange(startDate, endDate);

      // 验证结果
      expect(result).toEqual(mockStats);
      expect(databaseService.getImageStatistics).toHaveBeenCalledWith({
        dateRange: {
          start: startDate,
          end: endDate
        }
      });
    });
  });

  describe('getImageStatsByModel', () => {
    it('应该返回指定模型的图片统计', async () => {
      // 准备测试数据
      const models = ['nano-banana-fast', 'nano-banana-pro'];
      const mockStats: ImageStatistics = {
        totalImages: 80,
        favoriteImages: 20,
        uploadedToOSS: 70,
        pendingOSSUpload: 10,
        byModel: {
          'nano-banana-fast': 50,
          'nano-banana-pro': 30
        },
        byTimeRange: {
          today: 3,
          thisWeek: 10,
          thisMonth: 25,
          thisYear: 80
        },
        byStatus: {
          favorite: 20,
          uploaded: 70,
          pending: 10
        }
      };

      // 设置模拟返回值
      vi.mocked(databaseService.getImageStatistics).mockResolvedValue(mockStats);

      // 执行测试
      const result = await statisticsService.getImageStatsByModel(models);

      // 验证结果
      expect(result).toEqual(mockStats);
      expect(databaseService.getImageStatistics).toHaveBeenCalledWith({
        models
      });
    });
  });

  describe('getFavoriteImageStats', () => {
    it('应该返回收藏图片统计', async () => {
      // 准备测试数据
      const mockStats: ImageStatistics = {
        totalImages: 25,
        favoriteImages: 25,
        uploadedToOSS: 20,
        pendingOSSUpload: 5,
        byModel: {
          'nano-banana-fast': 15,
          'nano-banana-pro': 10
        },
        byTimeRange: {
          today: 2,
          thisWeek: 5,
          thisMonth: 10,
          thisYear: 25
        },
        byStatus: {
          favorite: 25,
          uploaded: 20,
          pending: 5
        }
      };

      // 设置模拟返回值
      vi.mocked(databaseService.getImageStatistics).mockResolvedValue(mockStats);

      // 执行测试
      const result = await statisticsService.getFavoriteImageStats();

      // 验证结果
      expect(result).toEqual(mockStats);
      expect(databaseService.getImageStatistics).toHaveBeenCalledWith({
        favorite: true
      });
    });
  });

  describe('getOSSUploadStats', () => {
    it('应该返回OSS上传状态统计', async () => {
      // 准备测试数据
      const mockUploadedStats: ImageStatistics = {
        totalImages: 80,
        favoriteImages: 20,
        uploadedToOSS: 80,
        pendingOSSUpload: 0,
        byModel: {
          'nano-banana-fast': 50,
          'nano-banana-pro': 30
        },
        byTimeRange: {
          today: 3,
          thisWeek: 10,
          thisMonth: 25,
          thisYear: 80
        },
        byStatus: {
          favorite: 20,
          uploaded: 80,
          pending: 0
        }
      };

      const mockPendingStats: ImageStatistics = {
        totalImages: 20,
        favoriteImages: 5,
        uploadedToOSS: 0,
        pendingOSSUpload: 20,
        byModel: {
          'nano-banana-fast': 10,
          'nano-banana-pro': 10
        },
        byTimeRange: {
          today: 2,
          thisWeek: 5,
          thisMonth: 5,
          thisYear: 20
        },
        byStatus: {
          favorite: 5,
          uploaded: 0,
          pending: 20
        }
      };

      // 设置模拟返回值
      vi.mocked(databaseService.getImageStatistics)
        .mockResolvedValueOnce(mockUploadedStats)
        .mockResolvedValueOnce(mockPendingStats);

      // 执行测试
      const result = await statisticsService.getOSSUploadStats();

      // 验证结果
      expect(result).toEqual({
        uploaded: mockUploadedStats,
        pending: mockPendingStats
      });
      expect(databaseService.getImageStatistics).toHaveBeenCalledWith({ ossUploaded: true });
      expect(databaseService.getImageStatistics).toHaveBeenCalledWith({ ossUploaded: false });
    });
  });

  describe('getDatabaseOverview', () => {
    it('应该返回数据库统计概览', async () => {
      // 准备测试数据
      const mockDbStats: DatabaseStatistics = {
        images: {
          totalImages: 100,
          favoriteImages: 25,
          uploadedToOSS: 80,
          pendingOSSUpload: 20,
          byModel: {
            'nano-banana-fast': 60,
            'nano-banana-pro': 40
          },
          byTimeRange: {
            today: 5,
            thisWeek: 15,
            thisMonth: 30,
            thisYear: 100
          },
          byStatus: {
            favorite: 25,
            uploaded: 80,
            pending: 20
          }
        },
        operations: {
          totalOperations: 1000,
          successfulOperations: 950,
          failedOperations: 50,
          recentOperations: 25,
          byOperation: {
            'INSERT': 400,
            'SELECT': 500,
            'UPDATE': 80,
            'DELETE': 20
          }
        },
        storage: {
          totalSize: 104857600, // 100MB
          averageImageSize: 1048576, // 1MB
          largestImage: 5242880 // 5MB
        },
        performance: {
          averageResponseTime: 150.5,
          slowestOperation: 2000,
          fastestOperation: 10
        }
      };

      // 设置模拟返回值
      vi.mocked(databaseService.getDatabaseStatistics).mockResolvedValue(mockDbStats);

      // 执行测试
      const result = await statisticsService.getDatabaseOverview();

      // 验证结果
      expect(result).toEqual(mockDbStats);
      expect(databaseService.getDatabaseStatistics).toHaveBeenCalledWith();
    });
  });

  describe('getTodaysSummary', () => {
    it('应该返回今日统计摘要', async () => {
      // 准备测试数据
      const mockImageStats: ImageStatistics = {
        totalImages: 5,
        favoriteImages: 2,
        uploadedToOSS: 4,
        pendingOSSUpload: 1,
        byModel: {
          'nano-banana-fast': 3,
          'nano-banana-pro': 2
        },
        byTimeRange: {
          today: 5,
          thisWeek: 15,
          thisMonth: 30,
          thisYear: 100
        },
        byStatus: {
          favorite: 2,
          uploaded: 4,
          pending: 1
        }
      };

      const mockDbStats: DatabaseStatistics = {
        images: mockImageStats,
        operations: {
          totalOperations: 50,
          successfulOperations: 45,
          failedOperations: 5,
          recentOperations: 10,
          byOperation: {
            'INSERT': 20,
            'SELECT': 25,
            'UPDATE': 4,
            'DELETE': 1
          }
        },
        storage: {
          totalSize: 5242880,
          averageImageSize: 1048576,
          largestImage: 2097152
        },
        performance: {
          averageResponseTime: 120,
          slowestOperation: 500,
          fastestOperation: 50
        }
      };

      const mockOperationLogs = {
        data: [
          { status: 'SUCCESS' as const, createdAt: new Date() },
          { status: 'SUCCESS' as const, createdAt: new Date() },
          { status: 'FAILED' as const, createdAt: new Date() }
        ],
        total: 15,
        page: 1,
        pageSize: 1000,
        totalPages: 1,
        hasNext: false,
        hasPrev: false
      };

      // 设置模拟返回值
      vi.mocked(databaseService.getImageStatistics).mockResolvedValue(mockImageStats);
      vi.mocked(databaseService.getDatabaseStatistics).mockResolvedValue(mockDbStats);
      vi.mocked(databaseService.getOperationLogs).mockResolvedValue(mockOperationLogs);

      // 执行测试
      const result = await statisticsService.getTodaysSummary();

      // 验证结果
      expect(result).toEqual({
        todayImages: 5,
        todayOperations: 15,
        todayErrors: 1,
        topModels: [
          { model: 'nano-banana-fast', count: 3 },
          { model: 'nano-banana-pro', count: 2 }
        ]
      });
    });
  });

  describe('generateStatisticsReport', () => {
    it('应该生成完整的统计报告', async () => {
      // 准备测试数据
      const mockOverview: DatabaseStatistics = {
        images: {
          totalImages: 100,
          favoriteImages: 25,
          uploadedToOSS: 80,
          pendingOSSUpload: 20,
          byModel: {
            'nano-banana-fast': 60,
            'nano-banana-pro': 40
          },
          byTimeRange: {
            today: 5,
            thisWeek: 15,
            thisMonth: 30,
            thisYear: 100
          },
          byStatus: {
            favorite: 25,
            uploaded: 80,
            pending: 20
          }
        },
        operations: {
          totalOperations: 1000,
          successfulOperations: 950,
          failedOperations: 50,
          recentOperations: 25,
          byOperation: {
            'INSERT': 400,
            'SELECT': 500,
            'UPDATE': 80,
            'DELETE': 20
          }
        },
        storage: {
          totalSize: 104857600,
          averageImageSize: 1048576,
          largestImage: 5242880
        },
        performance: {
          averageResponseTime: 150.5,
          slowestOperation: 2000,
          fastestOperation: 10
        }
      };

      const mockTodaySummary = {
        todayImages: 5,
        todayOperations: 15,
        todayErrors: 2,
        topModels: [
          { model: 'nano-banana-fast', count: 3 },
          { model: 'nano-banana-pro', count: 2 }
        ]
      };

      const mockRecentErrors = [
        {
          id: '1',
          operation: 'INSERT',
          tableName: 'images',
          recordId: 'img_123',
          userId: 'default',
          status: 'FAILED' as const,
          errorMessage: '连接超时',
          createdAt: new Date(),
          duration: 5000
        }
      ];

      // 模拟方法调用
      const getDatabaseOverviewSpy = vi.spyOn(statisticsService, 'getDatabaseOverview').mockResolvedValue(mockOverview);
      const getTodaysSummarySpy = vi.spyOn(statisticsService, 'getTodaysSummary').mockResolvedValue(mockTodaySummary);
      const getErrorOperationsSpy = vi.spyOn(statisticsService, 'getErrorOperations').mockResolvedValue(mockRecentErrors);

      // 执行测试
      const result = await statisticsService.generateStatisticsReport();

      // 验证结果
      expect(result.overview).toEqual(mockOverview);
      expect(result.todaySummary).toEqual(mockTodaySummary);
      expect(result.recentErrors).toEqual(mockRecentErrors);
      expect(result.recommendations).toContain('有 20 张图片待上传到OSS，建议及时处理');

      // 验证方法调用
      expect(getDatabaseOverviewSpy).toHaveBeenCalled();
      expect(getTodaysSummarySpy).toHaveBeenCalled();
      expect(getErrorOperationsSpy).toHaveBeenCalledWith(20);
    });
  });
});
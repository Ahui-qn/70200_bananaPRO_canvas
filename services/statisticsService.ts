/**
 * 统计服务
 * 提供数据统计和分析功能的高级接口
 */

import { databaseService } from './databaseService';
import { 
  ImageStatistics, 
  DatabaseStatistics, 
  StatisticsFilter,
  OperationLog,
  PaginationOptions,
  PaginatedResult
} from '../types';

/**
 * 统计服务类
 * 封装常用的统计查询和分析功能
 */
export class StatisticsService {
  
  /**
   * 获取图片统计概览
   */
  async getImageOverview(): Promise<ImageStatistics> {
    try {
      console.log('获取图片统计概览...');
      const stats = await databaseService.getImageStatistics();
      console.log('图片统计概览获取成功:', {
        总图片数: stats.totalImages,
        收藏图片: stats.favoriteImages,
        已上传OSS: stats.uploadedToOSS,
        待上传: stats.pendingOSSUpload
      });
      return stats;
    } catch (error) {
      console.error('获取图片统计概览失败:', error);
      throw error;
    }
  }

  /**
   * 获取指定时间范围的图片统计
   */
  async getImageStatsByDateRange(startDate: Date, endDate: Date): Promise<ImageStatistics> {
    try {
      console.log(`获取时间范围统计: ${startDate.toISOString()} 到 ${endDate.toISOString()}`);
      
      const filter: StatisticsFilter = {
        dateRange: {
          start: startDate,
          end: endDate
        }
      };
      
      const stats = await databaseService.getImageStatistics(filter);
      console.log('时间范围统计获取成功:', {
        时间范围: `${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`,
        图片数量: stats.totalImages,
        收藏数量: stats.favoriteImages
      });
      
      return stats;
    } catch (error) {
      console.error('获取时间范围统计失败:', error);
      throw error;
    }
  }

  /**
   * 获取指定模型的图片统计
   */
  async getImageStatsByModel(models: string[]): Promise<ImageStatistics> {
    try {
      console.log('获取模型统计:', models);
      
      const filter: StatisticsFilter = {
        models
      };
      
      const stats = await databaseService.getImageStatistics(filter);
      console.log('模型统计获取成功:', {
        筛选模型: models,
        图片数量: stats.totalImages,
        模型分布: stats.byModel
      });
      
      return stats;
    } catch (error) {
      console.error('获取模型统计失败:', error);
      throw error;
    }
  }

  /**
   * 获取收藏图片统计
   */
  async getFavoriteImageStats(): Promise<ImageStatistics> {
    try {
      console.log('获取收藏图片统计...');
      
      const filter: StatisticsFilter = {
        favorite: true
      };
      
      const stats = await databaseService.getImageStatistics(filter);
      console.log('收藏图片统计获取成功:', {
        收藏图片数: stats.totalImages,
        模型分布: stats.byModel,
        时间分布: stats.byTimeRange
      });
      
      return stats;
    } catch (error) {
      console.error('获取收藏图片统计失败:', error);
      throw error;
    }
  }

  /**
   * 获取OSS上传状态统计
   */
  async getOSSUploadStats(): Promise<{
    uploaded: ImageStatistics;
    pending: ImageStatistics;
  }> {
    try {
      console.log('获取OSS上传状态统计...');
      
      const [uploadedStats, pendingStats] = await Promise.all([
        databaseService.getImageStatistics({ ossUploaded: true }),
        databaseService.getImageStatistics({ ossUploaded: false })
      ]);
      
      console.log('OSS上传状态统计获取成功:', {
        已上传: uploadedStats.totalImages,
        待上传: pendingStats.totalImages
      });
      
      return {
        uploaded: uploadedStats,
        pending: pendingStats
      };
    } catch (error) {
      console.error('获取OSS上传状态统计失败:', error);
      throw error;
    }
  }

  /**
   * 获取完整的数据库统计信息
   */
  async getDatabaseOverview(): Promise<DatabaseStatistics> {
    try {
      console.log('获取数据库统计概览...');
      const stats = await databaseService.getDatabaseStatistics();
      
      console.log('数据库统计概览获取成功:', {
        图片总数: stats.images.totalImages,
        操作总数: stats.operations.totalOperations,
        成功率: `${((stats.operations.successfulOperations / stats.operations.totalOperations) * 100).toFixed(2)}%`,
        平均响应时间: `${stats.performance.averageResponseTime.toFixed(2)}ms`
      });
      
      return stats;
    } catch (error) {
      console.error('获取数据库统计概览失败:', error);
      throw error;
    }
  }

  /**
   * 获取今日统计摘要
   */
  async getTodaysSummary(): Promise<{
    todayImages: number;
    todayOperations: number;
    todayErrors: number;
    topModels: Array<{ model: string; count: number }>;
  }> {
    try {
      console.log('获取今日统计摘要...');
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      const filter: StatisticsFilter = {
        dateRange: {
          start: today,
          end: tomorrow
        }
      };
      
      const [imageStats, dbStats] = await Promise.all([
        databaseService.getImageStatistics(filter),
        databaseService.getDatabaseStatistics(filter)
      ]);
      
      // 获取今日操作日志
      const operationLogs = await databaseService.getOperationLogs({
        page: 1,
        pageSize: 1000,
        sortBy: 'created_at',
        sortOrder: 'DESC',
        filters: {
          dateRange: {
            start: today,
            end: tomorrow
          }
        }
      });
      
      const todayOperations = operationLogs.total;
      const todayErrors = operationLogs.data.filter(log => log.status === 'FAILED').length;
      
      // 获取热门模型（按今日图片数量排序）
      const topModels = Object.entries(imageStats.byModel)
        .map(([model, count]) => ({ model, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);
      
      const summary = {
        todayImages: imageStats.byTimeRange.today,
        todayOperations,
        todayErrors,
        topModels
      };
      
      console.log('今日统计摘要获取成功:', summary);
      return summary;
      
    } catch (error) {
      console.error('获取今日统计摘要失败:', error);
      throw error;
    }
  }

  /**
   * 获取最近的操作日志
   */
  async getRecentOperations(limit: number = 50): Promise<OperationLog[]> {
    try {
      console.log(`获取最近 ${limit} 条操作日志...`);
      
      const result = await databaseService.getOperationLogs({
        page: 1,
        pageSize: limit,
        sortBy: 'created_at',
        sortOrder: 'DESC'
      });
      
      console.log(`最近操作日志获取成功: ${result.data.length} 条记录`);
      return result.data;
      
    } catch (error) {
      console.error('获取最近操作日志失败:', error);
      throw error;
    }
  }

  /**
   * 获取错误操作日志
   */
  async getErrorOperations(limit: number = 100): Promise<OperationLog[]> {
    try {
      console.log(`获取最近 ${limit} 条错误操作日志...`);
      
      const result = await databaseService.getOperationLogs({
        page: 1,
        pageSize: limit,
        sortBy: 'created_at',
        sortOrder: 'DESC',
        filters: {
          status: 'FAILED'
        }
      });
      
      console.log(`错误操作日志获取成功: ${result.data.length} 条记录`);
      return result.data;
      
    } catch (error) {
      console.error('获取错误操作日志失败:', error);
      throw error;
    }
  }

  /**
   * 生成统计报告
   */
  async generateStatisticsReport(): Promise<{
    overview: DatabaseStatistics;
    todaySummary: any;
    recentErrors: OperationLog[];
    recommendations: string[];
  }> {
    try {
      console.log('生成统计报告...');
      
      const [overview, todaySummary, recentErrors] = await Promise.all([
        this.getDatabaseOverview(),
        this.getTodaysSummary(),
        this.getErrorOperations(20)
      ]);
      
      // 生成建议
      const recommendations: string[] = [];
      
      if (overview.images.pendingOSSUpload > 0) {
        recommendations.push(`有 ${overview.images.pendingOSSUpload} 张图片待上传到OSS，建议及时处理`);
      }
      
      if (overview.operations.failedOperations > overview.operations.totalOperations * 0.1) {
        recommendations.push('操作失败率较高，建议检查数据库连接和配置');
      }
      
      if (overview.performance.averageResponseTime > 1000) {
        recommendations.push('数据库响应时间较慢，建议优化查询或检查网络连接');
      }
      
      if (todaySummary.todayErrors > 10) {
        recommendations.push('今日错误数量较多，建议查看错误日志');
      }
      
      if (recommendations.length === 0) {
        recommendations.push('系统运行正常，所有指标都在正常范围内');
      }
      
      const report = {
        overview,
        todaySummary,
        recentErrors,
        recommendations
      };
      
      console.log('统计报告生成成功');
      return report;
      
    } catch (error) {
      console.error('生成统计报告失败:', error);
      throw error;
    }
  }
}

// 创建单例实例
export const statisticsService = new StatisticsService();

// 导出便捷函数
export const getImageOverview = () => statisticsService.getImageOverview();
export const getDatabaseOverview = () => statisticsService.getDatabaseOverview();
export const getTodaysSummary = () => statisticsService.getTodaysSummary();
export const generateStatisticsReport = () => statisticsService.generateStatisticsReport();
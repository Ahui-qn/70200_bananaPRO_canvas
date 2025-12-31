/**
 * 性能优化服务
 * 提供数据库查询优化、缓存策略和大数据量处理优化
 */

import { 
  SavedImage, 
  PaginationOptions, 
  PaginatedResult,
  DatabaseService,
  ImageStatistics,
  DatabaseStatistics
} from '../types';

// 缓存项接口
interface CacheItem<T> {
  data: T;
  timestamp: number;
  ttl: number;
  key: string;
}

// 查询缓存接口
interface QueryCache {
  images: Map<string, CacheItem<PaginatedResult<SavedImage>>>;
  statistics: Map<string, CacheItem<ImageStatistics | DatabaseStatistics>>;
  configs: Map<string, CacheItem<any>>;
}

// 批处理任务接口
interface BatchTask<T> {
  id: string;
  operation: 'INSERT' | 'UPDATE' | 'DELETE';
  data: T;
  timestamp: number;
}

// 性能监控指标
interface PerformanceMetrics {
  queryCount: number;
  cacheHitRate: number;
  averageQueryTime: number;
  slowQueries: Array<{ query: string; duration: number; timestamp: Date }>;
  memoryUsage: number;
  batchProcessingStats: {
    totalBatches: number;
    averageBatchSize: number;
    processingTime: number;
  };
}

/**
 * 性能优化器类
 * 提供全面的性能优化功能
 */
export class PerformanceOptimizer {
  private cache: QueryCache;
  private metrics: PerformanceMetrics;
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5分钟缓存
  private readonly MAX_CACHE_SIZE = 1000; // 最大缓存项数

  constructor() {
    this.cache = {
      images: new Map(),
      statistics: new Map(),
      configs: new Map()
    };
    this.metrics = {
      queryCount: 0,
      cacheHitRate: 0,
      averageQueryTime: 0,
      slowQueries: [],
      memoryUsage: 0,
      batchProcessingStats: {
        totalBatches: 0,
        averageBatchSize: 0,
        processingTime: 0
      }
    };

    // 定期清理过期缓存
    setInterval(() => this.cleanupExpiredCache(), 60000); // 每分钟清理一次
  }

  /**
   * 优化图片查询
   */
  async optimizeImageQuery(
    databaseService: DatabaseService,
    pagination: PaginationOptions,
    useCache: boolean = true
  ): Promise<PaginatedResult<SavedImage>> {
    const startTime = Date.now();
    
    try {
      // 生成缓存键
      const cacheKey = this.generateCacheKey('images', pagination);
      
      // 尝试从缓存获取
      if (useCache) {
        const cachedResult = this.getFromCache('images', cacheKey);
        if (cachedResult) {
          console.log(`缓存命中: ${cacheKey}`);
          this.updateMetrics('cache_hit', Date.now() - startTime);
          return cachedResult;
        }
      }

      // 优化分页参数
      const optimizedPagination = this.optimizeImageQueryParams(pagination);
      
      // 执行数据库查询
      console.log('执行优化后的数据库查询:', optimizedPagination);
      const result = await databaseService.getImages(optimizedPagination);
      
      // 缓存结果
      if (useCache && result.data.length > 0) {
        this.setCache('images', cacheKey, result, this.CACHE_TTL);
      }
      
      this.updateMetrics('query_executed', Date.now() - startTime);
      return result;

    } catch (error) {
      console.error('优化查询失败:', error);
      this.updateMetrics('query_failed', Date.now() - startTime);
      throw error;
    }
  }

  /**
   * 优化统计查询
   */
  async optimizeStatisticsQuery(
    databaseService: DatabaseService,
    type: 'image' | 'database',
    filter?: any,
    useCache: boolean = true
  ): Promise<ImageStatistics | DatabaseStatistics> {
    const startTime = Date.now();
    
    try {
      // 生成缓存键
      const cacheKey = this.generateCacheKey(`stats_${type}`, filter || {});
      
      // 尝试从缓存获取
      if (useCache) {
        const cachedResult = this.getFromCache('statistics', cacheKey);
        if (cachedResult) {
          console.log(`统计缓存命中: ${cacheKey}`);
          this.updateMetrics('cache_hit', Date.now() - startTime);
          return cachedResult;
        }
      }

      // 执行统计查询
      let result: ImageStatistics | DatabaseStatistics;
      if (type === 'image') {
        result = await databaseService.getImageStatistics(filter);
      } else {
        result = await databaseService.getDatabaseStatistics(filter);
      }
      
      // 缓存结果（统计数据缓存时间更长）
      if (useCache) {
        this.setCache('statistics', cacheKey, result, this.CACHE_TTL * 2);
      }
      
      this.updateMetrics('query_executed', Date.now() - startTime);
      return result;

    } catch (error) {
      console.error('优化统计查询失败:', error);
      this.updateMetrics('query_failed', Date.now() - startTime);
      throw error;
    }
  }

  /**
   * 批量处理图片操作
   */
  async batchProcessImages(
    databaseService: DatabaseService,
    operations: Array<{
      type: 'INSERT' | 'UPDATE' | 'DELETE';
      data: SavedImage | Partial<SavedImage> | string;
    }>
  ): Promise<{ successful: number; failed: number; errors: string[] }> {
    const startTime = Date.now();
    const results = { successful: 0, failed: 0, errors: [] as string[] };
    
    try {
      console.log(`开始批量处理 ${operations.length} 个图片操作`);
      
      // 按操作类型分组
      const groupedOps = this.groupOperationsByType(operations);
      
      // 批量执行插入操作
      if (groupedOps.INSERT.length > 0) {
        const insertResults = await this.batchInsertImages(databaseService, groupedOps.INSERT);
        results.successful += insertResults.successful;
        results.failed += insertResults.failed;
        results.errors.push(...insertResults.errors);
      }
      
      // 批量执行更新操作
      if (groupedOps.UPDATE.length > 0) {
        const updateResults = await this.batchUpdateImages(databaseService, groupedOps.UPDATE);
        results.successful += updateResults.successful;
        results.failed += updateResults.failed;
        results.errors.push(...updateResults.errors);
      }
      
      // 批量执行删除操作
      if (groupedOps.DELETE.length > 0) {
        const deleteResults = await this.batchDeleteImages(databaseService, groupedOps.DELETE);
        results.successful += deleteResults.successful;
        results.failed += deleteResults.failed;
        results.errors.push(...deleteResults.errors);
      }
      
      // 清理相关缓存
      this.invalidateImageCache();
      
      const duration = Date.now() - startTime;
      this.updateBatchMetrics(operations.length, duration);
      
      console.log(`批量处理完成: 成功 ${results.successful}, 失败 ${results.failed}, 耗时 ${duration}ms`);
      return results;

    } catch (error: any) {
      console.error('批量处理失败:', error);
      results.errors.push(error.message);
      return results;
    }
  }

  /**
   * 预加载数据
   */
  async preloadData(
    databaseService: DatabaseService,
    preloadConfig: {
      recentImages?: number;
      popularModels?: boolean;
      statistics?: boolean;
    }
  ): Promise<void> {
    console.log('开始预加载数据...');
    
    try {
      const preloadTasks: Promise<any>[] = [];
      
      // 预加载最近图片
      if (preloadConfig.recentImages) {
        preloadTasks.push(
          this.optimizeImageQuery(databaseService, {
            page: 1,
            pageSize: preloadConfig.recentImages,
            sortBy: 'created_at',
            sortOrder: 'DESC'
          })
        );
      }
      
      // 预加载热门模型的图片
      if (preloadConfig.popularModels) {
        const popularModels = ['nano-banana-fast', 'nano-banana-hd'];
        for (const model of popularModels) {
          preloadTasks.push(
            this.optimizeImageQuery(databaseService, {
              page: 1,
              pageSize: 10,
              sortBy: 'created_at',
              sortOrder: 'DESC',
              filters: { model }
            })
          );
        }
      }
      
      // 预加载统计信息
      if (preloadConfig.statistics) {
        preloadTasks.push(
          this.optimizeStatisticsQuery(databaseService, 'image'),
          this.optimizeStatisticsQuery(databaseService, 'database')
        );
      }
      
      await Promise.allSettled(preloadTasks);
      console.log('数据预加载完成');

    } catch (error) {
      console.error('数据预加载失败:', error);
    }
  }

  /**
   * 优化大数据量查询
   */
  async optimizeLargeDataQuery(
    databaseService: DatabaseService,
    totalRecords: number,
    batchSize: number = 1000
  ): Promise<SavedImage[]> {
    console.log(`开始优化大数据量查询: ${totalRecords} 条记录`);
    
    const allResults: SavedImage[] = [];
    const totalBatches = Math.ceil(totalRecords / batchSize);
    
    for (let batch = 0; batch < totalBatches; batch++) {
      const page = batch + 1;
      
      try {
        console.log(`处理批次 ${batch + 1}/${totalBatches}`);
        
        const result = await this.optimizeImageQuery(
          databaseService,
          {
            page,
            pageSize: batchSize,
            sortBy: 'id', // 使用主键排序，性能更好
            sortOrder: 'ASC'
          },
          false // 大数据量查询不使用缓存
        );
        
        allResults.push(...result.data);
        
        // 如果返回的数据少于批次大小，说明已经到最后了
        if (result.data.length < batchSize) {
          break;
        }
        
        // 批次间添加小延迟，避免数据库压力过大
        if (batch < totalBatches - 1) {
          await this.delay(100);
        }
        
      } catch (error) {
        console.error(`批次 ${batch + 1} 处理失败:`, error);
        // 继续处理下一批次
      }
    }
    
    console.log(`大数据量查询完成: 获取到 ${allResults.length} 条记录`);
    return allResults;
  }

  /**
   * 获取性能指标
   */
  getPerformanceMetrics(): PerformanceMetrics & {
    cacheStats: {
      imagesCacheSize: number;
      statisticsCacheSize: number;
      configsCacheSize: number;
      totalCacheSize: number;
    };
  } {
    return {
      ...this.metrics,
      cacheStats: {
        imagesCacheSize: this.cache.images.size,
        statisticsCacheSize: this.cache.statistics.size,
        configsCacheSize: this.cache.configs.size,
        totalCacheSize: this.cache.images.size + this.cache.statistics.size + this.cache.configs.size
      }
    };
  }

  /**
   * 清理所有缓存
   */
  clearAllCache(): void {
    this.cache.images.clear();
    this.cache.statistics.clear();
    this.cache.configs.clear();
    console.log('所有缓存已清理');
  }

  /**
   * 清理图片相关缓存
   */
  invalidateImageCache(): void {
    this.cache.images.clear();
    this.cache.statistics.clear(); // 统计信息也需要清理
    console.log('图片相关缓存已清理');
  }

  // ==================== 私有方法 ====================

  /**
   * 优化图片查询参数
   */
  private optimizeImageQueryParams(pagination: PaginationOptions): PaginationOptions {
    const optimized = { ...pagination };
    
    // 限制页面大小，避免单次查询数据过多
    if (optimized.pageSize > 100) {
      optimized.pageSize = 100;
      console.log('页面大小已优化为 100');
    }
    
    // 优化排序字段，优先使用有索引的字段
    const indexedFields = ['created_at', 'model', 'favorite', 'id'];
    if (!indexedFields.includes(optimized.sortBy || '')) {
      optimized.sortBy = 'created_at';
      console.log('排序字段已优化为 created_at');
    }
    
    // 优化筛选条件
    if (optimized.filters) {
      optimized.filters = this.optimizeFilters(optimized.filters);
    }
    
    return optimized;
  }

  /**
   * 优化筛选条件
   */
  private optimizeFilters(filters: Record<string, any>): Record<string, any> {
    const optimized = { ...filters };
    
    // 移除空值筛选条件
    Object.keys(optimized).forEach(key => {
      if (optimized[key] === null || optimized[key] === undefined || optimized[key] === '') {
        delete optimized[key];
      }
    });
    
    // 优化搜索条件
    if (optimized.search && typeof optimized.search === 'string') {
      optimized.search = optimized.search.trim();
      if (optimized.search.length === 0) {
        delete optimized.search;
      }
    }
    
    return optimized;
  }

  /**
   * 生成缓存键
   */
  private generateCacheKey(prefix: string, params: any): string {
    const paramsStr = JSON.stringify(params, Object.keys(params).sort());
    return `${prefix}:${this.hashString(paramsStr)}`;
  }

  /**
   * 简单字符串哈希函数
   */
  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // 转换为32位整数
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * 从缓存获取数据
   */
  private getFromCache<T>(cacheType: keyof QueryCache, key: string): T | null {
    const cache = this.cache[cacheType] as Map<string, CacheItem<T>>;
    const item = cache.get(key);
    
    if (!item) {
      return null;
    }
    
    // 检查是否过期
    if (Date.now() - item.timestamp > item.ttl) {
      cache.delete(key);
      return null;
    }
    
    return item.data;
  }

  /**
   * 设置缓存数据
   */
  private setCache<T>(cacheType: keyof QueryCache, key: string, data: T, ttl: number): void {
    const cache = this.cache[cacheType] as Map<string, CacheItem<T>>;
    
    // 检查缓存大小限制
    if (cache.size >= this.MAX_CACHE_SIZE) {
      this.evictOldestCacheItems(cache);
    }
    
    cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl,
      key
    });
  }

  /**
   * 清理过期缓存
   */
  private cleanupExpiredCache(): void {
    const now = Date.now();
    let cleanedCount = 0;
    
    // 清理各类缓存
    [this.cache.images, this.cache.statistics, this.cache.configs].forEach(cache => {
      const keysToDelete: string[] = [];
      
      cache.forEach((item, key) => {
        if (now - item.timestamp > item.ttl) {
          keysToDelete.push(key);
        }
      });
      
      keysToDelete.forEach(key => {
        cache.delete(key);
        cleanedCount++;
      });
    });
    
    if (cleanedCount > 0) {
      console.log(`清理了 ${cleanedCount} 个过期缓存项`);
    }
  }

  /**
   * 驱逐最旧的缓存项
   */
  private evictOldestCacheItems<T>(cache: Map<string, CacheItem<T>>): void {
    const items = Array.from(cache.entries());
    items.sort((a, b) => a[1].timestamp - b[1].timestamp);
    
    // 删除最旧的 10% 缓存项
    const deleteCount = Math.ceil(items.length * 0.1);
    for (let i = 0; i < deleteCount; i++) {
      cache.delete(items[i][0]);
    }
    
    console.log(`驱逐了 ${deleteCount} 个最旧的缓存项`);
  }

  /**
   * 按操作类型分组
   */
  private groupOperationsByType(operations: Array<{
    type: 'INSERT' | 'UPDATE' | 'DELETE';
    data: any;
  }>): Record<'INSERT' | 'UPDATE' | 'DELETE', any[]> {
    return operations.reduce((groups, op) => {
      if (!groups[op.type]) {
        groups[op.type] = [];
      }
      groups[op.type].push(op.data);
      return groups;
    }, {} as Record<'INSERT' | 'UPDATE' | 'DELETE', any[]>);
  }

  /**
   * 批量插入图片
   */
  private async batchInsertImages(
    databaseService: DatabaseService,
    images: SavedImage[]
  ): Promise<{ successful: number; failed: number; errors: string[] }> {
    const results = { successful: 0, failed: 0, errors: [] as string[] };
    
    // 分批处理，避免单次插入过多数据
    const batchSize = 20;
    for (let i = 0; i < images.length; i += batchSize) {
      const batch = images.slice(i, i + batchSize);
      
      for (const image of batch) {
        try {
          await databaseService.saveImage(image);
          results.successful++;
        } catch (error: any) {
          results.failed++;
          results.errors.push(`插入图片 ${image.id} 失败: ${error.message}`);
        }
      }
    }
    
    return results;
  }

  /**
   * 批量更新图片
   */
  private async batchUpdateImages(
    databaseService: DatabaseService,
    updates: Array<{ id: string; data: Partial<SavedImage> }>
  ): Promise<{ successful: number; failed: number; errors: string[] }> {
    const results = { successful: 0, failed: 0, errors: [] as string[] };
    
    for (const update of updates) {
      try {
        await databaseService.updateImage(update.id, update.data);
        results.successful++;
      } catch (error: any) {
        results.failed++;
        results.errors.push(`更新图片 ${update.id} 失败: ${error.message}`);
      }
    }
    
    return results;
  }

  /**
   * 批量删除图片
   */
  private async batchDeleteImages(
    databaseService: DatabaseService,
    imageIds: string[]
  ): Promise<{ successful: number; failed: number; errors: string[] }> {
    // 使用数据库服务的批量删除方法
    const result = await databaseService.deleteImages(imageIds, true);
    
    return {
      successful: result.successful.length,
      failed: result.failed.length,
      errors: result.failed.map(f => f.error)
    };
  }

  /**
   * 更新性能指标
   */
  private updateMetrics(type: 'cache_hit' | 'query_executed' | 'query_failed', duration: number): void {
    this.metrics.queryCount++;
    
    if (type === 'cache_hit') {
      // 更新缓存命中率
      const totalQueries = this.metrics.queryCount;
      const currentHits = Math.round(this.metrics.cacheHitRate * (totalQueries - 1) / 100) + 1;
      this.metrics.cacheHitRate = (currentHits / totalQueries) * 100;
    } else if (type === 'query_executed') {
      // 更新平均查询时间
      const totalTime = this.metrics.averageQueryTime * (this.metrics.queryCount - 1) + duration;
      this.metrics.averageQueryTime = totalTime / this.metrics.queryCount;
      
      // 记录慢查询（超过1秒）
      if (duration > 1000) {
        this.metrics.slowQueries.push({
          query: 'database_query',
          duration,
          timestamp: new Date()
        });
        
        // 只保留最近50个慢查询记录
        if (this.metrics.slowQueries.length > 50) {
          this.metrics.slowQueries = this.metrics.slowQueries.slice(-50);
        }
      }
    }
  }

  /**
   * 更新批处理指标
   */
  private updateBatchMetrics(batchSize: number, processingTime: number): void {
    this.metrics.batchProcessingStats.totalBatches++;
    
    const totalBatches = this.metrics.batchProcessingStats.totalBatches;
    const currentAvgSize = this.metrics.batchProcessingStats.averageBatchSize;
    const currentAvgTime = this.metrics.batchProcessingStats.processingTime;
    
    // 更新平均批次大小
    this.metrics.batchProcessingStats.averageBatchSize = 
      (currentAvgSize * (totalBatches - 1) + batchSize) / totalBatches;
    
    // 更新平均处理时间
    this.metrics.batchProcessingStats.processingTime = 
      (currentAvgTime * (totalBatches - 1) + processingTime) / totalBatches;
  }

  /**
   * 延迟函数
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// 创建单例实例
export const performanceOptimizer = new PerformanceOptimizer();

// 导出便捷函数
export const optimizeImageQuery = (
  databaseService: DatabaseService,
  pagination: PaginationOptions,
  useCache?: boolean
) => performanceOptimizer.optimizeImageQuery(databaseService, pagination, useCache);

export const optimizeStatisticsQuery = (
  databaseService: DatabaseService,
  type: 'image' | 'database',
  filter?: any,
  useCache?: boolean
) => performanceOptimizer.optimizeStatisticsQuery(databaseService, type, filter, useCache);

export const batchProcessImages = (
  databaseService: DatabaseService,
  operations: Array<{
    type: 'INSERT' | 'UPDATE' | 'DELETE';
    data: any;
  }>
) => performanceOptimizer.batchProcessImages(databaseService, operations);

export const preloadData = (
  databaseService: DatabaseService,
  config: {
    recentImages?: number;
    popularModels?: boolean;
    statistics?: boolean;
  }
) => performanceOptimizer.preloadData(databaseService, config);

export const getPerformanceMetrics = () => performanceOptimizer.getPerformanceMetrics();
export const clearAllCache = () => performanceOptimizer.clearAllCache();
export const invalidateImageCache = () => performanceOptimizer.invalidateImageCache();
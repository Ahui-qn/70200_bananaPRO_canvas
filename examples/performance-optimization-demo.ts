/**
 * 性能优化功能演示
 * 展示如何使用性能优化器提升数据库操作性能
 */

import { 
  PerformanceOptimizer,
  performanceOptimizer
} from '../services/performanceOptimizer';
import { databaseService } from '../services/databaseService';
import { SavedImage, PaginationOptions } from '../types';

/**
 * 演示性能优化功能
 */
async function demonstratePerformanceOptimization() {
  console.log('=== 性能优化功能演示 ===\n');

  try {
    // 1. 演示优化查询缓存
    console.log('1. 演示查询缓存优化');
    console.log('-------------------');
    
    const pagination: PaginationOptions = {
      page: 1,
      pageSize: 10,
      sortBy: 'created_at',
      sortOrder: 'DESC'
    };

    // 第一次查询（从数据库）
    console.log('第一次查询（从数据库）...');
    const startTime1 = Date.now();
    const result1 = await performanceOptimizer.optimizeImageQuery(databaseService, pagination, true);
    const duration1 = Date.now() - startTime1;
    console.log(`查询完成，耗时: ${duration1}ms，获取到 ${result1.data.length} 条记录`);

    // 第二次查询（从缓存）
    console.log('\n第二次查询（从缓存）...');
    const startTime2 = Date.now();
    const result2 = await performanceOptimizer.optimizeImageQuery(databaseService, pagination, true);
    const duration2 = Date.now() - startTime2;
    console.log(`查询完成，耗时: ${duration2}ms，获取到 ${result2.data.length} 条记录`);
    console.log(`性能提升: ${((duration1 - duration2) / duration1 * 100).toFixed(1)}%\n`);

    // 2. 演示统计查询优化
    console.log('2. 演示统计查询优化');
    console.log('-------------------');
    
    console.log('获取图片统计信息...');
    const statsStartTime = Date.now();
    const imageStats = await performanceOptimizer.optimizeStatisticsQuery(databaseService, 'image', undefined, true);
    const statsDuration = Date.now() - statsStartTime;
    console.log(`统计查询完成，耗时: ${statsDuration}ms`);
    console.log(`总图片数: ${imageStats.totalImages}, 收藏数: ${imageStats.favoriteImages}\n`);

    // 3. 演示批量处理
    console.log('3. 演示批量处理优化');
    console.log('-------------------');
    
    // 创建一些测试数据
    const testImages: SavedImage[] = [];
    for (let i = 0; i < 5; i++) {
      testImages.push({
        id: `perf_test_${Date.now()}_${i}`,
        url: `https://example.com/test_image_${i}.jpg`,
        prompt: `性能测试图片 ${i}`,
        model: 'nano-banana-fast',
        aspectRatio: 'auto',
        imageSize: '1K',
        createdAt: new Date(),
        favorite: i % 2 === 0,
        ossUploaded: false
      });
    }

    const batchOperations = testImages.map(image => ({
      type: 'INSERT' as const,
      data: image
    }));

    console.log(`开始批量插入 ${testImages.length} 张图片...`);
    const batchStartTime = Date.now();
    const batchResult = await performanceOptimizer.batchProcessImages(databaseService, batchOperations);
    const batchDuration = Date.now() - batchStartTime;
    
    console.log(`批量处理完成，耗时: ${batchDuration}ms`);
    console.log(`成功: ${batchResult.successful}, 失败: ${batchResult.failed}`);
    if (batchResult.errors.length > 0) {
      console.log('错误信息:', batchResult.errors.slice(0, 3));
    }
    console.log('');

    // 4. 演示数据预加载
    console.log('4. 演示数据预加载');
    console.log('---------------');
    
    console.log('开始预加载数据...');
    const preloadStartTime = Date.now();
    await performanceOptimizer.preloadData(databaseService, {
      recentImages: 20,
      popularModels: true,
      statistics: true
    });
    const preloadDuration = Date.now() - preloadStartTime;
    console.log(`数据预加载完成，耗时: ${preloadDuration}ms\n`);

    // 5. 显示性能指标
    console.log('5. 性能指标统计');
    console.log('---------------');
    
    const metrics = performanceOptimizer.getPerformanceMetrics();
    console.log('性能指标:');
    console.log(`- 总查询次数: ${metrics.queryCount}`);
    console.log(`- 缓存命中率: ${metrics.cacheHitRate.toFixed(1)}%`);
    console.log(`- 平均查询时间: ${metrics.averageQueryTime.toFixed(1)}ms`);
    console.log(`- 慢查询数量: ${metrics.slowQueries.length}`);
    console.log('');
    
    console.log('缓存统计:');
    console.log(`- 图片缓存: ${metrics.cacheStats.imagesCacheSize} 项`);
    console.log(`- 统计缓存: ${metrics.cacheStats.statisticsCacheSize} 项`);
    console.log(`- 配置缓存: ${metrics.cacheStats.configsCacheSize} 项`);
    console.log(`- 总缓存大小: ${metrics.cacheStats.totalCacheSize} 项`);
    console.log('');
    
    console.log('批处理统计:');
    console.log(`- 总批次数: ${metrics.batchProcessingStats.totalBatches}`);
    console.log(`- 平均批次大小: ${metrics.batchProcessingStats.averageBatchSize.toFixed(1)}`);
    console.log(`- 平均处理时间: ${metrics.batchProcessingStats.processingTime.toFixed(1)}ms`);
    console.log('');

    // 6. 演示缓存管理
    console.log('6. 缓存管理');
    console.log('-----------');
    
    console.log('清理所有缓存...');
    performanceOptimizer.clearAllCache();
    
    const metricsAfterClear = performanceOptimizer.getPerformanceMetrics();
    console.log(`缓存清理后总大小: ${metricsAfterClear.cacheStats.totalCacheSize} 项`);
    console.log('');

    // 清理测试数据
    console.log('7. 清理测试数据');
    console.log('---------------');
    
    const testImageIds = testImages.map(img => img.id);
    console.log(`开始清理 ${testImageIds.length} 个测试图片...`);
    const cleanupResult = await databaseService.deleteImages(testImageIds, false);
    console.log(`清理完成: 成功删除 ${cleanupResult.successful.length} 个，失败 ${cleanupResult.failed.length} 个`);

    console.log('\n=== 性能优化演示完成 ===');

  } catch (error: any) {
    console.error('性能优化演示失败:', error);
    throw error;
  }
}

/**
 * 演示大数据量处理优化
 */
async function demonstrateLargeDataOptimization() {
  console.log('\n=== 大数据量处理优化演示 ===\n');

  try {
    // 模拟大数据量查询
    console.log('演示大数据量分页查询优化...');
    
    const largeDataPagination: PaginationOptions = {
      page: 1,
      pageSize: 50, // 较大的页面大小
      sortBy: 'created_at',
      sortOrder: 'DESC'
    };

    const startTime = Date.now();
    const result = await performanceOptimizer.optimizeImageQuery(databaseService, largeDataPagination, true);
    const duration = Date.now() - startTime;
    
    console.log(`大数据量查询完成:`);
    console.log(`- 查询时间: ${duration}ms`);
    console.log(`- 返回记录数: ${result.data.length}`);
    console.log(`- 总记录数: ${result.total}`);
    console.log(`- 总页数: ${result.totalPages}`);
    console.log(`- 当前页: ${result.page}/${result.totalPages}`);

    // 演示优化后的大数据量处理
    if (result.total > 100) {
      console.log('\n演示优化的大数据量处理...');
      const optimizedResult = await performanceOptimizer.optimizeLargeDataQuery(
        databaseService,
        Math.min(result.total, 200), // 限制最大处理数量
        25 // 批次大小
      );
      
      console.log(`优化处理完成，实际获取: ${optimizedResult.length} 条记录`);
    }

    console.log('\n=== 大数据量处理演示完成 ===');

  } catch (error: any) {
    console.error('大数据量处理演示失败:', error);
    throw error;
  }
}

/**
 * 主演示函数
 */
export async function runPerformanceOptimizationDemo() {
  console.log('开始性能优化功能演示...\n');

  try {
    // 确保数据库已连接
    const connectionStatus = databaseService.getConnectionStatus();
    if (!connectionStatus.isConnected) {
      console.log('数据库未连接，请先配置并连接数据库');
      return;
    }

    // 运行基础性能优化演示
    await demonstratePerformanceOptimization();
    
    // 运行大数据量处理演示
    await demonstrateLargeDataOptimization();

    console.log('\n✅ 所有性能优化演示完成！');

  } catch (error: any) {
    console.error('\n❌ 性能优化演示失败:', error);
    throw error;
  }
}

// 如果直接运行此文件
if (require.main === module) {
  runPerformanceOptimizationDemo()
    .then(() => {
      console.log('演示程序正常结束');
      process.exit(0);
    })
    .catch((error) => {
      console.error('演示程序异常结束:', error);
      process.exit(1);
    });
}
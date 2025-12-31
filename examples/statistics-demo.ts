/**
 * 数据统计功能演示
 * 展示如何使用统计服务获取各种数据分析信息
 */

import { databaseService } from '../services/databaseService';
import { statisticsService } from '../services/statisticsService';
import { DatabaseConfig } from '../types';

/**
 * 演示统计功能
 */
async function demonstrateStatistics() {
  console.log('=== 数据统计功能演示 ===\n');

  try {
    // 1. 连接数据库（使用示例配置）
    const dbConfig: DatabaseConfig = {
      host: 'localhost',
      port: 3306,
      database: 'nano_banana',
      username: 'root',
      password: 'password',
      ssl: false,
      enabled: true
    };

    console.log('1. 连接数据库...');
    const connected = await databaseService.connect(dbConfig);
    if (!connected) {
      console.error('数据库连接失败');
      return;
    }
    console.log('✅ 数据库连接成功\n');

    // 2. 获取图片统计概览
    console.log('2. 获取图片统计概览...');
    const imageOverview = await statisticsService.getImageOverview();
    console.log('📊 图片统计概览:');
    console.log(`   总图片数: ${imageOverview.totalImages}`);
    console.log(`   收藏图片: ${imageOverview.favoriteImages}`);
    console.log(`   已上传OSS: ${imageOverview.uploadedToOSS}`);
    console.log(`   待上传: ${imageOverview.pendingOSSUpload}`);
    console.log(`   今日新增: ${imageOverview.byTimeRange.today}`);
    console.log(`   本周新增: ${imageOverview.byTimeRange.thisWeek}`);
    console.log(`   本月新增: ${imageOverview.byTimeRange.thisMonth}\n`);

    // 3. 按模型统计
    console.log('3. 按模型统计分布:');
    Object.entries(imageOverview.byModel).forEach(([model, count]) => {
      console.log(`   ${model}: ${count} 张`);
    });
    console.log();

    // 4. 获取数据库完整统计
    console.log('4. 获取数据库完整统计...');
    const dbOverview = await statisticsService.getDatabaseOverview();
    console.log('🗄️ 数据库统计概览:');
    console.log(`   总操作数: ${dbOverview.operations.totalOperations}`);
    console.log(`   成功操作: ${dbOverview.operations.successfulOperations}`);
    console.log(`   失败操作: ${dbOverview.operations.failedOperations}`);
    console.log(`   最近1小时操作: ${dbOverview.operations.recentOperations}`);
    console.log(`   平均响应时间: ${dbOverview.performance.averageResponseTime.toFixed(2)}ms`);
    console.log(`   最慢操作: ${dbOverview.performance.slowestOperation.toFixed(2)}ms`);
    console.log(`   最快操作: ${dbOverview.performance.fastestOperation.toFixed(2)}ms\n`);

    // 5. 按操作类型统计
    console.log('5. 按操作类型统计:');
    Object.entries(dbOverview.operations.byOperation).forEach(([operation, count]) => {
      console.log(`   ${operation}: ${count} 次`);
    });
    console.log();

    // 6. 获取今日统计摘要
    console.log('6. 获取今日统计摘要...');
    const todaySummary = await statisticsService.getTodaysSummary();
    console.log('📅 今日统计摘要:');
    console.log(`   今日新增图片: ${todaySummary.todayImages}`);
    console.log(`   今日操作数: ${todaySummary.todayOperations}`);
    console.log(`   今日错误数: ${todaySummary.todayErrors}`);
    console.log('   热门模型:');
    todaySummary.topModels.forEach((item, index) => {
      console.log(`     ${index + 1}. ${item.model}: ${item.count} 张`);
    });
    console.log();

    // 7. 获取收藏图片统计
    console.log('7. 获取收藏图片统计...');
    const favoriteStats = await statisticsService.getFavoriteImageStats();
    console.log('⭐ 收藏图片统计:');
    console.log(`   收藏图片总数: ${favoriteStats.totalImages}`);
    console.log(`   今日收藏: ${favoriteStats.byTimeRange.today}`);
    console.log(`   本周收藏: ${favoriteStats.byTimeRange.thisWeek}`);
    console.log('   收藏图片模型分布:');
    Object.entries(favoriteStats.byModel).forEach(([model, count]) => {
      console.log(`     ${model}: ${count} 张`);
    });
    console.log();

    // 8. 获取OSS上传状态统计
    console.log('8. 获取OSS上传状态统计...');
    const ossStats = await statisticsService.getOSSUploadStats();
    console.log('☁️ OSS上传状态统计:');
    console.log(`   已上传图片: ${ossStats.uploaded.totalImages}`);
    console.log(`   待上传图片: ${ossStats.pending.totalImages}`);
    console.log('   已上传图片模型分布:');
    Object.entries(ossStats.uploaded.byModel).forEach(([model, count]) => {
      console.log(`     ${model}: ${count} 张`);
    });
    console.log();

    // 9. 获取最近操作日志
    console.log('9. 获取最近操作日志...');
    const recentOperations = await statisticsService.getRecentOperations(10);
    console.log('📝 最近10条操作日志:');
    recentOperations.forEach((log, index) => {
      const time = log.createdAt.toLocaleString();
      const duration = log.duration ? `${log.duration}ms` : 'N/A';
      const status = log.status === 'SUCCESS' ? '✅' : '❌';
      console.log(`   ${index + 1}. ${status} ${log.operation} (${log.tableName}) - ${time} - ${duration}`);
    });
    console.log();

    // 10. 获取错误操作日志
    console.log('10. 获取错误操作日志...');
    const errorOperations = await statisticsService.getErrorOperations(5);
    console.log('❌ 最近5条错误操作:');
    if (errorOperations.length === 0) {
      console.log('   暂无错误操作记录');
    } else {
      errorOperations.forEach((log, index) => {
        const time = log.createdAt.toLocaleString();
        console.log(`   ${index + 1}. ${log.operation} (${log.tableName}) - ${time}`);
        console.log(`      错误: ${log.errorMessage}`);
      });
    }
    console.log();

    // 11. 生成完整统计报告
    console.log('11. 生成完整统计报告...');
    const report = await statisticsService.generateStatisticsReport();
    console.log('📋 统计报告:');
    console.log('   系统建议:');
    report.recommendations.forEach((recommendation, index) => {
      console.log(`     ${index + 1}. ${recommendation}`);
    });
    console.log();

    // 12. 演示时间范围统计
    console.log('12. 演示时间范围统计...');
    const lastWeek = new Date();
    lastWeek.setDate(lastWeek.getDate() - 7);
    const now = new Date();
    
    const weekStats = await statisticsService.getImageStatsByDateRange(lastWeek, now);
    console.log('📆 最近一周图片统计:');
    console.log(`   时间范围: ${lastWeek.toLocaleDateString()} - ${now.toLocaleDateString()}`);
    console.log(`   图片数量: ${weekStats.totalImages}`);
    console.log(`   收藏数量: ${weekStats.favoriteImages}`);
    console.log(`   上传数量: ${weekStats.uploadedToOSS}\n`);

    // 13. 演示模型筛选统计
    console.log('13. 演示模型筛选统计...');
    const availableModels = Object.keys(imageOverview.byModel);
    if (availableModels.length > 0) {
      const selectedModels = availableModels.slice(0, 2); // 选择前两个模型
      const modelStats = await statisticsService.getImageStatsByModel(selectedModels);
      console.log(`🎯 指定模型统计 (${selectedModels.join(', ')}):`);
      console.log(`   图片数量: ${modelStats.totalImages}`);
      console.log(`   收藏数量: ${modelStats.favoriteImages}`);
      console.log('   模型分布:');
      Object.entries(modelStats.byModel).forEach(([model, count]) => {
        console.log(`     ${model}: ${count} 张`);
      });
    } else {
      console.log('   暂无可用模型数据');
    }

    console.log('\n=== 统计功能演示完成 ===');

  } catch (error) {
    console.error('演示过程中发生错误:', error);
  } finally {
    // 断开数据库连接
    await databaseService.disconnect();
    console.log('数据库连接已断开');
  }
}

/**
 * 演示实时统计监控
 */
async function demonstrateRealTimeMonitoring() {
  console.log('\n=== 实时统计监控演示 ===');
  
  try {
    // 模拟定期获取统计信息
    console.log('开始实时监控（每5秒更新一次，共监控30秒）...\n');
    
    let count = 0;
    const maxCount = 6; // 30秒 / 5秒 = 6次
    
    const monitorInterval = setInterval(async () => {
      try {
        count++;
        console.log(`--- 第 ${count} 次监控 (${new Date().toLocaleTimeString()}) ---`);
        
        // 获取关键指标
        const overview = await statisticsService.getImageOverview();
        const todaySummary = await statisticsService.getTodaysSummary();
        
        console.log(`图片总数: ${overview.totalImages} | 今日新增: ${todaySummary.todayImages} | 今日操作: ${todaySummary.todayOperations}`);
        
        if (count >= maxCount) {
          clearInterval(monitorInterval);
          console.log('\n实时监控演示完成');
        }
        
      } catch (error) {
        console.error('监控过程中发生错误:', error);
        clearInterval(monitorInterval);
      }
    }, 5000);
    
  } catch (error) {
    console.error('启动实时监控失败:', error);
  }
}

// 如果直接运行此文件，执行演示
if (require.main === module) {
  demonstrateStatistics()
    .then(() => demonstrateRealTimeMonitoring())
    .catch(console.error);
}

export {
  demonstrateStatistics,
  demonstrateRealTimeMonitoring
};
/**
 * 连接状态监控功能演示
 * 展示如何使用连接监控器监控数据库连接状态
 */

import { databaseService } from '../services/databaseService';
import { ConnectionQuality, ConnectionStatusChangeEvent } from '../services/connectionMonitor';
import { DatabaseConfig } from '../types';

/**
 * 连接监控演示
 */
async function demonstrateConnectionMonitoring() {
  console.log('🔍 连接状态监控功能演示');
  console.log('================================');

  // 示例数据库配置（请根据实际情况修改）
  const testConfig: DatabaseConfig = {
    host: 'localhost',
    port: 3306,
    database: 'test_db',
    username: 'test_user',
    password: 'test_password',
    ssl: false,
    enabled: true
  };

  try {
    console.log('📊 1. 获取初始连接状态...');
    const initialStatus = databaseService.getConnectionStatus();
    console.log('初始连接状态:', {
      isConnected: initialStatus.isConnected,
      lastConnected: initialStatus.lastConnected,
      error: initialStatus.error,
      latency: initialStatus.latency
    });

    console.log('\n🎯 2. 设置连接状态监听器...');
    
    // 添加状态变化监听器
    const statusListener = (event: ConnectionStatusChangeEvent) => {
      console.log(`📡 连接状态变化: ${event.changeType}`, {
        timestamp: event.timestamp.toLocaleTimeString(),
        isConnected: event.currentStatus.isConnected,
        quality: event.quality,
        latency: event.currentStatus.latency,
        error: event.currentStatus.error
      });
    };
    
    databaseService.addConnectionStatusListener(statusListener);
    console.log('✅ 状态监听器已添加');

    console.log('\n🚀 3. 启动连接监控...');
    databaseService.startConnectionMonitoring();
    
    // 设置较短的监控间隔用于演示（实际使用中建议30秒以上）
    databaseService.setConnectionMonitoringInterval(10000); // 10秒
    
    const monitoringStatus = databaseService.getConnectionMonitoringStatus();
    console.log('监控状态:', {
      isMonitoring: monitoringStatus.isMonitoring,
      intervalMs: monitoringStatus.intervalMs,
      listenersCount: monitoringStatus.listenersCount
    });

    console.log('\n🔌 4. 尝试连接数据库...');
    try {
      const connected = await databaseService.connect(testConfig);
      console.log(`连接结果: ${connected ? '成功' : '失败'}`);
      
      if (connected) {
        console.log('\n📈 5. 获取连接质量信息...');
        const quality = databaseService.getCurrentConnectionQuality();
        const qualityStats = databaseService.getConnectionQualityStats();
        
        console.log('当前连接质量:', quality);
        console.log('质量统计:', {
          averageLatency: Math.round(qualityStats.averageLatency),
          successRate: Math.round(qualityStats.successRate),
          totalTests: qualityStats.totalTests,
          failedTests: qualityStats.failedTests
        });
      }
    } catch (error) {
      console.log('连接失败（这是正常的，因为使用的是测试配置）:', error.message);
    }

    console.log('\n🧪 6. 手动触发连接测试...');
    const testResult = await databaseService.triggerConnectionTest();
    console.log('连接测试结果:', {
      success: testResult.success,
      latency: testResult.latency,
      quality: testResult.quality,
      error: testResult.error
    });

    console.log('\n📊 7. 等待监控数据收集...');
    console.log('监控将在后台运行，每10秒检查一次连接状态');
    console.log('请等待30秒观察监控效果...');
    
    // 等待30秒让监控器收集数据
    await new Promise(resolve => setTimeout(resolve, 30000));

    console.log('\n📋 8. 查看监控历史...');
    const statusHistory = databaseService.getConnectionStatusHistory(5);
    console.log(`最近 ${statusHistory.length} 次状态变化:`);
    statusHistory.forEach((event, index) => {
      console.log(`  ${index + 1}. ${event.changeType} - ${event.timestamp.toLocaleTimeString()} - 质量: ${event.quality}`);
    });

    const updatedQualityStats = databaseService.getConnectionQualityStats();
    console.log('\n更新后的质量统计:', {
      averageLatency: Math.round(updatedQualityStats.averageLatency),
      successRate: Math.round(updatedQualityStats.successRate),
      totalTests: updatedQualityStats.totalTests,
      failedTests: updatedQualityStats.failedTests,
      qualityTrend: updatedQualityStats.qualityTrend.slice(-5) // 最近5次质量记录
    });

  } catch (error) {
    console.error('❌ 演示过程中出错:', error);
  } finally {
    console.log('\n🛑 9. 清理资源...');
    
    // 停止监控
    databaseService.stopConnectionMonitoring();
    console.log('✅ 连接监控已停止');
    
    // 断开连接
    await databaseService.disconnect();
    console.log('✅ 数据库连接已断开');
    
    console.log('\n🎉 连接监控演示完成！');
  }
}

/**
 * 连接质量等级演示
 */
function demonstrateConnectionQuality() {
  console.log('\n🎨 连接质量等级说明:');
  console.log('================================');
  
  const qualityLevels = [
    { level: ConnectionQuality.EXCELLENT, latency: '< 50ms', description: '优秀 - 连接延迟极低，响应迅速' },
    { level: ConnectionQuality.GOOD, latency: '50-200ms', description: '良好 - 连接稳定，响应正常' },
    { level: ConnectionQuality.FAIR, latency: '200-500ms', description: '一般 - 连接可用，但可能有轻微延迟' },
    { level: ConnectionQuality.POOR, latency: '500-1000ms', description: '较差 - 连接延迟较高，可能影响使用体验' },
    { level: ConnectionQuality.VERY_POOR, latency: '> 1000ms', description: '很差 - 连接不稳定或已断开' }
  ];
  
  qualityLevels.forEach(({ level, latency, description }) => {
    console.log(`${level}: ${latency} - ${description}`);
  });
}

/**
 * 监控配置建议
 */
function showMonitoringRecommendations() {
  console.log('\n💡 监控配置建议:');
  console.log('================================');
  console.log('1. 监控间隔: 建议设置为30-60秒，避免过于频繁的检查');
  console.log('2. 历史记录: 系统默认保留最近100次状态变化记录');
  console.log('3. 质量统计: 使用指数移动平均计算延迟，更准确反映当前状态');
  console.log('4. 监听器: 可以添加多个监听器处理不同的状态变化事件');
  console.log('5. 资源管理: 不使用时记得停止监控以节省资源');
  console.log('6. 错误处理: 监控器会自动处理网络异常，不会影响主要功能');
}

// 如果直接运行此文件，执行演示
if (require.main === module) {
  demonstrateConnectionQuality();
  showMonitoringRecommendations();
  
  console.log('\n⚠️  注意: 要运行完整的连接监控演示，请确保:');
  console.log('1. 已配置有效的数据库连接信息');
  console.log('2. 数据库服务正在运行');
  console.log('3. 网络连接正常');
  console.log('\n如需运行完整演示，请取消注释下面的代码:');
  console.log('// demonstrateConnectionMonitoring();');
  
  // 取消注释下面这行来运行完整演示（需要有效的数据库配置）
  // demonstrateConnectionMonitoring();
}

export {
  demonstrateConnectionMonitoring,
  demonstrateConnectionQuality,
  showMonitoringRecommendations
};
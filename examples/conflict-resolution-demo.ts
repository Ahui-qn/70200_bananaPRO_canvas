/**
 * 数据冲突解决机制演示
 * 展示如何使用冲突检测和解决功能
 */

import { conflictResolver, ConflictResolutionStrategy } from '../services/conflictResolver';
import { SavedImage, ApiConfig } from '../types';

/**
 * 演示图片数据冲突解决
 */
async function demonstrateImageConflictResolution() {
  console.log('\n=== 图片数据冲突解决演示 ===');
  
  // 模拟本地和远程的图片数据
  const localImage: SavedImage = {
    id: 'demo-image-1',
    url: 'https://example.com/image1.jpg',
    prompt: '本地修改的提示词：美丽的风景画',
    model: 'nano-banana-fast',
    aspectRatio: 'auto',
    imageSize: '1K',
    createdAt: new Date('2024-01-01T12:00:00Z'), // 更新的时间
    favorite: true,
    tags: ['风景', '自然', '本地标签']
  };

  const remoteImage: SavedImage = {
    id: 'demo-image-1',
    url: 'https://example.com/image1.jpg',
    prompt: '远程修改的提示词：山水画作品',
    model: 'nano-banana-fast',
    aspectRatio: 'auto',
    imageSize: '1K',
    createdAt: new Date('2024-01-01T10:00:00Z'), // 较旧的时间
    favorite: false,
    tags: ['山水', '艺术', '远程标签']
  };

  // 检测冲突
  const conflict = conflictResolver.detectConflict(
    localImage,
    remoteImage,
    'demo-image-1',
    'images'
  );

  if (conflict) {
    console.log('✅ 检测到冲突:');
    console.log(`  - 记录ID: ${conflict.recordId}`);
    console.log(`  - 冲突字段: ${conflict.conflictFields.join(', ')}`);
    console.log(`  - 本地时间戳: ${conflict.localTimestamp.toISOString()}`);
    console.log(`  - 远程时间戳: ${conflict.remoteTimestamp.toISOString()}`);

    // 使用最新时间戳策略解决冲突
    const resolution = conflictResolver.resolveConflict(
      conflict,
      ConflictResolutionStrategy.LATEST_WINS
    );

    if (resolution.resolved) {
      console.log('\n✅ 冲突解决成功:');
      console.log(`  - 策略: ${resolution.strategy}`);
      console.log(`  - 消息: ${resolution.message}`);
      console.log(`  - 最终提示词: ${resolution.finalData.prompt}`);
      console.log(`  - 最终收藏状态: ${resolution.finalData.favorite}`);
      console.log(`  - 最终标签: ${JSON.stringify(resolution.finalData.tags)}`);
    } else {
      console.log('❌ 冲突解决失败:', resolution.message);
    }
  } else {
    console.log('ℹ️ 未检测到冲突');
  }
}

/**
 * 演示API配置冲突解决
 */
async function demonstrateApiConfigConflictResolution() {
  console.log('\n=== API配置冲突解决演示 ===');
  
  // 模拟本地和远程的API配置
  const localConfig: ApiConfig = {
    apiKey: 'local-api-key-12345',
    baseUrl: 'https://api.local.example.com',
    timeout: 30000,
    retryCount: 5,
    provider: 'Local Provider'
  };

  const remoteConfig: ApiConfig = {
    apiKey: 'remote-api-key-67890',
    baseUrl: 'https://api.remote.example.com',
    timeout: 30000,
    retryCount: 3,
    provider: 'Remote Provider'
  };

  // 添加时间戳信息进行冲突检测
  const localConfigWithTimestamp = {
    ...localConfig,
    updatedAt: new Date('2024-01-01T14:00:00Z')
  };

  const remoteConfigWithTimestamp = {
    ...remoteConfig,
    updatedAt: new Date('2024-01-01T13:00:00Z')
  };

  // 检测冲突
  const conflict = conflictResolver.detectConflict(
    localConfigWithTimestamp,
    remoteConfigWithTimestamp,
    'api_config',
    'user_configs'
  );

  if (conflict) {
    console.log('✅ 检测到配置冲突:');
    console.log(`  - 记录ID: ${conflict.recordId}`);
    console.log(`  - 冲突字段: ${conflict.conflictFields.join(', ')}`);
    console.log(`  - 本地时间戳: ${conflict.localTimestamp.toISOString()}`);
    console.log(`  - 远程时间戳: ${conflict.remoteTimestamp.toISOString()}`);

    // 演示不同的解决策略
    console.log('\n📋 尝试不同的解决策略:');

    // 1. 最新时间戳优先
    const latestWinsResolution = conflictResolver.resolveConflict(
      conflict,
      ConflictResolutionStrategy.LATEST_WINS
    );
    console.log(`\n1️⃣ 最新时间戳优先: ${latestWinsResolution.message}`);
    console.log(`   最终API密钥: ${latestWinsResolution.finalData.apiKey}`);
    console.log(`   最终提供商: ${latestWinsResolution.finalData.provider}`);

    // 2. 本地优先
    const localWinsResolution = conflictResolver.resolveConflict(
      conflict,
      ConflictResolutionStrategy.LOCAL_WINS
    );
    console.log(`\n2️⃣ 本地优先: ${localWinsResolution.message}`);
    console.log(`   最终API密钥: ${localWinsResolution.finalData.apiKey}`);
    console.log(`   最终提供商: ${localWinsResolution.finalData.provider}`);

    // 3. 远程优先
    const remoteWinsResolution = conflictResolver.resolveConflict(
      conflict,
      ConflictResolutionStrategy.REMOTE_WINS
    );
    console.log(`\n3️⃣ 远程优先: ${remoteWinsResolution.message}`);
    console.log(`   最终API密钥: ${remoteWinsResolution.finalData.apiKey}`);
    console.log(`   最终提供商: ${remoteWinsResolution.finalData.provider}`);

  } else {
    console.log('ℹ️ 未检测到配置冲突');
  }
}

/**
 * 演示批量冲突解决
 */
async function demonstrateBatchConflictResolution() {
  console.log('\n=== 批量冲突解决演示 ===');
  
  // 创建多个冲突场景
  const conflicts: any[] = [];

  // 冲突1：图片提示词冲突
  const conflict1 = conflictResolver.detectConflict(
    {
      id: 'batch-image-1',
      prompt: '本地提示词：春天的花园',
      createdAt: new Date('2024-01-01T15:00:00Z')
    },
    {
      id: 'batch-image-1',
      prompt: '远程提示词：夏日的海滩',
      createdAt: new Date('2024-01-01T14:00:00Z')
    },
    'batch-image-1',
    'images'
  );

  // 冲突2：图片收藏状态冲突
  const conflict2 = conflictResolver.detectConflict(
    {
      id: 'batch-image-2',
      favorite: true,
      createdAt: new Date('2024-01-01T13:00:00Z')
    },
    {
      id: 'batch-image-2',
      favorite: false,
      createdAt: new Date('2024-01-01T16:00:00Z') // 远程更新
    },
    'batch-image-2',
    'images'
  );

  // 冲突3：配置超时设置冲突
  const conflict3 = conflictResolver.detectConflict(
    {
      id: 'batch-config-1',
      timeout: 30000,
      updatedAt: new Date('2024-01-01T17:00:00Z')
    },
    {
      id: 'batch-config-1',
      timeout: 60000,
      updatedAt: new Date('2024-01-01T16:30:00Z')
    },
    'batch-config-1',
    'user_configs'
  );

  // 收集所有冲突
  [conflict1, conflict2, conflict3].forEach(conflict => {
    if (conflict) conflicts.push(conflict);
  });

  console.log(`📊 检测到 ${conflicts.length} 个冲突`);

  if (conflicts.length > 0) {
    // 批量解决冲突
    const resolutions = conflictResolver.resolveConflicts(
      conflicts,
      ConflictResolutionStrategy.LATEST_WINS
    );

    console.log('\n✅ 批量解决结果:');
    resolutions.forEach((resolution, index) => {
      console.log(`\n${index + 1}. ${resolution.conflictInfo.recordId}:`);
      console.log(`   状态: ${resolution.resolved ? '✅ 成功' : '❌ 失败'}`);
      console.log(`   消息: ${resolution.message}`);
      if (resolution.resolved) {
        console.log(`   解决策略: ${resolution.strategy}`);
      }
    });

    const successCount = resolutions.filter(r => r.resolved).length;
    console.log(`\n📈 总结: ${successCount}/${resolutions.length} 个冲突解决成功`);
  }
}

/**
 * 演示冲突统计和日志功能
 */
async function demonstrateConflictStatistics() {
  console.log('\n=== 冲突统计和日志演示 ===');
  
  // 获取冲突统计信息
  const stats = conflictResolver.getConflictStats();
  console.log('📊 冲突统计信息:');
  console.log(`  - 总冲突数: ${stats.total}`);
  console.log(`  - 按类型统计:`);
  Object.entries(stats.byType).forEach(([type, count]) => {
    if (count > 0) {
      console.log(`    * ${type}: ${count}`);
    }
  });
  console.log(`  - 按表统计:`);
  Object.entries(stats.byTable).forEach(([table, count]) => {
    if (count > 0) {
      console.log(`    * ${table}: ${count}`);
    }
  });
  console.log(`  - 最近1小时冲突: ${stats.recent}`);

  // 获取冲突日志
  const logs = conflictResolver.getConflictLogs(5); // 获取最近5条
  console.log(`\n📝 最近冲突日志 (最多5条):`);
  logs.forEach((log, index) => {
    console.log(`\n${index + 1}. ${log.recordId} (${log.tableName})`);
    console.log(`   类型: ${log.type}`);
    console.log(`   冲突字段: ${log.conflictFields.join(', ')}`);
    console.log(`   检测时间: ${log.detectedAt.toISOString()}`);
  });
}

/**
 * 主演示函数
 */
async function main() {
  console.log('🚀 数据冲突解决机制演示开始');
  console.log('=====================================');

  try {
    // 清除之前的日志
    conflictResolver.clearConflictLogs();
    
    // 运行各种演示
    await demonstrateImageConflictResolution();
    await demonstrateApiConfigConflictResolution();
    await demonstrateBatchConflictResolution();
    await demonstrateConflictStatistics();

    console.log('\n🎉 演示完成！');
    console.log('\n💡 关键特性总结:');
    console.log('  ✅ 基于时间戳的冲突检测');
    console.log('  ✅ 多种冲突解决策略（最新优先、本地优先、远程优先）');
    console.log('  ✅ 批量冲突处理');
    console.log('  ✅ 冲突日志记录和统计');
    console.log('  ✅ 支持图片数据和配置数据冲突');

  } catch (error) {
    console.error('❌ 演示过程中出现错误:', error);
  }
}

// 如果直接运行此文件，执行演示
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export {
  demonstrateImageConflictResolution,
  demonstrateApiConfigConflictResolution,
  demonstrateBatchConflictResolution,
  demonstrateConflictStatistics,
  main as runConflictResolutionDemo
};
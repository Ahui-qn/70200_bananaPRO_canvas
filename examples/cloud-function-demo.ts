/**
 * 云函数调用示例
 * 演示如何使用 CloudFunctionAPI 进行各种数据库操作
 */

import { cloudFunctionAPI } from '../services/cloudFunctionAPI';
import { DatabaseConfig, SavedImage, ApiConfig, OSSConfig } from '../types';

/**
 * 示例数据库配置
 */
const sampleDatabaseConfig: DatabaseConfig = {
  host: 'your-rds-host.mysql.rds.aliyuncs.com',
  port: 3306,
  database: 'nano_banana_db',
  username: 'your_username',
  password: 'your_password',
  ssl: true,
  enabled: true
};

/**
 * 示例图片数据
 */
const sampleImage: SavedImage = {
  id: 'demo-image-001',
  url: 'https://example.com/demo-image.jpg',
  prompt: '一只可爱的小猫咪在花园里玩耍',
  model: 'nano-banana-fast',
  aspectRatio: 'auto',
  imageSize: '1K',
  createdAt: new Date(),
  favorite: false,
  ossUploaded: false
};

/**
 * 示例 API 配置
 */
const sampleApiConfig: ApiConfig = {
  apiKey: 'your-api-key-here',
  baseUrl: 'https://grsai.dakka.com.cn/v1/draw',
  timeout: 30000,
  retryCount: 3,
  provider: 'Nano Banana AI'
};

/**
 * 示例 OSS 配置
 */
const sampleOSSConfig: OSSConfig = {
  accessKeyId: 'your-access-key-id',
  accessKeySecret: 'your-access-key-secret',
  region: 'cn-hangzhou',
  bucket: 'your-bucket-name',
  enabled: true
};

/**
 * 云函数调用演示类
 */
export class CloudFunctionDemo {
  
  /**
   * 演示数据库连接测试
   */
  static async demonstrateConnectionTest(): Promise<void> {
    console.log('\n=== 演示数据库连接测试 ===');
    
    try {
      const isConnected = await cloudFunctionAPI.testConnection(sampleDatabaseConfig);
      console.log('数据库连接测试结果:', isConnected ? '成功' : '失败');
    } catch (error) {
      console.error('连接测试失败:', error);
    }
  }

  /**
   * 演示数据库表初始化
   */
  static async demonstrateTableInitialization(): Promise<void> {
    console.log('\n=== 演示数据库表初始化 ===');
    
    try {
      await cloudFunctionAPI.initTables(sampleDatabaseConfig);
      console.log('数据库表初始化成功');
    } catch (error) {
      console.error('表初始化失败:', error);
    }
  }

  /**
   * 演示图片数据操作
   */
  static async demonstrateImageOperations(): Promise<void> {
    console.log('\n=== 演示图片数据操作 ===');
    
    try {
      // 1. 保存图片
      console.log('1. 保存图片到数据库...');
      const savedImage = await cloudFunctionAPI.saveImage(sampleDatabaseConfig, sampleImage);
      console.log('图片保存成功:', savedImage.id);

      // 2. 获取图片列表
      console.log('2. 获取图片列表...');
      const images = await cloudFunctionAPI.getImages(sampleDatabaseConfig, {
        page: 1,
        pageSize: 10,
        sortBy: 'created_at',
        sortOrder: 'DESC'
      });
      console.log(`获取到 ${images.length} 张图片`);

      // 3. 更新图片信息
      console.log('3. 更新图片信息...');
      await cloudFunctionAPI.updateImage(sampleDatabaseConfig, sampleImage.id, {
        favorite: true,
        tags: ['演示', '测试']
      });
      console.log('图片更新成功');

      // 4. 删除图片
      console.log('4. 删除图片...');
      await cloudFunctionAPI.deleteImage(sampleDatabaseConfig, sampleImage.id);
      console.log('图片删除成功');

    } catch (error) {
      console.error('图片操作失败:', error);
    }
  }

  /**
   * 演示配置管理操作
   */
  static async demonstrateConfigOperations(): Promise<void> {
    console.log('\n=== 演示配置管理操作 ===');
    
    try {
      // 1. 保存 API 配置
      console.log('1. 保存 API 配置...');
      await cloudFunctionAPI.saveConfig(sampleDatabaseConfig, 'api', sampleApiConfig);
      console.log('API 配置保存成功');

      // 2. 获取 API 配置
      console.log('2. 获取 API 配置...');
      const apiConfig = await cloudFunctionAPI.getConfig(sampleDatabaseConfig, 'api');
      console.log('API 配置获取成功:', apiConfig?.provider);

      // 3. 保存 OSS 配置
      console.log('3. 保存 OSS 配置...');
      await cloudFunctionAPI.saveConfig(sampleDatabaseConfig, 'oss', sampleOSSConfig);
      console.log('OSS 配置保存成功');

      // 4. 获取 OSS 配置
      console.log('4. 获取 OSS 配置...');
      const ossConfig = await cloudFunctionAPI.getConfig(sampleDatabaseConfig, 'oss');
      console.log('OSS 配置获取成功:', ossConfig?.bucket);

    } catch (error) {
      console.error('配置操作失败:', error);
    }
  }

  /**
   * 演示批量操作
   */
  static async demonstrateBatchOperations(): Promise<void> {
    console.log('\n=== 演示批量操作 ===');
    
    try {
      // 批量调用多个云函数
      const batchCalls = [
        { functionName: 'test-connection', params: { config: sampleDatabaseConfig } },
        { functionName: 'get-api-config', params: { config: sampleDatabaseConfig } },
        { functionName: 'get-oss-config', params: { config: sampleDatabaseConfig } }
      ];

      console.log('执行批量云函数调用...');
      const results = await cloudFunctionAPI.batchCall(batchCalls);
      
      results.forEach((result, index) => {
        const callName = batchCalls[index].functionName;
        console.log(`${callName}: ${result.success ? '成功' : '失败'}`);
        if (!result.success) {
          console.log(`  错误: ${result.error}`);
        }
      });

    } catch (error) {
      console.error('批量操作失败:', error);
    }
  }

  /**
   * 演示错误处理
   */
  static async demonstrateErrorHandling(): Promise<void> {
    console.log('\n=== 演示错误处理 ===');
    
    try {
      // 使用无效配置测试错误处理
      const invalidConfig: DatabaseConfig = {
        host: '',
        port: 0,
        database: '',
        username: '',
        password: '',
        ssl: false,
        enabled: true
      };

      console.log('测试无效配置的错误处理...');
      const result = await cloudFunctionAPI.testConnection(invalidConfig);
      console.log('意外成功:', result);

    } catch (error) {
      console.log('正确捕获错误:', error instanceof Error ? error.message : String(error));
    }
  }

  /**
   * 演示性能监控
   */
  static async demonstratePerformanceMonitoring(): Promise<void> {
    console.log('\n=== 演示性能监控 ===');
    
    try {
      // 获取调用统计信息
      const stats = cloudFunctionAPI.getCallStatistics();
      console.log('云函数调用统计:', {
        总调用次数: stats.totalCalls,
        成功次数: stats.successfulCalls,
        失败次数: stats.failedCalls,
        平均响应时间: `${stats.averageResponseTime}ms`
      });

      // 重置统计信息
      cloudFunctionAPI.resetStatistics();
      console.log('统计信息已重置');

    } catch (error) {
      console.error('性能监控演示失败:', error);
    }
  }

  /**
   * 运行所有演示
   */
  static async runAllDemonstrations(): Promise<void> {
    console.log('🚀 开始云函数调用演示');
    console.log('注意：这些演示使用模拟数据，实际使用时请配置真实的云函数端点');

    await this.demonstrateConnectionTest();
    await this.demonstrateTableInitialization();
    await this.demonstrateImageOperations();
    await this.demonstrateConfigOperations();
    await this.demonstrateBatchOperations();
    await this.demonstrateErrorHandling();
    await this.demonstratePerformanceMonitoring();

    console.log('\n✅ 云函数调用演示完成');
  }
}

// 如果直接运行此文件，执行演示
if (import.meta.url === `file://${process.argv[1]}`) {
  CloudFunctionDemo.runAllDemonstrations().catch(console.error);
}

export default CloudFunctionDemo;
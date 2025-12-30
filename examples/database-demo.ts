/**
 * 数据库服务演示脚本
 * 展示如何使用新的数据库连接管理器和表结构初始化功能
 */

import { DatabaseServiceImpl } from '../services/databaseService';
import { DatabaseConfig, SavedImage } from '../types';

/**
 * 演示数据库服务的基本功能
 */
async function demonstrateDatabaseService() {
  console.log('🚀 数据库服务演示开始');
  
  const databaseService = new DatabaseServiceImpl();
  
  // 示例配置（实际使用时需要真实的数据库信息）
  const config: DatabaseConfig = {
    host: 'your-database-host.com',
    port: 3306,
    database: 'nano_banana_ai',
    username: 'your_username',
    password: 'your_password',
    ssl: true,
    enabled: true
  };
  
  try {
    console.log('📊 检查连接状态...');
    const initialStatus = databaseService.getConnectionStatus();
    console.log('初始连接状态:', {
      isConnected: initialStatus.isConnected,
      lastConnected: initialStatus.lastConnected,
      error: initialStatus.error
    });
    
    console.log('🔌 尝试连接数据库...');
    // 注意：这会失败，因为我们没有真实的数据库配置
    // 但演示了如何使用 API
    try {
      await databaseService.connect(config);
      console.log('✅ 数据库连接成功！');
      
      console.log('🏗️ 初始化数据库表结构...');
      await databaseService.initializeTables();
      console.log('✅ 数据库表结构初始化完成！');
      
      console.log('📈 获取数据库统计信息...');
      const stats = await databaseService.getDatabaseStats();
      console.log('数据库统计:', stats);
      
      console.log('🔍 检查数据库版本兼容性...');
      const versionInfo = await databaseService.checkDatabaseVersion();
      console.log('数据库版本信息:', versionInfo);
      
      // 演示图片数据操作
      console.log('🖼️ 演示图片数据操作...');
      const testImage: SavedImage = {
        id: `demo_${Date.now()}`,
        url: 'https://example.com/demo-image.jpg',
        prompt: '演示图片：一个美丽的风景',
        model: 'nano-banana-fast',
        aspectRatio: '16:9',
        imageSize: '2K',
        createdAt: new Date(),
        tags: ['演示', '风景', '测试'],
        favorite: false,
        ossUploaded: false
      };
      
      // 保存图片
      const savedImage = await databaseService.saveImage(testImage);
      console.log('✅ 图片保存成功:', savedImage.id);
      
      // 查询图片
      const images = await databaseService.getImages({
        page: 1,
        pageSize: 10,
        sortBy: 'created_at',
        sortOrder: 'DESC'
      });
      console.log('✅ 图片查询成功，共找到', images.total, '张图片');
      
      // 更新图片
      await databaseService.updateImage(testImage.id, {
        favorite: true,
        tags: ['演示', '风景', '测试', '已收藏']
      });
      console.log('✅ 图片更新成功');
      
      // 演示配置管理
      console.log('⚙️ 演示配置管理...');
      
      const apiConfig = {
        apiKey: 'demo-api-key-12345',
        baseUrl: 'https://api.example.com',
        timeout: 30000,
        retryCount: 3,
        provider: 'Demo Provider'
      };
      
      await databaseService.saveApiConfig(apiConfig);
      console.log('✅ API 配置保存成功');
      
      const retrievedApiConfig = await databaseService.getApiConfig();
      console.log('✅ API 配置读取成功:', retrievedApiConfig?.provider);
      
      const ossConfig = {
        accessKeyId: 'demo-access-key-id',
        accessKeySecret: 'demo-access-key-secret',
        region: 'cn-hangzhou',
        bucket: 'demo-bucket',
        endpoint: 'https://oss-cn-hangzhou.aliyuncs.com',
        secure: true,
        enabled: true
      };
      
      await databaseService.saveOSSConfig(ossConfig);
      console.log('✅ OSS 配置保存成功');
      
      const retrievedOSSConfig = await databaseService.getOSSConfig();
      console.log('✅ OSS 配置读取成功:', retrievedOSSConfig?.bucket);
      
    } catch (error) {
      console.log('❌ 数据库操作失败（这是预期的，因为没有真实的数据库）:', (error as Error).message);
    }
    
  } catch (error) {
    console.log('❌ 数据库连接失败（这是预期的，因为没有真实的数据库）:', (error as Error).message);
  } finally {
    console.log('🔌 断开数据库连接...');
    await databaseService.disconnect();
    console.log('✅ 数据库连接已断开');
  }
  
  console.log('🎉 数据库服务演示完成');
}

/**
 * 演示配置验证功能
 */
function demonstrateConfigValidation() {
  console.log('\n📋 配置验证演示');
  
  // 测试有效配置
  const validConfig: DatabaseConfig = {
    host: 'localhost',
    port: 3306,
    database: 'test_db',
    username: 'test_user',
    password: 'secure_password',
    ssl: true,
    enabled: true
  };
  
  console.log('✅ 有效配置示例:', {
    host: validConfig.host,
    port: validConfig.port,
    database: validConfig.database,
    ssl: validConfig.ssl
  });
  
  // 测试无效配置
  const invalidConfigs = [
    {
      name: '空主机地址',
      config: { ...validConfig, host: '' }
    },
    {
      name: '无效端口',
      config: { ...validConfig, port: 0 }
    },
    {
      name: '空数据库名',
      config: { ...validConfig, database: '' }
    },
    {
      name: '空用户名',
      config: { ...validConfig, username: '' }
    },
    {
      name: '空密码',
      config: { ...validConfig, password: '' }
    }
  ];
  
  console.log('❌ 无效配置示例:');
  for (const { name, config } of invalidConfigs) {
    console.log(`  - ${name}: 会被拒绝`);
  }
}

/**
 * 演示数据模型
 */
function demonstrateDataModels() {
  console.log('\n📊 数据模型演示');
  
  // 图片数据模型示例
  const imageExample: SavedImage = {
    id: 'img_20241230_001',
    url: 'https://cdn.example.com/images/beautiful-landscape.jpg',
    originalUrl: 'https://temp.example.com/temp-image.jpg',
    prompt: '一个宁静的山谷，清晨的阳光透过薄雾洒在绿色的草地上',
    model: 'nano-banana-hd',
    aspectRatio: '16:9',
    imageSize: '4K',
    refImages: [
      {
        id: 'ref_001',
        file: {} as File, // 实际使用时会是真实的 File 对象
        preview: 'blob:http://localhost:3000/ref-preview',
        name: 'reference-landscape.jpg',
        size: 2048576 // 2MB
      }
    ],
    createdAt: new Date('2024-12-30T10:30:00Z'),
    tags: ['风景', '山谷', '自然', '清晨'],
    favorite: true,
    ossKey: 'images/2024/12/30/img_20241230_001.jpg',
    ossUploaded: true
  };
  
  console.log('🖼️ 图片数据模型示例:');
  console.log('  - ID:', imageExample.id);
  console.log('  - 提示词:', imageExample.prompt.substring(0, 30) + '...');
  console.log('  - 模型:', imageExample.model);
  console.log('  - 尺寸:', imageExample.imageSize);
  console.log('  - 标签:', imageExample.tags?.join(', '));
  console.log('  - 是否收藏:', imageExample.favorite);
  console.log('  - OSS 状态:', imageExample.ossUploaded ? '已上传' : '未上传');
  
  // 分页查询示例
  const paginationExample = {
    page: 1,
    pageSize: 20,
    sortBy: 'created_at',
    sortOrder: 'DESC' as const,
    filters: {
      model: 'nano-banana-hd',
      favorite: true,
      search: '风景'
    }
  };
  
  console.log('📄 分页查询示例:');
  console.log('  - 页码:', paginationExample.page);
  console.log('  - 每页大小:', paginationExample.pageSize);
  console.log('  - 排序字段:', paginationExample.sortBy);
  console.log('  - 排序方向:', paginationExample.sortOrder);
  console.log('  - 筛选条件:', paginationExample.filters);
}

// 运行演示
if (import.meta.main) {
  console.log('🎯 阿里云数据库集成 - 数据库服务演示');
  console.log('=' .repeat(50));
  
  demonstrateConfigValidation();
  demonstrateDataModels();
  
  // 注意：实际的数据库操作演示需要真实的数据库连接
  console.log('\n⚠️  注意：实际数据库操作需要真实的数据库配置');
  console.log('如需测试完整功能，请：');
  console.log('1. 设置真实的数据库连接信息');
  console.log('2. 确保数据库服务器正在运行');
  console.log('3. 运行 demonstrateDatabaseService() 函数');
  
  // 如果你有真实的数据库配置，可以取消注释下面这行
  // await demonstrateDatabaseService();
}
#!/usr/bin/env tsx

/**
 * 数据清理脚本
 * 清空数据库中的所有图片数据和OSS中的图片文件
 * 
 * 使用方法：
 * cd backend
 * npm run cleanup:all
 */

import { databaseService } from '../services/databaseService.js';
import { AliOssService } from '../services/aliOssService.js';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// 加载环境变量
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: join(__dirname, '../../.env') });

interface CleanupStats {
  imagesDeleted: number;
  referenceImagesDeleted: number;
  canvasImagesDeleted: number;
  trashItemsDeleted: number;
  ossFilesDeleted: number;
  errors: string[];
}

class DataCleanup {
  private oss: AliOssService;
  private stats: CleanupStats;

  constructor() {
    this.oss = new AliOssService();
    this.stats = {
      imagesDeleted: 0,
      referenceImagesDeleted: 0,
      canvasImagesDeleted: 0,
      trashItemsDeleted: 0,
      ossFilesDeleted: 0,
      errors: []
    };
  }

  /**
   * 执行完整的数据清理
   */
  async cleanup(): Promise<void> {
    console.log('🧹 开始清理所有数据...\n');

    try {
      // 连接数据库
      await this.connectDatabase();

      // 初始化OSS服务
      if (!this.oss.initialize()) {
        console.warn('⚠️  OSS服务初始化失败，将跳过OSS文件清理');
      }

      // 1. 获取所有需要删除的OSS文件路径
      await this.collectOssFilePaths();

      // 2. 清理数据库表
      await this.cleanupDatabase();

      // 3. 清理OSS文件
      if (this.oss.isConfigured()) {
        await this.cleanupOssFiles();
      } else {
        console.log('☁️  跳过OSS文件清理（服务未配置）');
      }

      // 4. 显示清理结果
      this.showResults();

    } catch (error) {
      console.error('❌ 清理过程中发生错误:', error);
      this.stats.errors.push(`清理失败: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      // 断开数据库连接
      await databaseService.disconnect();
    }
  }

  /**
   * 连接数据库
   */
  private async connectDatabase(): Promise<void> {
    const dbHost = process.env.DB_HOST;
    const dbPort = process.env.DB_PORT;
    const dbDatabase = process.env.DB_DATABASE;
    const dbUsername = process.env.DB_USERNAME;
    const dbPassword = process.env.DB_PASSWORD;
    const dbSsl = process.env.DB_SSL;

    if (!dbHost || !dbDatabase || !dbUsername || !dbPassword) {
      throw new Error('数据库配置不完整，请检查 .env 文件');
    }

    const dbConfig = {
      host: dbHost,
      port: dbPort ? parseInt(dbPort) : 3306,
      database: dbDatabase,
      username: dbUsername,
      password: dbPassword,
      ssl: dbSsl === 'true'
    };

    const connected = await databaseService.connect(dbConfig);
    if (!connected) {
      throw new Error('数据库连接失败');
    }

    console.log('✅ 数据库连接成功');
  }

  /**
   * 收集所有需要删除的OSS文件路径
   */
  private async collectOssFilePaths(): Promise<string[]> {
    console.log('📋 收集OSS文件路径...');
    
    const filePaths: string[] = [];

    try {
      // 获取所有图片的OSS路径
      const images = await databaseService.executeQuery(`
        SELECT oss_url, thumbnail_url 
        FROM images 
        WHERE oss_url IS NOT NULL OR thumbnail_url IS NOT NULL
      `);

      for (const image of images) {
        if (image.oss_url) {
          const path = this.extractOssPath(image.oss_url);
          if (path) filePaths.push(path);
        }
        if (image.thumbnail_url) {
          const path = this.extractOssPath(image.thumbnail_url);
          if (path) filePaths.push(path);
        }
      }

      // 获取所有参考图片的OSS路径
      const refImages = await databaseService.executeQuery(`
        SELECT oss_url, thumbnail_url 
        FROM reference_images 
        WHERE oss_url IS NOT NULL OR thumbnail_url IS NOT NULL
      `);

      for (const refImage of refImages) {
        if (refImage.oss_url) {
          const path = this.extractOssPath(refImage.oss_url);
          if (path) filePaths.push(path);
        }
        if (refImage.thumbnail_url) {
          const path = this.extractOssPath(refImage.thumbnail_url);
          if (path) filePaths.push(path);
        }
      }

      console.log(`   找到 ${filePaths.length} 个OSS文件需要删除`);
      return [...new Set(filePaths)]; // 去重

    } catch (error) {
      console.error('   ❌ 收集OSS文件路径失败:', error);
      this.stats.errors.push(`收集OSS文件路径失败: ${error instanceof Error ? error.message : String(error)}`);
      return [];
    }
  }

  /**
   * 从完整URL中提取OSS文件路径
   */
  private extractOssPath(url: string): string | null {
    try {
      const urlObj = new URL(url);
      // 移除开头的斜杠
      return urlObj.pathname.substring(1);
    } catch {
      return null;
    }
  }

  /**
   * 清理数据库中的所有相关表
   */
  private async cleanupDatabase(): Promise<void> {
    console.log('🗄️  清理数据库表...');

    const tables = [
      { name: 'canvas_images', description: '画布图片' },
      { name: 'trash_items', description: '回收站项目' },
      { name: 'reference_images', description: '参考图片' },
      { name: 'images', description: '生成图片' }
    ];

    for (const table of tables) {
      try {
        const countResult = await databaseService.executeQuery(`SELECT COUNT(*) as count FROM ${table.name}`);
        const count = countResult[0]?.count || 0;

        if (count > 0) {
          await databaseService.executeQuery(`DELETE FROM ${table.name}`);
          console.log(`   ✅ 清理 ${table.description} 表: ${count} 条记录`);
          
          // 更新统计
          switch (table.name) {
            case 'images':
              this.stats.imagesDeleted = count;
              break;
            case 'reference_images':
              this.stats.referenceImagesDeleted = count;
              break;
            case 'canvas_images':
              this.stats.canvasImagesDeleted = count;
              break;
            case 'trash_items':
              this.stats.trashItemsDeleted = count;
              break;
          }
        } else {
          console.log(`   ℹ️  ${table.description} 表已为空`);
        }

      } catch (error) {
        console.error(`   ❌ 清理 ${table.description} 表失败:`, error);
        this.stats.errors.push(`清理${table.description}表失败: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }

  /**
   * 清理OSS中的所有图片文件
   */
  private async cleanupOssFiles(): Promise<void> {
    console.log('☁️  清理OSS文件...');

    try {
      // 获取OSS中所有文件
      const allFiles = await this.oss.listAllFiles();
      
      if (allFiles.length === 0) {
        console.log('   ℹ️  OSS存储桶中没有文件');
        return;
      }

      console.log(`   找到 ${allFiles.length} 个OSS文件`);

      // 批量删除文件
      const batchSize = 100; // OSS批量删除限制
      let deletedCount = 0;

      for (let i = 0; i < allFiles.length; i += batchSize) {
        const batch = allFiles.slice(i, i + batchSize);
        
        try {
          await this.oss.deleteMultipleFiles(batch);
          deletedCount += batch.length;
          console.log(`   ✅ 已删除 ${deletedCount}/${allFiles.length} 个文件`);
        } catch (error) {
          console.error(`   ❌ 批量删除文件失败:`, error);
          this.stats.errors.push(`批量删除OSS文件失败: ${error instanceof Error ? error.message : String(error)}`);
        }
      }

      this.stats.ossFilesDeleted = deletedCount;

    } catch (error) {
      console.error('   ❌ 清理OSS文件失败:', error);
      this.stats.errors.push(`清理OSS文件失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 显示清理结果
   */
  private showResults(): void {
    console.log('\n📊 清理结果统计:');
    console.log('=====================================');
    console.log(`🖼️  生成图片: ${this.stats.imagesDeleted} 条`);
    console.log(`📎 参考图片: ${this.stats.referenceImagesDeleted} 条`);
    console.log(`🎨 画布图片: ${this.stats.canvasImagesDeleted} 条`);
    console.log(`🗑️  回收站项目: ${this.stats.trashItemsDeleted} 条`);
    console.log(`☁️  OSS文件: ${this.stats.ossFilesDeleted} 个`);
    
    if (this.stats.errors.length > 0) {
      console.log('\n❌ 错误信息:');
      this.stats.errors.forEach((error, index) => {
        console.log(`   ${index + 1}. ${error}`);
      });
    } else {
      console.log('\n✅ 所有数据清理完成，系统已恢复到初始状态！');
    }
    
    console.log('=====================================\n');
  }
}

// 执行清理
async function main() {
  const cleanup = new DataCleanup();
  
  // 确认提示
  console.log('⚠️  警告: 此操作将删除所有图片数据和OSS文件，且不可恢复！');
  console.log('   包括：生成图片、参考图片、画布图片、回收站项目');
  console.log('   确认要继续吗？(输入 "yes" 确认)\n');

  // 在脚本环境中直接执行，跳过确认
  if (process.argv.includes('--force')) {
    await cleanup.cleanup();
  } else {
    // 需要用户确认
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    rl.question('请输入 "yes" 确认: ', async (answer: string) => {
      if (answer.toLowerCase() === 'yes') {
        await cleanup.cleanup();
      } else {
        console.log('❌ 操作已取消');
      }
      rl.close();
    });
  }
}

// 如果直接运行此脚本
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { DataCleanup };
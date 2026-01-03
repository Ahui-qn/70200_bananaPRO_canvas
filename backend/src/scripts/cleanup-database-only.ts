#!/usr/bin/env tsx

/**
 * 仅清理数据库脚本
 * 只清空数据库中的所有图片数据，不涉及OSS操作
 * 适用于OSS权限不足的情况
 * 
 * 使用方法：
 * cd backend
 * npm run cleanup:database
 */

import { databaseService } from '../services/databaseService.js';
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
  projectsDeleted: number;
  errors: string[];
}

class DatabaseCleanup {
  private stats: CleanupStats;

  constructor() {
    this.stats = {
      imagesDeleted: 0,
      referenceImagesDeleted: 0,
      projectsDeleted: 0,
      errors: []
    };
  }

  /**
   * 执行数据库清理
   */
  async cleanup(): Promise<void> {
    console.log('🧹 开始清理数据库数据...\n');

    try {
      // 连接数据库
      await this.connectDatabase();

      // 清理数据库表
      await this.cleanupDatabase();

      // 显示清理结果
      this.showResults();

    } catch (error) {
      console.error('❌ 清理过程中发生错误:', error);
      this.stats.errors.push(`清理失败: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      // 断开数据库连接
      await databaseService.disconnect();
      console.log('数据库连接已断开');
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
   * 清理数据库中的所有相关表
   */
  private async cleanupDatabase(): Promise<void> {
    console.log('🗄️  清理数据库表...');

    // 按照外键依赖顺序删除
    const tables = [
      { name: 'images', description: '生成图片', field: 'imagesDeleted' },
      { name: 'reference_images', description: '参考图片', field: 'referenceImagesDeleted' },
      { name: 'projects', description: '项目', field: 'projectsDeleted' }
    ];

    for (const table of tables) {
      try {
        // 先获取记录数量
        const countResult = await databaseService.executeQuery(`SELECT COUNT(*) as count FROM ${table.name}`);
        const count = countResult[0]?.count || 0;

        if (count > 0) {
          // 删除所有记录
          await databaseService.executeQuery(`DELETE FROM ${table.name}`);
          console.log(`   ✅ 清理 ${table.description} 表: ${count} 条记录`);
          
          // 更新统计
          (this.stats as any)[table.field] = count;
        } else {
          console.log(`   ℹ️  ${table.description} 表已为空`);
        }

      } catch (error) {
        console.error(`   ❌ 清理 ${table.description} 表失败:`, error);
        this.stats.errors.push(`清理${table.description}表失败: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    // 重置自增ID
    console.log('\n🔄 重置表自增ID...');
    const resetTables = ['images', 'reference_images', 'projects'];
    
    for (const tableName of resetTables) {
      try {
        await databaseService.executeQuery(`ALTER TABLE ${tableName} AUTO_INCREMENT = 1`);
        console.log(`   ✅ 重置 ${tableName} 表自增ID`);
      } catch (error) {
        console.warn(`   ⚠️  重置 ${tableName} 表自增ID失败:`, error);
      }
    }
  }

  /**
   * 显示清理结果
   */
  private showResults(): void {
    console.log('\n📊 数据库清理结果:');
    console.log('=====================================');
    console.log(`🖼️  生成图片: ${this.stats.imagesDeleted} 条`);
    console.log(`📎 参考图片: ${this.stats.referenceImagesDeleted} 条`);
    console.log(`📁 项目: ${this.stats.projectsDeleted} 条`);
    
    if (this.stats.errors.length > 0) {
      console.log('\n❌ 错误信息:');
      this.stats.errors.forEach((error, index) => {
        console.log(`   ${index + 1}. ${error}`);
      });
    } else {
      console.log('\n✅ 数据库清理完成！');
    }
    
    console.log('\n💡 注意：OSS中的图片文件未被删除');
    console.log('   如需删除OSS文件，请：');
    console.log('   1. 为RAM用户添加 oss:ListObjects 权限');
    console.log('   2. 或通过阿里云控制台手动删除');
    console.log('=====================================\n');
  }
}

// 执行清理
async function main() {
  const cleanup = new DatabaseCleanup();
  
  console.log('⚠️  警告: 此操作将删除数据库中的所有图片和项目数据！');
  console.log('   OSS中的图片文件不会被删除（需要手动处理）');
  console.log('   确认要继续吗？\n');

  // 检查是否有 --force 参数
  if (process.argv.includes('--force')) {
    console.log('🚀 使用 --force 参数，直接执行清理...\n');
    await cleanup.cleanup();
  } else {
    console.log('❌ 请使用 --force 参数确认执行');
    console.log('命令: npm run cleanup:database -- --force');
  }
}

// 如果直接运行此脚本
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { DatabaseCleanup };
#!/usr/bin/env tsx

/**
 * 清理孤儿OSS文件脚本
 * 删除OSS中存在但数据库中不存在的文件
 * 
 * 使用方法：
 * cd backend
 * npm run cleanup:oss-orphans
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
  totalOssFiles: number;
  validFiles: number;
  orphanedFiles: number;
  deletedFiles: number;
  errors: string[];
}

class OrphanedOssCleanup {
  private oss: AliOssService;
  private stats: CleanupStats;

  constructor() {
    this.oss = new AliOssService();
    this.stats = {
      totalOssFiles: 0,
      validFiles: 0,
      orphanedFiles: 0,
      deletedFiles: 0,
      errors: []
    };
  }

  /**
   * 执行孤儿文件清理
   */
  async cleanup(): Promise<void> {
    console.log('🧹 开始清理孤儿OSS文件...\n');

    try {
      // 连接数据库
      await this.connectDatabase();

      // 初始化OSS服务
      if (!this.oss.initialize()) {
        throw new Error('OSS服务初始化失败，请检查配置');
      }

      // 尝试获取所有OSS文件
      let allOssFiles: string[] = [];
      try {
        allOssFiles = await this.oss.listAllFiles();
        this.stats.totalOssFiles = allOssFiles.length;
        console.log(`📋 OSS中共有 ${allOssFiles.length} 个文件`);
      } catch (listError: any) {
        if (listError.message.includes('SignatureDoesNotMatch') || listError.code === 'SignatureDoesNotMatch') {
          console.log('❌ 无法列出OSS文件：没有列表权限 (oss:ListObjects)');
          console.log('💡 当前AccessKey只有上传和删除权限，无法自动清理孤儿文件');
          console.log('🔧 解决方案：');
          console.log('   1. 为RAM用户添加 oss:ListObjects 权限');
          console.log('   2. 或者通过阿里云控制台手动清理');
          console.log('   3. 或者使用主账号的AccessKey（不推荐）');
          console.log('\n📋 建议的RAM权限策略：');
          console.log(JSON.stringify({
            "Version": "1",
            "Statement": [
              {
                "Effect": "Allow",
                "Action": [
                  "oss:GetObject",
                  "oss:PutObject", 
                  "oss:DeleteObject",
                  "oss:ListObjects",
                  "oss:DeleteMultipleObjects"
                ],
                "Resource": [
                  "acs:oss:*:*:ahui70200/*"
                ]
              }
            ]
          }, null, 2));
          return;
        } else {
          throw listError;
        }
      }

      if (allOssFiles.length === 0) {
        console.log('✅ OSS中没有文件，无需清理');
        return;
      }

      // 获取数据库中所有有效的OSS key
      const validOssKeys = await this.getValidOssKeys();
      console.log(`📋 数据库中有 ${validOssKeys.size} 个有效文件引用`);

      // 找出孤儿文件
      const orphanedFiles = allOssFiles.filter(file => !validOssKeys.has(file));
      this.stats.orphanedFiles = orphanedFiles.length;
      this.stats.validFiles = allOssFiles.length - orphanedFiles.length;

      console.log(`\n📊 分析结果:`);
      console.log(`   有效文件: ${this.stats.validFiles} 个`);
      console.log(`   孤儿文件: ${this.stats.orphanedFiles} 个`);

      if (orphanedFiles.length === 0) {
        console.log('\n✅ 没有发现孤儿文件');
        return;
      }

      // 显示孤儿文件列表
      console.log(`\n🗑️  发现的孤儿文件:`);
      orphanedFiles.slice(0, 10).forEach((file, index) => {
        console.log(`   ${index + 1}. ${file}`);
      });
      if (orphanedFiles.length > 10) {
        console.log(`   ... 还有 ${orphanedFiles.length - 10} 个文件`);
      }

      // 确认删除
      console.log(`\n⚠️  警告: 即将删除 ${orphanedFiles.length} 个孤儿文件`);
      console.log('这些文件在数据库中没有对应记录，删除后无法恢复！');
      
      // 在脚本环境中直接执行
      if (process.argv.includes('--force')) {
        await this.deleteOrphanedFiles(orphanedFiles);
      } else {
        console.log('\n❌ 请使用 --force 参数确认删除');
        console.log('命令: npm run cleanup:oss-orphans -- --force');
      }

      // 显示清理结果
      this.showResults();

    } catch (error) {
      console.error('❌ 清理过程中发生错误:', error);
      this.stats.errors.push(`清理失败: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
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
   * 获取数据库中所有有效的OSS key
   */
  private async getValidOssKeys(): Promise<Set<string>> {
    const validKeys = new Set<string>();

    try {
      // 从images表获取OSS key
      const imagesSql = `
        SELECT oss_key, thumbnail_url 
        FROM images 
        WHERE oss_key IS NOT NULL OR thumbnail_url IS NOT NULL
      `;
      const imageRows = await databaseService.executeQuery(imagesSql);

      for (const row of imageRows as any[]) {
        if (row.oss_key) {
          validKeys.add(row.oss_key);
        }
        if (row.thumbnail_url) {
          const thumbnailKey = this.extractOssKeyFromUrl(row.thumbnail_url);
          if (thumbnailKey) {
            validKeys.add(thumbnailKey);
          }
        }
      }

      // 从reference_images表获取OSS key
      const refImagesSql = `
        SELECT oss_key, thumbnail_url 
        FROM reference_images 
        WHERE oss_key IS NOT NULL OR thumbnail_url IS NOT NULL
      `;
      const refImageRows = await databaseService.executeQuery(refImagesSql);

      for (const row of refImageRows as any[]) {
        if (row.oss_key) {
          validKeys.add(row.oss_key);
        }
        if (row.thumbnail_url) {
          const thumbnailKey = this.extractOssKeyFromUrl(row.thumbnail_url);
          if (thumbnailKey) {
            validKeys.add(thumbnailKey);
          }
        }
      }

    } catch (error) {
      console.error('获取有效OSS key失败:', error);
      this.stats.errors.push(`获取有效OSS key失败: ${error instanceof Error ? error.message : String(error)}`);
    }

    return validKeys;
  }

  /**
   * 删除孤儿文件
   */
  private async deleteOrphanedFiles(orphanedFiles: string[]): Promise<void> {
    console.log(`\n🗑️  开始删除 ${orphanedFiles.length} 个孤儿文件...`);

    const batchSize = 100; // 批量删除大小
    let deletedCount = 0;

    for (let i = 0; i < orphanedFiles.length; i += batchSize) {
      const batch = orphanedFiles.slice(i, i + batchSize);
      
      try {
        await this.oss.deleteMultipleFiles(batch);
        deletedCount += batch.length;
        console.log(`   ✅ 已删除 ${deletedCount}/${orphanedFiles.length} 个文件`);
      } catch (error) {
        console.error(`   ❌ 批量删除失败:`, error);
        this.stats.errors.push(`批量删除失败: ${error instanceof Error ? error.message : String(error)}`);
        
        // 尝试单个删除
        for (const file of batch) {
          try {
            const success = await this.oss.deleteObject(file);
            if (success) {
              deletedCount++;
            } else {
              this.stats.errors.push(`删除文件失败: ${file}`);
            }
          } catch (singleError) {
            this.stats.errors.push(`删除文件失败: ${file} - ${singleError instanceof Error ? singleError.message : String(singleError)}`);
          }
        }
      }
    }

    this.stats.deletedFiles = deletedCount;
  }

  /**
   * 从URL中提取OSS key
   */
  private extractOssKeyFromUrl(url: string): string | null {
    try {
      const urlObj = new URL(url);
      return urlObj.pathname.substring(1);
    } catch {
      return null;
    }
  }

  /**
   * 显示清理结果
   */
  private showResults(): void {
    console.log('\n📊 清理结果统计:');
    console.log('=====================================');
    console.log(`📁 OSS总文件数: ${this.stats.totalOssFiles}`);
    console.log(`✅ 有效文件: ${this.stats.validFiles}`);
    console.log(`🗑️  孤儿文件: ${this.stats.orphanedFiles}`);
    console.log(`🧹 已删除: ${this.stats.deletedFiles}`);
    
    if (this.stats.errors.length > 0) {
      console.log('\n❌ 错误信息:');
      this.stats.errors.forEach((error, index) => {
        console.log(`   ${index + 1}. ${error}`);
      });
    } else if (this.stats.deletedFiles > 0) {
      console.log('\n✅ 孤儿文件清理完成！');
    }
    
    console.log('=====================================\n');
  }
}

// 执行清理
async function main() {
  const cleanup = new OrphanedOssCleanup();
  await cleanup.cleanup();
}

// 如果直接运行此脚本
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { OrphanedOssCleanup };
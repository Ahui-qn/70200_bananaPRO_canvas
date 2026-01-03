#!/usr/bin/env node
/**
 * 批量更新历史图片尺寸脚本
 * 
 * 用法：
 *   npm run update:dimensions          # 更新所有缺少尺寸的图片
 *   npm run update:dimensions -- --limit=100  # 限制处理数量
 *   npm run update:dimensions -- --dry-run    # 仅预览，不实际更新
 * 
 * 需求: 2.2
 */

import dotenv from 'dotenv';
import { databaseService } from '../services/databaseService.js';
import { imageDimensionService } from '../services/imageDimensionService.js';
import { aliOssService } from '../services/aliOssService.js';

// 加载环境变量
dotenv.config();

// 处理结果统计
interface ProcessingStats {
  total: number;       // 总数
  processed: number;   // 已处理
  success: number;     // 成功
  failed: number;      // 失败
  skipped: number;     // 跳过
}

/**
 * 解析命令行参数
 */
function parseArgs(): Record<string, string> {
  const args: Record<string, string> = {};
  
  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith('--')) {
      const [key, ...valueParts] = arg.substring(2).split('=');
      args[key] = valueParts.join('=') || 'true';
    }
  }
  
  return args;
}

/**
 * 连接数据库
 */
async function connectDatabase(): Promise<boolean> {
  const dbHost = process.env.DB_HOST;
  const dbPort = process.env.DB_PORT;
  const dbDatabase = process.env.DB_DATABASE;
  const dbUsername = process.env.DB_USERNAME;
  const dbPassword = process.env.DB_PASSWORD;
  const dbSsl = process.env.DB_SSL;

  if (!dbHost || !dbDatabase || !dbUsername || !dbPassword) {
    console.error('❌ 数据库配置不完整，请检查 .env 文件');
    return false;
  }

  try {
    const dbConfig = {
      host: dbHost,
      port: parseInt(dbPort || '3306', 10),
      database: dbDatabase,
      username: dbUsername,
      password: dbPassword,
      ssl: dbSsl === 'true',
      enabled: true
    };

    const connected = await databaseService.connect(dbConfig);
    return connected;
  } catch (error: any) {
    console.error('❌ 数据库连接失败:', error.message);
    return false;
  }
}


/**
 * 初始化 OSS 服务
 */
async function initOssService(): Promise<boolean> {
  try {
    const initialized = aliOssService.initialize();
    return initialized;
  } catch (error: any) {
    console.warn('⚠️ OSS 初始化失败:', error.message);
    return false;
  }
}

/**
 * 查询缺少尺寸数据的图片
 */
async function getImagesWithoutDimensions(limit?: number): Promise<any[]> {
  const connection = databaseService.getConnection();
  if (!connection) {
    throw new Error('数据库未连接');
  }

  let sql = `
    SELECT id, url, oss_key, thumbnail_url, width, height
    FROM images
    WHERE (width IS NULL OR height IS NULL)
      AND url IS NOT NULL
      AND url != ''
      AND is_deleted = 0
    ORDER BY created_at DESC
  `;

  if (limit && limit > 0) {
    sql += ` LIMIT ${limit}`;
  }

  const [rows] = await connection.execute(sql);
  return rows as any[];
}

/**
 * 更新图片尺寸和缩略图
 */
async function updateImageDimensions(
  imageId: string,
  width: number,
  height: number,
  thumbnailUrl?: string
): Promise<void> {
  const connection = databaseService.getConnection();
  if (!connection) {
    throw new Error('数据库未连接');
  }

  let sql: string;
  let params: any[];

  if (thumbnailUrl) {
    sql = `
      UPDATE images
      SET width = ?, height = ?, thumbnail_url = ?, updated_at = NOW()
      WHERE id = ?
    `;
    params = [width, height, thumbnailUrl, imageId];
  } else {
    sql = `
      UPDATE images
      SET width = ?, height = ?, updated_at = NOW()
      WHERE id = ?
    `;
    params = [width, height, imageId];
  }

  await connection.execute(sql, params);
}

/**
 * 处理单张图片
 */
async function processImage(
  image: any,
  ossEnabled: boolean,
  dryRun: boolean
): Promise<{ success: boolean; error?: string }> {
  const { id, url, oss_key } = image;

  try {
    console.log(`  处理图片: ${id}`);
    console.log(`    URL: ${url.substring(0, 80)}...`);

    // 下载图片并获取尺寸
    const result = await imageDimensionService.processImageFromUrl(url);
    const { dimensions, thumbnail } = result;

    console.log(`    尺寸: ${dimensions.width} x ${dimensions.height}`);
    console.log(`    缩略图: ${thumbnail.width} x ${thumbnail.height}`);

    if (dryRun) {
      console.log(`    [预览模式] 将更新尺寸为 ${dimensions.width} x ${dimensions.height}`);
      return { success: true };
    }

    // 上传缩略图到 OSS
    let thumbnailUrl: string | undefined;
    if (ossEnabled && oss_key) {
      try {
        const uploadResult = await aliOssService.uploadThumbnail(thumbnail.buffer, oss_key);
        thumbnailUrl = uploadResult.url;
        console.log(`    缩略图已上传: ${thumbnailUrl.substring(0, 60)}...`);
      } catch (ossError: any) {
        console.warn(`    ⚠️ 缩略图上传失败: ${ossError.message}`);
      }
    }

    // 更新数据库
    await updateImageDimensions(id, dimensions.width, dimensions.height, thumbnailUrl);
    console.log(`    ✅ 更新成功`);

    return { success: true };
  } catch (error: any) {
    console.error(`    ❌ 处理失败: ${error.message}`);
    return { success: false, error: error.message };
  }
}


/**
 * 显示帮助信息
 */
function showHelp(): void {
  console.log(`
批量更新历史图片尺寸脚本

用法:
  npm run update:dimensions              # 更新所有缺少尺寸的图片
  npm run update:dimensions -- --limit=100   # 限制处理数量
  npm run update:dimensions -- --dry-run     # 仅预览，不实际更新

参数:
  --limit=N     限制处理的图片数量（默认处理所有）
  --dry-run     预览模式，不实际更新数据库
  --help        显示帮助信息

说明:
  此脚本会查询数据库中所有缺少 width 或 height 字段的图片，
  下载图片并提取实际尺寸，同时生成缩略图并上传到 OSS。

注意:
  - 确保 .env 文件中配置了正确的数据库连接信息
  - 如果需要上传缩略图，请确保配置了 OSS 信息
  - 建议先使用 --dry-run 预览，确认无误后再执行
`);
}

/**
 * 主函数
 */
async function main(): Promise<void> {
  const args = parseArgs();

  // 显示帮助
  if (args.help || args.h) {
    showHelp();
    process.exit(0);
  }

  const limit = args.limit ? parseInt(args.limit, 10) : undefined;
  const dryRun = args['dry-run'] === 'true';

  console.log('═'.repeat(60));
  console.log('批量更新历史图片尺寸');
  console.log('═'.repeat(60));
  
  if (dryRun) {
    console.log('⚠️  预览模式：不会实际更新数据库\n');
  }

  // 连接数据库
  console.log('正在连接数据库...');
  const dbConnected = await connectDatabase();
  if (!dbConnected) {
    process.exit(1);
  }
  console.log('✅ 数据库连接成功\n');

  // 初始化 OSS
  console.log('正在初始化 OSS 服务...');
  const ossEnabled = await initOssService();
  if (ossEnabled) {
    console.log('✅ OSS 服务初始化成功\n');
  } else {
    console.log('⚠️ OSS 服务未启用，将跳过缩略图上传\n');
  }

  // 统计信息
  const stats: ProcessingStats = {
    total: 0,
    processed: 0,
    success: 0,
    failed: 0,
    skipped: 0,
  };

  try {
    // 查询需要处理的图片
    console.log('正在查询缺少尺寸数据的图片...');
    const images = await getImagesWithoutDimensions(limit);
    stats.total = images.length;

    if (images.length === 0) {
      console.log('✅ 没有需要处理的图片\n');
      return;
    }

    console.log(`找到 ${images.length} 张需要处理的图片\n`);
    console.log('─'.repeat(60));

    // 处理每张图片
    for (let i = 0; i < images.length; i++) {
      const image = images[i];
      console.log(`\n[${i + 1}/${images.length}]`);

      const result = await processImage(image, ossEnabled, dryRun);
      stats.processed++;

      if (result.success) {
        stats.success++;
      } else {
        stats.failed++;
      }

      // 添加延迟，避免请求过快
      if (i < images.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    // 显示统计信息
    console.log('\n' + '═'.repeat(60));
    console.log('处理完成');
    console.log('═'.repeat(60));
    console.log(`总数:     ${stats.total}`);
    console.log(`已处理:   ${stats.processed}`);
    console.log(`成功:     ${stats.success}`);
    console.log(`失败:     ${stats.failed}`);
    console.log(`跳过:     ${stats.skipped}`);
    console.log('═'.repeat(60));

    if (dryRun) {
      console.log('\n⚠️  这是预览模式，数据库未被修改');
      console.log('   移除 --dry-run 参数以执行实际更新');
    }

  } catch (error: any) {
    console.error('\n❌ 执行失败:', error.message);
    process.exit(1);
  } finally {
    // 断开数据库连接
    await databaseService.disconnect();
  }
}

// 运行主函数
main().catch(error => {
  console.error('❌ 程序执行失败:', error);
  process.exit(1);
});

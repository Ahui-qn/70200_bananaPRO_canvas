#!/usr/bin/env tsx

/**
 * 检查数据库状态脚本
 * 查看各个表的记录数量
 */

import { databaseService } from '../services/databaseService.js';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// 加载环境变量
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: join(__dirname, '../../.env') });

async function checkDatabaseStatus() {
  console.log('📊 检查数据库状态...\n');

  try {
    // 连接数据库
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

    console.log('✅ 数据库连接成功\n');

    // 检查各个表的记录数量
    const tables = [
      { name: 'users', description: '用户' },
      { name: 'projects', description: '项目' },
      { name: 'images', description: '生成图片' },
      { name: 'reference_images', description: '参考图片' },
      { name: 'canvas_images', description: '画布图片' },
      { name: 'trash_items', description: '回收站项目' },
      { name: 'user_configs', description: '用户配置' },
      { name: 'operation_logs', description: '操作日志' }
    ];

    console.log('📋 表记录统计:');
    console.log('=====================================');

    for (const table of tables) {
      try {
        const countResult = await databaseService.executeQuery(`SELECT COUNT(*) as count FROM ${table.name}`);
        const count = countResult[0]?.count || 0;
        console.log(`${table.description.padEnd(8)} (${table.name}): ${count} 条记录`);
      } catch (error: any) {
        if (error.code === 'ER_NO_SUCH_TABLE') {
          console.log(`${table.description.padEnd(8)} (${table.name}): 表不存在`);
        } else {
          console.log(`${table.description.padEnd(8)} (${table.name}): 查询失败 - ${error.message}`);
        }
      }
    }

    console.log('=====================================\n');

  } catch (error) {
    console.error('❌ 检查失败:', error);
  } finally {
    await databaseService.disconnect();
  }
}

// 执行检查
checkDatabaseStatus().catch(console.error);
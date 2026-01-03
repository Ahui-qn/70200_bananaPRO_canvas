#!/usr/bin/env tsx

/**
 * 检查用户角色脚本
 */

import { databaseService } from '../services/databaseService.js';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// 加载环境变量
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: join(__dirname, '../../.env') });

async function checkUserRole(): Promise<void> {
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

    console.log('✅ 数据库连接成功');

    // 查询用户信息
    const users = await databaseService.executeQuery(
      "SELECT id, username, display_name, role FROM users WHERE username = 'admin'"
    );

    console.log('用户信息:', users);

    // 更新用户角色
    console.log('正在更新用户角色...');
    const result = await databaseService.executeQuery(
      "UPDATE users SET role = 'admin' WHERE username = 'admin'"
    );
    console.log('更新结果:', result);

    // 再次查询确认
    const updatedUsers = await databaseService.executeQuery(
      "SELECT id, username, display_name, role FROM users WHERE username = 'admin'"
    );
    console.log('更新后的用户信息:', updatedUsers);

  } catch (error) {
    console.error('❌ 检查失败:', error);
  } finally {
    await databaseService.disconnect();
  }
}

checkUserRole().catch(console.error);
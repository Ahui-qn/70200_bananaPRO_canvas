/**
 * 数据库迁移脚本：添加图片状态字段
 * 
 * 为 images 表添加 status 和 failure_reason 字段
 * 用于记录图片生成状态（成功/失败）
 */

import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 加载 backend/.env 文件
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

async function addImageStatusField() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '3306'),
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
  });

  try {
    console.log('开始添加图片状态字段...');

    // 检查 status 字段是否已存在
    const [columns] = await connection.execute(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'images' AND COLUMN_NAME = 'status'
    `, [process.env.DB_DATABASE]);

    if ((columns as any[]).length === 0) {
      // 添加 status 字段
      await connection.execute(`
        ALTER TABLE images 
        ADD COLUMN status ENUM('pending', 'success', 'failed') DEFAULT 'success' 
        COMMENT '图片生成状态'
      `);
      console.log('✓ 已添加 status 字段');
    } else {
      console.log('- status 字段已存在，跳过');
    }

    // 检查 failure_reason 字段是否已存在
    const [failureColumns] = await connection.execute(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'images' AND COLUMN_NAME = 'failure_reason'
    `, [process.env.DB_DATABASE]);

    if ((failureColumns as any[]).length === 0) {
      // 添加 failure_reason 字段
      await connection.execute(`
        ALTER TABLE images 
        ADD COLUMN failure_reason TEXT 
        COMMENT '失败原因（status为failed时）'
      `);
      console.log('✓ 已添加 failure_reason 字段');
    } else {
      console.log('- failure_reason 字段已存在，跳过');
    }

    // 添加索引
    try {
      await connection.execute(`
        CREATE INDEX idx_status ON images(status)
      `);
      console.log('✓ 已添加 status 索引');
    } catch (e: any) {
      if (e.code === 'ER_DUP_KEYNAME') {
        console.log('- status 索引已存在，跳过');
      } else {
        throw e;
      }
    }

    // 修改 url 字段允许为空（失败时没有 URL）
    await connection.execute(`
      ALTER TABLE images MODIFY COLUMN url TEXT COMMENT '图片访问URL（失败时可为空）'
    `);
    console.log('✓ 已修改 url 字段允许为空');

    console.log('\n迁移完成！');

  } catch (error) {
    console.error('迁移失败:', error);
    throw error;
  } finally {
    await connection.end();
  }
}

addImageStatusField().catch(console.error);

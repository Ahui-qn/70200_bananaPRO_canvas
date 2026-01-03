#!/usr/bin/env node
/**
 * 测试 canvas-images API 是否正确返回 width 和 height
 */

import dotenv from 'dotenv';
import mysql from 'mysql2/promise';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 加载 backend 目录下的 .env 文件
dotenv.config({ path: path.join(__dirname, '../../.env') });

async function testApi() {
  // 首先获取一个项目 ID
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '3306'),
    database: process.env.DB_DATABASE,
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined
  });

  // 获取用户列表
  const [users] = await connection.execute('SELECT id, username, display_name FROM users LIMIT 5');
  console.log('用户列表:');
  for (const user of users as any[]) {
    console.log(`  - ${user.username} (${user.display_name})`);
  }

  // 获取第一个项目
  const [projects] = await connection.execute(
    'SELECT id, name FROM projects WHERE is_deleted = 0 LIMIT 1'
  );
  
  if ((projects as any[]).length === 0) {
    console.log('没有找到项目');
    await connection.end();
    return;
  }
  
  const projectId = (projects as any[])[0].id;
  console.log(`\n测试项目: ${(projects as any[])[0].name} (${projectId})`);
  
  // 直接查询数据库中的图片数据
  const [images] = await connection.execute(`
    SELECT 
      id, url, thumbnail_url, prompt, model, 
      canvas_x, canvas_y, aspect_ratio, image_size, 
      width, height, created_at
    FROM images
    WHERE project_id = ? AND (is_deleted = FALSE OR is_deleted IS NULL)
    ORDER BY created_at DESC
    LIMIT 5
  `, [projectId]);
  
  console.log('\n数据库中的图片数据:');
  console.log('='.repeat(80));
  
  for (const img of images as any[]) {
    console.log(`ID: ${img.id}`);
    console.log(`  URL: ${img.url?.substring(0, 60)}...`);
    console.log(`  缩略图: ${img.thumbnail_url || '无'}`);
    console.log(`  尺寸: width=${img.width}, height=${img.height}`);
    console.log(`  画布位置: canvas_x=${img.canvas_x}, canvas_y=${img.canvas_y}`);
    console.log(`  比例: ${img.aspect_ratio}`);
    console.log('-'.repeat(80));
  }
  
  await connection.end();
  
  console.log('\n✅ 数据库查询完成');
  console.log('\n请在浏览器中刷新页面，检查画布图片是否正确显示尺寸');
}

testApi().catch(console.error);

#!/usr/bin/env node
/**
 * 检查数据库中图片的尺寸信息
 */

import dotenv from 'dotenv';
import mysql from 'mysql2/promise';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 加载 backend 目录下的 .env 文件
dotenv.config({ path: path.join(__dirname, '../../.env') });

async function checkImages() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '3306'),
    database: process.env.DB_DATABASE,
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined
  });

  // 查询图片的尺寸信息
  const [rows] = await connection.execute(
    'SELECT id, url, width, height, thumbnail_url, aspect_ratio, image_size FROM images WHERE is_deleted = 0 ORDER BY created_at DESC LIMIT 10'
  );
  
  console.log('数据库中的图片尺寸信息:');
  console.log('='.repeat(80));
  
  for (const row of rows as any[]) {
    console.log(`ID: ${row.id}`);
    console.log(`  URL: ${row.url?.substring(0, 60)}...`);
    console.log(`  尺寸: width=${row.width}, height=${row.height}`);
    console.log(`  缩略图: ${row.thumbnail_url ? row.thumbnail_url.substring(0, 60) + '...' : '无'}`);
    console.log(`  比例: ${row.aspect_ratio}, 大小: ${row.image_size}`);
    console.log('-'.repeat(80));
  }
  
  // 统计有尺寸和无尺寸的图片数量
  const [stats] = await connection.execute(`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN width IS NOT NULL AND height IS NOT NULL THEN 1 ELSE 0 END) as with_dimensions,
      SUM(CASE WHEN width IS NULL OR height IS NULL THEN 1 ELSE 0 END) as without_dimensions
    FROM images 
    WHERE is_deleted = 0
  `);
  
  console.log('\n统计信息:');
  const stat = (stats as any[])[0];
  console.log(`  总图片数: ${stat.total}`);
  console.log(`  有尺寸数据: ${stat.with_dimensions}`);
  console.log(`  无尺寸数据: ${stat.without_dimensions}`);
  
  await connection.end();
}

checkImages().catch(console.error);

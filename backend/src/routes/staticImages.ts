/**
 * 静态图片文件服务路由
 * 提供本地存储图片的访问 API
 * 包含目录穿越防护、缓存头设置、MIME 类型处理
 */

import express from 'express';
import path from 'path';
import fs from 'fs/promises';
import { createReadStream, existsSync } from 'fs';

const router = express.Router();

// 支持的图片 MIME 类型映射
const MIME_TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif'
};

/**
 * 验证请求路径是否安全（防止目录穿越攻击）
 * @param basePath 基础路径
 * @param requestedPath 请求的相对路径
 * @returns 安全的完整路径，如果路径不安全则返回 null
 */
function validatePath(basePath: string, requestedPath: string): string | null {
  // 检查是否包含明显的目录穿越字符
  if (requestedPath.includes('..') || requestedPath.includes('\0')) {
    return null;
  }
  
  // 解析完整路径
  const fullPath = path.resolve(basePath, requestedPath);
  const resolvedBasePath = path.resolve(basePath);
  
  // 确保解析后的路径仍在基础路径下
  if (!fullPath.startsWith(resolvedBasePath + path.sep) && fullPath !== resolvedBasePath) {
    return null;
  }
  
  return fullPath;
}

/**
 * 获取文件的 MIME 类型
 * @param filePath 文件路径
 * @returns MIME 类型字符串
 */
function getMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  return MIME_TYPES[ext] || 'application/octet-stream';
}

/**
 * GET /api/static-images/*
 * 返回本地存储的图片文件
 * 
 * 安全措施：
 * - 目录穿越防护
 * - 只允许访问图片文件
 * 
 * 性能优化：
 * - 设置强缓存头（1年）
 * - 使用流式传输
 */
router.get('/*', async (req, res) => {
  try {
    // 获取基础存储路径
    const basePath = process.env.LOCAL_STORAGE_PATH;
    
    if (!basePath) {
      console.error('LOCAL_STORAGE_PATH 未配置');
      return res.status(500).json({ 
        success: false, 
        error: '服务器配置错误：存储路径未配置' 
      });
    }
    
    // 获取请求的文件路径
    const requestedPath = (req.params as Record<string, string>)[0];
    
    if (!requestedPath) {
      return res.status(400).json({ 
        success: false, 
        error: '请求路径不能为空' 
      });
    }
    
    // 验证路径安全性（防止目录穿越攻击）
    const fullPath = validatePath(basePath, requestedPath);
    
    if (!fullPath) {
      console.warn(`目录穿越攻击尝试: ${requestedPath}`);
      return res.status(403).json({ 
        success: false, 
        error: '禁止访问：路径不合法' 
      });
    }
    
    // 检查文件是否存在
    if (!existsSync(fullPath)) {
      return res.status(404).json({ 
        success: false, 
        error: '文件不存在' 
      });
    }
    
    // 获取文件信息
    const stat = await fs.stat(fullPath);
    
    // 确保是文件而不是目录
    if (!stat.isFile()) {
      return res.status(400).json({ 
        success: false, 
        error: '请求的路径不是文件' 
      });
    }
    
    // 获取 MIME 类型
    const mimeType = getMimeType(fullPath);
    
    // 检查是否是支持的图片类型
    if (!mimeType.startsWith('image/')) {
      return res.status(400).json({ 
        success: false, 
        error: '不支持的文件类型' 
      });
    }
    
    // 设置响应头
    res.set({
      'Content-Type': mimeType,
      'Content-Length': stat.size,
      // 强缓存：1年，不可变（图片内容不会改变）
      'Cache-Control': 'public, max-age=31536000, immutable',
      // ETag 用于缓存验证
      'ETag': `"${stat.mtime.getTime().toString(16)}-${stat.size.toString(16)}"`,
      // 最后修改时间
      'Last-Modified': stat.mtime.toUTCString(),
      // CORS 相关头 - 允许跨域访问图片资源
      'Access-Control-Allow-Origin': '*',
      'Cross-Origin-Resource-Policy': 'cross-origin'
    });
    
    // 使用流式传输发送文件
    const stream = createReadStream(fullPath);
    stream.pipe(res);
    
    // 处理流错误
    stream.on('error', (error) => {
      console.error('文件流读取错误:', error);
      if (!res.headersSent) {
        res.status(500).json({ 
          success: false, 
          error: '文件读取失败' 
        });
      }
    });
    
  } catch (error: any) {
    console.error('静态图片服务错误:', error);
    
    if (!res.headersSent) {
      res.status(500).json({ 
        success: false, 
        error: '服务器内部错误' 
      });
    }
  }
});

export default router;
export { validatePath, getMimeType };

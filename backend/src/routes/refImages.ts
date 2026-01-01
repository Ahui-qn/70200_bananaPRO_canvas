/**
 * 参考图片路由
 * 处理参考图片的上传、去重和管理
 */

import express from 'express';
import { ApiResponse } from '@shared/types';
import { referenceImageService, RefImageUploadResult } from '../services/referenceImageService.js';

const router = express.Router();

/**
 * 上传参考图片（支持去重）
 * POST /api/ref-images/upload
 * Body: { images: string[] } - Base64 编码的图片数组
 */
router.post('/upload', async (req, res) => {
  try {
    const { images } = req.body;
    
    if (!images || !Array.isArray(images) || images.length === 0) {
      const response: ApiResponse = {
        success: false,
        error: '请提供要上传的图片（Base64 格式）'
      };
      return res.status(400).json(response);
    }

    // 限制单次上传数量
    if (images.length > 10) {
      const response: ApiResponse = {
        success: false,
        error: '单次最多上传 10 张参考图片'
      };
      return res.status(400).json(response);
    }

    console.log(`开始上传 ${images.length} 张参考图片...`);
    
    const results = await referenceImageService.uploadRefImages(images);
    
    // 统计新上传和复用的数量
    const newCount = results.filter(r => r.isNew).length;
    const reusedCount = results.filter(r => !r.isNew).length;
    
    console.log(`参考图片上传完成: 新上传 ${newCount} 张，复用 ${reusedCount} 张`);

    const response: ApiResponse<{
      results: RefImageUploadResult[];
      summary: { total: number; new: number; reused: number };
    }> = {
      success: true,
      data: {
        results,
        summary: {
          total: results.length,
          new: newCount,
          reused: reusedCount
        }
      },
      message: `上传成功: 新上传 ${newCount} 张，复用 ${reusedCount} 张`
    };

    res.json(response);
  } catch (error: any) {
    console.error('上传参考图片失败:', error);
    const response: ApiResponse = {
      success: false,
      error: error.message || '上传参考图片失败'
    };
    res.status(500).json(response);
  }
});

/**
 * 获取参考图片统计信息
 * GET /api/ref-images/stats
 */
router.get('/stats', async (req, res) => {
  try {
    const stats = await referenceImageService.getStatistics();
    
    const response: ApiResponse = {
      success: true,
      data: {
        ...stats,
        // 计算节省的存储空间（格式化）
        savedSizeFormatted: formatBytes(stats.savedSize)
      }
    };

    res.json(response);
  } catch (error: any) {
    console.error('获取参考图片统计失败:', error);
    const response: ApiResponse = {
      success: false,
      error: error.message || '获取统计信息失败'
    };
    res.status(500).json(response);
  }
});

/**
 * 根据 ID 获取参考图片信息
 * GET /api/ref-images/:id
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const refImage = await referenceImageService.getById(id);
    
    if (!refImage) {
      const response: ApiResponse = {
        success: false,
        error: '参考图片不存在'
      };
      return res.status(404).json(response);
    }

    const response: ApiResponse = {
      success: true,
      data: refImage
    };

    res.json(response);
  } catch (error: any) {
    console.error('获取参考图片失败:', error);
    const response: ApiResponse = {
      success: false,
      error: error.message || '获取参考图片失败'
    };
    res.status(500).json(response);
  }
});

/**
 * 清理未使用的参考图片
 * POST /api/ref-images/cleanup
 * Body: { daysOld?: number } - 清理多少天前未使用的图片，默认 30 天
 */
router.post('/cleanup', async (req, res) => {
  try {
    const { daysOld = 30 } = req.body;
    
    const deletedCount = await referenceImageService.cleanupUnused(daysOld);

    const response: ApiResponse = {
      success: true,
      data: { deletedCount },
      message: `清理了 ${deletedCount} 张未使用的参考图片`
    };

    res.json(response);
  } catch (error: any) {
    console.error('清理参考图片失败:', error);
    const response: ApiResponse = {
      success: false,
      error: error.message || '清理参考图片失败'
    };
    res.status(500).json(response);
  }
});

/**
 * 格式化字节数
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export default router;

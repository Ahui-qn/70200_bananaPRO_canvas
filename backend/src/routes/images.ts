import express from 'express';
import { ApiResponse, PaginatedResponse, SavedImage, GetImagesRequest, CreateImageRequest, UpdateImageRequest } from '@shared/types';
import { databaseManager } from '../services/databaseManager.js';
import { trashService } from '../services/trashService.js';

const router = express.Router();

// 获取图片列表
router.get('/', async (req, res) => {
  try {
    const query: GetImagesRequest = {
      page: parseInt(req.query.page as string) || 1,
      pageSize: parseInt(req.query.pageSize as string) || 20,
      sortBy: req.query.sortBy as string || 'created_at',
      sortOrder: (req.query.sortOrder as 'ASC' | 'DESC') || 'DESC',
      filters: {
        model: req.query.model as string,
        favorite: req.query.favorite === 'true' ? true : req.query.favorite === 'false' ? false : undefined,
        dateFrom: req.query.dateFrom as string,
        dateTo: req.query.dateTo as string,
        search: req.query.search as string,
        projectId: req.query.projectId as string,  // 支持按项目 ID 筛选（需求 4.3, 5.2）
      }
    };

    const result = await databaseManager.getImages({
      page: query.page!,
      pageSize: query.pageSize!,
      sortBy: query.sortBy!,
      sortOrder: query.sortOrder!,
      filters: query.filters || {}
    });

    const response: ApiResponse<PaginatedResponse<SavedImage>> = {
      success: true,
      data: result
    };

    res.json(response);
  } catch (error: any) {
    console.error('获取图片列表失败:', error);
    const response: ApiResponse = {
      success: false,
      error: error.message || '获取图片列表失败'
    };
    res.status(500).json(response);
  }
});

// 获取单个图片
router.get('/:id', async (req, res) => {
  try {
    const image = await databaseManager.getImageById(req.params.id);
    
    if (!image) {
      const response: ApiResponse = {
        success: false,
        error: '图片不存在'
      };
      return res.status(404).json(response);
    }

    const response: ApiResponse<SavedImage> = {
      success: true,
      data: image
    };

    res.json(response);
  } catch (error: any) {
    console.error('获取图片失败:', error);
    const response: ApiResponse = {
      success: false,
      error: error.message || '获取图片失败'
    };
    res.status(500).json(response);
  }
});

// 创建新图片
router.post('/', async (req, res) => {
  try {
    const imageData: CreateImageRequest = req.body;
    
    // 验证必填字段
    if (!imageData.prompt || !imageData.model) {
      const response: ApiResponse = {
        success: false,
        error: '缺少必填字段：prompt 和 model'
      };
      return res.status(400).json(response);
    }

    // 创建图片记录
    const savedImage: SavedImage = {
      id: `img_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      url: '', // 将由 AI 生成后更新
      prompt: imageData.prompt,
      model: imageData.model,
      aspectRatio: imageData.aspectRatio || 'auto',
      imageSize: imageData.imageSize || '1K',
      // refImages 在创建时不需要存储完整的 UploadedImage 对象
      // 实际的参考图数据会在生成时处理
      refImages: undefined,
      createdAt: new Date(),
      favorite: false,
      ossUploaded: false
    };

    const result = await databaseManager.saveImage(savedImage);

    const response: ApiResponse<SavedImage> = {
      success: true,
      data: result,
      message: '图片记录创建成功'
    };

    res.status(201).json(response);
  } catch (error: any) {
    console.error('创建图片失败:', error);
    const response: ApiResponse = {
      success: false,
      error: error.message || '创建图片失败'
    };
    res.status(500).json(response);
  }
});

// 更新图片信息
router.put('/:id', async (req, res) => {
  try {
    const updateData: UpdateImageRequest = req.body;
    
    const result = await databaseManager.updateImage(req.params.id, updateData);

    const response: ApiResponse<SavedImage> = {
      success: true,
      data: result,
      message: '图片信息更新成功'
    };

    res.json(response);
  } catch (error: any) {
    console.error('更新图片失败:', error);
    const response: ApiResponse = {
      success: false,
      error: error.message || '更新图片失败'
    };
    res.status(500).json(response);
  }
});

// 删除图片（软删除，移入回收站）
// 需求 7.2: 用户删除图片时系统将图片标记为已删除（软删除）并移入回收站
router.delete('/:id', async (req, res) => {
  try {
    // 获取当前用户 ID（从认证中间件获取）
    const deletedBy = (req as any).user?.userId || 'unknown';
    
    // 先检查图片是否存在
    const image = await databaseManager.getImageById(req.params.id);
    
    if (!image) {
      const response: ApiResponse = {
        success: false,
        error: '图片不存在'
      };
      return res.status(404).json(response);
    }

    // 执行软删除（不删除 OSS 文件，保留以便恢复）
    await trashService.softDeleteImage(req.params.id, deletedBy);

    const response: ApiResponse = {
      success: true,
      message: '图片已移入回收站'
    };

    res.json(response);
  } catch (error: any) {
    console.error('删除图片失败:', error);
    const response: ApiResponse = {
      success: false,
      error: error.message || '删除图片失败'
    };
    res.status(500).json(response);
  }
});

// 批量删除图片（软删除，移入回收站）
// 需求 7.2: 用户删除图片时系统将图片标记为已删除（软删除）并移入回收站
router.delete('/', async (req, res) => {
  try {
    const { ids } = req.body;
    
    if (!Array.isArray(ids) || ids.length === 0) {
      const response: ApiResponse = {
        success: false,
        error: '请提供要删除的图片ID列表'
      };
      return res.status(400).json(response);
    }

    // 获取当前用户 ID（从认证中间件获取）
    const deletedBy = (req as any).user?.userId || 'unknown';

    let successCount = 0;
    let failedCount = 0;
    const failedIds: string[] = [];

    // 批量软删除
    for (const id of ids) {
      try {
        await trashService.softDeleteImage(id, deletedBy);
        successCount++;
      } catch (error: any) {
        failedCount++;
        failedIds.push(id);
        console.warn(`软删除图片 ${id} 失败:`, error.message);
      }
    }

    const response: ApiResponse = {
      success: true,
      data: {
        success: successCount,
        failed: failedCount,
        failedIds
      },
      message: `批量删除完成：成功 ${successCount} 张，失败 ${failedCount} 张`
    };

    res.json(response);
  } catch (error: any) {
    console.error('批量删除图片失败:', error);
    const response: ApiResponse = {
      success: false,
      error: error.message || '批量删除图片失败'
    };
    res.status(500).json(response);
  }
});

// 获取图片统计信息
router.get('/stats/summary', async (req, res) => {
  try {
    const stats = await databaseManager.getImageStatistics();

    const response: ApiResponse = {
      success: true,
      data: stats
    };

    res.json(response);
  } catch (error: any) {
    console.error('获取统计信息失败:', error);
    const response: ApiResponse = {
      success: false,
      error: error.message || '获取统计信息失败'
    };
    res.status(500).json(response);
  }
});

/**
 * PATCH /api/images/:id/canvas-position
 * 更新图片画布位置
 * 需求: 2.1, 2.2, 2.3
 */
router.patch('/:id/canvas-position', async (req, res) => {
  try {
    const { id } = req.params;
    const { canvasX, canvasY } = req.body;
    
    // 验证参数
    if (typeof canvasX !== 'number' || typeof canvasY !== 'number') {
      const response: ApiResponse = {
        success: false,
        error: '无效的画布位置参数，canvasX 和 canvasY 必须是数字'
      };
      return res.status(400).json(response);
    }
    
    const updatedImage = await databaseManager.updateImageCanvasPosition(id, canvasX, canvasY);
    
    const response: ApiResponse<SavedImage> = {
      success: true,
      data: updatedImage,
      message: '图片画布位置更新成功'
    };
    
    res.json(response);
  } catch (error: any) {
    console.error('更新图片画布位置失败:', error);
    
    // 检查是否是图片不存在的错误
    if (error.message?.includes('图片不存在')) {
      const response: ApiResponse = {
        success: false,
        error: '图片不存在'
      };
      return res.status(404).json(response);
    }
    
    const response: ApiResponse = {
      success: false,
      error: error.message || '更新图片画布位置失败'
    };
    res.status(500).json(response);
  }
});

export default router;
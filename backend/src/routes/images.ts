import express from 'express';
import { ApiResponse, PaginatedResponse, SavedImage, GetImagesRequest, CreateImageRequest, UpdateImageRequest } from '@shared/types';
import { databaseService } from '../services/databaseService.js';

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
      }
    };

    const result = await databaseService.getImages({
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
    const image = await databaseService.getImageById(req.params.id);
    
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
      refImages: imageData.refImages ? imageData.refImages.map(base64 => ({
        file: new File([], 'ref.jpg'),
        base64,
        preview: base64
      })) : undefined,
      createdAt: new Date(),
      favorite: false,
      ossUploaded: false
    };

    const result = await databaseService.saveImage(savedImage);

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
    
    const result = await databaseService.updateImage(req.params.id, updateData);

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

// 删除图片
router.delete('/:id', async (req, res) => {
  try {
    await databaseService.deleteImage(req.params.id);

    const response: ApiResponse = {
      success: true,
      message: '图片删除成功'
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

// 批量删除图片
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

    const result = await databaseService.deleteImages(ids);

    const response: ApiResponse = {
      success: true,
      data: result,
      message: `批量删除完成：成功 ${result.success} 张，失败 ${result.failed} 张`
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
    const stats = await databaseService.getImageStatistics();

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

export default router;
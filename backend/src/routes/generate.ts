import express from 'express';
import { ApiResponse, CreateImageRequest, NanoBananaResultData } from '@shared/types';
import { nanoBananaService } from '../services/nanoBananaService.js';
import { databaseService } from '../services/databaseService.js';

const router = express.Router();

// 创建图片生成任务
router.post('/', async (req, res) => {
  try {
    const request: CreateImageRequest = req.body;
    
    // 验证必填字段
    if (!request.prompt || !request.model) {
      const response: ApiResponse = {
        success: false,
        error: '缺少必填字段：prompt 和 model'
      };
      return res.status(400).json(response);
    }

    // 获取 API 配置
    const apiConfig = await databaseService.getApiConfig();
    if (!apiConfig || !apiConfig.apiKey) {
      const response: ApiResponse = {
        success: false,
        error: '请先配置 Nano Banana API'
      };
      return res.status(400).json(response);
    }

    // 创建生成任务
    const taskId = await nanoBananaService.createTask({
      model: request.model,
      prompt: request.prompt,
      aspectRatio: request.aspectRatio,
      imageSize: request.imageSize,
      urls: request.refImages,
      shutProgress: false
    }, apiConfig);

    const response: ApiResponse = {
      success: true,
      data: {
        taskId,
        status: 'created'
      },
      message: '图片生成任务创建成功'
    };

    res.status(201).json(response);
  } catch (error: any) {
    console.error('创建生成任务失败:', error);
    const response: ApiResponse = {
      success: false,
      error: error.message || '创建生成任务失败'
    };
    res.status(500).json(response);
  }
});

// 获取任务状态
router.get('/:taskId', async (req, res) => {
  try {
    const { taskId } = req.params;
    
    // 获取 API 配置
    const apiConfig = await databaseService.getApiConfig();
    if (!apiConfig || !apiConfig.apiKey) {
      const response: ApiResponse = {
        success: false,
        error: '请先配置 Nano Banana API'
      };
      return res.status(400).json(response);
    }

    // 获取任务结果
    const result = await nanoBananaService.getTaskResult(taskId, apiConfig);

    const response: ApiResponse<NanoBananaResultData> = {
      success: true,
      data: result.data
    };

    res.json(response);
  } catch (error: any) {
    console.error('获取任务状态失败:', error);
    const response: ApiResponse = {
      success: false,
      error: error.message || '获取任务状态失败'
    };
    res.status(500).json(response);
  }
});

// 保存生成的图片
router.post('/:taskId/save', async (req, res) => {
  try {
    const { taskId } = req.params;
    const { imageUrl, prompt, model, aspectRatio, imageSize, refImages } = req.body;
    
    if (!imageUrl) {
      const response: ApiResponse = {
        success: false,
        error: '缺少图片URL'
      };
      return res.status(400).json(response);
    }

    // 创建图片记录
    const savedImage = {
      id: `img_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      url: imageUrl,
      prompt: prompt || '',
      model: model || 'nano-banana-fast',
      aspectRatio: aspectRatio || 'auto',
      imageSize: imageSize || '1K',
      refImages: refImages || undefined,
      createdAt: new Date(),
      favorite: false,
      ossUploaded: false
    };

    const result = await databaseService.saveImage(savedImage);

    const response: ApiResponse = {
      success: true,
      data: result,
      message: '图片保存成功'
    };

    res.json(response);
  } catch (error: any) {
    console.error('保存图片失败:', error);
    const response: ApiResponse = {
      success: false,
      error: error.message || '保存图片失败'
    };
    res.status(500).json(response);
  }
});

export default router;
import express from 'express';
import { ApiResponse, CreateImageRequest, NanoBananaResultData, SavedImage } from '@shared/types';
import { nanoBananaService } from '../services/nanoBananaService.js';
import { databaseManager } from '../services/databaseManager.js';
import { storageManager } from '../services/storageManager.js';
import { referenceImageService } from '../services/referenceImageService.js';
import { imageDimensionService } from '../services/imageDimensionService.js';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

/**
 * 从环境变量获取 API 配置
 */
function getApiConfigFromEnv() {
  return {
    apiKey: process.env.NANO_BANANA_API_KEY || '',
    baseUrl: process.env.NANO_BANANA_API_URL || 'https://grsai.dakka.com.cn',
    timeout: 450000,  // 450秒超时
    retryCount: 3,
    provider: 'Nano Banana AI'
  };
}

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

    // 从 .env 获取 API 配置
    const apiConfig = getApiConfigFromEnv();
    if (!apiConfig.apiKey) {
      const response: ApiResponse = {
        success: false,
        error: '请在 .env 文件中配置 NANO_BANANA_API_KEY'
      };
      return res.status(400).json(response);
    }

    // 处理参考图片：上传到 OSS 并获取 URL
    let refImageUrls: string[] | undefined;
    if (request.refImages && request.refImages.length > 0) {
      try {
        console.log(`处理 ${request.refImages.length} 张参考图片...`);
        const uploadResults = await referenceImageService.uploadRefImages(request.refImages);
        refImageUrls = uploadResults.map(r => r.ossUrl);
        console.log(`参考图片处理完成，获取到 ${refImageUrls.length} 个 OSS URL`);
      } catch (uploadError: any) {
        console.warn('参考图片上传失败，使用原始 Base64:', uploadError.message);
        // 如果上传失败，回退到使用原始 Base64
        refImageUrls = request.refImages;
      }
    }

    // 创建生成任务
    const taskId = await nanoBananaService.createTask({
      model: request.model,
      prompt: request.prompt,
      aspectRatio: request.aspectRatio,
      imageSize: request.imageSize,
      urls: refImageUrls,
      shutProgress: false
    }, apiConfig);

    const response: ApiResponse = {
      success: true,
      data: {
        taskId,
        status: 'created',
        refImagesUploaded: refImageUrls ? refImageUrls.length : 0
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
    
    // 从 .env 获取 API 配置
    const apiConfig = getApiConfigFromEnv();
    if (!apiConfig.apiKey) {
      const response: ApiResponse = {
        success: false,
        error: '请在 .env 文件中配置 NANO_BANANA_API_KEY'
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

// 保存生成的图片（上传到 OSS 并保存到数据库）
router.post('/:taskId/save', async (req, res) => {
  try {
    const { taskId } = req.params;
    const { imageUrl, prompt, model, aspectRatio, imageSize, refImages, projectId, canvasX, canvasY } = req.body;
    
    if (!imageUrl) {
      const response: ApiResponse = {
        success: false,
        error: '缺少图片URL'
      };
      return res.status(400).json(response);
    }

    // 从认证中间件获取当前用户 ID（需求 4.2）
    const userId = req.user?.id || 'default';
    // 从请求体获取当前项目 ID（需求 4.1, 4.2）
    const currentProjectId = projectId || null;

    // 生成图片 ID
    const imageId = `img_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    
    let finalUrl = imageUrl;
    let ossKey: string | undefined;
    let ossUploaded = false;
    let thumbnailUrl: string | undefined;
    let imageWidth: number | undefined;
    let imageHeight: number | undefined;

    // 使用图片尺寸服务处理图片（提取尺寸、生成缩略图）
    try {
      console.log('开始处理图片（提取尺寸、生成缩略图）...');
      const processedImage = await imageDimensionService.processImageFromUrl(imageUrl);
      
      // 获取实际尺寸
      imageWidth = processedImage.dimensions.width;
      imageHeight = processedImage.dimensions.height;
      console.log(`图片实际尺寸: ${imageWidth}x${imageHeight}`);

      // 尝试上传到存储服务
      if (storageManager.isConfigured()) {
        try {
          console.log('开始上传图片到存储服务...');
          // 上传原图
          const uploadResult = await storageManager.uploadFromBuffer(
            processedImage.buffer,
            'image/jpeg'
          );
          finalUrl = uploadResult.url;
          ossKey = uploadResult.key;
          ossUploaded = true;
          console.log('原图上传成功:', finalUrl);

          // 上传缩略图
          try {
            const thumbResult = await storageManager.uploadThumbnail(
              processedImage.thumbnail.buffer,
              uploadResult.key
            );
            thumbnailUrl = thumbResult.url;
            console.log('缩略图上传成功:', thumbnailUrl);
          } catch (thumbError: any) {
            console.warn('缩略图上传失败:', thumbError.message);
            // 缩略图上传失败不影响主流程
          }
        } catch (storageError: any) {
          console.warn('上传到存储服务失败，使用原始 URL:', storageError.message);
          // 存储上传失败时继续使用原始 URL
        }
      } else {
        console.log('存储服务未配置，使用原始 URL');
      }
    } catch (processError: any) {
      console.warn('图片处理失败，使用原始 URL 和预设尺寸:', processError.message);
      // 图片处理失败时，尝试直接上传原始 URL
      if (storageManager.isConfigured()) {
        try {
          const uploadResult = await storageManager.uploadFromUrl(imageUrl);
          finalUrl = uploadResult.url;
          ossKey = uploadResult.key;
          ossUploaded = true;
        } catch (storageError: any) {
          console.warn('上传到存储服务失败，使用原始 URL:', storageError.message);
        }
      }
      // 使用预设尺寸
      const defaultDimensions = imageDimensionService.getDefaultDimensions();
      imageWidth = defaultDimensions.width;
      imageHeight = defaultDimensions.height;
    }

    // 处理参考图片：如果是 Base64，先上传到 OSS
    let processedRefImages: { ossUrl: string; id: string }[] | undefined;
    if (refImages && Array.isArray(refImages) && refImages.length > 0) {
      try {
        // 检查是否是 Base64 格式（以 data: 开头或不包含 http）
        const isBase64 = refImages.some((img: any) => {
          if (typeof img === 'string') {
            return img.startsWith('data:') || !img.startsWith('http');
          }
          return img.base64 || img.preview;
        });

        if (isBase64) {
          // 提取 Base64 数据
          const base64Images = refImages.map((img: any) => {
            if (typeof img === 'string') return img;
            return img.base64 || img.preview;
          }).filter(Boolean);

          if (base64Images.length > 0) {
            console.log(`上传 ${base64Images.length} 张参考图片到 OSS...`);
            const uploadResults = await referenceImageService.uploadRefImages(base64Images);
            processedRefImages = uploadResults.map(r => ({ ossUrl: r.ossUrl, id: r.id }));
            console.log(`参考图片上传完成，新上传 ${uploadResults.filter(r => r.isNew).length} 张`);
          }
        } else {
          // 已经是 URL 格式，直接使用
          processedRefImages = refImages.map((url: string, index: number) => ({
            ossUrl: url,
            id: `existing_${index}`
          }));
        }
      } catch (refError: any) {
        console.warn('处理参考图片失败:', refError.message);
        // 参考图片处理失败不影响主图片保存
      }
    }

    // 创建图片记录 - 包含实际尺寸和缩略图 URL
    const savedImage = {
      id: imageId,
      url: finalUrl,
      originalUrl: ossUploaded ? imageUrl : undefined,
      prompt: prompt || '',
      model: model || 'nano-banana-fast',
      aspectRatio: aspectRatio || 'auto',
      imageSize: imageSize || '1K',
      // 只保存 OSS URL 引用，不保存 Base64
      refImages: processedRefImages ? processedRefImages.map(r => ({ url: r.ossUrl, id: r.id })) : undefined,
      createdAt: new Date(),
      favorite: false,
      ossKey,
      ossUploaded,
      taskId,
      userId,           // 关联当前用户 ID（需求 4.2）
      projectId: currentProjectId,  // 关联当前项目 ID（需求 4.1, 4.2）
      canvasX: canvasX !== undefined ? canvasX : undefined,  // 画布 X 坐标
      canvasY: canvasY !== undefined ? canvasY : undefined,  // 画布 Y 坐标
      thumbnailUrl,     // 缩略图 URL
      width: imageWidth,   // 图片实际宽度
      height: imageHeight  // 图片实际高度
    };

    // 保存到数据库
    const result = await databaseManager.saveImage(savedImage);

    const response: ApiResponse = {
      success: true,
      data: {
        ...result,
        ossUploaded,
        ossKey,
        thumbnailUrl,
        width: imageWidth,
        height: imageHeight,
        refImagesProcessed: processedRefImages?.length || 0
      },
      message: ossUploaded ? '图片已上传到 OSS 并保存到数据库' : '图片已保存到数据库（OSS 未配置）'
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

/**
 * 保存失败的图片记录
 * POST /api/generate/save-failed
 */
router.post('/save-failed', async (req, res) => {
  try {
    const { 
      prompt, 
      model, 
      aspectRatio, 
      imageSize, 
      projectId, 
      canvasX, 
      canvasY, 
      width, 
      height,
      failureReason 
    } = req.body;

    // 验证必填字段
    if (!prompt) {
      return res.status(400).json({
        success: false,
        error: '缺少必填字段: prompt'
      });
    }

    // 获取当前用户 ID
    const userId = (req as any).user?.userId || 'default';

    // 创建失败的图片记录
    const failedImage: SavedImage = {
      id: uuidv4(),
      url: '',  // 失败时没有 URL
      prompt,
      model: model || 'nano-banana-fast',
      aspectRatio: aspectRatio || 'auto',
      imageSize: imageSize || '1K',
      createdAt: new Date(),
      favorite: false,
      ossUploaded: false,
      userId,
      projectId: projectId || undefined,
      canvasX: canvasX !== undefined ? canvasX : undefined,
      canvasY: canvasY !== undefined ? canvasY : undefined,
      width: width !== undefined ? width : undefined,
      height: height !== undefined ? height : undefined,
      status: 'failed',
      failureReason: failureReason || '未知错误'
    };

    // 保存到数据库
    const result = await databaseManager.saveImage(failedImage);

    const response: ApiResponse = {
      success: true,
      data: result,
      message: '失败记录已保存'
    };

    res.json(response);
  } catch (error: any) {
    console.error('保存失败记录失败:', error);
    const response: ApiResponse = {
      success: false,
      error: error.message || '保存失败记录失败'
    };
    res.status(500).json(response);
  }
});

export default router;
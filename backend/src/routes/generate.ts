import express from 'express';
import { ApiResponse, CreateImageRequest, NanoBananaResultData } from '@shared/types';
import { nanoBananaService } from '../services/nanoBananaService.js';
import { databaseService } from '../services/databaseService.js';
import { aliOssService } from '../services/aliOssService.js';
import { referenceImageService } from '../services/referenceImageService.js';

const router = express.Router();

/**
 * 从环境变量获取 API 配置
 */
function getApiConfigFromEnv() {
  return {
    apiKey: process.env.NANO_BANANA_API_KEY || '',
    baseUrl: process.env.NANO_BANANA_API_URL || 'https://grsai.dakka.com.cn',
    timeout: 300000,
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
    const { imageUrl, prompt, model, aspectRatio, imageSize, refImages } = req.body;
    
    if (!imageUrl) {
      const response: ApiResponse = {
        success: false,
        error: '缺少图片URL'
      };
      return res.status(400).json(response);
    }

    // 从认证中间件获取当前用户 ID（需求 4.2）
    const userId = req.user?.id || 'default';

    // 生成图片 ID
    const imageId = `img_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    
    let finalUrl = imageUrl;
    let ossKey: string | undefined;
    let ossUploaded = false;

    // 尝试上传到 OSS
    if (aliOssService.isConfigured()) {
      try {
        console.log('开始上传图片到 OSS...');
        const uploadResult = await aliOssService.uploadFromUrl(imageUrl);
        finalUrl = uploadResult.url;
        ossKey = uploadResult.ossKey;
        ossUploaded = true;
        console.log('图片上传到 OSS 成功:', finalUrl);
      } catch (ossError: any) {
        console.warn('上传到 OSS 失败，使用原始 URL:', ossError.message);
        // OSS 上传失败时继续使用原始 URL
      }
    } else {
      console.log('OSS 未配置，使用原始 URL');
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

    // 创建图片记录 - 只保存参考图片的 OSS URL，不保存 Base64
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
      userId  // 关联当前用户 ID（需求 4.2）
    };

    // 保存到数据库
    const result = await databaseService.saveImage(savedImage);

    const response: ApiResponse = {
      success: true,
      data: {
        ...result,
        ossUploaded,
        ossKey,
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

export default router;
import express from 'express';
import { ApiResponse } from '@shared/types';
import { aliOssService } from '../services/aliOssService';

const router = express.Router();

/**
 * 从环境变量获取 API 配置（只读）
 * 敏感信息会被部分隐藏
 */
function getApiConfigFromEnv() {
  const apiKey = process.env.NANO_BANANA_API_KEY || '';
  return {
    apiKey: apiKey ? `${apiKey.substring(0, 8)}...${apiKey.substring(apiKey.length - 4)}` : '未配置',
    apiKeyConfigured: !!apiKey,
    baseUrl: process.env.NANO_BANANA_API_URL || '未配置',
    provider: 'Nano Banana AI'
  };
}

/**
 * 从环境变量获取数据库配置（只读）
 * 只展示主机地址、端口和数据库名称，隐藏敏感信息
 */
function getDatabaseConfigFromEnv() {
  return {
    host: process.env.DB_HOST || '未配置',
    port: parseInt(process.env.DB_PORT || '3306'),
    database: process.env.DB_DATABASE || '未配置',
  };
}

/**
 * 从环境变量获取 OSS 配置（只读）
 * 只展示区域和存储桶名称，隐藏敏感信息
 */
function getOSSConfigFromEnv() {
  return {
    region: process.env.OSS_REGION || '未配置',
    bucket: process.env.OSS_BUCKET || '未配置',
  };
}

// 获取所有配置（只读，从 .env 文件读取）
router.get('/', async (_req, res) => {
  try {
    const response: ApiResponse = {
      success: true,
      data: {
        apiConfig: getApiConfigFromEnv(),
        databaseConfig: getDatabaseConfigFromEnv(),
        ossConfig: getOSSConfigFromEnv(),
        readOnly: true,
        message: '配置信息从 .env 文件读取，前端不可修改'
      }
    };

    res.json(response);
  } catch (error: any) {
    console.error('获取配置失败:', error);
    const response: ApiResponse = {
      success: false,
      error: error.message || '获取配置失败'
    };
    res.status(500).json(response);
  }
});

// 获取 API 配置（只读）
router.get('/api', async (_req, res) => {
  try {
    const response: ApiResponse = {
      success: true,
      data: getApiConfigFromEnv()
    };

    res.json(response);
  } catch (error: any) {
    console.error('获取 API 配置失败:', error);
    const response: ApiResponse = {
      success: false,
      error: error.message || '获取 API 配置失败'
    };
    res.status(500).json(response);
  }
});

// 获取数据库配置（只读）
router.get('/database', async (_req, res) => {
  try {
    const response: ApiResponse = {
      success: true,
      data: getDatabaseConfigFromEnv()
    };

    res.json(response);
  } catch (error: any) {
    console.error('获取数据库配置失败:', error);
    const response: ApiResponse = {
      success: false,
      error: error.message || '获取数据库配置失败'
    };
    res.status(500).json(response);
  }
});

// 获取 OSS 配置（只读）
router.get('/oss', async (_req, res) => {
  try {
    const response: ApiResponse = {
      success: true,
      data: getOSSConfigFromEnv()
    };

    res.json(response);
  } catch (error: any) {
    console.error('获取 OSS 配置失败:', error);
    const response: ApiResponse = {
      success: false,
      error: error.message || '获取 OSS 配置失败'
    };
    res.status(500).json(response);
  }
});

// 获取 OSS 连接状态（真正测试连接）
router.get('/oss/status', async (_req, res) => {
  try {
    const accessKeyId = process.env.OSS_ACCESS_KEY_ID;
    const accessKeySecret = process.env.OSS_ACCESS_KEY_SECRET;
    const bucket = process.env.OSS_BUCKET;
    const region = process.env.OSS_REGION;
    
    // 检查必要配置是否存在
    const isConfigured = !!(accessKeyId && accessKeySecret && bucket && region);
    
    if (!isConfigured) {
      const response: ApiResponse = {
        success: true,
        data: {
          isConnected: false,
          status: 'not_configured',
          message: 'OSS 配置不完整，请检查 .env 文件中的 OSS 配置'
        }
      };
      return res.json(response);
    }
    
    // 确保 OSS 服务已初始化
    if (!aliOssService.isConfigured()) {
      aliOssService.initialize();
    }
    
    // 真正测试 OSS 连接
    try {
      const isConnected = await aliOssService.testConnection();
      
      const response: ApiResponse = {
        success: true,
        data: {
          isConnected,
          status: isConnected ? 'connected' : 'disconnected',
          message: isConnected ? 'OSS 连接正常' : 'OSS 连接失败，请检查配置或账户状态'
        }
      };
      return res.json(response);
    } catch (ossError: any) {
      // 解析 OSS 错误，提供更详细的信息
      let status = 'error';
      let message = 'OSS 连接失败';
      
      const errorCode = ossError.code || ossError.status;
      const errorMessage = ossError.message || '';
      
      // 根据错误码判断具体问题
      if (errorCode === 'InvalidAccessKeyId' || errorCode === 'SignatureDoesNotMatch') {
        status = 'auth_error';
        message = 'OSS 认证失败：AccessKey 无效或已过期';
      } else if (errorCode === 'AccessDenied' || errorCode === 403) {
        status = 'access_denied';
        message = 'OSS 访问被拒绝：可能是账户欠费或权限不足';
      } else if (errorCode === 'NoSuchBucket') {
        status = 'bucket_not_found';
        message = 'OSS Bucket 不存在';
      } else if (errorCode === 'RequestTimeTooSkewed') {
        status = 'time_error';
        message = 'OSS 请求时间偏差过大，请检查系统时间';
      } else if (errorMessage.includes('欠费') || errorMessage.includes('arrears')) {
        status = 'arrears';
        message = 'OSS 账户欠费，请充值后重试';
      } else {
        message = `OSS 连接失败：${errorMessage || errorCode || '未知错误'}`;
      }
      
      console.error('OSS 连接测试失败:', ossError);
      
      const response: ApiResponse = {
        success: true,
        data: {
          isConnected: false,
          status,
          message,
          errorCode: errorCode || undefined,
          errorDetail: errorMessage || undefined
        }
      };
      return res.json(response);
    }
  } catch (error: any) {
    console.error('获取 OSS 状态失败:', error);
    const response: ApiResponse = {
      success: false,
      error: error.message || '获取 OSS 状态失败'
    };
    res.status(500).json(response);
  }
});

// 禁止保存配置 - 返回只读提示
router.post('/', async (_req, res) => {
  const response: ApiResponse = {
    success: false,
    error: '配置为只读模式，请在 .env 文件中修改配置'
  };
  res.status(403).json(response);
});

router.post('/api', async (_req, res) => {
  const response: ApiResponse = {
    success: false,
    error: 'API 配置为只读模式，请在 .env 文件中修改 NANO_BANANA_API_KEY 和 NANO_BANANA_API_URL'
  };
  res.status(403).json(response);
});

router.post('/oss', async (_req, res) => {
  const response: ApiResponse = {
    success: false,
    error: 'OSS 配置为只读模式，请在 .env 文件中修改 OSS_* 相关配置'
  };
  res.status(403).json(response);
});

router.delete('/api', async (_req, res) => {
  const response: ApiResponse = {
    success: false,
    error: '配置为只读模式，无法删除'
  };
  res.status(403).json(response);
});

router.delete('/oss', async (_req, res) => {
  const response: ApiResponse = {
    success: false,
    error: '配置为只读模式，无法删除'
  };
  res.status(403).json(response);
});

export default router;

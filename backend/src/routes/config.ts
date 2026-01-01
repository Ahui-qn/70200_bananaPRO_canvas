import express from 'express';
import { ApiResponse } from '@shared/types';

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

// 获取 OSS 连接状态
router.get('/oss/status', async (_req, res) => {
  try {
    const accessKeyId = process.env.OSS_ACCESS_KEY_ID;
    const accessKeySecret = process.env.OSS_ACCESS_KEY_SECRET;
    const bucket = process.env.OSS_BUCKET;
    const region = process.env.OSS_REGION;
    
    // 检查必要配置是否存在
    const isConnected = !!(accessKeyId && accessKeySecret && bucket && region);
    
    const response: ApiResponse = {
      success: true,
      data: {
        isConnected,
        message: isConnected ? 'OSS 配置完整' : 'OSS 配置不完整'
      }
    };

    res.json(response);
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

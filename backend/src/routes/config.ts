import express from 'express';
import { ApiResponse, SaveConfigRequest, TestConnectionRequest, ApiConfig, DatabaseConfig, OSSConfig } from '@shared/types';
import { databaseService } from '../services/databaseService.js';

const router = express.Router();

// 获取所有配置
router.get('/', async (req, res) => {
  try {
    const [apiConfig, ossConfig] = await Promise.all([
      databaseService.getApiConfig().catch(() => null),
      databaseService.getOSSConfig().catch(() => null)
    ]);

    const response: ApiResponse = {
      success: true,
      data: {
        apiConfig,
        ossConfig,
        databaseConfig: null // 数据库配置不返回敏感信息
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

// 保存配置
router.post('/', async (req, res) => {
  try {
    const configData: SaveConfigRequest = req.body;
    const results: any = {};

    // 保存 API 配置
    if (configData.apiConfig) {
      try {
        await databaseService.saveApiConfig(configData.apiConfig);
        results.apiConfig = { success: true, message: 'API 配置保存成功' };
      } catch (error: any) {
        results.apiConfig = { success: false, error: error.message };
      }
    }

    // 保存 OSS 配置
    if (configData.ossConfig) {
      try {
        await databaseService.saveOSSConfig(configData.ossConfig);
        results.ossConfig = { success: true, message: 'OSS 配置保存成功' };
      } catch (error: any) {
        results.ossConfig = { success: false, error: error.message };
      }
    }

    // 数据库配置需要重新连接
    if (configData.databaseConfig) {
      try {
        await databaseService.connect(configData.databaseConfig);
        results.databaseConfig = { success: true, message: '数据库连接成功' };
      } catch (error: any) {
        results.databaseConfig = { success: false, error: error.message };
      }
    }

    const response: ApiResponse = {
      success: true,
      data: results,
      message: '配置保存完成'
    };

    res.json(response);
  } catch (error: any) {
    console.error('保存配置失败:', error);
    const response: ApiResponse = {
      success: false,
      error: error.message || '保存配置失败'
    };
    res.status(500).json(response);
  }
});

// 测试数据库连接
router.post('/test-database', async (req, res) => {
  try {
    const { databaseConfig }: TestConnectionRequest = req.body;
    
    if (!databaseConfig) {
      const response: ApiResponse = {
        success: false,
        error: '请提供数据库配置'
      };
      return res.status(400).json(response);
    }

    // 测试连接
    const testResult = await databaseService.testConnection(databaseConfig);

    const response: ApiResponse = {
      success: testResult.success,
      data: testResult,
      message: testResult.success ? '数据库连接测试成功' : '数据库连接测试失败'
    };

    res.json(response);
  } catch (error: any) {
    console.error('测试数据库连接失败:', error);
    const response: ApiResponse = {
      success: false,
      error: error.message || '测试数据库连接失败'
    };
    res.status(500).json(response);
  }
});

// 获取 API 配置
router.get('/api', async (req, res) => {
  try {
    const apiConfig = await databaseService.getApiConfig();

    const response: ApiResponse<ApiConfig> = {
      success: true,
      data: apiConfig
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

// 保存 API 配置
router.post('/api', async (req, res) => {
  try {
    const apiConfig: ApiConfig = req.body;
    
    await databaseService.saveApiConfig(apiConfig);

    const response: ApiResponse = {
      success: true,
      message: 'API 配置保存成功'
    };

    res.json(response);
  } catch (error: any) {
    console.error('保存 API 配置失败:', error);
    const response: ApiResponse = {
      success: false,
      error: error.message || '保存 API 配置失败'
    };
    res.status(500).json(response);
  }
});

// 获取 OSS 配置
router.get('/oss', async (req, res) => {
  try {
    const ossConfig = await databaseService.getOSSConfig();

    const response: ApiResponse<OSSConfig> = {
      success: true,
      data: ossConfig
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

// 保存 OSS 配置
router.post('/oss', async (req, res) => {
  try {
    const ossConfig: OSSConfig = req.body;
    
    await databaseService.saveOSSConfig(ossConfig);

    const response: ApiResponse = {
      success: true,
      message: 'OSS 配置保存成功'
    };

    res.json(response);
  } catch (error: any) {
    console.error('保存 OSS 配置失败:', error);
    const response: ApiResponse = {
      success: false,
      error: error.message || '保存 OSS 配置失败'
    };
    res.status(500).json(response);
  }
});

// 删除配置
router.delete('/api', async (req, res) => {
  try {
    await databaseService.deleteApiConfig();

    const response: ApiResponse = {
      success: true,
      message: 'API 配置删除成功'
    };

    res.json(response);
  } catch (error: any) {
    console.error('删除 API 配置失败:', error);
    const response: ApiResponse = {
      success: false,
      error: error.message || '删除 API 配置失败'
    };
    res.status(500).json(response);
  }
});

router.delete('/oss', async (req, res) => {
  try {
    await databaseService.deleteOSSConfig();

    const response: ApiResponse = {
      success: true,
      message: 'OSS 配置删除成功'
    };

    res.json(response);
  } catch (error: any) {
    console.error('删除 OSS 配置失败:', error);
    const response: ApiResponse = {
      success: false,
      error: error.message || '删除 OSS 配置失败'
    };
    res.status(500).json(response);
  }
});

export default router;
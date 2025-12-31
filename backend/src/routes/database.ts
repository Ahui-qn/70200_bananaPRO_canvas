import express from 'express';
import { ApiResponse, DatabaseStatistics } from '@shared/types';
import { databaseService } from '../services/databaseService.js';

const router = express.Router();

// 获取数据库状态
router.get('/status', async (req, res) => {
  try {
    const status = databaseService.getConnectionStatus();

    const response: ApiResponse = {
      success: true,
      data: {
        isConnected: status.isConnected,
        connectionInfo: status.connectionInfo,
        lastError: status.lastError,
        connectedAt: status.connectedAt
      }
    };

    res.json(response);
  } catch (error: any) {
    console.error('获取数据库状态失败:', error);
    const response: ApiResponse = {
      success: false,
      error: error.message || '获取数据库状态失败'
    };
    res.status(500).json(response);
  }
});

// 初始化数据库
router.post('/init', async (req, res) => {
  try {
    await databaseService.initializeTables();

    const response: ApiResponse = {
      success: true,
      message: '数据库初始化成功'
    };

    res.json(response);
  } catch (error: any) {
    console.error('数据库初始化失败:', error);
    const response: ApiResponse = {
      success: false,
      error: error.message || '数据库初始化失败'
    };
    res.status(500).json(response);
  }
});

// 获取数据库统计信息
router.get('/stats', async (req, res) => {
  try {
    const stats = await databaseService.getDatabaseStatistics();

    const response: ApiResponse<DatabaseStatistics> = {
      success: true,
      data: stats
    };

    res.json(response);
  } catch (error: any) {
    console.error('获取数据库统计失败:', error);
    const response: ApiResponse = {
      success: false,
      error: error.message || '获取数据库统计失败'
    };
    res.status(500).json(response);
  }
});

// 测试数据库连接
router.post('/test', async (req, res) => {
  try {
    const { databaseConfig } = req.body;
    
    if (!databaseConfig) {
      const response: ApiResponse = {
        success: false,
        error: '请提供数据库配置'
      };
      return res.status(400).json(response);
    }

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

// 连接数据库
router.post('/connect', async (req, res) => {
  try {
    const { databaseConfig } = req.body;
    
    if (!databaseConfig) {
      const response: ApiResponse = {
        success: false,
        error: '请提供数据库配置'
      };
      return res.status(400).json(response);
    }

    await databaseService.connect(databaseConfig);

    const response: ApiResponse = {
      success: true,
      message: '数据库连接成功'
    };

    res.json(response);
  } catch (error: any) {
    console.error('连接数据库失败:', error);
    const response: ApiResponse = {
      success: false,
      error: error.message || '连接数据库失败'
    };
    res.status(500).json(response);
  }
});

// 断开数据库连接
router.post('/disconnect', async (req, res) => {
  try {
    await databaseService.disconnect();

    const response: ApiResponse = {
      success: true,
      message: '数据库连接已断开'
    };

    res.json(response);
  } catch (error: any) {
    console.error('断开数据库连接失败:', error);
    const response: ApiResponse = {
      success: false,
      error: error.message || '断开数据库连接失败'
    };
    res.status(500).json(response);
  }
});

// 清除用户数据
router.delete('/clear', async (req, res) => {
  try {
    await databaseService.clearUserData();

    const response: ApiResponse = {
      success: true,
      message: '用户数据清除成功'
    };

    res.json(response);
  } catch (error: any) {
    console.error('清除用户数据失败:', error);
    const response: ApiResponse = {
      success: false,
      error: error.message || '清除用户数据失败'
    };
    res.status(500).json(response);
  }
});

// 获取操作日志
router.get('/logs', async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 50;

    const logs = await databaseService.getOperationLogs({
      page,
      pageSize,
      sortBy: 'created_at',
      sortOrder: 'DESC',
      filters: {}
    });

    const response: ApiResponse = {
      success: true,
      data: logs
    };

    res.json(response);
  } catch (error: any) {
    console.error('获取操作日志失败:', error);
    const response: ApiResponse = {
      success: false,
      error: error.message || '获取操作日志失败'
    };
    res.status(500).json(response);
  }
});

export default router;
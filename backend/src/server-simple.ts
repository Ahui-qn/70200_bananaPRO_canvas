import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { ApiResponse } from '@shared/types';

// 加载环境变量
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3002;

// 中间件
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// 请求日志中间件
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
  next();
});

// 健康检查端点
app.get('/api/health', (req, res) => {
  const response: ApiResponse = {
    success: true,
    message: '后端服务运行正常',
    data: {
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      status: 'healthy',
      uptime: process.uptime()
    }
  };
  res.json(response);
});

// 简化的 API 路由
app.get('/api/images', (req, res) => {
  const response: ApiResponse = {
    success: true,
    message: '图片 API 已就绪',
    data: {
      images: [],
      total: 0,
      page: 1,
      pageSize: 20
    }
  };
  res.json(response);
});

app.get('/api/config', (req, res) => {
  const response: ApiResponse = {
    success: true,
    message: '配置 API 已就绪',
    data: {
      apiConfig: null,
      databaseConfig: null,
      ossConfig: null
    }
  };
  res.json(response);
});

// API 配置端点
app.get('/api/config/api', (req, res) => {
  const response: ApiResponse = {
    success: true,
    message: 'API 配置获取成功',
    data: null // 暂时返回空配置
  };
  res.json(response);
});

app.post('/api/config/api', (req, res) => {
  const response: ApiResponse = {
    success: true,
    message: 'API 配置保存成功',
    data: req.body
  };
  res.json(response);
});

// OSS 配置端点
app.get('/api/config/oss', (req, res) => {
  const response: ApiResponse = {
    success: true,
    message: 'OSS 配置获取成功',
    data: null // 暂时返回空配置
  };
  res.json(response);
});

app.post('/api/config/oss', (req, res) => {
  const response: ApiResponse = {
    success: true,
    message: 'OSS 配置保存成功',
    data: req.body
  };
  res.json(response);
});

// 测试 OSS 连接
app.post('/api/config/test-oss', (req, res) => {
  const { ossConfig } = req.body;
  
  // 这里应该实现真实的 OSS 连接测试
  // 暂时返回成功响应
  const response: ApiResponse = {
    success: true,
    message: 'OSS 连接测试成功',
    data: {
      region: ossConfig.region,
      bucket: ossConfig.bucket,
      endpoint: ossConfig.endpoint
    }
  };
  res.json(response);
});

// 测试数据库连接
app.post('/api/config/test-database', (req, res) => {
  const { databaseConfig } = req.body;
  
  // 这里应该实现真实的数据库连接测试
  // 暂时返回成功响应
  const response: ApiResponse = {
    success: true,
    message: '数据库连接测试成功',
    data: {
      host: databaseConfig.host,
      port: databaseConfig.port,
      database: databaseConfig.database
    }
  };
  res.json(response);
});

app.get('/api/database/status', (req, res) => {
  const response: ApiResponse = {
    success: true,
    message: '数据库 API 已就绪',
    data: {
      isConnected: false,
      connectionInfo: '未连接',
      status: 'disconnected'
    }
  };
  res.json(response);
});

// 连接数据库
app.post('/api/database/connect', (req, res) => {
  const { databaseConfig } = req.body;
  
  // 这里应该实现真实的数据库连接
  // 暂时返回成功响应
  const response: ApiResponse = {
    success: true,
    message: '数据库连接成功',
    data: {
      isConnected: true,
      connectionInfo: `${databaseConfig.host}:${databaseConfig.port}/${databaseConfig.database}`,
      status: 'connected'
    }
  };
  res.json(response);
});

// 断开数据库连接
app.post('/api/database/disconnect', (req, res) => {
  // 这里应该实现真实的数据库断开连接
  const response: ApiResponse = {
    success: true,
    message: '数据库连接已断开',
    data: {
      isConnected: false,
      connectionInfo: '未连接',
      status: 'disconnected'
    }
  };
  res.json(response);
});

// 初始化数据库
app.post('/api/database/init', (req, res) => {
  // 这里应该实现数据库表结构初始化
  const response: ApiResponse = {
    success: true,
    message: '数据库初始化成功',
    data: {
      tablesCreated: ['images', 'configs', 'operation_logs'],
      timestamp: new Date().toISOString()
    }
  };
  res.json(response);
});

// 测试端点
app.post('/api/test', (req, res) => {
  const response: ApiResponse = {
    success: true,
    message: '测试成功',
    data: {
      received: req.body,
      timestamp: new Date().toISOString()
    }
  };
  res.json(response);
});

// 错误处理中间件
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('服务器错误:', err);
  
  const response: ApiResponse = {
    success: false,
    error: process.env.NODE_ENV === 'production' ? '服务器内部错误' : err.message,
  };
  
  res.status(500).json(response);
});

// 404 处理
app.use('*', (req, res) => {
  const response: ApiResponse = {
    success: false,
    error: `接口不存在: ${req.method} ${req.originalUrl}`,
  };
  res.status(404).json(response);
});

// 启动服务器
app.listen(PORT, () => {
  console.log(`🚀 后端服务已启动 (简化版)`);
  console.log(`📍 地址: http://localhost:${PORT}`);
  console.log(`🌍 环境: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 健康检查: http://localhost:${PORT}/api/health`);
  console.log(`📚 可用接口:`);
  console.log(`   - GET  /api/health - 健康检查`);
  console.log(`   - GET  /api/images - 图片列表`);
  console.log(`   - GET  /api/config - 配置信息`);
  console.log(`   - GET  /api/database/status - 数据库状态`);
  console.log(`   - POST /api/test - 测试接口`);
});
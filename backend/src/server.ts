import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { ApiResponse } from '@shared/types';

// 导入路由
import imagesRouter from './routes/images.js';
import configRouter from './routes/config.js';
import databaseRouter from './routes/database.js';
import generateRouter from './routes/generate.js';

// 加载环境变量
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// 中间件
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// 请求日志中间件
app.use((req, _res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
  next();
});

// 健康检查端点
app.get('/api/health', (_req, res) => {
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

// API 路由
app.use('/api/images', imagesRouter);
app.use('/api/config', configRouter);
app.use('/api/database', databaseRouter);
app.use('/api/generate', generateRouter);

// 错误处理中间件
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
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
  console.log(`🚀 后端服务已启动`);
  console.log(`📍 地址: http://localhost:${PORT}`);
  console.log(`🌍 环境: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 健康检查: http://localhost:${PORT}/api/health`);
  console.log(`📚 API 文档:`);
  console.log(`   - 图片管理: /api/images`);
  console.log(`   - 配置管理: /api/config`);
  console.log(`   - 数据库: /api/database`);
  console.log(`   - 图片生成: /api/generate`);
});
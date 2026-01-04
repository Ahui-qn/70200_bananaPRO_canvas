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
import refImagesRouter from './routes/refImages.js';
import authRouter from './routes/auth.js';
import projectsRouter from './routes/projects.js';
import trashRouter from './routes/trash.js';

// 导入中间件
import { authMiddleware } from './middleware/auth.js';

// 导入服务
import { aliOssService } from './services/aliOssService.js';
import { databaseService } from './services/databaseService.js';

// 加载环境变量
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// 初始化 OSS 服务
const ossInitialized = aliOssService.initialize();

/**
 * 从环境变量获取数据库配置并自动连接
 */
async function initializeDatabase(): Promise<boolean> {
  const dbHost = process.env.DB_HOST;
  const dbPort = process.env.DB_PORT;
  const dbDatabase = process.env.DB_DATABASE;
  const dbUsername = process.env.DB_USERNAME;
  const dbPassword = process.env.DB_PASSWORD;
  const dbSsl = process.env.DB_SSL;

  // 检查必要的配置是否存在
  if (!dbHost || !dbDatabase || !dbUsername || !dbPassword) {
    console.warn('⚠️  数据库配置不完整，跳过自动连接');
    return false;
  }

  try {
    const dbConfig = {
      host: dbHost,
      port: parseInt(dbPort || '3306', 10),
      database: dbDatabase,
      username: dbUsername,
      password: dbPassword,
      ssl: dbSsl === 'true',
      enabled: true
    };

    console.log('正在连接数据库...');
    const connected = await databaseService.connect(dbConfig);
    
    if (connected) {
      console.log('✅ 数据库连接成功');
      return true;
    } else {
      console.warn('⚠️  数据库连接失败');
      return false;
    }
  } catch (error: any) {
    console.error('❌ 数据库连接错误:', error.message);
    return false;
  }
}

// 中间件
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}));
// 增加请求体大小限制，支持多张参考图上传
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

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
app.use('/api/auth', authRouter);

// 受保护的路由（需要登录）
app.use('/api/images', authMiddleware, imagesRouter);
app.use('/api/config', authMiddleware, configRouter);
app.use('/api/database', authMiddleware, databaseRouter);
app.use('/api/generate', authMiddleware, generateRouter);
app.use('/api/ref-images', authMiddleware, refImagesRouter);
app.use('/api/projects', authMiddleware, projectsRouter);
app.use('/api/trash', authMiddleware, trashRouter);

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
const startServer = async () => {
  // 初始化数据库连接
  const dbConnected = await initializeDatabase();
  
  app.listen(PORT, () => {
    console.log(`🚀 后端服务已启动`);
    console.log(`📍 地址: http://localhost:${PORT}`);
    console.log(`🌍 环境: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🔗 健康检查: http://localhost:${PORT}/api/health`);
    console.log(`🗄️  数据库: ${dbConnected ? '已连接' : '未连接'}`);
    console.log(`☁️  OSS 服务: ${ossInitialized ? '已初始化' : '未配置'}`);
    console.log(`📚 API 文档:`);
    console.log(`   - 图片管理: /api/images`);
    console.log(`   - 配置管理: /api/config`);
    console.log(`   - 数据库: /api/database`);
    console.log(`   - 图片生成: /api/generate`);
    console.log(`   - 参考图片: /api/ref-images`);
    console.log(`   - 项目管理: /api/projects`);
    console.log(`   - 回收站: /api/trash`);
  });
};

startServer();
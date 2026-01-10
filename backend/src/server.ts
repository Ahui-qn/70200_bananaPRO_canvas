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
import staticImagesRouter from './routes/staticImages.js';
import backupRouter from './routes/backup.js';

// 导入中间件
import { authMiddleware } from './middleware/auth.js';

// 导入服务
import { storageManager } from './services/storageManager.js';
import { databaseService } from './services/databaseService.js';
import { databaseManager } from './services/databaseManager.js';
import { databaseBackupService } from './services/databaseBackupService.js';

// 加载环境变量
dotenv.config();

const app = express();

// 初始化存储服务
const storageInitialized = storageManager.initialize();

/**
 * 初始化数据库
 * 根据 DATABASE_MODE 环境变量选择使用 MySQL 或 SQLite
 */
async function initializeDatabase(): Promise<boolean> {
  const databaseMode = process.env.DATABASE_MODE?.toLowerCase();
  
  // SQLite 模式
  if (databaseMode === 'sqlite') {
    try {
      console.log('📦 使用 SQLite 数据库模式...');
      const result = await databaseManager.initialize();
      if (result) {
        console.log('✅ SQLite 数据库初始化成功');
        return true;
      } else {
        console.warn('⚠️  SQLite 数据库初始化失败');
        return false;
      }
    } catch (error: any) {
      console.error('❌ SQLite 数据库错误:', error.message);
      return false;
    }
  }
  
  // MySQL 模式（默认）
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

    console.log('正在连接 MySQL 数据库...');
    const connected = await databaseService.connect(dbConfig);
    
    if (connected) {
      console.log('✅ MySQL 数据库连接成功');
      // 标记 databaseManager 为 MySQL 模式
      await databaseManager.initialize();
      return true;
    } else {
      console.warn('⚠️  MySQL 数据库连接失败');
      return false;
    }
  } catch (error: any) {
    console.error('❌ MySQL 数据库连接错误:', error.message);
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

// 静态图片路由（仅本地存储模式）
// 注意：此路由不需要认证，因为图片 URL 本身就是访问凭证
if (process.env.STORAGE_MODE?.toLowerCase() === 'local') {
  app.use('/api/static-images', staticImagesRouter);
  console.log('📁 已启用本地静态图片服务');
}

// 受保护的路由（需要登录）
app.use('/api/images', authMiddleware, imagesRouter);
app.use('/api/config', authMiddleware, configRouter);
app.use('/api/database', authMiddleware, databaseRouter);
app.use('/api/generate', authMiddleware, generateRouter);
app.use('/api/ref-images', authMiddleware, refImagesRouter);
app.use('/api/projects', authMiddleware, projectsRouter);
app.use('/api/trash', authMiddleware, trashRouter);
app.use('/api/backup', authMiddleware, backupRouter);

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
  
  // 初始化数据库备份服务（仅 SQLite 模式且本地存储模式）
  const databaseMode = process.env.DATABASE_MODE?.toLowerCase();
  const storageMode = process.env.STORAGE_MODE?.toLowerCase();
  if (databaseMode === 'sqlite' && storageMode === 'local' && dbConnected) {
    await databaseBackupService.initialize();
  }
  
  // 获取监听地址
  const host = process.env.HOST || 'localhost';
  const port = parseInt(process.env.PORT || '3001', 10);
  
  app.listen(port, host, () => {
    const storageMode = storageManager.getMode();
    const databaseMode = databaseManager.getMode();
    
    console.log(`🚀 后端服务已启动`);
    console.log(`📍 地址: http://${host}:${port}`);
    if (host === '0.0.0.0') {
      console.log(`🌐 局域网访问: http://<服务器IP>:${port}`);
    }
    console.log(`🌍 环境: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🔗 健康检查: http://localhost:${port}/api/health`);
    console.log(`🗄️  数据库: ${dbConnected ? '已连接' : '未连接'} (${databaseMode})`);
    console.log(`☁️  存储服务: ${storageInitialized ? '已初始化' : '未配置'} (${storageMode})`);
    console.log(`📚 API 文档:`);
    console.log(`   - 图片管理: /api/images`);
    console.log(`   - 配置管理: /api/config`);
    console.log(`   - 数据库: /api/database`);
    console.log(`   - 图片生成: /api/generate`);
    console.log(`   - 参考图片: /api/ref-images`);
    console.log(`   - 项目管理: /api/projects`);
    console.log(`   - 回收站: /api/trash`);
    if (storageMode === 'local') {
      console.log(`   - 静态图片: /api/static-images`);
    }
  });
};

startServer();
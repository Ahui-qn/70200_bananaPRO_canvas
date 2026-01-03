/**
 * 认证中间件
 * 验证请求中的 JWT 令牌，保护需要登录的路由
 * 
 * 需求: 1.4, 5.3
 */

import { Request, Response, NextFunction } from 'express';
import { ApiResponse, UserInfo } from '@shared/types';
import { authService } from '../services/authService.js';
import { userService } from '../services/userService.js';

// 扩展 Express Request 类型，添加 user 属性
declare global {
  namespace Express {
    interface Request {
      user?: UserInfo;
    }
  }
}

/**
 * 认证中间件
 * 验证请求头中的 Bearer 令牌，将用户信息附加到 req.user
 * 
 * 需求: 1.4, 5.3
 */
export const authMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // 从请求头获取令牌
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      const response: ApiResponse = {
        success: false,
        error: '请先登录'
      };
      res.status(401).json(response);
      return;
    }

    const token = authHeader.substring(7); // 移除 "Bearer " 前缀

    // 验证令牌
    const payload = authService.verifyToken(token);
    
    if (!payload) {
      const response: ApiResponse = {
        success: false,
        error: '登录已失效，请重新登录'
      };
      res.status(401).json(response);
      return;
    }

    // 可选：验证用户是否仍然存在且处于活动状态
    // 这会增加数据库查询，但更安全
    try {
      const user = await userService.getUserById(payload.userId);
      
      if (!user) {
        const response: ApiResponse = {
          success: false,
          error: '用户不存在'
        };
        res.status(401).json(response);
        return;
      }

      if (!user.isActive) {
        const response: ApiResponse = {
          success: false,
          error: '账号已被禁用，请联系管理员'
        };
        res.status(403).json(response);
        return;
      }

      // 将用户信息附加到请求对象
      req.user = {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        role: user.role,
        lastLoginAt: user.lastLoginAt
      };
    } catch (dbError) {
      // 如果数据库查询失败，使用令牌中的信息
      console.warn('无法验证用户状态，使用令牌信息:', dbError);
      req.user = {
        id: payload.userId,
        username: payload.username,
        displayName: payload.displayName,
        role: payload.role,
        lastLoginAt: null
      };
    }

    next();
  } catch (error: any) {
    console.error('认证中间件错误:', error);
    const response: ApiResponse = {
      success: false,
      error: '认证失败，请重新登录'
    };
    res.status(401).json(response);
  }
};

/**
 * 可选认证中间件
 * 如果提供了令牌则验证，否则继续处理请求
 * 用于既支持登录用户又支持匿名访问的路由
 */
export const optionalAuthMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      // 没有提供令牌，继续处理请求
      next();
      return;
    }

    const token = authHeader.substring(7);
    const payload = authService.verifyToken(token);
    
    if (payload) {
      // 令牌有效，附加用户信息
      req.user = {
        id: payload.userId,
        username: payload.username,
        displayName: payload.displayName,
        role: payload.role,
        lastLoginAt: null
      };
    }

    next();
  } catch (error) {
    // 忽略错误，继续处理请求
    next();
  }
};

/**
 * 创建认证中间件的工厂函数
 * 允许自定义配置
 */
export const createAuthMiddleware = (options?: {
  skipUserValidation?: boolean;  // 跳过数据库用户验证
}) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authHeader = req.headers.authorization;
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        const response: ApiResponse = {
          success: false,
          error: '请先登录'
        };
        res.status(401).json(response);
        return;
      }

      const token = authHeader.substring(7);
      const payload = authService.verifyToken(token);
      
      if (!payload) {
        const response: ApiResponse = {
          success: false,
          error: '登录已失效，请重新登录'
        };
        res.status(401).json(response);
        return;
      }

      if (options?.skipUserValidation) {
        // 跳过数据库验证，直接使用令牌信息
        req.user = {
          id: payload.userId,
          username: payload.username,
          displayName: payload.displayName,
          role: payload.role,
          lastLoginAt: null
        };
      } else {
        // 验证用户状态
        const user = await userService.getUserById(payload.userId);
        
        if (!user || !user.isActive) {
          const response: ApiResponse = {
            success: false,
            error: user ? '账号已被禁用' : '用户不存在'
          };
          res.status(user ? 403 : 401).json(response);
          return;
        }

        req.user = {
          id: user.id,
          username: user.username,
          displayName: user.displayName,
          role: user.role,
          lastLoginAt: user.lastLoginAt
        };
      }

      next();
    } catch (error: any) {
      console.error('认证中间件错误:', error);
      const response: ApiResponse = {
        success: false,
        error: '认证失败，请重新登录'
      };
      res.status(401).json(response);
    }
  };
};

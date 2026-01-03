/**
 * 认证路由
 * 提供用户登录、令牌验证、退出登录等 API
 * 
 * 需求: 1.1, 1.2, 1.3, 4.4
 */

import express from 'express';
import { ApiResponse, LoginRequest, LoginResponse, UserInfo } from '@shared/types';
import { userService } from '../services/userService.js';
import { authService } from '../services/authService.js';

const router = express.Router();

/**
 * POST /api/auth/login - 用户登录
 * 
 * 需求: 1.1, 1.2, 1.3
 */
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body as LoginRequest;

    // 验证输入
    if (!username || !password) {
      const response: ApiResponse = {
        success: false,
        error: '请输入用户名和密码'
      };
      return res.status(400).json(response);
    }

    // 验证凭据
    const user = await userService.validateCredentials(username, password);
    
    if (!user) {
      const response: ApiResponse = {
        success: false,
        error: '用户名或密码错误'
      };
      return res.status(401).json(response);
    }

    // 检查账号是否启用
    if (!user.isActive) {
      const response: ApiResponse = {
        success: false,
        error: '账号已被禁用，请联系管理员'
      };
      return res.status(403).json(response);
    }

    // 更新最后登录时间
    await userService.updateLastLogin(user.id);

    // 生成令牌
    const token = authService.generateToken(user);

    // 构建用户信息（不包含密码）
    const userInfo: UserInfo = {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      role: user.role,
      lastLoginAt: new Date()
    };

    const response: ApiResponse<LoginResponse> = {
      success: true,
      data: {
        token,
        user: userInfo
      }
    };

    console.log(`用户登录成功: ${username}`);
    res.json(response);

  } catch (error: any) {
    console.error('登录失败:', error);
    const response: ApiResponse = {
      success: false,
      error: '登录失败，请稍后重试'
    };
    res.status(500).json(response);
  }
});

/**
 * GET /api/auth/verify - 验证令牌
 * 
 * 需求: 2.2, 2.3, 2.4
 */
router.get('/verify', async (req, res) => {
  try {
    // 从请求头获取令牌
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      const response: ApiResponse = {
        success: false,
        error: '请先登录'
      };
      return res.status(401).json(response);
    }

    const token = authHeader.substring(7); // 移除 "Bearer " 前缀

    // 验证令牌
    const payload = authService.verifyToken(token);
    
    if (!payload) {
      const response: ApiResponse = {
        success: false,
        error: '登录已失效，请重新登录'
      };
      return res.status(401).json(response);
    }

    // 获取最新的用户信息
    const user = await userService.getUserById(payload.userId);
    
    if (!user) {
      const response: ApiResponse = {
        success: false,
        error: '用户不存在'
      };
      return res.status(401).json(response);
    }

    if (!user.isActive) {
      const response: ApiResponse = {
        success: false,
        error: '账号已被禁用，请联系管理员'
      };
      return res.status(403).json(response);
    }

    // 构建用户信息
    const userInfo: UserInfo = {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      role: user.role,
      lastLoginAt: user.lastLoginAt
    };

    // 检查是否需要刷新令牌
    const refreshedToken = authService.refreshTokenIfNeeded(token);

    const response: ApiResponse<{ user: UserInfo; token?: string }> = {
      success: true,
      data: {
        user: userInfo,
        token: refreshedToken !== token ? refreshedToken || undefined : undefined
      }
    };

    res.json(response);

  } catch (error: any) {
    console.error('令牌验证失败:', error);
    const response: ApiResponse = {
      success: false,
      error: '验证失败，请重新登录'
    };
    res.status(500).json(response);
  }
});

/**
 * POST /api/auth/logout - 退出登录
 * 
 * 需求: 5.1, 5.2, 5.3
 */
router.post('/logout', async (req, res) => {
  try {
    // 从请求头获取令牌（可选，用于记录日志）
    const authHeader = req.headers.authorization;
    let username = 'unknown';

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const payload = authService.verifyToken(token);
      if (payload) {
        username = payload.username;
      }
    }

    console.log(`用户退出登录: ${username}`);

    const response: ApiResponse = {
      success: true,
      message: '退出登录成功'
    };

    res.json(response);

  } catch (error: any) {
    console.error('退出登录失败:', error);
    const response: ApiResponse = {
      success: false,
      error: '退出登录失败'
    };
    res.status(500).json(response);
  }
});

export default router;

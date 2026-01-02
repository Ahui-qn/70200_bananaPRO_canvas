/**
 * 认证中间件属性测试
 * 
 * 使用 fast-check 进行属性测试，验证认证中间件的正确性
 */

import { describe, it, expect, beforeEach } from 'vitest';
import fc from 'fast-check';
import { AuthServiceImpl } from '../services/authService';
import { UserInfo } from '@shared/types';

/**
 * 模拟中间件逻辑（用于测试）
 */
class MockAuthMiddleware {
  private authService: AuthServiceImpl;
  private activeUsers: Set<string> = new Set();

  constructor() {
    this.authService = new AuthServiceImpl('test-secret-key', '7d');
  }

  clear() {
    this.activeUsers.clear();
  }

  addActiveUser(userId: string) {
    this.activeUsers.add(userId);
  }

  removeActiveUser(userId: string) {
    this.activeUsers.delete(userId);
  }

  generateToken(user: UserInfo): string {
    return this.authService.generateToken(user);
  }

  /**
   * 模拟中间件验证逻辑
   */
  async validateRequest(authHeader: string | undefined): Promise<{
    success: boolean;
    statusCode: number;
    error?: string;
    user?: UserInfo;
  }> {
    // 检查是否提供了认证头
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return {
        success: false,
        statusCode: 401,
        error: '请先登录'
      };
    }

    const token = authHeader.substring(7);

    // 验证令牌
    const payload = this.authService.verifyToken(token);
    
    if (!payload) {
      return {
        success: false,
        statusCode: 401,
        error: '登录已失效，请重新登录'
      };
    }

    // 检查用户是否仍然活跃
    if (!this.activeUsers.has(payload.userId)) {
      return {
        success: false,
        statusCode: 401,
        error: '用户不存在或已被禁用'
      };
    }

    return {
      success: true,
      statusCode: 200,
      user: {
        id: payload.userId,
        username: payload.username,
        displayName: payload.displayName,
        lastLoginAt: null
      }
    };
  }
}

describe('认证中间件属性测试', () => {
  let middleware: MockAuthMiddleware;
  
  beforeEach(() => {
    middleware = new MockAuthMiddleware();
  });

  /**
   * **Feature: user-login, Property 3: 未授权访问被拒绝**
   * *对于任意*受保护的 API 端点，在没有有效令牌的情况下访问应返回 401 未授权状态码。
   * **Validates: Requirements 1.4, 5.3**
   */
  describe('属性 3: 未授权访问被拒绝', () => {
    it('没有认证头的请求应返回 401', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constant(undefined),
          async (authHeader) => {
            const result = await middleware.validateRequest(authHeader);
            
            expect(result.success).toBe(false);
            expect(result.statusCode).toBe(401);
            expect(result.error).toBe('请先登录');
            expect(result.user).toBeUndefined();
          }
        ),
        { numRuns: 5 }
      );
    });

    it('空认证头的请求应返回 401', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constant(''),
          async (authHeader) => {
            const result = await middleware.validateRequest(authHeader);
            
            expect(result.success).toBe(false);
            expect(result.statusCode).toBe(401);
            expect(result.error).toBe('请先登录');
          }
        ),
        { numRuns: 5 }
      );
    });

    it('无效格式的认证头应返回 401', async () => {
      await fc.assert(
        fc.asyncProperty(
          // 生成不以 "Bearer " 开头的字符串
          fc.string({ minLength: 1, maxLength: 100 }).filter(s => !s.startsWith('Bearer ')),
          async (authHeader) => {
            const result = await middleware.validateRequest(authHeader);
            
            expect(result.success).toBe(false);
            expect(result.statusCode).toBe(401);
            expect(result.error).toBe('请先登录');
          }
        ),
        { numRuns: 20 }
      );
    });

    it('无效令牌应返回 401', async () => {
      await fc.assert(
        fc.asyncProperty(
          // 生成随机的无效令牌
          fc.string({ minLength: 1, maxLength: 100 }),
          async (invalidToken) => {
            const authHeader = `Bearer ${invalidToken}`;
            const result = await middleware.validateRequest(authHeader);
            
            expect(result.success).toBe(false);
            expect(result.statusCode).toBe(401);
            expect(result.error).toBe('登录已失效，请重新登录');
          }
        ),
        { numRuns: 20 }
      );
    });

    it('已禁用用户的有效令牌应返回 401', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(),
          fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9]{2,19}$/),
          fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
          async (userId, username, displayName) => {
            middleware.clear();
            
            // 创建用户但不添加到活跃用户列表
            const user: UserInfo = {
              id: userId,
              username,
              displayName: displayName.trim(),
              lastLoginAt: null
            };
            
            const token = middleware.generateToken(user);
            const authHeader = `Bearer ${token}`;
            
            const result = await middleware.validateRequest(authHeader);
            
            expect(result.success).toBe(false);
            expect(result.statusCode).toBe(401);
            expect(result.error).toBe('用户不存在或已被禁用');
          }
        ),
        { numRuns: 10 }
      );
    });

    it('有效令牌和活跃用户应返回成功', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(),
          fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9]{2,19}$/),
          fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
          async (userId, username, displayName) => {
            middleware.clear();
            
            // 创建用户并添加到活跃用户列表
            const user: UserInfo = {
              id: userId,
              username,
              displayName: displayName.trim(),
              lastLoginAt: null
            };
            
            middleware.addActiveUser(userId);
            
            const token = middleware.generateToken(user);
            const authHeader = `Bearer ${token}`;
            
            const result = await middleware.validateRequest(authHeader);
            
            expect(result.success).toBe(true);
            expect(result.statusCode).toBe(200);
            expect(result.user).toBeDefined();
            expect(result.user?.id).toBe(userId);
            expect(result.user?.username).toBe(username);
          }
        ),
        { numRuns: 15 }
      );
    });
  });
});

describe('认证中间件单元测试', () => {
  let middleware: MockAuthMiddleware;
  
  beforeEach(() => {
    middleware = new MockAuthMiddleware();
  });

  describe('validateRequest', () => {
    it('应该验证有效的令牌和活跃用户', async () => {
      const user: UserInfo = {
        id: 'user-123',
        username: 'testuser',
        displayName: '测试用户',
        lastLoginAt: null
      };
      
      middleware.addActiveUser('user-123');
      const token = middleware.generateToken(user);
      
      const result = await middleware.validateRequest(`Bearer ${token}`);
      
      expect(result.success).toBe(true);
      expect(result.user?.id).toBe('user-123');
    });

    it('应该拒绝没有认证头的请求', async () => {
      const result = await middleware.validateRequest(undefined);
      
      expect(result.success).toBe(false);
      expect(result.statusCode).toBe(401);
    });

    it('应该拒绝无效的令牌', async () => {
      const result = await middleware.validateRequest('Bearer invalid-token');
      
      expect(result.success).toBe(false);
      expect(result.statusCode).toBe(401);
    });

    it('应该拒绝已禁用用户的令牌', async () => {
      const user: UserInfo = {
        id: 'user-456',
        username: 'disableduser',
        displayName: '禁用用户',
        lastLoginAt: null
      };
      
      // 不添加到活跃用户列表
      const token = middleware.generateToken(user);
      
      const result = await middleware.validateRequest(`Bearer ${token}`);
      
      expect(result.success).toBe(false);
      expect(result.statusCode).toBe(401);
    });
  });
});

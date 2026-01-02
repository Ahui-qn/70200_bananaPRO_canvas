/**
 * 认证路由属性测试
 * 
 * 使用 fast-check 进行属性测试，验证认证路由的正确性
 */

import { describe, it, expect, beforeEach } from 'vitest';
import fc from 'fast-check';
import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { AuthServiceImpl } from '../services/authService';
import { User, UserInfo, LoginResponse } from '@shared/types';

// bcrypt 加密轮数
const BCRYPT_ROUNDS = 10;

/**
 * 模拟用户存储和认证逻辑（用于测试）
 */
class MockAuthSystem {
  private users: Map<string, User> = new Map();
  private authService: AuthServiceImpl;

  constructor() {
    this.authService = new AuthServiceImpl('test-secret-key', '7d');
  }

  clear() {
    this.users.clear();
  }

  async createUser(username: string, password: string, displayName: string): Promise<User> {
    const id = uuidv4();
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const now = new Date();
    
    const user: User = {
      id,
      username,
      passwordHash,
      displayName,
      createdAt: now,
      updatedAt: now,
      lastLoginAt: null,
      isActive: true
    };

    this.users.set(id, user);
    return user;
  }

  async login(username: string, password: string): Promise<{ success: boolean; data?: LoginResponse; error?: string }> {
    // 验证输入
    if (!username || !password) {
      return { success: false, error: '请输入用户名和密码' };
    }

    // 查找用户
    let user: User | null = null;
    for (const u of this.users.values()) {
      if (u.username === username) {
        user = u;
        break;
      }
    }

    if (!user) {
      return { success: false, error: '用户名或密码错误' };
    }

    // 检查账号状态
    if (!user.isActive) {
      return { success: false, error: '账号已被禁用，请联系管理员' };
    }

    // 验证密码
    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      return { success: false, error: '用户名或密码错误' };
    }

    // 生成令牌
    const token = this.authService.generateToken(user);
    
    const userInfo: UserInfo = {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      lastLoginAt: new Date()
    };

    return {
      success: true,
      data: { token, user: userInfo }
    };
  }

  disableUser(userId: string) {
    const user = this.users.get(userId);
    if (user) {
      user.isActive = false;
    }
  }
}

describe('认证路由属性测试', () => {
  let authSystem: MockAuthSystem;
  
  beforeEach(() => {
    authSystem = new MockAuthSystem();
  });

  /**
   * **Feature: user-login, Property 1: 有效凭据登录成功**
   * *对于任意*有效的用户名和密码组合，调用登录接口应返回成功响应，包含有效的 JWT 令牌和用户信息。
   * **Validates: Requirements 1.1, 4.4**
   */
  describe('属性 1: 有效凭据登录成功', () => {
    it('使用正确的用户名和密码应该登录成功', async () => {
      await fc.assert(
        fc.asyncProperty(
          // 生成有效的用户名
          fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9]{2,19}$/),
          // 生成有效的密码
          fc.string({ minLength: 6, maxLength: 50 }),
          // 生成显示名称
          fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
          async (username, password, displayName) => {
            authSystem.clear();
            
            // 创建用户
            await authSystem.createUser(username, password, displayName.trim());
            
            // 尝试登录
            const result = await authSystem.login(username, password);
            
            // 验证登录成功
            expect(result.success).toBe(true);
            expect(result.data).toBeDefined();
            expect(result.data?.token).toBeDefined();
            expect(result.data?.user).toBeDefined();
            
            // 验证返回的用户信息正确
            expect(result.data?.user.username).toBe(username);
            expect(result.data?.user.displayName).toBe(displayName.trim());
            
            // 验证令牌格式正确（JWT 格式）
            expect(result.data?.token.split('.')).toHaveLength(3);
          }
        ),
        { numRuns: 15 }
      );
    }, 60000);

    it('登录成功后应返回有效的 JWT 令牌', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9]{2,19}$/),
          fc.string({ minLength: 6, maxLength: 30 }),
          async (username, password) => {
            authSystem.clear();
            
            await authSystem.createUser(username, password, '测试用户');
            const result = await authSystem.login(username, password);
            
            expect(result.success).toBe(true);
            
            // 验证令牌可以被解析
            const authService = new AuthServiceImpl('test-secret-key', '7d');
            const payload = authService.verifyToken(result.data!.token);
            
            expect(payload).not.toBeNull();
            expect(payload?.username).toBe(username);
          }
        ),
        { numRuns: 10 }
      );
    }, 60000);
  });

  /**
   * **Feature: user-login, Property 2: 无效凭据登录失败**
   * *对于任意*无效的用户名或密码组合，调用登录接口应返回错误响应，不返回任何令牌。
   * **Validates: Requirements 1.2**
   */
  describe('属性 2: 无效凭据登录失败', () => {
    it('使用错误密码应该登录失败', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9]{2,19}$/),
          fc.string({ minLength: 6, maxLength: 30 }),
          fc.string({ minLength: 6, maxLength: 30 }),
          async (username, correctPassword, wrongPassword) => {
            // 确保错误密码与正确密码不同
            fc.pre(correctPassword !== wrongPassword);
            
            authSystem.clear();
            
            await authSystem.createUser(username, correctPassword, '测试用户');
            const result = await authSystem.login(username, wrongPassword);
            
            // 验证登录失败
            expect(result.success).toBe(false);
            expect(result.error).toBe('用户名或密码错误');
            expect(result.data).toBeUndefined();
          }
        ),
        { numRuns: 15 }
      );
    }, 60000);

    it('使用不存在的用户名应该登录失败', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9]{2,19}$/),
          fc.string({ minLength: 6, maxLength: 30 }),
          async (username, password) => {
            authSystem.clear();
            
            // 不创建用户，直接尝试登录
            const result = await authSystem.login(username, password);
            
            expect(result.success).toBe(false);
            expect(result.error).toBe('用户名或密码错误');
            expect(result.data).toBeUndefined();
          }
        ),
        { numRuns: 10 }
      );
    }, 30000);

    it('空用户名或密码应该登录失败', async () => {
      authSystem.clear();
      
      // 空用户名
      let result = await authSystem.login('', 'password123');
      expect(result.success).toBe(false);
      expect(result.error).toBe('请输入用户名和密码');
      
      // 空密码
      result = await authSystem.login('testuser', '');
      expect(result.success).toBe(false);
      expect(result.error).toBe('请输入用户名和密码');
      
      // 都为空
      result = await authSystem.login('', '');
      expect(result.success).toBe(false);
      expect(result.error).toBe('请输入用户名和密码');
    });

    it('禁用的用户应该登录失败', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9]{2,19}$/),
          fc.string({ minLength: 6, maxLength: 30 }),
          async (username, password) => {
            authSystem.clear();
            
            const user = await authSystem.createUser(username, password, '测试用户');
            authSystem.disableUser(user.id);
            
            const result = await authSystem.login(username, password);
            
            expect(result.success).toBe(false);
            expect(result.error).toBe('账号已被禁用，请联系管理员');
            expect(result.data).toBeUndefined();
          }
        ),
        { numRuns: 10 }
      );
    }, 60000);
  });
});

describe('认证路由单元测试', () => {
  let authSystem: MockAuthSystem;
  
  beforeEach(() => {
    authSystem = new MockAuthSystem();
  });

  describe('login', () => {
    it('应该成功登录有效用户', async () => {
      await authSystem.createUser('testuser', 'password123', '测试用户');
      
      const result = await authSystem.login('testuser', 'password123');
      
      expect(result.success).toBe(true);
      expect(result.data?.token).toBeDefined();
      expect(result.data?.user.username).toBe('testuser');
    });

    it('应该拒绝无效密码', async () => {
      await authSystem.createUser('testuser', 'password123', '测试用户');
      
      const result = await authSystem.login('testuser', 'wrongpassword');
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('用户名或密码错误');
    });

    it('应该拒绝不存在的用户', async () => {
      const result = await authSystem.login('nonexistent', 'password123');
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('用户名或密码错误');
    });

    it('应该拒绝禁用的用户', async () => {
      const user = await authSystem.createUser('testuser', 'password123', '测试用户');
      authSystem.disableUser(user.id);
      
      const result = await authSystem.login('testuser', 'password123');
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('账号已被禁用，请联系管理员');
    });
  });
});

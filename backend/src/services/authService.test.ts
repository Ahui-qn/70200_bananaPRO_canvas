/**
 * 认证服务属性测试
 * 
 * 使用 fast-check 进行属性测试，验证认证服务的正确性
 */

import { describe, it, expect, beforeEach } from 'vitest';
import fc from 'fast-check';
import jwt from 'jsonwebtoken';
import { AuthServiceImpl } from './authService';
import { UserInfo } from '@shared/types';

describe('AuthService 属性测试', () => {
  let authService: AuthServiceImpl;
  const testSecret = 'test-secret-key-for-testing-purposes-only';
  
  beforeEach(() => {
    authService = new AuthServiceImpl(testSecret, '7d');
  });

  /**
   * **Feature: user-login, Property 4: 有效令牌验证成功**
   * *对于任意*有效且未过期的 JWT 令牌，调用验证接口应返回正确的用户信息。
   * **Validates: Requirements 2.2, 2.3**
   */
  describe('属性 4: 有效令牌验证成功', () => {
    it('生成的令牌应能被成功验证并返回正确的用户信息', async () => {
      await fc.assert(
        fc.asyncProperty(
          // 生成用户 ID（UUID 格式）
          fc.uuid(),
          // 生成用户名
          fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9]{2,19}$/),
          // 生成显示名称
          fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
          async (userId, username, displayName) => {
            const user: UserInfo = {
              id: userId,
              username,
              displayName: displayName.trim(),
              lastLoginAt: null
            };

            // 生成令牌
            const token = authService.generateToken(user);
            
            // 验证令牌
            const payload = authService.verifyToken(token);
            
            // 验证返回的载荷包含正确的用户信息
            expect(payload).not.toBeNull();
            expect(payload?.userId).toBe(userId);
            expect(payload?.username).toBe(username);
            expect(payload?.displayName).toBe(displayName.trim());
            
            // 验证令牌包含过期时间
            expect(payload?.exp).toBeDefined();
            expect(payload?.iat).toBeDefined();
          }
        ),
        { numRuns: 20 }
      );
    }, 30000);

    it('getUserFromToken 应返回正确的用户信息', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(),
          fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9]{2,19}$/),
          fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
          async (userId, username, displayName) => {
            const user: UserInfo = {
              id: userId,
              username,
              displayName: displayName.trim(),
              lastLoginAt: new Date()
            };

            const token = authService.generateToken(user);
            const extractedUser = authService.getUserFromToken(token);
            
            expect(extractedUser).not.toBeNull();
            expect(extractedUser?.id).toBe(userId);
            expect(extractedUser?.username).toBe(username);
            expect(extractedUser?.displayName).toBe(displayName.trim());
          }
        ),
        { numRuns: 20 }
      );
    }, 30000);
  });

  /**
   * **Feature: user-login, Property 5: 过期或无效令牌被拒绝**
   * *对于任意*过期或格式无效的令牌，调用验证接口应返回错误响应。
   * **Validates: Requirements 2.4**
   */
  describe('属性 5: 过期或无效令牌被拒绝', () => {
    it('过期的令牌应返回 null', async () => {
      // 创建一个过期时间为 -1 秒的服务（立即过期）
      const expiredAuthService = new AuthServiceImpl(testSecret, '-1s');
      
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(),
          fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9]{2,19}$/),
          async (userId, username) => {
            const user: UserInfo = {
              id: userId,
              username,
              displayName: '测试用户',
              lastLoginAt: null
            };

            // 生成立即过期的令牌
            const token = expiredAuthService.generateToken(user);
            
            // 等待一小段时间确保令牌过期
            await new Promise(resolve => setTimeout(resolve, 100));
            
            // 验证令牌应返回 null
            const payload = expiredAuthService.verifyToken(token);
            expect(payload).toBeNull();
          }
        ),
        { numRuns: 5 }
      );
    }, 30000);

    it('格式无效的令牌应返回 null', async () => {
      await fc.assert(
        fc.asyncProperty(
          // 生成随机字符串作为无效令牌
          fc.string({ minLength: 1, maxLength: 100 }),
          async (invalidToken) => {
            // 跳过可能意外有效的 JWT 格式
            fc.pre(!invalidToken.includes('.') || invalidToken.split('.').length !== 3);
            
            const payload = authService.verifyToken(invalidToken);
            expect(payload).toBeNull();
          }
        ),
        { numRuns: 20 }
      );
    }, 30000);

    it('使用错误密钥签名的令牌应返回 null', async () => {
      const wrongKeyService = new AuthServiceImpl('wrong-secret-key', '7d');
      
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(),
          fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9]{2,19}$/),
          async (userId, username) => {
            const user: UserInfo = {
              id: userId,
              username,
              displayName: '测试用户',
              lastLoginAt: null
            };

            // 使用错误密钥生成令牌
            const token = wrongKeyService.generateToken(user);
            
            // 使用正确密钥验证应失败
            const payload = authService.verifyToken(token);
            expect(payload).toBeNull();
          }
        ),
        { numRuns: 10 }
      );
    }, 30000);

    it('空令牌应返回 null', () => {
      expect(authService.verifyToken('')).toBeNull();
      expect(authService.verifyToken(null as any)).toBeNull();
      expect(authService.verifyToken(undefined as any)).toBeNull();
    });

    it('被篡改的令牌应返回 null', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(),
          fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9]{2,19}$/),
          fc.integer({ min: 0, max: 100 }),
          async (userId, username, tamperPosition) => {
            const user: UserInfo = {
              id: userId,
              username,
              displayName: '测试用户',
              lastLoginAt: null
            };

            const token = authService.generateToken(user);
            
            // 篡改令牌
            const chars = token.split('');
            const pos = tamperPosition % chars.length;
            chars[pos] = chars[pos] === 'a' ? 'b' : 'a';
            const tamperedToken = chars.join('');
            
            // 如果篡改后的令牌与原令牌不同，验证应失败
            if (tamperedToken !== token) {
              const payload = authService.verifyToken(tamperedToken);
              expect(payload).toBeNull();
            }
          }
        ),
        { numRuns: 15 }
      );
    }, 30000);
  });
});

describe('AuthService 单元测试', () => {
  let authService: AuthServiceImpl;
  const testSecret = 'test-secret-key-for-unit-tests';
  
  beforeEach(() => {
    authService = new AuthServiceImpl(testSecret, '7d');
  });

  describe('generateToken', () => {
    it('应该生成有效的 JWT 令牌', () => {
      const user: UserInfo = {
        id: 'user-123',
        username: 'testuser',
        displayName: '测试用户',
        lastLoginAt: null
      };

      const token = authService.generateToken(user);
      
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3); // JWT 格式：header.payload.signature
    });

    it('生成的令牌应包含正确的载荷', () => {
      const user: UserInfo = {
        id: 'user-456',
        username: 'anotheruser',
        displayName: '另一个用户',
        lastLoginAt: new Date()
      };

      const token = authService.generateToken(user);
      const decoded = jwt.decode(token) as any;
      
      expect(decoded.userId).toBe('user-456');
      expect(decoded.username).toBe('anotheruser');
      expect(decoded.displayName).toBe('另一个用户');
    });
  });

  describe('verifyToken', () => {
    it('应该验证有效令牌', () => {
      const user: UserInfo = {
        id: 'user-789',
        username: 'validuser',
        displayName: '有效用户',
        lastLoginAt: null
      };

      const token = authService.generateToken(user);
      const payload = authService.verifyToken(token);
      
      expect(payload).not.toBeNull();
      expect(payload?.userId).toBe('user-789');
    });

    it('应该拒绝无效令牌', () => {
      const payload = authService.verifyToken('invalid-token');
      expect(payload).toBeNull();
    });
  });

  describe('isTokenExpiringSoon', () => {
    it('新生成的令牌不应该即将过期', () => {
      const user: UserInfo = {
        id: 'user-123',
        username: 'testuser',
        displayName: '测试用户',
        lastLoginAt: null
      };

      const token = authService.generateToken(user);
      const isExpiringSoon = authService.isTokenExpiringSoon(token);
      
      expect(isExpiringSoon).toBe(false);
    });

    it('即将过期的令牌应该返回 true', () => {
      // 创建一个 12 小时过期的服务
      const shortLivedService = new AuthServiceImpl(testSecret, '12h');
      
      const user: UserInfo = {
        id: 'user-123',
        username: 'testuser',
        displayName: '测试用户',
        lastLoginAt: null
      };

      const token = shortLivedService.generateToken(user);
      const isExpiringSoon = shortLivedService.isTokenExpiringSoon(token);
      
      expect(isExpiringSoon).toBe(true);
    });
  });

  describe('refreshTokenIfNeeded', () => {
    it('不需要刷新的令牌应返回原令牌', () => {
      const user: UserInfo = {
        id: 'user-123',
        username: 'testuser',
        displayName: '测试用户',
        lastLoginAt: null
      };

      const token = authService.generateToken(user);
      const refreshedToken = authService.refreshTokenIfNeeded(token);
      
      expect(refreshedToken).toBe(token);
    });

    it('无效令牌应返回 null', () => {
      const refreshedToken = authService.refreshTokenIfNeeded('invalid-token');
      expect(refreshedToken).toBeNull();
    });
  });
});

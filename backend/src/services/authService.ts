/**
 * 认证服务
 * 提供 JWT 令牌生成和验证功能
 * 
 * 需求: 2.1, 2.2, 2.3, 2.4
 */

import jwt from 'jsonwebtoken';
import { TokenPayload, UserInfo, User } from '@shared/types';

// 从环境变量获取 JWT 密钥，如果未设置则使用默认值（仅用于开发）
const JWT_SECRET = process.env.JWT_SECRET || 'default-jwt-secret-for-development-only';

// 令牌过期时间：7 天
const TOKEN_EXPIRES_IN = '7d';

/**
 * 认证服务接口
 */
export interface AuthService {
  // 生成 JWT 令牌
  generateToken(user: User | UserInfo): string;
  
  // 验证 JWT 令牌
  verifyToken(token: string): TokenPayload | null;
  
  // 从令牌中提取用户信息
  getUserFromToken(token: string): UserInfo | null;
}

/**
 * 认证服务实现类
 */
export class AuthServiceImpl implements AuthService {
  private readonly secret: string;
  private readonly expiresIn: string;

  constructor(secret?: string, expiresIn?: string) {
    this.secret = secret || JWT_SECRET;
    this.expiresIn = expiresIn || TOKEN_EXPIRES_IN;
  }

  /**
   * 生成 JWT 令牌
   * 
   * @param user 用户信息
   * @returns JWT 令牌字符串
   * 
   * 需求: 2.1
   */
  generateToken(user: User | UserInfo): string {
    const payload = {
      userId: user.id,
      username: user.username,
      displayName: user.displayName
    };

    return jwt.sign(payload, this.secret, {
      expiresIn: this.expiresIn
    });
  }

  /**
   * 验证 JWT 令牌
   * 
   * @param token JWT 令牌字符串
   * @returns 令牌载荷或 null（如果无效）
   * 
   * 需求: 2.2, 2.3, 2.4
   */
  verifyToken(token: string): TokenPayload | null {
    if (!token) {
      return null;
    }

    try {
      const decoded = jwt.verify(token, this.secret) as TokenPayload;
      return decoded;
    } catch (error: any) {
      // 令牌无效或已过期
      if (error.name === 'TokenExpiredError') {
        console.log('令牌已过期');
      } else if (error.name === 'JsonWebTokenError') {
        console.log('令牌无效:', error.message);
      }
      return null;
    }
  }

  /**
   * 从令牌中提取用户信息
   * 
   * @param token JWT 令牌字符串
   * @returns 用户信息或 null
   */
  getUserFromToken(token: string): UserInfo | null {
    const payload = this.verifyToken(token);
    if (!payload) {
      return null;
    }

    return {
      id: payload.userId,
      username: payload.username,
      displayName: payload.displayName,
      lastLoginAt: null // 从令牌中无法获取最后登录时间
    };
  }

  /**
   * 检查令牌是否即将过期（24小时内）
   * 
   * @param token JWT 令牌字符串
   * @returns 是否即将过期
   */
  isTokenExpiringSoon(token: string): boolean {
    const payload = this.verifyToken(token);
    if (!payload || !payload.exp) {
      return true;
    }

    const now = Math.floor(Date.now() / 1000);
    const timeUntilExpiry = payload.exp - now;
    const oneDayInSeconds = 24 * 60 * 60;

    return timeUntilExpiry < oneDayInSeconds;
  }

  /**
   * 刷新令牌（如果即将过期）
   * 
   * @param token 当前令牌
   * @returns 新令牌或 null（如果当前令牌无效）
   */
  refreshTokenIfNeeded(token: string): string | null {
    const payload = this.verifyToken(token);
    if (!payload) {
      return null;
    }

    if (this.isTokenExpiringSoon(token)) {
      // 生成新令牌
      return this.generateToken({
        id: payload.userId,
        username: payload.username,
        displayName: payload.displayName,
        lastLoginAt: null
      });
    }

    return token;
  }
}

// 导出单例实例
export const authService = new AuthServiceImpl();

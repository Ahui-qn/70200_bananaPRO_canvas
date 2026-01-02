/**
 * 用户服务
 * 提供用户创建、验证、查询等功能
 * 
 * 需求: 3.1, 3.3, 3.4, 4.1
 */

import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { User, UserInfo } from '@shared/types';
import { databaseService } from './databaseService.js';
import { TABLE_NAMES } from '../config/constants.js';

// bcrypt 加密轮数（cost factor）
const BCRYPT_ROUNDS = 10;

/**
 * 用户服务接口
 */
export interface UserService {
  // 创建用户（管理员使用）
  createUser(username: string, password: string, displayName: string): Promise<User>;
  
  // 验证用户凭据
  validateCredentials(username: string, password: string): Promise<User | null>;
  
  // 根据 ID 获取用户
  getUserById(id: string): Promise<User | null>;
  
  // 根据用户名获取用户
  getUserByUsername(username: string): Promise<User | null>;
  
  // 获取所有用户列表（不包含密码）
  listUsers(): Promise<UserInfo[]>;
  
  // 更新最后登录时间
  updateLastLogin(userId: string): Promise<void>;
  
  // 禁用用户
  disableUser(userId: string): Promise<void>;
  
  // 启用用户
  enableUser(userId: string): Promise<void>;
}

/**
 * 用户服务实现类
 */
export class UserServiceImpl implements UserService {
  /**
   * 创建新用户
   * 
   * @param username 用户名
   * @param password 明文密码
   * @param displayName 显示名称
   * @returns 创建的用户对象
   * @throws 如果用户名已存在或创建失败
   * 
   * 需求: 3.1, 3.3, 4.1
   */
  async createUser(username: string, password: string, displayName: string): Promise<User> {
    // 验证输入
    if (!username || username.trim() === '') {
      throw new Error('用户名不能为空');
    }
    if (!password || password.length < 6) {
      throw new Error('密码长度不能少于6位');
    }
    if (!displayName || displayName.trim() === '') {
      throw new Error('显示名称不能为空');
    }

    // 检查用户名是否已存在
    const existingUser = await this.getUserByUsername(username.trim());
    if (existingUser) {
      throw new Error('用户名已存在');
    }

    // 生成唯一 ID
    const id = uuidv4();
    
    // 使用 bcrypt 加密密码（需求 3.3）
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    
    const now = new Date();
    
    // 构建用户对象
    const user: User = {
      id,
      username: username.trim(),
      passwordHash,
      displayName: displayName.trim(),
      createdAt: now,
      updatedAt: now,
      lastLoginAt: null,
      isActive: true
    };

    // 保存到数据库
    const connection = databaseService.getConnection();
    if (!connection) {
      throw new Error('数据库未连接');
    }

    const sql = `
      INSERT INTO ${TABLE_NAMES.USERS} (
        id, username, password_hash, display_name, 
        created_at, updated_at, last_login_at, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;

    await connection.execute(sql, [
      user.id,
      user.username,
      user.passwordHash,
      user.displayName,
      user.createdAt,
      user.updatedAt,
      user.lastLoginAt,
      user.isActive
    ]);

    console.log(`用户创建成功: ${user.username} (${user.id})`);
    return user;
  }

  /**
   * 验证用户凭据
   * 
   * @param username 用户名
   * @param password 明文密码
   * @returns 验证成功返回用户对象，失败返回 null
   * 
   * 需求: 1.1, 1.2
   */
  async validateCredentials(username: string, password: string): Promise<User | null> {
    if (!username || !password) {
      return null;
    }

    // 获取用户
    const user = await this.getUserByUsername(username);
    if (!user) {
      return null;
    }

    // 检查账号是否启用
    if (!user.isActive) {
      return null;
    }

    // 验证密码
    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      return null;
    }

    return user;
  }

  /**
   * 根据 ID 获取用户
   * 
   * @param id 用户 ID
   * @returns 用户对象或 null
   */
  async getUserById(id: string): Promise<User | null> {
    const connection = databaseService.getConnection();
    if (!connection) {
      throw new Error('数据库未连接');
    }

    const sql = `SELECT * FROM ${TABLE_NAMES.USERS} WHERE id = ?`;
    const [rows] = await connection.execute(sql, [id]);
    
    if ((rows as any[]).length === 0) {
      return null;
    }

    return this.rowToUser((rows as any[])[0]);
  }

  /**
   * 根据用户名获取用户
   * 
   * @param username 用户名
   * @returns 用户对象或 null
   */
  async getUserByUsername(username: string): Promise<User | null> {
    const connection = databaseService.getConnection();
    if (!connection) {
      throw new Error('数据库未连接');
    }

    const sql = `SELECT * FROM ${TABLE_NAMES.USERS} WHERE username = ?`;
    const [rows] = await connection.execute(sql, [username]);
    
    if ((rows as any[]).length === 0) {
      return null;
    }

    return this.rowToUser((rows as any[])[0]);
  }

  /**
   * 获取所有用户列表（不包含密码）
   * 
   * @returns 用户信息列表
   * 
   * 需求: 3.4
   */
  async listUsers(): Promise<UserInfo[]> {
    const connection = databaseService.getConnection();
    if (!connection) {
      throw new Error('数据库未连接');
    }

    // 只查询公开字段，不包含 password_hash
    const sql = `
      SELECT id, username, display_name, last_login_at 
      FROM ${TABLE_NAMES.USERS} 
      ORDER BY created_at DESC
    `;
    const [rows] = await connection.execute(sql);
    
    return (rows as any[]).map(row => this.rowToUserInfo(row));
  }

  /**
   * 更新用户最后登录时间
   * 
   * @param userId 用户 ID
   */
  async updateLastLogin(userId: string): Promise<void> {
    const connection = databaseService.getConnection();
    if (!connection) {
      throw new Error('数据库未连接');
    }

    const sql = `
      UPDATE ${TABLE_NAMES.USERS} 
      SET last_login_at = ? 
      WHERE id = ?
    `;
    await connection.execute(sql, [new Date(), userId]);
  }

  /**
   * 禁用用户
   * 
   * @param userId 用户 ID
   */
  async disableUser(userId: string): Promise<void> {
    const connection = databaseService.getConnection();
    if (!connection) {
      throw new Error('数据库未连接');
    }

    const sql = `
      UPDATE ${TABLE_NAMES.USERS} 
      SET is_active = FALSE, updated_at = ? 
      WHERE id = ?
    `;
    const [result] = await connection.execute(sql, [new Date(), userId]);
    
    if ((result as any).affectedRows === 0) {
      throw new Error('用户不存在');
    }

    console.log(`用户已禁用: ${userId}`);
  }

  /**
   * 启用用户
   * 
   * @param userId 用户 ID
   */
  async enableUser(userId: string): Promise<void> {
    const connection = databaseService.getConnection();
    if (!connection) {
      throw new Error('数据库未连接');
    }

    const sql = `
      UPDATE ${TABLE_NAMES.USERS} 
      SET is_active = TRUE, updated_at = ? 
      WHERE id = ?
    `;
    const [result] = await connection.execute(sql, [new Date(), userId]);
    
    if ((result as any).affectedRows === 0) {
      throw new Error('用户不存在');
    }

    console.log(`用户已启用: ${userId}`);
  }

  /**
   * 将数据库行转换为 User 对象
   * @private
   */
  private rowToUser(row: any): User {
    return {
      id: row.id,
      username: row.username,
      passwordHash: row.password_hash,
      displayName: row.display_name,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      lastLoginAt: row.last_login_at ? new Date(row.last_login_at) : null,
      isActive: Boolean(row.is_active)
    };
  }

  /**
   * 将数据库行转换为 UserInfo 对象（不包含密码）
   * @private
   */
  private rowToUserInfo(row: any): UserInfo {
    return {
      id: row.id,
      username: row.username,
      displayName: row.display_name,
      lastLoginAt: row.last_login_at ? new Date(row.last_login_at) : null
    };
  }
}

// 导出单例实例
export const userService = new UserServiceImpl();

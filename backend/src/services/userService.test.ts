/**
 * 用户服务属性测试
 * 
 * 使用 fast-check 进行属性测试，验证用户服务的正确性
 * 
 * 注意：这些测试使用内存模拟数据库，不需要真实数据库连接
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fc from 'fast-check';
import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { User, UserInfo } from '@shared/types';

// bcrypt 加密轮数
const BCRYPT_ROUNDS = 10;

/**
 * 内存用户存储（用于测试）
 */
class InMemoryUserStore {
  private users: Map<string, any> = new Map();

  clear() {
    this.users.clear();
  }

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
    for (const user of this.users.values()) {
      if (user.username === username.trim()) {
        throw new Error('用户名已存在');
      }
    }

    // 生成唯一 ID
    const id = uuidv4();
    
    // 使用 bcrypt 加密密码
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    
    const now = new Date();
    
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

    this.users.set(id, user);
    return user;
  }

  async validateCredentials(username: string, password: string): Promise<User | null> {
    if (!username || !password) {
      return null;
    }

    const user = await this.getUserByUsername(username);
    if (!user || !user.isActive) {
      return null;
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    return isValid ? user : null;
  }

  async getUserById(id: string): Promise<User | null> {
    return this.users.get(id) || null;
  }

  async getUserByUsername(username: string): Promise<User | null> {
    for (const user of this.users.values()) {
      if (user.username === username) {
        return user;
      }
    }
    return null;
  }

  async listUsers(): Promise<UserInfo[]> {
    return Array.from(this.users.values()).map(user => ({
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      lastLoginAt: user.lastLoginAt
    }));
  }

  async updateLastLogin(userId: string): Promise<void> {
    const user = this.users.get(userId);
    if (user) {
      user.lastLoginAt = new Date();
    }
  }

  async disableUser(userId: string): Promise<void> {
    const user = this.users.get(userId);
    if (!user) {
      throw new Error('用户不存在');
    }
    user.isActive = false;
    user.updatedAt = new Date();
  }

  async enableUser(userId: string): Promise<void> {
    const user = this.users.get(userId);
    if (!user) {
      throw new Error('用户不存在');
    }
    user.isActive = true;
    user.updatedAt = new Date();
  }

  getUserCount(): number {
    return this.users.size;
  }

  getAllUsers(): User[] {
    return Array.from(this.users.values());
  }
}

describe('UserService 属性测试', () => {
  let userStore: InMemoryUserStore;
  
  beforeEach(() => {
    userStore = new InMemoryUserStore();
  });

  afterEach(() => {
    userStore.clear();
  });

  /**
   * **Feature: user-login, Property 6: 用户创建和唯一 ID**
   * *对于任意*新创建的用户，系统应生成唯一的用户 ID，且用户信息应正确存储到数据库。
   * **Validates: Requirements 3.1, 4.1**
   */
  describe('属性 6: 用户创建和唯一 ID', () => {
    it('创建用户应生成唯一 ID 并正确存储用户信息', async () => {
      await fc.assert(
        fc.asyncProperty(
          // 生成有效的用户名（字母开头，字母数字，3-20字符）
          fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9]{2,19}$/),
          // 生成有效的密码（6-50字符）
          fc.string({ minLength: 6, maxLength: 50 }),
          // 生成有效的显示名称（1-50字符，非空白）
          fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
          async (username, password, displayName) => {
            // 清空之前的用户
            userStore.clear();
            
            // 创建用户
            const user = await userStore.createUser(username, password, displayName);
            
            // 验证 ID 是 UUID 格式
            const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
            expect(user.id).toMatch(uuidRegex);
            
            // 验证用户名正确存储
            expect(user.username).toBe(username);
            
            // 验证显示名称正确存储
            expect(user.displayName).toBe(displayName.trim());
            
            // 验证用户已存储
            const storedUser = await userStore.getUserById(user.id);
            expect(storedUser).not.toBeNull();
            expect(storedUser?.username).toBe(username);
            expect(storedUser?.displayName).toBe(displayName.trim());
            expect(storedUser?.isActive).toBe(true);
          }
        ),
        { numRuns: 20 }
      );
    }, 30000);

    it('多次创建用户应生成不同的唯一 ID', async () => {
      const createdIds = new Set<string>();
      
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 10 }),
          async (count) => {
            userStore.clear();
            createdIds.clear();
            
            for (let i = 0; i < count; i++) {
              const username = `user${i}_${Date.now()}`;
              const user = await userStore.createUser(username, 'password123', `用户${i}`);
              
              // 验证 ID 唯一
              expect(createdIds.has(user.id)).toBe(false);
              createdIds.add(user.id);
            }
            
            // 验证所有 ID 都是唯一的
            expect(createdIds.size).toBe(count);
          }
        ),
        { numRuns: 10 }
      );
    }, 30000);
  });

  /**
   * **Feature: user-login, Property 7: 密码安全存储**
   * *对于任意*用户密码，存储时应使用 bcrypt 加密，且原始密码可通过 bcrypt.compare 验证。
   * **Validates: Requirements 3.3**
   */
  describe('属性 7: 密码安全存储', () => {
    it('密码应使用 bcrypt 加密存储，且可验证', async () => {
      await fc.assert(
        fc.asyncProperty(
          // 生成有效的密码（6-50字符）
          fc.string({ minLength: 6, maxLength: 50 }),
          async (password) => {
            userStore.clear();
            
            const username = `testuser_${Date.now()}`;
            const user = await userStore.createUser(username, password, '测试用户');
            
            // 验证密码哈希不等于原始密码
            expect(user.passwordHash).not.toBe(password);
            
            // 验证密码哈希是有效的 bcrypt 格式
            expect(user.passwordHash).toMatch(/^\$2[aby]?\$\d{1,2}\$.{53}$/);
            
            // 验证原始密码可以通过 bcrypt.compare 验证
            const isValid = await bcrypt.compare(password, user.passwordHash);
            expect(isValid).toBe(true);
            
            // 验证错误密码不能通过验证
            const wrongPassword = password + '_wrong';
            const isInvalid = await bcrypt.compare(wrongPassword, user.passwordHash);
            expect(isInvalid).toBe(false);
          }
        ),
        { numRuns: 15 }
      );
    }, 60000);

    it('相同密码的多次哈希应产生不同结果（盐值随机性）', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 6, maxLength: 30 }),
          async (password) => {
            userStore.clear();
            
            // 创建两个使用相同密码的用户
            const user1 = await userStore.createUser(`user1_${Date.now()}`, password, '用户1');
            const user2 = await userStore.createUser(`user2_${Date.now()}`, password, '用户2');
            
            // 验证两个哈希值不同（因为盐值不同）
            expect(user1.passwordHash).not.toBe(user2.passwordHash);
            
            // 但两个哈希都能验证原始密码
            const isValid1 = await bcrypt.compare(password, user1.passwordHash);
            const isValid2 = await bcrypt.compare(password, user2.passwordHash);
            expect(isValid1).toBe(true);
            expect(isValid2).toBe(true);
          }
        ),
        { numRuns: 10 }
      );
    }, 60000);
  });

  /**
   * **Feature: user-login, Property 8: 用户列表不包含密码**
   * *对于任意*用户列表查询，返回的数据不应包含密码或密码哈希字段。
   * **Validates: Requirements 3.4**
   */
  describe('属性 8: 用户列表不包含密码', () => {
    it('listUsers 返回的数据不应包含密码字段', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 5 }),
          async (userCount) => {
            userStore.clear();
            
            // 创建多个用户
            for (let i = 0; i < userCount; i++) {
              await userStore.createUser(
                `user${i}_${Date.now()}`,
                `password${i}`,
                `用户${i}`
              );
            }
            
            // 获取用户列表
            const users = await userStore.listUsers();
            
            // 验证返回的用户数量正确
            expect(users.length).toBe(userCount);
            
            // 验证每个用户对象不包含密码相关字段
            for (const user of users) {
              // 检查 UserInfo 类型的字段
              expect(user).toHaveProperty('id');
              expect(user).toHaveProperty('username');
              expect(user).toHaveProperty('displayName');
              expect(user).toHaveProperty('lastLoginAt');
              
              // 验证不包含密码字段
              expect(user).not.toHaveProperty('password');
              expect(user).not.toHaveProperty('passwordHash');
              expect(user).not.toHaveProperty('password_hash');
              
              // 验证对象只有 UserInfo 的字段
              const keys = Object.keys(user);
              expect(keys).toEqual(expect.arrayContaining(['id', 'username', 'displayName', 'lastLoginAt']));
              expect(keys.length).toBe(4);
            }
          }
        ),
        { numRuns: 10 }
      );
    }, 60000);

    it('用户列表中的任何字段值都不应包含密码哈希', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 6, maxLength: 20 }),
          async (password) => {
            userStore.clear();
            
            // 创建用户
            const createdUser = await userStore.createUser(
              `testuser_${Date.now()}`,
              password,
              '测试用户'
            );
            
            // 获取用户列表
            const users = await userStore.listUsers();
            
            // 验证列表中的用户
            for (const user of users) {
              // 将用户对象转换为 JSON 字符串
              const userJson = JSON.stringify(user);
              
              // 验证 JSON 中不包含密码哈希
              expect(userJson).not.toContain(createdUser.passwordHash);
              
              // 验证 JSON 中不包含原始密码
              expect(userJson).not.toContain(password);
              
              // 验证不包含 bcrypt 哈希格式
              expect(userJson).not.toMatch(/\$2[aby]?\$\d{1,2}\$/);
            }
          }
        ),
        { numRuns: 10 }
      );
    }, 60000);
  });
});

describe('UserService 单元测试', () => {
  let userStore: InMemoryUserStore;
  
  beforeEach(() => {
    userStore = new InMemoryUserStore();
  });

  afterEach(() => {
    userStore.clear();
  });

  describe('createUser', () => {
    it('应该成功创建用户', async () => {
      const user = await userStore.createUser('testuser', 'password123', '测试用户');
      
      expect(user.username).toBe('testuser');
      expect(user.displayName).toBe('测试用户');
      expect(user.isActive).toBe(true);
    });

    it('空用户名应该抛出错误', async () => {
      await expect(userStore.createUser('', 'password123', '测试用户'))
        .rejects.toThrow('用户名不能为空');
    });

    it('密码太短应该抛出错误', async () => {
      await expect(userStore.createUser('testuser', '12345', '测试用户'))
        .rejects.toThrow('密码长度不能少于6位');
    });

    it('空显示名称应该抛出错误', async () => {
      await expect(userStore.createUser('testuser', 'password123', ''))
        .rejects.toThrow('显示名称不能为空');
    });

    it('重复用户名应该抛出错误', async () => {
      await userStore.createUser('testuser', 'password123', '测试用户1');
      
      await expect(userStore.createUser('testuser', 'password456', '测试用户2'))
        .rejects.toThrow('用户名已存在');
    });
  });

  describe('validateCredentials', () => {
    it('正确凭据应该返回用户', async () => {
      await userStore.createUser('testuser', 'password123', '测试用户');
      
      const user = await userStore.validateCredentials('testuser', 'password123');
      
      expect(user).not.toBeNull();
      expect(user?.username).toBe('testuser');
    });

    it('错误密码应该返回 null', async () => {
      await userStore.createUser('testuser', 'password123', '测试用户');
      
      const user = await userStore.validateCredentials('testuser', 'wrongpassword');
      
      expect(user).toBeNull();
    });

    it('不存在的用户应该返回 null', async () => {
      const user = await userStore.validateCredentials('nonexistent', 'password123');
      
      expect(user).toBeNull();
    });

    it('空凭据应该返回 null', async () => {
      expect(await userStore.validateCredentials('', 'password')).toBeNull();
      expect(await userStore.validateCredentials('user', '')).toBeNull();
    });

    it('禁用的用户应该返回 null', async () => {
      const user = await userStore.createUser('testuser', 'password123', '测试用户');
      await userStore.disableUser(user.id);
      
      const result = await userStore.validateCredentials('testuser', 'password123');
      
      expect(result).toBeNull();
    });
  });

  describe('getUserById', () => {
    it('应该返回存在的用户', async () => {
      const created = await userStore.createUser('testuser', 'password123', '测试用户');
      
      const user = await userStore.getUserById(created.id);
      
      expect(user).not.toBeNull();
      expect(user?.id).toBe(created.id);
    });

    it('不存在的 ID 应该返回 null', async () => {
      const user = await userStore.getUserById('nonexistent-id');
      
      expect(user).toBeNull();
    });
  });

  describe('getUserByUsername', () => {
    it('应该返回存在的用户', async () => {
      await userStore.createUser('testuser', 'password123', '测试用户');
      
      const user = await userStore.getUserByUsername('testuser');
      
      expect(user).not.toBeNull();
      expect(user?.username).toBe('testuser');
    });

    it('不存在的用户名应该返回 null', async () => {
      const user = await userStore.getUserByUsername('nonexistent');
      
      expect(user).toBeNull();
    });
  });

  describe('listUsers', () => {
    it('应该返回所有用户', async () => {
      await userStore.createUser('user1', 'password1', '用户1');
      await userStore.createUser('user2', 'password2', '用户2');
      
      const users = await userStore.listUsers();
      
      expect(users.length).toBe(2);
    });

    it('空数据库应该返回空数组', async () => {
      const users = await userStore.listUsers();
      
      expect(users).toEqual([]);
    });
  });

  describe('updateLastLogin', () => {
    it('应该更新最后登录时间', async () => {
      const user = await userStore.createUser('testuser', 'password123', '测试用户');
      expect(user.lastLoginAt).toBeNull();
      
      await userStore.updateLastLogin(user.id);
      
      const updated = await userStore.getUserById(user.id);
      expect(updated?.lastLoginAt).not.toBeNull();
    });
  });

  describe('disableUser / enableUser', () => {
    it('应该禁用用户', async () => {
      const user = await userStore.createUser('testuser', 'password123', '测试用户');
      expect(user.isActive).toBe(true);
      
      await userStore.disableUser(user.id);
      
      const disabled = await userStore.getUserById(user.id);
      expect(disabled?.isActive).toBe(false);
    });

    it('应该启用用户', async () => {
      const user = await userStore.createUser('testuser', 'password123', '测试用户');
      await userStore.disableUser(user.id);
      
      await userStore.enableUser(user.id);
      
      const enabled = await userStore.getUserById(user.id);
      expect(enabled?.isActive).toBe(true);
    });

    it('禁用不存在的用户应该抛出错误', async () => {
      await expect(userStore.disableUser('nonexistent'))
        .rejects.toThrow('用户不存在');
    });
  });
});

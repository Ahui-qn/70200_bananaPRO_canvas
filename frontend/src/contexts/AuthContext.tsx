/**
 * 认证上下文
 * 管理用户登录状态，提供 login/logout 方法
 * 
 * 需求: 2.1, 2.2, 2.3, 2.4, 5.1, 5.2
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

// 用户角色类型
type UserRole = 'user' | 'admin';

// 用户信息类型
interface UserInfo {
  id: string;
  username: string;
  displayName: string;
  role: UserRole;           // 用户角色（需求 10.1）
  lastLoginAt: Date | null;
}

// 认证上下文类型
interface AuthContextType {
  user: UserInfo | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  clearError: () => void;
}

// 本地存储键名
const TOKEN_KEY = 'auth_token';
const USER_KEY = 'auth_user';

// 创建上下文
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// API 基础地址
const API_BASE_URL = '/api';

/**
 * 认证提供者组件
 */
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * 从本地存储恢复登录状态（需求 2.2, 2.3）
   */
  useEffect(() => {
    const initAuth = async () => {
      try {
        const token = localStorage.getItem(TOKEN_KEY);
        const savedUser = localStorage.getItem(USER_KEY);

        if (token && savedUser) {
          // 验证令牌是否仍然有效
          const response = await fetch(`${API_BASE_URL}/auth/verify`, {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });

          if (response.ok) {
            const data = await response.json();
            if (data.success && data.data?.user) {
              setUser(data.data.user);
              
              // 如果返回了新令牌，更新本地存储
              if (data.data.token) {
                localStorage.setItem(TOKEN_KEY, data.data.token);
              }
            } else {
              // 令牌无效，清除本地存储（需求 2.4）
              localStorage.removeItem(TOKEN_KEY);
              localStorage.removeItem(USER_KEY);
            }
          } else {
            // 令牌无效，清除本地存储（需求 2.4）
            localStorage.removeItem(TOKEN_KEY);
            localStorage.removeItem(USER_KEY);
          }
        }
      } catch (err) {
        console.error('验证登录状态失败:', err);
        // 网络错误时保留本地状态
        const savedUser = localStorage.getItem(USER_KEY);
        if (savedUser) {
          try {
            setUser(JSON.parse(savedUser));
          } catch {
            localStorage.removeItem(USER_KEY);
          }
        }
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();
  }, []);

  /**
   * 登录（需求 1.1, 2.1）
   */
  const login = useCallback(async (username: string, password: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username, password })
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || '登录失败');
      }

      // 保存令牌和用户信息到本地存储（需求 2.1）
      localStorage.setItem(TOKEN_KEY, data.data.token);
      localStorage.setItem(USER_KEY, JSON.stringify(data.data.user));
      
      setUser(data.data.user);
    } catch (err: any) {
      const errorMessage = err.message || '登录失败，请稍后重试';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * 退出登录（需求 5.1, 5.2）
   */
  const logout = useCallback(() => {
    // 调用后端退出接口（可选，用于记录日志）
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) {
      fetch(`${API_BASE_URL}/auth/logout`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }).catch(() => {
        // 忽略错误
      });
    }

    // 清除本地存储（需求 5.1）
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    
    setUser(null);
    setError(null);
  }, []);

  /**
   * 清除错误
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const value: AuthContextType = {
    user,
    isAuthenticated: !!user,
    isLoading,
    error,
    login,
    logout,
    clearError
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

/**
 * 使用认证上下文的 Hook
 */
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

/**
 * 获取认证令牌
 */
export const getAuthToken = (): string | null => {
  return localStorage.getItem(TOKEN_KEY);
};

/**
 * 获取带认证头的 fetch 选项
 */
export const getAuthHeaders = (): HeadersInit => {
  const token = getAuthToken();
  return token ? { 'Authorization': `Bearer ${token}` } : {};
};

export default AuthContext;

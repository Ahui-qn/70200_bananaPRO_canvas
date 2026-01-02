/**
 * 路由保护组件
 * 检查登录状态，未登录时重定向到登录页
 * 
 * 需求: 1.4
 */

import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import LoginPage from './LoginPage';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

/**
 * 加载中状态组件
 */
const LoadingScreen: React.FC = () => (
  <div className="min-h-screen dot-matrix-bg flex items-center justify-center">
    <div className="glass-card rounded-2xl p-8 text-center">
      <div className="w-12 h-12 mx-auto mb-4 rounded-full border-2 border-violet-500 border-t-transparent animate-spin" />
      <p className="text-zinc-400">正在验证登录状态...</p>
    </div>
  </div>
);

/**
 * 路由保护组件
 * 
 * 需求: 1.4 - 未登录用户尝试访问登录页面以外的任何功能时，自动重定向到登录页面
 */
export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { isAuthenticated, isLoading, login, error } = useAuth();

  // 正在验证登录状态
  if (isLoading) {
    return <LoadingScreen />;
  }

  // 未登录，显示登录页面
  if (!isAuthenticated) {
    return (
      <LoginPage 
        onLogin={login} 
        error={error || undefined}
        isLoading={isLoading}
      />
    );
  }

  // 已登录，渲染子组件
  return <>{children}</>;
};

export default ProtectedRoute;

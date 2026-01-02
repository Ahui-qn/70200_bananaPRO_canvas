/**
 * 登录页面组件
 * 
 * 需求: 1.1, 1.2, 1.3
 */

import React, { useState } from 'react';

interface LoginPageProps {
  onLogin: (username: string, password: string) => Promise<void>;
  error?: string;
  isLoading?: boolean;
}

export const LoginPage: React.FC<LoginPageProps> = ({ 
  onLogin, 
  error, 
  isLoading = false 
}) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [localError, setLocalError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError('');

    // 验证输入（需求 1.3）
    if (!username.trim() || !password.trim()) {
      setLocalError('请输入用户名和密码');
      return;
    }

    try {
      await onLogin(username.trim(), password);
    } catch (err: any) {
      setLocalError(err.message || '登录失败');
    }
  };

  const displayError = error || localError;

  return (
    <div className="min-h-screen dot-matrix-bg flex items-center justify-center p-4">
      {/* 登录卡片 */}
      <div className="glass-card rounded-2xl p-8 w-full max-w-md animate-fade-in">
        {/* Logo 和标题 */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-500 flex items-center justify-center shadow-lg">
            <svg 
              className="w-8 h-8 text-white" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" 
              />
            </svg>
          </div>
          <h1 className="text-2xl font-semibold text-zinc-100">
            Nano Banana AI
          </h1>
          <p className="text-zinc-400 mt-2">
            登录以继续使用
          </p>
        </div>

        {/* 登录表单 */}
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* 用户名输入 */}
          <div>
            <label 
              htmlFor="username" 
              className="block text-sm font-medium text-zinc-300 mb-2"
            >
              用户名
            </label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="input-glass w-full px-4 py-3 rounded-xl text-zinc-100 placeholder-zinc-500"
              placeholder="请输入用户名"
              disabled={isLoading}
              autoComplete="username"
              autoFocus
            />
          </div>

          {/* 密码输入 */}
          <div>
            <label 
              htmlFor="password" 
              className="block text-sm font-medium text-zinc-300 mb-2"
            >
              密码
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input-glass w-full px-4 py-3 rounded-xl text-zinc-100 placeholder-zinc-500"
              placeholder="请输入密码"
              disabled={isLoading}
              autoComplete="current-password"
            />
          </div>

          {/* 错误提示（需求 1.2） */}
          {displayError && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-red-400 text-sm animate-fade-in">
              <div className="flex items-center gap-2">
                <svg 
                  className="w-4 h-4 flex-shrink-0" 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    strokeWidth={2} 
                    d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" 
                  />
                </svg>
                <span>{displayError}</span>
              </div>
            </div>
          )}

          {/* 登录按钮 */}
          <button
            type="submit"
            disabled={isLoading}
            className="btn-primary w-full py-3 rounded-xl text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <svg 
                  className="w-5 h-5 animate-spin" 
                  fill="none" 
                  viewBox="0 0 24 24"
                >
                  <circle 
                    className="opacity-25" 
                    cx="12" 
                    cy="12" 
                    r="10" 
                    stroke="currentColor" 
                    strokeWidth="4"
                  />
                  <path 
                    className="opacity-75" 
                    fill="currentColor" 
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                <span>登录中...</span>
              </>
            ) : (
              <span>登录</span>
            )}
          </button>
        </form>

        {/* 底部提示 */}
        <p className="text-center text-zinc-500 text-sm mt-6">
          内部系统，仅限授权用户使用
        </p>
      </div>
    </div>
  );
};

export default LoginPage;

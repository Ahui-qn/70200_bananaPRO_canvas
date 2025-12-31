import React, { useState, useEffect } from 'react';
import { DatabaseConfig } from '../../../shared/types';
import { apiService } from '../services/api';
import { X, TestTube, AlertCircle, CheckCircle, Database, Wifi, WifiOff } from 'lucide-react';

interface DatabaseConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfigSaved?: (config: DatabaseConfig) => void;
}

export const DatabaseConfigModal: React.FC<DatabaseConfigModalProps> = ({
  isOpen,
  onClose,
  onConfigSaved
}) => {
  const [config, setConfig] = useState<DatabaseConfig>({
    host: 'localhost',
    port: 3306,
    database: 'nano_banana_ai',
    username: 'root',
    password: '',
    ssl: false,
    enabled: false
  });
  
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<{
    isConnected: boolean;
    connectionInfo?: string;
  }>({ isConnected: false });

  // 加载数据库状态
  useEffect(() => {
    if (isOpen) {
      loadDatabaseStatus();
    }
  }, [isOpen]);

  const loadDatabaseStatus = async () => {
    try {
      const response = await apiService.getDatabaseStatus();
      if (response.success && response.data) {
        setConnectionStatus({
          isConnected: response.data.isConnected || false,
          connectionInfo: response.data.connectionInfo
        });
      }
    } catch (error: any) {
      console.warn('加载数据库状态失败:', error);
    }
  };

  const handleTest = async () => {
    try {
      setTesting(true);
      setMessage(null);

      // 验证必填字段
      if (!config.host.trim() || !config.database.trim() || !config.username.trim()) {
        setMessage({ type: 'error', text: '请填写完整的数据库连接信息' });
        return;
      }

      const response = await apiService.testDatabaseConnection(config);
      
      if (response.success) {
        setMessage({ type: 'success', text: '数据库连接测试成功' });
      } else {
        setMessage({ type: 'error', text: response.error || '连接测试失败' });
      }
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || '连接测试失败' });
    } finally {
      setTesting(false);
    }
  };

  const handleConnect = async () => {
    try {
      setConnecting(true);
      setMessage(null);

      // 验证必填字段
      if (!config.host.trim() || !config.database.trim() || !config.username.trim()) {
        setMessage({ type: 'error', text: '请填写完整的数据库连接信息' });
        return;
      }

      const response = await apiService.connectDatabase(config);
      
      if (response.success) {
        setMessage({ type: 'success', text: '数据库连接成功' });
        setConnectionStatus({ isConnected: true, connectionInfo: `${config.host}:${config.port}/${config.database}` });
        
        // 更新配置状态
        const updatedConfig = { ...config, enabled: true };
        setConfig(updatedConfig);
        onConfigSaved?.(updatedConfig);
      } else {
        setMessage({ type: 'error', text: response.error || '连接失败' });
      }
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || '连接失败' });
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      setConnecting(true);
      setMessage(null);

      const response = await apiService.disconnectDatabase();
      
      if (response.success) {
        setMessage({ type: 'info', text: '数据库连接已断开' });
        setConnectionStatus({ isConnected: false });
        
        // 更新配置状态
        const updatedConfig = { ...config, enabled: false };
        setConfig(updatedConfig);
        onConfigSaved?.(updatedConfig);
      } else {
        setMessage({ type: 'error', text: response.error || '断开连接失败' });
      }
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || '断开连接失败' });
    } finally {
      setConnecting(false);
    }
  };

  const handleInitDatabase = async () => {
    try {
      setLoading(true);
      setMessage(null);

      if (!connectionStatus.isConnected) {
        setMessage({ type: 'error', text: '请先连接数据库' });
        return;
      }

      const response = await apiService.initDatabase();
      
      if (response.success) {
        setMessage({ type: 'success', text: '数据库初始化成功' });
      } else {
        setMessage({ type: 'error', text: response.error || '数据库初始化失败' });
      }
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || '数据库初始化失败' });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setMessage(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-zinc-900 rounded-xl border border-zinc-700 w-full max-w-md max-h-[90vh] overflow-y-auto">
        {/* 头部 */}
        <div className="flex items-center justify-between p-6 border-b border-zinc-700">
          <div className="flex items-center gap-3">
            <Database className="w-5 h-5 text-blue-400" />
            <h2 className="text-lg font-semibold text-zinc-100">数据库配置</h2>
          </div>
          <button
            onClick={handleClose}
            className="p-1 hover:bg-zinc-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-zinc-400" />
          </button>
        </div>

        {/* 连接状态 */}
        <div className="p-6 border-b border-zinc-700">
          <div className="flex items-center gap-3">
            {connectionStatus.isConnected ? (
              <>
                <Wifi className="w-5 h-5 text-green-400" />
                <div>
                  <div className="text-sm font-medium text-green-400">已连接</div>
                  {connectionStatus.connectionInfo && (
                    <div className="text-xs text-zinc-500">{connectionStatus.connectionInfo}</div>
                  )}
                </div>
              </>
            ) : (
              <>
                <WifiOff className="w-5 h-5 text-red-400" />
                <div className="text-sm font-medium text-red-400">未连接</div>
              </>
            )}
          </div>
        </div>

        {/* 内容 */}
        <div className="p-6 space-y-4">
          {/* 主机地址 */}
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">
              主机地址 *
            </label>
            <input
              type="text"
              value={config.host}
              onChange={(e) => setConfig({ ...config, host: e.target.value })}
              placeholder="localhost"
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-600 rounded-lg text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* 端口 */}
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">
              端口 *
            </label>
            <input
              type="number"
              value={config.port}
              onChange={(e) => setConfig({ ...config, port: parseInt(e.target.value) || 3306 })}
              placeholder="3306"
              min="1"
              max="65535"
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-600 rounded-lg text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* 数据库名 */}
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">
              数据库名 *
            </label>
            <input
              type="text"
              value={config.database}
              onChange={(e) => setConfig({ ...config, database: e.target.value })}
              placeholder="nano_banana_ai"
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-600 rounded-lg text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* 用户名 */}
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">
              用户名 *
            </label>
            <input
              type="text"
              value={config.username}
              onChange={(e) => setConfig({ ...config, username: e.target.value })}
              placeholder="root"
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-600 rounded-lg text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* 密码 */}
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">
              密码
            </label>
            <input
              type="password"
              value={config.password}
              onChange={(e) => setConfig({ ...config, password: e.target.value })}
              placeholder="请输入数据库密码"
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-600 rounded-lg text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* SSL */}
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="ssl"
              checked={config.ssl}
              onChange={(e) => setConfig({ ...config, ssl: e.target.checked })}
              className="w-4 h-4 text-blue-600 bg-zinc-800 border-zinc-600 rounded focus:ring-blue-500 focus:ring-2"
            />
            <label htmlFor="ssl" className="text-sm text-zinc-300">
              启用 SSL 连接
            </label>
          </div>

          {/* 消息显示 */}
          {message && (
            <div className={`flex items-center gap-2 p-3 rounded-lg ${
              message.type === 'success' 
                ? 'bg-green-600/20 text-green-300 border border-green-600/30'
                : message.type === 'info'
                ? 'bg-blue-600/20 text-blue-300 border border-blue-600/30'
                : 'bg-red-600/20 text-red-300 border border-red-600/30'
            }`}>
              {message.type === 'success' ? (
                <CheckCircle className="w-4 h-4" />
              ) : (
                <AlertCircle className="w-4 h-4" />
              )}
              <span className="text-sm">{message.text}</span>
            </div>
          )}
        </div>

        {/* 底部按钮 */}
        <div className="p-6 border-t border-zinc-700 space-y-3">
          {/* 测试和连接按钮 */}
          <div className="flex items-center gap-3">
            <button
              onClick={handleTest}
              disabled={testing || loading || connecting}
              className="flex items-center gap-2 px-4 py-2 bg-zinc-700 hover:bg-zinc-600 disabled:bg-zinc-800 disabled:text-zinc-500 text-zinc-100 rounded-lg transition-colors"
            >
              <TestTube className="w-4 h-4" />
              {testing ? '测试中...' : '测试连接'}
            </button>

            {connectionStatus.isConnected ? (
              <button
                onClick={handleDisconnect}
                disabled={connecting || loading}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-800 disabled:text-red-300 text-white rounded-lg transition-colors"
              >
                <WifiOff className="w-4 h-4" />
                {connecting ? '断开中...' : '断开连接'}
              </button>
            ) : (
              <button
                onClick={handleConnect}
                disabled={connecting || loading}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-green-800 disabled:text-green-300 text-white rounded-lg transition-colors"
              >
                <Wifi className="w-4 h-4" />
                {connecting ? '连接中...' : '连接'}
              </button>
            )}
          </div>

          {/* 初始化按钮 */}
          {connectionStatus.isConnected && (
            <button
              onClick={handleInitDatabase}
              disabled={loading || connecting}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:text-blue-300 text-white rounded-lg transition-colors"
            >
              <Database className="w-4 h-4" />
              {loading ? '初始化中...' : '初始化数据库'}
            </button>
          )}

          {/* 关闭按钮 */}
          <div className="flex justify-end">
            <button
              onClick={handleClose}
              className="px-4 py-2 text-zinc-400 hover:text-zinc-100 transition-colors"
            >
              关闭
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
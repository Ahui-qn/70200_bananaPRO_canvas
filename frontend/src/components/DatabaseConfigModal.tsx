import React, { useState, useEffect } from 'react';
import { apiService } from '../services/api';
import {
  X,
  TestTube,
  AlertCircle,
  CheckCircle,
  Database,
  Wifi,
  WifiOff,
  Lock,
} from 'lucide-react';

interface DatabaseConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfigSaved?: (config: any) => void;
}

interface DatabaseConfigDisplay {
  host: string;
  port: number;
  database: string;
}

export const DatabaseConfigModal: React.FC<DatabaseConfigModalProps> = ({
  isOpen,
  onClose,
  onConfigSaved,
}) => {
  const [config, setConfig] = useState<DatabaseConfigDisplay>({
    host: '',
    port: 3306,
    database: '',
  });

  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [message, setMessage] = useState<{
    type: 'success' | 'error' | 'info';
    text: string;
  } | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<{
    isConnected: boolean;
    connectionInfo?: string;
  }>({ isConnected: false });
  const [isConfigured, setIsConfigured] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadDatabaseStatus();
    }
  }, [isOpen]);

  const loadDatabaseStatus = async () => {
    try {
      setLoading(true);
      const response = await apiService.getDatabaseStatus();
      if (response.success && response.data) {
        setConnectionStatus({
          isConnected: response.data.isConnected || false,
          connectionInfo: response.data.connectionInfo,
        });

        if (response.data.config) {
          setConfig({
            host: response.data.config.host || '',
            port: response.data.config.port || 3306,
            database: response.data.config.database || '',
          });
        }

        setIsConfigured(response.data.isConfigured || false);
      }
    } catch (error: any) {
      console.warn('加载数据库状态失败:', error);
      setMessage({ type: 'error', text: '加载配置失败' });
    } finally {
      setLoading(false);
    }
  };

  const handleTest = async () => {
    try {
      setTesting(true);
      setMessage(null);

      const response = await apiService.testDatabaseConnection();

      if (response.success) {
        const latency = response.data?.latency;
        setMessage({
          type: 'success',
          text: `连接测试成功${latency ? `，延迟: ${latency}ms` : ''}`,
        });
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

      const response = await apiService.connectDatabase();

      if (response.success) {
        setMessage({ type: 'success', text: '数据库连接成功' });
        setConnectionStatus({
          isConnected: true,
          connectionInfo: `${config.host}:${config.port}/${config.database}`,
        });
        onConfigSaved?.({ ...config, enabled: true });
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
        onConfigSaved?.({ ...config, enabled: false });
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
        setMessage({
          type: 'error',
          text: response.error || '数据库初始化失败',
        });
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
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="glass-card rounded-2xl w-full max-w-md max-h-[90vh] overflow-hidden animate-fade-in">
        {/* 头部 */}
        <div className="flex items-center justify-between p-5 border-b border-zinc-800/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
              <Database className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-zinc-100">数据库配置</h2>
              <p className="text-xs text-zinc-500 flex items-center gap-1">
                <Lock className="w-3 h-3" />
                只读模式
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="btn-glass p-2 rounded-lg"
          >
            <X className="w-4 h-4 text-zinc-400" />
          </button>
        </div>

        {/* 连接状态 */}
        <div className="px-5 py-4 border-b border-zinc-800/50">
          <div className="flex items-center gap-3">
            {connectionStatus.isConnected ? (
              <>
                <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                  <Wifi className="w-4 h-4 text-emerald-400" />
                </div>
                <div>
                  <div className="text-sm font-medium text-emerald-400">已连接</div>
                  {connectionStatus.connectionInfo && (
                    <div className="text-xs text-zinc-500">{connectionStatus.connectionInfo}</div>
                  )}
                </div>
              </>
            ) : (
              <>
                <div className="w-8 h-8 rounded-lg bg-red-500/20 flex items-center justify-center">
                  <WifiOff className="w-4 h-4 text-red-400" />
                </div>
                <div className="text-sm font-medium text-red-400">未连接</div>
              </>
            )}
          </div>
        </div>

        {/* 内容 */}
        <div className="p-5 space-y-4 overflow-y-auto max-h-[50vh]">
          {loading ? (
            <div className="text-center py-8">
              <div className="w-8 h-8 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin mx-auto mb-3" />
              <p className="text-sm text-zinc-500">加载配置中...</p>
            </div>
          ) : !isConfigured ? (
            <div className="text-center py-8">
              <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center mx-auto mb-3">
                <AlertCircle className="w-6 h-6 text-amber-400" />
              </div>
              <p className="text-zinc-300 font-medium">未配置数据库连接</p>
              <p className="text-xs text-zinc-500 mt-1">请在 backend/.env 文件中配置</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-2">主机地址</label>
                  <input
                    type="text"
                    value={config.host}
                    readOnly
                    className="input-glass w-full px-3 py-2 rounded-xl text-zinc-300 cursor-not-allowed text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-2">端口</label>
                  <input
                    type="text"
                    value={config.port}
                    readOnly
                    className="input-glass w-full px-3 py-2 rounded-xl text-zinc-300 cursor-not-allowed text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-2">数据库名</label>
                <input
                  type="text"
                  value={config.database}
                  readOnly
                  className="input-glass w-full px-3 py-2 rounded-xl text-zinc-300 cursor-not-allowed text-sm"
                />
              </div>
            </>
          )}

          {message && (
            <div
              className={`flex items-center gap-2 p-3 rounded-xl text-sm ${
                message.type === 'success'
                  ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20'
                  : message.type === 'info'
                    ? 'bg-blue-500/10 text-blue-300 border border-blue-500/20'
                    : 'bg-red-500/10 text-red-300 border border-red-500/20'
              }`}
            >
              {message.type === 'success' ? (
                <CheckCircle className="w-4 h-4" />
              ) : (
                <AlertCircle className="w-4 h-4" />
              )}
              <span>{message.text}</span>
            </div>
          )}
        </div>

        {/* 底部按钮 */}
        <div className="p-5 border-t border-zinc-800/50 space-y-3">
          {isConfigured && (
            <>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleTest}
                  disabled={testing || loading || connecting}
                  className="btn-glass flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm text-zinc-300 disabled:opacity-50"
                >
                  <TestTube className="w-4 h-4" />
                  {testing ? '测试中...' : '测试连接'}
                </button>

                {connectionStatus.isConnected ? (
                  <button
                    onClick={handleDisconnect}
                    disabled={connecting || loading}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-xl text-sm transition-colors"
                  >
                    <WifiOff className="w-4 h-4" />
                    {connecting ? '断开中...' : '断开'}
                  </button>
                ) : (
                  <button
                    onClick={handleConnect}
                    disabled={connecting || loading}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-sm transition-colors"
                  >
                    <Wifi className="w-4 h-4" />
                    {connecting ? '连接中...' : '连接'}
                  </button>
                )}
              </div>

              {connectionStatus.isConnected && (
                <button
                  onClick={handleInitDatabase}
                  disabled={loading || connecting}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-sm transition-colors"
                >
                  <Database className="w-4 h-4" />
                  {loading ? '初始化中...' : '初始化数据库'}
                </button>
              )}
            </>
          )}

          <div className="flex justify-end">
            <button
              onClick={handleClose}
              className="btn-glass px-4 py-2 rounded-xl text-sm text-zinc-300"
            >
              关闭
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

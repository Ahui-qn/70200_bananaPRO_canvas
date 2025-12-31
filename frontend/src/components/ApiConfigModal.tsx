import React, { useState, useEffect } from 'react';
import { apiService } from '../services/api';
import { X, AlertCircle, CheckCircle, Key, Lock } from 'lucide-react';

interface ApiConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfigSaved?: (config: any) => void;
}

interface ApiConfigDisplay {
  apiKey: string;
  apiKeyConfigured: boolean;
  baseUrl: string;
  provider: string;
}

export const ApiConfigModal: React.FC<ApiConfigModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [config, setConfig] = useState<ApiConfigDisplay>({
    apiKey: '',
    apiKeyConfigured: false,
    baseUrl: '',
    provider: '',
  });

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{
    type: 'success' | 'error' | 'info';
    text: string;
  } | null>(null);
  const [isConfigured, setIsConfigured] = useState(false);

  // 加载现有配置
  useEffect(() => {
    if (isOpen) {
      loadConfig();
    }
  }, [isOpen]);

  const loadConfig = async () => {
    try {
      setLoading(true);
      const response = await apiService.getApiConfig();
      if (response.success && response.data) {
        setConfig({
          apiKey: response.data.apiKey || '',
          apiKeyConfigured: response.data.apiKeyConfigured || false,
          baseUrl: response.data.baseUrl || '',
          provider: response.data.provider || '',
        });
        setIsConfigured(response.data.apiKeyConfigured || false);
      }
    } catch (error: any) {
      console.warn('加载 API 配置失败:', error);
      setMessage({ type: 'error', text: '加载配置失败' });
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
            <Key className="w-5 h-5 text-purple-400" />
            <h2 className="text-lg font-semibold text-zinc-100">API 配置</h2>
            <Lock className="w-4 h-4 text-zinc-500" title="只读模式" />
          </div>
          <button
            onClick={handleClose}
            className="p-1 hover:bg-zinc-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-zinc-400" />
          </button>
        </div>

        {/* 只读提示 */}
        <div className="px-6 py-3 bg-zinc-800/50 border-b border-zinc-700">
          <p className="text-xs text-zinc-400 flex items-center gap-2">
            <Lock className="w-3 h-3" />
            配置从 .env 文件读取，如需修改请编辑 backend/.env 文件
          </p>
        </div>

        {/* 内容 - 只读显示 */}
        <div className="p-6 space-y-4">
          {loading ? (
            <div className="text-center text-zinc-400 py-4">加载配置中...</div>
          ) : !isConfigured ? (
            <div className="text-center text-zinc-400 py-4">
              <AlertCircle className="w-8 h-8 mx-auto mb-2 text-yellow-500" />
              <p>未配置 API Key</p>
              <p className="text-xs mt-1">
                请在 backend/.env 文件中配置 NANO_BANANA_API_KEY
              </p>
            </div>
          ) : (
            <>
              {/* API Key */}
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                  API Key
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={config.apiKey}
                    readOnly
                    className="flex-1 px-3 py-2 bg-zinc-800/50 border border-zinc-700 rounded-lg text-zinc-300 cursor-not-allowed font-mono text-sm"
                  />
                  {config.apiKeyConfigured && (
                    <CheckCircle className="w-5 h-5 text-green-400" />
                  )}
                </div>
              </div>

              {/* API 地址 */}
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                  API 地址
                </label>
                <input
                  type="text"
                  value={config.baseUrl}
                  readOnly
                  className="w-full px-3 py-2 bg-zinc-800/50 border border-zinc-700 rounded-lg text-zinc-300 cursor-not-allowed"
                />
              </div>

              {/* 提供商 */}
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                  提供商
                </label>
                <input
                  type="text"
                  value={config.provider}
                  readOnly
                  className="w-full px-3 py-2 bg-zinc-800/50 border border-zinc-700 rounded-lg text-zinc-300 cursor-not-allowed"
                />
              </div>
            </>
          )}

          {/* 消息显示 */}
          {message && (
            <div
              className={`flex items-center gap-2 p-3 rounded-lg ${
                message.type === 'success'
                  ? 'bg-green-600/20 text-green-300 border border-green-600/30'
                  : message.type === 'info'
                    ? 'bg-blue-600/20 text-blue-300 border border-blue-600/30'
                    : 'bg-red-600/20 text-red-300 border border-red-600/30'
              }`}
            >
              {message.type === 'success' ? (
                <CheckCircle className="w-4 h-4" />
              ) : (
                <AlertCircle className="w-4 h-4" />
              )}
              <span className="text-sm">{message.text}</span>
            </div>
          )}

          {/* 配置提示 */}
          {isConfigured && (
            <div className="bg-purple-600/10 border border-purple-600/20 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-purple-400 mt-0.5" />
                <div className="text-xs text-purple-300">
                  <p className="font-medium mb-1">配置说明：</p>
                  <ul className="space-y-1 text-purple-200">
                    <li>• API 配置从 .env 文件读取</li>
                    <li>• API Key 已部分隐藏以保护安全</li>
                    <li>• 如需修改请编辑 backend/.env</li>
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 底部按钮 */}
        <div className="flex items-center justify-end p-6 border-t border-zinc-700">
          <button
            onClick={handleClose}
            className="px-4 py-2 text-zinc-400 hover:text-zinc-100 transition-colors"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  );
};

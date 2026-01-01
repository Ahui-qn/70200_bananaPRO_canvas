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
        const data = response.data as any;
        setConfig({
          apiKey: data.apiKey || '',
          apiKeyConfigured: data.apiKeyConfigured || false,
          baseUrl: data.baseUrl || '',
          provider: data.provider || '',
        });
        setIsConfigured(data.apiKeyConfigured || false);
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
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="glass-card rounded-2xl w-full max-w-md max-h-[90vh] overflow-hidden animate-fade-in">
        {/* 头部 */}
        <div className="flex items-center justify-between p-5 border-b border-zinc-800/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-violet-500/20 flex items-center justify-center">
              <Key className="w-5 h-5 text-violet-400" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-zinc-100">API 配置</h2>
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

        {/* 内容 */}
        <div className="p-5 space-y-4 overflow-y-auto max-h-[60vh]">
          {loading ? (
            <div className="text-center py-8">
              <div className="w-8 h-8 border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin mx-auto mb-3" />
              <p className="text-sm text-zinc-500">加载配置中...</p>
            </div>
          ) : !isConfigured ? (
            <div className="text-center py-8">
              <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center mx-auto mb-3">
                <AlertCircle className="w-6 h-6 text-amber-400" />
              </div>
              <p className="text-zinc-300 font-medium">未配置 API Key</p>
              <p className="text-xs text-zinc-500 mt-1">
                请在 backend/.env 文件中配置 NANO_BANANA_API_KEY
              </p>
            </div>
          ) : (
            <>
              {/* API Key */}
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-2">
                  API Key
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={config.apiKey}
                    readOnly
                    className="input-glass flex-1 px-3 py-2.5 rounded-xl text-zinc-300 cursor-not-allowed font-mono text-sm"
                  />
                  {config.apiKeyConfigured && (
                    <div className="w-9 h-9 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                      <CheckCircle className="w-4 h-4 text-emerald-400" />
                    </div>
                  )}
                </div>
              </div>

              {/* API 地址 */}
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-2">
                  API 地址
                </label>
                <input
                  type="text"
                  value={config.baseUrl}
                  readOnly
                  className="input-glass w-full px-3 py-2.5 rounded-xl text-zinc-300 cursor-not-allowed text-sm"
                />
              </div>

              {/* 提供商 */}
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-2">
                  提供商
                </label>
                <input
                  type="text"
                  value={config.provider}
                  readOnly
                  className="input-glass w-full px-3 py-2.5 rounded-xl text-zinc-300 cursor-not-allowed text-sm"
                />
              </div>
            </>
          )}

          {/* 消息显示 */}
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

          {/* 配置提示 */}
          {isConfigured && (
            <div className="glass-subtle rounded-xl p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-4 h-4 text-violet-400 mt-0.5 flex-shrink-0" />
                <div className="text-xs text-zinc-400">
                  <p className="font-medium text-zinc-300 mb-1.5">配置说明</p>
                  <ul className="space-y-1">
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
        <div className="flex items-center justify-end p-5 border-t border-zinc-800/50">
          <button
            onClick={handleClose}
            className="btn-glass px-4 py-2 rounded-xl text-sm text-zinc-300"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import { ApiConfig } from '../../../shared/types';
import { apiService } from '../services/api';
import { X, Save, TestTube, AlertCircle, CheckCircle } from 'lucide-react';

interface ApiConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfigSaved?: (config: ApiConfig) => void;
}

export const ApiConfigModal: React.FC<ApiConfigModalProps> = ({
  isOpen,
  onClose,
  onConfigSaved
}) => {
  const [config, setConfig] = useState<ApiConfig>({
    apiKey: '',
    baseUrl: 'https://grsai.dakka.com.cn/v1/draw',
    timeout: 300000,
    retryCount: 3,
    provider: 'Nano Banana'
  });
  
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

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
        setConfig(response.data);
      }
    } catch (error: any) {
      console.warn('加载 API 配置失败:', error);
      // 使用默认配置，不显示错误
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setLoading(true);
      setMessage(null);

      // 验证必填字段
      if (!config.apiKey.trim()) {
        setMessage({ type: 'error', text: '请输入 API Key' });
        return;
      }

      if (!config.baseUrl.trim()) {
        setMessage({ type: 'error', text: '请输入 API 地址' });
        return;
      }

      const response = await apiService.saveApiConfig(config);
      
      if (response.success) {
        setMessage({ type: 'success', text: 'API 配置保存成功' });
        onConfigSaved?.(config);
        
        // 2秒后关闭模态框
        setTimeout(() => {
          onClose();
          setMessage(null);
        }, 2000);
      } else {
        setMessage({ type: 'error', text: response.error || '保存失败' });
      }
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || '保存失败' });
    } finally {
      setLoading(false);
    }
  };

  const handleTest = async () => {
    try {
      setTesting(true);
      setMessage(null);

      if (!config.apiKey.trim()) {
        setMessage({ type: 'error', text: '请先输入 API Key' });
        return;
      }

      // 这里可以添加测试 API 连接的逻辑
      const response = await apiService.testConnection({ apiConfig: config });
      
      if (response.success) {
        setMessage({ type: 'success', text: 'API 连接测试成功' });
      } else {
        setMessage({ type: 'error', text: response.error || '连接测试失败' });
      }
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || '连接测试失败' });
    } finally {
      setTesting(false);
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
          <h2 className="text-lg font-semibold text-zinc-100">API 配置</h2>
          <button
            onClick={handleClose}
            className="p-1 hover:bg-zinc-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-zinc-400" />
          </button>
        </div>

        {/* 内容 */}
        <div className="p-6 space-y-4">
          {/* API Key */}
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">
              API Key *
            </label>
            <input
              type="password"
              value={config.apiKey}
              onChange={(e) => setConfig({ ...config, apiKey: e.target.value })}
              placeholder="请输入您的 Nano Banana API Key"
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-600 rounded-lg text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* API 地址 */}
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">
              API 地址 *
            </label>
            <input
              type="url"
              value={config.baseUrl}
              onChange={(e) => setConfig({ ...config, baseUrl: e.target.value })}
              placeholder="https://grsai.dakka.com.cn/v1/draw"
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-600 rounded-lg text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
              onChange={(e) => setConfig({ ...config, provider: e.target.value })}
              placeholder="Nano Banana"
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-600 rounded-lg text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* 超时时间 */}
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">
              超时时间 (毫秒)
            </label>
            <input
              type="number"
              value={config.timeout}
              onChange={(e) => setConfig({ ...config, timeout: parseInt(e.target.value) || 300000 })}
              min="10000"
              max="600000"
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-600 rounded-lg text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* 重试次数 */}
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">
              重试次数
            </label>
            <input
              type="number"
              value={config.retryCount}
              onChange={(e) => setConfig({ ...config, retryCount: parseInt(e.target.value) || 3 })}
              min="0"
              max="10"
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-600 rounded-lg text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* 消息显示 */}
          {message && (
            <div className={`flex items-center gap-2 p-3 rounded-lg ${
              message.type === 'success' 
                ? 'bg-green-600/20 text-green-300 border border-green-600/30' 
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
        <div className="flex items-center justify-between p-6 border-t border-zinc-700">
          <button
            onClick={handleTest}
            disabled={testing || loading}
            className="flex items-center gap-2 px-4 py-2 bg-zinc-700 hover:bg-zinc-600 disabled:bg-zinc-800 disabled:text-zinc-500 text-zinc-100 rounded-lg transition-colors"
          >
            <TestTube className="w-4 h-4" />
            {testing ? '测试中...' : '测试连接'}
          </button>

          <div className="flex items-center gap-3">
            <button
              onClick={handleClose}
              className="px-4 py-2 text-zinc-400 hover:text-zinc-100 transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleSave}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:text-blue-300 text-white rounded-lg transition-colors"
            >
              <Save className="w-4 h-4" />
              {loading ? '保存中...' : '保存'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
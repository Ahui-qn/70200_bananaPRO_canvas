import React, { useState, useEffect } from 'react';
import { ApiConfig } from '../types';
import { 
  Settings, 
  X, 
  Key, 
  Globe, 
  Clock, 
  RotateCcw, 
  Building,
  Eye,
  EyeOff,
  Save,
  RotateCcw as Reset
} from 'lucide-react';

interface ApiConfigProps {
  config: ApiConfig;
  onConfigChange: (config: ApiConfig) => void;
  isOpen: boolean;
  onClose: () => void;
}

// 预设的 API 配置
const API_PRESETS = [
  {
    name: 'Nano Banana (国内)',
    provider: 'Nano Banana',
    baseUrl: 'https://grsai.dakka.com.cn/v1/draw',
    timeout: 300000, // 5分钟
    retryCount: 3
  },
  {
    name: 'Nano Banana (海外)',
    provider: 'Nano Banana',
    baseUrl: 'https://grsai.global.com/v1/draw',
    timeout: 300000, // 5分钟
    retryCount: 3
  },
  {
    name: '自定义配置',
    provider: 'Custom',
    baseUrl: '',
    timeout: 300000, // 5分钟
    retryCount: 3
  }
];

export const ApiConfigModal: React.FC<ApiConfigProps> = ({ 
  config, 
  onConfigChange, 
  isOpen, 
  onClose 
}) => {
  const [localConfig, setLocalConfig] = useState<ApiConfig>(config);
  const [showApiKey, setShowApiKey] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // 当弹窗打开时重置本地配置和状态
  useEffect(() => {
    if (isOpen) {
      setLocalConfig(config);
      setHasChanges(false);
    }
  }, [isOpen, config]);

  // 更新本地配置
  const updateLocalConfig = (field: keyof ApiConfig, value: string | number) => {
    const newConfig = { ...localConfig, [field]: value };
    setLocalConfig(newConfig);
    setHasChanges(true);
  };

  // 应用预设配置
  const applyPreset = (preset: typeof API_PRESETS[0]) => {
    const newConfig = {
      ...localConfig,
      baseUrl: preset.baseUrl,
      timeout: preset.timeout,
      retryCount: preset.retryCount,
      provider: preset.provider
    };
    setLocalConfig(newConfig);
    setHasChanges(true);
  };

  // 保存配置
  const handleSave = () => {
    onConfigChange(localConfig);
    setHasChanges(false);
    onClose();
  };

  // 重置配置
  const handleReset = () => {
    setLocalConfig(config);
    setHasChanges(false);
  };

  // 关闭弹窗
  const handleClose = () => {
    if (hasChanges) {
      if (confirm('有未保存的更改，确定要关闭吗？')) {
        setLocalConfig(config);
        setHasChanges(false);
        onClose();
      }
    } else {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* 背景遮罩 */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={handleClose}
      />
      
      {/* 弹窗内容 */}
      <div className="relative w-full max-w-md mx-4 bg-zinc-900/95 backdrop-blur-xl border border-zinc-700 rounded-2xl shadow-2xl">
        
        {/* 头部 */}
        <div className="flex items-center justify-between p-6 border-b border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-600/20 rounded-lg flex items-center justify-center">
              <Settings className="w-4 h-4 text-blue-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-zinc-100">API 配置</h2>
              <p className="text-sm text-zinc-500">配置 API 接口和认证信息</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 内容区域 */}
        <div className="p-6 space-y-6 max-h-96 overflow-y-auto custom-scrollbar">
          
          {/* 预设配置 */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-zinc-300">快速配置</label>
            <div className="grid gap-2">
              {API_PRESETS.map((preset, index) => (
                <button
                  key={index}
                  onClick={() => applyPreset(preset)}
                  className="flex items-center justify-between p-3 bg-zinc-800/50 hover:bg-zinc-800 rounded-lg text-left transition-colors"
                >
                  <div>
                    <div className="text-sm font-medium text-zinc-200">{preset.name}</div>
                    <div className="text-xs text-zinc-500">{preset.baseUrl || '需要自定义配置'}</div>
                  </div>
                  <Building className="w-4 h-4 text-zinc-500" />
                </button>
              ))}
            </div>
          </div>

          {/* API 密钥 */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-300 flex items-center gap-2">
              <Key className="w-4 h-4" />
              API 密钥
              <span className="text-red-400">*</span>
            </label>
            <div className="relative">
              <input
                type={showApiKey ? "text" : "password"}
                value={localConfig.apiKey}
                onChange={(e) => updateLocalConfig('apiKey', e.target.value)}
                placeholder="输入你的 API 密钥..."
                className="w-full bg-zinc-800/50 border border-zinc-700 rounded-lg px-3 py-2.5 pr-10 text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent"
              />
              <button
                type="button"
                onClick={() => setShowApiKey(!showApiKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-zinc-700 rounded text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* API 基础地址 */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-300 flex items-center gap-2">
              <Globe className="w-4 h-4" />
              API 基础地址
            </label>
            <input
              type="url"
              value={localConfig.baseUrl}
              onChange={(e) => updateLocalConfig('baseUrl', e.target.value)}
              placeholder="https://api.example.com/v1"
              className="w-full bg-zinc-800/50 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent"
            />
          </div>

          {/* 服务提供商 */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-300 flex items-center gap-2">
              <Building className="w-4 h-4" />
              服务提供商
            </label>
            <input
              type="text"
              value={localConfig.provider}
              onChange={(e) => updateLocalConfig('provider', e.target.value)}
              placeholder="例如：Nano Banana"
              className="w-full bg-zinc-800/50 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent"
            />
          </div>

          {/* 高级设置 */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-zinc-300 flex items-center gap-2">
                <Clock className="w-4 h-4" />
                超时时间 (秒)
              </label>
              <input
                type="number"
                value={Math.round(localConfig.timeout / 1000)}
                onChange={(e) => updateLocalConfig('timeout', Math.max(5, parseInt(e.target.value) || 5) * 1000)}
                min="5"
                max="600"
                className="w-full bg-zinc-800/50 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-zinc-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent"
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium text-zinc-300 flex items-center gap-2">
                <RotateCcw className="w-4 h-4" />
                重试次数
              </label>
              <input
                type="number"
                value={localConfig.retryCount}
                onChange={(e) => updateLocalConfig('retryCount', Math.max(0, parseInt(e.target.value) || 0))}
                min="0"
                max="10"
                className="w-full bg-zinc-800/50 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-zinc-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent"
              />
            </div>
          </div>
        </div>

        {/* 底部按钮 */}
        <div className="flex items-center justify-between p-6 border-t border-zinc-800">
          <button
            onClick={handleReset}
            disabled={!hasChanges}
            className="flex items-center gap-2 px-4 py-2 text-sm text-zinc-400 hover:text-zinc-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Reset className="w-4 h-4" />
            重置
          </button>
          
          <div className="flex items-center gap-3">
            <button
              onClick={handleClose}
              className="px-4 py-2 text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleSave}
              disabled={!localConfig.apiKey.trim() || !hasChanges}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-700 disabled:text-zinc-500 text-white text-sm rounded-lg transition-colors disabled:cursor-not-allowed"
            >
              <Save className="w-4 h-4" />
              保存配置
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
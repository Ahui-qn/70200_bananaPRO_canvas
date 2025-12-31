import React, { useState, useEffect } from 'react';
import { apiService } from '../services/api';
import {
  X,
  AlertCircle,
  CheckCircle,
  Cloud,
  Lock,
} from 'lucide-react';

interface OSSConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfigSaved?: (config: any) => void;
}

interface OSSConfigDisplay {
  region: string;
  bucket: string;
  accessKeyId: string;
  accessKeyIdConfigured: boolean;
  accessKeySecret: string;
  accessKeySecretConfigured: boolean;
  endpoint: string;
}

export const OSSConfigModal: React.FC<OSSConfigModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [config, setConfig] = useState<OSSConfigDisplay>({
    region: '',
    bucket: '',
    accessKeyId: '',
    accessKeyIdConfigured: false,
    accessKeySecret: '',
    accessKeySecretConfigured: false,
    endpoint: '',
  });

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{
    type: 'success' | 'error' | 'info';
    text: string;
  } | null>(null);
  const [isConfigured, setIsConfigured] = useState(false);

  // 预定义的区域选项（用于显示友好名称）
  const regionLabels: Record<string, string> = {
    'oss-cn-hangzhou': '华东1（杭州）',
    'oss-cn-shanghai': '华东2（上海）',
    'oss-cn-qingdao': '华北1（青岛）',
    'oss-cn-beijing': '华北2（北京）',
    'oss-cn-zhangjiakou': '华北3（张家口）',
    'oss-cn-huhehaote': '华北5（呼和浩特）',
    'oss-cn-wulanchabu': '华北6（乌兰察布）',
    'oss-cn-shenzhen': '华南1（深圳）',
    'oss-cn-heyuan': '华南2（河源）',
    'oss-cn-guangzhou': '华南3（广州）',
    'oss-cn-chengdu': '西南1（成都）',
    'oss-cn-hongkong': '中国香港',
  };

  // 加载现有配置
  useEffect(() => {
    if (isOpen) {
      loadConfig();
    }
  }, [isOpen]);

  const loadConfig = async () => {
    try {
      setLoading(true);
      const response = await apiService.getOSSConfig();
      if (response.success && response.data) {
        setConfig({
          region: response.data.region || '',
          bucket: response.data.bucket || '',
          accessKeyId: response.data.accessKeyId || '',
          accessKeyIdConfigured: response.data.accessKeyIdConfigured || false,
          accessKeySecret: response.data.accessKeySecret || '',
          accessKeySecretConfigured:
            response.data.accessKeySecretConfigured || false,
          endpoint: response.data.endpoint || '',
        });
        setIsConfigured(
          !!(response.data.region && response.data.bucket)
        );
      }
    } catch (error: any) {
      console.warn('加载 OSS 配置失败:', error);
      setMessage({ type: 'error', text: '加载配置失败' });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setMessage(null);
    onClose();
  };

  const getRegionLabel = (region: string) => {
    return regionLabels[region] || region;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-zinc-900 rounded-xl border border-zinc-700 w-full max-w-md max-h-[90vh] overflow-y-auto">
        {/* 头部 */}
        <div className="flex items-center justify-between p-6 border-b border-zinc-700">
          <div className="flex items-center gap-3">
            <Cloud className="w-5 h-5 text-blue-400" />
            <h2 className="text-lg font-semibold text-zinc-100">
              OSS 云存储配置
            </h2>
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
              <p>未配置 OSS 云存储</p>
              <p className="text-xs mt-1">请在 backend/.env 文件中配置</p>
            </div>
          ) : (
            <>
              {/* 区域 */}
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                  区域
                </label>
                <input
                  type="text"
                  value={getRegionLabel(config.region)}
                  readOnly
                  className="w-full px-3 py-2 bg-zinc-800/50 border border-zinc-700 rounded-lg text-zinc-300 cursor-not-allowed"
                />
              </div>

              {/* 存储桶名称 */}
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                  存储桶名称
                </label>
                <input
                  type="text"
                  value={config.bucket}
                  readOnly
                  className="w-full px-3 py-2 bg-zinc-800/50 border border-zinc-700 rounded-lg text-zinc-300 cursor-not-allowed"
                />
              </div>

              {/* Access Key ID */}
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                  Access Key ID
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={config.accessKeyId}
                    readOnly
                    className="flex-1 px-3 py-2 bg-zinc-800/50 border border-zinc-700 rounded-lg text-zinc-300 cursor-not-allowed"
                  />
                  {config.accessKeyIdConfigured && (
                    <CheckCircle className="w-5 h-5 text-green-400" />
                  )}
                </div>
              </div>

              {/* Access Key Secret */}
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                  Access Key Secret
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="password"
                    value={config.accessKeySecret}
                    readOnly
                    className="flex-1 px-3 py-2 bg-zinc-800/50 border border-zinc-700 rounded-lg text-zinc-300 cursor-not-allowed"
                  />
                  {config.accessKeySecretConfigured && (
                    <CheckCircle className="w-5 h-5 text-green-400" />
                  )}
                </div>
              </div>

              {/* Endpoint */}
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                  Endpoint
                </label>
                <input
                  type="text"
                  value={config.endpoint}
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
            <div className="bg-blue-600/10 border border-blue-600/20 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-blue-400 mt-0.5" />
                <div className="text-xs text-blue-300">
                  <p className="font-medium mb-1">配置说明：</p>
                  <ul className="space-y-1 text-blue-200">
                    <li>• OSS 配置从 .env 文件读取</li>
                    <li>• 敏感信息已部分隐藏</li>
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

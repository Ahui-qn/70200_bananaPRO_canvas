import React, { useState, useEffect } from 'react';
import { OSSConfig } from '../../../shared/types';
import { apiService } from '../services/api';
import { X, Save, TestTube, AlertCircle, CheckCircle, Cloud } from 'lucide-react';

interface OSSConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfigSaved?: (config: OSSConfig) => void;
}

export const OSSConfigModal: React.FC<OSSConfigModalProps> = ({
  isOpen,
  onClose,
  onConfigSaved
}) => {
  const [config, setConfig] = useState<OSSConfig>({
    region: 'oss-cn-shenzhen',
    bucket: '',
    accessKeyId: '',
    accessKeySecret: '',
    endpoint: '',
    customDomain: '',
    enabled: false
  });
  
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  // 预定义的区域选项
  const regions = [
    { value: 'oss-cn-hangzhou', label: '华东1（杭州）' },
    { value: 'oss-cn-shanghai', label: '华东2（上海）' },
    { value: 'oss-cn-qingdao', label: '华北1（青岛）' },
    { value: 'oss-cn-beijing', label: '华北2（北京）' },
    { value: 'oss-cn-zhangjiakou', label: '华北3（张家口）' },
    { value: 'oss-cn-huhehaote', label: '华北5（呼和浩特）' },
    { value: 'oss-cn-wulanchabu', label: '华北6（乌兰察布）' },
    { value: 'oss-cn-shenzhen', label: '华南1（深圳）' },
    { value: 'oss-cn-heyuan', label: '华南2（河源）' },
    { value: 'oss-cn-guangzhou', label: '华南3（广州）' },
    { value: 'oss-cn-chengdu', label: '西南1（成都）' },
    { value: 'oss-cn-hongkong', label: '中国香港' }
  ];

  // 加载现有配置
  useEffect(() => {
    if (isOpen) {
      loadConfig();
    }
  }, [isOpen]);

  // 当区域改变时自动更新 endpoint
  useEffect(() => {
    if (config.region) {
      setConfig(prev => ({
        ...prev,
        endpoint: `https://${config.region}.aliyuncs.com`
      }));
    }
  }, [config.region]);

  const loadConfig = async () => {
    try {
      setLoading(true);
      const response = await apiService.getOSSConfig();
      if (response.success && response.data) {
        setConfig(response.data);
      }
    } catch (error: any) {
      console.warn('加载 OSS 配置失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setLoading(true);
      setMessage(null);

      // 验证必填字段
      if (!config.bucket.trim()) {
        setMessage({ type: 'error', text: '请输入存储桶名称' });
        return;
      }

      if (!config.accessKeyId.trim()) {
        setMessage({ type: 'error', text: '请输入 Access Key ID' });
        return;
      }

      if (!config.accessKeySecret.trim()) {
        setMessage({ type: 'error', text: '请输入 Access Key Secret' });
        return;
      }

      const response = await apiService.saveOSSConfig(config);
      
      if (response.success) {
        setMessage({ type: 'success', text: 'OSS 配置保存成功' });
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

      if (!config.bucket.trim() || !config.accessKeyId.trim() || !config.accessKeySecret.trim()) {
        setMessage({ type: 'error', text: '请先填写完整的 OSS 配置信息' });
        return;
      }

      const response = await apiService.testOSSConnection(config);
      
      if (response.success) {
        setMessage({ type: 'success', text: 'OSS 连接测试成功' });
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
          <div className="flex items-center gap-3">
            <Cloud className="w-5 h-5 text-blue-400" />
            <h2 className="text-lg font-semibold text-zinc-100">OSS 云存储配置</h2>
          </div>
          <button
            onClick={handleClose}
            className="p-1 hover:bg-zinc-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-zinc-400" />
          </button>
        </div>

        {/* 内容 */}
        <div className="p-6 space-y-4">
          {/* 区域选择 */}
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">
              区域 *
            </label>
            <select
              value={config.region}
              onChange={(e) => setConfig({ ...config, region: e.target.value })}
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-600 rounded-lg text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {regions.map(region => (
                <option key={region.value} value={region.value}>
                  {region.label}
                </option>
              ))}
            </select>
          </div>

          {/* 存储桶名称 */}
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">
              存储桶名称 *
            </label>
            <input
              type="text"
              value={config.bucket}
              onChange={(e) => setConfig({ ...config, bucket: e.target.value })}
              placeholder="your-bucket-name"
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-600 rounded-lg text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Access Key ID */}
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">
              Access Key ID *
            </label>
            <input
              type="text"
              value={config.accessKeyId}
              onChange={(e) => setConfig({ ...config, accessKeyId: e.target.value })}
              placeholder="请输入 Access Key ID"
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-600 rounded-lg text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Access Key Secret */}
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">
              Access Key Secret *
            </label>
            <input
              type="password"
              value={config.accessKeySecret}
              onChange={(e) => setConfig({ ...config, accessKeySecret: e.target.value })}
              placeholder="请输入 Access Key Secret"
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-600 rounded-lg text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Endpoint */}
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">
              Endpoint
            </label>
            <input
              type="url"
              value={config.endpoint}
              onChange={(e) => setConfig({ ...config, endpoint: e.target.value })}
              placeholder="https://oss-cn-shenzhen.aliyuncs.com"
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-600 rounded-lg text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* 自定义域名 */}
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">
              自定义域名（可选）
            </label>
            <input
              type="url"
              value={config.customDomain}
              onChange={(e) => setConfig({ ...config, customDomain: e.target.value })}
              placeholder="https://your-domain.com"
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-600 rounded-lg text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <p className="text-xs text-zinc-500 mt-1">
              如果配置了自定义域名，将使用自定义域名访问文件
            </p>
          </div>

          {/* 启用开关 */}
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="enabled"
              checked={config.enabled}
              onChange={(e) => setConfig({ ...config, enabled: e.target.checked })}
              className="w-4 h-4 text-blue-600 bg-zinc-800 border-zinc-600 rounded focus:ring-blue-500 focus:ring-2"
            />
            <label htmlFor="enabled" className="text-sm text-zinc-300">
              启用 OSS 云存储
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

          {/* 配置提示 */}
          <div className="bg-blue-600/10 border border-blue-600/20 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-blue-400 mt-0.5" />
              <div className="text-xs text-blue-300">
                <p className="font-medium mb-1">配置提示：</p>
                <ul className="space-y-1 text-blue-200">
                  <li>• 请确保 OSS 存储桶已配置 CORS 规则</li>
                  <li>• 建议设置存储桶权限为"公共读"</li>
                  <li>• Access Key 需要有 OSS 相关权限</li>
                </ul>
              </div>
            </div>
          </div>
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
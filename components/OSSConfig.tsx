import React, { useState, useEffect } from 'react';
import { OSSConfig } from '../services/ossStorage';
import { loadOSSConfig, saveOSSConfig, clearOSSConfig, ossStorage } from '../services/ossStorage';
import { 
  X, 
  Save, 
  TestTube, 
  Eye, 
  EyeOff,
  CheckCircle,
  XCircle,
  AlertCircle,
  Cloud,
  Settings
} from 'lucide-react';

interface OSSConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfigChange?: (config: OSSConfig | null) => void;
}

export const OSSConfigModal: React.FC<OSSConfigModalProps> = ({ 
  isOpen, 
  onClose, 
  onConfigChange 
}) => {
  const [config, setConfig] = useState<OSSConfig>({
    region: 'oss-cn-shenzhen',
    accessKeyId: '',
    accessKeySecret: '',
    bucket: '',
    endpoint: ''
  });
  
  const [showSecrets, setShowSecrets] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null);
  const [saving, setSaving] = useState(false);

  // 加载已保存的配置
  useEffect(() => {
    if (isOpen) {
      const savedConfig = loadOSSConfig();
      if (savedConfig) {
        setConfig(savedConfig);
      }
    }
  }, [isOpen]);

  // 处理配置变更
  const handleConfigChange = (field: keyof OSSConfig, value: string) => {
    setConfig(prev => ({
      ...prev,
      [field]: value
    }));
    setTestResult(null); // 清除测试结果
  };

  // 测试连接
  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);

    try {
      // 临时设置配置进行测试
      ossStorage.setConfig(config);
      const success = await ossStorage.testConnection();
      
      setTestResult(success ? 'success' : 'error');
    } catch (error) {
      console.error('测试连接失败:', error);
      setTestResult('error');
    } finally {
      setTesting(false);
    }
  };

  // 保存配置
  const handleSave = async () => {
    setSaving(true);
    
    try {
      saveOSSConfig(config);
      
      if (onConfigChange) {
        onConfigChange(config);
      }
      
      // 显示成功提示
      setTestResult('success');
      
      // 延迟关闭弹窗
      setTimeout(() => {
        onClose();
      }, 1000);
      
    } catch (error) {
      console.error('保存配置失败:', error);
      setTestResult('error');
    } finally {
      setSaving(false);
    }
  };

  // 清除配置
  const handleClear = () => {
    if (confirm('确定要清除 OSS 配置吗？')) {
      clearOSSConfig();
      setConfig({
        region: 'oss-cn-hangzhou',
        accessKeyId: '',
        accessKeySecret: '',
        bucket: '',
        endpoint: ''
      });
      
      if (onConfigChange) {
        onConfigChange(null);
      }
      
      setTestResult(null);
    }
  };

  // 检查配置是否完整
  const isConfigComplete = config.region && config.accessKeyId && config.accessKeySecret && config.bucket;

  // 检查配置是否有变更
  const hasChanges = () => {
    const savedConfig = loadOSSConfig();
    if (!savedConfig) return isConfigComplete;
    
    return JSON.stringify(config) !== JSON.stringify(savedConfig);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* 背景遮罩 */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* 弹窗内容 */}
      <div className="relative w-full max-w-2xl mx-4 bg-zinc-900/95 backdrop-blur-xl border border-zinc-700 rounded-2xl shadow-2xl">
        
        {/* 头部 */}
        <div className="flex items-center justify-between p-6 border-b border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600/20 rounded-xl flex items-center justify-center">
              <Cloud className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-zinc-100">阿里云 OSS 配置</h2>
              <p className="text-sm text-zinc-500">配置云存储服务，自动备份生成的图片</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 配置表单 */}
        <div className="p-6 space-y-6">
          
          {/* 基础配置 */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-zinc-200 flex items-center gap-2">
              <Settings className="w-5 h-5" />
              基础配置
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                  区域 (Region) *
                </label>
                <select
                  value={config.region}
                  onChange={(e) => handleConfigChange('region', e.target.value)}
                  className="w-full bg-zinc-800/50 border border-zinc-700 rounded-lg px-3 py-2 text-zinc-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                >
                  <option value="oss-cn-hangzhou">华东1（杭州）</option>
                  <option value="oss-cn-shanghai">华东2（上海）</option>
                  <option value="oss-cn-beijing">华北2（北京）</option>
                  <option value="oss-cn-shenzhen">华南1（深圳）</option>
                  <option value="oss-cn-guangzhou">华南2（广州）</option>
                  <option value="oss-cn-chengdu">西南1（成都）</option>
                  <option value="oss-cn-hongkong">中国香港</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                  存储桶名称 (Bucket) *
                </label>
                <input
                  type="text"
                  value={config.bucket}
                  onChange={(e) => handleConfigChange('bucket', e.target.value)}
                  placeholder="your-bucket-name"
                  className="w-full bg-zinc-800/50 border border-zinc-700 rounded-lg px-3 py-2 text-zinc-200 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">
                自定义域名 (可选)
              </label>
              <input
                type="text"
                value={config.endpoint}
                onChange={(e) => handleConfigChange('endpoint', e.target.value)}
                placeholder="your-custom-domain.com"
                className="w-full bg-zinc-800/50 border border-zinc-700 rounded-lg px-3 py-2 text-zinc-200 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              />
              <p className="text-xs text-zinc-500 mt-1">
                如果配置了自定义域名，将使用自定义域名访问图片
              </p>
            </div>
          </div>

          {/* 访问凭证 */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-zinc-200 flex items-center gap-2">
              <AlertCircle className="w-5 h-5" />
              访问凭证
            </h3>
            
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-amber-400 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-amber-200">
                  <p className="font-medium mb-1">安全提示</p>
                  <p>请确保 AccessKey 具有 OSS 的读写权限。建议创建专用的子账号和 AccessKey，避免使用主账号凭证。</p>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">
                AccessKey ID *
              </label>
              <input
                type="text"
                value={config.accessKeyId}
                onChange={(e) => handleConfigChange('accessKeyId', e.target.value)}
                placeholder="LTAI..."
                className="w-full bg-zinc-800/50 border border-zinc-700 rounded-lg px-3 py-2 text-zinc-200 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">
                AccessKey Secret *
              </label>
              <div className="relative">
                <input
                  type={showSecrets ? "text" : "password"}
                  value={config.accessKeySecret}
                  onChange={(e) => handleConfigChange('accessKeySecret', e.target.value)}
                  placeholder="请输入 AccessKey Secret"
                  className="w-full bg-zinc-800/50 border border-zinc-700 rounded-lg px-3 py-2 pr-10 text-zinc-200 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                />
                <button
                  type="button"
                  onClick={() => setShowSecrets(!showSecrets)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-200"
                >
                  {showSecrets ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>

          {/* 测试结果 */}
          {testResult && (
            <div className={`flex items-center gap-3 p-4 rounded-lg ${
              testResult === 'success' 
                ? 'bg-green-500/10 border border-green-500/20 text-green-300' 
                : 'bg-red-500/10 border border-red-500/20 text-red-300'
            }`}>
              {testResult === 'success' ? (
                <CheckCircle className="w-5 h-5" />
              ) : (
                <XCircle className="w-5 h-5" />
              )}
              <span className="text-sm font-medium">
                {testResult === 'success' ? 'OSS 连接测试成功！' : 'OSS 连接测试失败，请检查配置'}
              </span>
            </div>
          )}
        </div>

        {/* 底部操作 */}
        <div className="flex items-center justify-between p-6 border-t border-zinc-800">
          <button
            onClick={handleClear}
            className="px-4 py-2 text-sm text-zinc-400 hover:text-red-400 transition-colors"
          >
            清除配置
          </button>
          
          <div className="flex items-center gap-3">
            <button
              onClick={handleTestConnection}
              disabled={!isConfigComplete || testing}
              className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 disabled:bg-zinc-800/50 disabled:text-zinc-500 text-zinc-200 rounded-lg text-sm transition-colors"
            >
              <TestTube className="w-4 h-4" />
              {testing ? '测试中...' : '测试连接'}
            </button>
            
            <button
              onClick={handleSave}
              disabled={!isConfigComplete || !hasChanges() || saving}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-600/50 disabled:text-blue-300 text-white rounded-lg text-sm transition-colors"
            >
              <Save className="w-4 h-4" />
              {saving ? '保存中...' : '保存配置'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
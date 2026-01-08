import React, { useState, useEffect } from 'react';
import { apiService } from '../services/api';
import {
  X,
  AlertCircle,
  CheckCircle,
  Cloud,
  Lock,
  RefreshCw,
  AlertTriangle,
  XCircle,
} from 'lucide-react';

interface OSSConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfigSaved?: (config: any) => void;
}

interface OSSConfigDisplay {
  mode: string;
  modeName: string;
  region?: string;
  bucket?: string;
  path?: string;
  serverUrl?: string;
  isLocal: boolean;
}

// OSS 状态类型
type OSSStatusType = 'connected' | 'disconnected' | 'not_configured' | 'auth_error' | 'access_denied' | 'bucket_not_found' | 'time_error' | 'arrears' | 'error' | 'checking';

interface OSSStatus {
  isConnected: boolean;
  status: OSSStatusType;
  message: string;
  errorCode?: string;
  errorDetail?: string;
}

export const OSSConfigModal: React.FC<OSSConfigModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [config, setConfig] = useState<OSSConfigDisplay>({
    mode: 'oss',
    modeName: '阿里云 OSS',
    region: '',
    bucket: '',
    isLocal: false,
  });

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{
    type: 'success' | 'error' | 'info';
    text: string;
  } | null>(null);
  const [isConfigured, setIsConfigured] = useState(false);
  
  // OSS 连接状态
  const [ossStatus, setOssStatus] = useState<OSSStatus | null>(null);
  const [checkingStatus, setCheckingStatus] = useState(false);

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

  useEffect(() => {
    if (isOpen) {
      loadConfig();
      checkOSSStatus();
    }
  }, [isOpen]);

  const loadConfig = async () => {
    try {
      setLoading(true);
      const response = await apiService.getOSSConfig();
      if (response.success && response.data) {
        const data = response.data as any;
        setConfig({
          mode: data.mode || 'oss',
          modeName: data.modeName || '阿里云 OSS',
          region: data.region || '',
          bucket: data.bucket || '',
          path: data.path || '',
          serverUrl: data.serverUrl || '',
          isLocal: data.isLocal || false,
        });
        // 本地模式或 OSS 配置完整都算已配置
        setIsConfigured(data.isLocal || !!(data.region && data.bucket));
      }
    } catch (error: any) {
      console.warn('加载存储配置失败:', error);
      setMessage({ type: 'error', text: '加载配置失败' });
    } finally {
      setLoading(false);
    }
  };

  // 检查 OSS 连接状态
  const checkOSSStatus = async () => {
    try {
      setCheckingStatus(true);
      setOssStatus({ isConnected: false, status: 'checking', message: '正在检查连接...' });
      
      const response = await apiService.getOSSStatus();
      if (response.success && response.data) {
        setOssStatus(response.data);
      } else {
        setOssStatus({
          isConnected: false,
          status: 'error',
          message: response.error || '检查状态失败'
        });
      }
    } catch (error: any) {
      console.warn('检查 OSS 状态失败:', error);
      setOssStatus({
        isConnected: false,
        status: 'error',
        message: '无法连接到服务器'
      });
    } finally {
      setCheckingStatus(false);
    }
  };

  // 获取状态显示信息
  const getStatusDisplay = (status: OSSStatus | null) => {
    if (!status) return null;
    
    switch (status.status) {
      case 'checking':
        return {
          icon: <RefreshCw className="w-4 h-4 animate-spin" />,
          color: 'text-blue-400',
          bgColor: 'bg-blue-500/10 border-blue-500/20',
          label: '检查中'
        };
      case 'connected':
        return {
          icon: <CheckCircle className="w-4 h-4" />,
          color: 'text-emerald-400',
          bgColor: 'bg-emerald-500/10 border-emerald-500/20',
          label: '已连接'
        };
      case 'not_configured':
        return {
          icon: <AlertCircle className="w-4 h-4" />,
          color: 'text-amber-400',
          bgColor: 'bg-amber-500/10 border-amber-500/20',
          label: '未配置'
        };
      case 'auth_error':
        return {
          icon: <XCircle className="w-4 h-4" />,
          color: 'text-red-400',
          bgColor: 'bg-red-500/10 border-red-500/20',
          label: '认证失败'
        };
      case 'access_denied':
      case 'arrears':
        return {
          icon: <AlertTriangle className="w-4 h-4" />,
          color: 'text-orange-400',
          bgColor: 'bg-orange-500/10 border-orange-500/20',
          label: status.status === 'arrears' ? '账户欠费' : '访问被拒绝'
        };
      case 'bucket_not_found':
        return {
          icon: <XCircle className="w-4 h-4" />,
          color: 'text-red-400',
          bgColor: 'bg-red-500/10 border-red-500/20',
          label: 'Bucket 不存在'
        };
      default:
        return {
          icon: <XCircle className="w-4 h-4" />,
          color: 'text-red-400',
          bgColor: 'bg-red-500/10 border-red-500/20',
          label: '连接失败'
        };
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
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="glass-card rounded-2xl w-full max-w-md max-h-[90vh] overflow-hidden animate-fade-in">
        {/* 头部 */}
        <div className="flex items-center justify-between p-5 border-b border-zinc-800/50">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${config.isLocal ? 'bg-green-500/20' : 'bg-blue-500/20'}`}>
              <Cloud className={`w-5 h-5 ${config.isLocal ? 'text-green-400' : 'text-blue-400'}`} />
            </div>
            <div>
              <h2 className="text-base font-semibold text-zinc-100">{config.modeName || '存储配置'}</h2>
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
              <div className="w-8 h-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mx-auto mb-3" />
              <p className="text-sm text-zinc-500">加载配置中...</p>
            </div>
          ) : !isConfigured ? (
            <div className="text-center py-8">
              <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center mx-auto mb-3">
                <AlertCircle className="w-6 h-6 text-amber-400" />
              </div>
              <p className="text-zinc-300 font-medium">未配置存储</p>
              <p className="text-xs text-zinc-500 mt-1">请在 backend/.env 文件中配置</p>
            </div>
          ) : config.isLocal ? (
            /* 本地存储模式 */
            <>
              {/* 本地存储状态 */}
              {ossStatus && (
                <div className={`flex items-center justify-between p-3 rounded-xl border ${getStatusDisplay(ossStatus)?.bgColor}`}>
                  <div className="flex items-center gap-2">
                    <span className={getStatusDisplay(ossStatus)?.color}>
                      {getStatusDisplay(ossStatus)?.icon}
                    </span>
                    <div>
                      <span className={`text-sm font-medium ${getStatusDisplay(ossStatus)?.color}`}>
                        {getStatusDisplay(ossStatus)?.label}
                      </span>
                      <p className="text-xs text-zinc-500 mt-0.5">{ossStatus.message}</p>
                    </div>
                  </div>
                  <button
                    onClick={checkOSSStatus}
                    disabled={checkingStatus}
                    className="btn-glass p-2 rounded-lg hover:bg-white/5 disabled:opacity-50"
                    title="重新检查"
                  >
                    <RefreshCw className={`w-4 h-4 text-zinc-400 ${checkingStatus ? 'animate-spin' : ''}`} />
                  </button>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-2">存储路径</label>
                <input
                  type="text"
                  value={config.path || ''}
                  readOnly
                  className="input-glass w-full px-3 py-2 rounded-xl text-zinc-300 cursor-not-allowed text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-2">访问地址</label>
                <input
                  type="text"
                  value={config.serverUrl || ''}
                  readOnly
                  className="input-glass w-full px-3 py-2 rounded-xl text-zinc-300 cursor-not-allowed text-sm"
                />
              </div>

              <p className="text-xs text-green-400 flex items-center gap-1">
                📁 本地存储模式，图片保存在本地文件系统
              </p>
            </>
          ) : (
            <>
              {/* OSS 云存储模式 */}
              {/* OSS 连接状态 */}
              {ossStatus && (
                <div className={`flex items-center justify-between p-3 rounded-xl border ${getStatusDisplay(ossStatus)?.bgColor}`}>
                  <div className="flex items-center gap-2">
                    <span className={getStatusDisplay(ossStatus)?.color}>
                      {getStatusDisplay(ossStatus)?.icon}
                    </span>
                    <div>
                      <span className={`text-sm font-medium ${getStatusDisplay(ossStatus)?.color}`}>
                        {getStatusDisplay(ossStatus)?.label}
                      </span>
                      <p className="text-xs text-zinc-500 mt-0.5">{ossStatus.message}</p>
                    </div>
                  </div>
                  <button
                    onClick={checkOSSStatus}
                    disabled={checkingStatus}
                    className="btn-glass p-2 rounded-lg hover:bg-white/5 disabled:opacity-50"
                    title="重新检查"
                  >
                    <RefreshCw className={`w-4 h-4 text-zinc-400 ${checkingStatus ? 'animate-spin' : ''}`} />
                  </button>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-2">区域</label>
                  <input
                    type="text"
                    value={getRegionLabel(config.region || '')}
                    readOnly
                    className="input-glass w-full px-3 py-2 rounded-xl text-zinc-300 cursor-not-allowed text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-2">存储桶</label>
                  <input
                    type="text"
                    value={config.bucket || ''}
                    readOnly
                    className="input-glass w-full px-3 py-2 rounded-xl text-zinc-300 cursor-not-allowed text-sm"
                  />
                </div>
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

          {isConfigured && (
            <div className="glass-subtle rounded-xl p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
                <div className="text-xs text-zinc-400">
                  <p className="font-medium text-zinc-300 mb-1.5">配置说明</p>
                  <ul className="space-y-1">
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

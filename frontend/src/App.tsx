import { useState, useEffect } from 'react';
import { GenerationSettings, ApiConfig, DatabaseConfig, OSSConfig } from '../../shared/types';
import { apiService } from './services/api';
import { ApiConfigModal } from './components/ApiConfigModal';
import { DatabaseConfigModal } from './components/DatabaseConfigModal';
import { OSSConfigModal } from './components/OSSConfigModal';
import { TestStyles } from './TestStyles';
import { 
  Zap, 
  Settings, 
  Image as ImageIcon, 
  Cloud, 
  Database,
  Activity,
  CheckCircle,
  AlertCircle,
  XCircle,
  Wifi,
  WifiOff
} from 'lucide-react';

const DEFAULT_SETTINGS: GenerationSettings = {
  model: 'nano-banana-fast',
  prompt: '',
  aspectRatio: 'auto',
  imageSize: '1K',
  refImageUrl: '',
  refImages: []
};

const DEFAULT_API_CONFIG: ApiConfig = {
  apiKey: '',
  baseUrl: 'https://grsai.dakka.com.cn/v1/draw',
  timeout: 300000,
  retryCount: 3,
  provider: 'Nano Banana'
};

function App() {
  const [apiConfig, setApiConfig] = useState<ApiConfig>(DEFAULT_API_CONFIG);
  const [databaseConfig, setDatabaseConfig] = useState<DatabaseConfig | null>(null);
  const [ossConfig, setOssConfig] = useState<OSSConfig | null>(null);
  
  // 模态框状态
  const [showApiConfig, setShowApiConfig] = useState(false);
  const [showDatabaseConfig, setShowDatabaseConfig] = useState(false);
  const [showOSSConfig, setShowOSSConfig] = useState(false);
  
  // 连接状态
  const [backendConnected, setBackendConnected] = useState(false);
  const [databaseConnected, setDatabaseConnected] = useState(false);
  const [ossConnected, setOssConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showTestStyles, setShowTestStyles] = useState(false);

  // 初始化应用
  useEffect(() => {
    initializeApp();
  }, []);

  const initializeApp = async () => {
    try {
      setLoading(true);
      // 测试后端连接
      const healthResponse = await apiService.healthCheck();
      setBackendConnected(healthResponse.success);
      
      if (healthResponse.success) {
        // 加载配置
        await loadConfigs();
        // 检查数据库状态
        await checkDatabaseStatus();
      }
    } catch (error: any) {
      console.error('应用初始化失败:', error);
      setBackendConnected(false);
    } finally {
      setLoading(false);
    }
  };

  const loadConfigs = async () => {
    try {
      // 加载 API 配置
      const apiResponse = await apiService.getApiConfig();
      if (apiResponse.success && apiResponse.data) {
        setApiConfig(apiResponse.data);
      }
    } catch (error) {
      console.warn('加载配置失败:', error);
    }
  };

  const checkDatabaseStatus = async () => {
    try {
      const response = await apiService.getDatabaseStatus();
      if (response.success && response.data) {
        setDatabaseConnected(response.data.isConnected || false);
      }
    } catch (error) {
      console.warn('检查数据库状态失败:', error);
    }
  };

  // 测试后端连接
  const testBackendConnection = async () => {
    try {
      setLoading(true);
      const response = await apiService.healthCheck();
      if (response.success) {
        setBackendConnected(true);
        await loadConfigs();
        await checkDatabaseStatus();
      } else {
        setBackendConnected(false);
      }
    } catch (error: any) {
      setBackendConnected(false);
    } finally {
      setLoading(false);
    }
  };

  // 获取服务状态
  const getServiceStatus = () => {
    if (!backendConnected) {
      return { 
        status: 'error', 
        text: '服务离线', 
        icon: XCircle,
        color: 'text-red-400',
        bgColor: 'bg-red-500/10',
        borderColor: 'border-red-500/20'
      };
    }
    
    if (!apiConfig.apiKey) {
      return { 
        status: 'warning', 
        text: '需要配置', 
        icon: AlertCircle,
        color: 'text-yellow-400',
        bgColor: 'bg-yellow-500/10',
        borderColor: 'border-yellow-500/20'
      };
    }
    
    return { 
      status: 'success', 
      text: '运行正常', 
      icon: CheckCircle,
      color: 'text-green-400',
      bgColor: 'bg-green-500/10',
      borderColor: 'border-green-500/20'
    };
  };

  const serviceStatus = getServiceStatus();
  const StatusIcon = serviceStatus.icon;

  // 临时显示样式测试页面
  if (showTestStyles) {
    return <TestStyles />;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-400 mx-auto mb-4"></div>
          <p className="text-purple-200">正在初始化应用...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* 顶部导航栏 */}
      <nav className="bg-black/20 backdrop-blur-xl border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo 和标题 */}
            <div className="flex items-center space-x-3">
              <div className="flex-shrink-0">
                <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl flex items-center justify-center shadow-lg">
                  <Zap className="w-6 h-6 text-white" />
                </div>
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">Nano Banana AI</h1>
                <div className="flex items-center space-x-2">
                  <StatusIcon className={`w-3 h-3 ${serviceStatus.color}`} />
                  <span className={`text-xs ${serviceStatus.color}`}>{serviceStatus.text}</span>
                </div>
              </div>
            </div>

            {/* 右侧按钮 */}
            <div className="flex items-center space-x-3">
              <button
                onClick={() => setShowApiConfig(true)}
                className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-all duration-200 ${
                  apiConfig.apiKey
                    ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30 hover:bg-blue-500/30'
                    : 'bg-gray-500/20 text-gray-300 border border-gray-500/30 hover:bg-gray-500/30'
                }`}
              >
                <Settings className="w-4 h-4" />
                <span className="hidden sm:inline">API 配置</span>
              </button>
              
              <button
                onClick={() => setShowDatabaseConfig(true)}
                className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-all duration-200 ${
                  databaseConnected
                    ? 'bg-green-500/20 text-green-300 border border-green-500/30 hover:bg-green-500/30'
                    : 'bg-gray-500/20 text-gray-300 border border-gray-500/30 hover:bg-gray-500/30'
                }`}
              >
                <Database className="w-4 h-4" />
                <span className="hidden sm:inline">数据库</span>
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* 主要内容区域 */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 欢迎区域 */}
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold text-white mb-4">
            欢迎使用 AI 画布
          </h2>
          <p className="text-xl text-purple-200 mb-8">
            强大的 AI 图片生成工具，让创意无限可能
          </p>
          
          {/* 快速操作按钮 */}
          <div className="flex flex-wrap justify-center gap-4">
            <button
              onClick={testBackendConnection}
              disabled={loading}
              className="flex items-center space-x-2 px-6 py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-800 text-white rounded-lg font-medium transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
            >
              {backendConnected ? <Wifi className="w-5 h-5" /> : <WifiOff className="w-5 h-5" />}
              <span>{loading ? '检测中...' : '测试连接'}</span>
            </button>
            
            <button
              onClick={() => setShowApiConfig(true)}
              className="flex items-center space-x-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
            >
              <Settings className="w-5 h-5" />
              <span>配置 API</span>
            </button>
            
            <button
              onClick={() => setShowTestStyles(true)}
              className="flex items-center space-x-2 px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
            >
              <span>样式测试</span>
            </button>
          </div>
        </div>

        {/* 状态卡片网格 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          {/* 后端服务状态 */}
          <div className={`p-6 rounded-xl border backdrop-blur-sm ${serviceStatus.bgColor} ${serviceStatus.borderColor}`}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">后端服务</h3>
              <Activity className={`w-6 h-6 ${serviceStatus.color}`} />
            </div>
            <div className="flex items-center space-x-2">
              <StatusIcon className={`w-4 h-4 ${serviceStatus.color}`} />
              <span className={`text-sm ${serviceStatus.color}`}>
                {backendConnected ? '运行正常' : '连接失败'}
              </span>
            </div>
          </div>

          {/* API 配置状态 */}
          <div className={`p-6 rounded-xl border backdrop-blur-sm ${
            apiConfig.apiKey 
              ? 'bg-blue-500/10 border-blue-500/20' 
              : 'bg-gray-500/10 border-gray-500/20'
          }`}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">API 配置</h3>
              <Settings className={`w-6 h-6 ${apiConfig.apiKey ? 'text-blue-400' : 'text-gray-400'}`} />
            </div>
            <div className="flex items-center space-x-2">
              {apiConfig.apiKey ? (
                <CheckCircle className="w-4 h-4 text-blue-400" />
              ) : (
                <AlertCircle className="w-4 h-4 text-gray-400" />
              )}
              <span className={`text-sm ${apiConfig.apiKey ? 'text-blue-400' : 'text-gray-400'}`}>
                {apiConfig.apiKey ? '已配置' : '未配置'}
              </span>
            </div>
          </div>

          {/* 数据库状态 */}
          <div className={`p-6 rounded-xl border backdrop-blur-sm ${
            databaseConnected 
              ? 'bg-green-500/10 border-green-500/20' 
              : 'bg-gray-500/10 border-gray-500/20'
          }`}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">数据库</h3>
              <Database className={`w-6 h-6 ${databaseConnected ? 'text-green-400' : 'text-gray-400'}`} />
            </div>
            <div className="flex items-center space-x-2">
              {databaseConnected ? (
                <CheckCircle className="w-4 h-4 text-green-400" />
              ) : (
                <XCircle className="w-4 h-4 text-gray-400" />
              )}
              <span className={`text-sm ${databaseConnected ? 'text-green-400' : 'text-gray-400'}`}>
                {databaseConnected ? '已连接' : '未连接'}
              </span>
            </div>
          </div>

          {/* 云存储状态 */}
          <div className={`p-6 rounded-xl border backdrop-blur-sm ${
            ossConnected 
              ? 'bg-green-500/10 border-green-500/20' 
              : 'bg-gray-500/10 border-gray-500/20'
          }`}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">云存储</h3>
              <Cloud className={`w-6 h-6 ${ossConnected ? 'text-green-400' : 'text-gray-400'}`} />
            </div>
            <div className="flex items-center space-x-2">
              {ossConnected ? (
                <CheckCircle className="w-4 h-4 text-green-400" />
              ) : (
                <AlertCircle className="w-4 h-4 text-gray-400" />
              )}
              <span className={`text-sm ${ossConnected ? 'text-green-400' : 'text-gray-400'}`}>
                {ossConnected ? '已配置' : '待配置'}
              </span>
            </div>
            <button
              onClick={() => setShowOSSConfig(true)}
              className="mt-3 text-xs text-blue-400 hover:text-blue-300 transition-colors"
            >
              点击配置 →
            </button>
          </div>
        </div>

        {/* 功能区域 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* 快速开始 */}
          <div className="bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 p-6">
            <h3 className="text-xl font-semibold text-white mb-4 flex items-center">
              <Zap className="w-5 h-5 mr-2 text-purple-400" />
              快速开始
            </h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                <span className="text-purple-200">1. 配置 API 密钥</span>
                <button
                  onClick={() => setShowApiConfig(true)}
                  className="text-purple-400 hover:text-purple-300 transition-colors"
                >
                  {apiConfig.apiKey ? '✓' : '→'}
                </button>
              </div>
              <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                <span className="text-purple-200">2. 连接数据库</span>
                <button
                  onClick={() => setShowDatabaseConfig(true)}
                  className="text-purple-400 hover:text-purple-300 transition-colors"
                >
                  {databaseConnected ? '✓' : '→'}
                </button>
              </div>
              <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                <span className="text-purple-200">3. 开始创作</span>
                <span className="text-gray-400">即将推出</span>
              </div>
            </div>
          </div>

          {/* 系统信息 */}
          <div className="bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 p-6">
            <h3 className="text-xl font-semibold text-white mb-4 flex items-center">
              <Activity className="w-5 h-5 mr-2 text-green-400" />
              系统信息
            </h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-purple-200">前端端口</span>
                <span className="text-white">3000</span>
              </div>
              <div className="flex justify-between">
                <span className="text-purple-200">后端端口</span>
                <span className="text-white">3002</span>
              </div>
              <div className="flex justify-between">
                <span className="text-purple-200">架构</span>
                <span className="text-white">前后端分离</span>
              </div>
              <div className="flex justify-between">
                <span className="text-purple-200">状态</span>
                <span className={serviceStatus.color}>{serviceStatus.text}</span>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* 模态框 */}
      <ApiConfigModal
        isOpen={showApiConfig}
        onClose={() => setShowApiConfig(false)}
        onConfigSaved={(config) => {
          setApiConfig(config);
          setShowApiConfig(false);
        }}
      />

      <DatabaseConfigModal
        isOpen={showDatabaseConfig}
        onClose={() => setShowDatabaseConfig(false)}
        onConfigSaved={(config) => {
          setDatabaseConfig(config);
          setDatabaseConnected(config.enabled);
          setShowDatabaseConfig(false);
        }}
      />
      <OSSConfigModal
        isOpen={showOSSConfig}
        onClose={() => setShowOSSConfig(false)}
        onConfigSaved={(config) => {
          setOssConfig(config);
          setOssConnected(config.enabled);
          setShowOSSConfig(false);
        }}
      />
    </div>
  );
}

export default App;
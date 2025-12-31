import { useState, useEffect } from 'react';
import { 
  AppStatus, 
  GenerationSettings, 
  ApiConfig,
  DatabaseConfig,
  OSSConfig,
  UploadedImage
} from '../../shared/types';
import { apiService } from './services/api';
import { ApiConfigModal } from './components/ApiConfigModal';
import { DatabaseConfigModal } from './components/DatabaseConfigModal';
import { OSSConfigModal } from './components/OSSConfigModal';
import { ImageUpload } from './components/ImageUpload';
import { 
  Zap, 
  Settings, 
  Image as ImageIcon, 
  Cloud, 
  Database,
  Wand2,
  Download,
  Heart,
  Share2,
  Sparkles,
  Palette
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

function CanvasApp() {
  const [status, setStatus] = useState<AppStatus>(AppStatus.IDLE);
  const [settings, setSettings] = useState<GenerationSettings>(DEFAULT_SETTINGS);
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
  
  // 生成状态
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

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

  // 处理图片上传
  const handleImagesChange = (images: UploadedImage[]) => {
    setSettings(prev => ({ ...prev, refImages: images }));
  };

  // 生成图片
  const handleGenerate = async () => {
    if (!settings.prompt.trim()) {
      alert('请输入提示词');
      return;
    }

    if (!apiConfig.apiKey) {
      alert('请先配置 API Key');
      setShowApiConfig(true);
      return;
    }

    try {
      setIsGenerating(true);
      setStatus(AppStatus.SUBMITTING);
      
      // 这里应该调用实际的图片生成 API
      // 暂时模拟生成过程
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // 模拟生成的图片
      setGeneratedImage('https://picsum.photos/512/512?random=' + Date.now());
      setStatus(AppStatus.SUCCESS);
    } catch (error: any) {
      console.error('图片生成失败:', error);
      setStatus(AppStatus.ERROR);
      alert('图片生成失败: ' + error.message);
    } finally {
      setIsGenerating(false);
    }
  };

  // 获取连接状态指示器
  const getStatusIndicator = () => {
    if (!backendConnected) return { color: 'bg-red-500', text: '服务离线' };
    if (!apiConfig.apiKey) return { color: 'bg-yellow-500', text: '需要配置 API' };
    return { color: 'bg-green-500', text: '就绪' };
  };

  const statusIndicator = getStatusIndicator();

  if (loading) {
    return (
      <div className="w-screen h-screen bg-[#09090b] flex items-center justify-center text-zinc-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-400 mx-auto mb-4"></div>
          <p className="text-purple-200">正在初始化画布...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-screen h-screen bg-[#09090b] overflow-hidden text-zinc-100 font-sans selection:bg-yellow-500/30">
      
      {/* 顶部品牌栏 */}
      <div className="absolute top-0 left-0 right-0 z-50 px-6 py-4 pointer-events-none flex justify-between items-start">
        {/* 品牌信息 */}
        <div className="flex items-center gap-3 pointer-events-auto">
          <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl flex items-center justify-center shadow-lg">
            <Zap className="w-5 h-5 text-white" fill="currentColor" />
          </div>
          <div>
            <h1 className="font-bold text-lg tracking-tight">Nano Banana AI 画布</h1>
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${statusIndicator.color}`}></span>
              <span className="text-xs text-zinc-500">{statusIndicator.text}</span>
            </div>
          </div>
        </div>
        
        {/* 配置按钮组 */}
        <div className="pointer-events-auto flex items-center gap-2">
          <button 
            onClick={() => setShowDatabaseConfig(true)}
            className={`flex items-center gap-2 px-3 py-2 border rounded-full text-sm transition-all duration-200 backdrop-blur-sm ${
              databaseConnected 
                ? 'bg-green-500/20 border-green-500/30 text-green-300 hover:bg-green-500/30' 
                : 'bg-zinc-800/80 border-zinc-700 text-zinc-300 hover:bg-zinc-700 hover:text-zinc-100'
            }`}
          >
            <Database className="w-4 h-4" />
            <span>数据库</span>
          </button>
          
          <button 
            onClick={() => setShowOSSConfig(true)}
            className={`flex items-center gap-2 px-3 py-2 border rounded-full text-sm transition-all duration-200 backdrop-blur-sm ${
              ossConnected 
                ? 'bg-blue-500/20 border-blue-500/30 text-blue-300 hover:bg-blue-500/30' 
                : 'bg-zinc-800/80 border-zinc-700 text-zinc-300 hover:bg-zinc-700 hover:text-zinc-100'
            }`}
          >
            <Cloud className="w-4 h-4" />
            <span>云存储</span>
          </button>
          
          <button 
            onClick={() => setShowApiConfig(true)}
            className={`flex items-center gap-2 px-3 py-2 border rounded-full text-sm transition-all duration-200 backdrop-blur-sm ${
              apiConfig.apiKey 
                ? 'bg-purple-500/20 border-purple-500/30 text-purple-300 hover:bg-purple-500/30' 
                : 'bg-zinc-800/80 border-zinc-700 text-zinc-300 hover:bg-zinc-700 hover:text-zinc-100'
            }`}
          >
            <Settings className="w-4 h-4" />
            <span>API 配置</span>
          </button>
        </div>
      </div>

      {/* 主要内容区域 */}
      <div className="flex h-full pt-20">
        
        {/* 左侧控制面板 */}
        <div className="w-80 bg-zinc-900/50 backdrop-blur-sm border-r border-zinc-800 p-6 overflow-y-auto">
          <div className="space-y-6">
            
            {/* 模型选择 */}
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-3">
                <Palette className="w-4 h-4 inline mr-2" />
                AI 模型
              </label>
              <select
                value={settings.model}
                onChange={(e) => setSettings(prev => ({ ...prev, model: e.target.value }))}
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                <option value="nano-banana-fast">Nano Banana Fast</option>
                <option value="nano-banana-pro">Nano Banana Pro</option>
                <option value="nano-banana-ultra">Nano Banana Ultra</option>
              </select>
            </div>

            {/* 提示词输入 */}
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-3">
                <Sparkles className="w-4 h-4 inline mr-2" />
                提示词
              </label>
              <textarea
                value={settings.prompt}
                onChange={(e) => setSettings(prev => ({ ...prev, prompt: e.target.value }))}
                placeholder="描述您想要生成的图片..."
                rows={4}
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
              />
            </div>

            {/* 图片尺寸 */}
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-3">图片尺寸</label>
              <div className="grid grid-cols-2 gap-2">
                {['1K', '2K', '4K'].map(size => (
                  <button
                    key={size}
                    onClick={() => setSettings(prev => ({ ...prev, imageSize: size }))}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      settings.imageSize === size
                        ? 'bg-purple-600 text-white'
                        : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                    }`}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>

            {/* 宽高比 */}
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-3">宽高比</label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { value: 'auto', label: '自动' },
                  { value: '1:1', label: '1:1' },
                  { value: '16:9', label: '16:9' },
                  { value: '9:16', label: '9:16' }
                ].map(ratio => (
                  <button
                    key={ratio.value}
                    onClick={() => setSettings(prev => ({ ...prev, aspectRatio: ratio.value }))}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      settings.aspectRatio === ratio.value
                        ? 'bg-purple-600 text-white'
                        : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                    }`}
                  >
                    {ratio.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 参考图片上传 */}
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-3">
                <ImageIcon className="w-4 h-4 inline mr-2" />
                参考图片（可选）
              </label>
              <ImageUpload
                images={settings.refImages}
                onImagesChange={handleImagesChange}
                maxImages={4}
                disabled={isGenerating}
              />
            </div>

            {/* 生成按钮 */}
            <button
              onClick={handleGenerate}
              disabled={isGenerating || !settings.prompt.trim()}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 disabled:from-zinc-700 disabled:to-zinc-700 disabled:text-zinc-500 text-white rounded-lg font-medium transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 disabled:transform-none"
            >
              {isGenerating ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>生成中...</span>
                </>
              ) : (
                <>
                  <Wand2 className="w-4 h-4" />
                  <span>生成图片</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* 右侧画布区域 */}
        <div className="flex-1 flex items-center justify-center p-8">
          {generatedImage ? (
            <div className="relative group">
              <img
                src={generatedImage}
                alt="Generated"
                className="max-w-full max-h-full rounded-xl shadow-2xl"
              />
              
              {/* 图片操作按钮 */}
              <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button className="p-2 bg-black/50 hover:bg-black/70 rounded-lg backdrop-blur-sm transition-colors">
                  <Heart className="w-4 h-4 text-white" />
                </button>
                <button className="p-2 bg-black/50 hover:bg-black/70 rounded-lg backdrop-blur-sm transition-colors">
                  <Download className="w-4 h-4 text-white" />
                </button>
                <button className="p-2 bg-black/50 hover:bg-black/70 rounded-lg backdrop-blur-sm transition-colors">
                  <Share2 className="w-4 h-4 text-white" />
                </button>
              </div>
            </div>
          ) : (
            <div className="text-center">
              <div className="w-32 h-32 bg-zinc-800/50 rounded-2xl flex items-center justify-center mb-6 mx-auto">
                <ImageIcon className="w-16 h-16 text-zinc-600" />
              </div>
              <h2 className="text-2xl font-bold mb-2">开始创作</h2>
              <p className="text-zinc-400 mb-6">在左侧输入提示词，点击生成按钮开始创作</p>
              {!apiConfig.apiKey && (
                <button
                  onClick={() => setShowApiConfig(true)}
                  className="px-6 py-3 bg-purple-600 hover:bg-purple-700 rounded-lg font-medium transition-colors"
                >
                  配置 API Key
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 配置模态框 */}
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

export default CanvasApp;
import React, { useState, useRef, useEffect } from 'react';
import { Controls } from './components/Controls';
import { Canvas } from './components/Canvas';
import { ApiConfigModal } from './components/ApiConfig';
import { ImageLibrary } from './components/ImageLibrary';
import { OSSConfigModal } from './components/OSSConfig';
// import { DatabaseConfigModal } from './components/DatabaseConfig';
import { 
  AppStatus, 
  GenerationSettings, 
  NanoBananaResultData,
  ApiConfig,
  SavedImage,
  ImageResult
} from './types';
import { createDrawingTask, getTaskResult } from './services/api';
import { imageStorage } from './services/imageStorage';
import { ossStorage, loadOSSConfig, OSSConfig } from './services/ossStorage';
import { Zap, Settings, Image as ImageIcon, Cloud } from 'lucide-react';

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
  timeout: 300000, // 5分钟 = 300秒 = 300000毫秒
  retryCount: 3,
  provider: 'Nano Banana'
};

const POLLING_INTERVAL = 2000;

function App() {
  const [status, setStatus] = useState<AppStatus>(AppStatus.IDLE);
  const [settings, setSettings] = useState<GenerationSettings>(DEFAULT_SETTINGS);
  const [apiConfig, setApiConfig] = useState<ApiConfig>(DEFAULT_API_CONFIG);
  const [currentResult, setCurrentResult] = useState<NanoBananaResultData | null>(null);
  const [showControls, setShowControls] = useState(true);
  const [showApiConfig, setShowApiConfig] = useState(false);
  const [showImageLibrary, setShowImageLibrary] = useState(false);
  const [showOSSConfig, setShowOSSConfig] = useState(false);
  const [ossConfig, setOssConfig] = useState<OSSConfig | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const pollingTimerRef = useRef<number | null>(null);
  const taskIdRef = useRef<string | null>(null);

  useEffect(() => {
    try {
      // 加载 OSS 配置
      const savedOSSConfig = loadOSSConfig();
      if (savedOSSConfig) {
        setOssConfig(savedOSSConfig);
      }
    } catch (err) {
      console.error('初始化配置失败:', err);
      setError('配置加载失败');
    }
    
    return () => stopPolling();
  }, []);

  // 如果有错误，显示错误信息
  if (error) {
    return (
      <div className="w-screen h-screen bg-[#09090b] flex items-center justify-center text-zinc-100">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">应用启动失败</h1>
          <p className="text-zinc-400 mb-4">{error}</p>
          <button 
            onClick={() => window.location.reload()} 
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg"
          >
            重新加载
          </button>
        </div>
      </div>
    );
  }

  const stopPolling = () => {
    if (pollingTimerRef.current) {
      window.clearTimeout(pollingTimerRef.current);
      pollingTimerRef.current = null;
    }
  };

  const handlePoll = async () => {
    const taskId = taskIdRef.current;
    if (!taskId) return;

    try {
      const response = await getTaskResult(taskId, apiConfig);
      const data = response.data;
      
      setCurrentResult(data);

      if (data.status === 'succeeded') {
        setStatus(AppStatus.SUCCESS);
        stopPolling();
        
        // 自动保存生成的图片到本地存储
        if (data.results && data.results.length > 0) {
          await saveGeneratedImage(data.results[0]);
        }
      } else if (data.status === 'failed') {
        setStatus(AppStatus.ERROR);
        stopPolling();
      } else {
        pollingTimerRef.current = window.setTimeout(handlePoll, POLLING_INTERVAL);
      }

    } catch (error) {
      console.error('Polling error', error);
      setStatus(AppStatus.ERROR);
      setCurrentResult(prev => prev ? { ...prev, error: '轮询期间发生网络错误' } : null);
      stopPolling();
    }
  };

  const handleGenerate = async () => {
    if (!settings.prompt) return;

    stopPolling();
    setStatus(AppStatus.SUBMITTING);
    setCurrentResult(null);
    taskIdRef.current = null;

    try {
      // 处理参考图片：优先使用新的 refImages，如果为空则使用旧的 refImageUrl
      let urls: string[] = [];
      
      if (settings.refImages.length > 0) {
        // 将上传的图片转换为 Base64
        const base64Images = await Promise.all(
          settings.refImages.map(async (img) => {
            if (img.base64) {
              return img.base64;
            }
            // 如果没有 base64，现场转换
            return new Promise<string>((resolve) => {
              const reader = new FileReader();
              reader.onload = () => resolve(reader.result as string);
              reader.readAsDataURL(img.file);
            });
          })
        );
        urls = base64Images;
      } else if (settings.refImageUrl) {
        // 兼容旧的单张图片URL方式
        urls = [settings.refImageUrl];
      }
      
      const taskId = await createDrawingTask({
        model: settings.model,
        prompt: settings.prompt,
        aspectRatio: settings.aspectRatio,
        imageSize: settings.imageSize,
        urls: urls.length > 0 ? urls : undefined,
        shutProgress: false, // 始终显示进度条
      }, apiConfig);

      taskIdRef.current = taskId;
      setStatus(AppStatus.POLLING);
      
      setCurrentResult({
        id: taskId,
        status: 'running',
        progress: 0,
        results: []
      });

      pollingTimerRef.current = window.setTimeout(handlePoll, POLLING_INTERVAL);

    } catch (error: any) {
      setStatus(AppStatus.ERROR);
      setCurrentResult({
        id: '',
        status: 'failed',
        progress: 0,
        results: [],
        error: error.message || '提交任务失败'
      });
    }
  };

  // 检查是否可以生成
  const canGenerate = Boolean(settings.prompt.trim() && apiConfig.apiKey.trim());

  // 获取连接状态显示
  const getConnectionStatus = () => {
    if (!apiConfig.apiKey.trim()) {
      return { color: 'bg-red-500', text: '未配置 API' };
    }
    return { color: 'bg-green-500', text: `已连接 ${apiConfig.provider}` };
  };

  const connectionStatus = getConnectionStatus();

  // 保存生成的图片到本地存储
  const saveGeneratedImage = async (result: ImageResult) => {
    try {
      let savedImage: SavedImage = {
        id: `img_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        url: result.url,
        prompt: settings.prompt,
        model: settings.model,
        aspectRatio: settings.aspectRatio,
        imageSize: settings.imageSize,
        refImages: settings.refImages.length > 0 ? settings.refImages : undefined,
        createdAt: new Date(),
        favorite: false,
        ossUploaded: false
      };

      // 保存到本地存储
      await imageStorage.saveImage(savedImage);
      console.log('图片已保存到本地存储:', savedImage.id);

      // 如果配置了 OSS，尝试上传到云存储
      if (ossConfig && ossStorage.isConfigured()) {
        try {
          console.log('开始上传图片到 OSS...');
          const updatedImage = await ossStorage.saveImageToOSS(savedImage);
          
          // 更新本地记录，使用 OSS URL
          await imageStorage.updateImage(savedImage.id, {
            url: updatedImage.url,
            originalUrl: savedImage.url,
            ossKey: updatedImage.ossKey,
            ossUploaded: true
          });
          
          console.log('图片已成功上传到 OSS:', updatedImage.url);
        } catch (ossError) {
          console.error('上传到 OSS 失败，图片仍保存在本地:', ossError);
          // OSS 上传失败不影响本地保存
        }
      }
    } catch (error) {
      console.error('保存图片失败:', error);
    }
  };

  // 打开控制面板
  const handleStartCreate = () => {
    setShowControls(true);
  };

  return (
    <div className="relative w-screen h-screen bg-[#09090b] overflow-hidden text-zinc-100 font-sans selection:bg-yellow-500/30">
      
      {/* Top Bar / Brand */}
      <div className="absolute top-0 left-0 right-0 z-50 px-6 py-4 pointer-events-none flex justify-between items-start">
         <div className="flex items-center gap-3 pointer-events-auto">
            <div className="w-10 h-10 bg-zinc-800 rounded-xl flex items-center justify-center border border-zinc-700 shadow-lg">
               <Zap className="w-5 h-5 text-yellow-500" fill="currentColor" />
            </div>
            <div>
               <h1 className="font-bold text-lg tracking-tight">Untitled Canvas</h1>
               <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${connectionStatus.color}`}></span>
                  <span className="text-xs text-zinc-500">{connectionStatus.text}</span>
               </div>
            </div>
         </div>
         
         {/* 工具按钮组 */}
         <div className="pointer-events-auto flex items-center gap-2">
           <button
             onClick={() => setShowImageLibrary(true)}
             className="flex items-center gap-2 px-3 py-2 bg-zinc-800/80 hover:bg-zinc-700 border border-zinc-700 rounded-full text-sm text-zinc-300 hover:text-zinc-100 transition-all duration-200 backdrop-blur-sm"
           >
             <ImageIcon className="w-4 h-4" />
             <span>图片库</span>
           </button>
           
           {/* <button
             onClick={() => setShowDatabaseConfig(true)}
             className={`flex items-center gap-2 px-3 py-2 border border-zinc-700 rounded-full text-sm transition-all duration-200 backdrop-blur-sm ${
               databaseConfig && databaseConfig.enabled
                 ? 'bg-green-600/20 text-green-300 hover:bg-green-600/30'
                 : 'bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 hover:text-zinc-100'
             }`}
           >
             <Database className="w-4 h-4" />
             <span>数据库</span>
           </button> */}
           
           <button
             onClick={() => setShowOSSConfig(true)}
             className={`flex items-center gap-2 px-3 py-2 border border-zinc-700 rounded-full text-sm transition-all duration-200 backdrop-blur-sm ${
               ossConfig && ossStorage.isConfigured()
                 ? 'bg-blue-600/20 text-blue-300 hover:bg-blue-600/30'
                 : 'bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 hover:text-zinc-100'
             }`}
           >
             <Cloud className="w-4 h-4" />
             <span>云存储</span>
           </button>
           
           <button
             onClick={() => setShowApiConfig(true)}
             className="flex items-center gap-2 px-3 py-2 bg-zinc-800/80 hover:bg-zinc-700 border border-zinc-700 rounded-full text-sm text-zinc-300 hover:text-zinc-100 transition-all duration-200 backdrop-blur-sm"
           >
             <Settings className="w-4 h-4" />
             <span>API 配置</span>
           </button>
         </div>
      </div>

      {/* Floating Controls Panel */}
      <div className={`absolute top-24 left-6 z-40 transition-all duration-500 ease-in-out ${showControls ? 'translate-x-0 opacity-100' : '-translate-x-[120%] opacity-0'}`}>
        <Controls 
          settings={settings} 
          setSettings={setSettings} 
          onGenerate={handleGenerate}
          status={status}
          canGenerate={canGenerate}
        />
      </div>

      {/* Infinite Canvas */}
      <Canvas 
        status={status} 
        currentResult={currentResult} 
        onStartCreate={handleStartCreate}
      />

      {/* API Config Modal */}
      <ApiConfigModal
        config={apiConfig}
        onConfigChange={setApiConfig}
        isOpen={showApiConfig}
        onClose={() => setShowApiConfig(false)}
      />

      {/* Database Config Modal */}
      {/* <DatabaseConfigModal
        isOpen={showDatabaseConfig}
        onClose={() => setShowDatabaseConfig(false)}
        onConfigChange={setDatabaseConfig}
      /> */}

      {/* OSS Config Modal */}
      <OSSConfigModal
        isOpen={showOSSConfig}
        onClose={() => setShowOSSConfig(false)}
        onConfigChange={setOssConfig}
      />

      {/* Image Library */}
      <ImageLibrary
        isOpen={showImageLibrary}
        onClose={() => setShowImageLibrary(false)}
      />

    </div>
  );
}

export default App;
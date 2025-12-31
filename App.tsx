import React, { useState } from 'react';
import { 
  AppStatus, 
  GenerationSettings, 
  ApiConfig,
  DatabaseConfig
} from './types.simple';
import { Zap, Settings, Image as ImageIcon, Cloud, Database } from 'lucide-react';

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
  const [status, setStatus] = useState<AppStatus>(AppStatus.IDLE);
  const [settings, setSettings] = useState<GenerationSettings>(DEFAULT_SETTINGS);
  const [apiConfig, setApiConfig] = useState<ApiConfig>(DEFAULT_API_CONFIG);
  const [error, setError] = useState<string | null>(null);

  // 测试按钮点击处理器
  const handleButtonClick = (buttonName: string) => {
    console.log(`点击了 ${buttonName} 按钮`);
    alert(`点击了 ${buttonName} 按钮`);
  };

  // 如果有错误，显示错误信息
  if (error) {
    return (
      <div className="w-screen h-screen bg-[#09090b] flex items-center justify-center text-zinc-100">
        <div className="text-center max-w-md">
          <h1 className="text-2xl font-bold mb-4">应用启动失败</h1>
          <p className="text-zinc-400 mb-4">{error}</p>
          <div className="space-y-2">
            <button 
              onClick={() => setError(null)} 
              className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg"
            >
              重新初始化
            </button>
            <button 
              onClick={() => window.location.reload()} 
              className="w-full px-4 py-2 bg-zinc-600 hover:bg-zinc-700 rounded-lg"
            >
              重新加载页面
            </button>
          </div>
        </div>
      </div>
    );
  }

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
                  <span className="w-2 h-2 rounded-full bg-red-500"></span>
                  <span className="text-xs text-zinc-500">未配置 API</span>
               </div>
            </div>
         </div>
         
         {/* 工具按钮组 */}
         <div className="pointer-events-auto flex items-center gap-2">
           <button 
             onClick={() => handleButtonClick('图片库')}
             className="flex items-center gap-2 px-3 py-2 bg-zinc-800/80 hover:bg-zinc-700 border border-zinc-700 rounded-full text-sm text-zinc-300 hover:text-zinc-100 transition-all duration-200 backdrop-blur-sm"
           >
             <ImageIcon className="w-4 h-4" />
             <span>图片库</span>
           </button>
           
           <button 
             onClick={() => handleButtonClick('数据库')}
             className="flex items-center gap-2 px-3 py-2 bg-zinc-800/80 hover:bg-zinc-700 border border-zinc-700 rounded-full text-sm text-zinc-300 hover:text-zinc-100 transition-all duration-200 backdrop-blur-sm"
           >
             <Database className="w-4 h-4" />
             <span>数据库</span>
           </button>
           
           <button 
             onClick={() => handleButtonClick('云存储')}
             className="flex items-center gap-2 px-3 py-2 bg-zinc-800/80 hover:bg-zinc-700 border border-zinc-700 rounded-full text-sm text-zinc-300 hover:text-zinc-100 transition-all duration-200 backdrop-blur-sm"
           >
             <Cloud className="w-4 h-4" />
             <span>云存储</span>
           </button>
           
           <button 
             onClick={() => handleButtonClick('API 配置')}
             className="flex items-center gap-2 px-3 py-2 bg-zinc-800/80 hover:bg-zinc-700 border border-zinc-700 rounded-full text-sm text-zinc-300 hover:text-zinc-100 transition-all duration-200 backdrop-blur-sm"
           >
             <Settings className="w-4 h-4" />
             <span>API 配置</span>
           </button>
         </div>
      </div>

      {/* 主要内容区域 */}
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">欢迎使用 Nano Banana AI 画布</h2>
          <p className="text-zinc-400 mb-8">请先配置 API 和数据库连接</p>
          <div className="space-y-4">
            <button 
              onClick={() => handleButtonClick('开始配置')}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium"
            >
              开始配置
            </button>
          </div>
        </div>
      </div>

    </div>
  );
}

export default App;
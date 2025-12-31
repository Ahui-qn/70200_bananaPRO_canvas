import React from 'react';
import { Zap, Settings, Database, Cloud } from 'lucide-react';

function SimpleCanvasApp() {
  return (
    <div className="w-screen h-screen bg-zinc-900 text-white">
      {/* 测试 Tailwind CSS 是否工作 */}
      <div className="p-8">
        <h1 className="text-4xl font-bold text-purple-400 mb-4">
          Tailwind CSS 测试
        </h1>
        <p className="text-zinc-300 mb-6">
          如果您能看到紫色标题和这些样式，说明 Tailwind CSS 正在工作
        </p>
        
        {/* 测试按钮 */}
        <div className="flex gap-4 mb-6">
          <button className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors">
            蓝色按钮
          </button>
          <button className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg transition-colors">
            绿色按钮
          </button>
          <button className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg transition-colors">
            红色按钮
          </button>
        </div>
        
        {/* 测试图标 */}
        <div className="flex gap-4 items-center">
          <Zap className="w-6 h-6 text-yellow-400" />
          <Settings className="w-6 h-6 text-gray-400" />
          <Database className="w-6 h-6 text-green-400" />
          <Cloud className="w-6 h-6 text-blue-400" />
        </div>
        
        {/* 测试卡片 */}
        <div className="mt-6 p-4 bg-zinc-800 rounded-lg border border-zinc-700">
          <h3 className="text-lg font-semibold mb-2">测试卡片</h3>
          <p className="text-zinc-400">这是一个测试卡片，用于验证样式是否正常</p>
        </div>
      </div>
    </div>
  );
}

export default SimpleCanvasApp;
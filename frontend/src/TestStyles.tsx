import React from 'react';

export const TestStyles: React.FC = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-purple-900 to-pink-900 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold text-white mb-8 text-center">
          Tailwind CSS 测试页面
        </h1>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-red-500 p-6 rounded-lg shadow-lg">
            <h2 className="text-xl font-semibold text-white mb-2">红色卡片</h2>
            <p className="text-red-100">这是一个红色的测试卡片</p>
          </div>
          
          <div className="bg-green-500 p-6 rounded-lg shadow-lg">
            <h2 className="text-xl font-semibold text-white mb-2">绿色卡片</h2>
            <p className="text-green-100">这是一个绿色的测试卡片</p>
          </div>
          
          <div className="bg-blue-500 p-6 rounded-lg shadow-lg">
            <h2 className="text-xl font-semibold text-white mb-2">蓝色卡片</h2>
            <p className="text-blue-100">这是一个蓝色的测试卡片</p>
          </div>
        </div>
        
        <div className="bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 p-6">
          <h3 className="text-2xl font-bold text-white mb-4">玻璃效果测试</h3>
          <p className="text-purple-200 mb-4">
            如果您能看到这个半透明的玻璃效果卡片，说明 Tailwind CSS 正在正常工作。
          </p>
          
          <div className="flex gap-4">
            <button className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5">
              紫色按钮
            </button>
            
            <button className="px-6 py-3 bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white rounded-lg font-medium transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5">
              渐变按钮
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
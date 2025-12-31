import React from 'react';

function SimpleTestApp() {
  return (
    <div className="min-h-screen bg-blue-500 text-white p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold mb-4 text-center">
          Tailwind CSS 测试页面
        </h1>
        <p className="text-xl mb-8 text-center">
          如果您能看到蓝色背景和白色文字，说明 Tailwind CSS 正在工作
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-red-500 p-6 rounded-lg shadow-lg">
            <h2 className="text-xl font-semibold mb-2">红色卡片</h2>
            <p className="text-red-100">这是一个红色的测试卡片</p>
          </div>
          
          <div className="bg-green-500 p-6 rounded-lg shadow-lg">
            <h2 className="text-xl font-semibold mb-2">绿色卡片</h2>
            <p className="text-green-100">这是一个绿色的测试卡片</p>
          </div>
          
          <div className="bg-purple-500 p-6 rounded-lg shadow-lg">
            <h2 className="text-xl font-semibold mb-2">紫色卡片</h2>
            <p className="text-purple-100">这是一个紫色的测试卡片</p>
          </div>
        </div>
        
        <div className="text-center">
          <button 
            className="bg-yellow-500 hover:bg-yellow-600 text-black px-8 py-4 rounded-lg font-bold text-lg transition-colors duration-200 shadow-lg"
            onClick={() => alert('按钮工作正常！Tailwind CSS 已加载')}
          >
            点击测试按钮
          </button>
        </div>
      </div>
    </div>
  );
}

export default SimpleTestApp;
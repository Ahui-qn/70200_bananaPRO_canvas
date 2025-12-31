import React from 'react';

function SimpleApp() {
  return (
    <div className="min-h-screen bg-blue-500 text-white p-8">
      <h1 className="text-4xl font-bold mb-4">测试页面</h1>
      <p className="text-xl mb-4">如果您能看到这个蓝色页面，说明 React 和 Tailwind 都在工作</p>
      <button 
        className="bg-red-500 hover:bg-red-600 text-white px-6 py-3 rounded-lg"
        onClick={() => alert('按钮工作正常！')}
      >
        点击测试
      </button>
    </div>
  );
}

export default SimpleApp;
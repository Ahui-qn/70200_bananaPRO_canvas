import React from 'react';

function App() {
  return (
    <div className="w-screen h-screen bg-zinc-900 text-white flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-4">Nano Banana AI 画布</h1>
        <p className="text-zinc-400">应用正在加载...</p>
        <div className="mt-8">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
        </div>
      </div>
    </div>
  );
}

export default App;
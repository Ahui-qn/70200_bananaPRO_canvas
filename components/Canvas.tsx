import React, { useState, useRef } from 'react';
import { AppStatus, NanoBananaResultData } from '../types';
import { 
  Download, 
  Sparkles, 
  Minus,
  Plus,
  Scan
} from 'lucide-react';

interface CanvasProps {
  status: AppStatus;
  currentResult: NanoBananaResultData | null;
  onStartCreate: () => void;
}

export const Canvas: React.FC<CanvasProps> = ({ status, currentResult, onStartCreate }) => {
  const imageUrl = currentResult?.status === 'succeeded' ? currentResult.results?.[0]?.url : null;
  const progress = currentResult?.progress || 0;

  // State
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  
  const containerRef = useRef<HTMLDivElement>(null);

  // Zoom Logic
  const handleWheel = (e: React.WheelEvent) => {
    // Supports Ctrl, Meta, or Alt key for zooming
    if (e.ctrlKey || e.metaKey || e.altKey) {
       e.preventDefault();
       const zoomSensitivity = 0.001;
       const delta = -e.deltaY * zoomSensitivity;
       const newScale = Math.min(Math.max(0.1, scale + delta), 5);
       setScale(newScale);
    } else {
       // Panning via trackpad/wheel
       setPosition(prev => ({
           x: prev.x - e.deltaX,
           y: prev.y - e.deltaY
       }));
    }
  };

  // Drag Logic
  const handleMouseDown = (e: React.MouseEvent) => {
    // Only drag if clicking background or grid, ignore clicks on interactive elements
    if ((e.target as HTMLElement).closest('.interactive-content')) return;
    
    setIsDragging(true);
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Handle double click on background to start creating
  const handleDoubleClick = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.interactive-content')) return;
    onStartCreate();
  };

  const zoomIn = () => setScale(s => Math.min(s + 0.1, 5));
  const zoomOut = () => setScale(s => Math.max(s - 0.1, 0.1));
  const resetView = () => {
      setScale(1);
      setPosition({ x: 0, y: 0 });
  };

  return (
    <div 
      className="w-full h-full relative overflow-hidden bg-[#09090b] cursor-grab active:cursor-grabbing group"
      ref={containerRef}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onDoubleClick={handleDoubleClick}
    >
        {/* Infinite Grid Background */}
        <div 
            className="absolute inset-0 pointer-events-none opacity-[0.2]"
            style={{
                transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
                transformOrigin: '0 0',
                backgroundImage: 'radial-gradient(#71717a 1.5px, transparent 1.5px)', 
                backgroundSize: '24px 24px',
                width: '1000%', 
                height: '1000%',
                left: '-450%', 
                top: '-450%'
            }}
        />

        {/* Transformed Content Layer */}
        <div 
            className="absolute inset-0 flex items-center justify-center pointer-events-none"
            style={{
                transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
                transformOrigin: 'center center',
            }}
        >
            
            {/* IDLE STATE: Clean canvas, no pill button */}
            {status === AppStatus.IDLE && (
               <></>
            )}

            {/* LOADING STATE */}
            {(status === AppStatus.SUBMITTING || status === AppStatus.POLLING) && (
                <div className="pointer-events-auto interactive-content bg-zinc-900/90 backdrop-blur-xl rounded-3xl p-8 border border-zinc-800 shadow-2xl flex flex-col items-center min-w-[320px]">
                     <div className="relative w-24 h-24 mb-6">
                        <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                            <circle cx="50" cy="50" r="45" fill="none" stroke="#27272a" strokeWidth="8" />
                            <circle 
                                cx="50" cy="50" r="45" fill="none" stroke="#3b82f6" strokeWidth="8" 
                                strokeDasharray="283"
                                strokeDashoffset={283 - (283 * progress) / 100}
                                className="transition-all duration-500 ease-out"
                                strokeLinecap="round"
                            />
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center font-bold text-xl text-zinc-200 font-mono">
                            {progress}%
                        </div>
                     </div>
                     <h3 className="text-lg font-medium text-white mb-1">正在生成...</h3>
                     <p className="text-sm text-zinc-500">AI 正在绘制您的想象</p>
                </div>
            )}

            {/* RESULT STATE */}
            {status === AppStatus.SUCCESS && imageUrl && (
                <div className="pointer-events-auto interactive-content relative group shadow-2xl shadow-black/50 rounded-lg">
                    <img 
                        src={imageUrl} 
                        alt="Generated Art" 
                        className="max-w-[80vw] max-h-[80vh] rounded-lg border border-zinc-800 select-none shadow-2xl"
                        draggable={false}
                    />
                    
                    {/* Floating Image Actions */}
                    <div className="absolute -bottom-16 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-zinc-900/90 backdrop-blur border border-zinc-700 p-2 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                        <button 
                            onClick={() => window.open(imageUrl, '_blank')}
                            className="flex items-center gap-2 px-3 py-1.5 hover:bg-zinc-800 rounded-lg text-sm text-zinc-300 transition-colors"
                        >
                            <Download className="w-4 h-4" />
                            下载
                        </button>
                        <div className="w-[1px] h-4 bg-zinc-700"></div>
                        <span className="px-2 text-xs text-zinc-500">
                             {(currentResult?.results?.[0] as any)?.seed || 'Seed: Random'}
                        </span>
                    </div>
                </div>
            )}

            {/* ERROR STATE */}
             {status === AppStatus.ERROR && (
                <div className="pointer-events-auto interactive-content bg-red-950/50 backdrop-blur-xl border border-red-900/50 p-8 rounded-2xl max-w-md text-center">
                    <div className="w-12 h-12 bg-red-900/50 rounded-full flex items-center justify-center mx-auto mb-4 text-red-400">
                        <Sparkles className="w-6 h-6 rotate-180" />
                    </div>
                    <h3 className="text-lg font-semibold text-red-200 mb-2">生成失败</h3>
                    <p className="text-sm text-red-300/70 mb-6">
                        {currentResult?.failure_reason || currentResult?.error || "未知错误"}
                    </p>
                    <button 
                        onClick={onStartCreate}
                        className="px-4 py-2 bg-red-900 hover:bg-red-800 text-red-100 rounded-lg text-sm font-medium transition-colors"
                    >
                        重试
                    </button>
                </div>
            )}

        </div>

        {/* Bottom Left: Zoom Controls (Fixed UI) */}
        <div className="absolute bottom-6 left-6 flex items-center gap-3 pointer-events-auto z-50">
             <div className="flex items-center bg-zinc-900/90 backdrop-blur border border-zinc-800 rounded-full p-1 shadow-xl">
                 <button onClick={zoomOut} className="p-2 hover:bg-zinc-800 rounded-full text-zinc-400 hover:text-white transition-colors">
                     <Minus className="w-4 h-4" />
                 </button>
                 <div className="w-[1px] h-4 bg-zinc-800 mx-1"></div>
                 <span className="text-xs font-mono text-zinc-400 w-12 text-center select-none">
                     {Math.round(scale * 100)}%
                 </span>
                 <div className="w-[1px] h-4 bg-zinc-800 mx-1"></div>
                 <button onClick={zoomIn} className="p-2 hover:bg-zinc-800 rounded-full text-zinc-400 hover:text-white transition-colors">
                     <Plus className="w-4 h-4" />
                 </button>
             </div>

             <button onClick={resetView} className="p-3 bg-zinc-900/90 backdrop-blur border border-zinc-800 rounded-full text-zinc-400 hover:text-white hover:bg-zinc-800 shadow-xl transition-colors" title="复位视图">
                 <Scan className="w-4 h-4" />
             </button>
             
             {/* Removed Help Button */}
        </div>

    </div>
  );
};
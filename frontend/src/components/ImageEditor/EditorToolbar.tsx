/**
 * 编辑器工具栏组件
 */

import React from 'react';
import {
  MousePointer2,
  Pencil,
  Square,
  Circle,
  Crop,
  RotateCcw,
  RotateCw,
  Undo2,
  Redo2,
} from 'lucide-react';

// 工具类型
export type Tool = 'select' | 'brush' | 'rect' | 'circle' | 'crop';

interface EditorToolbarProps {
  activeTool: Tool;
  onToolChange: (tool: Tool) => void;
  onUndo: () => void;
  onRedo: () => void;
  onRotate: (angle: 90 | -90) => void;
}

// 工具按钮配置
const tools: { id: Tool; icon: React.ReactNode; label: string }[] = [
  { id: 'select', icon: <MousePointer2 className="w-4 h-4" />, label: '选择' },
  { id: 'brush', icon: <Pencil className="w-4 h-4" />, label: '画笔' },
  { id: 'rect', icon: <Square className="w-4 h-4" />, label: '矩形' },
  { id: 'circle', icon: <Circle className="w-4 h-4" />, label: '圆形' },
  { id: 'crop', icon: <Crop className="w-4 h-4" />, label: '裁剪' },
];

export const EditorToolbar: React.FC<EditorToolbarProps> = ({
  activeTool,
  onToolChange,
  onUndo,
  onRedo,
  onRotate,
}) => {
  return (
    <div className="flex items-center gap-1">
      {/* 绘图工具 */}
      <div className="flex items-center gap-1 px-2 py-1 bg-zinc-800/50 rounded-lg">
        {tools.map((tool) => (
          <button
            key={tool.id}
            onClick={() => onToolChange(tool.id)}
            className={`p-2 rounded-lg transition-colors ${
              activeTool === tool.id
                ? 'bg-violet-500/30 text-violet-400'
                : 'text-white/60 hover:text-white hover:bg-white/10'
            }`}
            title={tool.label}
          >
            {tool.icon}
          </button>
        ))}
      </div>

      {/* 分隔线 */}
      <div className="w-px h-6 bg-white/10 mx-2" />

      {/* 撤销/重做 */}
      <div className="flex items-center gap-1 px-2 py-1 bg-zinc-800/50 rounded-lg">
        <button
          onClick={onUndo}
          className="p-2 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors"
          title="撤销 (Ctrl+Z)"
        >
          <Undo2 className="w-4 h-4" />
        </button>
        <button
          onClick={onRedo}
          className="p-2 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors"
          title="重做 (Ctrl+Shift+Z)"
        >
          <Redo2 className="w-4 h-4" />
        </button>
      </div>

      {/* 分隔线 */}
      <div className="w-px h-6 bg-white/10 mx-2" />

      {/* 旋转 */}
      <div className="flex items-center gap-1 px-2 py-1 bg-zinc-800/50 rounded-lg">
        <button
          onClick={() => onRotate(-90)}
          className="p-2 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors"
          title="逆时针旋转90°"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
        <button
          onClick={() => onRotate(90)}
          className="p-2 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors"
          title="顺时针旋转90°"
        >
          <RotateCw className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

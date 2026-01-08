/**
 * 颜色选择器组件
 */

import React, { useState, useRef, useEffect } from 'react';

interface ColorPickerProps {
  color: string;
  onChange: (color: string) => void;
}

// 预设颜色
const presetColors = [
  '#ff0000', // 红
  '#ff6600', // 橙
  '#ffcc00', // 黄
  '#00cc00', // 绿
  '#0099ff', // 蓝
  '#9933ff', // 紫
  '#ff66cc', // 粉
  '#ffffff', // 白
  '#000000', // 黑
];

export const ColorPicker: React.FC<ColorPickerProps> = ({ color, onChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // 点击外部关闭
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  return (
    <div ref={containerRef} className="relative">
      {/* 当前颜色按钮 */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 bg-zinc-800 rounded-lg border border-white/10 hover:border-white/20 transition-colors"
      >
        <div
          className="w-5 h-5 rounded border border-white/20"
          style={{ backgroundColor: color }}
        />
        <span className="text-xs text-white/60">颜色</span>
      </button>

      {/* 颜色选择面板 */}
      {isOpen && (
        <div className="absolute top-full mt-2 right-0 p-3 bg-zinc-800 rounded-xl border border-white/10 shadow-xl z-10">
          {/* 预设颜色 */}
          <div className="grid grid-cols-5 gap-2 mb-3">
            {presetColors.map((presetColor) => (
              <button
                key={presetColor}
                onClick={() => {
                  onChange(presetColor);
                  setIsOpen(false);
                }}
                className={`w-7 h-7 rounded-lg border-2 transition-transform hover:scale-110 ${
                  color === presetColor ? 'border-white' : 'border-transparent'
                }`}
                style={{ backgroundColor: presetColor }}
              />
            ))}
          </div>

          {/* 自定义颜色输入 */}
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={color}
              onChange={(e) => onChange(e.target.value)}
              className="w-8 h-8 rounded cursor-pointer"
            />
            <input
              type="text"
              value={color}
              onChange={(e) => onChange(e.target.value)}
              className="flex-1 px-2 py-1 bg-zinc-700 text-white text-xs rounded border border-white/10"
              placeholder="#000000"
            />
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * SelectionBox 组件
 * 显示框选时的选区框（半透明填充 + 虚线边框）
 * 
 * 需求: 3.1, 3.2, 8.1
 */

import React, { useMemo } from 'react';

interface SelectionBoxProps {
  // 起始点（画布坐标）
  startPoint: { x: number; y: number } | null;
  // 结束点（画布坐标）
  endPoint: { x: number; y: number } | null;
  // 是否激活
  isActive: boolean;
}

/**
 * SelectionBox 组件
 * 渲染框选时的选区框
 */
export const SelectionBox: React.FC<SelectionBoxProps> = ({
  startPoint,
  endPoint,
  isActive,
}) => {
  // 计算选区框的位置和尺寸
  const boxStyle = useMemo(() => {
    if (!isActive || !startPoint || !endPoint) {
      return null;
    }

    // 计算标准化的矩形（处理四象限方向）
    const x = Math.min(startPoint.x, endPoint.x);
    const y = Math.min(startPoint.y, endPoint.y);
    const width = Math.abs(endPoint.x - startPoint.x);
    const height = Math.abs(endPoint.y - startPoint.y);

    // 如果选区框太小，不显示
    if (width < 2 && height < 2) {
      return null;
    }

    return {
      left: x,
      top: y,
      width,
      height,
    };
  }, [isActive, startPoint, endPoint]);

  // 不显示选区框
  if (!boxStyle) {
    return null;
  }

  return (
    <div
      className="selection-box"
      style={{
        position: 'absolute',
        left: boxStyle.left,
        top: boxStyle.top,
        width: boxStyle.width,
        height: boxStyle.height,
        // 半透明填充（需求 8.1）
        backgroundColor: 'rgba(139, 92, 246, 0.1)',
        // 虚线边框（需求 8.1）
        border: '1px dashed rgba(139, 92, 246, 0.8)',
        // 确保不遮挡画布内容（需求 8.2）
        pointerEvents: 'none',
        // 层级设置
        zIndex: 1000,
        // 圆角
        borderRadius: '2px',
      }}
    />
  );
};

export default SelectionBox;

/**
 * 选区框计算和相交检测工具函数
 * 
 * 需求: 3.2, 3.3, 8.3
 */

import { CanvasImage } from '../../../shared/types';

// ============================================
// 类型定义
// ============================================

/**
 * 选区框矩形（标准化后）
 */
export interface SelectionRect {
  x: number;      // 左上角 x
  y: number;      // 左上角 y
  width: number;  // 宽度（始终为正数）
  height: number; // 高度（始终为正数）
}

/**
 * 图片矩形
 */
export interface ImageRect {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

// ============================================
// 选区框计算函数
// ============================================

/**
 * 标准化选区框矩形
 * 处理四象限方向的选区框，确保 width 和 height 始终为正数
 * 
 * 需求: 3.2, 8.3
 * 
 * @param startPoint 起始点
 * @param endPoint 结束点
 * @returns 标准化后的选区框矩形
 */
export function normalizeSelectionRect(
  startPoint: { x: number; y: number },
  endPoint: { x: number; y: number }
): SelectionRect {
  // 计算左上角坐标（取两点中较小的值）
  const x = Math.min(startPoint.x, endPoint.x);
  const y = Math.min(startPoint.y, endPoint.y);
  
  // 计算宽度和高度（使用绝对值确保为正数）
  const width = Math.abs(endPoint.x - startPoint.x);
  const height = Math.abs(endPoint.y - startPoint.y);

  return { x, y, width, height };
}

// ============================================
// 相交检测函数
// ============================================

/**
 * 检测两个矩形是否相交
 * 当且仅当两个矩形有重叠区域时返回 true
 * 
 * 需求: 3.3
 * 
 * @param rect1 第一个矩形
 * @param rect2 第二个矩形
 * @returns 是否相交
 */
export function rectsIntersect(
  rect1: SelectionRect,
  rect2: SelectionRect
): boolean {
  // 计算两个矩形的边界
  const rect1Right = rect1.x + rect1.width;
  const rect1Bottom = rect1.y + rect1.height;
  const rect2Right = rect2.x + rect2.width;
  const rect2Bottom = rect2.y + rect2.height;

  // 检查是否不相交（任一条件成立则不相交）
  // 1. rect1 在 rect2 的左边
  // 2. rect1 在 rect2 的右边
  // 3. rect1 在 rect2 的上边
  // 4. rect1 在 rect2 的下边
  const noIntersection = 
    rect1Right <= rect2.x ||  // rect1 在 rect2 左边
    rect1.x >= rect2Right ||  // rect1 在 rect2 右边
    rect1Bottom <= rect2.y || // rect1 在 rect2 上边
    rect1.y >= rect2Bottom;   // rect1 在 rect2 下边

  return !noIntersection;
}

/**
 * 检测选区框是否包含矩形
 * 
 * @param selectionRect 选区框
 * @param targetRect 目标矩形
 * @returns 是否包含
 */
export function rectContains(
  selectionRect: SelectionRect,
  targetRect: SelectionRect
): boolean {
  const selectionRight = selectionRect.x + selectionRect.width;
  const selectionBottom = selectionRect.y + selectionRect.height;
  const targetRight = targetRect.x + targetRect.width;
  const targetBottom = targetRect.y + targetRect.height;

  return (
    selectionRect.x <= targetRect.x &&
    selectionRect.y <= targetRect.y &&
    selectionRight >= targetRight &&
    selectionBottom >= targetBottom
  );
}

// ============================================
// 图片相交检测函数
// ============================================

/**
 * 获取与选区框相交的所有图片 ID
 * 
 * 需求: 3.3
 * 
 * @param selectionRect 选区框矩形
 * @param images 图片列表
 * @param maxDisplaySize 图片最大显示尺寸（默认 400px）
 * @returns 相交的图片 ID 数组
 */
export function getIntersectingImageIds(
  selectionRect: SelectionRect,
  images: CanvasImage[],
  maxDisplaySize: number = 400
): string[] {
  const intersectingIds: string[] = [];

  for (const image of images) {
    // 获取图片位置（优先使用运行时位置）
    const imgX = image.x ?? image.canvasX ?? 0;
    const imgY = image.y ?? image.canvasY ?? 0;
    
    // 计算图片显示尺寸
    const displaySize = calculateDisplaySize(
      image.width || 400,
      image.height || 400,
      maxDisplaySize
    );

    // 创建图片矩形
    const imageRect: SelectionRect = {
      x: imgX,
      y: imgY,
      width: displaySize.width,
      height: displaySize.height,
    };

    // 检测相交
    if (rectsIntersect(selectionRect, imageRect)) {
      intersectingIds.push(image.id);
    }
  }

  return intersectingIds;
}

/**
 * 将图片列表转换为矩形列表
 * 
 * @param images 图片列表
 * @param maxDisplaySize 图片最大显示尺寸
 * @returns 图片矩形列表
 */
export function imagesToRects(
  images: CanvasImage[],
  maxDisplaySize: number = 400
): ImageRect[] {
  return images.map(image => {
    const imgX = image.x ?? image.canvasX ?? 0;
    const imgY = image.y ?? image.canvasY ?? 0;
    
    const displaySize = calculateDisplaySize(
      image.width || 400,
      image.height || 400,
      maxDisplaySize
    );

    return {
      id: image.id,
      x: imgX,
      y: imgY,
      width: displaySize.width,
      height: displaySize.height,
    };
  });
}

// ============================================
// 辅助函数
// ============================================

/**
 * 计算画布上的显示尺寸
 * 保持图片的实际宽高比，但限制最大尺寸以适应画布
 * 
 * @param actualWidth 实际像素宽度
 * @param actualHeight 实际像素高度
 * @param maxSize 最大尺寸限制（默认400px）
 * @returns 画布显示的宽度和高度
 */
export function calculateDisplaySize(
  actualWidth: number,
  actualHeight: number,
  maxSize: number = 400
): { width: number; height: number } {
  // 计算宽高比
  const aspectRatio = actualWidth / actualHeight;
  
  // 如果图片尺寸都小于等于最大尺寸，直接使用实际尺寸
  if (actualWidth <= maxSize && actualHeight <= maxSize) {
    return { width: actualWidth, height: actualHeight };
  }
  
  // 根据宽高比计算适合的显示尺寸
  if (aspectRatio > 1) {
    // 宽图：以宽度为准
    const displayWidth = Math.min(actualWidth, maxSize);
    const displayHeight = displayWidth / aspectRatio;
    return { width: displayWidth, height: displayHeight };
  } else {
    // 高图：以高度为准
    const displayHeight = Math.min(actualHeight, maxSize);
    const displayWidth = displayHeight * aspectRatio;
    return { width: displayWidth, height: displayHeight };
  }
}

/**
 * 检测点是否在矩形内
 * 
 * @param point 点坐标
 * @param rect 矩形
 * @returns 是否在矩形内
 */
export function pointInRect(
  point: { x: number; y: number },
  rect: SelectionRect
): boolean {
  return (
    point.x >= rect.x &&
    point.x <= rect.x + rect.width &&
    point.y >= rect.y &&
    point.y <= rect.y + rect.height
  );
}

/**
 * 获取点击位置的图片 ID
 * 
 * @param point 点击位置（画布坐标）
 * @param images 图片列表
 * @param maxDisplaySize 图片最大显示尺寸
 * @returns 图片 ID，如果没有点击到图片则返回 null
 */
export function getImageAtPoint(
  point: { x: number; y: number },
  images: CanvasImage[],
  maxDisplaySize: number = 400
): string | null {
  // 从后往前遍历（后面的图片在上层）
  for (let i = images.length - 1; i >= 0; i--) {
    const image = images[i];
    const imgX = image.x ?? image.canvasX ?? 0;
    const imgY = image.y ?? image.canvasY ?? 0;
    
    const displaySize = calculateDisplaySize(
      image.width || 400,
      image.height || 400,
      maxDisplaySize
    );

    const imageRect: SelectionRect = {
      x: imgX,
      y: imgY,
      width: displaySize.width,
      height: displaySize.height,
    };

    if (pointInRect(point, imageRect)) {
      return image.id;
    }
  }

  return null;
}

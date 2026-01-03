/**
 * useCanvasImages Hook
 * 管理画布图片的加载、位置更新和状态持久化
 * 
 * 需求: 1.1, 2.1, 3.1
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { 
  CanvasImage, 
  CanvasState, 
  Viewport, 
  SavedImage 
} from '../../../shared/types';
import { apiService } from '../services/api';

// 防抖延迟时间（毫秒）
const DEBOUNCE_DELAY = 500;

// 默认图片尺寸
const DEFAULT_IMAGE_WIDTH = 400;
const DEFAULT_IMAGE_HEIGHT = 400;

// 画布显示的最大尺寸
const MAX_DISPLAY_SIZE = 400;

// 网格布局参数
const GRID_PADDING = 5;  // 重叠检测边距（减小以让图片更紧凑）
const GRID_START_X = 100;
const GRID_START_Y = 100;
const GRID_COL_WIDTH = 450;
const GRID_ROW_HEIGHT = 450;
const GRID_MAX_COLS = 4;

// 图片位置计算参数（需求 10.1-10.7）
// 你可以在这里调整间距值：
export const VERTICAL_SPACING = 10;     // 垂直间距（组与组之间的间距）
export const HORIZONTAL_SPACING = 10;   // 水平间距（批量生成时同组图片之间的间距）
const INITIAL_X = 100;            // 初始 X 坐标
const INITIAL_Y = 100;            // 初始 Y 坐标

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
  maxSize: number = MAX_DISPLAY_SIZE
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
 * 锚点图片信息
 * 用于计算新生成图片的位置
 */
export interface AnchorImage {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  createdAt?: Date;
}

/**
 * 生成位置信息
 */
export interface GenerationPosition {
  anchorImage: AnchorImage | null;  // 参考锚点图片
  basePosition: { x: number; y: number };  // 基准位置
  direction: 'below' | 'right';  // 排列方向
  spacing: number;  // 图片间距
}

/**
 * 找到最近一次生成的图片组中最左边的图片作为锚点
 * 需求 10.1, 10.4
 * 
 * 逻辑：
 * 1. 找到最新的图片（按创建时间）
 * 2. 找到与最新图片在同一行（Y 坐标相近）的所有图片
 * 3. 从这些图片中选择 X 坐标最小的（最左边的）作为锚点
 * 
 * @param images 现有图片列表
 * @returns 锚点图片信息，如果没有图片则返回 null
 */
export function findAnchorImage(images: CanvasImage[]): AnchorImage | null {
  if (images.length === 0) {
    return null;
  }

  // 按创建时间排序，找到最新的图片
  const sortedImages = [...images].sort((a, b) => {
    const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return dateB - dateA;
  });

  const latestImage = sortedImages[0];
  const latestY = latestImage.y ?? latestImage.canvasY ?? 0;
  
  // 找到与最新图片在同一行的所有图片（Y 坐标差距在 50px 以内视为同一行）
  const Y_TOLERANCE = 50;
  const sameRowImages = images.filter(img => {
    const imgY = img.y ?? img.canvasY ?? 0;
    return Math.abs(imgY - latestY) < Y_TOLERANCE;
  });
  
  // 从同一行的图片中找到 X 坐标最小的（最左边的）
  let leftmostImage = sameRowImages[0];
  let minX = leftmostImage.x ?? leftmostImage.canvasX ?? Infinity;
  
  for (const img of sameRowImages) {
    const imgX = img.x ?? img.canvasX ?? 0;
    if (imgX < minX) {
      minX = imgX;
      leftmostImage = img;
    }
  }
  
  // 获取图片的最新位置（优先使用运行时位置 x/y，因为它可能被用户拖动更新）
  const x = leftmostImage.x ?? leftmostImage.canvasX ?? 0;
  const y = leftmostImage.y ?? leftmostImage.canvasY ?? 0;
  
  // 获取实际像素尺寸
  const actualWidth = leftmostImage.width || DEFAULT_IMAGE_WIDTH;
  const actualHeight = leftmostImage.height || DEFAULT_IMAGE_HEIGHT;
  
  // 计算画布显示尺寸（用于位置计算）
  const displaySize = calculateDisplaySize(actualWidth, actualHeight);

  return {
    id: leftmostImage.id,
    x,
    y,
    width: displaySize.width,
    height: displaySize.height,
    createdAt: leftmostImage.createdAt,
  };
}

/**
 * 获取锚点图片的最新位置
 * 需求 10.4 - 考虑用户手动拖动后的位置
 * 
 * @param images 现有图片列表
 * @param anchorId 锚点图片 ID
 * @returns 锚点图片的最新位置，如果找不到则返回 null
 */
export function getAnchorPosition(
  images: CanvasImage[],
  anchorId: string
): { x: number; y: number; width: number; height: number } | null {
  const anchorImage = images.find(img => img.id === anchorId);
  
  if (!anchorImage) {
    return null;
  }

  // 优先使用运行时位置（x/y），因为它可能被用户拖动更新
  // 如果没有运行时位置，则使用持久化位置（canvasX/canvasY）
  const x = anchorImage.x ?? anchorImage.canvasX ?? 0;
  const y = anchorImage.y ?? anchorImage.canvasY ?? 0;
  
  // 获取实际像素尺寸
  const actualWidth = anchorImage.width || DEFAULT_IMAGE_WIDTH;
  const actualHeight = anchorImage.height || DEFAULT_IMAGE_HEIGHT;
  
  // 计算画布显示尺寸
  const displaySize = calculateDisplaySize(actualWidth, actualHeight);

  return { x, y, width: displaySize.width, height: displaySize.height };
}

/**
 * 检查两个矩形是否重叠
 * 
 * @param rect1 第一个矩形
 * @param rect2 第二个矩形
 * @param padding 边距
 * @returns 是否重叠
 */
function checkRectOverlap(
  rect1: { x: number; y: number; width: number; height: number },
  rect2: { x: number; y: number; width: number; height: number },
  padding: number = 0
): boolean {
  const r1Left = rect1.x - padding;
  const r1Right = rect1.x + rect1.width + padding;
  const r1Top = rect1.y - padding;
  const r1Bottom = rect1.y + rect1.height + padding;

  const r2Left = rect2.x;
  const r2Right = rect2.x + rect2.width;
  const r2Top = rect2.y;
  const r2Bottom = rect2.y + rect2.height;

  // 检查是否不重叠
  return !(r1Right <= r2Left || r1Left >= r2Right || r1Bottom <= r2Top || r1Top >= r2Bottom);
}

/**
 * 检查位置是否与现有图片重叠
 * 需求 10.3
 * 
 * @param existingImages 现有图片列表
 * @param position 要检查的位置
 * @param size 新图片尺寸
 * @param excludeIds 排除的图片 ID 列表
 * @returns 是否重叠
 */
export function checkPositionOverlap(
  existingImages: CanvasImage[],
  position: { x: number; y: number },
  size: { width: number; height: number },
  excludeIds: string[] = []
): boolean {
  const newRect = {
    x: position.x,
    y: position.y,
    width: size.width,
    height: size.height,
  };

  return existingImages.some(img => {
    if (excludeIds.includes(img.id)) {
      return false;
    }

    // 优先使用运行时位置（x/y），因为它可能被用户拖动更新
    const imgX = img.x ?? img.canvasX ?? 0;
    const imgY = img.y ?? img.canvasY ?? 0;
    
    // 获取实际像素尺寸并计算画布显示尺寸
    const actualWidth = img.width || DEFAULT_IMAGE_WIDTH;
    const actualHeight = img.height || DEFAULT_IMAGE_HEIGHT;
    const displaySize = calculateDisplaySize(actualWidth, actualHeight);

    const existingRect = {
      x: imgX,
      y: imgY,
      width: displaySize.width,
      height: displaySize.height,
    };

    return checkRectOverlap(newRect, existingRect, GRID_PADDING);
  });
}

/**
 * 找到不重叠的位置
 * 需求 10.3, 10.5
 * 
 * @param existingImages 现有图片列表
 * @param startPosition 起始位置
 * @param size 新图片尺寸
 * @param excludeIds 排除的图片 ID 列表
 * @returns 不重叠的位置
 */
export function findNonOverlappingPositionFromStart(
  existingImages: CanvasImage[],
  startPosition: { x: number; y: number },
  size: { width: number; height: number },
  excludeIds: string[] = []
): { x: number; y: number } {
  let testPosition = { ...startPosition };
  let attempts = 0;
  const maxAttempts = 100;

  while (attempts < maxAttempts) {
    if (!checkPositionOverlap(existingImages, testPosition, size, excludeIds)) {
      return testPosition;
    }

    // 尝试向下移动
    testPosition.y += size.height + VERTICAL_SPACING;
    attempts++;

    // 如果向下移动太多次，尝试向右移动并重置 Y
    if (attempts % 10 === 0) {
      testPosition.x += size.width + HORIZONTAL_SPACING;
      testPosition.y = startPosition.y;
    }
  }

  // 如果找不到不重叠的位置，返回起始位置下方
  return {
    x: startPosition.x,
    y: startPosition.y + (maxAttempts / 10) * (size.height + VERTICAL_SPACING),
  };
}

/**
 * 计算新图片的位置
 * 需求 10.1, 10.2, 10.3, 10.4, 10.5
 * 
 * @param existingImages 现有图片列表
 * @param newImageSize 新图片尺寸
 * @param batchIndex 批量生成中的索引（从 0 开始）
 * @param batchCount 批量生成总数
 * @returns 新图片的位置
 */
export function calculateNewImagePosition(
  existingImages: CanvasImage[],
  newImageSize: { width: number; height: number },
  batchIndex: number = 0,
  batchCount: number = 1
): { x: number; y: number } {
  // 1. 找到最近生成的图片作为锚点（需求 10.1）
  const anchorImage = findAnchorImage(existingImages);

  // 2. 计算新图片的基准位置（锚点下方）（需求 10.2）
  let baseY: number;
  let baseX: number;

  if (anchorImage) {
    // 获取锚点的最新位置（考虑用户拖动）（需求 10.4）
    baseY = anchorImage.y + anchorImage.height + VERTICAL_SPACING;
    baseX = anchorImage.x;
  } else {
    // 没有锚点，使用初始位置
    baseY = INITIAL_Y;
    baseX = INITIAL_X;
  }

  // 3. 批量生成时横向排列（需求 10.5）
  const horizontalOffset = batchIndex * (newImageSize.width + HORIZONTAL_SPACING);
  const targetX = baseX + horizontalOffset;
  const targetY = baseY;

  // 4. 检测并避免重叠（需求 10.3）
  const finalPosition = findNonOverlappingPositionFromStart(
    existingImages,
    { x: targetX, y: targetY },
    newImageSize
  );

  return finalPosition;
}

/**
 * 计算批量生成图片的所有位置
 * 需求 10.2, 10.3, 10.5
 * 
 * @param existingImages 现有图片列表
 * @param imageSize 图片尺寸
 * @param count 生成数量
 * @returns 所有图片的位置数组
 */
export function calculateBatchPositions(
  existingImages: CanvasImage[],
  imageSize: { width: number; height: number },
  count: number
): { x: number; y: number }[] {
  const positions: { x: number; y: number }[] = [];
  
  // 1. 找到锚点图片
  const anchorImage = findAnchorImage(existingImages);
  
  // 2. 计算基准位置（锚点下方）
  let baseY: number;
  let baseX: number;

  if (anchorImage) {
    baseY = anchorImage.y + anchorImage.height + VERTICAL_SPACING;
    baseX = anchorImage.x;
  } else {
    baseY = INITIAL_Y;
    baseX = INITIAL_X;
  }

  // 3. 批量生成时，所有图片在同一水平线上横向排列
  for (let i = 0; i < count; i++) {
    const horizontalOffset = i * (imageSize.width + HORIZONTAL_SPACING);
    positions.push({
      x: baseX + horizontalOffset,
      y: baseY,  // 所有图片保持相同的 Y 坐标
    });
  }

  // 4. 检查是否与现有图片重叠，如果重叠则整体下移
  let hasOverlap = true;
  let attempts = 0;
  const maxAttempts = 50;

  while (hasOverlap && attempts < maxAttempts) {
    hasOverlap = false;
    
    for (const pos of positions) {
      if (checkPositionOverlap(existingImages, pos, imageSize)) {
        hasOverlap = true;
        break;
      }
    }

    if (hasOverlap) {
      // 整体下移
      for (const pos of positions) {
        pos.y += imageSize.height + VERTICAL_SPACING;
      }
      attempts++;
    }
  }

  return positions;
}

/**
 * 计算生成区域的边界框
 * 需求 10.6
 * 
 * @param positions 图片位置数组
 * @param imageSize 图片尺寸
 * @returns 边界框
 */
export function calculateGenerationArea(
  positions: { x: number; y: number }[],
  imageSize: { width: number; height: number }
): { x: number; y: number; width: number; height: number } {
  if (positions.length === 0) {
    return { x: INITIAL_X, y: INITIAL_Y, width: imageSize.width, height: imageSize.height };
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  positions.forEach(pos => {
    minX = Math.min(minX, pos.x);
    minY = Math.min(minY, pos.y);
    maxX = Math.max(maxX, pos.x + imageSize.width);
    maxY = Math.max(maxY, pos.y + imageSize.height);
  });

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

/**
 * 检查目标区域是否在当前视口内
 * 需求 10.7
 * 
 * @param targetArea 目标区域
 * @param viewport 当前视口
 * @returns 是否在视口内
 */
export function checkAreaInViewport(
  targetArea: { x: number; y: number; width: number; height: number },
  viewport: Viewport
): boolean {
  // 计算视口在画布坐标系中的边界
  const viewLeft = viewport.x;
  const viewTop = viewport.y;
  const viewRight = viewport.x + viewport.width / viewport.scale;
  const viewBottom = viewport.y + viewport.height / viewport.scale;

  // 计算目标区域的边界
  const areaLeft = targetArea.x;
  const areaTop = targetArea.y;
  const areaRight = targetArea.x + targetArea.width;
  const areaBottom = targetArea.y + targetArea.height;

  // 检查目标区域是否完全在视口内
  return (
    areaLeft >= viewLeft &&
    areaTop >= viewTop &&
    areaRight <= viewRight &&
    areaBottom <= viewBottom
  );
}

/**
 * 计算将目标区域居中显示所需的视口位置
 * 需求 10.7
 * 
 * @param targetArea 目标区域
 * @param viewportSize 视口尺寸
 * @param currentScale 当前缩放比例
 * @returns 新的视口位置（position.x, position.y 的值）
 */
export function calculateViewportPositionForArea(
  targetArea: { x: number; y: number; width: number; height: number },
  viewportSize: { width: number; height: number },
  currentScale: number
): { x: number; y: number } {
  // 计算目标区域中心
  const targetCenterX = targetArea.x + targetArea.width / 2;
  const targetCenterY = targetArea.y + targetArea.height / 2;

  // 计算将目标区域居中显示的位置
  // position.x = viewportWidth / 2 - targetCenterX * scale
  const newX = viewportSize.width / 2 - targetCenterX * currentScale;
  const newY = viewportSize.height / 2 - targetCenterY * currentScale;

  return { x: newX, y: newY };
}

/**
 * 视角聚焦配置
 */
export interface FocusConfig {
  duration: number;  // 动画持续时间（毫秒）
  easing: 'linear' | 'easeOut' | 'easeInOut';  // 缓动函数
}

/**
 * 默认聚焦配置
 */
export const DEFAULT_FOCUS_CONFIG: FocusConfig = {
  duration: 300,
  easing: 'easeOut',
};

/**
 * 缓动函数
 */
export function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

export function easeInOutCubic(t: number): number {
  return t < 0.5
    ? 4 * t * t * t
    : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/**
 * 执行视角聚焦动画
 * 需求 10.6, 10.7
 * 
 * @param targetArea 目标区域
 * @param currentPosition 当前视口位置
 * @param currentScale 当前缩放比例
 * @param viewportSize 视口尺寸
 * @param setPosition 设置位置的函数
 * @param config 聚焦配置
 * @returns Promise，动画完成时 resolve
 */
export function focusOnGenerationArea(
  targetArea: { x: number; y: number; width: number; height: number },
  currentPosition: { x: number; y: number },
  currentScale: number,
  viewportSize: { width: number; height: number },
  setPosition: (pos: { x: number; y: number }) => void,
  config: FocusConfig = DEFAULT_FOCUS_CONFIG
): Promise<void> {
  return new Promise((resolve) => {
    // 计算当前视口
    const currentViewport: Viewport = {
      x: -currentPosition.x / currentScale,
      y: -currentPosition.y / currentScale,
      width: viewportSize.width,
      height: viewportSize.height,
      scale: currentScale,
    };

    // 检查目标区域是否已经在视口内
    if (checkAreaInViewport(targetArea, currentViewport)) {
      resolve();
      return;
    }

    // 计算目标位置
    const targetPosition = calculateViewportPositionForArea(
      targetArea,
      viewportSize,
      currentScale
    );

    // 执行平滑动画
    const startX = currentPosition.x;
    const startY = currentPosition.y;
    const startTime = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / config.duration, 1);

      // 应用缓动函数
      let easeProgress: number;
      switch (config.easing) {
        case 'easeOut':
          easeProgress = easeOutCubic(progress);
          break;
        case 'easeInOut':
          easeProgress = easeInOutCubic(progress);
          break;
        default:
          easeProgress = progress;
      }

      // 计算当前位置
      const newX = startX + (targetPosition.x - startX) * easeProgress;
      const newY = startY + (targetPosition.y - startY) * easeProgress;

      setPosition({ x: newX, y: newY });

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        resolve();
      }
    };

    requestAnimationFrame(animate);
  });
}

/**
 * 预计算生成区域并聚焦
 * 需求 10.6, 10.7
 * 
 * @param existingImages 现有图片列表
 * @param imageSize 图片尺寸
 * @param count 生成数量
 * @param currentPosition 当前视口位置
 * @param currentScale 当前缩放比例
 * @param viewportSize 视口尺寸
 * @param setPosition 设置位置的函数
 * @returns Promise，包含计算好的位置数组
 */
export async function prepareGenerationAreaAndFocus(
  existingImages: CanvasImage[],
  imageSize: { width: number; height: number },
  count: number,
  currentPosition: { x: number; y: number },
  currentScale: number,
  viewportSize: { width: number; height: number },
  setPosition: (pos: { x: number; y: number }) => void
): Promise<{ x: number; y: number }[]> {
  // 1. 计算所有图片的位置（需求 10.6）
  const positions = calculateBatchPositions(existingImages, imageSize, count);

  // 2. 计算生成区域的边界框
  const generationArea = calculateGenerationArea(positions, imageSize);

  // 3. 聚焦到生成区域（需求 10.7）
  await focusOnGenerationArea(
    generationArea,
    currentPosition,
    currentScale,
    viewportSize,
    setPosition
  );

  return positions;
}

/**
 * 计算不重叠的位置
 * 使用网格布局算法避免图片重叠
 * 
 * @param existingImages 现有图片列表
 * @param newWidth 新图片宽度
 * @param newHeight 新图片高度
 * @returns 不重叠的位置坐标
 */
export function findNonOverlappingPosition(
  existingImages: CanvasImage[],
  newWidth: number = DEFAULT_IMAGE_WIDTH,
  newHeight: number = DEFAULT_IMAGE_HEIGHT
): { x: number; y: number } {
  // 如果没有现有图片，返回起始位置
  if (existingImages.length === 0) {
    return { x: GRID_START_X, y: GRID_START_Y };
  }

  // 尝试在网格中找到不重叠的位置
  for (let row = 0; row < 100; row++) {
    for (let col = 0; col < GRID_MAX_COLS; col++) {
      const testX = GRID_START_X + col * GRID_COL_WIDTH;
      const testY = GRID_START_Y + row * GRID_ROW_HEIGHT;

      // 检查是否与现有图片重叠
      const overlaps = existingImages.some(img => {
        // 获取实际像素尺寸并计算画布显示尺寸
        const actualWidth = img.width || DEFAULT_IMAGE_WIDTH;
        const actualHeight = img.height || DEFAULT_IMAGE_HEIGHT;
        const displaySize = calculateDisplaySize(actualWidth, actualHeight);
        
        // 优先使用运行时位置（x/y），因为它可能被用户拖动更新
        const imgX = img.x ?? img.canvasX ?? 0;
        const imgY = img.y ?? img.canvasY ?? 0;

        const imgRight = imgX + displaySize.width;
        const imgBottom = imgY + displaySize.height;
        const testRight = testX + newWidth;
        const testBottom = testY + newHeight;

        // 检查矩形是否相交（包含边距）
        return !(
          testX >= imgRight + GRID_PADDING ||
          testRight <= imgX - GRID_PADDING ||
          testY >= imgBottom + GRID_PADDING ||
          testBottom <= imgY - GRID_PADDING
        );
      });

      if (!overlaps) {
        return { x: testX, y: testY };
      }
    }
  }

  // 如果找不到不重叠的位置，在最后一张图片下方放置
  const lastImage = existingImages[existingImages.length - 1];
  // 优先使用运行时位置
  const lastActualHeight = lastImage.height || DEFAULT_IMAGE_HEIGHT;
  const lastActualWidth = lastImage.width || DEFAULT_IMAGE_WIDTH;
  const lastDisplaySize = calculateDisplaySize(lastActualWidth, lastActualHeight);
  const lastY = (lastImage.y ?? lastImage.canvasY ?? 0) + lastDisplaySize.height;
  return { x: GRID_START_X, y: lastY + GRID_PADDING };
}

/**
 * 计算视口内可见的图片
 * 
 * @param images 所有图片列表
 * @param viewport 当前视口
 * @param buffer 边距缓冲区（提前加载即将可见的图片）
 * @returns 可见图片列表
 */
export function getVisibleImages(
  images: CanvasImage[],
  viewport: Viewport,
  buffer: number = 100
): CanvasImage[] {
  const viewLeft = viewport.x - buffer;
  const viewTop = viewport.y - buffer;
  const viewRight = viewport.x + viewport.width / viewport.scale + buffer;
  const viewBottom = viewport.y + viewport.height / viewport.scale + buffer;

  return images.filter(img => {
    // 优先使用运行时位置（x/y），因为它可能被用户拖动更新
    const imgX = img.x ?? img.canvasX ?? 0;
    const imgY = img.y ?? img.canvasY ?? 0;
    
    // 获取实际像素尺寸并计算画布显示尺寸
    const actualWidth = img.width || DEFAULT_IMAGE_WIDTH;
    const actualHeight = img.height || DEFAULT_IMAGE_HEIGHT;
    const displaySize = calculateDisplaySize(actualWidth, actualHeight);

    const imgRight = imgX + displaySize.width;
    const imgBottom = imgY + displaySize.height;

    // 检查图片边界框是否与视口相交
    return !(
      imgRight < viewLeft ||
      imgX > viewRight ||
      imgBottom < viewTop ||
      imgY > viewBottom
    );
  });
}

/**
 * useCanvasImages Hook 返回类型
 */
export interface UseCanvasImagesReturn {
  // 状态
  images: CanvasImage[];
  isLoading: boolean;
  error: string | null;
  canvasState: CanvasState | null;

  // 操作
  loadProjectImages: (projectId: string) => Promise<void>;
  updateImagePosition: (imageId: string, x: number, y: number) => void;
  savePendingPositions: () => void;
  getPendingUpdates: () => Map<string, { x: number; y: number }>;
  addNewImage: (image: CanvasImage) => void;
  removeImage: (imageId: string) => void;
  saveCanvasState: (state: CanvasState) => Promise<void>;
  clearImages: () => void;

  // 计算
  findNonOverlappingPosition: (width: number, height: number) => { x: number; y: number };
  getVisibleImages: (viewport: Viewport) => CanvasImage[];
}


/**
 * useCanvasImages Hook
 * 管理画布图片的加载、位置更新和状态持久化
 */
export function useCanvasImages(): UseCanvasImagesReturn {
  // 状态
  const [images, setImages] = useState<CanvasImage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [canvasState, setCanvasState] = useState<CanvasState | null>(null);

  // 当前项目 ID
  const currentProjectIdRef = useRef<string | null>(null);

  // 防抖定时器引用
  const debounceTimersRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  // 待保存的位置更新队列（用于网络失败时的本地缓存）
  const pendingUpdatesRef = useRef<Map<string, { x: number; y: number }>>(new Map());

  // 清理防抖定时器
  useEffect(() => {
    return () => {
      debounceTimersRef.current.forEach(timer => clearTimeout(timer));
      debounceTimersRef.current.clear();
    };
  }, []);

  /**
   * 加载项目图片
   * 需求: 1.1, 1.2
   */
  const loadProjectImages = useCallback(async (projectId: string) => {
    // 如果切换到不同项目，清空当前图片（需求 1.4）
    if (currentProjectIdRef.current !== projectId) {
      setImages([]);
      setCanvasState(null);
    }
    currentProjectIdRef.current = projectId;

    setIsLoading(true);
    setError(null);

    try {
      const response = await apiService.getProjectCanvasImages(projectId);
      
      if (response.success && response.data) {
        const { images: loadedImages, canvasState: loadedState } = response.data;
        
        // 转换为 CanvasImage 格式
        const canvasImages: CanvasImage[] = loadedImages.map((img: SavedImage) => ({
          ...img,
          x: img.canvasX ?? 0,
          y: img.canvasY ?? 0,
          width: img.width || DEFAULT_IMAGE_WIDTH,
          height: img.height || DEFAULT_IMAGE_HEIGHT,
          loadingState: 'placeholder' as const,
          isVisible: false,
        }));

        setImages(canvasImages);
        setCanvasState(loadedState || null);
      } else {
        // API 返回失败状态
        const errorMsg = response.error || '获取项目图片失败';
        console.error('获取项目图片失败:', errorMsg);
        setError(errorMsg);
      }
    } catch (err: any) {
      console.error('加载项目图片失败:', err);
      let errorMessage = '加载图片失败';
      
      // 根据错误类型提供更具体的错误信息
      if (err.name === 'TypeError' && err.message.includes('fetch')) {
        errorMessage = '网络连接失败，请检查网络连接';
      } else if (err.status === 401) {
        errorMessage = '登录已过期，请重新登录';
      } else if (err.status === 403) {
        errorMessage = '没有权限访问此项目';
      } else if (err.status === 404) {
        errorMessage = '项目不存在';
      } else if (err.status >= 500) {
        errorMessage = '服务器错误，请稍后重试';
      } else if (err.message) {
        errorMessage = err.message;
      }
      
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * 更新图片位置（仅更新本地状态，不保存到服务器）
   * 用于拖拽过程中的实时更新
   * 需求: 2.1
   */
  const updateImagePosition = useCallback((imageId: string, x: number, y: number) => {
    // 仅更新本地状态，不触发 API 调用
    setImages(prev => prev.map(img =>
      img.id === imageId
        ? { ...img, x, y, canvasX: x, canvasY: y }
        : img
    ));
    
    // 记录待保存的位置（用于页面卸载时保存）
    pendingUpdatesRef.current.set(imageId, { x, y });
  }, []);

  /**
   * 获取待保存的位置更新
   * 用于在页面卸载时获取最新的待保存数据
   */
  const getPendingUpdates = useCallback(() => {
    return pendingUpdatesRef.current;
  }, []);

  /**
   * 批量保存所有待保存的图片位置
   * 在页面卸载、组件销毁时调用
   * 需求: 2.1
   */
  const savePendingPositions = useCallback(async () => {
    const updates = pendingUpdatesRef.current;
    if (updates.size === 0) return;

    // 使用 Promise.all 并行保存所有待保存的位置
    const savePromises = Array.from(updates.entries()).map(async ([imageId, position]) => {
      try {
        await apiService.updateImageCanvasPosition(imageId, position.x, position.y);
        updates.delete(imageId);
      } catch (err: any) {
        console.error(`保存图片 ${imageId} 位置失败:`, err);
      }
    });

    await Promise.all(savePromises);
  }, []);

  /**
   * 添加新图片
   * 需求: 2.2, 6.1
   */
  const addNewImage = useCallback((image: CanvasImage) => {
    setImages(prev => {
      // 如果图片没有位置，计算不重叠的位置
      if (image.canvasX === undefined || image.canvasY === undefined) {
        const position = findNonOverlappingPosition(
          prev,
          image.width || DEFAULT_IMAGE_WIDTH,
          image.height || DEFAULT_IMAGE_HEIGHT
        );
        return [...prev, {
          ...image,
          x: position.x,
          y: position.y,
          canvasX: position.x,
          canvasY: position.y,
        }];
      }
      return [...prev, image];
    });
  }, []);

  /**
   * 移除图片
   */
  const removeImage = useCallback((imageId: string) => {
    setImages(prev => prev.filter(img => img.id !== imageId));
    // 清除该图片的防抖定时器
    const timer = debounceTimersRef.current.get(imageId);
    if (timer) {
      clearTimeout(timer);
      debounceTimersRef.current.delete(imageId);
    }
    // 从待保存队列中移除
    pendingUpdatesRef.current.delete(imageId);
  }, []);

  /**
   * 保存画布状态
   * 需求: 3.1
   */
  const saveCanvasState = useCallback(async (state: CanvasState) => {
    const projectId = currentProjectIdRef.current;
    if (!projectId) {
      console.warn('无法保存画布状态：没有当前项目');
      return;
    }

    // 立即更新本地状态
    setCanvasState(state);

    try {
      await apiService.saveCanvasState(projectId, state);
    } catch (err: any) {
      console.error('保存画布状态失败:', err);
      // 静默失败，不阻塞用户操作
    }
  }, []);

  /**
   * 清空图片
   */
  const clearImages = useCallback(() => {
    setImages([]);
    // 清除所有防抖定时器
    debounceTimersRef.current.forEach(timer => clearTimeout(timer));
    debounceTimersRef.current.clear();
    pendingUpdatesRef.current.clear();
  }, []);

  /**
   * 计算不重叠位置的包装函数
   */
  const findPosition = useCallback((width: number, height: number) => {
    return findNonOverlappingPosition(images, width, height);
  }, [images]);

  /**
   * 获取可见图片的包装函数
   */
  const getVisible = useCallback((viewport: Viewport) => {
    return getVisibleImages(images, viewport);
  }, [images]);

  return {
    // 状态
    images,
    isLoading,
    error,
    canvasState,

    // 操作
    loadProjectImages,
    updateImagePosition,
    savePendingPositions,
    getPendingUpdates,
    addNewImage,
    removeImage,
    saveCanvasState,
    clearImages,

    // 计算
    findNonOverlappingPosition: findPosition,
    getVisibleImages: getVisible,
  };
}

export default useCanvasImages;

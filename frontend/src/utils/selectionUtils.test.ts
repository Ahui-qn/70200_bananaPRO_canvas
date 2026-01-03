/**
 * 选区框计算和相交检测工具函数属性测试
 * 
 * 使用 fast-check 进行属性测试，验证核心算法的正确性
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  normalizeSelectionRect,
  rectsIntersect,
  getIntersectingImageIds,
  calculateDisplaySize,
  pointInRect,
  getImageAtPoint,
  SelectionRect,
} from './selectionUtils';
import { CanvasImage } from '../../../shared/types';

// ============================================
// 生成器
// ============================================

// 生成坐标点（支持负坐标，模拟画布坐标系）
const pointArb = fc.record({
  x: fc.integer({ min: -10000, max: 10000 }),
  y: fc.integer({ min: -10000, max: 10000 }),
});

// 生成正数尺寸
const positiveSizeArb = fc.integer({ min: 1, max: 5000 });

// 生成有效的选区框矩形
const selectionRectArb: fc.Arbitrary<SelectionRect> = fc.record({
  x: fc.integer({ min: -5000, max: 5000 }),
  y: fc.integer({ min: -5000, max: 5000 }),
  width: positiveSizeArb,
  height: positiveSizeArb,
});

// 生成图片 ID
const imageIdArb = fc.string({ minLength: 5, maxLength: 20 })
  .map(s => `img-${s.replace(/[^a-zA-Z0-9]/g, '')}`);

// 生成模拟的 CanvasImage 对象
const canvasImageArb: fc.Arbitrary<CanvasImage> = fc.record({
  id: imageIdArb,
  x: fc.integer({ min: -2000, max: 2000 }),
  y: fc.integer({ min: -2000, max: 2000 }),
  width: fc.integer({ min: 50, max: 2000 }),
  height: fc.integer({ min: 50, max: 2000 }),
}).map(({ id, x, y, width, height }) => ({
  id,
  x,
  y,
  canvasX: x,
  canvasY: y,
  width,
  height,
  url: `https://example.com/${id}.jpg`,
  thumbnailUrl: `https://example.com/${id}_thumb.jpg`,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
} as CanvasImage));

// 生成 CanvasImage 列表（确保 ID 唯一）
const canvasImageListArb = (minLength: number, maxLength: number): fc.Arbitrary<CanvasImage[]> => {
  return fc.array(canvasImageArb, { minLength, maxLength }).map(images => {
    const seen = new Set<string>();
    return images.filter(img => {
      if (seen.has(img.id)) return false;
      seen.add(img.id);
      return true;
    });
  });
};

// ============================================
// 属性测试：选区框矩形计算正确性
// ============================================

describe('selectionUtils - 选区框矩形计算属性测试', () => {
  /**
   * **Feature: canvas-multi-select, Property 4: 选区框矩形计算正确性**
   * **Validates: Requirements 3.2, 8.3**
   * 
   * 对于任意起始点和结束点，计算出的选区框矩形应该正确处理所有四个象限方向（包括负坐标）
   */
  describe('属性 4: 选区框矩形计算正确性', () => {
    it('width 和 height 始终为非负数', () => {
      fc.assert(
        fc.property(
          pointArb,
          pointArb,
          (startPoint, endPoint) => {
            const rect = normalizeSelectionRect(startPoint, endPoint);
            
            // 验证：width 和 height 始终为非负数
            expect(rect.width).toBeGreaterThanOrEqual(0);
            expect(rect.height).toBeGreaterThanOrEqual(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('x, y 始终是矩形的左上角', () => {
      fc.assert(
        fc.property(
          pointArb,
          pointArb,
          (startPoint, endPoint) => {
            const rect = normalizeSelectionRect(startPoint, endPoint);
            
            // 验证：x 是两点中较小的 x 值
            expect(rect.x).toBe(Math.min(startPoint.x, endPoint.x));
            
            // 验证：y 是两点中较小的 y 值
            expect(rect.y).toBe(Math.min(startPoint.y, endPoint.y));
          }
        ),
        { numRuns: 100 }
      );
    });

    it('矩形面积等于两点坐标差的绝对值乘积', () => {
      fc.assert(
        fc.property(
          pointArb,
          pointArb,
          (startPoint, endPoint) => {
            const rect = normalizeSelectionRect(startPoint, endPoint);
            
            // 计算预期的宽度和高度
            const expectedWidth = Math.abs(endPoint.x - startPoint.x);
            const expectedHeight = Math.abs(endPoint.y - startPoint.y);
            
            // 验证：宽度和高度正确
            expect(rect.width).toBe(expectedWidth);
            expect(rect.height).toBe(expectedHeight);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('四个象限方向的选区框都能正确处理', () => {
      // 测试从原点向四个象限方向拖动
      const origin = { x: 0, y: 0 };
      
      // 第一象限（右下）
      const q1 = normalizeSelectionRect(origin, { x: 100, y: 100 });
      expect(q1.x).toBe(0);
      expect(q1.y).toBe(0);
      expect(q1.width).toBe(100);
      expect(q1.height).toBe(100);
      
      // 第二象限（左下）
      const q2 = normalizeSelectionRect(origin, { x: -100, y: 100 });
      expect(q2.x).toBe(-100);
      expect(q2.y).toBe(0);
      expect(q2.width).toBe(100);
      expect(q2.height).toBe(100);
      
      // 第三象限（左上）
      const q3 = normalizeSelectionRect(origin, { x: -100, y: -100 });
      expect(q3.x).toBe(-100);
      expect(q3.y).toBe(-100);
      expect(q3.width).toBe(100);
      expect(q3.height).toBe(100);
      
      // 第四象限（右上）
      const q4 = normalizeSelectionRect(origin, { x: 100, y: -100 });
      expect(q4.x).toBe(0);
      expect(q4.y).toBe(-100);
      expect(q4.width).toBe(100);
      expect(q4.height).toBe(100);
    });

    it('起点和终点相同时，矩形尺寸为零', () => {
      fc.assert(
        fc.property(
          pointArb,
          (point) => {
            const rect = normalizeSelectionRect(point, point);
            
            // 验证：尺寸为零
            expect(rect.width).toBe(0);
            expect(rect.height).toBe(0);
            
            // 验证：位置正确
            expect(rect.x).toBe(point.x);
            expect(rect.y).toBe(point.y);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('交换起点和终点不影响结果', () => {
      fc.assert(
        fc.property(
          pointArb,
          pointArb,
          (startPoint, endPoint) => {
            const rect1 = normalizeSelectionRect(startPoint, endPoint);
            const rect2 = normalizeSelectionRect(endPoint, startPoint);
            
            // 验证：交换起点和终点后结果相同
            expect(rect1.x).toBe(rect2.x);
            expect(rect1.y).toBe(rect2.y);
            expect(rect1.width).toBe(rect2.width);
            expect(rect1.height).toBe(rect2.height);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});


// ============================================
// 属性测试：矩形相交检测正确性
// ============================================

describe('selectionUtils - 矩形相交检测属性测试', () => {
  /**
   * **Feature: canvas-multi-select, Property 5: 矩形相交检测正确性**
   * **Validates: Requirements 3.3**
   * 
   * 对于任意选区框矩形和图片矩形，相交检测结果应该正确：
   * 当且仅当两个矩形有重叠区域时返回 true
   */
  describe('属性 5: 矩形相交检测正确性', () => {
    it('相同矩形应该相交', () => {
      fc.assert(
        fc.property(
          selectionRectArb,
          (rect) => {
            // 验证：相同矩形应该相交
            expect(rectsIntersect(rect, rect)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('相交检测是对称的', () => {
      fc.assert(
        fc.property(
          selectionRectArb,
          selectionRectArb,
          (rect1, rect2) => {
            // 验证：rectsIntersect(A, B) === rectsIntersect(B, A)
            expect(rectsIntersect(rect1, rect2)).toBe(rectsIntersect(rect2, rect1));
          }
        ),
        { numRuns: 100 }
      );
    });

    it('完全分离的矩形不相交', () => {
      fc.assert(
        fc.property(
          selectionRectArb,
          fc.integer({ min: 100, max: 1000 }), // 分离距离
          (rect, gap) => {
            // 创建一个在 rect 右边完全分离的矩形
            const separatedRect: SelectionRect = {
              x: rect.x + rect.width + gap,
              y: rect.y,
              width: rect.width,
              height: rect.height,
            };
            
            // 验证：完全分离的矩形不相交
            expect(rectsIntersect(rect, separatedRect)).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('包含关系的矩形应该相交', () => {
      fc.assert(
        fc.property(
          selectionRectArb,
          fc.integer({ min: 10, max: 100 }), // 内边距
          (outerRect, padding) => {
            // 前置条件：外部矩形足够大
            fc.pre(outerRect.width > padding * 2 && outerRect.height > padding * 2);
            
            // 创建一个被包含的内部矩形
            const innerRect: SelectionRect = {
              x: outerRect.x + padding,
              y: outerRect.y + padding,
              width: outerRect.width - padding * 2,
              height: outerRect.height - padding * 2,
            };
            
            // 验证：包含关系的矩形应该相交
            expect(rectsIntersect(outerRect, innerRect)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('边缘接触的矩形不相交（使用严格比较）', () => {
      fc.assert(
        fc.property(
          selectionRectArb,
          (rect) => {
            // 创建一个刚好在 rect 右边缘的矩形
            const touchingRect: SelectionRect = {
              x: rect.x + rect.width, // 刚好接触
              y: rect.y,
              width: rect.width,
              height: rect.height,
            };
            
            // 验证：边缘接触的矩形不相交（使用 <= 比较）
            expect(rectsIntersect(rect, touchingRect)).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('部分重叠的矩形应该相交', () => {
      fc.assert(
        fc.property(
          selectionRectArb,
          fc.integer({ min: 1, max: 50 }), // 重叠量
          (rect, overlap) => {
            // 前置条件：重叠量小于矩形尺寸
            fc.pre(overlap < rect.width && overlap < rect.height);
            
            // 创建一个部分重叠的矩形
            const overlappingRect: SelectionRect = {
              x: rect.x + rect.width - overlap,
              y: rect.y + rect.height - overlap,
              width: rect.width,
              height: rect.height,
            };
            
            // 验证：部分重叠的矩形应该相交
            expect(rectsIntersect(rect, overlappingRect)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('四个方向分离的矩形都不相交', () => {
      const baseRect: SelectionRect = { x: 100, y: 100, width: 50, height: 50 };
      
      // 左边分离
      const leftRect: SelectionRect = { x: 0, y: 100, width: 50, height: 50 };
      expect(rectsIntersect(baseRect, leftRect)).toBe(false);
      
      // 右边分离
      const rightRect: SelectionRect = { x: 200, y: 100, width: 50, height: 50 };
      expect(rectsIntersect(baseRect, rightRect)).toBe(false);
      
      // 上边分离
      const topRect: SelectionRect = { x: 100, y: 0, width: 50, height: 50 };
      expect(rectsIntersect(baseRect, topRect)).toBe(false);
      
      // 下边分离
      const bottomRect: SelectionRect = { x: 100, y: 200, width: 50, height: 50 };
      expect(rectsIntersect(baseRect, bottomRect)).toBe(false);
    });
  });
});

// ============================================
// 属性测试：框选结果与相交检测一致
// ============================================

describe('selectionUtils - 框选结果属性测试', () => {
  /**
   * **Feature: canvas-multi-select, Property 6: 框选结果与相交检测一致**
   * **Validates: Requirements 3.3, 3.4, 3.5**
   * 
   * 对于任意选区框和图片集合，框选完成后选中的图片集合应该等于与选区框相交的图片集合
   */
  describe('属性 6: 框选结果与相交检测一致', () => {
    it('返回的图片 ID 都与选区框相交', () => {
      fc.assert(
        fc.property(
          selectionRectArb,
          canvasImageListArb(0, 20),
          (selectionRect, images) => {
            const intersectingIds = getIntersectingImageIds(selectionRect, images);
            
            // 验证：返回的每个 ID 对应的图片都与选区框相交
            for (const id of intersectingIds) {
              const image = images.find(img => img.id === id);
              expect(image).toBeDefined();
              
              if (image) {
                const imgX = image.x ?? image.canvasX ?? 0;
                const imgY = image.y ?? image.canvasY ?? 0;
                const displaySize = calculateDisplaySize(
                  image.width || 400,
                  image.height || 400,
                  400
                );
                
                const imageRect: SelectionRect = {
                  x: imgX,
                  y: imgY,
                  width: displaySize.width,
                  height: displaySize.height,
                };
                
                expect(rectsIntersect(selectionRect, imageRect)).toBe(true);
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('不相交的图片不会被返回', () => {
      fc.assert(
        fc.property(
          selectionRectArb,
          canvasImageListArb(0, 20),
          (selectionRect, images) => {
            const intersectingIds = getIntersectingImageIds(selectionRect, images);
            const intersectingIdSet = new Set(intersectingIds);
            
            // 验证：不在返回列表中的图片都不与选区框相交
            for (const image of images) {
              if (!intersectingIdSet.has(image.id)) {
                const imgX = image.x ?? image.canvasX ?? 0;
                const imgY = image.y ?? image.canvasY ?? 0;
                const displaySize = calculateDisplaySize(
                  image.width || 400,
                  image.height || 400,
                  400
                );
                
                const imageRect: SelectionRect = {
                  x: imgX,
                  y: imgY,
                  width: displaySize.width,
                  height: displaySize.height,
                };
                
                expect(rectsIntersect(selectionRect, imageRect)).toBe(false);
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('空图片列表返回空数组', () => {
      fc.assert(
        fc.property(
          selectionRectArb,
          (selectionRect) => {
            const intersectingIds = getIntersectingImageIds(selectionRect, []);
            
            // 验证：空列表返回空数组
            expect(intersectingIds).toEqual([]);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('返回的 ID 列表不包含重复项', () => {
      fc.assert(
        fc.property(
          selectionRectArb,
          canvasImageListArb(0, 20),
          (selectionRect, images) => {
            const intersectingIds = getIntersectingImageIds(selectionRect, images);
            
            // 验证：没有重复的 ID
            const uniqueIds = new Set(intersectingIds);
            expect(uniqueIds.size).toBe(intersectingIds.length);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});


// ============================================
// 辅助函数测试
// ============================================

describe('selectionUtils - 辅助函数属性测试', () => {
  describe('calculateDisplaySize', () => {
    it('返回的尺寸不超过最大限制', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 10000 }),
          fc.integer({ min: 1, max: 10000 }),
          fc.integer({ min: 100, max: 1000 }),
          (width, height, maxSize) => {
            const result = calculateDisplaySize(width, height, maxSize);
            
            // 验证：返回的尺寸不超过最大限制
            expect(result.width).toBeLessThanOrEqual(maxSize);
            expect(result.height).toBeLessThanOrEqual(maxSize);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('保持宽高比', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 5000 }),
          fc.integer({ min: 1, max: 5000 }),
          fc.integer({ min: 100, max: 1000 }),
          (width, height, maxSize) => {
            const result = calculateDisplaySize(width, height, maxSize);
            
            // 计算原始宽高比和结果宽高比
            const originalRatio = width / height;
            const resultRatio = result.width / result.height;
            
            // 验证：宽高比保持一致（允许小误差）
            expect(resultRatio).toBeCloseTo(originalRatio, 5);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('小于最大尺寸的图片保持原始尺寸', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 200 }),
          fc.integer({ min: 1, max: 200 }),
          (width, height) => {
            const maxSize = 400;
            const result = calculateDisplaySize(width, height, maxSize);
            
            // 验证：小图片保持原始尺寸
            expect(result.width).toBe(width);
            expect(result.height).toBe(height);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('pointInRect', () => {
    it('矩形内的点返回 true', () => {
      fc.assert(
        fc.property(
          selectionRectArb,
          (rect) => {
            // 生成矩形内的点
            const innerPoint = {
              x: rect.x + rect.width / 2,
              y: rect.y + rect.height / 2,
            };
            
            // 验证：矩形内的点返回 true
            expect(pointInRect(innerPoint, rect)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('矩形外的点返回 false', () => {
      fc.assert(
        fc.property(
          selectionRectArb,
          fc.integer({ min: 10, max: 100 }),
          (rect, offset) => {
            // 生成矩形外的点（在右边）
            const outerPoint = {
              x: rect.x + rect.width + offset,
              y: rect.y + rect.height / 2,
            };
            
            // 验证：矩形外的点返回 false
            expect(pointInRect(outerPoint, rect)).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('边界上的点返回 true', () => {
      fc.assert(
        fc.property(
          selectionRectArb,
          (rect) => {
            // 测试四个角
            const topLeft = { x: rect.x, y: rect.y };
            const topRight = { x: rect.x + rect.width, y: rect.y };
            const bottomLeft = { x: rect.x, y: rect.y + rect.height };
            const bottomRight = { x: rect.x + rect.width, y: rect.y + rect.height };
            
            // 验证：边界上的点返回 true
            expect(pointInRect(topLeft, rect)).toBe(true);
            expect(pointInRect(topRight, rect)).toBe(true);
            expect(pointInRect(bottomLeft, rect)).toBe(true);
            expect(pointInRect(bottomRight, rect)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('getImageAtPoint', () => {
    it('点击图片区域返回正确的图片 ID', () => {
      fc.assert(
        fc.property(
          canvasImageListArb(1, 10),
          (images) => {
            // 前置条件：至少有一张图片
            fc.pre(images.length > 0);
            
            // 选择第一张图片
            const targetImage = images[0];
            const imgX = targetImage.x ?? targetImage.canvasX ?? 0;
            const imgY = targetImage.y ?? targetImage.canvasY ?? 0;
            
            // 计算实际显示尺寸
            const displaySize = calculateDisplaySize(
              targetImage.width || 400,
              targetImage.height || 400,
              400
            );
            
            // 点击图片中心（使用显示尺寸的一半）
            const clickPoint = {
              x: imgX + displaySize.width / 2,
              y: imgY + displaySize.height / 2,
            };
            
            const result = getImageAtPoint(clickPoint, [targetImage]);
            
            // 验证：返回正确的图片 ID
            expect(result).toBe(targetImage.id);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('点击空白区域返回 null', () => {
      fc.assert(
        fc.property(
          canvasImageListArb(0, 5),
          (images) => {
            // 点击一个远离所有图片的位置
            const clickPoint = { x: -10000, y: -10000 };
            
            const result = getImageAtPoint(clickPoint, images);
            
            // 验证：返回 null
            expect(result).toBeNull();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('重叠图片返回最上层的图片（列表中最后的）', () => {
      // 创建两张重叠的图片
      const image1: CanvasImage = {
        id: 'img-1',
        x: 0,
        y: 0,
        canvasX: 0,
        canvasY: 0,
        width: 200,
        height: 200,
        url: 'https://example.com/1.jpg',
        thumbnailUrl: 'https://example.com/1_thumb.jpg',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      
      const image2: CanvasImage = {
        id: 'img-2',
        x: 50,
        y: 50,
        canvasX: 50,
        canvasY: 50,
        width: 200,
        height: 200,
        url: 'https://example.com/2.jpg',
        thumbnailUrl: 'https://example.com/2_thumb.jpg',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      
      // 点击重叠区域
      const clickPoint = { x: 100, y: 100 };
      
      // image2 在列表后面，应该被返回
      const result = getImageAtPoint(clickPoint, [image1, image2]);
      expect(result).toBe('img-2');
    });
  });
});

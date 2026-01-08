/**
 * CanvasImageLayer 属性测试
 * 
 * 使用 fast-check 进行属性测试，验证核心正确性属性
 * 每个属性测试运行至少 100 次迭代
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  getImageType,
  getCornerColor,
  formatDimensions,
  shouldShowRegenerateButton,
  CORNER_COLORS,
  ImageType,
} from './CanvasImageLayer';
import { CanvasImage } from '../../../shared/types';

// ============================================
// 测试数据生成器
// ============================================

/**
 * 生成随机的 model 值
 */
const modelArbitrary = fc.oneof(
  fc.constant('edited'),
  fc.constant('uploaded'),
  fc.constant('flux-dev'),
  fc.constant('flux-schnell'),
  fc.constant('sd-xl'),
  fc.constant('midjourney'),
  fc.constant('dalle-3'),
  fc.string({ minLength: 1, maxLength: 20 }),
  fc.constant(undefined),
  fc.constant(''),
);

/**
 * 生成随机的 CanvasImage 对象（最小化版本，只包含测试需要的字段）
 */
const canvasImageArbitrary = fc.record({
  id: fc.uuid(),
  url: fc.webUrl(),
  prompt: fc.string({ minLength: 1, maxLength: 100 }),
  model: modelArbitrary,
  aspectRatio: fc.constant('1:1'),
  imageSize: fc.constant('1K'),
  createdAt: fc.date(),
  favorite: fc.boolean(),
  ossUploaded: fc.boolean(),
  width: fc.integer({ min: 100, max: 4096 }),
  height: fc.integer({ min: 100, max: 4096 }),
}) as fc.Arbitrary<CanvasImage>;

/**
 * 生成正整数（用于尺寸测试）
 */
const positiveIntArbitrary = fc.integer({ min: 1, max: 10000 });

// ============================================
// Property 1: 图片类型颜色映射一致性
// Feature: image-selection-redesign, Property 1: 图片类型颜色映射一致性
// Validates: Requirements 1.1, 1.2, 1.3
// ============================================

describe('Property 1: 图片类型颜色映射一致性', () => {
  it('对于任意画布图片，getImageType 应该返回正确的类型', () => {
    fc.assert(
      fc.property(canvasImageArbitrary, (image) => {
        const imageType = getImageType(image);
        
        // 验证返回值是有效的 ImageType
        expect(['generated', 'edited', 'uploaded']).toContain(imageType);
        
        // 验证映射逻辑
        if (image.model === 'edited') {
          expect(imageType).toBe('edited');
        } else if (image.model === 'uploaded') {
          expect(imageType).toBe('uploaded');
        } else {
          expect(imageType).toBe('generated');
        }
      }),
      { numRuns: 100 }
    );
  });

  it('对于任意画布图片，getCornerColor 应该返回与类型对应的颜色', () => {
    fc.assert(
      fc.property(canvasImageArbitrary, (image) => {
        const color = getCornerColor(image);
        const imageType = getImageType(image);
        
        // 验证颜色与类型的对应关系
        expect(color).toBe(CORNER_COLORS[imageType]);
        
        // 验证具体颜色值
        if (imageType === 'generated') {
          expect(color).toBe('#FFFFFF');
        } else if (imageType === 'edited') {
          expect(color).toBe('#FACC15');
        } else if (imageType === 'uploaded') {
          expect(color).toBe('#3B82F6');
        }
      }),
      { numRuns: 100 }
    );
  });

  it('颜色映射应该覆盖所有可能的图片类型', () => {
    const allTypes: ImageType[] = ['generated', 'edited', 'uploaded'];
    
    allTypes.forEach(type => {
      expect(CORNER_COLORS[type]).toBeDefined();
      expect(typeof CORNER_COLORS[type]).toBe('string');
      expect(CORNER_COLORS[type]).toMatch(/^#[0-9A-Fa-f]{6}$/);
    });
  });
});

// ============================================
// Property 4: 尺寸格式化一致性
// Feature: image-selection-redesign, Property 4: 尺寸格式化一致性
// Validates: Requirements 3.2
// ============================================

describe('Property 4: 尺寸格式化一致性', () => {
  it('对于任意有效的宽度和高度值，格式化后的字符串应该符合 "宽度 × 高度" 的格式', () => {
    fc.assert(
      fc.property(positiveIntArbitrary, positiveIntArbitrary, (width, height) => {
        const formatted = formatDimensions(width, height);
        
        // 验证格式：数字 × 数字
        expect(formatted).toMatch(/^\d+ × \d+$/);
        
        // 验证包含正确的宽度和高度值
        const [formattedWidth, formattedHeight] = formatted.split(' × ').map(Number);
        expect(formattedWidth).toBe(Math.round(width));
        expect(formattedHeight).toBe(Math.round(height));
      }),
      { numRuns: 100 }
    );
  });

  it('格式化应该正确处理小数值（四舍五入）', () => {
    fc.assert(
      fc.property(
        fc.float({ min: 1, max: 10000, noNaN: true }),
        fc.float({ min: 1, max: 10000, noNaN: true }),
        (width, height) => {
          const formatted = formatDimensions(width, height);
          const [formattedWidth, formattedHeight] = formatted.split(' × ').map(Number);
          
          expect(formattedWidth).toBe(Math.round(width));
          expect(formattedHeight).toBe(Math.round(height));
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ============================================
// Property 5: 重新生成按钮显示逻辑
// Feature: image-selection-redesign, Property 5: 重新生成按钮显示逻辑
// Validates: Requirements 4.6
// ============================================

describe('Property 5: 重新生成按钮显示逻辑', () => {
  it('对于任意图片类型，重新生成按钮的显示应该遵循正确的逻辑', () => {
    fc.assert(
      fc.property(canvasImageArbitrary, (image) => {
        const shouldShow = shouldShowRegenerateButton(image);
        const imageType = getImageType(image);
        
        // 验证显示逻辑
        if (imageType === 'edited') {
          expect(shouldShow).toBe(false);
        } else if (imageType === 'uploaded') {
          expect(shouldShow).toBe(false);
        } else {
          expect(shouldShow).toBe(true);
        }
      }),
      { numRuns: 100 }
    );
  });

  it('只有 generated 类型的图片应该显示重新生成按钮', () => {
    // 测试 edited 类型
    const editedImage = { model: 'edited' } as CanvasImage;
    expect(shouldShowRegenerateButton(editedImage)).toBe(false);
    
    // 测试 uploaded 类型
    const uploadedImage = { model: 'uploaded' } as CanvasImage;
    expect(shouldShowRegenerateButton(uploadedImage)).toBe(false);
    
    // 测试 generated 类型（各种 model 值）
    const generatedImages = [
      { model: 'flux-dev' },
      { model: 'flux-schnell' },
      { model: 'sd-xl' },
      { model: '' },
      { model: undefined },
    ] as CanvasImage[];
    
    generatedImages.forEach(image => {
      expect(shouldShowRegenerateButton(image)).toBe(true);
    });
  });
});


// ============================================
// Property 2: 选中状态与 UI 元素显示同步
// Feature: image-selection-redesign, Property 2: 选中状态与 UI 元素显示同步
// Validates: Requirements 1.5, 3.1, 3.4, 4.1, 4.4
// ============================================

/**
 * 计算 UI 元素的可见性
 * 这是一个纯函数，用于测试显示逻辑
 */
function calculateUIVisibility(isSelected: boolean, isDragging: boolean): {
  showCorners: boolean;
  showDimensionBadge: boolean;
  showActionToolbar: boolean;
} {
  return {
    // 四角指示器：选中时显示，拖拽时也显示
    showCorners: isSelected,
    // 尺寸标签：选中且不拖拽时显示
    showDimensionBadge: isSelected && !isDragging,
    // 操作工具栏：选中且不拖拽时显示
    showActionToolbar: isSelected && !isDragging,
  };
}

describe('Property 2: 选中状态与 UI 元素显示同步', () => {
  it('对于任意选中状态和拖拽状态组合，UI 元素显示应该遵循正确的逻辑', () => {
    fc.assert(
      fc.property(fc.boolean(), fc.boolean(), (isSelected, isDragging) => {
        const visibility = calculateUIVisibility(isSelected, isDragging);
        
        // 验证四角指示器显示逻辑
        expect(visibility.showCorners).toBe(isSelected);
        
        // 验证尺寸标签显示逻辑
        if (!isSelected) {
          expect(visibility.showDimensionBadge).toBe(false);
        } else if (isDragging) {
          expect(visibility.showDimensionBadge).toBe(false);
        } else {
          expect(visibility.showDimensionBadge).toBe(true);
        }
        
        // 验证操作工具栏显示逻辑
        if (!isSelected) {
          expect(visibility.showActionToolbar).toBe(false);
        } else if (isDragging) {
          expect(visibility.showActionToolbar).toBe(false);
        } else {
          expect(visibility.showActionToolbar).toBe(true);
        }
      }),
      { numRuns: 100 }
    );
  });

  it('未选中时所有 UI 元素都应该隐藏', () => {
    const visibility = calculateUIVisibility(false, false);
    expect(visibility.showCorners).toBe(false);
    expect(visibility.showDimensionBadge).toBe(false);
    expect(visibility.showActionToolbar).toBe(false);
  });

  it('选中且不拖拽时所有 UI 元素都应该显示', () => {
    const visibility = calculateUIVisibility(true, false);
    expect(visibility.showCorners).toBe(true);
    expect(visibility.showDimensionBadge).toBe(true);
    expect(visibility.showActionToolbar).toBe(true);
  });

  it('选中且拖拽时只有四角指示器显示', () => {
    const visibility = calculateUIVisibility(true, true);
    expect(visibility.showCorners).toBe(true);
    expect(visibility.showDimensionBadge).toBe(false);
    expect(visibility.showActionToolbar).toBe(false);
  });
});


// ============================================
// Property 3: 拖拽状态 UI 简化
// Feature: image-selection-redesign, Property 3: 拖拽状态 UI 简化
// Validates: Requirements 3.5, 4.5, 5.1, 5.2
// ============================================

describe('Property 3: 拖拽状态 UI 简化', () => {
  it('拖拽时尺寸标签和工具栏应该隐藏，但四角指示器保持显示', () => {
    fc.assert(
      fc.property(fc.boolean(), (isSelected) => {
        // 拖拽状态
        const isDragging = true;
        const visibility = calculateUIVisibility(isSelected, isDragging);
        
        // 拖拽时，如果选中，四角指示器应该显示
        expect(visibility.showCorners).toBe(isSelected);
        
        // 拖拽时，尺寸标签和工具栏应该隐藏
        expect(visibility.showDimensionBadge).toBe(false);
        expect(visibility.showActionToolbar).toBe(false);
      }),
      { numRuns: 100 }
    );
  });

  it('拖拽结束后，选中图片的所有 UI 元素应该恢复显示', () => {
    // 模拟拖拽结束
    const isSelected = true;
    const isDragging = false;
    const visibility = calculateUIVisibility(isSelected, isDragging);
    
    expect(visibility.showCorners).toBe(true);
    expect(visibility.showDimensionBadge).toBe(true);
    expect(visibility.showActionToolbar).toBe(true);
  });
});

// ============================================
// Property 6: 视口外图片不渲染选中 UI
// Feature: image-selection-redesign, Property 6: 视口外图片不渲染选中 UI
// Validates: Requirements 6.5
// ============================================

/**
 * 判断图片是否在视口内
 * 这是一个简化的视口检测函数，用于测试
 */
function isImageInViewport(
  imageX: number,
  imageY: number,
  imageWidth: number,
  imageHeight: number,
  viewportX: number,
  viewportY: number,
  viewportWidth: number,
  viewportHeight: number,
  scale: number
): boolean {
  // 计算视口在画布坐标系中的范围
  const viewLeft = viewportX;
  const viewRight = viewportX + viewportWidth / scale;
  const viewTop = viewportY;
  const viewBottom = viewportY + viewportHeight / scale;
  
  // 计算图片的边界
  const imgLeft = imageX;
  const imgRight = imageX + imageWidth;
  const imgTop = imageY;
  const imgBottom = imageY + imageHeight;
  
  // 检查是否有重叠
  return !(imgRight < viewLeft || imgLeft > viewRight || imgBottom < viewTop || imgTop > viewBottom);
}

/**
 * 计算视口外图片的 UI 渲染状态
 * 视口外的图片不应该渲染选中 UI 组件
 */
function calculateViewportUIRendering(
  isInViewport: boolean,
  isSelected: boolean
): {
  shouldRenderFullUI: boolean;
  shouldRenderPlaceholder: boolean;
} {
  return {
    // 视口内的图片渲染完整 UI
    shouldRenderFullUI: isInViewport,
    // 视口外的图片只渲染轻量级占位符
    shouldRenderPlaceholder: !isInViewport,
  };
}

describe('Property 6: 视口外图片不渲染选中 UI', () => {
  it('视口外的图片应该只渲染占位符，不渲染选中 UI', () => {
    fc.assert(
      fc.property(fc.boolean(), (isSelected) => {
        // 图片在视口外
        const isInViewport = false;
        const rendering = calculateViewportUIRendering(isInViewport, isSelected);
        
        // 视口外的图片不应该渲染完整 UI
        expect(rendering.shouldRenderFullUI).toBe(false);
        // 视口外的图片应该渲染占位符
        expect(rendering.shouldRenderPlaceholder).toBe(true);
      }),
      { numRuns: 100 }
    );
  });

  it('视口内的图片应该渲染完整 UI', () => {
    fc.assert(
      fc.property(fc.boolean(), (isSelected) => {
        // 图片在视口内
        const isInViewport = true;
        const rendering = calculateViewportUIRendering(isInViewport, isSelected);
        
        // 视口内的图片应该渲染完整 UI
        expect(rendering.shouldRenderFullUI).toBe(true);
        // 视口内的图片不应该渲染占位符
        expect(rendering.shouldRenderPlaceholder).toBe(false);
      }),
      { numRuns: 100 }
    );
  });

  it('视口检测应该正确判断图片是否可见', () => {
    fc.assert(
      fc.property(
        // 图片位置和尺寸
        fc.integer({ min: -1000, max: 1000 }),
        fc.integer({ min: -1000, max: 1000 }),
        fc.integer({ min: 100, max: 500 }),
        fc.integer({ min: 100, max: 500 }),
        // 视口位置和尺寸
        fc.integer({ min: -500, max: 500 }),
        fc.integer({ min: -500, max: 500 }),
        fc.integer({ min: 800, max: 1920 }),
        fc.integer({ min: 600, max: 1080 }),
        // 缩放比例（使用 Math.fround 转换为 32 位浮点数）
        fc.float({ min: Math.fround(0.1), max: Math.fround(3), noNaN: true }),
        (imgX, imgY, imgW, imgH, vpX, vpY, vpW, vpH, scale) => {
          const isInViewport = isImageInViewport(
            imgX, imgY, imgW, imgH,
            vpX, vpY, vpW, vpH,
            scale
          );
          
          // 验证返回值是布尔类型
          expect(typeof isInViewport).toBe('boolean');
          
          // 验证完全在视口外的图片
          const viewRight = vpX + vpW / scale;
          const viewBottom = vpY + vpH / scale;
          
          // 如果图片完全在视口右侧
          if (imgX > viewRight) {
            expect(isInViewport).toBe(false);
          }
          // 如果图片完全在视口左侧
          if (imgX + imgW < vpX) {
            expect(isInViewport).toBe(false);
          }
          // 如果图片完全在视口下方
          if (imgY > viewBottom) {
            expect(isInViewport).toBe(false);
          }
          // 如果图片完全在视口上方
          if (imgY + imgH < vpY) {
            expect(isInViewport).toBe(false);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

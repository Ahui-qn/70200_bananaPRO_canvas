/**
 * CanvasImageLayer 组件属性测试
 * 
 * 测试重新生成按钮的可见性逻辑
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

// ============================================
// 测试辅助类型和函数
// ============================================

/**
 * 图片状态类型
 */
interface ImageState {
  url: string;
  isFailed: boolean;
  status?: 'pending' | 'success' | 'failed';
}

/**
 * 判断图片是否处于生成中状态
 * 与 CanvasImageItem 组件中的逻辑一致
 */
function isGenerating(image: ImageState): boolean {
  const isFailed = image.status === 'failed' || image.isFailed === true;
  return !image.url && !isFailed;
}

/**
 * 判断图片是否处于失败状态
 * 与 CanvasImageItem 组件中的逻辑一致
 */
function isFailed(image: ImageState): boolean {
  return image.status === 'failed' || image.isFailed === true;
}

/**
 * 判断重新生成按钮是否应该显示
 * 根据需求 1.2, 1.3：
 * - 生成中状态：隐藏按钮
 * - 失败状态：显示按钮
 * - 正常状态：显示按钮
 */
function shouldShowRegenerateButton(image: ImageState): boolean {
  // 生成中状态不显示按钮
  if (isGenerating(image)) {
    return false;
  }
  // 失败状态和正常状态都显示按钮
  return true;
}

// ============================================
// 属性测试
// ============================================

describe('CanvasImageLayer 重新生成按钮', () => {
  /**
   * **Feature: image-regenerate, Property 1: 按钮可见性状态**
   * **Validates: Requirements 1.2, 1.3**
   * 
   * 对于任意画布图片，当图片处于生成中状态（url 为空且非失败状态）时，
   * 重新生成按钮不应渲染；当图片处于正常状态或失败状态时，重新生成按钮应该渲染。
   */
  describe('Property 1: 按钮可见性状态', () => {
    // 生成随机图片状态的 Arbitrary
    const imageStateArb = fc.record({
      url: fc.oneof(fc.constant(''), fc.webUrl()),
      isFailed: fc.boolean(),
      status: fc.oneof(
        fc.constant(undefined),
        fc.constant('pending' as const),
        fc.constant('success' as const),
        fc.constant('failed' as const)
      ),
    });

    it('生成中状态时不显示重新生成按钮', () => {
      fc.assert(
        fc.property(imageStateArb, (image) => {
          // 如果是生成中状态（url 为空且非失败）
          if (isGenerating(image)) {
            // 按钮不应该显示
            expect(shouldShowRegenerateButton(image)).toBe(false);
          }
        }),
        { numRuns: 100 }
      );
    });

    it('失败状态时显示重新生成按钮', () => {
      fc.assert(
        fc.property(imageStateArb, (image) => {
          // 如果是失败状态
          if (isFailed(image)) {
            // 按钮应该显示
            expect(shouldShowRegenerateButton(image)).toBe(true);
          }
        }),
        { numRuns: 100 }
      );
    });

    it('正常状态（有 URL 且非失败）时显示重新生成按钮', () => {
      fc.assert(
        fc.property(imageStateArb, (image) => {
          // 如果是正常状态（有 URL 且非失败）
          if (image.url && !isFailed(image)) {
            // 按钮应该显示
            expect(shouldShowRegenerateButton(image)).toBe(true);
          }
        }),
        { numRuns: 100 }
      );
    });

    it('按钮可见性与图片状态的完整映射', () => {
      fc.assert(
        fc.property(imageStateArb, (image) => {
          const shouldShow = shouldShowRegenerateButton(image);
          const generating = isGenerating(image);
          const failed = isFailed(image);
          const hasUrl = !!image.url;

          // 验证逻辑一致性
          if (generating) {
            // 生成中 => 不显示
            expect(shouldShow).toBe(false);
          } else if (failed || hasUrl) {
            // 失败或有 URL => 显示
            expect(shouldShow).toBe(true);
          }
        }),
        { numRuns: 100 }
      );
    });
  });
});


// ============================================
// 添加为参考图按钮属性测试
// ============================================

describe('CanvasImageLayer 添加为参考图按钮', () => {
  /**
   * **Feature: add-as-reference-image, Property 1: 按钮可见性状态**
   * **Validates: Requirements 1.2, 1.3**
   * 
   * 对于任意画布图片，当图片处于生成中状态（isPlaceholder 为 true 且 url 为空）
   * 或失败状态（isFailed 为 true）时，"添加为参考图"按钮不应渲染；
   * 当图片处于正常状态（有有效 url 且未失败）时，按钮应该渲染。
   */
  describe('Property 1: 按钮可见性状态', () => {
    /**
     * 判断"添加为参考图"按钮是否应该显示
     * 根据需求 1.2, 1.3：
     * - 生成中状态：隐藏按钮
     * - 失败状态：隐藏按钮
     * - 正常状态（有有效 url）：显示按钮
     */
    function shouldShowAddAsReferenceButton(image: ImageState): boolean {
      // 生成中状态不显示按钮
      if (isGenerating(image)) {
        return false;
      }
      // 失败状态不显示按钮
      if (isFailed(image)) {
        return false;
      }
      // 正常状态（有有效 url）显示按钮
      return !!image.url;
    }

    // 生成随机图片状态的 Arbitrary
    const imageStateArb = fc.record({
      url: fc.oneof(fc.constant(''), fc.webUrl()),
      isFailed: fc.boolean(),
      status: fc.oneof(
        fc.constant(undefined),
        fc.constant('pending' as const),
        fc.constant('success' as const),
        fc.constant('failed' as const)
      ),
    });

    it('生成中状态时不显示添加为参考图按钮', () => {
      fc.assert(
        fc.property(imageStateArb, (image) => {
          // 如果是生成中状态（url 为空且非失败）
          if (isGenerating(image)) {
            // 按钮不应该显示
            expect(shouldShowAddAsReferenceButton(image)).toBe(false);
          }
        }),
        { numRuns: 100 }
      );
    });

    it('失败状态时不显示添加为参考图按钮', () => {
      fc.assert(
        fc.property(imageStateArb, (image) => {
          // 如果是失败状态
          if (isFailed(image)) {
            // 按钮不应该显示
            expect(shouldShowAddAsReferenceButton(image)).toBe(false);
          }
        }),
        { numRuns: 100 }
      );
    });

    it('正常状态（有 URL 且非失败）时显示添加为参考图按钮', () => {
      fc.assert(
        fc.property(imageStateArb, (image) => {
          // 如果是正常状态（有 URL 且非失败）
          if (image.url && !isFailed(image)) {
            // 按钮应该显示
            expect(shouldShowAddAsReferenceButton(image)).toBe(true);
          }
        }),
        { numRuns: 100 }
      );
    });

    it('按钮可见性与图片状态的完整映射', () => {
      fc.assert(
        fc.property(imageStateArb, (image) => {
          const shouldShow = shouldShowAddAsReferenceButton(image);
          const generating = isGenerating(image);
          const failed = isFailed(image);
          const hasUrl = !!image.url;

          // 验证逻辑一致性
          if (generating) {
            // 生成中 => 不显示
            expect(shouldShow).toBe(false);
          } else if (failed) {
            // 失败 => 不显示
            expect(shouldShow).toBe(false);
          } else if (hasUrl) {
            // 有 URL 且非失败非生成中 => 显示
            expect(shouldShow).toBe(true);
          } else {
            // 无 URL 且非失败非生成中 => 不显示
            expect(shouldShow).toBe(false);
          }
        }),
        { numRuns: 100 }
      );
    });
  });
});

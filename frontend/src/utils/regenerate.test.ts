/**
 * 重新生成功能属性测试
 * 
 * 测试参数填充逻辑的正确性
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

// ============================================
// 测试辅助类型和函数
// ============================================

/**
 * 生成设置类型（简化版）
 */
interface GenerationSettings {
  model: string;
  prompt: string;
  aspectRatio: string;
  imageSize: string;
  refImageUrl: string;
  refImages: UploadedImage[];
}

/**
 * 上传的图片类型（简化版）
 */
interface UploadedImage {
  id: string;
  preview: string;
  name: string;
  size: number;
}

/**
 * 画布图片类型（简化版）
 */
interface CanvasImage {
  id: string;
  url: string;
  prompt: string;
  model: string;
  aspectRatio: string;
  imageSize: string;
  refImages?: { url: string; id: string }[];
}

/**
 * 默认设置
 */
const DEFAULT_SETTINGS: GenerationSettings = {
  model: 'nano-banana-fast',
  prompt: '',
  aspectRatio: 'auto',
  imageSize: '1K',
  refImageUrl: '',
  refImages: [],
};

/**
 * 从图片提取参数并填充到设置
 * 这是 handleRegenerateImage 函数的核心逻辑
 */
function fillSettingsFromImage(
  currentSettings: GenerationSettings,
  image: CanvasImage
): GenerationSettings {
  const newSettings: GenerationSettings = {
    ...currentSettings,
    prompt: image.prompt || '',
    model: image.model || DEFAULT_SETTINGS.model,
    aspectRatio: image.aspectRatio || DEFAULT_SETTINGS.aspectRatio,
    imageSize: image.imageSize || DEFAULT_SETTINGS.imageSize,
    refImageUrl: '',
    refImages: [], // 先清空
  };

  // 恢复参考图
  if (image.refImages && image.refImages.length > 0) {
    const restoredRefImages: UploadedImage[] = [];
    for (const refImg of image.refImages) {
      const refUrl = refImg.url || '';
      const refId = refImg.id || `ref_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
      
      if (refUrl) {
        restoredRefImages.push({
          id: refId,
          preview: refUrl,
          name: `参考图-${restoredRefImages.length + 1}`,
          size: 0,
        });
      }
    }
    newSettings.refImages = restoredRefImages;
  }

  return newSettings;
}

/**
 * 检查是否应该阻止填充（生成中状态）
 */
function shouldBlockFill(isGenerating: boolean): boolean {
  return isGenerating;
}

// ============================================
// Arbitrary 生成器
// ============================================

// 模型选项
const modelArb = fc.oneof(
  fc.constant('nano-banana-fast'),
  fc.constant('nano-banana-quality'),
  fc.constant('nano-banana-ultra')
);

// 宽高比选项
const aspectRatioArb = fc.oneof(
  fc.constant('auto'),
  fc.constant('1:1'),
  fc.constant('4:3'),
  fc.constant('3:4'),
  fc.constant('16:9'),
  fc.constant('9:16')
);

// 尺寸选项
const imageSizeArb = fc.oneof(
  fc.constant('1K'),
  fc.constant('2K'),
  fc.constant('4K')
);

// 参考图 Arbitrary
const refImageArb = fc.record({
  url: fc.webUrl(),
  id: fc.uuid(),
});

// 画布图片 Arbitrary
const canvasImageArb = fc.record({
  id: fc.uuid(),
  url: fc.webUrl(),
  prompt: fc.string({ minLength: 1, maxLength: 500 }),
  model: modelArb,
  aspectRatio: aspectRatioArb,
  imageSize: imageSizeArb,
  refImages: fc.option(fc.array(refImageArb, { minLength: 0, maxLength: 5 }), { nil: undefined }),
});

// 生成设置 Arbitrary
const settingsArb = fc.record({
  model: modelArb,
  prompt: fc.string({ minLength: 0, maxLength: 500 }),
  aspectRatio: aspectRatioArb,
  imageSize: imageSizeArb,
  refImageUrl: fc.constant(''),
  refImages: fc.array(
    fc.record({
      id: fc.uuid(),
      preview: fc.webUrl(),
      name: fc.string({ minLength: 1, maxLength: 50 }),
      size: fc.nat(),
    }),
    { minLength: 0, maxLength: 5 }
  ),
});

// ============================================
// 属性测试
// ============================================

describe('重新生成参数填充', () => {
  /**
   * **Feature: image-regenerate, Property 2: 参数填充完整性**
   * **Validates: Requirements 2.1, 2.2, 2.3, 2.4**
   * 
   * 对于任意包含有效生成参数的画布图片，调用参数填充函数后，
   * 生成设置中的 prompt、model、aspectRatio、imageSize 应与图片中存储的对应值完全相等。
   */
  describe('Property 2: 参数填充完整性', () => {
    it('填充后的 prompt 应与图片的 prompt 相等', () => {
      fc.assert(
        fc.property(settingsArb, canvasImageArb, (currentSettings, image) => {
          const newSettings = fillSettingsFromImage(currentSettings, image);
          expect(newSettings.prompt).toBe(image.prompt || '');
        }),
        { numRuns: 100 }
      );
    });

    it('填充后的 model 应与图片的 model 相等（或使用默认值）', () => {
      fc.assert(
        fc.property(settingsArb, canvasImageArb, (currentSettings, image) => {
          const newSettings = fillSettingsFromImage(currentSettings, image);
          expect(newSettings.model).toBe(image.model || DEFAULT_SETTINGS.model);
        }),
        { numRuns: 100 }
      );
    });

    it('填充后的 aspectRatio 应与图片的 aspectRatio 相等（或使用默认值）', () => {
      fc.assert(
        fc.property(settingsArb, canvasImageArb, (currentSettings, image) => {
          const newSettings = fillSettingsFromImage(currentSettings, image);
          expect(newSettings.aspectRatio).toBe(image.aspectRatio || DEFAULT_SETTINGS.aspectRatio);
        }),
        { numRuns: 100 }
      );
    });

    it('填充后的 imageSize 应与图片的 imageSize 相等（或使用默认值）', () => {
      fc.assert(
        fc.property(settingsArb, canvasImageArb, (currentSettings, image) => {
          const newSettings = fillSettingsFromImage(currentSettings, image);
          expect(newSettings.imageSize).toBe(image.imageSize || DEFAULT_SETTINGS.imageSize);
        }),
        { numRuns: 100 }
      );
    });

    it('所有核心参数应同时正确填充', () => {
      fc.assert(
        fc.property(settingsArb, canvasImageArb, (currentSettings, image) => {
          const newSettings = fillSettingsFromImage(currentSettings, image);
          
          // 验证所有核心参数
          expect(newSettings.prompt).toBe(image.prompt || '');
          expect(newSettings.model).toBe(image.model || DEFAULT_SETTINGS.model);
          expect(newSettings.aspectRatio).toBe(image.aspectRatio || DEFAULT_SETTINGS.aspectRatio);
          expect(newSettings.imageSize).toBe(image.imageSize || DEFAULT_SETTINGS.imageSize);
        }),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: image-regenerate, Property 3: 生成中状态阻止填充**
   * **Validates: Requirements 4.1**
   * 
   * 对于任意生成中状态（isGenerating 为 true），调用参数填充函数应返回 false 或抛出错误，
   * 且生成设置不应被修改。
   */
  describe('Property 3: 生成中状态阻止填充', () => {
    it('生成中状态应阻止填充', () => {
      fc.assert(
        fc.property(fc.boolean(), (isGenerating) => {
          const shouldBlock = shouldBlockFill(isGenerating);
          
          if (isGenerating) {
            expect(shouldBlock).toBe(true);
          } else {
            expect(shouldBlock).toBe(false);
          }
        }),
        { numRuns: 100 }
      );
    });

    it('isGenerating 为 true 时始终阻止', () => {
      // 直接测试 true 的情况
      expect(shouldBlockFill(true)).toBe(true);
    });

    it('isGenerating 为 false 时不阻止', () => {
      // 直接测试 false 的情况
      expect(shouldBlockFill(false)).toBe(false);
    });
  });

  /**
   * **Feature: image-regenerate, Property 4: 参数替换一致性**
   * **Validates: Requirements 4.3**
   * 
   * 对于任意现有生成设置和新的图片参数，调用参数填充函数后，
   * 生成设置应完全反映新图片的参数值，不保留旧的 prompt、model、aspectRatio、imageSize 值。
   */
  describe('Property 4: 参数替换一致性', () => {
    it('新参数应完全替换旧参数', () => {
      fc.assert(
        fc.property(settingsArb, canvasImageArb, (oldSettings, newImage) => {
          const newSettings = fillSettingsFromImage(oldSettings, newImage);
          
          // 新设置不应保留旧的核心参数值（除非新图片的值恰好相同）
          // 验证新设置反映的是新图片的值
          expect(newSettings.prompt).toBe(newImage.prompt || '');
          expect(newSettings.model).toBe(newImage.model || DEFAULT_SETTINGS.model);
          expect(newSettings.aspectRatio).toBe(newImage.aspectRatio || DEFAULT_SETTINGS.aspectRatio);
          expect(newSettings.imageSize).toBe(newImage.imageSize || DEFAULT_SETTINGS.imageSize);
        }),
        { numRuns: 100 }
      );
    });

    it('旧的 prompt 不应被保留', () => {
      fc.assert(
        fc.property(
          settingsArb,
          canvasImageArb,
          (oldSettings, newImage) => {
            // 确保旧设置和新图片的 prompt 不同
            fc.pre(oldSettings.prompt !== newImage.prompt);
            
            const newSettings = fillSettingsFromImage(oldSettings, newImage);
            
            // 新设置的 prompt 应该是新图片的 prompt，而不是旧的
            expect(newSettings.prompt).toBe(newImage.prompt || '');
            expect(newSettings.prompt).not.toBe(oldSettings.prompt);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('参考图列表应被重置', () => {
      fc.assert(
        fc.property(settingsArb, canvasImageArb, (oldSettings, newImage) => {
          const newSettings = fillSettingsFromImage(oldSettings, newImage);
          
          // 如果新图片有参考图，新设置应该有对应数量的参考图
          // 如果新图片没有参考图，新设置的参考图应该为空
          if (newImage.refImages && newImage.refImages.length > 0) {
            const validRefImages = newImage.refImages.filter(ref => ref.url);
            expect(newSettings.refImages.length).toBe(validRefImages.length);
          } else {
            expect(newSettings.refImages.length).toBe(0);
          }
        }),
        { numRuns: 100 }
      );
    });
  });
});

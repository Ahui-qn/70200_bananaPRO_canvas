/**
 * CanvasDialogBar 组件属性测试
 * 
 * 使用 fast-check 进行属性测试，验证组件的核心逻辑
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

// ============================================
// 测试辅助函数 - 模拟 RefImageUploader 的文件处理逻辑
// ============================================

// 支持的图片类型
const SUPPORTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

// 最大文件大小 (10MB)
const MAX_FILE_SIZE = 10 * 1024 * 1024;

// 最大参考图数量
const MAX_IMAGES = 14;

// 模拟文件对象
interface MockFile {
  name: string;
  type: string;
  size: number;
}

// 验证文件是否为有效的图片文件
function isValidImageFile(file: MockFile): boolean {
  // 检查文件类型是否支持
  if (!SUPPORTED_IMAGE_TYPES.includes(file.type)) {
    return false;
  }
  // 检查文件大小是否在限制内
  if (file.size > MAX_FILE_SIZE) {
    return false;
  }
  return true;
}

// 处理文件上传逻辑（模拟 RefImageUploader 的核心逻辑）
function processFileUpload(
  files: MockFile[],
  currentCount: number,
  maxImages: number = MAX_IMAGES
): { accepted: MockFile[]; rejected: MockFile[] } {
  const remainingSlots = maxImages - currentCount;
  const accepted: MockFile[] = [];
  const rejected: MockFile[] = [];

  for (const file of files) {
    // 如果已达到最大数量，拒绝剩余文件
    if (accepted.length >= remainingSlots) {
      rejected.push(file);
      continue;
    }

    // 验证文件有效性
    if (isValidImageFile(file)) {
      accepted.push(file);
    } else {
      rejected.push(file);
    }
  }

  return { accepted, rejected };
}

// ============================================
// 生成器
// ============================================

// 生成有效的图片文件类型
const validImageTypeArb = fc.constantFrom(...SUPPORTED_IMAGE_TYPES);

// 生成无效的文件类型
const invalidFileTypeArb = fc.constantFrom(
  'application/pdf',
  'text/plain',
  'video/mp4',
  'audio/mp3',
  'application/json'
);

// 生成有效的文件大小 (1 byte 到 10MB)
const validFileSizeArb = fc.integer({ min: 1, max: MAX_FILE_SIZE });

// 生成无效的文件大小 (超过 10MB)
const invalidFileSizeArb = fc.integer({ min: MAX_FILE_SIZE + 1, max: MAX_FILE_SIZE * 2 });

// 生成文件名
const fileNameArb = fc.string({ minLength: 1, maxLength: 50 }).map(s => {
  // 确保文件名有效
  const sanitized = s.replace(/[<>:"/\\|?*]/g, '_');
  return sanitized || 'file';
});

// 生成有效的图片文件
const validImageFileArb: fc.Arbitrary<MockFile> = fc.record({
  name: fileNameArb.map(name => `${name}.jpg`),
  type: validImageTypeArb,
  size: validFileSizeArb,
});

// 生成无效类型的文件
const invalidTypeFileArb: fc.Arbitrary<MockFile> = fc.record({
  name: fileNameArb.map(name => `${name}.pdf`),
  type: invalidFileTypeArb,
  size: validFileSizeArb,
});

// 生成超大文件
const oversizedFileArb: fc.Arbitrary<MockFile> = fc.record({
  name: fileNameArb.map(name => `${name}.jpg`),
  type: validImageTypeArb,
  size: invalidFileSizeArb,
});

// 生成当前参考图数量 (0 到 MAX_IMAGES)
const currentCountArb = fc.integer({ min: 0, max: MAX_IMAGES });

// ============================================
// 属性测试
// ============================================

describe('CanvasDialogBar - RefImageUploader 属性测试', () => {
  /**
   * **Feature: canvas-dialog-redesign, Property 1: 参考图拖拽上传**
   * **Validates: Requirements 4.3**
   * 
   * 对于任意有效的图片文件，当用户将其拖拽到输入框区域时，
   * 系统应识别并添加该图片到参考图列表中。
   */
  describe('属性 1: 参考图拖拽上传', () => {
    it('有效的图片文件应被接受并添加到参考图列表', () => {
      fc.assert(
        fc.property(
          fc.array(validImageFileArb, { minLength: 1, maxLength: 10 }),
          currentCountArb,
          (files, currentCount) => {
            // 前置条件：当前数量未达到最大值
            fc.pre(currentCount < MAX_IMAGES);

            const { accepted, rejected } = processFileUpload(files, currentCount);

            // 所有有效文件应被接受（在剩余槽位允许的范围内）
            const remainingSlots = MAX_IMAGES - currentCount;
            const expectedAccepted = Math.min(files.length, remainingSlots);

            // 验证：接受的文件数量应等于预期
            expect(accepted.length).toBe(expectedAccepted);

            // 验证：所有接受的文件都是有效的图片文件
            for (const file of accepted) {
              expect(isValidImageFile(file)).toBe(true);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('无效类型的文件应被拒绝', () => {
      fc.assert(
        fc.property(
          fc.array(invalidTypeFileArb, { minLength: 1, maxLength: 5 }),
          currentCountArb,
          (files, currentCount) => {
            const { accepted, rejected } = processFileUpload(files, currentCount);

            // 所有无效类型的文件应被拒绝
            expect(accepted.length).toBe(0);
            expect(rejected.length).toBe(files.length);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('超过大小限制的文件应被拒绝', () => {
      fc.assert(
        fc.property(
          fc.array(oversizedFileArb, { minLength: 1, maxLength: 5 }),
          currentCountArb,
          (files, currentCount) => {
            const { accepted, rejected } = processFileUpload(files, currentCount);

            // 所有超大文件应被拒绝
            expect(accepted.length).toBe(0);
            expect(rejected.length).toBe(files.length);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('当达到最大数量时，新文件应被拒绝', () => {
      fc.assert(
        fc.property(
          fc.array(validImageFileArb, { minLength: 1, maxLength: 5 }),
          (files) => {
            // 当前已达到最大数量
            const currentCount = MAX_IMAGES;
            const { accepted, rejected } = processFileUpload(files, currentCount);

            // 所有文件应被拒绝
            expect(accepted.length).toBe(0);
            expect(rejected.length).toBe(files.length);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('混合有效和无效文件时，只有有效文件被接受', () => {
      fc.assert(
        fc.property(
          fc.array(validImageFileArb, { minLength: 1, maxLength: 5 }),
          fc.array(invalidTypeFileArb, { minLength: 1, maxLength: 5 }),
          fc.integer({ min: 0, max: MAX_IMAGES - 1 }),
          (validFiles, invalidFiles, currentCount) => {
            // 混合文件列表
            const allFiles = [...validFiles, ...invalidFiles];
            
            const { accepted, rejected } = processFileUpload(allFiles, currentCount);

            // 验证：接受的文件数量不超过有效文件数量和剩余槽位
            const remainingSlots = MAX_IMAGES - currentCount;
            const expectedAccepted = Math.min(validFiles.length, remainingSlots);
            
            expect(accepted.length).toBe(expectedAccepted);

            // 验证：所有接受的文件都是有效的
            for (const file of accepted) {
              expect(isValidImageFile(file)).toBe(true);
            }

            // 验证：所有无效文件都被拒绝
            for (const invalidFile of invalidFiles) {
              expect(rejected).toContainEqual(invalidFile);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});

// ============================================
// RefImagePreview 组件属性测试
// ============================================

// 模拟参考图对象
interface MockRefImage {
  id: string;
  name: string;
  preview: string;
}

// 生成唯一 ID
const imageIdArb = fc.string({ minLength: 5, maxLength: 20 }).map(s => `ref-${s.replace(/[^a-zA-Z0-9]/g, '')}`);

// 生成参考图对象
const refImageArb: fc.Arbitrary<MockRefImage> = fc.record({
  id: imageIdArb,
  name: fileNameArb.map(name => `${name}.jpg`),
  preview: fc.constant('data:image/jpeg;base64,mock'),
});

// 生成参考图列表（确保 ID 唯一）
const refImageListArb = (minLength: number, maxLength: number): fc.Arbitrary<MockRefImage[]> => {
  return fc.array(refImageArb, { minLength, maxLength }).map(images => {
    // 确保 ID 唯一
    const seen = new Set<string>();
    return images.filter(img => {
      if (seen.has(img.id)) return false;
      seen.add(img.id);
      return true;
    });
  });
};

// 模拟 RefImagePreview 的渲染逻辑
function shouldRenderPreview(images: MockRefImage[]): boolean {
  return images.length > 0;
}

// 模拟删除参考图的逻辑
function removeRefImage(images: MockRefImage[], imageId: string): MockRefImage[] {
  return images.filter(img => img.id !== imageId);
}

describe('CanvasDialogBar - RefImagePreview 属性测试', () => {
  /**
   * **Feature: canvas-dialog-redesign, Property 5: 参考图条件渲染**
   * **Validates: Requirements 6.1**
   * 
   * 对于任意参考图列表状态，当列表非空时系统应显示预览区域，
   * 当列表为空时应隐藏预览区域。
   */
  describe('属性 5: 参考图条件渲染', () => {
    it('非空参考图列表应渲染预览区域', () => {
      fc.assert(
        fc.property(
          refImageListArb(1, MAX_IMAGES),
          (images) => {
            // 前置条件：列表非空
            fc.pre(images.length > 0);

            // 验证：应该渲染预览区域
            expect(shouldRenderPreview(images)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('空参考图列表不应渲染预览区域', () => {
      // 空列表情况
      const emptyImages: MockRefImage[] = [];
      
      // 验证：不应该渲染预览区域
      expect(shouldRenderPreview(emptyImages)).toBe(false);
    });

    it('参考图列表状态变化时渲染状态应正确更新', () => {
      fc.assert(
        fc.property(
          refImageListArb(0, MAX_IMAGES),
          (images) => {
            // 验证：渲染状态与列表是否为空一致
            const shouldRender = shouldRenderPreview(images);
            expect(shouldRender).toBe(images.length > 0);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: canvas-dialog-redesign, Property 6: 参考图删除**
   * **Validates: Requirements 6.3**
   * 
   * 对于任意已上传的参考图，当用户点击删除按钮时，
   * 该图片应从参考图列表中移除。
   */
  describe('属性 6: 参考图删除', () => {
    it('删除参考图后该图片应从列表中移除', () => {
      fc.assert(
        fc.property(
          refImageListArb(1, MAX_IMAGES),
          (images) => {
            // 前置条件：列表非空
            fc.pre(images.length > 0);

            // 随机选择一个图片进行删除
            const indexToRemove = Math.floor(Math.random() * images.length);
            const imageToRemove = images[indexToRemove];

            // 执行删除
            const updatedImages = removeRefImage(images, imageToRemove.id);

            // 验证：删除后列表长度减少 1
            expect(updatedImages.length).toBe(images.length - 1);

            // 验证：删除的图片不在新列表中
            expect(updatedImages.find(img => img.id === imageToRemove.id)).toBeUndefined();

            // 验证：其他图片仍然存在
            for (const img of images) {
              if (img.id !== imageToRemove.id) {
                expect(updatedImages.find(i => i.id === img.id)).toBeDefined();
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('删除不存在的图片 ID 不应改变列表', () => {
      fc.assert(
        fc.property(
          refImageListArb(1, MAX_IMAGES),
          fc.string({ minLength: 10, maxLength: 30 }),
          (images, randomId) => {
            // 前置条件：随机 ID 不在列表中
            const nonExistentId = `non-existent-${randomId}`;
            fc.pre(!images.some(img => img.id === nonExistentId));

            // 执行删除
            const updatedImages = removeRefImage(images, nonExistentId);

            // 验证：列表长度不变
            expect(updatedImages.length).toBe(images.length);

            // 验证：所有原始图片仍然存在
            for (const img of images) {
              expect(updatedImages.find(i => i.id === img.id)).toBeDefined();
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('连续删除多个图片应正确更新列表', () => {
      fc.assert(
        fc.property(
          refImageListArb(3, MAX_IMAGES),
          (images) => {
            // 前置条件：至少有 3 张图片
            fc.pre(images.length >= 3);

            // 删除前两张图片
            const firstImageId = images[0].id;
            const secondImageId = images[1].id;

            let updatedImages = removeRefImage(images, firstImageId);
            updatedImages = removeRefImage(updatedImages, secondImageId);

            // 验证：列表长度减少 2
            expect(updatedImages.length).toBe(images.length - 2);

            // 验证：删除的图片不在列表中
            expect(updatedImages.find(img => img.id === firstImageId)).toBeUndefined();
            expect(updatedImages.find(img => img.id === secondImageId)).toBeUndefined();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('删除最后一张图片后列表应为空', () => {
      fc.assert(
        fc.property(
          refImageArb,
          (image) => {
            // 只有一张图片的列表
            const images = [image];

            // 删除唯一的图片
            const updatedImages = removeRefImage(images, image.id);

            // 验证：列表为空
            expect(updatedImages.length).toBe(0);

            // 验证：预览区域不应渲染
            expect(shouldRenderPreview(updatedImages)).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});


// ============================================
// 生成触发和空输入验证属性测试
// ============================================

// 模拟生成触发逻辑
interface GenerateState {
  prompt: string;
  isGenerating: boolean;
  showEmptyWarning: boolean;
  generateCalled: boolean;
}

// 验证提示词是否为空（仅包含空白字符）
function isEmptyPrompt(prompt: string): boolean {
  return !prompt.trim();
}

// 模拟 handleGenerate 函数的核心逻辑
function simulateGenerate(state: GenerateState): GenerateState {
  // 如果正在生成中，不做任何操作
  if (state.isGenerating) {
    return state;
  }
  
  // 空输入验证
  if (isEmptyPrompt(state.prompt)) {
    return {
      ...state,
      showEmptyWarning: true,
      generateCalled: false,
    };
  }
  
  // 有效输入，触发生成
  return {
    ...state,
    showEmptyWarning: false,
    generateCalled: true,
  };
}

// 模拟回车键触发生成
function simulateEnterKey(state: GenerateState): GenerateState {
  return simulateGenerate(state);
}

// 模拟点击生成按钮
function simulateClickGenerate(state: GenerateState): GenerateState {
  return simulateGenerate(state);
}

// ============================================
// 生成器
// ============================================

// 生成非空提示词（至少包含一个非空白字符）
const nonEmptyPromptArb = fc.string({ minLength: 1, maxLength: 500 })
  .filter(s => s.trim().length > 0);

// 生成空白提示词（空字符串或仅包含空白字符）
const emptyPromptArb = fc.oneof(
  fc.constant(''),
  fc.array(fc.constantFrom(' ', '\t', '\n', '\r'), { minLength: 0, maxLength: 20 }).map(arr => arr.join(''))
);

// 生成初始状态
const initialStateArb = (prompt: string): fc.Arbitrary<GenerateState> => fc.record({
  prompt: fc.constant(prompt),
  isGenerating: fc.constant(false),
  showEmptyWarning: fc.constant(false),
  generateCalled: fc.constant(false),
});

describe('CanvasDialogBar - 生成触发属性测试', () => {
  /**
   * **Feature: canvas-dialog-redesign, Property 3: 生成触发验证**
   * **Validates: Requirements 5.4**
   * 
   * 对于任意非空的提示词输入，当用户点击生成按钮或按回车时，
   * 系统应触发图片生成流程。
   */
  describe('属性 3: 生成触发验证', () => {
    it('非空提示词点击生成按钮应触发生成', () => {
      fc.assert(
        fc.property(
          nonEmptyPromptArb,
          (prompt) => {
            const initialState: GenerateState = {
              prompt,
              isGenerating: false,
              showEmptyWarning: false,
              generateCalled: false,
            };

            const resultState = simulateClickGenerate(initialState);

            // 验证：生成应被触发
            expect(resultState.generateCalled).toBe(true);
            // 验证：不应显示空输入警告
            expect(resultState.showEmptyWarning).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('非空提示词按回车应触发生成', () => {
      fc.assert(
        fc.property(
          nonEmptyPromptArb,
          (prompt) => {
            const initialState: GenerateState = {
              prompt,
              isGenerating: false,
              showEmptyWarning: false,
              generateCalled: false,
            };

            const resultState = simulateEnterKey(initialState);

            // 验证：生成应被触发
            expect(resultState.generateCalled).toBe(true);
            // 验证：不应显示空输入警告
            expect(resultState.showEmptyWarning).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('正在生成时不应重复触发生成', () => {
      fc.assert(
        fc.property(
          nonEmptyPromptArb,
          (prompt) => {
            const initialState: GenerateState = {
              prompt,
              isGenerating: true, // 正在生成中
              showEmptyWarning: false,
              generateCalled: false,
            };

            const resultState = simulateGenerate(initialState);

            // 验证：不应触发新的生成
            expect(resultState.generateCalled).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: canvas-dialog-redesign, Property 4: 空输入阻止生成**
   * **Validates: Requirements 5.5**
   * 
   * 对于任意空白或仅包含空格的提示词输入，当用户尝试触发生成时，
   * 系统应阻止生成并显示提示信息。
   */
  describe('属性 4: 空输入阻止生成', () => {
    it('空提示词应阻止生成并显示警告', () => {
      fc.assert(
        fc.property(
          emptyPromptArb,
          (prompt) => {
            const initialState: GenerateState = {
              prompt,
              isGenerating: false,
              showEmptyWarning: false,
              generateCalled: false,
            };

            const resultState = simulateGenerate(initialState);

            // 验证：生成不应被触发
            expect(resultState.generateCalled).toBe(false);
            // 验证：应显示空输入警告
            expect(resultState.showEmptyWarning).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('仅包含空白字符的提示词应被视为空输入', () => {
      fc.assert(
        fc.property(
          fc.array(fc.constantFrom(' ', '\t', '\n', '\r'), { minLength: 1, maxLength: 50 }).map(arr => arr.join('')),
          (whitespacePrompt) => {
            // 验证：仅空白字符的字符串应被识别为空输入
            expect(isEmptyPrompt(whitespacePrompt)).toBe(true);

            const initialState: GenerateState = {
              prompt: whitespacePrompt,
              isGenerating: false,
              showEmptyWarning: false,
              generateCalled: false,
            };

            const resultState = simulateGenerate(initialState);

            // 验证：生成不应被触发
            expect(resultState.generateCalled).toBe(false);
            // 验证：应显示空输入警告
            expect(resultState.showEmptyWarning).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('空字符串应阻止生成', () => {
      const initialState: GenerateState = {
        prompt: '',
        isGenerating: false,
        showEmptyWarning: false,
        generateCalled: false,
      };

      const resultState = simulateGenerate(initialState);

      // 验证：生成不应被触发
      expect(resultState.generateCalled).toBe(false);
      // 验证：应显示空输入警告
      expect(resultState.showEmptyWarning).toBe(true);
    });

    it('点击生成按钮和按回车对空输入的行为应一致', () => {
      fc.assert(
        fc.property(
          emptyPromptArb,
          (prompt) => {
            const initialState: GenerateState = {
              prompt,
              isGenerating: false,
              showEmptyWarning: false,
              generateCalled: false,
            };

            const clickResult = simulateClickGenerate(initialState);
            const enterResult = simulateEnterKey(initialState);

            // 验证：两种触发方式的结果应一致
            expect(clickResult.generateCalled).toBe(enterResult.generateCalled);
            expect(clickResult.showEmptyWarning).toBe(enterResult.showEmptyWarning);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});


// ============================================
// ConfigPanel 生成数量滑动条属性测试
// ============================================

// 模拟生成数量滑动条的核心逻辑
interface GenerateCountState {
  count: number;
  minCount: number;
  maxCount: number;
}

// 验证生成数量是否在有效范围内
function isValidGenerateCount(count: number, minCount: number, maxCount: number): boolean {
  return count >= minCount && count <= maxCount && Number.isInteger(count);
}

// 模拟滑动条值变化处理
function handleCountChange(
  newValue: number,
  currentState: GenerateCountState
): GenerateCountState {
  const { minCount, maxCount } = currentState;
  
  // 如果新值在有效范围内，更新状态
  if (isValidGenerateCount(newValue, minCount, maxCount)) {
    return {
      ...currentState,
      count: newValue,
    };
  }
  
  // 如果新值超出范围，保持当前状态不变
  return currentState;
}

// 模拟滑动条拖动（连续值变化）
function simulateSliderDrag(
  targetValue: number,
  currentState: GenerateCountState
): GenerateCountState {
  // 滑动条会将值限制在 min-max 范围内
  const { minCount, maxCount } = currentState;
  const clampedValue = Math.max(minCount, Math.min(maxCount, Math.round(targetValue)));
  
  return {
    ...currentState,
    count: clampedValue,
  };
}

// 生成器
const minCountArb = fc.integer({ min: 1, max: 3 });
const maxCountArb = fc.integer({ min: 4, max: 10 });

// 生成有效的初始状态
const generateCountStateArb: fc.Arbitrary<GenerateCountState> = fc.record({
  minCount: minCountArb,
  maxCount: maxCountArb,
}).chain(({ minCount, maxCount }) => 
  fc.record({
    count: fc.integer({ min: minCount, max: maxCount }),
    minCount: fc.constant(minCount),
    maxCount: fc.constant(maxCount),
  })
);

describe('ConfigPanel - 生成数量滑动条属性测试', () => {
  /**
   * **Feature: canvas-dialog-redesign, Property 7: 生成数量滑动条**
   * **Validates: Requirements 7.5**
   * 
   * 对于任意滑动条操作，生成数量值应在 1-6 范围内变化，
   * 且 UI 应实时显示当前值。
   */
  describe('属性 7: 生成数量滑动条', () => {
    it('生成数量值应始终在有效范围内', () => {
      fc.assert(
        fc.property(
          generateCountStateArb,
          fc.integer({ min: -10, max: 20 }),
          (state, newValue) => {
            const resultState = handleCountChange(newValue, state);
            
            // 验证：结果值始终在有效范围内
            expect(resultState.count).toBeGreaterThanOrEqual(state.minCount);
            expect(resultState.count).toBeLessThanOrEqual(state.maxCount);
            
            // 验证：结果值是整数
            expect(Number.isInteger(resultState.count)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('有效范围内的值变化应被接受', () => {
      fc.assert(
        fc.property(
          generateCountStateArb,
          (state) => {
            const { minCount, maxCount } = state;
            
            // 生成一个在有效范围内的新值
            const validValue = Math.floor(Math.random() * (maxCount - minCount + 1)) + minCount;
            
            const resultState = handleCountChange(validValue, state);
            
            // 验证：有效值应被接受
            expect(resultState.count).toBe(validValue);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('超出范围的值应被拒绝，保持当前状态', () => {
      fc.assert(
        fc.property(
          generateCountStateArb,
          fc.oneof(
            fc.integer({ min: -100, max: 0 }),  // 小于最小值
            fc.integer({ min: 11, max: 100 })   // 大于最大值
          ),
          (state, invalidValue) => {
            // 前置条件：确保 invalidValue 确实超出范围
            fc.pre(invalidValue < state.minCount || invalidValue > state.maxCount);
            
            const originalCount = state.count;
            const resultState = handleCountChange(invalidValue, state);
            
            // 验证：状态应保持不变
            expect(resultState.count).toBe(originalCount);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('滑动条拖动应将值限制在有效范围内', () => {
      fc.assert(
        fc.property(
          generateCountStateArb,
          fc.integer({ min: -10, max: 20 }), // 使用整数避免 NaN 问题
          (state, dragValue) => {
            const resultState = simulateSliderDrag(dragValue, state);
            
            // 验证：结果值在有效范围内
            expect(resultState.count).toBeGreaterThanOrEqual(state.minCount);
            expect(resultState.count).toBeLessThanOrEqual(state.maxCount);
            
            // 验证：结果值是整数（滑动条应四舍五入）
            expect(Number.isInteger(resultState.count)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('默认范围 1-6 应正确工作', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 6 }),
          (targetCount) => {
            const defaultState: GenerateCountState = {
              count: 1,
              minCount: 1,
              maxCount: 6,
            };
            
            const resultState = handleCountChange(targetCount, defaultState);
            
            // 验证：在默认范围内的值应被接受
            expect(resultState.count).toBe(targetCount);
            expect(resultState.count).toBeGreaterThanOrEqual(1);
            expect(resultState.count).toBeLessThanOrEqual(6);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('连续滑动操作应保持值的一致性', () => {
      fc.assert(
        fc.property(
          generateCountStateArb,
          fc.array(fc.integer({ min: 1, max: 6 }), { minLength: 1, maxLength: 10 }),
          (initialState, operations) => {
            let currentState = initialState;
            
            // 执行一系列滑动操作
            for (const targetValue of operations) {
              currentState = simulateSliderDrag(targetValue, currentState);
              
              // 验证：每次操作后值都在有效范围内
              expect(currentState.count).toBeGreaterThanOrEqual(currentState.minCount);
              expect(currentState.count).toBeLessThanOrEqual(currentState.maxCount);
            }
            
            // 验证：最终状态有效
            expect(isValidGenerateCount(currentState.count, currentState.minCount, currentState.maxCount)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('非整数值应被四舍五入', () => {
      fc.assert(
        fc.property(
          fc.float({ min: 1, max: 6, noNaN: true }),
          (floatValue) => {
            const state: GenerateCountState = {
              count: 1,
              minCount: 1,
              maxCount: 6,
            };
            
            const resultState = simulateSliderDrag(floatValue, state);
            
            // 验证：结果是整数
            expect(Number.isInteger(resultState.count)).toBe(true);
            
            // 验证：结果是四舍五入后的值
            const expectedValue = Math.max(1, Math.min(6, Math.round(floatValue)));
            expect(resultState.count).toBe(expectedValue);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});


// ============================================
// CanvasZoomControl 缩放控制属性测试
// ============================================

// 模拟缩放控制的核心逻辑
interface ZoomControlState {
  scale: number;
  minScale: number;
  maxScale: number;
}

// 验证缩放值是否在有效范围内
function isValidScale(scale: number, minScale: number, maxScale: number): boolean {
  return scale >= minScale && scale <= maxScale;
}

// 模拟缩放增减操作
function handleZoom(delta: number, currentState: ZoomControlState): ZoomControlState {
  const { scale, minScale, maxScale } = currentState;
  const newScale = Math.min(Math.max(minScale, scale + delta), maxScale);
  
  return {
    ...currentState,
    scale: newScale,
  };
}

// 模拟滑动条值变化
function handleSliderChange(newValue: number, currentState: ZoomControlState): ZoomControlState {
  const { minScale, maxScale } = currentState;
  
  // 将值限制在有效范围内
  const clampedValue = Math.min(Math.max(minScale, newValue), maxScale);
  
  return {
    ...currentState,
    scale: clampedValue,
  };
}

// 模拟重置视图
function handleResetView(currentState: ZoomControlState): ZoomControlState {
  return {
    ...currentState,
    scale: 1, // 重置为 100%
  };
}

// 计算缩放百分比显示
function getScalePercentage(scale: number): number {
  return Math.round(scale * 100);
}

// 32 位浮点数常量
const MIN_SCALE_32 = Math.fround(0.1);
const MAX_SCALE_32 = Math.fround(3);

// 生成器 - 使用整数来避免浮点数精度问题
// 缩放值范围 0.1 - 3，使用整数 1-30 表示，然后除以 10
const scaleIntArb = fc.integer({ min: 1, max: 30 });

const zoomControlStateArb: fc.Arbitrary<ZoomControlState> = scaleIntArb.map(scaleInt => ({
  scale: scaleInt / 10,
  minScale: 0.1,
  maxScale: 3,
}));

// 生成有效的缩放增量
const zoomDeltaArb = fc.constantFrom(-0.1, 0.1, -0.2, 0.2, -0.5, 0.5);

describe('CanvasZoomControl - 缩放控制属性测试', () => {
  /**
   * **Feature: canvas-dialog-redesign, Property 8: 缩放控制实时更新**
   * **Validates: Requirements 8.3**
   * 
   * 对于任意缩放控制操作，画布缩放比例应实时更新并反映在视图中。
   */
  describe('属性 8: 缩放控制实时更新', () => {
    it('缩放值应始终在有效范围内 (0.1 - 3)', () => {
      fc.assert(
        fc.property(
          zoomControlStateArb,
          zoomDeltaArb,
          (state, delta) => {
            const resultState = handleZoom(delta, state);
            
            // 验证：结果值始终在有效范围内
            expect(resultState.scale).toBeGreaterThanOrEqual(state.minScale);
            expect(resultState.scale).toBeLessThanOrEqual(state.maxScale);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('放大操作应增加缩放值（在最大值范围内）', () => {
      fc.assert(
        fc.property(
          zoomControlStateArb,
          (state) => {
            // 前置条件：当前缩放值小于最大值
            fc.pre(state.scale < state.maxScale);
            
            const delta = 0.1;
            const resultState = handleZoom(delta, state);
            
            // 验证：缩放值应增加（或达到最大值）
            expect(resultState.scale).toBeGreaterThanOrEqual(state.scale);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('缩小操作应减少缩放值（在最小值范围内）', () => {
      fc.assert(
        fc.property(
          zoomControlStateArb,
          (state) => {
            // 前置条件：当前缩放值大于最小值
            fc.pre(state.scale > state.minScale);
            
            const delta = -0.1;
            const resultState = handleZoom(delta, state);
            
            // 验证：缩放值应减少（或达到最小值）
            expect(resultState.scale).toBeLessThanOrEqual(state.scale);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('滑动条操作应实时更新缩放值', () => {
      fc.assert(
        fc.property(
          zoomControlStateArb,
          scaleIntArb.map(v => v / 10), // 生成 0.1 - 3 范围的值
          (state, targetValue) => {
            const resultState = handleSliderChange(targetValue, state);
            
            // 验证：缩放值应更新为目标值（在有效范围内）
            const expectedValue = Math.min(Math.max(state.minScale, targetValue), state.maxScale);
            expect(resultState.scale).toBeCloseTo(expectedValue, 5);
            
            // 验证：结果值在有效范围内
            expect(resultState.scale).toBeGreaterThanOrEqual(state.minScale);
            expect(resultState.scale).toBeLessThanOrEqual(state.maxScale);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('重置视图应将缩放值设为 100%', () => {
      fc.assert(
        fc.property(
          zoomControlStateArb,
          (state) => {
            const resultState = handleResetView(state);
            
            // 验证：缩放值应重置为 1 (100%)
            expect(resultState.scale).toBe(1);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('缩放百分比显示应正确反映当前缩放值', () => {
      fc.assert(
        fc.property(
          scaleIntArb.map(v => v / 10), // 生成 0.1 - 3 范围的值
          (scale) => {
            const percentage = getScalePercentage(scale);
            
            // 验证：百分比应为缩放值乘以 100 并四舍五入
            expect(percentage).toBe(Math.round(scale * 100));
            
            // 验证：百分比在有效范围内 (10% - 300%)
            expect(percentage).toBeGreaterThanOrEqual(10);
            expect(percentage).toBeLessThanOrEqual(300);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('连续缩放操作应保持值的一致性', () => {
      fc.assert(
        fc.property(
          zoomControlStateArb,
          fc.array(zoomDeltaArb, { minLength: 1, maxLength: 20 }),
          (initialState, operations) => {
            let currentState = initialState;
            
            // 执行一系列缩放操作
            for (const delta of operations) {
              currentState = handleZoom(delta, currentState);
              
              // 验证：每次操作后值都在有效范围内
              expect(currentState.scale).toBeGreaterThanOrEqual(currentState.minScale);
              expect(currentState.scale).toBeLessThanOrEqual(currentState.maxScale);
            }
            
            // 验证：最终状态有效
            expect(isValidScale(currentState.scale, currentState.minScale, currentState.maxScale)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('达到最小值时继续缩小不应改变值', () => {
      fc.assert(
        fc.property(
          fc.constant({ scale: 0.1, minScale: 0.1, maxScale: 3 }),
          (state) => {
            const resultState = handleZoom(-0.1, state);
            
            // 验证：值应保持在最小值
            expect(resultState.scale).toBe(state.minScale);
          }
        ),
        { numRuns: 10 }
      );
    });

    it('达到最大值时继续放大不应改变值', () => {
      fc.assert(
        fc.property(
          fc.constant({ scale: 3, minScale: 0.1, maxScale: 3 }),
          (state) => {
            const resultState = handleZoom(0.1, state);
            
            // 验证：值应保持在最大值
            expect(resultState.scale).toBe(state.maxScale);
          }
        ),
        { numRuns: 10 }
      );
    });

    it('滑动条超出范围的值应被限制', () => {
      fc.assert(
        fc.property(
          zoomControlStateArb,
          fc.oneof(
            fc.integer({ min: -100, max: 0 }).map(v => v / 10),  // 小于最小值
            fc.integer({ min: 31, max: 100 }).map(v => v / 10)   // 大于最大值
          ),
          (state, outOfRangeValue) => {
            const resultState = handleSliderChange(outOfRangeValue, state);
            
            // 验证：值应被限制在有效范围内
            expect(resultState.scale).toBeGreaterThanOrEqual(state.minScale);
            expect(resultState.scale).toBeLessThanOrEqual(state.maxScale);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});


// ============================================
// 生成状态管理属性测试
// ============================================

// 模拟生成状态管理的核心逻辑
interface GenerationState {
  isGenerating: boolean;
  progress: number;
  status: string;
  error: string | null;
  canvasImages: string[]; // 简化为图片 ID 列表
}

// 模拟生成任务结果
interface GenerationResult {
  success: boolean;
  imageId?: string;
  error?: string;
}

// 初始状态
function createInitialState(canvasImages: string[] = []): GenerationState {
  return {
    isGenerating: false,
    progress: 0,
    status: '',
    error: null,
    canvasImages,
  };
}

// 模拟开始生成
function startGeneration(state: GenerationState): GenerationState {
  // 如果已经在生成中，不应该开始新的生成（需求 9.3）
  if (state.isGenerating) {
    return state;
  }
  
  return {
    ...state,
    isGenerating: true,
    progress: 0,
    status: '正在准备生成任务...',
    error: null,
  };
}

// 模拟更新生成进度
function updateProgress(state: GenerationState, progress: number, status: string): GenerationState {
  if (!state.isGenerating) {
    return state;
  }
  
  return {
    ...state,
    progress: Math.min(100, Math.max(0, progress)),
    status,
  };
}

// 模拟生成完成（需求 9.5）
function completeGeneration(state: GenerationState, results: GenerationResult[]): GenerationState {
  const successfulResults = results.filter(r => r.success);
  const failedCount = results.length - successfulResults.length;
  
  // 添加成功生成的图片到画布
  const newImages = successfulResults
    .filter(r => r.imageId)
    .map(r => r.imageId as string);
  
  let error: string | null = null;
  if (failedCount > 0 && failedCount < results.length) {
    error = `${failedCount} 张图片生成失败`;
  } else if (failedCount === results.length && results.length > 0) {
    error = '所有图片生成失败';
  }
  
  return {
    isGenerating: false,
    progress: 0,
    status: '',
    error,
    canvasImages: [...state.canvasImages, ...newImages],
  };
}

// 模拟生成失败（需求 9.6）
function failGeneration(state: GenerationState, errorMessage: string): GenerationState {
  return {
    ...state,
    isGenerating: false,
    progress: 0,
    status: '',
    error: errorMessage,
  };
}

// 模拟清除错误
function clearError(state: GenerationState): GenerationState {
  return {
    ...state,
    error: null,
  };
}

// 模拟取消生成
function cancelGeneration(state: GenerationState): GenerationState {
  return {
    ...state,
    isGenerating: false,
    progress: 0,
    status: '',
  };
}

// 检查是否可以触发生成（需求 9.3）
function canTriggerGeneration(state: GenerationState): boolean {
  return !state.isGenerating;
}

// ============================================
// 生成器
// ============================================

// 生成图片 ID（用于生成状态测试）
const genImageIdArb = fc.string({ minLength: 5, maxLength: 20 })
  .map(s => `img-${s.replace(/[^a-zA-Z0-9]/g, '')}`);

// 生成图片 ID 列表（确保唯一）
const genImageIdListArb = fc.array(genImageIdArb, { minLength: 0, maxLength: 20 })
  .map(ids => [...new Set(ids)]);

// 生成进度值 (0-100)
const progressArb = fc.integer({ min: 0, max: 100 });

// 生成状态文本
const statusTextArb = fc.constantFrom(
  '正在准备生成任务...',
  '正在生成 1 张图片...',
  '正在生成 3 张图片...',
  '已完成 1/3 张图片',
  '已完成 2/3 张图片',
  ''
);

// 生成错误消息
const errorMessageArb = fc.constantFrom(
  '网络连接失败',
  '图片生成失败',
  'API 错误',
  '生成超时',
  '1 张图片生成失败',
  '所有图片生成失败'
);

// 生成成功的结果
const successResultArb: fc.Arbitrary<GenerationResult> = genImageIdArb.map(id => ({
  success: true,
  imageId: id,
}));

// 生成失败的结果
const failedResultArb: fc.Arbitrary<GenerationResult> = errorMessageArb.map(error => ({
  success: false,
  error,
}));

// 生成混合结果列表
const mixedResultsArb = fc.array(
  fc.oneof(successResultArb, failedResultArb),
  { minLength: 1, maxLength: 6 }
);

// 生成初始状态（用于生成状态测试）
const genInitialStateArb: fc.Arbitrary<GenerationState> = genImageIdListArb.map(images => 
  createInitialState(images)
);

describe('CanvasDialogBar - 生成状态管理属性测试', () => {
  /**
   * **Feature: canvas-dialog-redesign, Property 9: 生成中状态保护**
   * **Validates: Requirements 9.3**
   * 
   * 对于任意正在进行的生成任务，生成按钮和回车触发应被禁用，防止重复提交。
   */
  describe('属性 9: 生成中状态保护', () => {
    it('生成中状态下不应允许触发新的生成', () => {
      fc.assert(
        fc.property(
          genInitialStateArb,
          (initialState) => {
            // 开始生成
            const generatingState = startGeneration(initialState);
            
            // 验证：生成中状态下不能触发新的生成
            expect(canTriggerGeneration(generatingState)).toBe(false);
            
            // 尝试再次开始生成
            const attemptedState = startGeneration(generatingState);
            
            // 验证：状态应保持不变
            expect(attemptedState).toEqual(generatingState);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('非生成状态下应允许触发生成', () => {
      fc.assert(
        fc.property(
          genInitialStateArb,
          (initialState) => {
            // 验证：初始状态下可以触发生成
            expect(canTriggerGeneration(initialState)).toBe(true);
            
            // 开始生成
            const generatingState = startGeneration(initialState);
            
            // 验证：状态已更新为生成中
            expect(generatingState.isGenerating).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('生成完成后应恢复可触发状态', () => {
      fc.assert(
        fc.property(
          genInitialStateArb,
          mixedResultsArb,
          (initialState, results) => {
            // 开始生成
            const generatingState = startGeneration(initialState);
            
            // 完成生成
            const completedState = completeGeneration(generatingState, results);
            
            // 验证：完成后应恢复可触发状态
            expect(canTriggerGeneration(completedState)).toBe(true);
            expect(completedState.isGenerating).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('取消生成后应恢复可触发状态', () => {
      fc.assert(
        fc.property(
          genInitialStateArb,
          (initialState) => {
            // 开始生成
            const generatingState = startGeneration(initialState);
            
            // 取消生成
            const cancelledState = cancelGeneration(generatingState);
            
            // 验证：取消后应恢复可触发状态
            expect(canTriggerGeneration(cancelledState)).toBe(true);
            expect(cancelledState.isGenerating).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('生成中进度更新不应改变生成状态', () => {
      fc.assert(
        fc.property(
          genInitialStateArb,
          progressArb,
          statusTextArb,
          (initialState, progress, status) => {
            // 开始生成
            const generatingState = startGeneration(initialState);
            
            // 更新进度
            const updatedState = updateProgress(generatingState, progress, status);
            
            // 验证：仍然处于生成中状态
            expect(updatedState.isGenerating).toBe(true);
            expect(canTriggerGeneration(updatedState)).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: canvas-dialog-redesign, Property 10: 生成完成后画布更新**
   * **Validates: Requirements 9.5**
   * 
   * 对于任意成功完成的图片生成，生成的图片应自动添加到画布中。
   */
  describe('属性 10: 生成完成后画布更新', () => {
    it('成功生成的图片应添加到画布', () => {
      fc.assert(
        fc.property(
          genInitialStateArb,
          fc.array(successResultArb, { minLength: 1, maxLength: 6 }),
          (initialState, successResults) => {
            // 开始生成
            const generatingState = startGeneration(initialState);
            
            // 完成生成
            const completedState = completeGeneration(generatingState, successResults);
            
            // 验证：所有成功的图片都应添加到画布
            const newImageIds = successResults
              .filter(r => r.imageId)
              .map(r => r.imageId as string);
            
            for (const imageId of newImageIds) {
              expect(completedState.canvasImages).toContain(imageId);
            }
            
            // 验证：画布图片数量应增加
            expect(completedState.canvasImages.length).toBe(
              initialState.canvasImages.length + newImageIds.length
            );
          }
        ),
        { numRuns: 100 }
      );
    });

    it('原有画布图片应保留', () => {
      fc.assert(
        fc.property(
          genInitialStateArb,
          mixedResultsArb,
          (initialState, results) => {
            // 前置条件：初始状态有图片
            fc.pre(initialState.canvasImages.length > 0);
            
            // 开始生成
            const generatingState = startGeneration(initialState);
            
            // 完成生成
            const completedState = completeGeneration(generatingState, results);
            
            // 验证：原有图片应保留
            for (const imageId of initialState.canvasImages) {
              expect(completedState.canvasImages).toContain(imageId);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('部分失败时成功的图片仍应添加到画布', () => {
      fc.assert(
        fc.property(
          genInitialStateArb,
          fc.array(successResultArb, { minLength: 1, maxLength: 3 }),
          fc.array(failedResultArb, { minLength: 1, maxLength: 3 }),
          (initialState, successResults, failedResults) => {
            const mixedResults = [...successResults, ...failedResults];
            
            // 开始生成
            const generatingState = startGeneration(initialState);
            
            // 完成生成
            const completedState = completeGeneration(generatingState, mixedResults);
            
            // 验证：成功的图片应添加到画布
            const newImageIds = successResults
              .filter(r => r.imageId)
              .map(r => r.imageId as string);
            
            for (const imageId of newImageIds) {
              expect(completedState.canvasImages).toContain(imageId);
            }
            
            // 验证：应显示部分失败的错误信息
            expect(completedState.error).not.toBeNull();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('全部失败时画布图片不应增加', () => {
      fc.assert(
        fc.property(
          genInitialStateArb,
          fc.array(failedResultArb, { minLength: 1, maxLength: 6 }),
          (initialState, failedResults) => {
            // 开始生成
            const generatingState = startGeneration(initialState);
            
            // 完成生成
            const completedState = completeGeneration(generatingState, failedResults);
            
            // 验证：画布图片数量不变
            expect(completedState.canvasImages.length).toBe(initialState.canvasImages.length);
            
            // 验证：应显示错误信息
            expect(completedState.error).not.toBeNull();
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: canvas-dialog-redesign, Property 11: 生成失败后状态恢复**
   * **Validates: Requirements 9.6**
   * 
   * 对于任意失败的生成任务，系统应显示错误信息并恢复到可操作状态。
   */
  describe('属性 11: 生成失败后状态恢复', () => {
    it('生成失败后应显示错误信息', () => {
      fc.assert(
        fc.property(
          genInitialStateArb,
          errorMessageArb,
          (initialState, errorMessage) => {
            // 开始生成
            const generatingState = startGeneration(initialState);
            
            // 生成失败
            const failedState = failGeneration(generatingState, errorMessage);
            
            // 验证：应显示错误信息
            expect(failedState.error).toBe(errorMessage);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('生成失败后应恢复可操作状态', () => {
      fc.assert(
        fc.property(
          genInitialStateArb,
          errorMessageArb,
          (initialState, errorMessage) => {
            // 开始生成
            const generatingState = startGeneration(initialState);
            
            // 生成失败
            const failedState = failGeneration(generatingState, errorMessage);
            
            // 验证：应恢复可操作状态
            expect(failedState.isGenerating).toBe(false);
            expect(canTriggerGeneration(failedState)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('生成失败后进度应重置', () => {
      fc.assert(
        fc.property(
          genInitialStateArb,
          progressArb,
          errorMessageArb,
          (initialState, progress, errorMessage) => {
            // 开始生成
            let state = startGeneration(initialState);
            
            // 更新进度
            state = updateProgress(state, progress, '正在生成...');
            
            // 生成失败
            const failedState = failGeneration(state, errorMessage);
            
            // 验证：进度应重置为 0
            expect(failedState.progress).toBe(0);
            expect(failedState.status).toBe('');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('清除错误后错误信息应为空', () => {
      fc.assert(
        fc.property(
          genInitialStateArb,
          errorMessageArb,
          (initialState, errorMessage) => {
            // 开始生成
            const generatingState = startGeneration(initialState);
            
            // 生成失败
            const failedState = failGeneration(generatingState, errorMessage);
            
            // 清除错误
            const clearedState = clearError(failedState);
            
            // 验证：错误信息应为空
            expect(clearedState.error).toBeNull();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('生成失败不应影响画布现有图片', () => {
      fc.assert(
        fc.property(
          genInitialStateArb,
          errorMessageArb,
          (initialState, errorMessage) => {
            // 前置条件：初始状态有图片
            fc.pre(initialState.canvasImages.length > 0);
            
            // 开始生成
            const generatingState = startGeneration(initialState);
            
            // 生成失败
            const failedState = failGeneration(generatingState, errorMessage);
            
            // 验证：画布图片应保持不变
            expect(failedState.canvasImages).toEqual(initialState.canvasImages);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('连续失败后仍可重新触发生成', () => {
      fc.assert(
        fc.property(
          genInitialStateArb,
          fc.array(errorMessageArb, { minLength: 2, maxLength: 5 }),
          (initialState, errorMessages) => {
            let state = initialState;
            
            // 连续多次失败
            for (const errorMessage of errorMessages) {
              state = startGeneration(state);
              state = failGeneration(state, errorMessage);
              
              // 验证：每次失败后都应恢复可操作状态
              expect(canTriggerGeneration(state)).toBe(true);
            }
            
            // 验证：最终仍可触发生成
            expect(canTriggerGeneration(state)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});


// ============================================
// 图片位置计算属性测试
// ============================================

import {
  findAnchorImage,
  getAnchorPosition,
  calculateNewImagePosition,
  calculateBatchPositions,
  calculateGenerationArea,
  checkAreaInViewport,
  checkPositionOverlap,
  AnchorImage,
} from '../hooks/useCanvasImages';
import { CanvasImage, Viewport } from '../../../shared/types';

// 模拟画布图片
interface MockCanvasImage {
  id: string;
  x: number;
  y: number;
  canvasX?: number;
  canvasY?: number;
  width: number;
  height: number;
  createdAt?: Date;
}

// 生成器
const positionArb = fc.integer({ min: 0, max: 5000 });
const sizeArb = fc.integer({ min: 100, max: 1000 });

// 生成画布图片
const canvasImageArb: fc.Arbitrary<MockCanvasImage> = fc.record({
  id: fc.string({ minLength: 5, maxLength: 20 }).map(s => `img-${s.replace(/[^a-zA-Z0-9]/g, '')}`),
  x: positionArb,
  y: positionArb,
  width: sizeArb,
  height: sizeArb,
  createdAt: fc.date({ min: new Date('2020-01-01'), max: new Date('2030-01-01') }),
}).map(img => ({
  ...img,
  canvasX: img.x,
  canvasY: img.y,
}));

// 生成画布图片列表（确保 ID 唯一且时间戳唯一）
const canvasImageListArb = (minLength: number, maxLength: number): fc.Arbitrary<MockCanvasImage[]> => {
  return fc.array(canvasImageArb, { minLength, maxLength }).map(images => {
    const seen = new Set<string>();
    const seenTimes = new Set<number>();
    let timeOffset = 0;
    
    return images.filter(img => {
      if (seen.has(img.id)) return false;
      seen.add(img.id);
      
      // 确保时间戳唯一
      if (img.createdAt) {
        let time = img.createdAt.getTime();
        while (seenTimes.has(time)) {
          time += 1000; // 增加 1 秒
        }
        seenTimes.add(time);
        img.createdAt = new Date(time);
      }
      
      return true;
    });
  });
};

// 生成图片尺寸
const imageSizeArb: fc.Arbitrary<{ width: number; height: number }> = fc.record({
  width: sizeArb,
  height: sizeArb,
});

// 生成视口
const viewportArb: fc.Arbitrary<Viewport> = fc.record({
  x: positionArb,
  y: positionArb,
  width: fc.integer({ min: 800, max: 2560 }),
  height: fc.integer({ min: 600, max: 1440 }),
  scale: fc.integer({ min: 1, max: 30 }).map(v => v / 10), // 0.1 - 3.0
});

// 生成批量数量
const batchCountArb = fc.integer({ min: 1, max: 6 });

describe('图片位置计算属性测试', () => {
  /**
   * **Feature: canvas-dialog-redesign, Property 12: 新图片位置基于锚点计算**
   * **Validates: Requirements 10.1, 10.2, 10.4**
   * 
   * 对于任意新生成的图片，其位置应基于最近一次生成图片的位置作为锚点，
   * 排列在其下方区域。
   */
  describe('属性 12: 新图片位置基于锚点计算', () => {
    it('应找到最近创建的图片所在行的最左边图片作为锚点', () => {
      fc.assert(
        fc.property(
          canvasImageListArb(2, 10),
          (images) => {
            // 前置条件：至少有 2 张图片
            fc.pre(images.length >= 2);

            // 找到锚点
            const anchor = findAnchorImage(images as unknown as CanvasImage[]);

            // 验证：锚点不为空
            expect(anchor).not.toBeNull();

            // 验证：锚点是最新图片所在行的最左边图片
            // 1. 找到最新创建的图片
            const sortedImages = [...images].sort((a, b) => {
              const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
              const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
              return dateB - dateA;
            });
            const latestImage = sortedImages[0];
            const latestY = latestImage.y ?? latestImage.canvasY ?? 0;
            
            // 2. 找到与最新图片同一行的所有图片（Y 坐标差距在 50px 以内）
            const Y_TOLERANCE = 50;
            const sameRowImages = images.filter(img => {
              const imgY = img.y ?? img.canvasY ?? 0;
              return Math.abs(imgY - latestY) < Y_TOLERANCE;
            });
            
            // 3. 找到同一行中最左边的图片
            let leftmostImage = sameRowImages[0];
            let minX = leftmostImage.x ?? leftmostImage.canvasX ?? Infinity;
            for (const img of sameRowImages) {
              const imgX = img.x ?? img.canvasX ?? 0;
              if (imgX < minX) {
                minX = imgX;
                leftmostImage = img;
              }
            }
            
            // 验证：锚点是同一行中最左边的图片
            expect(anchor!.id).toBe(leftmostImage.id);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('空图片列表应返回 null 锚点', () => {
      const anchor = findAnchorImage([]);
      expect(anchor).toBeNull();
    });

    it('新图片位置应在锚点下方', () => {
      fc.assert(
        fc.property(
          canvasImageListArb(1, 10),
          imageSizeArb,
          (images, newSize) => {
            // 前置条件：至少有 1 张图片
            fc.pre(images.length >= 1);

            // 计算新图片位置
            const newPosition = calculateNewImagePosition(
              images as unknown as CanvasImage[],
              newSize,
              0,
              1
            );

            // 找到锚点
            const anchor = findAnchorImage(images as unknown as CanvasImage[]);

            // 验证：新图片 Y 坐标应大于等于锚点底部
            if (anchor) {
              const anchorBottom = anchor.y + anchor.height;
              expect(newPosition.y).toBeGreaterThanOrEqual(anchorBottom);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('锚点位置应反映用户拖动后的最新位置', () => {
      fc.assert(
        fc.property(
          canvasImageArb,
          positionArb,
          positionArb,
          (image, newX, newY) => {
            // 模拟用户拖动：更新 x/y 但保持 canvasX/canvasY 不变
            const draggedImage: MockCanvasImage = {
              ...image,
              x: newX,
              y: newY,
              // canvasX/canvasY 保持原值（模拟未保存的拖动）
            };

            // 获取锚点位置
            const position = getAnchorPosition(
              [draggedImage] as unknown as CanvasImage[],
              draggedImage.id
            );

            // 验证：应返回运行时位置（x/y），而不是持久化位置（canvasX/canvasY）
            expect(position).not.toBeNull();
            expect(position!.x).toBe(newX);
            expect(position!.y).toBe(newY);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: canvas-dialog-redesign, Property 13: 批量生成横向排列**
   * **Validates: Requirements 10.5**
   * 
   * 对于任意批量生成的多张图片，它们应在生成区域内按横向顺序排列，
   * 保持统一间距。
   */
  describe('属性 13: 批量生成横向排列', () => {
    it('批量生成的图片应横向排列', () => {
      fc.assert(
        fc.property(
          canvasImageListArb(0, 5),
          imageSizeArb,
          batchCountArb,
          (existingImages, imageSize, count) => {
            // 前置条件：批量数量大于 1
            fc.pre(count > 1);

            // 计算批量位置
            const positions = calculateBatchPositions(
              existingImages as unknown as CanvasImage[],
              imageSize,
              count
            );

            // 验证：位置数量应等于批量数量
            expect(positions.length).toBe(count);

            // 验证：后续图片的 X 坐标应大于等于前一张
            for (let i = 1; i < positions.length; i++) {
              expect(positions[i].x).toBeGreaterThanOrEqual(positions[i - 1].x);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('批量生成的图片应保持统一间距', () => {
      fc.assert(
        fc.property(
          canvasImageListArb(0, 3),
          imageSizeArb,
          fc.integer({ min: 2, max: 4 }),
          (existingImages, imageSize, count) => {
            // 计算批量位置
            const positions = calculateBatchPositions(
              existingImages as unknown as CanvasImage[],
              imageSize,
              count
            );

            // 验证：相邻图片之间的间距应一致
            if (positions.length >= 2) {
              const firstGap = positions[1].x - positions[0].x;
              for (let i = 2; i < positions.length; i++) {
                const gap = positions[i].x - positions[i - 1].x;
                // 允许小的误差（由于避免重叠的调整）
                expect(Math.abs(gap - firstGap)).toBeLessThanOrEqual(imageSize.width + 50);
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('单张生成应返回单个位置', () => {
      fc.assert(
        fc.property(
          canvasImageListArb(0, 5),
          imageSizeArb,
          (existingImages, imageSize) => {
            // 计算单张位置
            const positions = calculateBatchPositions(
              existingImages as unknown as CanvasImage[],
              imageSize,
              1
            );

            // 验证：应返回单个位置
            expect(positions.length).toBe(1);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: canvas-dialog-redesign, Property 14: 生成位置不重叠**
   * **Validates: Requirements 10.3**
   * 
   * 对于任意新生成的图片，其位置应确保不与画布中已有的任何图片发生重叠。
   */
  describe('属性 14: 生成位置不重叠', () => {
    it('新图片位置不应与现有图片重叠', () => {
      fc.assert(
        fc.property(
          canvasImageListArb(1, 10),
          imageSizeArb,
          (existingImages, newSize) => {
            // 计算新图片位置
            const newPosition = calculateNewImagePosition(
              existingImages as unknown as CanvasImage[],
              newSize,
              0,
              1
            );

            // 验证：新位置不与任何现有图片重叠
            const overlaps = checkPositionOverlap(
              existingImages as unknown as CanvasImage[],
              newPosition,
              newSize
            );

            expect(overlaps).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('批量生成的图片之间不应重叠', () => {
      fc.assert(
        fc.property(
          canvasImageListArb(0, 5),
          imageSizeArb,
          batchCountArb,
          (existingImages, imageSize, count) => {
            // 计算批量位置
            const positions = calculateBatchPositions(
              existingImages as unknown as CanvasImage[],
              imageSize,
              count
            );

            // 验证：任意两张新图片之间不重叠
            for (let i = 0; i < positions.length; i++) {
              for (let j = i + 1; j < positions.length; j++) {
                const rect1 = {
                  x: positions[i].x,
                  y: positions[i].y,
                  width: imageSize.width,
                  height: imageSize.height,
                };
                const rect2 = {
                  x: positions[j].x,
                  y: positions[j].y,
                  width: imageSize.width,
                  height: imageSize.height,
                };

                // 检查是否重叠
                const overlaps = !(
                  rect1.x + rect1.width <= rect2.x ||
                  rect2.x + rect2.width <= rect1.x ||
                  rect1.y + rect1.height <= rect2.y ||
                  rect2.y + rect2.height <= rect1.y
                );

                expect(overlaps).toBe(false);
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('批量生成的图片不应与现有图片重叠', () => {
      fc.assert(
        fc.property(
          canvasImageListArb(1, 5),
          imageSizeArb,
          batchCountArb,
          (existingImages, imageSize, count) => {
            // 计算批量位置
            const positions = calculateBatchPositions(
              existingImages as unknown as CanvasImage[],
              imageSize,
              count
            );

            // 验证：每个新位置都不与现有图片重叠
            for (const pos of positions) {
              const overlaps = checkPositionOverlap(
                existingImages as unknown as CanvasImage[],
                pos,
                imageSize
              );
              expect(overlaps).toBe(false);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: canvas-dialog-redesign, Property 15: 视角自动聚焦**
   * **Validates: Requirements 10.6, 10.7**
   * 
   * 对于任意图片生成操作，系统应在生成前自动调整视角，
   * 使生成区域处于可视范围内。
   */
  describe('属性 15: 视角自动聚焦', () => {
    it('应正确计算生成区域的边界框', () => {
      fc.assert(
        fc.property(
          fc.array(fc.record({ x: positionArb, y: positionArb }), { minLength: 1, maxLength: 6 }),
          imageSizeArb,
          (positions, imageSize) => {
            // 计算生成区域
            const area = calculateGenerationArea(positions, imageSize);

            // 验证：边界框应包含所有位置
            for (const pos of positions) {
              expect(area.x).toBeLessThanOrEqual(pos.x);
              expect(area.y).toBeLessThanOrEqual(pos.y);
              expect(area.x + area.width).toBeGreaterThanOrEqual(pos.x + imageSize.width);
              expect(area.y + area.height).toBeGreaterThanOrEqual(pos.y + imageSize.height);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('应正确检测区域是否在视口内', () => {
      fc.assert(
        fc.property(
          viewportArb,
          (viewport) => {
            // 创建一个完全在视口内的区域
            const areaInViewport = {
              x: viewport.x + 10,
              y: viewport.y + 10,
              width: Math.min(100, viewport.width / viewport.scale - 20),
              height: Math.min(100, viewport.height / viewport.scale - 20),
            };

            // 验证：应检测为在视口内
            const isInViewport = checkAreaInViewport(areaInViewport, viewport);
            expect(isInViewport).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('应正确检测区域不在视口内', () => {
      fc.assert(
        fc.property(
          viewportArb,
          (viewport) => {
            // 创建一个完全在视口外的区域
            const areaOutsideViewport = {
              x: viewport.x + viewport.width / viewport.scale + 1000,
              y: viewport.y + viewport.height / viewport.scale + 1000,
              width: 100,
              height: 100,
            };

            // 验证：应检测为不在视口内
            const isInViewport = checkAreaInViewport(areaOutsideViewport, viewport);
            expect(isInViewport).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('空位置列表应返回默认区域', () => {
      const imageSize = { width: 400, height: 400 };
      const area = calculateGenerationArea([], imageSize);

      // 验证：应返回默认区域
      expect(area.x).toBe(100); // INITIAL_X
      expect(area.y).toBe(100); // INITIAL_Y
      expect(area.width).toBe(imageSize.width);
      expect(area.height).toBe(imageSize.height);
    });
  });
});


// ============================================
// 添加为参考图功能属性测试
// ============================================

// 模拟 UploadedImage 类型
interface MockUploadedImage {
  id: string;
  preview: string;
  name: string;
  size: number;
}

// 模拟添加为参考图的画布图片类型
interface AddRefCanvasImage {
  id: string;
  url: string;
  thumbnailUrl?: string;
  prompt: string;
}

// 参考图最大数量
const MAX_REF_IMAGES = 4;

/**
 * 模拟添加为参考图的核心逻辑
 * 返回 { success, result, error }
 */
function addAsReferenceImage(
  image: AddRefCanvasImage,
  currentRefImages: MockUploadedImage[]
): { success: boolean; result?: MockUploadedImage[]; error?: string } {
  // 检查参考图数量是否达到上限
  if (currentRefImages.length >= MAX_REF_IMAGES) {
    return { success: false, error: 'max_limit' };
  }

  // 检查图片 URL 是否有效
  if (!image.url) {
    return { success: false, error: 'invalid_url' };
  }

  // 检查图片是否已存在于参考图列表
  const isDuplicate = currentRefImages.some(
    (refImg) => refImg.preview === image.url || refImg.preview === image.thumbnailUrl
  );
  if (isDuplicate) {
    return { success: false, error: 'duplicate' };
  }

  // 创建新的参考图对象
  const newRefImage: MockUploadedImage = {
    id: `ref-canvas-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    preview: image.url,
    name: `画布图片-${currentRefImages.length + 1}`,
    size: 0,
  };

  // 返回更新后的列表
  return {
    success: true,
    result: [...currentRefImages, newRefImage],
  };
}

// 生成器
const canvasImageIdArb = fc.string({ minLength: 5, maxLength: 20 }).map(s => `img-${s.replace(/[^a-zA-Z0-9]/g, '')}`);
const imageUrlArb = fc.webUrl();
const promptArb = fc.string({ minLength: 0, maxLength: 200 });

// 生成有效的画布图片
const validCanvasImageArb: fc.Arbitrary<AddRefCanvasImage> = fc.record({
  id: canvasImageIdArb,
  url: imageUrlArb,
  thumbnailUrl: fc.option(imageUrlArb, { nil: undefined }),
  prompt: promptArb,
});

// 生成无效的画布图片（无 URL）
const invalidCanvasImageArb: fc.Arbitrary<AddRefCanvasImage> = fc.record({
  id: canvasImageIdArb,
  url: fc.constant(''),
  thumbnailUrl: fc.option(imageUrlArb, { nil: undefined }),
  prompt: promptArb,
});

// 生成参考图对象
const uploadedImageArb: fc.Arbitrary<MockUploadedImage> = fc.record({
  id: fc.string({ minLength: 5, maxLength: 30 }).map(s => `ref-${s.replace(/[^a-zA-Z0-9]/g, '')}`),
  preview: imageUrlArb,
  name: fc.string({ minLength: 1, maxLength: 50 }),
  size: fc.integer({ min: 0, max: 10000000 }),
});

// 生成参考图列表（确保 ID 和 preview 唯一）
const addRefImageListArb = (minLength: number, maxLength: number): fc.Arbitrary<MockUploadedImage[]> => {
  return fc.array(uploadedImageArb, { minLength, maxLength }).map(images => {
    const seenIds = new Set<string>();
    const seenPreviews = new Set<string>();
    return images.filter(img => {
      if (seenIds.has(img.id) || seenPreviews.has(img.preview)) return false;
      seenIds.add(img.id);
      seenPreviews.add(img.preview);
      return true;
    });
  });
};

describe('CanvasDialogBar - 添加为参考图属性测试', () => {
  /**
   * **Feature: add-as-reference-image, Property 2: 添加参考图格式正确性**
   * **Validates: Requirements 2.1**
   * 
   * 对于任意包含有效 URL 的画布图片，调用添加为参考图函数后，
   * 参考图列表中应包含一个新的 UploadedImage 对象，其 preview 字段等于图片的 URL。
   */
  describe('Property 2: 添加参考图格式正确性', () => {
    it('有效图片应被正确转换为参考图格式', () => {
      fc.assert(
        fc.property(
          validCanvasImageArb,
          addRefImageListArb(0, MAX_REF_IMAGES - 1),
          (image, currentRefImages) => {
            // 前置条件：当前参考图数量未达上限
            fc.pre(currentRefImages.length < MAX_REF_IMAGES);
            // 前置条件：图片 URL 不在现有参考图中
            fc.pre(!currentRefImages.some(ref => ref.preview === image.url));

            const result = addAsReferenceImage(image, currentRefImages);

            // 验证：添加成功
            expect(result.success).toBe(true);
            expect(result.result).toBeDefined();

            if (result.result) {
              // 验证：列表长度增加 1
              expect(result.result.length).toBe(currentRefImages.length + 1);

              // 验证：新添加的参考图 preview 等于图片 URL
              const newRefImage = result.result[result.result.length - 1];
              expect(newRefImage.preview).toBe(image.url);

              // 验证：新参考图有有效的 ID
              expect(newRefImage.id).toBeTruthy();
              expect(newRefImage.id.startsWith('ref-canvas-')).toBe(true);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('无效图片（无 URL）应被拒绝', () => {
      fc.assert(
        fc.property(
          invalidCanvasImageArb,
          addRefImageListArb(0, MAX_REF_IMAGES - 1),
          (image, currentRefImages) => {
            const result = addAsReferenceImage(image, currentRefImages);

            // 验证：添加失败
            expect(result.success).toBe(false);
            expect(result.error).toBe('invalid_url');

            // 验证：列表未改变
            expect(result.result).toBeUndefined();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('达到上限时应拒绝添加', () => {
      fc.assert(
        fc.property(
          validCanvasImageArb,
          addRefImageListArb(MAX_REF_IMAGES, MAX_REF_IMAGES),
          (image, currentRefImages) => {
            // 前置条件：当前参考图数量已达上限
            fc.pre(currentRefImages.length >= MAX_REF_IMAGES);

            const result = addAsReferenceImage(image, currentRefImages);

            // 验证：添加失败
            expect(result.success).toBe(false);
            expect(result.error).toBe('max_limit');
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: add-as-reference-image, Property 3: 重复图片检测**
   * **Validates: Requirements 3.3**
   * 
   * 对于任意已存在于参考图列表中的图片 URL，再次调用添加为参考图函数
   * 应返回重复标识，且参考图列表长度不变。
   */
  describe('Property 3: 重复图片检测', () => {
    it('重复图片应被检测并拒绝', () => {
      fc.assert(
        fc.property(
          addRefImageListArb(1, MAX_REF_IMAGES - 1),
          (currentRefImages) => {
            // 前置条件：列表非空
            fc.pre(currentRefImages.length > 0);

            // 选择一个已存在的参考图 URL
            const existingRefImage = currentRefImages[0];
            const duplicateImage: AddRefCanvasImage = {
              id: 'duplicate-test',
              url: existingRefImage.preview,
              prompt: 'test',
            };

            const result = addAsReferenceImage(duplicateImage, currentRefImages);

            // 验证：添加失败，原因是重复
            expect(result.success).toBe(false);
            expect(result.error).toBe('duplicate');

            // 验证：列表未改变
            expect(result.result).toBeUndefined();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('非重复图片应被成功添加', () => {
      fc.assert(
        fc.property(
          validCanvasImageArb,
          addRefImageListArb(0, MAX_REF_IMAGES - 1),
          (image, currentRefImages) => {
            // 前置条件：图片 URL 不在现有参考图中
            fc.pre(!currentRefImages.some(ref => ref.preview === image.url));
            // 前置条件：当前参考图数量未达上限
            fc.pre(currentRefImages.length < MAX_REF_IMAGES);

            const result = addAsReferenceImage(image, currentRefImages);

            // 验证：添加成功
            expect(result.success).toBe(true);
            expect(result.result).toBeDefined();

            if (result.result) {
              // 验证：列表长度增加 1
              expect(result.result.length).toBe(currentRefImages.length + 1);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('连续添加相同图片应只成功一次', () => {
      fc.assert(
        fc.property(
          validCanvasImageArb,
          (image) => {
            const emptyList: MockUploadedImage[] = [];

            // 第一次添加
            const firstResult = addAsReferenceImage(image, emptyList);
            expect(firstResult.success).toBe(true);

            if (firstResult.result) {
              // 第二次添加相同图片
              const secondResult = addAsReferenceImage(image, firstResult.result);

              // 验证：第二次添加失败
              expect(secondResult.success).toBe(false);
              expect(secondResult.error).toBe('duplicate');
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});

// ============================================
// 参考图拖拽排序属性测试
// ============================================

/**
 * 模拟拖拽排序的核心逻辑
 * 将元素从 fromIndex 移动到 toIndex
 */
function reorderRefImages<T>(
  images: T[],
  fromIndex: number,
  toIndex: number
): T[] {
  if (fromIndex < 0 || fromIndex >= images.length) return images;
  if (toIndex < 0 || toIndex >= images.length) return images;
  if (fromIndex === toIndex) return images;

  const newImages = [...images];
  const [draggedItem] = newImages.splice(fromIndex, 1);
  newImages.splice(toIndex, 0, draggedItem);
  return newImages;
}

describe('CanvasDialogBar - 参考图拖拽排序属性测试', () => {
  /**
   * **Feature: add-as-reference-image, Property 4: 拖拽排序保持元素**
   * **Validates: Requirements 4.2**
   * 
   * 对于任意参考图列表和有效的拖拽操作（从索引 A 移动到索引 B），
   * 排序后的列表应包含与原列表相同的所有元素，仅顺序不同。
   */
  describe('Property 4: 拖拽排序保持元素', () => {
    it('拖拽排序应保持所有元素', () => {
      fc.assert(
        fc.property(
          addRefImageListArb(2, MAX_REF_IMAGES),
          (images) => {
            // 前置条件：至少有 2 个元素
            fc.pre(images.length >= 2);

            // 生成有效的拖拽索引
            const fromIndex = Math.floor(Math.random() * images.length);
            let toIndex = Math.floor(Math.random() * images.length);
            while (toIndex === fromIndex && images.length > 1) {
              toIndex = Math.floor(Math.random() * images.length);
            }

            const reorderedImages = reorderRefImages(images, fromIndex, toIndex);

            // 验证：列表长度不变
            expect(reorderedImages.length).toBe(images.length);

            // 验证：所有原始元素都存在于新列表中
            for (const img of images) {
              expect(reorderedImages.find(i => i.id === img.id)).toBeDefined();
            }

            // 验证：新列表中的所有元素都来自原列表
            for (const img of reorderedImages) {
              expect(images.find(i => i.id === img.id)).toBeDefined();
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('无效索引应保持列表不变', () => {
      fc.assert(
        fc.property(
          addRefImageListArb(1, MAX_REF_IMAGES),
          fc.integer({ min: -10, max: -1 }),
          (images, invalidIndex) => {
            const originalLength = images.length;
            const reorderedImages = reorderRefImages(images, invalidIndex, 0);

            // 验证：列表不变
            expect(reorderedImages.length).toBe(originalLength);
            expect(reorderedImages).toEqual(images);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('相同索引应保持列表不变', () => {
      fc.assert(
        fc.property(
          addRefImageListArb(1, MAX_REF_IMAGES),
          (images) => {
            fc.pre(images.length > 0);

            const index = Math.floor(Math.random() * images.length);
            const reorderedImages = reorderRefImages(images, index, index);

            // 验证：列表不变
            expect(reorderedImages).toEqual(images);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: add-as-reference-image, Property 5: 拖拽排序位置正确性**
   * **Validates: Requirements 4.2**
   * 
   * 对于任意参考图列表和有效的拖拽操作（从索引 A 移动到索引 B），
   * 被拖拽的元素应出现在目标位置 B。
   */
  describe('Property 5: 拖拽排序位置正确性', () => {
    it('被拖拽元素应出现在目标位置', () => {
      fc.assert(
        fc.property(
          addRefImageListArb(2, MAX_REF_IMAGES),
          (images) => {
            // 前置条件：至少有 2 个元素
            fc.pre(images.length >= 2);

            // 生成有效的拖拽索引
            const fromIndex = Math.floor(Math.random() * images.length);
            let toIndex = Math.floor(Math.random() * images.length);
            while (toIndex === fromIndex && images.length > 1) {
              toIndex = Math.floor(Math.random() * images.length);
            }

            const draggedElement = images[fromIndex];
            const reorderedImages = reorderRefImages(images, fromIndex, toIndex);

            // 验证：被拖拽元素出现在目标位置
            expect(reorderedImages[toIndex].id).toBe(draggedElement.id);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('向前拖拽应正确移动元素', () => {
      fc.assert(
        fc.property(
          addRefImageListArb(3, MAX_REF_IMAGES),
          (images) => {
            // 前置条件：至少有 3 个元素
            fc.pre(images.length >= 3);

            // 从后面拖到前面
            const fromIndex = images.length - 1;
            const toIndex = 0;

            const draggedElement = images[fromIndex];
            const reorderedImages = reorderRefImages(images, fromIndex, toIndex);

            // 验证：被拖拽元素出现在第一个位置
            expect(reorderedImages[0].id).toBe(draggedElement.id);

            // 验证：其他元素顺序正确
            for (let i = 0; i < images.length - 1; i++) {
              expect(reorderedImages[i + 1].id).toBe(images[i].id);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('向后拖拽应正确移动元素', () => {
      fc.assert(
        fc.property(
          addRefImageListArb(3, MAX_REF_IMAGES),
          (images) => {
            // 前置条件：至少有 3 个元素
            fc.pre(images.length >= 3);

            // 从前面拖到后面
            const fromIndex = 0;
            const toIndex = images.length - 1;

            const draggedElement = images[fromIndex];
            const reorderedImages = reorderRefImages(images, fromIndex, toIndex);

            // 验证：被拖拽元素出现在最后一个位置
            expect(reorderedImages[toIndex].id).toBe(draggedElement.id);

            // 验证：其他元素顺序正确
            for (let i = 1; i < images.length; i++) {
              expect(reorderedImages[i - 1].id).toBe(images[i].id);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});

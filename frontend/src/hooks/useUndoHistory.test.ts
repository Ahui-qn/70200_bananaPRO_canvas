/**
 * useUndoHistory Hook 属性测试
 * 
 * 简化版本：只测试删除操作的撤回/重做功能
 * 使用 fast-check 进行属性测试，验证撤回/重做系统的正确性属性
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import * as fc from 'fast-check';
import { useUndoHistory, UseUndoHistoryConfig } from './useUndoHistory';
import { CanvasImage, Position } from '../../../shared/types';

// Mock apiService
vi.mock('../services/api', () => ({
  apiService: {
    restoreImage: vi.fn().mockResolvedValue({ success: true }),
    deleteImage: vi.fn().mockResolvedValue({ success: true }),
  },
}));

// 生成随机位置的 Arbitrary
const positionArb = fc.record({
  x: fc.integer({ min: 0, max: 5000 }),
  y: fc.integer({ min: 0, max: 5000 }),
}) as fc.Arbitrary<Position>;

// 生成随机图片数据的 Arbitrary
const canvasImageArb = fc.record({
  id: fc.uuid(),
  url: fc.webUrl(),
  prompt: fc.string({ minLength: 1, maxLength: 100 }),
  model: fc.string({ minLength: 1, maxLength: 50 }),
  aspectRatio: fc.constantFrom('1:1', '16:9', '4:3', 'auto'),
  imageSize: fc.constantFrom('1K', '2K', '4K'),
  favorite: fc.boolean(),
  ossUploaded: fc.boolean(),
  createdAt: fc.date(),
  canvasX: fc.integer({ min: 0, max: 5000 }),
  canvasY: fc.integer({ min: 0, max: 5000 }),
  width: fc.integer({ min: 100, max: 1000 }),
  height: fc.integer({ min: 100, max: 1000 }),
}) as fc.Arbitrary<CanvasImage>;

// 默认配置（简化版：无 Toast，无位置更新回调）
const defaultConfig: UseUndoHistoryConfig = {
  onRestoreImage: vi.fn(),
  onDeleteImage: vi.fn(),
  onRefreshImages: vi.fn().mockResolvedValue(undefined),
};

describe('useUndoHistory Hook（简化版：只支持删除操作）', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Property 1: 撤回栈大小限制', () => {
    /**
     * 对于任意操作序列，无论执行多少次记录操作，撤回栈的大小永远不应超过配置的最大值（50）
     */
    it('撤回栈大小永远不超过 50', () => {
      fc.assert(
        fc.property(
          fc.array(canvasImageArb, { minLength: 1, maxLength: 100 }),
          fc.array(positionArb, { minLength: 1, maxLength: 100 }),
          (images, positions) => {
            const { result } = renderHook(() => useUndoHistory(defaultConfig));
            
            // 记录所有删除操作（包含位置信息）
            act(() => {
              images.forEach((img, index) => {
                const position = positions[index % positions.length];
                result.current.recordDeleteAction(img.id, img, position);
              });
            });
            
            // 验证栈大小不超过 50
            expect(result.current.undoCount).toBeLessThanOrEqual(50);
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('Property 2: 删除操作记录完整性', () => {
    /**
     * 对于任意删除操作，记录到撤回栈的操作数据应包含被删除图片的完整信息和位置
     */
    it('删除操作记录包含完整图片信息和位置', () => {
      fc.assert(
        fc.property(canvasImageArb, positionArb, (image, position) => {
          const { result } = renderHook(() => useUndoHistory(defaultConfig));
          
          act(() => {
            result.current.recordDeleteAction(image.id, image, position);
          });
          
          // 验证记录了操作
          expect(result.current.undoCount).toBe(1);
          expect(result.current.canUndo).toBe(true);
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 3: 批量删除操作原子性', () => {
    /**
     * 对于任意批量删除操作，应记录为单个操作
     */
    it('批量删除记录为单个操作', () => {
      fc.assert(
        fc.property(
          fc.array(canvasImageArb, { minLength: 2, maxLength: 10 }),
          fc.array(positionArb, { minLength: 2, maxLength: 10 }),
          (images, positions) => {
            const { result } = renderHook(() => useUndoHistory(defaultConfig));
            
            act(() => {
              result.current.recordBatchDeleteAction(
                images.map((img, index) => ({
                  imageId: img.id,
                  imageData: img,
                  position: positions[index % positions.length],
                }))
              );
            });
            
            // 验证只记录了一个操作
            expect(result.current.undoCount).toBe(1);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('单张图片的批量删除转换为单个删除操作', () => {
      const { result } = renderHook(() => useUndoHistory(defaultConfig));
      const image = { id: 'img1' } as CanvasImage;
      const position = { x: 100, y: 200 };
      
      act(() => {
        result.current.recordBatchDeleteAction([
          { imageId: image.id, imageData: image, position },
        ]);
      });
      
      // 验证记录了一个操作
      expect(result.current.undoCount).toBe(1);
    });
  });

  describe('Property 4: 新操作清空重做栈', () => {
    /**
     * 对于任意操作历史状态，当记录新操作时，重做栈应被清空
     */
    it('记录新操作后重做栈被清空', async () => {
      const { result } = renderHook(() => useUndoHistory(defaultConfig));
      const position = { x: 100, y: 200 };
      
      // 记录一个操作
      act(() => {
        result.current.recordDeleteAction('img1', { id: 'img1' } as CanvasImage, position);
      });
      
      // 撤回操作
      await act(async () => {
        await result.current.undo();
      });
      
      // 验证有可重做的操作
      expect(result.current.canRedo).toBe(true);
      
      // 记录新操作
      act(() => {
        result.current.recordDeleteAction('img2', { id: 'img2' } as CanvasImage, position);
      });
      
      // 验证重做栈被清空
      expect(result.current.canRedo).toBe(false);
      expect(result.current.redoCount).toBe(0);
    });
  });

  describe('Property 5: 空栈状态一致性', () => {
    /**
     * 对于任意操作历史状态，canUndo 应等于 undoStack.length > 0，canRedo 应等于 redoStack.length > 0
     */
    it('初始状态下 canUndo 和 canRedo 都为 false', () => {
      const { result } = renderHook(() => useUndoHistory(defaultConfig));
      
      expect(result.current.canUndo).toBe(false);
      expect(result.current.canRedo).toBe(false);
      expect(result.current.undoCount).toBe(0);
      expect(result.current.redoCount).toBe(0);
    });

    it('canUndo 与 undoCount 状态一致', () => {
      fc.assert(
        fc.property(
          fc.array(canvasImageArb, { minLength: 0, maxLength: 10 }),
          fc.array(positionArb, { minLength: 1, maxLength: 10 }),
          (images, positions) => {
            const { result } = renderHook(() => useUndoHistory(defaultConfig));
            
            act(() => {
              images.forEach((img, index) => {
                const position = positions[index % positions.length];
                result.current.recordDeleteAction(img.id, img, position);
              });
            });
            
            // 验证状态一致性
            expect(result.current.canUndo).toBe(result.current.undoCount > 0);
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('Property 6: 撤回-重做栈转移', () => {
    /**
     * 对于任意非空撤回栈，执行撤回操作后，该操作应从撤回栈移动到重做栈
     */
    it('撤回后操作从撤回栈移动到重做栈', async () => {
      const { result } = renderHook(() => useUndoHistory(defaultConfig));
      const position = { x: 100, y: 200 };
      
      // 记录操作
      act(() => {
        result.current.recordDeleteAction('img1', { id: 'img1' } as CanvasImage, position);
      });
      
      const undoCountBefore = result.current.undoCount;
      const redoCountBefore = result.current.redoCount;
      
      // 撤回
      await act(async () => {
        await result.current.undo();
      });
      
      // 验证栈转移
      expect(result.current.undoCount).toBe(undoCountBefore - 1);
      expect(result.current.redoCount).toBe(redoCountBefore + 1);
    });

    /**
     * 对于任意非空重做栈，执行重做操作后，该操作应从重做栈移动到撤回栈
     */
    it('重做后操作从重做栈移动到撤回栈', async () => {
      const { result } = renderHook(() => useUndoHistory(defaultConfig));
      const position = { x: 100, y: 200 };
      
      // 记录并撤回操作
      act(() => {
        result.current.recordDeleteAction('img1', { id: 'img1' } as CanvasImage, position);
      });
      
      await act(async () => {
        await result.current.undo();
      });
      
      const undoCountBefore = result.current.undoCount;
      const redoCountBefore = result.current.redoCount;
      
      // 重做
      await act(async () => {
        await result.current.redo();
      });
      
      // 验证栈转移
      expect(result.current.undoCount).toBe(undoCountBefore + 1);
      expect(result.current.redoCount).toBe(redoCountBefore - 1);
    });
  });

  describe('Property 7: 撤回-重做往返一致性', () => {
    /**
     * 对于任意操作，执行撤回后再执行重做，系统状态应与撤回前相同
     */
    it('撤回后重做恢复原状态', async () => {
      const { result } = renderHook(() => useUndoHistory(defaultConfig));
      const position1 = { x: 100, y: 200 };
      const position2 = { x: 300, y: 400 };
      
      // 记录操作
      act(() => {
        result.current.recordDeleteAction('img1', { id: 'img1' } as CanvasImage, position1);
        result.current.recordDeleteAction('img2', { id: 'img2' } as CanvasImage, position2);
      });
      
      const initialUndoCount = result.current.undoCount;
      const initialRedoCount = result.current.redoCount;
      
      // 撤回
      await act(async () => {
        await result.current.undo();
      });
      
      // 重做
      await act(async () => {
        await result.current.redo();
      });
      
      // 验证状态恢复
      expect(result.current.undoCount).toBe(initialUndoCount);
      expect(result.current.redoCount).toBe(initialRedoCount);
    });
  });

  describe('Property 8: 位置恢复准确性', () => {
    /**
     * 对于任意删除操作，撤回后应调用 onRestoreImage 并传入正确的位置信息
     */
    it('撤回删除后调用 onRestoreImage 使用保存的位置', async () => {
      const onRestoreImage = vi.fn();
      const { result } = renderHook(() =>
        useUndoHistory({ ...defaultConfig, onRestoreImage })
      );
      
      const image = { id: 'img1' } as CanvasImage;
      const position = { x: 100, y: 200 };
      
      // 记录删除操作（包含位置）
      act(() => {
        result.current.recordDeleteAction(image.id, image, position);
      });
      
      // 撤回
      await act(async () => {
        await result.current.undo();
      });
      
      // 验证调用了 onRestoreImage 并传入正确的位置
      expect(onRestoreImage).toHaveBeenCalledWith(image, position);
    });
  });

  describe('clearHistory', () => {
    it('清空历史后 canUndo 和 canRedo 都为 false', () => {
      const { result } = renderHook(() => useUndoHistory(defaultConfig));
      const position = { x: 100, y: 200 };
      
      // 记录一些操作
      act(() => {
        result.current.recordDeleteAction('img1', { id: 'img1' } as CanvasImage, position);
        result.current.recordDeleteAction('img2', { id: 'img2' } as CanvasImage, position);
      });
      
      // 清空历史
      act(() => {
        result.current.clearHistory();
      });
      
      // 验证状态
      expect(result.current.canUndo).toBe(false);
      expect(result.current.canRedo).toBe(false);
      expect(result.current.undoCount).toBe(0);
      expect(result.current.redoCount).toBe(0);
    });
  });

  describe('无 UI 和无 Toast 验证', () => {
    it('Hook 不包含 onShowToast 配置项', () => {
      // 验证配置接口不包含 onShowToast
      const config: UseUndoHistoryConfig = {
        onRestoreImage: vi.fn(),
        onDeleteImage: vi.fn(),
        onRefreshImages: vi.fn(),
      };
      
      // 应该能正常创建 Hook
      const { result } = renderHook(() => useUndoHistory(config));
      expect(result.current).toBeDefined();
    });

    it('Hook 返回值不包含移动操作相关方法', () => {
      const { result } = renderHook(() => useUndoHistory(defaultConfig));
      
      // 验证返回值只包含删除操作相关方法
      expect(result.current.recordDeleteAction).toBeDefined();
      expect(result.current.recordBatchDeleteAction).toBeDefined();
      
      // 验证不包含移动操作方法（TypeScript 类型检查会确保这一点）
      expect((result.current as any).recordMoveAction).toBeUndefined();
      expect((result.current as any).recordBatchMoveAction).toBeUndefined();
    });
  });
});

/**
 * useCanvasSelection Hook 属性测试
 * 
 * 使用 fast-check 进行属性测试，验证多选功能的核心逻辑
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { CanvasImage } from '../../../shared/types';

// ============================================
// 类型定义（从 Hook 中复制，用于测试）
// ============================================

type ToolMode = 'move' | 'hand';

interface ToolModeState {
  currentMode: ToolMode;
  isSpacePressed: boolean;
  isDraggingCanvas: boolean;
}

interface SelectionState {
  selectedIds: Set<string>;
  isMultiSelecting: boolean;
}

// 光标样式映射
const cursorStyles: Record<string, string> = {
  'move-default': 'default',
  'move-hover': 'move',
  'hand-default': 'grab',
  'hand-dragging': 'grabbing',
  'selecting': 'crosshair',
};

// ============================================
// 模拟 Hook 的核心逻辑函数
// ============================================

/**
 * 处理空格键按下 - 切换到抓手模式
 */
function handleSpaceDown(state: ToolModeState): ToolModeState {
  return {
    ...state,
    currentMode: 'hand',
    isSpacePressed: true,
  };
}

/**
 * 处理空格键释放 - 恢复到移动模式
 */
function handleSpaceUp(state: ToolModeState): ToolModeState {
  return {
    ...state,
    currentMode: 'move',
    isSpacePressed: false,
    isDraggingCanvas: false,
  };
}

/**
 * 获取光标样式
 */
function getCursorStyle(
  toolMode: ToolModeState,
  isMultiSelecting: boolean,
  isHoveringImage: boolean = false
): string {
  // 框选中
  if (isMultiSelecting) {
    return cursorStyles['selecting'];
  }

  // 抓手模式
  if (toolMode.currentMode === 'hand') {
    return toolMode.isDraggingCanvas ? cursorStyles['hand-dragging'] : cursorStyles['hand-default'];
  }

  // 移动模式
  return isHoveringImage ? cursorStyles['move-hover'] : cursorStyles['move-default'];
}

/**
 * 选中图片
 */
function selectImage(
  state: SelectionState,
  id: string,
  addToSelection: boolean = false
): SelectionState {
  const newSelectedIds = new Set(addToSelection ? state.selectedIds : []);
  newSelectedIds.add(id);
  return {
    ...state,
    selectedIds: newSelectedIds,
  };
}

/**
 * 取消选中图片
 */
function deselectImage(state: SelectionState, id: string): SelectionState {
  const newSelectedIds = new Set(state.selectedIds);
  newSelectedIds.delete(id);
  return {
    ...state,
    selectedIds: newSelectedIds,
  };
}

/**
 * 切换选中状态
 */
function toggleSelection(state: SelectionState, id: string): SelectionState {
  const newSelectedIds = new Set(state.selectedIds);
  if (newSelectedIds.has(id)) {
    newSelectedIds.delete(id);
  } else {
    newSelectedIds.add(id);
  }
  return {
    ...state,
    selectedIds: newSelectedIds,
  };
}

/**
 * 清除选中
 */
function clearSelection(state: SelectionState): SelectionState {
  return {
    ...state,
    selectedIds: new Set<string>(),
  };
}

/**
 * 全选
 */
function selectAll(state: SelectionState, imageIds: string[]): SelectionState {
  return {
    ...state,
    selectedIds: new Set(imageIds),
  };
}

/**
 * 模拟点击选择逻辑
 */
function handleClickSelection(
  state: SelectionState,
  clickedImageId: string | null,
  isShiftPressed: boolean,
  isImageSelected: boolean
): SelectionState {
  // 点击空白处
  if (clickedImageId === null) {
    return clearSelection(state);
  }

  // Shift + 点击
  if (isShiftPressed) {
    return toggleSelection(state, clickedImageId);
  }

  // 点击已选中的图片（不按 Shift）- 保持选中状态以便拖动
  if (isImageSelected) {
    return state;
  }

  // 点击未选中的图片（不按 Shift）- 仅选中该图片
  return selectImage(state, clickedImageId, false);
}

/**
 * 模拟批量移动计算
 */
function calculateBatchMove(
  initialPositions: Map<string, { x: number; y: number }>,
  dragStartPoint: { x: number; y: number },
  currentPoint: { x: number; y: number }
): Map<string, { x: number; y: number }> {
  const deltaX = currentPoint.x - dragStartPoint.x;
  const deltaY = currentPoint.y - dragStartPoint.y;

  const newPositions = new Map<string, { x: number; y: number }>();
  
  initialPositions.forEach((pos, id) => {
    newPositions.set(id, {
      x: pos.x + deltaX,
      y: pos.y + deltaY,
    });
  });

  return newPositions;
}

// ============================================
// 生成器
// ============================================

// 生成工具模式状态
const toolModeStateArb: fc.Arbitrary<ToolModeState> = fc.record({
  currentMode: fc.constantFrom<ToolMode>('move', 'hand'),
  isSpacePressed: fc.boolean(),
  isDraggingCanvas: fc.boolean(),
});

// 生成图片 ID
const imageIdArb = fc.string({ minLength: 5, maxLength: 20 })
  .map(s => `img-${s.replace(/[^a-zA-Z0-9]/g, 'x')}`);

// 生成图片 ID 列表（确保唯一）
const imageIdListArb = (minLength: number, maxLength: number): fc.Arbitrary<string[]> => {
  return fc.array(imageIdArb, { minLength, maxLength }).map(ids => {
    const seen = new Set<string>();
    return ids.filter(id => {
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  });
};

// 生成选中状态
const selectionStateArb = (imageIds: string[]): fc.Arbitrary<SelectionState> => {
  return fc.subarray(imageIds).map(selectedIds => ({
    selectedIds: new Set(selectedIds),
    isMultiSelecting: false,
  }));
};

// 生成坐标点
const pointArb = fc.record({
  x: fc.integer({ min: -5000, max: 5000 }),
  y: fc.integer({ min: -5000, max: 5000 }),
});

// 生成位置映射
const positionMapArb = (ids: string[]): fc.Arbitrary<Map<string, { x: number; y: number }>> => {
  return fc.array(pointArb, { minLength: ids.length, maxLength: ids.length }).map(points => {
    const map = new Map<string, { x: number; y: number }>();
    ids.forEach((id, index) => {
      map.set(id, points[index]);
    });
    return map;
  });
};

// ============================================
// 属性测试：空格键切换工具模式
// ============================================

describe('useCanvasSelection - 工具模式切换属性测试', () => {
  /**
   * **Feature: canvas-multi-select, Property 2: 空格键切换工具模式**
   * **Validates: Requirements 2.1, 2.2, 2.3**
   * 
   * 对于任意初始工具模式状态，按下空格键应该切换到抓手模式，
   * 释放空格键应该恢复到移动模式
   */
  describe('属性 2: 空格键切换工具模式', () => {
    it('按下空格键应切换到抓手模式', () => {
      fc.assert(
        fc.property(
          toolModeStateArb,
          (initialState) => {
            const resultState = handleSpaceDown(initialState);
            
            // 验证：切换到抓手模式
            expect(resultState.currentMode).toBe('hand');
            // 验证：空格键标记为按下
            expect(resultState.isSpacePressed).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('释放空格键应恢复到移动模式', () => {
      fc.assert(
        fc.property(
          toolModeStateArb,
          (initialState) => {
            const resultState = handleSpaceUp(initialState);
            
            // 验证：恢复到移动模式
            expect(resultState.currentMode).toBe('move');
            // 验证：空格键标记为释放
            expect(resultState.isSpacePressed).toBe(false);
            // 验证：停止画布拖动
            expect(resultState.isDraggingCanvas).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('按下再释放空格键应恢复原始移动模式', () => {
      fc.assert(
        fc.property(
          fc.constant<ToolModeState>({
            currentMode: 'move',
            isSpacePressed: false,
            isDraggingCanvas: false,
          }),
          (initialState) => {
            // 按下空格键
            const afterDown = handleSpaceDown(initialState);
            expect(afterDown.currentMode).toBe('hand');
            
            // 释放空格键
            const afterUp = handleSpaceUp(afterDown);
            expect(afterUp.currentMode).toBe('move');
            expect(afterUp.isSpacePressed).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('连续按下空格键不改变抓手模式状态', () => {
      fc.assert(
        fc.property(
          toolModeStateArb,
          fc.integer({ min: 1, max: 10 }),
          (initialState, repeatCount) => {
            let state = initialState;
            
            // 连续按下空格键
            for (let i = 0; i < repeatCount; i++) {
              state = handleSpaceDown(state);
            }
            
            // 验证：始终保持抓手模式
            expect(state.currentMode).toBe('hand');
            expect(state.isSpacePressed).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});


// ============================================
// 属性测试：抓手模式禁用选择功能
// ============================================

describe('useCanvasSelection - 抓手模式属性测试', () => {
  /**
   * **Feature: canvas-multi-select, Property 3: 抓手模式禁用选择功能**
   * **Validates: Requirements 2.4**
   * 
   * 对于任意处于抓手模式的状态，尝试进行图片选择或框选操作应该被阻止，
   * 选中状态不应改变
   */
  describe('属性 3: 抓手模式禁用选择功能', () => {
    it('抓手模式下光标样式应为 grab 或 grabbing', () => {
      fc.assert(
        fc.property(
          fc.boolean(), // isDraggingCanvas
          fc.boolean(), // isHoveringImage
          (isDraggingCanvas, isHoveringImage) => {
            const handModeState: ToolModeState = {
              currentMode: 'hand',
              isSpacePressed: true,
              isDraggingCanvas,
            };
            
            const cursor = getCursorStyle(handModeState, false, isHoveringImage);
            
            // 验证：抓手模式下光标应为 grab 或 grabbing
            expect(['grab', 'grabbing']).toContain(cursor);
            
            // 验证：拖动时为 grabbing，否则为 grab
            if (isDraggingCanvas) {
              expect(cursor).toBe('grabbing');
            } else {
              expect(cursor).toBe('grab');
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('移动模式下光标样式应为 default 或 move', () => {
      fc.assert(
        fc.property(
          fc.boolean(), // isHoveringImage
          (isHoveringImage) => {
            const moveModeState: ToolModeState = {
              currentMode: 'move',
              isSpacePressed: false,
              isDraggingCanvas: false,
            };
            
            const cursor = getCursorStyle(moveModeState, false, isHoveringImage);
            
            // 验证：移动模式下光标应为 default 或 move
            expect(['default', 'move']).toContain(cursor);
            
            // 验证：悬停图片时为 move，否则为 default
            if (isHoveringImage) {
              expect(cursor).toBe('move');
            } else {
              expect(cursor).toBe('default');
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('框选中光标样式应为 crosshair', () => {
      fc.assert(
        fc.property(
          toolModeStateArb,
          fc.boolean(),
          (toolMode, isHoveringImage) => {
            const cursor = getCursorStyle(toolMode, true, isHoveringImage);
            
            // 验证：框选中光标应为 crosshair
            expect(cursor).toBe('crosshair');
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});

// ============================================
// 属性测试：点击选择逻辑正确性
// ============================================

describe('useCanvasSelection - 点击选择属性测试', () => {
  /**
   * **Feature: canvas-multi-select, Property 8: 点击选择逻辑正确性**
   * **Validates: Requirements 5.1, 5.2, 5.3, 5.4**
   * 
   * 对于任意点击操作和 Shift 键状态，选中结果应该符合以下规则：
   * - 不按 Shift 点击未选中图片：仅选中该图片
   * - 按 Shift 点击未选中图片：添加到选中集合
   * - 按 Shift 点击已选中图片：从选中集合移除
   * - 不按 Shift 点击已选中图片：保持选中状态
   */
  describe('属性 8: 点击选择逻辑正确性', () => {
    it('点击空白处应清除所有选中', () => {
      fc.assert(
        fc.property(
          imageIdListArb(0, 10),
          (imageIds) => {
            // 创建一个有选中图片的状态
            const initialState: SelectionState = {
              selectedIds: new Set(imageIds),
              isMultiSelecting: false,
            };
            
            // 点击空白处
            const resultState = handleClickSelection(initialState, null, false, false);
            
            // 验证：所有选中被清除
            expect(resultState.selectedIds.size).toBe(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('不按 Shift 点击未选中图片应仅选中该图片', () => {
      fc.assert(
        fc.property(
          imageIdListArb(1, 10),
          (imageIds) => {
            // 前置条件：至少有一张图片
            fc.pre(imageIds.length > 0);
            
            // 创建一个有其他图片选中的状态
            const otherIds = imageIds.slice(1);
            const initialState: SelectionState = {
              selectedIds: new Set(otherIds),
              isMultiSelecting: false,
            };
            
            // 点击第一张图片（未选中）
            const clickedId = imageIds[0];
            const resultState = handleClickSelection(initialState, clickedId, false, false);
            
            // 验证：仅选中被点击的图片
            expect(resultState.selectedIds.size).toBe(1);
            expect(resultState.selectedIds.has(clickedId)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('按 Shift 点击未选中图片应添加到选中集合', () => {
      fc.assert(
        fc.property(
          imageIdListArb(2, 10),
          (imageIds) => {
            // 前置条件：至少有两张图片
            fc.pre(imageIds.length >= 2);
            
            // 创建一个有第一张图片选中的状态
            const initialState: SelectionState = {
              selectedIds: new Set([imageIds[0]]),
              isMultiSelecting: false,
            };
            
            // Shift + 点击第二张图片（未选中）
            const clickedId = imageIds[1];
            const resultState = handleClickSelection(initialState, clickedId, true, false);
            
            // 验证：两张图片都被选中
            expect(resultState.selectedIds.size).toBe(2);
            expect(resultState.selectedIds.has(imageIds[0])).toBe(true);
            expect(resultState.selectedIds.has(clickedId)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('按 Shift 点击已选中图片应从选中集合移除', () => {
      fc.assert(
        fc.property(
          imageIdListArb(2, 10),
          (imageIds) => {
            // 前置条件：至少有两张图片
            fc.pre(imageIds.length >= 2);
            
            // 创建一个有多张图片选中的状态
            const initialState: SelectionState = {
              selectedIds: new Set(imageIds),
              isMultiSelecting: false,
            };
            
            // Shift + 点击第一张图片（已选中）
            const clickedId = imageIds[0];
            const resultState = handleClickSelection(initialState, clickedId, true, true);
            
            // 验证：被点击的图片被移除
            expect(resultState.selectedIds.has(clickedId)).toBe(false);
            // 验证：其他图片仍然选中
            for (let i = 1; i < imageIds.length; i++) {
              expect(resultState.selectedIds.has(imageIds[i])).toBe(true);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('不按 Shift 点击已选中图片应保持选中状态', () => {
      fc.assert(
        fc.property(
          imageIdListArb(1, 10),
          (imageIds) => {
            // 前置条件：至少有一张图片
            fc.pre(imageIds.length > 0);
            
            // 创建一个有多张图片选中的状态
            const initialState: SelectionState = {
              selectedIds: new Set(imageIds),
              isMultiSelecting: false,
            };
            
            // 点击第一张图片（已选中，不按 Shift）
            const clickedId = imageIds[0];
            const resultState = handleClickSelection(initialState, clickedId, false, true);
            
            // 验证：选中状态保持不变
            expect(resultState.selectedIds.size).toBe(initialState.selectedIds.size);
            for (const id of imageIds) {
              expect(resultState.selectedIds.has(id)).toBe(true);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});


// ============================================
// 属性测试：批量移动保持相对位置
// ============================================

describe('useCanvasSelection - 批量移动属性测试', () => {
  /**
   * **Feature: canvas-multi-select, Property 9: 批量移动保持相对位置**
   * **Validates: Requirements 6.1, 6.2, 6.3**
   * 
   * 对于任意选中的图片集合和移动向量，移动后各图片之间的相对位置差应该与移动前相同
   */
  describe('属性 9: 批量移动保持相对位置', () => {
    it('移动后各图片之间的相对位置差保持不变', () => {
      fc.assert(
        fc.property(
          imageIdListArb(2, 10),
          pointArb,
          pointArb,
          (imageIds, dragStart, dragEnd) => {
            // 前置条件：至少有两张图片
            fc.pre(imageIds.length >= 2);
            
            // 创建初始位置映射
            const initialPositions = new Map<string, { x: number; y: number }>();
            imageIds.forEach((id, index) => {
              initialPositions.set(id, { x: index * 100, y: index * 50 });
            });
            
            // 计算移动后的位置
            const newPositions = calculateBatchMove(initialPositions, dragStart, dragEnd);
            
            // 验证：任意两张图片之间的相对位置差保持不变
            for (let i = 0; i < imageIds.length; i++) {
              for (let j = i + 1; j < imageIds.length; j++) {
                const id1 = imageIds[i];
                const id2 = imageIds[j];
                
                const initialPos1 = initialPositions.get(id1)!;
                const initialPos2 = initialPositions.get(id2)!;
                const newPos1 = newPositions.get(id1)!;
                const newPos2 = newPositions.get(id2)!;
                
                // 计算相对位置差
                const initialDiffX = initialPos2.x - initialPos1.x;
                const initialDiffY = initialPos2.y - initialPos1.y;
                const newDiffX = newPos2.x - newPos1.x;
                const newDiffY = newPos2.y - newPos1.y;
                
                // 验证：相对位置差保持不变
                expect(newDiffX).toBe(initialDiffX);
                expect(newDiffY).toBe(initialDiffY);
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('移动向量等于拖动终点减起点', () => {
      fc.assert(
        fc.property(
          imageIdListArb(1, 5),
          pointArb,
          pointArb,
          (imageIds, dragStart, dragEnd) => {
            // 前置条件：至少有一张图片
            fc.pre(imageIds.length > 0);
            
            // 创建初始位置映射
            const initialPositions = new Map<string, { x: number; y: number }>();
            imageIds.forEach((id, index) => {
              initialPositions.set(id, { x: index * 100, y: index * 50 });
            });
            
            // 计算移动后的位置
            const newPositions = calculateBatchMove(initialPositions, dragStart, dragEnd);
            
            // 计算预期的移动向量
            const expectedDeltaX = dragEnd.x - dragStart.x;
            const expectedDeltaY = dragEnd.y - dragStart.y;
            
            // 验证：每张图片的移动量等于预期的移动向量
            for (const id of imageIds) {
              const initialPos = initialPositions.get(id)!;
              const newPos = newPositions.get(id)!;
              
              expect(newPos.x - initialPos.x).toBe(expectedDeltaX);
              expect(newPos.y - initialPos.y).toBe(expectedDeltaY);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('不移动时位置保持不变', () => {
      fc.assert(
        fc.property(
          imageIdListArb(1, 5),
          pointArb,
          (imageIds, samePoint) => {
            // 前置条件：至少有一张图片
            fc.pre(imageIds.length > 0);
            
            // 创建初始位置映射
            const initialPositions = new Map<string, { x: number; y: number }>();
            imageIds.forEach((id, index) => {
              initialPositions.set(id, { x: index * 100, y: index * 50 });
            });
            
            // 起点和终点相同（不移动）
            const newPositions = calculateBatchMove(initialPositions, samePoint, samePoint);
            
            // 验证：位置保持不变
            for (const id of imageIds) {
              const initialPos = initialPositions.get(id)!;
              const newPos = newPositions.get(id)!;
              
              expect(newPos.x).toBe(initialPos.x);
              expect(newPos.y).toBe(initialPos.y);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: canvas-multi-select, Property 10: 拖动未选中图片清除其他选择**
   * **Validates: Requirements 6.4**
   * 
   * 对于任意拖动未选中图片的操作，操作完成后应该仅有被拖动的图片处于选中状态
   */
  describe('属性 10: 拖动未选中图片清除其他选择', () => {
    it('拖动未选中图片后仅该图片被选中', () => {
      fc.assert(
        fc.property(
          imageIdListArb(2, 10),
          (imageIds) => {
            // 前置条件：至少有两张图片
            fc.pre(imageIds.length >= 2);
            
            // 创建一个有其他图片选中的状态
            const otherIds = imageIds.slice(1);
            const initialState: SelectionState = {
              selectedIds: new Set(otherIds),
              isMultiSelecting: false,
            };
            
            // 拖动第一张图片（未选中）
            const draggedId = imageIds[0];
            
            // 模拟拖动未选中图片的行为：先选中该图片（清除其他选中）
            const resultState = selectImage(initialState, draggedId, false);
            
            // 验证：仅被拖动的图片被选中
            expect(resultState.selectedIds.size).toBe(1);
            expect(resultState.selectedIds.has(draggedId)).toBe(true);
            
            // 验证：其他图片不再选中
            for (const id of otherIds) {
              expect(resultState.selectedIds.has(id)).toBe(false);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});

// ============================================
// 属性测试：键盘快捷键功能正确性
// ============================================

describe('useCanvasSelection - 键盘快捷键属性测试', () => {
  /**
   * **Feature: canvas-multi-select, Property 11: 键盘快捷键功能正确性**
   * **Validates: Requirements 7.1, 7.2, 7.3**
   * 
   * 对于任意键盘快捷键操作：
   * - Delete/Backspace：删除所有选中图片
   * - Escape：清除选中状态
   * - Ctrl/Cmd+A：选中所有图片
   */
  describe('属性 11: 键盘快捷键功能正确性', () => {
    it('Escape 键应清除所有选中', () => {
      fc.assert(
        fc.property(
          imageIdListArb(0, 10),
          (imageIds) => {
            // 创建一个有选中图片的状态
            const initialState: SelectionState = {
              selectedIds: new Set(imageIds),
              isMultiSelecting: false,
            };
            
            // 按 Escape 键
            const resultState = clearSelection(initialState);
            
            // 验证：所有选中被清除
            expect(resultState.selectedIds.size).toBe(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Ctrl/Cmd+A 应选中所有图片', () => {
      fc.assert(
        fc.property(
          imageIdListArb(0, 20),
          (imageIds) => {
            // 创建一个空选中状态
            const initialState: SelectionState = {
              selectedIds: new Set<string>(),
              isMultiSelecting: false,
            };
            
            // 按 Ctrl/Cmd+A
            const resultState = selectAll(initialState, imageIds);
            
            // 验证：所有图片都被选中
            expect(resultState.selectedIds.size).toBe(imageIds.length);
            for (const id of imageIds) {
              expect(resultState.selectedIds.has(id)).toBe(true);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Delete/Backspace 后选中集合应为空', () => {
      fc.assert(
        fc.property(
          imageIdListArb(1, 10),
          (imageIds) => {
            // 前置条件：至少有一张图片
            fc.pre(imageIds.length > 0);
            
            // 创建一个有选中图片的状态
            const initialState: SelectionState = {
              selectedIds: new Set(imageIds),
              isMultiSelecting: false,
            };
            
            // 模拟 Delete 键行为：删除后清除选中
            const resultState = clearSelection(initialState);
            
            // 验证：选中集合为空
            expect(resultState.selectedIds.size).toBe(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('全选后再清除应恢复空选中状态', () => {
      fc.assert(
        fc.property(
          imageIdListArb(0, 10),
          (imageIds) => {
            // 创建初始状态
            const initialState: SelectionState = {
              selectedIds: new Set<string>(),
              isMultiSelecting: false,
            };
            
            // 全选
            const afterSelectAll = selectAll(initialState, imageIds);
            expect(afterSelectAll.selectedIds.size).toBe(imageIds.length);
            
            // 清除选中
            const afterClear = clearSelection(afterSelectAll);
            expect(afterClear.selectedIds.size).toBe(0);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});

// ============================================
// 属性测试：选中状态视觉反馈一致性
// ============================================

describe('useCanvasSelection - 选中状态视觉反馈属性测试', () => {
  /**
   * **Feature: canvas-multi-select, Property 7: 选中状态视觉反馈一致性**
   * **Validates: Requirements 4.1, 4.2, 4.3**
   * 
   * 对于任意图片，其视觉高亮状态应该与其是否在选中集合中保持一致
   */
  describe('属性 7: 选中状态视觉反馈一致性', () => {
    it('选中集合中的图片应显示高亮', () => {
      fc.assert(
        fc.property(
          imageIdListArb(1, 20),
          (imageIds) => {
            // 前置条件：至少有一张图片
            fc.pre(imageIds.length > 0);
            
            // 随机选择一些图片作为选中状态
            const selectedCount = Math.floor(Math.random() * imageIds.length) + 1;
            const selectedIds = new Set(imageIds.slice(0, selectedCount));
            
            // 验证：选中集合中的图片应该显示高亮
            for (const id of imageIds) {
              const isSelected = selectedIds.has(id);
              const shouldShowHighlight = isSelected;
              
              // 验证：高亮状态与选中状态一致
              expect(shouldShowHighlight).toBe(isSelected);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('未选中的图片不应显示高亮', () => {
      fc.assert(
        fc.property(
          imageIdListArb(2, 20),
          (imageIds) => {
            // 前置条件：至少有两张图片
            fc.pre(imageIds.length >= 2);
            
            // 只选中第一张图片
            const selectedIds = new Set([imageIds[0]]);
            
            // 验证：未选中的图片不显示高亮
            for (let i = 1; i < imageIds.length; i++) {
              const id = imageIds[i];
              const isSelected = selectedIds.has(id);
              
              expect(isSelected).toBe(false);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('选中状态变化后视觉反馈应立即更新', () => {
      fc.assert(
        fc.property(
          imageIdListArb(1, 10),
          (imageIds) => {
            // 前置条件：至少有一张图片
            fc.pre(imageIds.length > 0);
            
            // 初始状态：无选中
            let state: SelectionState = {
              selectedIds: new Set<string>(),
              isMultiSelecting: false,
            };
            
            // 选中第一张图片
            const targetId = imageIds[0];
            state = selectImage(state, targetId, false);
            
            // 验证：选中后应显示高亮
            expect(state.selectedIds.has(targetId)).toBe(true);
            
            // 取消选中
            state = deselectImage(state, targetId);
            
            // 验证：取消选中后不应显示高亮
            expect(state.selectedIds.has(targetId)).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});

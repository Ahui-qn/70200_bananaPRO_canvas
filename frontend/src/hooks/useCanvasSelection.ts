/**
 * useCanvasSelection Hook
 * 管理画布多选功能的状态和操作
 * 
 * 需求: 1.1-1.4, 2.1-2.4, 3.1-3.5, 4.1-4.4, 5.1-5.4, 6.1-6.4, 7.1-7.3
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { CanvasImage } from '../../../shared/types';

// ============================================
// 类型定义
// ============================================

/**
 * 工具模式类型
 * - move: 移动工具（默认），用于选择和移动图片
 * - hand: 抓手工具，用于拖动画布
 */
export type ToolMode = 'move' | 'hand';

/**
 * 工具模式状态
 */
export interface ToolModeState {
  currentMode: ToolMode;           // 当前工具模式
  isSpacePressed: boolean;         // 空格键是否按下
  isDraggingCanvas: boolean;       // 是否正在拖动画布
}

/**
 * 选中状态
 */
export interface SelectionState {
  selectedIds: Set<string>;        // 选中的图片 ID 集合
  isMultiSelecting: boolean;       // 是否正在框选
}

/**
 * 选区框状态
 */
export interface SelectionBoxState {
  isActive: boolean;               // 选区框是否激活
  startPoint: { x: number; y: number } | null;  // 起始点（画布坐标）
  endPoint: { x: number; y: number } | null;    // 结束点（画布坐标）
}

/**
 * 选区框矩形（标准化后）
 */
export interface SelectionRect {
  x: number;      // 左上角 x
  y: number;      // 左上角 y
  width: number;  // 宽度
  height: number; // 高度
}

/**
 * 批量移动状态
 */
export interface BatchMoveState {
  isDragging: boolean;             // 是否正在拖动
  dragStartPoint: { x: number; y: number } | null;  // 拖动起始点（画布坐标）
  initialPositions: Map<string, { x: number; y: number }>;  // 初始位置
}

/**
 * 光标样式映射
 */
export const cursorStyles: Record<string, string> = {
  'move-default': 'default',           // 移动工具默认
  'move-hover': 'move',                // 移动工具悬停图片
  'hand-default': 'grab',              // 抓手工具默认
  'hand-dragging': 'grabbing',         // 抓手工具拖动中
  'selecting': 'crosshair',            // 框选中
};

// ============================================
// 选中操作接口
// ============================================

export interface SelectionActions {
  selectImage: (id: string, addToSelection?: boolean) => void;
  deselectImage: (id: string) => void;
  selectAll: (imageIds: string[]) => void;
  clearSelection: () => void;
  toggleSelection: (id: string) => void;
  setSelectedIds: (ids: Set<string>) => void;
}

// ============================================
// Hook 返回类型
// ============================================

export interface UseCanvasSelectionReturn {
  // 工具模式状态
  toolMode: ToolModeState;
  setToolMode: (mode: ToolMode) => void;
  
  // 选中状态
  selection: SelectionState;
  selectionActions: SelectionActions;
  
  // 选区框状态
  selectionBox: SelectionBoxState;
  startSelectionBox: (point: { x: number; y: number }) => void;
  updateSelectionBox: (point: { x: number; y: number }) => void;
  endSelectionBox: () => SelectionRect | null;
  
  // 批量移动状态
  batchMove: BatchMoveState;
  startBatchMove: (startPoint: { x: number; y: number }) => void;
  updateBatchMove: (currentPoint: { x: number; y: number }) => { id: string; x: number; y: number }[];
  endBatchMove: () => void;
  
  // 光标样式
  getCursorStyle: (isHoveringImage?: boolean) => string;
  
  // 键盘事件处理
  handleKeyDown: (e: KeyboardEvent, images: CanvasImage[], onDeleteImages?: (ids: string[]) => void) => void;
  handleKeyUp: (e: KeyboardEvent) => void;
}

// ============================================
// Hook 实现
// ============================================

export function useCanvasSelection(): UseCanvasSelectionReturn {
  // 工具模式状态
  const [toolModeState, setToolModeState] = useState<ToolModeState>({
    currentMode: 'move',
    isSpacePressed: false,
    isDraggingCanvas: false,
  });

  // 选中状态
  const [selectionState, setSelectionState] = useState<SelectionState>({
    selectedIds: new Set<string>(),
    isMultiSelecting: false,
  });

  // 选区框状态
  const [selectionBoxState, setSelectionBoxState] = useState<SelectionBoxState>({
    isActive: false,
    startPoint: null,
    endPoint: null,
  });

  // 批量移动状态
  const [batchMoveState, setBatchMoveState] = useState<BatchMoveState>({
    isDragging: false,
    dragStartPoint: null,
    initialPositions: new Map(),
  });

  // ============================================
  // 工具模式操作
  // ============================================

  /**
   * 设置工具模式
   */
  const setToolMode = useCallback((mode: ToolMode) => {
    setToolModeState(prev => ({
      ...prev,
      currentMode: mode,
    }));
  }, []);

  /**
   * 处理空格键按下 - 切换到抓手模式
   * 需求: 2.1, 2.2, 2.3
   */
  const handleSpaceDown = useCallback(() => {
    setToolModeState(prev => ({
      ...prev,
      currentMode: 'hand',
      isSpacePressed: true,
    }));
  }, []);

  /**
   * 处理空格键释放 - 恢复到移动模式
   * 需求: 2.2, 2.3
   */
  const handleSpaceUp = useCallback(() => {
    setToolModeState(prev => ({
      ...prev,
      currentMode: 'move',
      isSpacePressed: false,
      isDraggingCanvas: false,
    }));
  }, []);

  // ============================================
  // 选中操作
  // ============================================

  /**
   * 选中图片
   * 需求: 5.1, 5.2
   */
  const selectImage = useCallback((id: string, addToSelection: boolean = false) => {
    setSelectionState(prev => {
      const newSelectedIds = new Set(addToSelection ? prev.selectedIds : []);
      newSelectedIds.add(id);
      return {
        ...prev,
        selectedIds: newSelectedIds,
      };
    });
  }, []);

  /**
   * 取消选中图片
   * 需求: 5.3
   */
  const deselectImage = useCallback((id: string) => {
    setSelectionState(prev => {
      const newSelectedIds = new Set(prev.selectedIds);
      newSelectedIds.delete(id);
      return {
        ...prev,
        selectedIds: newSelectedIds,
      };
    });
  }, []);

  /**
   * 全选
   * 需求: 7.3
   */
  const selectAll = useCallback((imageIds: string[]) => {
    setSelectionState(prev => ({
      ...prev,
      selectedIds: new Set(imageIds),
    }));
  }, []);

  /**
   * 清除选中
   * 需求: 4.4, 7.2
   */
  const clearSelection = useCallback(() => {
    setSelectionState(prev => ({
      ...prev,
      selectedIds: new Set<string>(),
    }));
  }, []);

  /**
   * 切换选中状态
   * 需求: 5.2, 5.3
   */
  const toggleSelection = useCallback((id: string) => {
    setSelectionState(prev => {
      const newSelectedIds = new Set(prev.selectedIds);
      if (newSelectedIds.has(id)) {
        newSelectedIds.delete(id);
      } else {
        newSelectedIds.add(id);
      }
      return {
        ...prev,
        selectedIds: newSelectedIds,
      };
    });
  }, []);

  /**
   * 设置选中 ID 集合
   */
  const setSelectedIds = useCallback((ids: Set<string>) => {
    setSelectionState(prev => ({
      ...prev,
      selectedIds: ids,
    }));
  }, []);

  // ============================================
  // 选区框操作
  // ============================================

  /**
   * 开始框选
   * 需求: 3.1
   */
  const startSelectionBox = useCallback((point: { x: number; y: number }) => {
    // 抓手模式下禁用框选（需求 2.4）
    if (toolModeState.currentMode === 'hand') {
      return;
    }

    setSelectionBoxState({
      isActive: true,
      startPoint: point,
      endPoint: point,
    });
    setSelectionState(prev => ({
      ...prev,
      isMultiSelecting: true,
    }));
  }, [toolModeState.currentMode]);

  /**
   * 更新选区框
   * 需求: 3.2
   */
  const updateSelectionBox = useCallback((point: { x: number; y: number }) => {
    setSelectionBoxState(prev => {
      if (!prev.isActive) return prev;
      return {
        ...prev,
        endPoint: point,
      };
    });
  }, []);

  /**
   * 结束框选，返回标准化的选区框矩形
   * 需求: 3.4
   */
  const endSelectionBox = useCallback((): SelectionRect | null => {
    const { startPoint, endPoint, isActive } = selectionBoxState;
    
    if (!isActive || !startPoint || !endPoint) {
      setSelectionBoxState({
        isActive: false,
        startPoint: null,
        endPoint: null,
      });
      setSelectionState(prev => ({
        ...prev,
        isMultiSelecting: false,
      }));
      return null;
    }

    // 计算标准化的矩形（处理四象限）
    const rect: SelectionRect = {
      x: Math.min(startPoint.x, endPoint.x),
      y: Math.min(startPoint.y, endPoint.y),
      width: Math.abs(endPoint.x - startPoint.x),
      height: Math.abs(endPoint.y - startPoint.y),
    };

    // 重置选区框状态
    setSelectionBoxState({
      isActive: false,
      startPoint: null,
      endPoint: null,
    });
    setSelectionState(prev => ({
      ...prev,
      isMultiSelecting: false,
    }));

    return rect;
  }, [selectionBoxState]);

  // ============================================
  // 批量移动操作
  // ============================================

  /**
   * 开始批量移动
   * 需求: 6.1
   */
  const startBatchMove = useCallback((startPoint: { x: number; y: number }) => {
    setBatchMoveState({
      isDragging: true,
      dragStartPoint: startPoint,
      initialPositions: new Map(),
    });
  }, []);

  /**
   * 更新批量移动，返回所有选中图片的新位置
   * 需求: 6.2
   */
  const updateBatchMove = useCallback((currentPoint: { x: number; y: number }): { id: string; x: number; y: number }[] => {
    const { dragStartPoint, initialPositions } = batchMoveState;
    
    if (!dragStartPoint) return [];

    const deltaX = currentPoint.x - dragStartPoint.x;
    const deltaY = currentPoint.y - dragStartPoint.y;

    const newPositions: { id: string; x: number; y: number }[] = [];
    
    initialPositions.forEach((pos, id) => {
      newPositions.push({
        id,
        x: pos.x + deltaX,
        y: pos.y + deltaY,
      });
    });

    return newPositions;
  }, [batchMoveState]);

  /**
   * 结束批量移动
   * 需求: 6.3
   */
  const endBatchMove = useCallback(() => {
    setBatchMoveState({
      isDragging: false,
      dragStartPoint: null,
      initialPositions: new Map(),
    });
  }, []);

  // ============================================
  // 光标样式
  // ============================================

  /**
   * 获取当前光标样式
   * 需求: 1.1, 1.2, 1.3, 1.4
   */
  const getCursorStyle = useCallback((isHoveringImage: boolean = false): string => {
    const { currentMode, isDraggingCanvas } = toolModeState;
    const { isMultiSelecting } = selectionState;

    // 框选中
    if (isMultiSelecting) {
      return cursorStyles['selecting'];
    }

    // 抓手模式
    if (currentMode === 'hand') {
      return isDraggingCanvas ? cursorStyles['hand-dragging'] : cursorStyles['hand-default'];
    }

    // 移动模式
    return isHoveringImage ? cursorStyles['move-hover'] : cursorStyles['move-default'];
  }, [toolModeState, selectionState]);

  // ============================================
  // 键盘事件处理
  // ============================================

  /**
   * 处理键盘按下事件
   * 需求: 2.1, 7.1, 7.2, 7.3
   */
  const handleKeyDown = useCallback((
    e: KeyboardEvent,
    images: CanvasImage[],
    onDeleteImages?: (ids: string[]) => void
  ) => {
    // 空格键 - 切换到抓手模式
    if (e.code === 'Space' && !e.repeat) {
      e.preventDefault();
      handleSpaceDown();
      return;
    }

    // Delete/Backspace - 删除选中图片（需求 7.1）
    if ((e.code === 'Delete' || e.code === 'Backspace') && selectionState.selectedIds.size > 0) {
      e.preventDefault();
      if (onDeleteImages) {
        onDeleteImages(Array.from(selectionState.selectedIds));
      }
      clearSelection();
      return;
    }

    // Escape - 清除选中（需求 7.2）
    if (e.code === 'Escape') {
      e.preventDefault();
      clearSelection();
      return;
    }

    // Ctrl/Cmd + A - 全选（需求 7.3）
    if ((e.ctrlKey || e.metaKey) && e.code === 'KeyA') {
      e.preventDefault();
      const allImageIds = images.map(img => img.id);
      selectAll(allImageIds);
      return;
    }
  }, [handleSpaceDown, selectionState.selectedIds, clearSelection, selectAll]);

  /**
   * 处理键盘释放事件
   * 需求: 2.2
   */
  const handleKeyUp = useCallback((e: KeyboardEvent) => {
    // 空格键释放 - 恢复到移动模式
    if (e.code === 'Space') {
      e.preventDefault();
      handleSpaceUp();
    }
  }, [handleSpaceUp]);

  // ============================================
  // 返回值
  // ============================================

  return {
    // 工具模式状态
    toolMode: toolModeState,
    setToolMode,
    
    // 选中状态
    selection: selectionState,
    selectionActions: {
      selectImage,
      deselectImage,
      selectAll,
      clearSelection,
      toggleSelection,
      setSelectedIds,
    },
    
    // 选区框状态
    selectionBox: selectionBoxState,
    startSelectionBox,
    updateSelectionBox,
    endSelectionBox,
    
    // 批量移动状态
    batchMove: batchMoveState,
    startBatchMove,
    updateBatchMove,
    endBatchMove,
    
    // 光标样式
    getCursorStyle,
    
    // 键盘事件处理
    handleKeyDown,
    handleKeyUp,
  };
}

export default useCanvasSelection;

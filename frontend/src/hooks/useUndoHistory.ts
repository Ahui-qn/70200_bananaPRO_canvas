/**
 * useUndoHistory Hook
 * 管理画布操作的撤回和重做功能
 * 
 * 简化版本：只支持删除操作的撤回，不支持移动操作的撤回
 * 撤回时恢复图片到原来的画布位置
 * 无 UI，无 Toast 提示，只通过键盘快捷键控制
 */

import { useState, useCallback, useRef } from 'react';
import {
  UndoAction,
  DeleteActionData,
  BatchDeleteActionData,
  CanvasImage,
  Position,
} from '../../../shared/types';
import { apiService } from '../services/api';

// 最大历史记录数量
const MAX_HISTORY_SIZE = 50;

/**
 * 生成唯一 ID
 */
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * 扩展的删除操作数据（包含位置信息）
 */
interface DeleteActionDataWithPosition extends DeleteActionData {
  position: Position;  // 删除前的位置
}

/**
 * 扩展的批量删除操作数据（包含位置信息）
 */
interface BatchDeleteActionDataWithPosition {
  images: DeleteActionDataWithPosition[];
}

/**
 * useUndoHistory Hook 返回类型
 */
export interface UseUndoHistoryReturn {
  // 状态
  canUndo: boolean;              // 是否可以撤回
  canRedo: boolean;              // 是否可以重做
  undoCount: number;             // 可撤回操作数量
  redoCount: number;             // 可重做操作数量
  isProcessing: boolean;         // 是否正在处理撤回/重做
  
  // 操作记录方法（只保留删除操作）
  recordDeleteAction: (imageId: string, imageData: CanvasImage, position: Position) => void;
  recordBatchDeleteAction: (images: Array<{ imageId: string; imageData: CanvasImage; position: Position }>) => void;
  
  // 撤回/重做方法
  undo: () => Promise<UndoResult>;
  redo: () => Promise<UndoResult>;
  
  // 清空历史
  clearHistory: () => void;
}

/**
 * 撤回/重做操作结果
 */
export interface UndoResult {
  success: boolean;
  action?: UndoAction;
  error?: string;
  skipped?: boolean;             // 是否跳过（如图片已被永久删除）
}

/**
 * useUndoHistory Hook 配置
 */
export interface UseUndoHistoryConfig {
  // 撤回删除操作时的回调（用于更新本地状态，包含位置信息）
  onRestoreImage?: (imageData: CanvasImage, position: Position) => void;
  // 重做删除操作时的回调
  onDeleteImage?: (imageId: string) => void;
  // 刷新图片列表的回调
  onRefreshImages?: () => Promise<void>;
}

/**
 * useUndoHistory Hook
 * 管理画布操作的撤回和重做功能
 * 简化版本：只支持删除操作，无 UI，无 Toast
 */
export function useUndoHistory(config: UseUndoHistoryConfig = {}): UseUndoHistoryReturn {
  const {
    onRestoreImage,
    onDeleteImage,
    onRefreshImages,
  } = config;

  // 撤回栈和重做栈
  const [undoStack, setUndoStack] = useState<UndoAction[]>([]);
  const [redoStack, setRedoStack] = useState<UndoAction[]>([]);
  
  // 是否正在处理撤回/重做（防止并发）
  const [isProcessing, setIsProcessing] = useState(false);
  
  // 使用 ref 追踪最新的栈状态（用于异步操作）
  const undoStackRef = useRef(undoStack);
  const redoStackRef = useRef(redoStack);
  
  // 同步 ref
  undoStackRef.current = undoStack;
  redoStackRef.current = redoStack;

  // 计算状态
  const canUndo = undoStack.length > 0;
  const canRedo = redoStack.length > 0;
  const undoCount = undoStack.length;
  const redoCount = redoStack.length;

  /**
   * 添加操作到撤回栈
   * 限制最大数量为 50 条
   * 清空重做栈
   */
  const addToUndoStack = useCallback((action: UndoAction) => {
    setUndoStack(prev => {
      const newStack = [...prev, action];
      // 超出最大数量时删除最早的记录
      if (newStack.length > MAX_HISTORY_SIZE) {
        return newStack.slice(newStack.length - MAX_HISTORY_SIZE);
      }
      return newStack;
    });
    // 清空重做栈
    setRedoStack([]);
  }, []);

  /**
   * 记录删除操作（包含位置信息）
   */
  const recordDeleteAction = useCallback((imageId: string, imageData: CanvasImage, position: Position) => {
    const action: UndoAction = {
      id: generateId(),
      type: 'delete',
      timestamp: Date.now(),
      data: {
        imageId,
        imageData,
        position,  // 保存删除前的位置
      } as DeleteActionDataWithPosition,
    };
    addToUndoStack(action);
  }, [addToUndoStack]);

  /**
   * 记录批量删除操作（包含位置信息）
   */
  const recordBatchDeleteAction = useCallback((
    images: Array<{ imageId: string; imageData: CanvasImage; position: Position }>
  ) => {
    if (images.length === 0) return;
    
    // 如果只有一张图片，使用单个删除操作
    if (images.length === 1) {
      recordDeleteAction(images[0].imageId, images[0].imageData, images[0].position);
      return;
    }
    
    const action: UndoAction = {
      id: generateId(),
      type: 'batch_delete',
      timestamp: Date.now(),
      data: {
        images: images.map(({ imageId, imageData, position }) => ({
          imageId,
          imageData,
          position,
        })),
      } as BatchDeleteActionDataWithPosition,
    };
    addToUndoStack(action);
  }, [addToUndoStack, recordDeleteAction]);

  /**
   * 执行撤回删除操作
   * 恢复图片到原来的位置
   */
  const executeUndoDelete = async (data: DeleteActionDataWithPosition): Promise<{ success: boolean; skipped?: boolean; error?: string }> => {
    try {
      // 调用 API 恢复图片
      const response = await apiService.restoreImage(data.imageId);
      
      if (response.success) {
        // 更新本地状态，传入位置信息
        onRestoreImage?.(data.imageData, data.position);
        // 刷新图片列表
        await onRefreshImages?.();
        return { success: true };
      } else {
        // API 返回失败
        const error = response.error || '恢复图片失败';
        console.error('撤回删除失败:', error);
        return { success: false, error };
      }
    } catch (error: any) {
      // 检查是否是 404 错误（图片已被永久删除）
      if (error.status === 404 || error.message?.includes('404')) {
        console.warn('该图片已被永久删除，无法恢复');
        return { success: false, skipped: true, error: '图片已被永久删除' };
      }
      
      const errorMsg = error.message || '恢复图片失败';
      console.error('撤回删除失败:', errorMsg);
      return { success: false, error: errorMsg };
    }
  };

  /**
   * 执行重做删除操作
   */
  const executeRedoDelete = async (data: DeleteActionDataWithPosition): Promise<{ success: boolean; error?: string }> => {
    try {
      // 调用 API 删除图片
      const response = await apiService.deleteImage(data.imageId);
      
      if (response.success) {
        // 更新本地状态
        onDeleteImage?.(data.imageId);
        // 刷新图片列表
        await onRefreshImages?.();
        return { success: true };
      } else {
        const error = response.error || '删除图片失败';
        console.error('重做删除失败:', error);
        return { success: false, error };
      }
    } catch (error: any) {
      const errorMsg = error.message || '删除图片失败';
      console.error('重做删除失败:', errorMsg);
      return { success: false, error: errorMsg };
    }
  };

  /**
   * 撤回操作
   * 只支持删除操作的撤回
   */
  const undo = useCallback(async (): Promise<UndoResult> => {
    // 检查是否可以撤回
    if (!canUndo || isProcessing) {
      return { success: false, error: '无法撤回' };
    }

    setIsProcessing(true);
    
    try {
      // 获取最近的操作
      const currentStack = undoStackRef.current;
      const action = currentStack[currentStack.length - 1];
      
      if (!action) {
        return { success: false, error: '没有可撤回的操作' };
      }

      let result: { success: boolean; skipped?: boolean; error?: string };

      // 根据操作类型执行撤回（只支持删除操作）
      switch (action.type) {
        case 'delete': {
          result = await executeUndoDelete(action.data as DeleteActionDataWithPosition);
          break;
        }
        case 'batch_delete': {
          const batchData = action.data as BatchDeleteActionDataWithPosition;
          // 批量恢复所有图片
          let allSuccess = true;
          let anySkipped = false;
          for (const item of batchData.images) {
            const itemResult = await executeUndoDelete(item);
            if (!itemResult.success) {
              if (itemResult.skipped) {
                anySkipped = true;
              } else {
                allSuccess = false;
              }
            }
          }
          result = { success: allSuccess, skipped: anySkipped };
          break;
        }
        default:
          // 不支持的操作类型，跳过
          result = { success: false, skipped: true, error: '不支持的操作类型' };
      }

      // 如果成功或被跳过，更新栈
      if (result.success || result.skipped) {
        setUndoStack(prev => prev.slice(0, -1));
        // 只有成功时才添加到重做栈（跳过的不添加）
        if (result.success) {
          setRedoStack(prev => [...prev, action]);
        }
      }

      return {
        success: result.success,
        action,
        error: result.error,
        skipped: result.skipped,
      };
    } finally {
      setIsProcessing(false);
    }
  }, [canUndo, isProcessing]);

  /**
   * 重做操作
   * 只支持删除操作的重做
   */
  const redo = useCallback(async (): Promise<UndoResult> => {
    // 检查是否可以重做
    if (!canRedo || isProcessing) {
      return { success: false, error: '无法重做' };
    }

    setIsProcessing(true);
    
    try {
      // 获取最近撤回的操作
      const currentStack = redoStackRef.current;
      const action = currentStack[currentStack.length - 1];
      
      if (!action) {
        return { success: false, error: '没有可重做的操作' };
      }

      let result: { success: boolean; error?: string };

      // 根据操作类型执行重做（只支持删除操作）
      switch (action.type) {
        case 'delete': {
          result = await executeRedoDelete(action.data as DeleteActionDataWithPosition);
          break;
        }
        case 'batch_delete': {
          const batchData = action.data as BatchDeleteActionDataWithPosition;
          // 批量删除所有图片
          let allSuccess = true;
          for (const item of batchData.images) {
            const itemResult = await executeRedoDelete(item);
            if (!itemResult.success) {
              allSuccess = false;
            }
          }
          result = { success: allSuccess };
          break;
        }
        default:
          // 不支持的操作类型
          result = { success: false, error: '不支持的操作类型' };
      }

      // 如果成功，更新栈
      if (result.success) {
        setRedoStack(prev => prev.slice(0, -1));
        setUndoStack(prev => [...prev, action]);
      }

      return {
        success: result.success,
        action,
        error: result.error,
      };
    } finally {
      setIsProcessing(false);
    }
  }, [canRedo, isProcessing]);

  /**
   * 清空历史
   */
  const clearHistory = useCallback(() => {
    setUndoStack([]);
    setRedoStack([]);
  }, []);

  return {
    // 状态
    canUndo,
    canRedo,
    undoCount,
    redoCount,
    isProcessing,
    
    // 操作记录方法（只保留删除操作）
    recordDeleteAction,
    recordBatchDeleteAction,
    
    // 撤回/重做方法
    undo,
    redo,
    
    // 清空历史
    clearHistory,
  };
}

export default useUndoHistory;

# 实现计划：画布撤回/重做功能

## 概述

本实现计划将画布撤回/重做功能分解为可执行的编码任务。采用增量开发方式，先实现核心 Hook，再集成到 UI，最后添加测试。

## 任务

- [x] 1. 创建操作类型定义和 useUndoHistory Hook
  - [x] 1.1 在 shared/types.ts 中添加撤回操作相关类型定义
    - 添加 UndoActionType、DeleteActionData、MoveActionData 等类型
    - 添加 UndoAction 和 UndoHistoryState 接口
    - _需求: 1.1, 1.2, 1.3_

  - [x] 1.2 创建 useUndoHistory Hook 基础结构
    - 创建 frontend/src/hooks/useUndoHistory.ts
    - 实现 undoStack 和 redoStack 状态管理
    - 实现 canUndo、canRedo、isProcessing 状态
    - 实现 MAX_HISTORY_SIZE 限制（50 条）
    - _需求: 1.4, 2.5, 3.5_

  - [x] 1.3 编写 useUndoHistory Hook 属性测试
    - **Property 1: 撤回栈大小限制**
    - **验证: 需求 1.4**

- [x] 2. 实现操作记录功能
  - [x] 2.1 实现 recordDeleteAction 方法
    - 记录单张图片删除操作
    - 保存完整的图片数据用于恢复
    - 清空重做栈
    - _需求: 1.1, 3.6_

  - [x] 2.2 实现 recordMoveAction 方法
    - 记录单张图片移动操作
    - 保存原始位置和新位置
    - 清空重做栈
    - _需求: 1.2, 3.6_

  - [x] 2.3 实现 recordBatchDeleteAction 和 recordBatchMoveAction 方法
    - 将批量操作记录为单个操作
    - _需求: 1.3_

  - [x] 2.4 编写操作记录属性测试
    - **Property 2: 删除操作记录完整性**
    - **Property 3: 移动操作记录完整性**
    - **Property 4: 批量操作原子性**
    - **Property 7: 新操作清空重做栈**
    - **验证: 需求 1.1, 1.2, 1.3, 3.6**

- [x] 3. 实现撤回功能
  - [x] 3.1 实现 undo 方法核心逻辑
    - 从 undoStack 弹出最近操作
    - 根据操作类型执行对应的撤回逻辑
    - 将操作添加到 redoStack
    - 使用 isProcessing 防止并发
    - _需求: 2.1, 2.3, 2.4, 6.2_

  - [x] 3.2 实现撤回删除操作
    - 调用 /api/trash/images/:id/restore API 恢复图片
    - 更新本地图片状态
    - 处理 API 失败情况
    - _需求: 2.3, 5.1, 5.3_

  - [x] 3.3 实现撤回移动操作
    - 调用 /api/images/:id/canvas-position API 更新位置
    - 更新本地图片位置状态
    - _需求: 2.4, 5.2_

  - [x] 3.4 编写撤回功能属性测试
    - **Property 5: 撤回-重做栈转移**
    - **Property 9: 空栈状态一致性**
    - **Property 10: 位置恢复准确性**
    - **验证: 需求 2.1, 2.3, 2.4, 2.5**

- [x] 4. 实现重做功能
  - [x] 4.1 实现 redo 方法核心逻辑
    - 从 redoStack 弹出最近操作
    - 根据操作类型执行对应的重做逻辑
    - 将操作添加到 undoStack
    - _需求: 3.1, 3.3, 3.4_

  - [x] 4.2 实现重做删除操作
    - 调用 /api/images/:id 删除 API
    - 更新本地图片状态
    - _需求: 3.3, 5.4_

  - [x] 4.3 实现重做移动操作
    - 调用位置更新 API
    - 更新本地图片位置
    - _需求: 3.4_

  - [x] 4.4 编写重做功能属性测试
    - **Property 6: 重做-撤回栈转移**
    - **Property 8: 撤回-重做往返一致性**
    - **验证: 需求 3.1, 3.3, 3.4**

- [x] 5. 检查点 - 确保所有测试通过
  - 运行所有属性测试和单元测试
  - 如有问题请询问用户

- [x] 6. 集成到 CanvasApp
  - [x] 6.1 在 CanvasApp 中引入 useUndoHistory Hook
    - 导入并初始化 Hook
    - 传递必要的回调函数（loadProjectImages、updateImagePosition 等）
    - _需求: 2.1, 3.1_

  - [x] 6.2 修改 handleDeleteImage 函数
    - 在删除前记录操作到撤回栈
    - 支持批量删除时记录为单个操作
    - _需求: 1.1, 1.3_

  - [x] 6.3 修改图片拖拽结束逻辑
    - 在 handleMouseUp 中记录移动操作
    - 支持批量移动时记录为单个操作
    - _需求: 1.2, 1.3_

  - [x] 6.4 实现项目切换时清空历史
    - 监听 currentProject 变化
    - 调用 clearHistory 清空操作历史
    - _需求: 5.5_

- [x] 7. 实现用户界面
  - [x] 7.1 在 CanvasDialogBar 中添加撤回/重做按钮
    - 添加 Undo2 和 Redo2 图标按钮
    - 根据 canUndo/canRedo 状态控制按钮启用/禁用
    - 添加 tooltip 提示
    - _需求: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7_

  - [x] 7.2 实现键盘快捷键
    - 监听 Ctrl+Z / Cmd+Z 触发撤回
    - 监听 Ctrl+Shift+Z / Cmd+Shift+Z 触发重做
    - 监听 Ctrl+Y 触发重做（Windows）
    - 避免与输入框冲突
    - _需求: 2.1, 3.1_

  - [x] 7.3 编写 UI 集成测试
    - 测试按钮状态与栈状态同步
    - 测试快捷键触发
    - _需求: 4.2, 4.3, 4.4, 4.5_

- [x] 8. 实现边界情况处理
  - [x] 8.1 处理图片已被永久删除的情况
    - 捕获 API 404 错误
    - 显示提示信息
    - 从撤回栈中移除该操作
    - _需求: 6.3_

  - [x] 8.2 处理 API 调用失败
    - 显示错误 Toast
    - 保持当前状态不变
    - 不修改操作历史栈
    - _需求: 5.3_

  - [x] 8.3 编写边界情况测试
    - 测试 API 失败时的状态保持
    - 测试快速连续操作
    - _需求: 5.3, 6.2_

- [x] 9. 最终检查点 - 确保所有测试通过
  - 运行完整测试套件
  - 验证所有需求已实现
  - 如有问题请询问用户

## 备注

- 所有任务都是必须完成的，包括测试任务
- 每个任务都引用了具体的需求以便追溯
- 检查点用于确保增量验证
- 属性测试验证核心正确性属性

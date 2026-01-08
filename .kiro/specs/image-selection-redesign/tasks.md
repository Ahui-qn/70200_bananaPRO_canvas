# 实现计划：图片选中状态重新设计

## 概述

重构 CanvasImageLayer 组件，实现新的图片选中状态 UI，包括四角 L 形指示器、聚焦动画、以及重新布局的像素标签和操作工具栏。

## 任务

- [x] 1. 创建核心工具函数和类型定义
  - [x] 1.1 添加图片类型判断函数和颜色映射常量
    - 在 CanvasImageLayer.tsx 中添加 `getImageType` 函数
    - 定义 `CORNER_COLORS` 颜色映射常量
    - 定义 `ANIMATION_CONFIG` 动画配置常量
    - _Requirements: 1.1, 1.2, 1.3_

  - [x] 1.2 编写图片类型颜色映射属性测试
    - **Property 1: 图片类型颜色映射一致性**
    - **Validates: Requirements 1.1, 1.2, 1.3**

- [x] 2. 实现 SelectionCorners 组件
  - [x] 2.1 创建四角 L 形指示器组件
    - 使用 CSS 伪元素实现 L 形角落
    - 根据图片类型应用对应颜色
    - 支持 isSelected 和 isDragging 状态
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

  - [x] 2.2 实现聚焦动画效果
    - 添加 CSS keyframes 动画（focus-in, focus-out）
    - 使用 transform 和 opacity 实现 GPU 加速
    - 动画时长 250ms，ease-out 缓动
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 6.1_

  - [x] 2.3 编写选中状态显示属性测试
    - **Property 2: 选中状态与 UI 元素显示同步**
    - **Validates: Requirements 1.5, 3.1, 3.4, 4.1, 4.4**

- [x] 3. 实现 DimensionBadge 组件
  - [x] 3.1 创建像素尺寸标签组件
    - 位于图片上方左侧
    - 显示格式 "宽度 × 高度"
    - 半透明深色背景，浅色文字
    - 支持 isVisible 和 isDragging 状态控制显示
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

  - [x] 3.2 编写尺寸格式化属性测试
    - **Property 4: 尺寸格式化一致性**
    - **Validates: Requirements 3.2**

- [x] 4. 实现 ActionToolbar 组件
  - [x] 4.1 创建操作工具栏组件
    - 位于图片上方右侧
    - 水平排列按钮
    - 包含编辑、重新生成、参考图、收藏、下载、分享、删除按钮
    - 支持 isVisible 和 isDragging 状态控制显示
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

  - [x] 4.2 实现重新生成按钮条件显示逻辑
    - 编辑过的图片（model='edited'）不显示重新生成按钮
    - 上传的图片（model='uploaded'）不显示重新生成按钮
    - _Requirements: 4.6_

  - [x] 4.3 编写重新生成按钮显示属性测试
    - **Property 5: 重新生成按钮显示逻辑**
    - **Validates: Requirements 4.6**

- [x] 5. 重构 CanvasImageItem 组件
  - [x] 5.1 集成新组件到 CanvasImageItem
    - 移除现有的选中边框样式（ring-2 ring-violet-500）
    - 移除现有的尺寸标签和操作按钮
    - 集成 SelectionCorners、DimensionBadge、ActionToolbar 组件
    - _Requirements: 1.1-1.5, 3.1-3.5, 4.1-4.6_

  - [x] 5.2 实现拖拽状态 UI 简化
    - 拖拽时隐藏 DimensionBadge 和 ActionToolbar
    - 拖拽时保持 SelectionCorners 显示
    - 使用平滑过渡效果
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

  - [x] 5.3 编写拖拽状态 UI 属性测试
    - **Property 3: 拖拽状态 UI 简化**
    - **Validates: Requirements 3.5, 4.5, 5.1, 5.2**

- [x] 6. 性能优化
  - [x] 6.1 确保视口外图片不渲染选中 UI
    - 检查 visibleImages 逻辑
    - 视口外的选中图片不渲染 SelectionCorners、DimensionBadge、ActionToolbar
    - _Requirements: 6.5_

  - [x] 6.2 编写视口外图片属性测试
    - **Property 6: 视口外图片不渲染选中 UI**
    - **Validates: Requirements 6.5**

- [x] 7. 添加 CSS 动画样式
  - [x] 7.1 在 index.css 中添加聚焦动画关键帧
    - 添加 focus-in 和 focus-out keyframes
    - 添加 selection-corner 相关样式类
    - 添加 will-change 优化
    - _Requirements: 2.1-2.5, 6.1, 6.4_

- [x] 8. 检查点 - 确保所有测试通过
  - 运行所有属性测试和单元测试
  - 验证动画效果流畅
  - 如有问题请询问用户

## 备注

- 每个任务都引用了具体的需求以便追溯
- 属性测试验证核心正确性属性
- 检查点确保增量验证

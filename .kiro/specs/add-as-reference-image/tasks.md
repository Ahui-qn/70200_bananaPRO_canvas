# 实现计划

- [x] 1. 添加"添加为参考图"按钮到 CanvasImageItem 组件



  - [x] 1.1 在 CanvasImageItem 组件中添加 onAddAsReference 回调属性


    - 修改 CanvasImageItem 的 props 接口，添加可选的 onAddAsReference 回调
    - _Requirements: 1.1_

  - [x] 1.2 在操作按钮组中添加"添加为参考图"按钮


    - 使用 ImagePlus 图标（来自 lucide-react）
    - 按钮样式与现有操作按钮保持一致
    - 按钮位置在重新生成按钮的左边（最左侧）
    - _Requirements: 1.1, 1.4_

  - [x] 1.3 实现按钮可见性逻辑


    - 生成中状态（isGenerating）时隐藏按钮
    - 失败状态（isFailed）时隐藏按钮
    - 正常状态（有有效 url）时显示按钮
    - _Requirements: 1.2, 1.3_

  - [x] 1.4 编写属性测试：按钮可见性状态


    - **Property 1: 按钮可见性状态**
    - **Validates: Requirements 1.2, 1.3**

- [x] 2. 更新 CanvasImageLayer 组件传递回调



  - [x] 2.1 在 CanvasImageLayerProps 中添加 onAddAsReferenceImage 属性


    - 类型为 `(image: CanvasImage) => void`
    - _Requirements: 2.1_

  - [x] 2.2 将回调传递给 CanvasImageItem 子组件


    - 在渲染 CanvasImageItem 时传递 onAddAsReference 回调
    - _Requirements: 2.1_

- [x] 3. 在 CanvasApp 中实现添加为参考图逻辑



  - [x] 3.1 创建 handleAddAsReferenceImage 函数


    - 将图片 URL 转换为 UploadedImage 格式
    - 添加到 settings.refImages 列表
    - _Requirements: 2.1_

  - [x] 3.2 实现参考图数量限制检查

    - 检查当前参考图数量是否达到上限（4张）
    - 达到上限时显示提示并返回
    - _Requirements: 2.3_

  - [x] 3.3 实现重复图片检测

    - 检查图片 URL 是否已存在于参考图列表
    - 重复时显示提示并返回
    - _Requirements: 3.3_

  - [x] 3.4 添加成功/失败提示反馈

    - 添加成功后显示短暂提示
    - 添加失败时显示错误提示
    - _Requirements: 3.1, 3.2_

  - [x] 3.5 编写属性测试：添加参考图格式正确性


    - **Property 2: 添加参考图格式正确性**
    - **Validates: Requirements 2.1**

  - [x] 3.6 编写属性测试：重复图片检测

    - **Property 3: 重复图片检测**
    - **Validates: Requirements 3.3**

- [x] 4. 集成添加为参考图功能



  - [x] 4.1 在 CanvasApp 中将 handleAddAsReferenceImage 传递给 CanvasImageLayer


    - 在渲染 CanvasImageLayer 时添加 onAddAsReferenceImage 属性
    - _Requirements: 1.1, 2.1_

- [x] 5. 实现参考图拖拽排序功能



  - [x] 5.1 在 CanvasDialogBar 中为参考图预览添加拖拽功能


    - 为每个参考图预览元素添加 draggable="true"
    - 实现 onDragStart 记录拖拽开始的索引
    - _Requirements: 4.1_

  - [x] 5.2 实现拖拽过程中的视觉反馈

    - 实现 onDragOver 处理拖拽经过时的样式变化
    - 显示插入位置指示器
    - _Requirements: 4.4_

  - [x] 5.3 实现拖拽放置和列表重排序

    - 实现 onDrop 处理放置事件
    - 创建 reorderRefImages 函数重新排列列表
    - 调用 onRefImagesChange 更新状态
    - _Requirements: 4.2, 4.3_

  - [x] 5.4 编写属性测试：拖拽排序保持元素

    - **Property 4: 拖拽排序保持元素**
    - **Validates: Requirements 4.2**

  - [x] 5.5 编写属性测试：拖拽排序位置正确性

    - **Property 5: 拖拽排序位置正确性**
    - **Validates: Requirements 4.2**

- [x] 6. 最终检查点 - 确保所有测试通过



  - 确保所有测试通过，如有问题请询问用户。

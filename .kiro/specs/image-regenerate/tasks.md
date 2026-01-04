# 实现计划

- [x] 1. 添加重新生成按钮到 CanvasImageItem 组件

  - [x] 1.1 在 CanvasImageItem 组件中添加 onRegenerate 回调属性


    - 修改 CanvasImageItem 的 props 接口，添加可选的 onRegenerate 回调


    - _Requirements: 1.1_
  - [x] 1.2 在操作按钮组中添加重新生成按钮

    - 使用 RefreshCw 图标（来自 lucide-react）


    - 按钮样式与现有操作按钮（收藏、下载、分享、删除）保持一致
    - 按钮位置在收藏按钮之前（最左侧）
    - _Requirements: 1.1, 1.4_

  - [x] 1.3 实现按钮可见性逻辑

    - 生成中状态（isGenerating）时隐藏按钮
    - 失败状态（isFailed）时显示按钮
    - 正常状态时显示按钮

    - _Requirements: 1.2, 1.3_


  - [x] 1.4 编写属性测试：按钮可见性状态




    - **Property 1: 按钮可见性状态**
    - **Validates: Requirements 1.2, 1.3**



- [x] 2. 更新 CanvasImageLayer 组件传递回调



  - [x] 2.1 在 CanvasImageLayerProps 中添加 onRegenerateImage 属性

    - 类型为 `(image: CanvasImage) => void`

    - _Requirements: 2.1_
  - [x] 2.2 将回调传递给 CanvasImageItem 子组件

    - 在渲染 CanvasImageItem 时传递 onRegenerate 回调
    - _Requirements: 2.1_


- [x] 3. 在 CanvasApp 中实现参数回填逻辑

  - [x] 3.1 创建 handleRegenerateImage 函数

    - 提取图片的 prompt、model、aspectRatio、imageSize 参数
    - 更新 settings 状态
    - _Requirements: 2.1, 2.2, 2.3, 2.4_
  - [x] 3.2 实现生成中状态检查

    - 如果 isGenerating 为 true，显示提示并返回
    - _Requirements: 4.1_


  - [x] 3.3 实现参考图恢复逻辑

    - 从图片的 refImages 字段提取参考图信息
    - 将 URL 转换为 UploadedImage 格式
    - 追加到现有参考图列表（如果需要替换则清空后添加）


    - _Requirements: 2.5, 4.2_

  - [x] 3.4 添加成功提示反馈

    - 参数填充成功后显示短暂提示



    - 使生成对话框输入框获得焦点

    - _Requirements: 3.1, 3.2_

  - [x] 3.5 添加错误处理

    - 参考图加载失败时显示提示
    - _Requirements: 3.3_
  - [x] 3.6 编写属性测试：参数填充完整性


    - **Property 2: 参数填充完整性**
    - **Validates: Requirements 2.1, 2.2, 2.3, 2.4**
  - [x] 3.7 编写属性测试：生成中状态阻止填充

    - **Property 3: 生成中状态阻止填充**
    - **Validates: Requirements 4.1**

  - [x] 3.8 编写属性测试：参数替换一致性

    - **Property 4: 参数替换一致性**
    - **Validates: Requirements 4.3**

- [x] 4. 集成和连接

  - [x] 4.1 在 CanvasApp 中将 handleRegenerateImage 传递给 CanvasImageLayer

    - 在渲染 CanvasImageLayer 时添加 onRegenerateImage 属性
    - _Requirements: 1.1, 2.1_
  - [x] 4.2 添加 Toast 提示状态管理


    - 添加 toast 状态用于显示操作反馈
    - 实现自动消失逻辑
    - _Requirements: 3.2, 3.3, 4.1_

- [x] 5. 最终检查点 - 确保所有测试通过



  - 确保所有测试通过，如有问题请询问用户。

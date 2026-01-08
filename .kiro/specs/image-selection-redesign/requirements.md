# 需求文档

## 简介

重新设计画布图片的选中状态 UI，通过四角聚焦动画和颜色编码来区分不同类型的图片（生成的、编辑过的、上传的），同时优化信息展示布局，将像素信息和操作按钮分离到图片外部，提升视觉美观度和用户体验。

## 术语表

- **Canvas_Image_Layer**: 画布图片层组件，负责渲染和管理画布上的所有图片
- **Selection_Corner**: 选中状态的四角指示器，用于显示图片被选中
- **Focus_Animation**: 聚焦动画，选中时四角从外向内聚焦的过渡效果
- **Image_Type**: 图片类型，包括生成的（generated）、编辑过的（edited）、上传的（uploaded）
- **Dimension_Badge**: 像素尺寸标签，显示图片的宽高信息
- **Action_Toolbar**: 操作工具栏，包含重新生成、分享、编辑等功能按钮
- **Dragging_State**: 拖拽状态，图片正在被拖动时的状态

## 需求

### 需求 1：四角选中指示器

**用户故事：** 作为用户，我希望通过四角的颜色来区分不同类型的图片，以便快速识别图片来源。

#### 验收标准

1. WHEN 用户选中一张生成的图片 THEN Selection_Corner SHALL 显示纯白色的四角指示器
2. WHEN 用户选中一张编辑过的图片（model='edited'）THEN Selection_Corner SHALL 显示黄色的四角指示器
3. WHEN 用户选中一张上传的图片（model='uploaded'）THEN Selection_Corner SHALL 显示蓝色的四角指示器
4. THE Selection_Corner SHALL 仅在图片四个角落显示 L 形状的线条，不包围整个图片边框
5. WHEN 图片未被选中 THEN Selection_Corner SHALL 不显示

### 需求 2：选中聚焦动画

**用户故事：** 作为用户，我希望选中图片时有流畅的聚焦动画，以获得更好的视觉反馈。

#### 验收标准

1. WHEN 用户点击选中一张图片 THEN Focus_Animation SHALL 播放从外向内的聚焦动画
2. THE Focus_Animation SHALL 包含透明度从 0 到 100% 的渐变效果
3. THE Focus_Animation SHALL 包含四角从较大尺寸收缩到最终位置的缩放效果
4. THE Focus_Animation SHALL 在 200-300ms 内完成，确保流畅但不拖沓
5. WHEN 图片取消选中 THEN Focus_Animation SHALL 播放反向动画（从内向外淡出）

### 需求 3：像素尺寸标签位置

**用户故事：** 作为用户，我希望像素信息显示在图片上方左侧，不遮挡图片内容。

#### 验收标准

1. WHEN 图片被选中 THEN Dimension_Badge SHALL 显示在图片上方左侧位置
2. THE Dimension_Badge SHALL 显示格式为 "宽度 × 高度"（如 "1024 × 768"）
3. THE Dimension_Badge SHALL 使用半透明深色背景和浅色文字，确保可读性
4. WHEN 图片未被选中 THEN Dimension_Badge SHALL 隐藏
5. WHEN 图片正在拖拽 THEN Dimension_Badge SHALL 隐藏以减少视觉干扰

### 需求 4：操作工具栏位置

**用户故事：** 作为用户，我希望操作按钮显示在图片上方右侧，方便快速访问且不遮挡图片。

#### 验收标准

1. WHEN 图片被选中 THEN Action_Toolbar SHALL 显示在图片上方右侧
2. THE Action_Toolbar SHALL 包含重新生成、分享、编辑、下载、删除等功能按钮
3. THE Action_Toolbar SHALL 使用水平排列的按钮布局
4. WHEN 图片未被选中 THEN Action_Toolbar SHALL 隐藏
5. WHEN 图片正在拖拽 THEN Action_Toolbar SHALL 隐藏以减少视觉干扰
6. IF 图片类型为 edited 或 uploaded THEN Action_Toolbar SHALL 不显示重新生成按钮

### 需求 5：拖拽状态优化

**用户故事：** 作为用户，我希望拖拽图片时界面保持简洁，只显示必要的选中指示。

#### 验收标准

1. WHEN 图片开始拖拽 THEN Canvas_Image_Layer SHALL 隐藏 Dimension_Badge 和 Action_Toolbar
2. WHILE 图片正在拖拽 THEN Selection_Corner SHALL 保持显示，提供位置参考
3. WHEN 图片拖拽结束 THEN Canvas_Image_Layer SHALL 恢复显示 Dimension_Badge 和 Action_Toolbar
4. THE 拖拽状态切换 SHALL 使用平滑过渡，避免突兀的显示/隐藏

### 需求 6：性能优化

**用户故事：** 作为用户，我希望选中动画和 UI 更新不影响画布的流畅性。

#### 验收标准

1. THE Focus_Animation SHALL 使用 CSS transform 和 opacity 属性，利用 GPU 加速
2. THE Selection_Corner SHALL 使用 CSS 实现，避免额外的 DOM 元素
3. WHEN 多张图片同时被选中 THEN Canvas_Image_Layer SHALL 保持 60fps 的渲染性能
4. THE 动画 SHALL 使用 will-change 属性进行优化提示，但在动画结束后移除
5. WHEN 视口外的图片被选中 THEN Canvas_Image_Layer SHALL 不渲染其选中 UI，节省资源

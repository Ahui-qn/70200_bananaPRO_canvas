# 实现计划

- [x] 1. 后端：创建图片尺寸服务
  - [x] 1.1 安装 sharp 依赖并创建 ImageDimensionService
    - 创建 `backend/src/services/imageDimensionService.ts`
    - 实现 `getDimensions(buffer)` 方法从 Buffer 提取宽高
    - 实现 `generateThumbnail(buffer)` 方法生成缩略图（较长边 400px）
    - 实现 `processImageFromUrl(url)` 方法下载图片并返回尺寸和缩略图
    - _Requirements: 1.1, 5.1, 5.2_
  - [x] 1.2 编写属性测试：尺寸提取准确性
    - **Property 1: 尺寸提取准确性**
    - **Validates: Requirements 1.1**
  - [x] 1.3 编写属性测试：缩略图尺寸正确性
    - **Property 7: 缩略图尺寸正确性**
    - **Validates: Requirements 5.2**

- [x] 2. 后端：更新数据库 Schema
  - [x] 2.1 添加 width 和 height 字段到 images 表
    - 更新 `backend/src/database-schema.sql`
    - 添加 `width INT UNSIGNED` 和 `height INT UNSIGNED` 字段
    - _Requirements: 1.2_

- [x] 3. 后端：修改图片保存流程
  - [x] 3.1 更新 generate.ts 路由集成尺寸服务
    - 修改 `backend/src/routes/generate.ts` 的 `/:taskId/save` 接口
    - 下载图片后调用 `imageDimensionService.processImageFromUrl`
    - 提取尺寸并生成缩略图
    - 上传缩略图到 OSS
    - 保存 width、height、thumbnail_url 到数据库
    - _Requirements: 1.1, 1.2, 5.1, 5.3_
  - [x] 3.2 更新 aliOssService 支持上传缩略图
    - 添加 `uploadThumbnail(buffer, originalKey)` 方法
    - 缩略图使用 `thumb/` 前缀存储
    - _Requirements: 5.1_
  - [x] 3.3 编写属性测试：尺寸持久化一致性
    - **Property 2: 尺寸持久化一致性**
    - **Validates: Requirements 1.2**
  - [x] 3.4 编写属性测试：缩略图持久化
    - **Property 8: 缩略图持久化**
    - **Validates: Requirements 5.3**

- [x] 4. Checkpoint - 确保所有测试通过
  - 确保所有测试通过，如有问题请询问用户。

- [x] 5. 前端：更新图片加载策略
  - [x] 5.1 修改 imageLoadingManager 支持缩略图/原图切换
    - 更新 `frontend/src/services/imageLoadingManager.ts`
    - 添加 `getImageUrl(image, scale)` 方法
    - 实现缩放比例阈值判断（0.5）
    - 添加内存缓存 Map
    - 实现防抖切换逻辑（300ms）
    - _Requirements: 3.1, 3.2, 3.3_
  - [x] 5.2 编写属性测试：缩放比例与图片源选择
    - **Property 4: 缩放比例与图片源选择**
    - **Validates: Requirements 3.1, 3.2, 3.3**

- [x] 6. 前端：更新画布图片渲染
  - [x] 6.1 修改 CanvasImageLayer 使用实际尺寸
    - 更新 `frontend/src/components/CanvasImageLayer.tsx`
    - 使用数据库返回的 width/height 渲染图片
    - 当 width/height 为空时回退到预设尺寸
    - 根据缩放比例选择 thumbnailUrl 或 url
    - _Requirements: 1.3, 2.1, 3.1_
  - [x] 6.2 更新 useCanvasImages Hook 处理尺寸数据
    - 确保从 API 返回的图片数据包含 width、height、thumbnailUrl
    - _Requirements: 1.3_

- [x] 7. 前端：实现双击放大功能
  - [x] 7.1 在 CanvasApp 中添加双击放大逻辑
    - 添加 zoomState 状态管理
    - 实现双击图片放大到视口 80%
    - 实现再次双击或 ESC 恢复
    - 使用 300ms 平滑动画
    - _Requirements: 6.1, 6.2, 6.3, 6.4_
  - [x] 7.2 编写属性测试：双击放大恢复一致性
    - **Property 9: 双击放大恢复一致性**
    - **Validates: Requirements 6.3**

- [x] 8. Checkpoint - 确保所有测试通过
  - 确保所有测试通过，如有问题请询问用户。

- [x] 9. 历史数据迁移脚本
  - [x] 9.1 创建批量更新历史图片尺寸的脚本
    - 创建 `backend/src/scripts/update-image-dimensions.ts`
    - 查询所有 width/height 为空的图片
    - 下载图片并提取尺寸
    - 生成缩略图并上传
    - 更新数据库记录
    - _Requirements: 2.2_

- [x] 10. Final Checkpoint - 确保所有测试通过
  - 确保所有测试通过，如有问题请询问用户。


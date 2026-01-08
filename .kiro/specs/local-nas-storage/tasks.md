# 实现计划：本地 NAS 存储 + SQLite 双模式支持

## 概述

实现双模式运行支持：本地模式（NAS + SQLite）和云端模式（OSS + MySQL），通过配置文件切换。

## 任务

- [x] 1. 创建本地存储服务
  - [x] 1.1 创建 `localStorageService.ts` 基础结构
    - 实现 StorageInterface 接口（与 aliOssService 相同的方法签名）
    - 初始化方法读取 LOCAL_STORAGE_PATH 和 LOCAL_SERVER_URL 配置
    - _需求: 1.1, 3.4_

  - [x] 1.2 实现图片保存功能
    - 实现 `uploadFromUrl` 方法：下载图片并保存到本地
    - 实现 `uploadFromBuffer` 方法：从 Buffer 保存图片
    - 按日期创建子目录（年/月/日）
    - 自动创建不存在的目录
    - _需求: 1.1, 1.2, 1.5_

  - [x] 1.3 实现缩略图生成和保存
    - 使用 sharp 库生成缩略图（WebP 格式，较长边 400px）
    - 实现 `uploadThumbnail` 方法
    - 缩略图与原图存储在同一目录，文件名添加 `_thumb` 后缀
    - _需求: 1.3_

  - [x] 1.4 实现文件删除功能
    - 实现 `deleteObject` 方法：同时删除原图和缩略图
    - 实现 `deleteObjects` 方法：批量删除
    - _需求: 1.4_

  - [x] 1.5 编写本地存储服务单元测试
    - 测试文件保存和读取
    - 测试目录自动创建
    - 测试缩略图生成
    - 测试文件删除

- [x] 2. 创建静态文件服务路由
  - [x] 2.1 创建 `backend/src/routes/staticImages.ts` 路由文件
    - GET `/api/static-images/*` 返回图片文件
    - 支持原图和缩略图路径
    - _需求: 2.1_

  - [x] 2.2 实现目录穿越防护
    - 验证请求路径不包含 `..` 等穿越字符
    - 确保解析后的路径在 basePath 下
    - 攻击请求返回 403 错误
    - _需求: 2.5_

  - [x] 2.3 实现缓存头和 MIME 类型
    - 设置 Cache-Control: public, max-age=31536000, immutable
    - 根据文件扩展名设置正确的 Content-Type
    - 支持 jpg、png、webp 格式
    - _需求: 2.2, 2.4_

  - [x] 2.4 实现 404 错误处理
    - 文件不存在时返回 404
    - 返回友好的错误信息
    - _需求: 2.3_

  - [x] 2.5 编写静态文件服务单元测试
    - 测试正常文件访问
    - 测试目录穿越防护
    - 测试 404 错误处理

- [x] 3. 创建存储管理器
  - [x] 3.1 创建 `storageManager.ts`
    - 根据 STORAGE_MODE 环境变量选择存储服务
    - 提供统一的存储接口
    - 导出单例实例
    - _需求: 3.1, 3.2, 3.4_

  - [x] 3.2 修改现有代码使用存储管理器
    - 修改 `generate.ts` 使用 storageManager 替代 aliOssService
    - 修改其他使用 aliOssService 的地方（如 trashService）
    - _需求: 3.3_

- [x] 4. 检查点 - 存储功能测试
  - 确保本地存储和 OSS 存储都能正常工作
  - 测试模式切换
  - 确保所有测试通过，如有问题请询问用户

- [x] 5. 实现 SQLite 数据库支持
  - [x] 5.1 安装 SQLite 依赖
    - 安装 better-sqlite3
    - 安装 @types/better-sqlite3
    - 更新 package.json
    - _需求: 4.1_

  - [x] 5.2 创建 SQLite 数据库服务
    - 创建 `sqliteService.ts`
    - 实现与 MySQL databaseService 相同的接口方法
    - 数据库文件存储在 `./data/database.sqlite`
    - _需求: 4.1, 4.4, 4.6_

  - [x] 5.3 实现 SQLite 表结构初始化
    - 创建与 MySQL 相同的表结构（images、users、projects、user_configs 等）
    - 首次启动时自动创建表
    - 自动创建数据库文件和 data 目录
    - _需求: 4.3, 4.5_

  - [x] 5.4 实现数据库模式切换
    - 创建 `databaseManager.ts` 根据 DATABASE_MODE 环境变量选择数据库
    - 修改 server.ts 使用 databaseManager 初始化数据库
    - _需求: 4.1, 4.2_

  - [x] 5.5 编写 SQLite 服务单元测试
    - 测试表结构创建
    - 测试 CRUD 操作
    - 测试与 MySQL 结果一致性

- [x] 6. 更新配置管理
  - [x] 6.1 更新 `.env.example` 文件
    - 添加 STORAGE_MODE（oss | local）
    - 添加 LOCAL_STORAGE_PATH、LOCAL_SERVER_URL
    - 添加 DATABASE_MODE（mysql | sqlite）
    - 添加 SQLITE_PATH
    - 添加配置说明注释
    - _需求: 5.1_

  - [x] 6.2 实现配置验证和默认值
    - 在 server.ts 启动时验证配置有效性
    - 缺失配置使用默认值（STORAGE_MODE=oss, DATABASE_MODE=mysql）
    - 输出当前运行模式日志
    - _需求: 5.2, 5.3_

  - [x] 6.3 更新服务器监听配置
    - 支持 HOST=0.0.0.0 监听所有接口
    - 确保局域网可访问
    - _需求: 6.1, 6.2_

- [x] 7. 集成和注册路由
  - [x] 7.1 在 server.ts 中注册静态图片路由
    - 仅在 STORAGE_MODE=local 时注册 staticImages 路由
    - 确保路由优先级正确

  - [x] 7.2 更新服务初始化逻辑
    - 根据配置初始化对应的存储服务
    - 根据配置初始化对应的数据库服务
    - 输出初始化状态日志

- [x] 8. 最终检查点
  - 确保所有测试通过（除预先存在的 sharp mock 问题外）
  - 测试本地模式完整流程：生成图片 → 保存 → 访问 → 删除
  - 测试云端模式仍然正常工作
  - 测试模式切换
  - 如有问题请询问用户

## 备注

- 所有任务都是必需的，包括测试任务
- 每个任务都引用了具体的需求编号以便追溯
- 检查点用于确保增量验证
- sharp 库已在项目中安装，可直接使用

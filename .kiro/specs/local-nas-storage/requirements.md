# 需求文档

## 简介

为系统增加本地 NAS 存储和 SQLite 数据库支持，实现**双模式运行**：
- **本地模式**：使用本地 NAS 存储 + SQLite 数据库，适合开发测试和局域网内部使用（20 人规模）
- **云端模式**：保留现有阿里云 OSS + MySQL 数据库方案，适合正式上线部署

两种模式通过配置文件切换，代码层面完全兼容。

## 术语表

- **Local_Storage_Service**: 本地存储服务，负责图片的读写操作
- **Static_File_Server**: 静态文件服务器，提供图片访问 API
- **Storage_Manager**: 存储管理器，根据配置选择使用 OSS 或本地存储
- **SQLite_Service**: SQLite 数据库服务，替代云数据库

## 需求

### 需求 1：本地文件存储

**用户故事：** 作为系统管理员，我希望将生成的图片存储到本地 NAS，这样可以避免云存储的流量费用。

#### 验收标准

1. WHEN 系统生成新图片 THEN Local_Storage_Service SHALL 将图片保存到配置的 NAS 目录
2. WHEN 保存图片时 THEN Local_Storage_Service SHALL 按日期创建子目录（年/月/日）
3. WHEN 保存图片时 THEN Local_Storage_Service SHALL 同时生成并保存缩略图
4. WHEN 删除图片时 THEN Local_Storage_Service SHALL 同时删除原图和缩略图
5. WHEN NAS 目录不存在时 THEN Local_Storage_Service SHALL 自动创建目录结构

### 需求 2：静态文件服务

**用户故事：** 作为用户，我希望能够通过浏览器访问存储在 NAS 上的图片。

#### 验收标准

1. WHEN 请求图片 URL THEN Static_File_Server SHALL 返回对应的图片文件
2. WHEN 请求图片时 THEN Static_File_Server SHALL 设置适当的缓存头（Cache-Control）
3. WHEN 请求不存在的图片时 THEN Static_File_Server SHALL 返回 404 错误
4. WHEN 请求图片时 THEN Static_File_Server SHALL 支持常见图片格式（jpg、png、webp）
5. WHEN 请求路径包含目录穿越字符（如 ../）THEN Static_File_Server SHALL 返回 403 错误并拒绝访问

### 需求 3：存储模式切换

**用户故事：** 作为系统管理员，我希望能够通过配置在 OSS 和本地存储之间切换。

#### 验收标准

1. WHEN 配置 STORAGE_MODE=local THEN Storage_Manager SHALL 使用本地存储服务
2. WHEN 配置 STORAGE_MODE=oss THEN Storage_Manager SHALL 使用阿里云 OSS 服务
3. WHEN 切换存储模式时 THEN Storage_Manager SHALL 不影响已存储的图片访问
4. THE Storage_Manager SHALL 提供统一的存储接口，对上层代码透明

### 需求 4：SQLite 数据库支持

**用户故事：** 作为系统管理员，我希望使用本地 SQLite 数据库，这样不需要依赖云数据库。

#### 验收标准

1. WHEN 配置 DATABASE_MODE=sqlite THEN SQLite_Service SHALL 使用本地 SQLite 文件
2. WHEN 配置 DATABASE_MODE=mysql THEN SQLite_Service SHALL 使用云 MySQL 数据库
3. WHEN 首次启动且使用 SQLite THEN SQLite_Service SHALL 自动创建数据库表结构
4. THE SQLite_Service SHALL 支持与 MySQL 相同的所有数据操作
5. WHEN SQLite 文件不存在时 THEN SQLite_Service SHALL 自动创建数据库文件
6. THE SQLite 数据库文件 SHALL 存储在本地 SSD（./data/目录），不存储在 NAS 上

### 需求 5：配置管理

**用户故事：** 作为系统管理员，我希望通过 .env 文件配置存储和数据库模式。

#### 验收标准

1. THE System SHALL 支持以下配置项：STORAGE_MODE、LOCAL_STORAGE_PATH、DATABASE_MODE、SQLITE_PATH
2. WHEN 配置缺失时 THEN System SHALL 使用合理的默认值
3. WHEN 启动时 THEN System SHALL 验证配置的有效性并输出当前模式

### 需求 6：局域网访问

**用户故事：** 作为用户，我希望能够通过局域网访问运行在同事电脑上的服务。

#### 验收标准

1. WHEN 配置 HOST=0.0.0.0 THEN Server SHALL 监听所有网络接口
2. THE Server SHALL 支持同时 20 个用户并发访问
3. WHEN 用户访问时 THEN Server SHALL 返回正确的图片 URL（使用服务器 IP）

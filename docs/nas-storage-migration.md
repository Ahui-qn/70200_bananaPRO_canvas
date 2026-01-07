# NAS 本地存储迁移方案

## 概述

将图片存储从阿里云 OSS 迁移到公司内部 NAS，通过本地电脑作为服务器提供图片访问服务。

## 当前架构

```
用户浏览器 → 阿里云 OSS（公网）→ 图片
           ↘ 后端服务器 → 阿里云数据库
```

## 目标架构

```
用户浏览器 → 本地后端服务器 → NAS 存储（局域网）
                          ↘ 本地数据库（SQLite/PostgreSQL）
```

## 改造范围

### 后端改造（主要工作）

1. **新建本地存储服务** `backend/src/services/localStorageService.ts`
   - 替代 `aliOssService.ts`
   - 实现相同的接口：`uploadFromUrl`、`uploadFromBuffer`、`uploadThumbnail`、`deleteObject` 等
   - 图片保存到 NAS 挂载目录

2. **添加静态文件服务路由** `backend/src/routes/images.ts`
   - 提供图片访问 API：`GET /api/images/:path`
   - 支持缓存头设置
   - 支持范围请求（可选）

3. **数据库迁移**（可选）
   - 从阿里云 PostgreSQL 迁移到本地 SQLite 或本地 PostgreSQL
   - 修改 `databaseService.ts` 支持 SQLite

4. **配置更新**
   - 添加 NAS 挂载路径配置
   - 添加本地服务器 IP 配置

### 前端改造（几乎不需要）

- 图片 URL 会从 `https://xxx.oss.aliyuncs.com/...` 变为 `http://192.168.x.x:3000/api/images/...`
- 由后端返回，前端无需修改

## 实现步骤

### 第一阶段：本地存储服务（约 2-3 小时）

1. 创建 `localStorageService.ts`
2. 实现图片上传到本地目录
3. 实现缩略图生成和保存
4. 添加图片访问路由

### 第二阶段：数据库迁移（约 1-2 小时，可选）

1. 安装 SQLite 依赖
2. 修改数据库服务支持 SQLite
3. 编写数据迁移脚本

### 第三阶段：配置和部署（约 1 小时）

1. 配置 NAS 挂载路径
2. 配置服务器监听地址（0.0.0.0）
3. 配置防火墙允许访问
4. 测试局域网访问

## 配置示例

```env
# .env 文件新增配置

# 存储模式：oss | local
STORAGE_MODE=local

# 本地存储配置
LOCAL_STORAGE_PATH=/Volumes/NAS/nano-banana/images
LOCAL_SERVER_HOST=0.0.0.0
LOCAL_SERVER_PORT=3000

# 数据库模式：postgres | sqlite
DATABASE_MODE=sqlite
SQLITE_PATH=/Volumes/NAS/nano-banana/database.sqlite
```

## 目录结构

```
/Volumes/NAS/nano-banana/
├── images/
│   ├── 2024/
│   │   ├── 01/
│   │   │   ├── 02/
│   │   │   │   ├── 1704182400000_abc123.jpg      # 原图
│   │   │   │   └── 1704182400000_abc123_thumb.webp  # 缩略图
│   │   │   └── ...
│   │   └── ...
│   └── ...
└── database.sqlite  # SQLite 数据库文件
```

## 注意事项

### 网络配置

1. **服务器电脑**
   - 需要固定 IP 或使用主机名
   - 防火墙开放 3000 端口
   - 保持开机状态

2. **NAS 配置**
   - 确保 NAS 已挂载到服务器电脑
   - 建议使用 SMB 或 NFS 协议挂载
   - 确保有读写权限

3. **客户端访问**
   - 所有用户需在同一局域网
   - 或配置 VPN 访问

### 数据迁移

如果需要保留现有 OSS 上的图片：

1. 编写迁移脚本下载所有 OSS 图片到 NAS
2. 更新数据库中的图片 URL
3. 或者保持双存储模式，新图片存本地，旧图片仍从 OSS 读取

### 备份策略

1. NAS 应配置 RAID 或定期备份
2. 数据库文件定期备份
3. 建议每周全量备份一次

## 风险评估

| 风险 | 影响 | 缓解措施 |
|-----|-----|---------|
| 服务器电脑关机 | 服务不可用 | 设置自动开机、UPS 电源 |
| NAS 故障 | 数据丢失 | RAID + 定期备份 |
| 网络故障 | 服务不可用 | 检查网络稳定性 |
| 并发访问 | 性能下降 | 20 人规模通常没问题 |

## 回滚方案

如果本地方案出现问题，可以快速回滚：

1. 修改 `.env` 中 `STORAGE_MODE=oss`
2. 重启服务器
3. 服务恢复使用 OSS

## 预估工时

- 本地存储服务：2-3 小时
- 数据库迁移（可选）：1-2 小时
- 配置部署：1 小时
- 测试验证：1 小时

**总计：约 5-7 小时**（不含数据迁移）

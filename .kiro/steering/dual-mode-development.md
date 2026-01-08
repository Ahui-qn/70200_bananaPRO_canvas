# 双模式开发规范

## 概述

本项目支持两种运行模式，所有功能开发和 bug 修复都必须确保两种模式都能正常运行：

1. **云端模式（Cloud Mode）**
   - 存储：阿里云 OSS
   - 数据库：MySQL（阿里云 RDS）
   - 适用场景：生产环境、多用户协作

2. **本地模式（Local Mode）**
   - 存储：本地 NAS/文件系统
   - 数据库：SQLite
   - 适用场景：开发环境、局域网使用、离线场景

## 自动重启服务规范

修改代码后，根据修改类型决定是否需要重启服务：

### 热更新（无需重启）

以下修改 Vite 会自动热更新，无需手动重启：
- 修改 `frontend/src/**/*.tsx` 或 `frontend/src/**/*.ts` 组件文件
- 修改 CSS/样式文件

### 需要冷启动重启的情况

以下修改需要重启服务才能生效：

**后端（必须重启）：**
- 修改 `backend/src/**/*.ts` 文件
- 修改 `backend/.env` 配置文件
- 修改 `shared/types.ts` 类型定义

**前端（需要重启）：**
- 修改 `frontend/vite.config.ts` 配置
- 修改 `frontend/index.html`
- 安装新的 npm 包

### 重启流程

1. **先检查是否有正在运行的进程**：使用 `listProcesses` 工具查看当前运行的后台进程

2. **判断是否需要重启**：
   - 如果是热更新类型的修改，无需重启，Vite 会自动处理
   - 如果是冷启动类型的修改，需要重启

3. **执行重启**（仅在需要冷启动时）：
   - 先用 `controlBashProcess` 的 `stop` action 停止已有进程
   - 再用 `controlBashProcess` 的 `start` action 启动新进程

### 重启命令
```bash
# 重启后端（在 backend 目录）
npm run dev

# 重启前端（在 frontend 目录）
npm run dev
```

### 注意事项
- 不要在每次修改后都重启服务，这会浪费时间
- 前端组件修改通常会自动热更新，观察终端输出确认
- 如果热更新失败或页面状态异常，再考虑手动重启

## 核心原则

### 1. 使用统一的管理器接口

- **存储操作**：必须使用 `storageManager`，不要直接使用 `aliOssService` 或 `localStorageService`
- **数据库操作**：必须使用 `databaseManager`，不要直接使用 `databaseService` 或 `sqliteService`

```typescript
// ✅ 正确做法
import { storageManager } from './storageManager';
import { databaseManager } from './databaseManager';

// ❌ 错误做法
import { aliOssService } from './aliOssService';
import { databaseService } from './databaseService';
```

### 2. 数据库查询兼容性

SQLite 和 MySQL 的 SQL 语法有差异，需要注意：

```typescript
// 布尔值处理
const isSQLite = databaseManager.getMode() === 'sqlite';
const trueValue = isSQLite ? '1' : 'TRUE';
const falseValue = isSQLite ? '0' : 'FALSE';

// 日期处理
const dateValue = isSQLite ? new Date().toISOString() : new Date();

// 查询执行
if (isSQLite) {
  // SQLite 使用同步 API
  const row = connection.prepare(sql).get(params);
  const rows = connection.prepare(sql).all(params);
  connection.prepare(sql).run(params);
} else {
  // MySQL 使用异步 API
  const [rows] = await connection.execute(sql, params);
}
```

### 3. 存储路径处理

```typescript
// 使用 storageManager 的统一接口
const result = await storageManager.uploadFromBuffer(buffer, mimeType);
const url = result.url;  // 自动返回正确的 URL（OSS URL 或本地静态路径）

// 删除文件
await storageManager.deleteObject(key);
```

## 开发检查清单

### 新功能开发

- [ ] 使用 `databaseManager` 而非直接使用 `databaseService`
- [ ] 使用 `storageManager` 而非直接使用 `aliOssService`
- [ ] SQL 语句兼容 MySQL 和 SQLite
- [ ] 布尔值和日期类型正确处理
- [ ] 在本地模式下测试通过
- [ ] 在云端模式下测试通过（如有条件）

### Bug 修复

- [ ] 确认 bug 在哪种模式下出现
- [ ] 修复后两种模式都要测试
- [ ] 如果只影响一种模式，确保修复不会破坏另一种模式

## 环境配置

### 本地模式配置（.env）

```bash
STORAGE_MODE=local
DATABASE_MODE=sqlite
LOCAL_STORAGE_PATH=/path/to/images
LOCAL_SERVER_URL=http://localhost:3001
SQLITE_PATH=./data/database.sqlite
```

### 云端模式配置（.env）

```bash
STORAGE_MODE=oss
DATABASE_MODE=mysql
# OSS 配置
OSS_REGION=oss-cn-shenzhen
OSS_BUCKET=your-bucket
OSS_ACCESS_KEY_ID=your-key
OSS_ACCESS_KEY_SECRET=your-secret
# MySQL 配置
DB_HOST=your-rds-host
DB_DATABASE=your-database
DB_USERNAME=your-username
DB_PASSWORD=your-password
```

## 常见问题

### Q: 如何判断当前运行模式？

```typescript
import { databaseManager } from './databaseManager';
import { storageManager } from './storageManager';

const dbMode = databaseManager.getMode();  // 'mysql' | 'sqlite'
const storageMode = storageManager.getMode();  // 'oss' | 'local'
```

### Q: 新增数据库表怎么处理？

1. 在 `databaseInitializer.ts` 中添加 MySQL 表结构
2. 在 `sqliteService.ts` 的 `initializeTables()` 中添加 SQLite 表结构
3. 确保字段类型兼容（如 SQLite 没有 BOOLEAN，用 INTEGER 0/1 代替）

### Q: 新增存储功能怎么处理？

1. 在 `storageManager.ts` 中添加统一接口方法
2. 在 `aliOssService.ts` 中实现 OSS 版本
3. 在 `localStorageService.ts` 中实现本地版本

## 测试建议

1. 开发时使用本地模式（快速、无网络依赖）
2. 提交前切换到云端模式验证（如有条件）
3. 关键功能编写单元测试，mock 两种模式的行为

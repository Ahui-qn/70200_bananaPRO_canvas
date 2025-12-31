# 数据库版本管理实现文档

## 概述

本文档描述了任务 12.1 "创建数据库版本管理" 的完整实现，包括数据库版本检查、迁移脚本执行器和回滚机制。

## 实现的功能

### 1. 数据库版本检查

- **getCurrentVersion()**: 检查当前数据库版本
- **getVersionComparison()**: 比较当前版本与目标版本
- **validateDatabaseIntegrity()**: 验证数据库完整性
- **checkDatabaseVersion()**: 检查数据库版本兼容性

### 2. 迁移脚本执行器

- **migrateToVersion()**: 执行数据库迁移到指定版本
- **executeWithRetry()**: 带重试机制的操作执行
- **事务支持**: 确保迁移操作的原子性
- **脚本排序**: 按执行顺序自动排序迁移脚本

### 3. 回滚机制

- **rollbackToVersion()**: 回滚数据库到指定版本
- **回滚脚本**: 支持自定义回滚SQL脚本
- **安全检查**: 回滚前进行安全性验证
- **日志记录**: 完整的回滚操作日志

## 核心组件

### DatabaseMigrator 类

```typescript
export class DatabaseMigrator {
  private connection: mysql.Connection;
  private versions: Map<string, DatabaseVersion> = new Map();
  private currentVersion: string | null = null;

  // 核心方法
  async getCurrentVersion(): Promise<string | null>
  async migrateToVersion(targetVersion: string): Promise<MigrationResult>
  async rollbackToVersion(targetVersion: string): Promise<MigrationResult>
  async getVersionComparison(targetVersion: string): Promise<VersionComparison>
}
```

### 版本定义结构

每个版本包含以下信息：
- 版本号 (如 "1.0.0")
- 描述信息
- 发布日期
- 迁移脚本列表
- 回滚脚本列表（可选）

### 数据库表结构

#### schema_versions 表
```sql
CREATE TABLE schema_versions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  version VARCHAR(20) NOT NULL UNIQUE,
  description TEXT,
  applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  applied_by VARCHAR(100) DEFAULT 'system',
  checksum VARCHAR(64),
  execution_time INT COMMENT '执行时间（毫秒）'
);
```

#### migration_logs 表
```sql
CREATE TABLE migration_logs (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  migration_id VARCHAR(100) NOT NULL,
  version VARCHAR(20) NOT NULL,
  operation ENUM('UPGRADE', 'DOWNGRADE', 'ROLLBACK') NOT NULL,
  status ENUM('STARTED', 'SUCCESS', 'FAILED', 'ROLLED_BACK') NOT NULL,
  started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP NULL,
  error_message TEXT,
  executed_scripts JSON COMMENT '已执行的脚本列表'
);
```

## 预定义版本

### 版本 1.0.0 - 初始版本
- 创建版本管理表 (schema_versions)
- 创建迁移日志表 (migration_logs)

### 版本 1.1.0 - 索引优化
- 添加复合索引提高查询性能
- 优化 JSON 列的查询
- 支持回滚到 1.0.0

### 版本 1.2.0 - 新功能表
- 创建用户会话表 (user_sessions)
- 创建缓存条目表 (cache_entries)
- 支持回滚删除新增表

## 使用方法

### 基本迁移操作

```typescript
import { databaseService } from '../services/databaseService';

// 1. 检查当前版本
const currentVersion = await databaseService.getCurrentDatabaseVersion();
console.log('当前版本:', currentVersion);

// 2. 获取版本比较
const comparison = await databaseService.getVersionComparison('1.2.0');
console.log('需要升级:', comparison.needsUpgrade);

// 3. 执行迁移
if (comparison.needsUpgrade) {
  const result = await databaseService.migrateSchema('1.2.0');
  console.log('迁移结果:', result.success);
}

// 4. 回滚操作（谨慎使用）
const rollbackResult = await databaseService.rollbackToVersion('1.1.0');
console.log('回滚结果:', rollbackResult.success);
```

### 版本管理操作

```typescript
// 获取所有可用版本
const versions = databaseService.getAvailableVersions();
console.log('可用版本:', versions.map(v => v.version));

// 获取最新版本
const latest = databaseService.getLatestVersion();
console.log('最新版本:', latest);

// 获取迁移历史
const history = await databaseService.getMigrationHistory(10);
console.log('迁移历史:', history);

// 验证数据库完整性
const integrity = await databaseService.validateDatabaseIntegrity();
console.log('数据库完整性:', integrity.valid);
```

## 安全特性

### 1. 事务保护
- 所有迁移操作在事务中执行
- 失败时自动回滚，保证数据一致性

### 2. 校验和验证
- 每个脚本生成校验和
- 防止脚本被意外修改

### 3. 操作日志
- 完整记录所有迁移操作
- 包括执行时间、状态、错误信息

### 4. 版本锁定
- 防止并发迁移操作
- 确保版本状态一致性

## 错误处理

### 常见错误场景
1. **网络连接中断**: 自动重试机制
2. **SQL 执行失败**: 事务回滚，记录详细错误
3. **版本冲突**: 检测并提示用户
4. **权限不足**: 友好的错误提示

### 错误恢复
- 失败的迁移可以重新执行
- 支持从中断点继续迁移
- 提供详细的错误诊断信息

## 性能优化

### 1. 批量操作
- 支持批量执行SQL语句
- 减少网络往返次数

### 2. 索引优化
- 为版本表创建适当索引
- 优化查询性能

### 3. 内存管理
- 大型迁移脚本分块执行
- 避免内存溢出

## 监控和维护

### 1. 迁移监控
```typescript
// 获取迁移统计
const stats = await databaseService.getMigrationHistory();
console.log('迁移统计:', stats.length);

// 清理过期日志
const cleaned = await databaseService.cleanupMigrationLogs(30);
console.log('清理日志:', cleaned);
```

### 2. 健康检查
```typescript
// 验证数据库完整性
const health = await databaseService.validateDatabaseIntegrity();
if (!health.valid) {
  console.warn('数据库完整性问题:', health.issues);
}
```

## 最佳实践

### 1. 版本命名
- 使用语义化版本号 (如 1.0.0)
- 主版本号表示重大变更
- 次版本号表示功能添加
- 修订号表示错误修复

### 2. 脚本编写
- 每个脚本应该是幂等的
- 使用 `IF NOT EXISTS` 等安全语句
- 提供详细的脚本描述

### 3. 回滚策略
- 不是所有操作都支持回滚
- 数据删除操作需要特别谨慎
- 建议在生产环境前充分测试

### 4. 备份策略
- 迁移前创建数据库备份
- 重要迁移操作需要人工确认
- 保留足够的回滚时间窗口

## 集成说明

### 与数据库服务集成
数据库迁移器已完全集成到 `DatabaseService` 中：

```typescript
// 在 DatabaseServiceImpl 中
private migrator: DatabaseMigrator | null = null;

async connect(config: DatabaseConfig): Promise<boolean> {
  // ... 连接逻辑
  this.migrator = createDatabaseMigrator(this.connection);
  // ...
}
```

### 类型定义
所有相关类型已添加到 `types.ts` 文件中：
- `DatabaseVersion`
- `MigrationScript`
- `MigrationResult`
- `VersionComparison`

## 演示和测试

### 演示文件
- `examples/database-migration-demo.ts`: 完整的功能演示
- 包含所有主要功能的使用示例
- 可以直接运行进行测试

### 运行演示
```bash
# 设置环境变量
export DB_HOST=localhost
export DB_PORT=3306
export DB_DATABASE=nano_banana
export DB_USERNAME=root
export DB_PASSWORD=your_password

# 运行演示
npx ts-node examples/database-migration-demo.ts
```

## 总结

任务 12.1 "创建数据库版本管理" 已完全实现，包括：

✅ **数据库版本检查** - 完整的版本检测和比较功能
✅ **迁移脚本执行器** - 支持事务、重试和错误处理的迁移引擎  
✅ **回滚机制** - 安全的版本回滚功能

该实现满足了需求 7.2 中关于数据库迁移的所有要求，为系统提供了可靠的数据库版本管理能力。
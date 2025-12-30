# 阿里云数据库集成配置指南

本文档介绍如何配置和使用 Nano Banana AI 绘画应用的阿里云数据库集成功能。

## 前置要求

1. **阿里云 RDS MySQL 实例**
   - MySQL 5.7 或更高版本
   - 支持 SSL 连接
   - 已创建数据库和用户账号

2. **Node.js 环境**
   - Node.js 18+ 
   - npm 或 yarn 包管理器

## 安装依赖

项目已自动安装以下数据库相关依赖：

```bash
npm install mysql2 crypto-js dotenv @types/crypto-js
```

## 环境变量配置

1. 复制环境变量模板：
```bash
cp .env.example .env.local
```

2. 编辑 `.env.local` 文件，填入你的实际配置：

```bash
# Nano Banana AI API 配置
VITE_API_KEY=your_api_key_here

# 阿里云数据库配置
VITE_DB_HOST=your-rds-host.mysql.rds.aliyuncs.com
VITE_DB_PORT=3306
VITE_DB_DATABASE=nano_banana_db
VITE_DB_USERNAME=your_username
VITE_DB_PASSWORD=your_password
VITE_DB_SSL=true

# 数据加密密钥（32位字符）
VITE_ENCRYPTION_KEY=your-32-character-encryption-key-here
```

### 生成加密密钥

使用以下命令生成安全的32位加密密钥：

```bash
# 使用 OpenSSL
openssl rand -hex 32

# 使用 Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## 数据库初始化

### 方法一：使用 SQL 脚本（推荐）

1. 连接到你的 MySQL 数据库
2. 执行初始化脚本：

```bash
mysql -h your-host -u your-username -p your-database < scripts/init-database.sql
```

### 方法二：手动创建表

如果无法直接执行 SQL 文件，可以复制 `scripts/init-database.sql` 中的 SQL 语句，在数据库管理工具中逐个执行。

## 项目结构

新增的文件和目录：

```
├── config/
│   ├── database.ts          # 数据库配置管理
│   └── constants.ts         # 常量定义
├── utils/
│   └── database.ts          # 数据库工具函数
├── scripts/
│   └── init-database.sql    # 数据库初始化脚本
├── docs/
│   └── database-setup.md    # 本配置文档
├── .env.example             # 环境变量模板
└── vite-env.d.ts           # TypeScript 环境变量类型定义
```

## 类型定义

项目已扩展 `types.ts` 文件，新增以下接口：

- `DatabaseConfig` - 数据库连接配置
- `ConnectionStatus` - 连接状态信息
- `PaginationOptions` - 分页查询选项
- `PaginatedResult<T>` - 分页结果
- `CloudFunctionResult<T>` - 云函数调用结果
- `OperationLog` - 操作日志
- `DatabaseService` - 数据库服务接口
- `EncryptionService` - 加密服务接口

## 配置验证

使用以下函数验证配置：

```typescript
import { validateDatabaseConfig, createDefaultDatabaseConfig } from './config/database';

// 创建默认配置
const config = createDefaultDatabaseConfig();

// 验证配置
const errors = validateDatabaseConfig(config);
if (errors.length > 0) {
  console.error('配置错误：', errors);
}
```

## 安全注意事项

1. **环境变量安全**
   - 不要将 `.env.local` 文件提交到版本控制
   - 使用强密码和复杂的加密密钥
   - 定期更换数据库密码

2. **网络安全**
   - 启用 SSL 连接
   - 配置数据库防火墙规则
   - 使用 VPC 网络隔离

3. **数据加密**
   - 敏感配置信息使用 AES-256 加密存储
   - 加密密钥单独管理，不存储在数据库中

## 故障排除

### 常见错误及解决方案

1. **连接被拒绝 (ECONNREFUSED)**
   - 检查数据库主机地址和端口
   - 确认数据库服务正在运行
   - 检查防火墙设置

2. **访问被拒绝 (ER_ACCESS_DENIED_ERROR)**
   - 验证用户名和密码
   - 检查用户权限设置
   - 确认数据库允许远程连接

3. **数据库不存在 (ER_BAD_DB_ERROR)**
   - 确认数据库名称正确
   - 检查用户是否有访问该数据库的权限

4. **SSL 连接问题**
   - 确认 RDS 实例已启用 SSL
   - 检查 SSL 证书配置
   - 尝试禁用 SSL 进行测试

### 调试模式

在开发环境中启用详细日志：

```typescript
import { isDevelopment } from './config/database';

if (isDevelopment()) {
  console.log('数据库配置：', getDatabaseConnectionString(config));
}
```

## 下一步

配置完成后，你可以：

1. 继续实施任务 2：实现数据加密服务
2. 继续实施任务 3：实现数据库连接和基础操作
3. 测试数据库连接和基本功能

## 支持

如果遇到问题，请检查：

1. 阿里云 RDS 控制台的连接信息
2. 数据库用户权限设置
3. 网络安全组配置
4. 应用日志中的详细错误信息
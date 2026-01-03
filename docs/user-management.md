# 用户管理指南

## 概述

本系统使用命令行工具管理用户。用户管理脚本独立于服务器运行，可以在服务器运行状态下执行所有用户管理操作。

## 前置条件

1. 确保数据库已连接并初始化
2. 在 `backend` 目录下执行命令

## 用户角色

系统支持两种用户角色：

| 角色 | 说明 | 权限 |
|------|------|------|
| `user` | 普通用户 | 基本功能使用 |
| `admin` | 管理员 | 数据库操作、系统配置等高级功能 |

## 命令列表

### 创建用户

```bash
# 创建普通用户
npm run user:create -- --username=用户名 --password=密码 --name=显示名称

# 创建管理员用户
npm run user:create -- --username=用户名 --password=密码 --name=显示名称 --role=admin
```

**参数说明：**
- `--username`：登录用户名（必填，唯一）
- `--password`：登录密码（必填，至少 6 位）
- `--name`：显示名称（必填）
- `--role`：用户角色（可选，默认为 `user`，可选值：`user` 或 `admin`）

**示例：**
```bash
# 创建管理员账户
npm run user:create -- --username=admin --password=admin123 --name=管理员 --role=admin

# 创建普通用户
npm run user:create -- --username=zhangsan --password=123456 --name=张三
```

### 查看用户列表

```bash
npm run user:list
```

显示所有用户的信息，包括用户名、显示名称、角色、状态等。

### 禁用用户

```bash
npm run user:disable -- --username=用户名
```

禁用后用户将无法登录系统。

### 启用用户

```bash
npm run user:enable -- --username=用户名
```

重新启用被禁用的用户。

### 设置用户角色

```bash
npm run user:set-role -- --username=用户名 --role=角色
```

**示例：**
```bash
# 将用户提升为管理员
npm run user:set-role -- --username=zhangsan --role=admin

# 将管理员降级为普通用户
npm run user:set-role -- --username=zhangsan --role=user
```

### 重置密码

```bash
npm run user:reset-password -- --username=用户名 --password=新密码
```

**示例：**
```bash
npm run user:reset-password -- --username=zhangsan --password=newpass123
```

## 常见问题

### Q: 可以在服务器运行时创建用户吗？

**A:** 可以。用户管理脚本直接连接数据库执行操作，不依赖后端服务器，因此可以在服务器运行状态下随时执行用户管理命令。

### Q: 忘记管理员密码怎么办？

**A:** 使用重置密码命令：
```bash
npm run user:reset-password -- --username=admin --password=新密码
```

### Q: 如何查看命令帮助？

**A:** 运行不带参数的命令会显示帮助信息：
```bash
npm run user:create
```

## 初始化建议

首次部署系统时，建议执行以下步骤：

1. 初始化数据库（在 Web 界面或使用脚本）
2. 创建管理员账户：
   ```bash
   npm run user:create -- --username=admin --password=你的密码 --name=管理员 --role=admin
   ```
3. 根据需要创建其他用户账户

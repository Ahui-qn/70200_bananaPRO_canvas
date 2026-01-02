# 实现计划

- [x] 1. 数据库和后端基础设施
  - [x] 1.1 创建 users 表结构
    - 在 database-schema.sql 中添加 users 表定义
    - 在 databaseInitializer.ts 中添加表创建逻辑
    - 字段：id, username, password_hash, display_name, created_at, updated_at, last_login_at, is_active
    - _需求: 3.1, 4.1_
  - [x] 1.2 添加 JWT 相关依赖和环境变量
    - 安装 jsonwebtoken 和 bcrypt 依赖
    - 在 .env.example 中添加 JWT_SECRET 配置
    - _需求: 2.1_

- [x] 2. 用户服务实现
  - [x] 2.1 创建用户服务 (userService.ts)
    - 实现 createUser 方法（bcrypt 加密密码）
    - 实现 validateCredentials 方法
    - 实现 getUserById 方法
    - 实现 listUsers 方法
    - 实现 updateLastLogin 方法
    - _需求: 3.1, 3.3, 3.4, 4.1_
  - [x] 2.2 编写用户服务属性测试
    - **属性 6: 用户创建和唯一 ID**
    - **属性 7: 密码安全存储**
    - **属性 8: 用户列表不包含密码**
    - **验证: 需求 3.1, 3.3, 3.4, 4.1**

- [x] 3. 认证服务实现
  - [x] 3.1 创建认证服务 (authService.ts)
    - 实现 generateToken 方法
    - 实现 verifyToken 方法
    - 配置令牌过期时间为 7 天
    - _需求: 2.1, 2.2, 2.3, 2.4_
  - [x] 3.2 编写认证服务属性测试
    - **属性 4: 有效令牌验证成功**
    - **属性 5: 过期或无效令牌被拒绝**
    - **验证: 需求 2.2, 2.3, 2.4**

- [x] 4. 认证 API 路由
  - [x] 4.1 创建认证路由 (routes/auth.ts)
    - POST /api/auth/login - 用户登录
    - GET /api/auth/verify - 验证令牌
    - POST /api/auth/logout - 退出登录（记录日志）
    - _需求: 1.1, 1.2, 1.3, 4.4_
  - [x] 4.2 编写认证路由属性测试
    - **属性 1: 有效凭据登录成功**
    - **属性 2: 无效凭据登录失败**
    - **验证: 需求 1.1, 1.2**

- [x] 5. 认证中间件
  - [x] 5.1 创建认证中间件 (middleware/auth.ts)
    - 验证请求头中的 Bearer 令牌
    - 将用户信息附加到 req.user
    - 未授权请求返回 401
    - _需求: 1.4, 5.3_
  - [x] 5.2 将中间件应用到受保护路由
    - 保护 /api/generate 路由
    - 保护 /api/images 路由
    - 保护 /api/ref-images 路由
    - _需求: 1.4_
  - [x] 5.3 编写中间件属性测试
    - **属性 3: 未授权访问被拒绝**
    - **验证: 需求 1.4, 5.3**

- [x] 6. 检查点 - 确保所有测试通过
  - 确保所有测试通过，如有问题请询问用户。

- [x] 7. 修改图片保存逻辑
  - [x] 7.1 更新图片保存时关联用户 ID
    - 修改 generate.ts 中的保存逻辑
    - 从 req.user 获取当前用户 ID
    - 将用户 ID 存储到图片记录
    - _需求: 4.2_
  - [x] 7.2 更新图片查询支持用户筛选
    - 修改 databaseService.ts 的 getImages 方法
    - 添加 userId 筛选参数
    - _需求: 4.3_
  - [x] 7.3 编写图片用户关联属性测试
    - **属性 9: 图片关联用户 ID**
    - **验证: 需求 4.2, 4.3**

- [x] 8. 命令行用户管理工具
  - [x] 8.1 创建用户管理脚本 (scripts/manage-users.ts)
    - 实现 create 命令：创建新用户
    - 实现 list 命令：列出所有用户
    - 实现 disable 命令：禁用用户
    - _需求: 3.1, 3.2, 3.4_
  - [x] 8.2 在 package.json 中添加脚本命令
    - npm run user:create
    - npm run user:list
    - npm run user:disable
    - _需求: 3.1_

- [x] 9. 前端登录页面
  - [x] 9.1 创建登录页面组件 (LoginPage.tsx)
    - 用户名输入框
    - 密码输入框
    - 登录按钮
    - 错误提示
    - 玻璃态设计风格
    - _需求: 1.1, 1.2, 1.3_

- [x] 10. 前端认证状态管理
  - [x] 10.1 创建认证上下文 (AuthContext.tsx)
    - 管理用户登录状态
    - 提供 login/logout 方法
    - 自动验证本地存储的令牌
    - _需求: 2.1, 2.2, 2.3, 2.4, 5.1, 5.2_
  - [x] 10.2 创建路由保护组件 (ProtectedRoute.tsx)
    - 检查登录状态
    - 未登录重定向到登录页
    - _需求: 1.4_

- [x] 11. 前端集成
  - [x] 11.1 更新主应用入口 (main.tsx)
    - 添加 AuthProvider
    - 配置路由（登录页、主应用）
    - _需求: 1.4_
  - [x] 11.2 更新画布应用显示当前用户
    - 在顶部导航栏显示用户名
    - 添加退出登录按钮
    - _需求: 5.1, 5.2_
  - [x] 11.3 更新 API 服务添加认证头
    - 在所有请求中添加 Authorization 头
    - 处理 401 响应自动跳转登录
    - _需求: 1.4, 2.4_

- [x] 12. 最终检查点 - 确保所有测试通过
  - 确保所有测试通过，如有问题请询问用户。

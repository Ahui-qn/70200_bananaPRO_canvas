# 中文语言偏好设置

## 语言要求

- 所有回复和对话都使用中文（简体中文）
- 撰写的文档、注释和说明都使用中文
- 代码注释使用中文
- 错误信息和日志信息的解释使用中文
- 技术术语可以保留英文，但需要提供中文解释

## 文档撰写规范

- 使用中文标点符号（，。！？：；""''）
- 技术文档结构清晰，使用中文标题
- 代码示例后提供中文说明
- 保持专业但友好的语调

## 例外情况

- 代码本身（变量名、函数名等）可以使用英文
- 配置文件中的键值对可以使用英文
- 第三方库和框架的名称保持原文
- URL 和文件路径保持原文

## 代码注释示例

```typescript
// 正确的中文注释示例
interface UserData {
  id: string;        // 用户唯一标识符
  name: string;      // 用户姓名
  email: string;     // 电子邮箱地址
  createdAt: Date;   // 创建时间
}

/**
 * 获取用户信息
 * @param userId 用户ID
 * @returns 返回用户数据对象
 */
function getUserData(userId: string): UserData {
  // 从数据库查询用户信息
  return database.findUser(userId);
}
```

## 文档标题层级示例

```markdown
# 一级标题：项目概述
## 二级标题：功能模块
### 三级标题：具体实现
#### 四级标题：技术细节
```

## 错误处理说明

当遇到错误时，应该提供中文解释：

```typescript
try {
  // 执行操作
  performOperation();
} catch (error) {
  console.error('操作失败：', error.message);
  throw new Error('无法完成用户数据更新操作');
}
```

## 技术术语对照表

| 英文术语 | 中文解释 |
|---------|---------|
| Component | 组件 |
| Hook | 钩子函数 |
| State | 状态 |
| Props | 属性 |
| API | 应用程序接口 |
| TypeScript | TypeScript（类型化的JavaScript） |
| React | React（前端框架） |
| Vite | Vite（构建工具） |

## 适用范围

此语言偏好设置适用于：
- 所有项目文档
- 代码注释和说明
- 错误信息和日志
- 用户界面文本
- 技术规范文档
- 开发指南和教程
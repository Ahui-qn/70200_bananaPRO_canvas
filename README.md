# Nano Banana AI 绘画画布

一个基于 React + TypeScript 的 AI 绘画应用，支持多种 AI 模型生成图片，并提供完整的图片管理和云端同步功能。

## ✨ 主要功能

### 🎨 AI 绘画生成
- 支持 Nano Banana 系列 AI 模型
- 多种图像比例和尺寸选择
- 参考图片上传（最多14张）
- 实时生成进度显示
- 提示词优化建议

### 📚 图片管理
- 本地 IndexedDB 存储
- 图片收藏和标签管理
- 搜索和筛选功能
- 批量操作支持
- 网格和列表视图切换

### ☁️ 云端同步
- **阿里云 OSS 存储**: 自动备份生成的图片到云端
- **MySQL 数据库同步**: 图片元数据云端备份和多设备同步
- 离线优先设计，网络恢复后自动同步
- 批量上传和下载功能

### 🛠️ 技术特性
- 响应式设计，支持多种屏幕尺寸
- 暗色主题界面
- 渐进式 Web 应用 (PWA) 支持
- TypeScript 类型安全
- 模块化架构设计

## 🚀 快速开始

### 环境要求
- Node.js 18+ 
- npm 或 yarn

### 安装和运行

1. **克隆项目**
```bash
git clone https://github.com/your-username/nano-banana-ai-canvas.git
cd nano-banana-ai-canvas
```

2. **安装依赖**
```bash
npm install
```

3. **配置环境变量**
```bash
# 复制环境变量模板
cp .env.local.example .env.local

# 编辑 .env.local 文件，填入你的 API 密钥
API_KEY=your_actual_api_key_here
```

4. **启动开发服务器**
```bash
npm run dev
```

5. **访问应用**
打开浏览器访问 `http://localhost:3000`

## ⚙️ 配置说明

### API 配置
- 在应用右上角点击"API 配置"按钮
- 输入您的 Nano Banana API 密钥
- 可选择不同的 API 提供商和模型

### 云存储配置（可选）

#### 阿里云 OSS 配置
1. 点击"云存储"按钮
2. 填入 OSS 配置信息：
   - 区域 (Region)
   - AccessKey ID
   - AccessKey Secret  
   - 存储桶名称 (Bucket)
   - 自定义域名（可选）

#### 数据库同步配置（可选）
1. 点击"数据库"按钮
2. 填入 MySQL 数据库连接信息：
   - 主机地址
   - 端口（默认 3306）
   - 数据库名称
   - 用户名和密码
3. 测试连接并初始化数据库表结构

## 📁 项目结构

```
├── components/          # React 组件
│   ├── ApiConfig.tsx   # API 配置组件
│   ├── Canvas.tsx      # 主画布组件
│   ├── Controls.tsx    # 生成控制面板
│   ├── ImageLibrary.tsx # 图片库组件
│   ├── ImageUpload.tsx # 图片上传组件
│   ├── OSSConfig.tsx   # OSS 配置组件
│   └── DatabaseConfig.tsx # 数据库配置组件
├── services/           # 业务逻辑服务
│   ├── api.ts         # API 调用服务
│   ├── imageStorage.ts # 本地图片存储
│   ├── ossStorage.ts  # OSS 云存储服务
│   ├── databaseStorage.ts # 数据库存储服务
│   └── hybridStorage.ts # 混合存储服务
├── .kiro/             # Kiro IDE 配置和规范
│   ├── specs/         # 功能规范文档
│   └── steering/      # 开发指导文档
└── types.ts           # TypeScript 类型定义
```

## 🔧 开发指南

### 可用脚本
```bash
npm run dev      # 启动开发服务器
npm run build    # 构建生产版本
npm run preview  # 预览生产构建
```

### 技术栈
- **前端框架**: React 19 + TypeScript
- **构建工具**: Vite 6
- **样式框架**: Tailwind CSS 4
- **图标库**: Lucide React
- **存储**: IndexedDB (本地) + MySQL (云端)
- **云服务**: 阿里云 OSS

### 开发规范
项目使用 Kiro IDE 的规范驱动开发方法，包含：
- 详细的需求文档 (requirements.md)
- 系统设计文档 (design.md)  
- 实施任务列表 (tasks.md)
- 基于属性的测试策略

## 📖 功能文档

- [图片保存功能说明](./图片保存功能说明.md)
- [OSS 配置指南](./OSS配置指南.md)
- [数据库同步规范](./.kiro/specs/database-sync/)

## 🔒 安全说明

- 所有 API 密钥和敏感配置都存储在本地浏览器中
- 不会在代码中硬编码任何敏感信息
- 支持 SSL 连接和安全传输
- 建议使用专用的子账号和访问密钥

## 🤝 贡献指南

1. Fork 本项目
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 创建 Pull Request

## 📄 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情。

## 🙏 致谢

- [Nano Banana AI](https://grsai.dakka.com.cn/) - 提供强大的 AI 绘画 API
- [React](https://reactjs.org/) - 前端框架
- [Vite](https://vitejs.dev/) - 构建工具
- [Tailwind CSS](https://tailwindcss.com/) - 样式框架
- [Lucide](https://lucide.dev/) - 图标库

## 📞 支持

如果您在使用过程中遇到问题，请：
1. 查看 [Issues](https://github.com/your-username/nano-banana-ai-canvas/issues) 页面
2. 创建新的 Issue 描述问题
3. 或者发送邮件到 your-email@example.com

---

⭐ 如果这个项目对您有帮助，请给它一个星标！
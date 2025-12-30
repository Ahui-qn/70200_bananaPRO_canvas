# 阿里云 OSS 配置指南

## 问题诊断

根据错误信息，主要问题是：
1. **CORS 跨域问题** - 需要在 OSS 控制台配置 CORS 规则
2. **403 权限错误** - 需要检查 AccessKey 权限和存储桶设置

## 解决步骤

### 1. 配置 OSS CORS 规则

1. **登录阿里云控制台**
   - 访问 https://oss.console.aliyun.com/
   - 选择你的存储桶 `ahui70200`

2. **设置 CORS 规则**
   - 点击左侧菜单"权限管理" > "跨域设置"
   - 点击"设置"按钮
   - 添加以下 CORS 规则：

```
来源（AllowedOrigin）: *
允许 Methods: GET, POST, PUT, DELETE, HEAD, OPTIONS
允许 Headers: *
暴露 Headers: ETag, x-oss-request-id, x-oss-object-acl
缓存时间（MaxAgeSeconds）: 0
```

### 2. 检查存储桶权限设置

1. **访问权限设置**
   - 在存储桶概览页面，找到"权限管理" > "读写权限"
   - 建议设置为"公共读"（允许匿名用户读取文件）

2. **防盗链设置**
   - 确保没有设置防盗链，或者将 `localhost` 和你的域名加入白名单

### 3. 验证 AccessKey 权限

确保你的 AccessKey 具有以下权限：
- `oss:PutObject` - 上传文件
- `oss:GetObject` - 读取文件  
- `oss:PutObjectAcl` - 设置文件访问权限

### 4. 更新项目配置

1. **选择正确的区域**
   - 在项目的 OSS 配置中，选择"华南1（深圳）"
   - 区域代码：`oss-cn-shenzhen`

2. **填写正确信息**
   - 存储桶名称：`ahui70200`
   - AccessKey ID：你的 AccessKey ID
   - AccessKey Secret：你的 AccessKey Secret
   - 自定义域名：`ahui70200.oss-cn-shenzhen.aliyuncs.com`（可选）

## 测试步骤

1. **保存配置后点击"测试连接"**
2. **查看浏览器控制台是否有错误信息**
3. **如果测试成功，尝试生成一张图片看是否自动上传**

## 常见问题

### Q: 仍然出现 CORS 错误
A: 
- 确保 CORS 规则中的 Methods 包含 PUT 和 OPTIONS
- 清除浏览器缓存后重试
- 检查是否有多个 CORS 规则冲突

### Q: 403 权限错误
A:
- 检查 AccessKey 是否有效且未过期
- 确认 AccessKey 具有 OSS 相关权限
- 检查存储桶是否设置了 IP 白名单限制

### Q: 上传成功但无法访问图片
A:
- 检查存储桶读写权限是否为"公共读"
- 确认文件 ACL 设置为 public-read
- 检查防盗链设置

### Q: 自定义域名无法访问
A:
- 确保自定义域名已正确绑定到存储桶
- 检查域名 CNAME 解析是否正确
- 如果使用 HTTPS，确保 SSL 证书配置正确

## 安全建议

1. **使用子账号 AccessKey**
   - 不要使用主账号的 AccessKey
   - 为 OSS 操作创建专用的子账号
   - 只授予必要的权限

2. **定期更换 AccessKey**
   - 建议每 3-6 个月更换一次
   - 更换后及时更新项目配置

3. **监控使用情况**
   - 定期检查 OSS 使用量和费用
   - 设置费用预警
   - 监控异常访问

## 费用说明

- **存储费用**：按实际存储量计费
- **流量费用**：下载图片时产生外网流出流量费用
- **请求费用**：每次上传/下载产生少量请求费用

建议开启费用预警，避免意外产生高额费用。

---

如果按照以上步骤配置后仍有问题，请提供详细的错误信息以便进一步诊断。
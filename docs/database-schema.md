# Nano Banana AI 数据库表结构文档

## 概述

本文档详细描述了 Nano Banana AI 绘画项目的数据库表结构，包括所有表、字段、索引和视图的定义。

**数据库信息：**
- 数据库类型：MySQL 8.0+
- 字符集：utf8mb4
- 排序规则：utf8mb4_unicode_ci
- 存储引擎：InnoDB

---

## 表结构

### 1. images（图片记录表）

存储所有生成的图片信息，是系统的核心数据表。

| 字段名 | 类型 | 是否必填 | 默认值 | 说明 |
|--------|------|----------|--------|------|
| `id` | VARCHAR(50) | ✅ 必填 | - | 图片唯一标识符，主键，格式：`img_{timestamp}_{random}` |
| `url` | TEXT | ✅ 必填 | - | 图片访问 URL（OSS 上传后为永久链接） |
| `original_url` | TEXT | ❌ 可选 | NULL | 原始临时 URL（AI 生成的临时链接，有效期 2 小时） |
| `prompt` | TEXT | ✅ 必填 | - | 生成图片使用的提示词 |
| `model` | VARCHAR(100) | ✅ 必填 | - | 使用的 AI 模型名称 |
| `aspect_ratio` | VARCHAR(20) | ❌ 可选 | 'auto' | 图像宽高比 |
| `image_size` | VARCHAR(10) | ❌ 可选 | '1K' | 图像分辨率尺寸 |
| `ref_images` | JSON | ❌ 可选 | NULL | 参考图片信息（JSON 数组格式） |
| `created_at` | TIMESTAMP | ❌ 可选 | CURRENT_TIMESTAMP | 创建时间 |
| `updated_at` | TIMESTAMP | ❌ 可选 | CURRENT_TIMESTAMP | 更新时间（自动更新） |
| `tags` | JSON | ❌ 可选 | NULL | 标签列表（JSON 数组格式） |
| `favorite` | BOOLEAN | ❌ 可选 | FALSE | 是否收藏 |
| `oss_key` | TEXT | ❌ 可选 | NULL | OSS 对象存储键名 |
| `oss_uploaded` | BOOLEAN | ❌ 可选 | FALSE | 是否已上传到 OSS |
| `user_id` | VARCHAR(50) | ❌ 可选 | 'default' | 用户 ID（预留多用户支持） |

**索引：**
| 索引名 | 字段 | 说明 |
|--------|------|------|
| PRIMARY | `id` | 主键索引 |
| `idx_created_at` | `created_at` | 按创建时间查询优化 |
| `idx_model` | `model` | 按模型筛选优化 |
| `idx_favorite` | `favorite` | 收藏筛选优化 |
| `idx_user_id` | `user_id` | 多用户查询优化 |
| `idx_oss_uploaded` | `oss_uploaded` | OSS 上传状态筛选 |

**字段详细说明：**

#### model（AI 模型）
支持的模型值：
- `nano-banana-fast` - 快速生成模型
- `nano-banana` - 标准模型
- `nano-banana-pro` - 专业模型
- `nano-banana-pro-vt` - 专业 VT 模型
- `nano-banana-pro-cl` - 专业 CL 模型
- `nano-banana-pro-vip` - VIP 专业模型（支持 1K、2K）
- `nano-banana-pro-4k-vip` - 4K VIP 专业模型（仅支持 4K）

#### aspect_ratio（宽高比）
支持的值：
- `auto` - 自动
- `1:1` - 正方形
- `16:9` - 横屏宽屏
- `9:16` - 竖屏
- `4:3` - 标准横屏
- `3:4` - 标准竖屏
- `3:2` - 照片横屏
- `2:3` - 照片竖屏
- `5:4` - 接近正方形横屏
- `4:5` - 接近正方形竖屏
- `21:9` - 超宽屏

#### image_size（图像尺寸）
支持的值：
- `1K` - 1024px（默认）
- `2K` - 2048px
- `4K` - 4096px（仅 nano-banana-pro-4k-vip 支持）

#### ref_images（参考图片）
JSON 数组格式示例：
```json
[
  {
    "id": "ref_001",
    "url": "https://example.com/ref1.jpg",
    "name": "参考图1.jpg"
  }
]
```

#### tags（标签）
JSON 数组格式示例：
```json
["风景", "自然", "山水"]
```

---

### 2. user_configs（用户配置表）

存储用户的个性化配置信息。

| 字段名 | 类型 | 是否必填 | 默认值 | 说明 |
|--------|------|----------|--------|------|
| `user_id` | VARCHAR(50) | ✅ 必填 | - | 用户 ID，主键 |
| `api_config` | JSON | ❌ 可选 | NULL | API 配置信息 |
| `oss_config` | JSON | ❌ 可选 | NULL | OSS 配置信息 |
| `preferences` | JSON | ❌ 可选 | NULL | 用户偏好设置 |
| `created_at` | TIMESTAMP | ❌ 可选 | CURRENT_TIMESTAMP | 创建时间 |
| `updated_at` | TIMESTAMP | ❌ 可选 | CURRENT_TIMESTAMP | 更新时间 |

**preferences 字段示例：**
```json
{
  "autoSync": true,
  "syncInterval": 300,
  "maxLocalImages": 1000,
  "theme": "dark"
}
```

---

### 3. sync_logs / operation_logs（操作日志表）

记录所有数据库操作日志，用于调试和监控。

| 字段名 | 类型 | 是否必填 | 默认值 | 说明 |
|--------|------|----------|--------|------|
| `id` | BIGINT | ✅ 必填 | AUTO_INCREMENT | 日志 ID，主键 |
| `operation` | VARCHAR(50) | ✅ 必填 | - | 操作类型 |
| `table_name` | VARCHAR(50) | ✅ 必填 | - | 操作的表名 |
| `record_id` | VARCHAR(50) | ❌ 可选 | NULL | 操作的记录 ID |
| `user_id` | VARCHAR(50) | ❌ 可选 | 'default' | 用户 ID |
| `status` | ENUM | ❌ 可选 | 'SUCCESS' | 操作状态 |
| `error_message` | TEXT | ❌ 可选 | NULL | 错误信息 |
| `duration` | INT | ❌ 可选 | NULL | 操作耗时（毫秒） |
| `created_at` | TIMESTAMP | ❌ 可选 | CURRENT_TIMESTAMP | 创建时间 |

**operation 字段值：**
- `INSERT` - 插入记录
- `UPDATE` - 更新记录
- `DELETE` - 删除记录
- `SYNC` - 同步操作
- `QUERY` - 查询操作

**status 字段值：**
- `SUCCESS` - 成功
- `FAILED` - 失败

**索引：**
| 索引名 | 字段 | 说明 |
|--------|------|------|
| PRIMARY | `id` | 主键索引 |
| `idx_created_at` | `created_at` | 按时间查询优化 |
| `idx_operation` | `operation` | 按操作类型筛选 |
| `idx_user_id` | `user_id` | 按用户筛选 |
| `idx_status` | `status` | 按状态筛选 |

---

### 4. reference_images（参考图片表）

存储去重后的参考图片信息，用于图生图功能。通过 SHA256 哈希实现去重，避免重复存储相同图片。

| 字段名 | 类型 | 是否必填 | 默认值 | 说明 |
|--------|------|----------|--------|------|
| `id` | VARCHAR(50) | ✅ 必填 | - | 参考图片唯一标识符，主键 |
| `hash` | VARCHAR(64) | ✅ 必填 | - | 图片内容 SHA256 哈希（唯一约束） |
| `oss_key` | VARCHAR(255) | ✅ 必填 | - | OSS 对象存储键名 |
| `oss_url` | TEXT | ✅ 必填 | - | OSS 访问 URL |
| `original_name` | VARCHAR(255) | ❌ 可选 | NULL | 原始文件名 |
| `size` | INT UNSIGNED | ✅ 必填 | - | 文件大小（字节） |
| `mime_type` | VARCHAR(50) | ✅ 必填 | 'image/jpeg' | MIME 类型 |
| `width` | INT UNSIGNED | ❌ 可选 | NULL | 图片宽度（像素） |
| `height` | INT UNSIGNED | ❌ 可选 | NULL | 图片高度（像素） |
| `use_count` | INT UNSIGNED | ❌ 可选 | 1 | 使用次数 |
| `created_at` | TIMESTAMP | ❌ 可选 | CURRENT_TIMESTAMP | 创建时间 |
| `last_used_at` | TIMESTAMP | ❌ 可选 | CURRENT_TIMESTAMP | 最后使用时间 |

**索引：**
| 索引名 | 字段 | 说明 |
|--------|------|------|
| PRIMARY | `id` | 主键索引 |
| `uk_hash` | `hash` | 唯一索引，用于去重 |
| `idx_ref_created_at` | `created_at` | 按创建时间查询优化 |
| `idx_ref_use_count` | `use_count` | 按使用次数筛选 |
| `idx_ref_last_used_at` | `last_used_at` | 按最后使用时间筛选 |

**去重机制说明：**
1. 上传参考图片时，先计算图片内容的 SHA256 哈希
2. 查询数据库是否存在相同哈希的记录
3. 如果存在，复用现有记录并增加 `use_count`
4. 如果不存在，上传到 OSS 并创建新记录
5. 这样可以避免相同图片重复上传，节省存储空间

---

## 视图

### 1. recent_images（最近图片视图）

显示最近 7 天生成的图片。

```sql
SELECT id, url, prompt, model, aspect_ratio, image_size, 
       favorite, oss_uploaded, created_at
FROM images
WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
ORDER BY created_at DESC;
```

### 2. favorite_images（收藏图片视图）

显示所有收藏的图片。

```sql
SELECT id, url, prompt, model, aspect_ratio, image_size, 
       created_at, oss_uploaded
FROM images
WHERE favorite = TRUE
ORDER BY created_at DESC;
```

### 3. image_stats（统计信息视图）

显示图片统计信息，按模型分组。

```sql
SELECT 
  COUNT(*) as total_images,
  COUNT(CASE WHEN favorite = TRUE THEN 1 END) as favorite_count,
  COUNT(CASE WHEN oss_uploaded = TRUE THEN 1 END) as oss_uploaded_count,
  COUNT(CASE WHEN created_at >= DATE_SUB(NOW(), INTERVAL 1 DAY) THEN 1 END) as recent_count,
  model,
  COUNT(*) as model_count
FROM images
GROUP BY model WITH ROLLUP;
```

---

## 存储过程

### CleanupOldImages（清理旧数据）

自动清理超过 1000 条的旧记录（保留收藏的图片）。

```sql
CALL CleanupOldImages();
```

---

## 数据流程

### 图片生成和保存流程

```
1. 用户提交生成请求
   ↓
2. 调用 Nano Banana API 创建任务
   ↓
3. 轮询获取生成结果
   ↓
4. 获取临时图片 URL（有效期 2 小时）
   ↓
5. 下载图片并上传到阿里云 OSS
   ↓
6. 保存图片信息到数据库
   - id: 生成唯一 ID
   - url: OSS 永久链接
   - original_url: 原始临时链接
   - prompt: 用户提示词
   - model: 使用的模型
   - aspect_ratio: 宽高比
   - image_size: 图像尺寸
   - oss_key: OSS 对象键名
   - oss_uploaded: true
   - created_at: 当前时间
```

---

## 扩展字段建议

如需添加新字段，建议考虑以下方向：

| 字段名 | 类型 | 说明 |
|--------|------|------|
| `generation_time` | INT | 生成耗时（秒） |
| `task_id` | VARCHAR(100) | API 任务 ID |
| `seed` | BIGINT | 随机种子（用于复现） |
| `negative_prompt` | TEXT | 负面提示词 |
| `style` | VARCHAR(50) | 风格预设 |
| `quality` | VARCHAR(20) | 质量等级 |
| `file_size` | BIGINT | 文件大小（字节） |
| `width` | INT | 图片宽度（像素） |
| `height` | INT | 图片高度（像素） |
| `content_rating` | VARCHAR(20) | 内容分级 |
| `is_public` | BOOLEAN | 是否公开 |
| `view_count` | INT | 查看次数 |
| `download_count` | INT | 下载次数 |

---

## 更新日志

| 日期 | 版本 | 更新内容 |
|------|------|----------|
| 2024-12-30 | 1.0.0 | 初始版本，创建基础表结构 |
| 2024-12-31 | 1.0.1 | 添加文档说明 |
| 2026-01-01 | 1.1.0 | 添加 reference_images 表，实现参考图片去重存储 |

---

## 注意事项

1. **字符集**：所有表使用 `utf8mb4` 字符集以支持 emoji 和特殊字符
2. **时区**：时间戳字段使用服务器时区，建议统一使用 UTC
3. **JSON 字段**：MySQL 8.0+ 原生支持 JSON 类型，可进行 JSON 路径查询
4. **索引优化**：根据实际查询模式可能需要调整索引
5. **数据备份**：建议定期备份 `images` 表数据

-- Nano Banana AI 数据库初始化脚本
-- 创建所需的数据表和索引

-- 设置字符集和排序规则
SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- 创建 images 表
-- 存储用户生成的图片信息
CREATE TABLE IF NOT EXISTS `images` (
  `id` VARCHAR(50) NOT NULL COMMENT '图片唯一标识符',
  `url` TEXT NOT NULL COMMENT '图片URL地址',
  `original_url` TEXT COMMENT '原始URL（OSS上传前的临时URL）',
  `prompt` TEXT NOT NULL COMMENT '生成图片的提示词',
  `model` VARCHAR(100) NOT NULL COMMENT '使用的AI模型名称',
  `aspect_ratio` VARCHAR(20) DEFAULT 'auto' COMMENT '图片宽高比',
  `image_size` VARCHAR(10) DEFAULT '1K' COMMENT '图片尺寸',
  `ref_images` JSON COMMENT '参考图片信息（JSON格式）',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `tags` JSON COMMENT '图片标签（JSON数组）',
  `favorite` BOOLEAN DEFAULT FALSE COMMENT '是否收藏',
  `oss_key` TEXT COMMENT 'OSS对象键名',
  `oss_uploaded` BOOLEAN DEFAULT FALSE COMMENT '是否已上传到OSS',
  `user_id` VARCHAR(50) DEFAULT 'default' COMMENT '用户ID（预留字段）',
  
  PRIMARY KEY (`id`),
  INDEX `idx_created_at` (`created_at`),
  INDEX `idx_model` (`model`),
  INDEX `idx_favorite` (`favorite`),
  INDEX `idx_user_id` (`user_id`),
  INDEX `idx_oss_uploaded` (`oss_uploaded`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='图片信息表';

-- 创建 user_configs 表
-- 存储用户配置信息（API配置、OSS配置等）
CREATE TABLE IF NOT EXISTS `user_configs` (
  `user_id` VARCHAR(50) NOT NULL COMMENT '用户ID',
  `api_config` JSON COMMENT 'API配置信息（加密存储）',
  `oss_config` JSON COMMENT 'OSS配置信息（加密存储）',
  `preferences` JSON COMMENT '用户偏好设置',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  
  PRIMARY KEY (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户配置表';

-- 创建 operation_logs 表
-- 记录所有数据库操作日志
CREATE TABLE IF NOT EXISTS `operation_logs` (
  `id` BIGINT AUTO_INCREMENT COMMENT '日志ID',
  `operation` VARCHAR(50) NOT NULL COMMENT '操作类型（INSERT/UPDATE/DELETE/SELECT）',
  `table_name` VARCHAR(50) NOT NULL COMMENT '操作的表名',
  `record_id` VARCHAR(50) COMMENT '操作的记录ID',
  `user_id` VARCHAR(50) DEFAULT 'default' COMMENT '操作用户ID',
  `status` ENUM('SUCCESS', 'FAILED') DEFAULT 'SUCCESS' COMMENT '操作状态',
  `error_message` TEXT COMMENT '错误信息（如果操作失败）',
  `duration` INT COMMENT '操作耗时（毫秒）',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '操作时间',
  
  PRIMARY KEY (`id`),
  INDEX `idx_created_at` (`created_at`),
  INDEX `idx_operation` (`operation`),
  INDEX `idx_user_id` (`user_id`),
  INDEX `idx_status` (`status`),
  INDEX `idx_table_name` (`table_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='操作日志表';

-- 插入默认用户配置（如果不存在）
INSERT IGNORE INTO `user_configs` (`user_id`, `preferences`) 
VALUES ('default', JSON_OBJECT(
  'theme', 'light',
  'language', 'zh-CN',
  'pageSize', 20,
  'autoSave', true
));

SET FOREIGN_KEY_CHECKS = 1;

-- 显示创建结果
SELECT 'Database initialization completed successfully!' as message;
SELECT 
  TABLE_NAME as '表名',
  TABLE_COMMENT as '说明',
  TABLE_ROWS as '记录数'
FROM information_schema.TABLES 
WHERE TABLE_SCHEMA = DATABASE() 
  AND TABLE_NAME IN ('images', 'user_configs', 'operation_logs')
ORDER BY TABLE_NAME;
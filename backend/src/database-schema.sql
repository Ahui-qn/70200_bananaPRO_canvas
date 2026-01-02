-- Nano Banana AI 绘画项目数据库表结构
-- 数据库：teset1
-- 创建时间：2024-12-30

-- 0. 用户表（用户登录系统）
CREATE TABLE IF NOT EXISTS `users` (
  `id` VARCHAR(36) NOT NULL PRIMARY KEY COMMENT '用户唯一标识符（UUID格式）',
  `username` VARCHAR(50) NOT NULL UNIQUE COMMENT '登录用户名',
  `password_hash` VARCHAR(255) NOT NULL COMMENT 'bcrypt加密的密码',
  `display_name` VARCHAR(100) NOT NULL COMMENT '显示名称',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `last_login_at` TIMESTAMP NULL COMMENT '最后登录时间',
  `is_active` BOOLEAN DEFAULT TRUE COMMENT '账号是否启用',
  
  -- 索引
  INDEX `idx_username` (`username`),
  INDEX `idx_is_active` (`is_active`),
  INDEX `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户表';

-- 1. 图片记录表
CREATE TABLE IF NOT EXISTS `images` (
  `id` VARCHAR(50) NOT NULL PRIMARY KEY COMMENT '图片唯一标识符',
  `url` TEXT NOT NULL COMMENT '图片访问URL',
  `original_url` TEXT COMMENT '原始临时URL（OSS上传前）',
  `prompt` TEXT NOT NULL COMMENT '生成提示词',
  `model` VARCHAR(100) NOT NULL COMMENT '使用的AI模型',
  `aspect_ratio` VARCHAR(20) DEFAULT 'auto' COMMENT '图像比例',
  `image_size` VARCHAR(10) DEFAULT '1K' COMMENT '图像尺寸',
  `ref_images` JSON COMMENT '参考图片信息（JSON格式）',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `tags` JSON COMMENT '标签列表（JSON格式）',
  `favorite` BOOLEAN DEFAULT FALSE COMMENT '是否收藏',
  `oss_key` TEXT COMMENT 'OSS对象键名',
  `oss_uploaded` BOOLEAN DEFAULT FALSE COMMENT '是否已上传到OSS',
  `user_id` VARCHAR(50) DEFAULT 'default' COMMENT '用户ID（预留多用户支持）',
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  
  -- 索引
  INDEX `idx_created_at` (`created_at`),
  INDEX `idx_model` (`model`),
  INDEX `idx_favorite` (`favorite`),
  INDEX `idx_user_id` (`user_id`),
  INDEX `idx_oss_uploaded` (`oss_uploaded`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='图片记录表';

-- 2. 用户配置表（可选，支持多用户）
CREATE TABLE IF NOT EXISTS `user_configs` (
  `user_id` VARCHAR(50) NOT NULL PRIMARY KEY COMMENT '用户ID',
  `api_config` JSON COMMENT 'API配置信息（JSON格式）',
  `oss_config` JSON COMMENT 'OSS配置信息（JSON格式）',
  `preferences` JSON COMMENT '用户偏好设置（JSON格式）',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户配置表';

-- 3. 参考图片表（去重存储）
CREATE TABLE IF NOT EXISTS `reference_images` (
  `id` VARCHAR(50) NOT NULL PRIMARY KEY COMMENT '参考图片唯一标识符',
  `hash` VARCHAR(64) NOT NULL UNIQUE COMMENT '图片内容SHA256哈希（用于去重）',
  `oss_key` VARCHAR(255) NOT NULL COMMENT 'OSS对象键名',
  `oss_url` TEXT NOT NULL COMMENT 'OSS访问URL',
  `original_name` VARCHAR(255) COMMENT '原始文件名',
  `size` INT UNSIGNED NOT NULL COMMENT '文件大小（字节）',
  `mime_type` VARCHAR(50) NOT NULL DEFAULT 'image/jpeg' COMMENT 'MIME类型',
  `width` INT UNSIGNED COMMENT '图片宽度',
  `height` INT UNSIGNED COMMENT '图片高度',
  `use_count` INT UNSIGNED DEFAULT 1 COMMENT '使用次数',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `last_used_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后使用时间',
  
  -- 索引
  INDEX `idx_hash` (`hash`),
  INDEX `idx_created_at` (`created_at`),
  INDEX `idx_use_count` (`use_count`),
  INDEX `idx_last_used_at` (`last_used_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='参考图片表（去重存储）';

-- 4. 同步日志表（可选，用于调试和监控）
CREATE TABLE IF NOT EXISTS `sync_logs` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '日志ID',
  `operation` VARCHAR(50) NOT NULL COMMENT '操作类型（INSERT/UPDATE/DELETE/SYNC）',
  `table_name` VARCHAR(50) NOT NULL COMMENT '操作的表名',
  `record_id` VARCHAR(50) COMMENT '操作的记录ID',
  `user_id` VARCHAR(50) DEFAULT 'default' COMMENT '用户ID',
  `status` ENUM('SUCCESS', 'FAILED') DEFAULT 'SUCCESS' COMMENT '操作状态',
  `error_message` TEXT COMMENT '错误信息（如果失败）',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  
  -- 索引
  INDEX `idx_created_at` (`created_at`),
  INDEX `idx_operation` (`operation`),
  INDEX `idx_user_id` (`user_id`),
  INDEX `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='同步日志表';

-- 插入默认用户配置（可选）
INSERT IGNORE INTO `user_configs` (`user_id`, `preferences`) VALUES 
('default', JSON_OBJECT(
  'autoSync', true,
  'syncInterval', 300,
  'maxLocalImages', 1000,
  'theme', 'dark'
));

-- 创建视图：最近生成的图片
CREATE OR REPLACE VIEW `recent_images` AS
SELECT 
  `id`,
  `url`,
  `prompt`,
  `model`,
  `aspect_ratio`,
  `image_size`,
  `favorite`,
  `oss_uploaded`,
  `created_at`
FROM `images`
WHERE `created_at` >= DATE_SUB(NOW(), INTERVAL 7 DAY)
ORDER BY `created_at` DESC;

-- 创建视图：收藏的图片
CREATE OR REPLACE VIEW `favorite_images` AS
SELECT 
  `id`,
  `url`,
  `prompt`,
  `model`,
  `aspect_ratio`,
  `image_size`,
  `created_at`,
  `oss_uploaded`
FROM `images`
WHERE `favorite` = TRUE
ORDER BY `created_at` DESC;

-- 创建视图：统计信息
CREATE OR REPLACE VIEW `image_stats` AS
SELECT 
  COUNT(*) as total_images,
  COUNT(CASE WHEN favorite = TRUE THEN 1 END) as favorite_count,
  COUNT(CASE WHEN oss_uploaded = TRUE THEN 1 END) as oss_uploaded_count,
  COUNT(CASE WHEN created_at >= DATE_SUB(NOW(), INTERVAL 1 DAY) THEN 1 END) as recent_count,
  model,
  COUNT(*) as model_count
FROM `images`
GROUP BY model
WITH ROLLUP;

-- 存储过程：清理旧数据（保留最新的1000条记录）
DELIMITER //
CREATE PROCEDURE CleanupOldImages()
BEGIN
  DECLARE total_count INT;
  
  -- 获取总记录数
  SELECT COUNT(*) INTO total_count FROM images;
  
  -- 如果超过1000条，删除最旧的记录（保留收藏的）
  IF total_count > 1000 THEN
    DELETE FROM images 
    WHERE favorite = FALSE 
    AND id NOT IN (
      SELECT id FROM (
        SELECT id FROM images 
        ORDER BY created_at DESC 
        LIMIT 1000
      ) AS keep_records
    );
  END IF;
END //
DELIMITER ;

-- 创建定时清理事件（可选，需要开启事件调度器）
-- SET GLOBAL event_scheduler = ON;
-- CREATE EVENT IF NOT EXISTS cleanup_old_images
-- ON SCHEDULE EVERY 1 DAY
-- STARTS CURRENT_TIMESTAMP
-- DO CALL CleanupOldImages();

-- 显示表结构信息
SHOW CREATE TABLE images;
SHOW CREATE TABLE user_configs;
SHOW CREATE TABLE sync_logs;
SHOW CREATE TABLE reference_images;
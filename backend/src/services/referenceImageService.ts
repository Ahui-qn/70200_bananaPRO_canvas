/**
 * 参考图片服务
 * 实现参考图片的去重存储、哈希计算和 OSS 上传
 */

import crypto from 'crypto';
import { storageManager } from './storageManager.js';
import { databaseManager } from './databaseManager.js';

// 参考图片记录接口
export interface ReferenceImage {
  id: string;              // 唯一标识符
  hash: string;            // 图片内容哈希（SHA256）
  ossKey: string;          // OSS 对象键名
  ossUrl: string;          // OSS 访问 URL
  originalName?: string;   // 原始文件名
  size: number;            // 文件大小（字节）
  mimeType: string;        // MIME 类型
  width?: number;          // 图片宽度
  height?: number;         // 图片高度
  useCount: number;        // 使用次数
  createdAt: Date;         // 创建时间
  lastUsedAt: Date;        // 最后使用时间
}

// 上传结果接口
export interface RefImageUploadResult {
  id: string;
  ossUrl: string;
  isNew: boolean;          // 是否为新上传（false 表示已存在，复用）
  hash: string;
}

class ReferenceImageService {
  /**
   * 计算图片内容的 SHA256 哈希
   */
  calculateHash(buffer: Buffer): string {
    return crypto.createHash('sha256').update(buffer).digest('hex');
  }

  /**
   * 从 Base64 字符串解析图片数据
   */
  parseBase64Image(base64String: string): { buffer: Buffer; mimeType: string } {
    // 处理 Data URL 格式: data:image/jpeg;base64,/9j/4AAQ...
    let mimeType = 'image/jpeg';
    let base64Data = base64String;

    if (base64String.startsWith('data:')) {
      const matches = base64String.match(/^data:([^;]+);base64,(.+)$/);
      if (matches) {
        mimeType = matches[1];
        base64Data = matches[2];
      }
    }

    const buffer = Buffer.from(base64Data, 'base64');
    return { buffer, mimeType };
  }

  /**
   * 生成参考图片的 OSS 键名
   */
  generateOssKey(hash: string, mimeType: string): string {
    const ext = mimeType.split('/')[1] || 'jpg';
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    
    // 使用哈希前缀分散存储，便于管理
    const hashPrefix = hash.substring(0, 4);
    return `ref-images/${year}/${month}/${hashPrefix}/${hash}.${ext}`;
  }

  /**
   * 上传参考图片（带去重）
   * 如果图片已存在，返回现有记录；否则上传新图片
   */
  async uploadRefImage(base64String: string, originalName?: string): Promise<RefImageUploadResult> {
    // 解析 Base64 图片
    const { buffer, mimeType } = this.parseBase64Image(base64String);
    
    // 计算哈希
    const hash = this.calculateHash(buffer);
    
    // 检查是否已存在
    const existing = await this.findByHash(hash);
    if (existing) {
      console.log(`参考图片已存在，复用: ${hash.substring(0, 8)}...`);
      
      // 更新使用次数和最后使用时间
      await this.incrementUseCount(existing.id);
      
      return {
        id: existing.id,
        ossUrl: existing.ossUrl,
        isNew: false,
        hash
      };
    }

    // 上传到存储服务
    if (!storageManager.isConfigured()) {
      throw new Error('存储服务未配置，无法上传参考图片');
    }

    const ossKey = this.generateOssKey(hash, mimeType);
    const uploadResult = await storageManager.uploadFromBuffer(buffer, mimeType, ossKey);

    // 保存到数据库
    const refImage: ReferenceImage = {
      id: `ref_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      hash,
      ossKey: uploadResult.key,
      ossUrl: uploadResult.url,
      originalName,
      size: buffer.length,
      mimeType,
      useCount: 1,
      createdAt: new Date(),
      lastUsedAt: new Date()
    };

    await this.saveRefImage(refImage);
    console.log(`参考图片上传成功: ${hash.substring(0, 8)}... -> ${uploadResult.url}`);

    return {
      id: refImage.id,
      ossUrl: refImage.ossUrl,
      isNew: true,
      hash
    };
  }

  /**
   * 批量上传参考图片（带去重）
   */
  async uploadRefImages(base64Images: string[]): Promise<RefImageUploadResult[]> {
    const results: RefImageUploadResult[] = [];
    
    for (const base64 of base64Images) {
      try {
        const result = await this.uploadRefImage(base64);
        results.push(result);
      } catch (error: any) {
        console.error('上传参考图片失败:', error.message);
        throw error;
      }
    }

    return results;
  }

  /**
   * 根据哈希查找参考图片
   */
  async findByHash(hash: string): Promise<ReferenceImage | null> {
    try {
      const connection = databaseService.getConnection();
      if (!connection) {
        return null;
      }

      const [rows] = await connection.execute(
        'SELECT * FROM reference_images WHERE hash = ?',
        [hash]
      );

      const results = rows as any[];
      if (results.length === 0) {
        return null;
      }

      return this.rowToRefImage(results[0]);
    } catch (error: any) {
      // 表可能不存在，返回 null
      if (error.code === 'ER_NO_SUCH_TABLE') {
        return null;
      }
      throw error;
    }
  }

  /**
   * 保存参考图片记录到数据库
   */
  async saveRefImage(refImage: ReferenceImage): Promise<void> {
    const connection = databaseService.getConnection();
    if (!connection) {
      throw new Error('数据库未连接');
    }

    const sql = `
      INSERT INTO reference_images (
        id, hash, oss_key, oss_url, original_name, size, mime_type,
        width, height, use_count, created_at, last_used_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    await connection.execute(sql, [
      refImage.id,
      refImage.hash,
      refImage.ossKey,
      refImage.ossUrl,
      refImage.originalName || null,
      refImage.size,
      refImage.mimeType,
      refImage.width || null,
      refImage.height || null,
      refImage.useCount,
      refImage.createdAt,
      refImage.lastUsedAt
    ]);
  }

  /**
   * 增加使用次数
   */
  async incrementUseCount(id: string): Promise<void> {
    const connection = databaseService.getConnection();
    if (!connection) {
      return;
    }

    await connection.execute(
      'UPDATE reference_images SET use_count = use_count + 1, last_used_at = ? WHERE id = ?',
      [new Date(), id]
    );
  }

  /**
   * 根据 ID 获取参考图片
   */
  async getById(id: string): Promise<ReferenceImage | null> {
    const connection = databaseService.getConnection();
    if (!connection) {
      return null;
    }

    const [rows] = await connection.execute(
      'SELECT * FROM reference_images WHERE id = ?',
      [id]
    );

    const results = rows as any[];
    if (results.length === 0) {
      return null;
    }

    return this.rowToRefImage(results[0]);
  }

  /**
   * 获取参考图片统计信息
   */
  async getStatistics(): Promise<{
    totalCount: number;
    totalSize: number;
    uniqueCount: number;
    savedSize: number;
  }> {
    const connection = databaseService.getConnection();
    if (!connection) {
      return { totalCount: 0, totalSize: 0, uniqueCount: 0, savedSize: 0 };
    }

    try {
      const [rows] = await connection.execute(`
        SELECT 
          COUNT(*) as unique_count,
          SUM(size) as total_size,
          SUM(use_count) as total_uses,
          SUM(size * (use_count - 1)) as saved_size
        FROM reference_images
      `);

      const result = (rows as any[])[0];
      return {
        totalCount: Number(result.total_uses) || 0,
        totalSize: Number(result.total_size) || 0,
        uniqueCount: Number(result.unique_count) || 0,
        savedSize: Number(result.saved_size) || 0
      };
    } catch (error: any) {
      if (error.code === 'ER_NO_SUCH_TABLE') {
        return { totalCount: 0, totalSize: 0, uniqueCount: 0, savedSize: 0 };
      }
      throw error;
    }
  }

  /**
   * 清理未使用的参考图片（可选，用于定期清理）
   */
  async cleanupUnused(daysOld: number = 30): Promise<number> {
    const connection = databaseService.getConnection();
    if (!connection) {
      return 0;
    }

    // 查找超过指定天数未使用且使用次数为 1 的图片
    const [rows] = await connection.execute(`
      SELECT id, oss_key FROM reference_images 
      WHERE use_count = 1 
      AND last_used_at < DATE_SUB(NOW(), INTERVAL ? DAY)
    `, [daysOld]);

    const toDelete = rows as any[];
    let deleted = 0;

    for (const row of toDelete) {
      try {
        // 删除存储文件
        await storageManager.deleteObject(row.oss_key);
        
        // 删除数据库记录
        await connection.execute('DELETE FROM reference_images WHERE id = ?', [row.id]);
        deleted++;
      } catch (error) {
        console.error(`清理参考图片失败: ${row.id}`, error);
      }
    }

    console.log(`清理了 ${deleted} 张未使用的参考图片`);
    return deleted;
  }

  /**
   * 将数据库行转换为 ReferenceImage 对象
   */
  private rowToRefImage(row: any): ReferenceImage {
    return {
      id: row.id,
      hash: row.hash,
      ossKey: row.oss_key,
      ossUrl: row.oss_url,
      originalName: row.original_name,
      size: row.size,
      mimeType: row.mime_type,
      width: row.width,
      height: row.height,
      useCount: row.use_count,
      createdAt: new Date(row.created_at),
      lastUsedAt: new Date(row.last_used_at)
    };
  }
}

// 导出单例实例
export const referenceImageService = new ReferenceImageService();

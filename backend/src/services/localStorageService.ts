/**
 * 本地存储服务
 * 用于将生成的图片保存到本地 NAS 目录
 * 实现与 aliOssService 相同的接口，支持存储模式切换
 */

import fs from 'fs/promises';
import path from 'path';
import sharp from 'sharp';

// 上传结果接口（与 aliOssService 保持一致）
interface UploadResult {
  url: string;           // 访问 URL
  key: string;           // 文件路径键名
  size: number;          // 文件大小
}

// 本地存储配置接口
interface LocalStorageConfig {
  basePath: string;      // NAS 挂载路径
  serverUrl: string;     // 服务器访问地址
}

class LocalStorageService {
  private config: LocalStorageConfig | null = null;

  /**
   * 从环境变量初始化本地存储配置
   */
  initialize(): boolean {
    const basePath = process.env.LOCAL_STORAGE_PATH;
    const serverUrl = process.env.LOCAL_SERVER_URL;

    if (!basePath || !serverUrl) {
      console.warn('本地存储配置不完整，请检查 .env 文件中的 LOCAL_STORAGE_PATH 和 LOCAL_SERVER_URL');
      return false;
    }

    this.config = {
      basePath,
      serverUrl: serverUrl.replace(/\/$/, '') // 移除末尾斜杠
    };

    console.log('✅ 本地存储服务初始化成功');
    console.log(`   存储路径: ${basePath}`);
    console.log(`   服务地址: ${serverUrl}`);
    return true;
  }

  /**
   * 检查本地存储是否已配置
   */
  isConfigured(): boolean {
    return this.config !== null;
  }

  /**
   * 生成唯一的文件路径键名
   * 格式：nano-banana/年/月/日/时间戳_随机字符串.jpg
   */
  private generateFileKey(prefix: string = 'nano-banana'): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 8);
    
    return `${prefix}/${year}/${month}/${day}/${timestamp}_${randomStr}.jpg`;
  }

  /**
   * 确保目录存在，不存在则创建
   */
  private async ensureDirectoryExists(dirPath: string): Promise<void> {
    try {
      await fs.access(dirPath);
    } catch {
      await fs.mkdir(dirPath, { recursive: true });
      console.log(`创建目录: ${dirPath}`);
    }
  }

  /**
   * 从 URL 下载图片并保存到本地
   */
  async uploadFromUrl(imageUrl: string, customKey?: string): Promise<UploadResult> {
    if (!this.config) {
      throw new Error('本地存储服务未初始化，请先调用 initialize()');
    }

    try {
      console.log('开始下载图片:', imageUrl);
      
      // 下载图片
      const response = await fetch(imageUrl);
      if (!response.ok) {
        throw new Error(`下载图片失败: ${response.status} ${response.statusText}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      
      console.log('图片下载成功，大小:', buffer.length, 'bytes');

      // 使用 uploadFromBuffer 保存
      return await this.uploadFromBuffer(buffer, 'image/jpeg', customKey);
    } catch (error: any) {
      console.error('从 URL 上传图片失败:', error);
      throw new Error(`从 URL 上传图片失败: ${error.message}`);
    }
  }

  /**
   * 从 Buffer 保存图片到本地
   */
  async uploadFromBuffer(buffer: Buffer, contentType: string = 'image/jpeg', customKey?: string): Promise<UploadResult> {
    if (!this.config) {
      throw new Error('本地存储服务未初始化，请先调用 initialize()');
    }

    try {
      // 生成文件键名
      const fileKey = customKey || this.generateFileKey();
      const fullPath = path.join(this.config.basePath, fileKey);
      const dirPath = path.dirname(fullPath);
      
      // 确保目录存在
      await this.ensureDirectoryExists(dirPath);
      
      // 保存文件
      await fs.writeFile(fullPath, buffer);
      
      const size = buffer.length;
      
      // 构建访问 URL
      const url = `${this.config.serverUrl}/api/static-images/${fileKey}`;

      console.log('本地存储保存成功:', fullPath);
      console.log('访问 URL:', url);

      return {
        url,
        key: fileKey,
        size
      };
    } catch (error: any) {
      console.error('保存图片到本地失败:', error);
      throw new Error(`保存图片到本地失败: ${error.message}`);
    }
  }

  /**
   * 上传缩略图到本地
   * 缩略图使用 _thumb 后缀，WebP 格式
   * @param buffer 缩略图数据
   * @param originalKey 原图的文件键名
   * @returns 上传结果
   */
  async uploadThumbnail(buffer: Buffer, originalKey: string): Promise<{ url: string; key: string }> {
    if (!this.config) {
      throw new Error('本地存储服务未初始化，请先调用 initialize()');
    }

    try {
      // 生成缩略图键名：将扩展名改为 _thumb.webp
      // 例如：nano-banana/2024/01/02/xxx.jpg -> nano-banana/2024/01/02/xxx_thumb.webp
      const thumbKey = originalKey.replace(/\.[^.]+$/, '_thumb.webp');
      const fullPath = path.join(this.config.basePath, thumbKey);
      const dirPath = path.dirname(fullPath);
      
      // 确保目录存在
      await this.ensureDirectoryExists(dirPath);
      
      // 保存缩略图
      await fs.writeFile(fullPath, buffer);
      
      // 构建访问 URL
      const url = `${this.config.serverUrl}/api/static-images/${thumbKey}`;

      console.log('缩略图保存成功:', fullPath);

      return {
        url,
        key: thumbKey
      };
    } catch (error: any) {
      console.error('保存缩略图到本地失败:', error);
      throw new Error(`保存缩略图到本地失败: ${error.message}`);
    }
  }

  /**
   * 生成缩略图
   * 使用 sharp 库生成 WebP 格式缩略图，较长边 400px
   * @param buffer 原图数据
   * @returns 缩略图 Buffer
   */
  async generateThumbnail(buffer: Buffer): Promise<Buffer> {
    try {
      const thumbnail = await sharp(buffer)
        .resize(400, 400, {
          fit: 'inside',           // 保持比例，较长边为 400px
          withoutEnlargement: true // 不放大小图
        })
        .webp({ quality: 80 })     // 转换为 WebP 格式
        .toBuffer();
      
      return thumbnail;
    } catch (error: any) {
      console.error('生成缩略图失败:', error);
      throw new Error(`生成缩略图失败: ${error.message}`);
    }
  }

  /**
   * 删除本地文件
   */
  async deleteObject(key: string): Promise<boolean> {
    if (!this.config) {
      throw new Error('本地存储服务未初始化');
    }

    try {
      const fullPath = path.join(this.config.basePath, key);
      
      // 删除原图
      try {
        await fs.unlink(fullPath);
        console.log('删除文件成功:', fullPath);
      } catch (error: any) {
        if (error.code !== 'ENOENT') {
          throw error;
        }
        console.log('文件不存在，跳过删除:', fullPath);
      }
      
      // 尝试删除对应的缩略图
      const thumbKey = key.replace(/\.[^.]+$/, '_thumb.webp');
      const thumbPath = path.join(this.config.basePath, thumbKey);
      try {
        await fs.unlink(thumbPath);
        console.log('删除缩略图成功:', thumbPath);
      } catch (error: any) {
        if (error.code !== 'ENOENT') {
          console.warn('删除缩略图失败:', error.message);
        }
      }
      
      return true;
    } catch (error: any) {
      console.error('删除本地文件失败:', error);
      return false;
    }
  }

  /**
   * 批量删除本地文件
   */
  async deleteObjects(keys: string[]): Promise<{ success: number; failed: number }> {
    if (!this.config) {
      throw new Error('本地存储服务未初始化');
    }

    let success = 0;
    let failed = 0;

    for (const key of keys) {
      const result = await this.deleteObject(key);
      if (result) {
        success++;
      } else {
        failed++;
      }
    }

    return { success, failed };
  }

  /**
   * 测试本地存储连接（检查目录是否可访问）
   */
  async testConnection(): Promise<boolean> {
    if (!this.config) {
      throw new Error('本地存储服务未初始化');
    }

    try {
      // 检查基础目录是否存在
      await fs.access(this.config.basePath);
      
      // 尝试创建测试文件
      const testFile = path.join(this.config.basePath, '.test_connection');
      await fs.writeFile(testFile, 'test');
      await fs.unlink(testFile);
      
      console.log('本地存储连接测试成功');
      return true;
    } catch (error: any) {
      console.error('本地存储连接测试失败:', error);
      throw new Error(`本地存储连接测试失败: ${error.message}`);
    }
  }

  /**
   * 获取本地存储配置信息
   */
  getConfigInfo(): { basePath: string; serverUrl: string } | null {
    if (!this.config) {
      return null;
    }

    return {
      basePath: this.config.basePath,
      serverUrl: this.config.serverUrl
    };
  }
}

// 导出单例实例和类
export const localStorageService = new LocalStorageService();
export { LocalStorageService };

/**
 * 阿里云 OSS 服务
 * 用于将生成的图片上传到阿里云对象存储
 */

import OSS from 'ali-oss';

// OSS 配置接口
interface OSSConfig {
  region: string;
  accessKeyId: string;
  accessKeySecret: string;
  bucket: string;
  endpoint?: string;
}

// 上传结果接口
interface UploadResult {
  url: string;           // 访问 URL
  ossKey: string;        // OSS 对象键名
  size: number;          // 文件大小
}

class AliOssService {
  private client: OSS | null = null;
  private config: OSSConfig | null = null;

  /**
   * 从环境变量初始化 OSS 配置
   */
  initialize(): boolean {
    const region = process.env.OSS_REGION;
    const accessKeyId = process.env.OSS_ACCESS_KEY_ID;
    const accessKeySecret = process.env.OSS_ACCESS_KEY_SECRET;
    const bucket = process.env.OSS_BUCKET;
    const endpoint = process.env.OSS_ENDPOINT;

    if (!region || !accessKeyId || !accessKeySecret || !bucket) {
      console.warn('OSS 配置不完整，请检查 .env 文件中的 OSS 配置');
      return false;
    }

    this.config = {
      region,
      accessKeyId,
      accessKeySecret,
      bucket,
      endpoint
    };

    try {
      this.client = new OSS({
        region,
        accessKeyId,
        accessKeySecret,
        bucket,
        endpoint: endpoint || undefined,
        secure: true  // 使用 HTTPS
      });
      
      console.log('✅ OSS 服务初始化成功');
      return true;
    } catch (error) {
      console.error('OSS 服务初始化失败:', error);
      return false;
    }
  }

  /**
   * 检查 OSS 是否已配置
   */
  isConfigured(): boolean {
    return this.client !== null && this.config !== null;
  }

  /**
   * 生成唯一的对象键名
   */
  private generateObjectKey(prefix: string = 'nano-banana'): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 8);
    
    return `${prefix}/${year}/${month}/${day}/${timestamp}_${randomStr}.jpg`;
  }

  /**
   * 从 URL 下载图片并上传到 OSS
   */
  async uploadFromUrl(imageUrl: string, customKey?: string): Promise<UploadResult> {
    if (!this.client || !this.config) {
      throw new Error('OSS 服务未初始化，请先调用 initialize()');
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
      const size = buffer.length;
      
      console.log('图片下载成功，大小:', size, 'bytes');

      // 生成对象键名
      const ossKey = customKey || this.generateObjectKey();
      console.log('OSS 对象键名:', ossKey);

      // 上传到 OSS
      const result = await this.client.put(ossKey, buffer, {
        headers: {
          'Content-Type': 'image/jpeg',
          'x-oss-object-acl': 'public-read'  // 设置为公共读
        }
      });

      console.log('OSS 上传成功:', result.url);

      // 构建访问 URL - 使用标准格式: https://{bucket}.{region}.aliyuncs.com/{key}
      const url = `https://${this.config.bucket}.${this.config.region}.aliyuncs.com/${ossKey}`;

      return {
        url,
        ossKey,
        size
      };
    } catch (error: any) {
      console.error('上传图片到 OSS 失败:', error);
      throw new Error(`上传图片到 OSS 失败: ${error.message}`);
    }
  }

  /**
   * 从 Buffer 上传图片到 OSS
   */
  async uploadFromBuffer(buffer: Buffer, contentType: string = 'image/jpeg', customKey?: string): Promise<UploadResult> {
    if (!this.client || !this.config) {
      throw new Error('OSS 服务未初始化，请先调用 initialize()');
    }

    try {
      const ossKey = customKey || this.generateObjectKey();
      
      const result = await this.client.put(ossKey, buffer, {
        headers: {
          'Content-Type': contentType,
          'x-oss-object-acl': 'public-read'
        }
      });

      // 构建访问 URL - 使用标准格式
      const url = `https://${this.config.bucket}.${this.config.region}.aliyuncs.com/${ossKey}`;

      return {
        url,
        ossKey,
        size: buffer.length
      };
    } catch (error: any) {
      console.error('上传 Buffer 到 OSS 失败:', error);
      throw new Error(`上传 Buffer 到 OSS 失败: ${error.message}`);
    }
  }

  /**
   * 删除 OSS 对象
   */
  async deleteObject(ossKey: string): Promise<boolean> {
    if (!this.client) {
      throw new Error('OSS 服务未初始化');
    }

    try {
      await this.client.delete(ossKey);
      console.log('OSS 对象删除成功:', ossKey);
      return true;
    } catch (error: any) {
      console.error('删除 OSS 对象失败:', error);
      return false;
    }
  }

  /**
   * 批量删除 OSS 对象
   */
  async deleteObjects(ossKeys: string[]): Promise<{ success: number; failed: number }> {
    if (!this.client) {
      throw new Error('OSS 服务未初始化');
    }

    let success = 0;
    let failed = 0;

    for (const key of ossKeys) {
      try {
        await this.client.delete(key);
        success++;
      } catch (error) {
        console.error(`删除 OSS 对象失败: ${key}`, error);
        failed++;
      }
    }

    return { success, failed };
  }

  /**
   * 测试 OSS 连接
   */
  async testConnection(): Promise<boolean> {
    if (!this.client) {
      return false;
    }

    try {
      // 尝试列出存储桶中的对象（限制 1 个）
      await this.client.list({ 'max-keys': 1 }, {});
      console.log('OSS 连接测试成功');
      return true;
    } catch (error: any) {
      console.error('OSS 连接测试失败:', error);
      return false;
    }
  }

  /**
   * 获取 OSS 配置信息（隐藏敏感信息）
   */
  getConfigInfo(): { region: string; bucket: string; endpoint?: string } | null {
    if (!this.config) {
      return null;
    }

    return {
      region: this.config.region,
      bucket: this.config.bucket,
      endpoint: this.config.endpoint
    };
  }
}

// 导出单例实例
export const aliOssService = new AliOssService();

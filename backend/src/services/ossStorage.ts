import { SavedImage } from '@shared/types';

/**
 * 阿里云 OSS 配置接口
 */
export interface OSSConfig {
  region: string;           // OSS 区域，如 'oss-cn-hangzhou'
  accessKeyId: string;      // AccessKey ID
  accessKeySecret: string;  // AccessKey Secret
  bucket: string;           // 存储桶名称
  endpoint?: string;        // 自定义域名（可选）
}

/**
 * OSS 上传结果
 */
export interface OSSUploadResult {
  url: string;              // 上传后的访问URL
  key: string;              // OSS 对象键名
  size: number;             // 文件大小
}

/**
 * 阿里云 OSS 存储服务类
 * 使用简化的浏览器端上传方式
 */
class OSSStorageService {
  private config: OSSConfig | null = null;

  /**
   * 设置 OSS 配置
   */
  setConfig(config: OSSConfig): void {
    this.config = config;
  }

  /**
   * 获取当前配置
   */
  getConfig(): OSSConfig | null {
    return this.config;
  }

  /**
   * 检查是否已配置
   */
  isConfigured(): boolean {
    return this.config !== null && 
           this.config.accessKeyId !== '' && 
           this.config.accessKeySecret !== '' && 
           this.config.bucket !== '' && 
           this.config.region !== '';
  }

  /**
   * 生成唯一的对象键名
   */
  private generateObjectKey(originalName: string, prefix: string = 'nano-banana'): string {
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 8);
    const extension = originalName.split('.').pop() || 'jpg';
    
    return `${prefix}/${new Date().getFullYear()}/${String(new Date().getMonth() + 1).padStart(2, '0')}/${timestamp}_${randomStr}.${extension}`;
  }

  /**
   * 使用简化方式上传图片到 OSS
   * 注意：这种方式需要 OSS 存储桶设置为公共读写或配置正确的 CORS 规则
   */
  async uploadImageFromUrl(imageUrl: string, filename?: string): Promise<OSSUploadResult> {
    if (!this.isConfigured()) {
      throw new Error('OSS 配置不完整，请先配置 OSS 参数');
    }

    try {
      // 下载图片
      console.log('开始下载图片:', imageUrl);
      const response = await fetch(imageUrl, {
        mode: 'cors'
      });
      
      if (!response.ok) {
        throw new Error(`下载图片失败: ${response.status} ${response.statusText}`);
      }

      const blob = await response.blob();
      console.log('图片下载成功，大小:', blob.size);
      
      // 生成文件名
      const objectKey = this.generateObjectKey(filename || 'generated-image.jpg');
      console.log('生成对象键名:', objectKey);
      
      // 使用简化上传方式
      return await this.simpleUpload(blob, objectKey);
      
    } catch (error) {
      console.error('从 URL 上传图片到 OSS 失败:', error);
      throw error;
    }
  }

  /**
   * 简化的上传方法
   * 直接使用 PUT 请求上传文件
   */
  private async simpleUpload(blob: Blob, objectKey: string): Promise<OSSUploadResult> {
    if (!this.config) {
      throw new Error('OSS 配置未设置');
    }

    try {
      // 构建上传 URL
      const uploadUrl = `https://${this.config.bucket}.${this.config.region}.aliyuncs.com/${objectKey}`;
      
      console.log('上传 URL:', uploadUrl);
      console.log('文件大小:', blob.size);

      // 直接使用 PUT 请求上传
      const uploadResponse = await fetch(uploadUrl, {
        method: 'PUT',
        body: blob,
        headers: {
          'Content-Type': blob.type || 'image/jpeg',
          'x-oss-object-acl': 'public-read'
        },
        mode: 'cors'
      });

      console.log('上传响应状态:', uploadResponse.status);

      if (!uploadResponse.ok) {
        const errorText = await uploadResponse.text();
        console.error('上传失败响应:', errorText);
        throw new Error(`OSS 上传失败: ${uploadResponse.status} ${errorText}`);
      }

      // 构建访问 URL
      const accessUrl = this.config.endpoint 
        ? `https://${this.config.endpoint}/${objectKey}`
        : `https://${this.config.bucket}.${this.config.region}.aliyuncs.com/${objectKey}`;

      console.log('上传成功，访问 URL:', accessUrl);

      return {
        url: accessUrl,
        key: objectKey,
        size: blob.size
      };

    } catch (error) {
      console.error('简化上传失败:', error);
      throw error;
    }
  }

  /**
   * 保存图片到 OSS 并更新本地记录
   */
  async saveImageToOSS(savedImage: SavedImage): Promise<SavedImage & { ossKey?: string }> {
    if (!this.isConfigured()) {
      throw new Error('OSS 配置不完整，请先配置 OSS 参数');
    }

    try {
      // 上传图片到 OSS
      const uploadResult = await this.uploadImageFromUrl(
        savedImage.url, 
        `${savedImage.prompt.slice(0, 20).replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_')}_${savedImage.id}.jpg`
      );

      // 更新图片记录，使用 OSS URL
      const updatedImage: SavedImage & { ossKey?: string } = {
        ...savedImage,
        url: uploadResult.url,
        // 保留原始 URL 作为备份
        originalUrl: savedImage.url,
        ossKey: uploadResult.key,
        ossUploaded: true
      };

      return updatedImage;

    } catch (error) {
      console.error('保存图片到 OSS 失败:', error);
      throw error;
    }
  }

  /**
   * 批量上传图片到 OSS
   */
  async batchUploadToOSS(images: SavedImage[], onProgress?: (completed: number, total: number) => void): Promise<SavedImage[]> {
    if (!this.isConfigured()) {
      throw new Error('OSS 配置不完整，请先配置 OSS 参数');
    }

    const results: SavedImage[] = [];
    
    for (let i = 0; i < images.length; i++) {
      try {
        const updatedImage = await this.saveImageToOSS(images[i]);
        results.push(updatedImage);
        
        if (onProgress) {
          onProgress(i + 1, images.length);
        }
        
        // 添加延迟避免请求过于频繁
        if (i < images.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
        
      } catch (error) {
        console.error(`上传第 ${i + 1} 张图片失败:`, error);
        // 保留原始图片记录
        results.push(images[i]);
      }
    }

    return results;
  }

  /**
   * 删除 OSS 中的图片
   * 注意：这需要服务端支持，浏览器端无法直接删除 OSS 对象
   */
  async deleteFromOSS(objectKey: string): Promise<void> {
    console.warn('浏览器端无法直接删除 OSS 对象，请在服务端实现删除功能');
    // 这里可以调用后端 API 来删除 OSS 对象
  }

  /**
   * 测试 OSS 连接
   */
  async testConnection(): Promise<boolean> {
    if (!this.isConfigured()) {
      return false;
    }

    try {
      // 创建一个小的测试文件
      const testContent = `OSS连接测试 - ${new Date().toISOString()}`;
      const testBlob = new Blob([testContent], { type: 'text/plain' });
      const testKey = `test/${Date.now()}_connection_test.txt`;
      
      console.log('开始 OSS 连接测试...');
      await this.simpleUpload(testBlob, testKey);
      
      console.log('OSS 连接测试成功');
      return true;
      
    } catch (error) {
      console.error('OSS 连接测试失败:', error);
      return false;
    }
  }
}

// 创建单例实例
export const ossStorage = new OSSStorageService();

// 工具函数：从本地存储加载 OSS 配置
export const loadOSSConfig = (): OSSConfig | null => {
  try {
    const configStr = localStorage.getItem('oss-config');
    if (configStr) {
      const config = JSON.parse(configStr);
      ossStorage.setConfig(config);
      return config;
    }
  } catch (error) {
    console.error('加载 OSS 配置失败:', error);
  }
  return null;
};

// 工具函数：保存 OSS 配置到本地存储
export const saveOSSConfig = (config: OSSConfig): void => {
  try {
    localStorage.setItem('oss-config', JSON.stringify(config));
    ossStorage.setConfig(config);
  } catch (error) {
    console.error('保存 OSS 配置失败:', error);
    throw error;
  }
};

// 工具函数：清除 OSS 配置
export const clearOSSConfig = (): void => {
  try {
    localStorage.removeItem('oss-config');
    ossStorage.setConfig(undefined as any);
  } catch (error) {
    console.error('清除 OSS 配置失败:', error);
  }
};
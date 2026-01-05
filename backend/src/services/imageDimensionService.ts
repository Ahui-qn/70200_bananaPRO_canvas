/**
 * 图片尺寸服务
 * 负责从图片数据中提取实际尺寸并生成缩略图
 */

import sharp from 'sharp';

// 图片尺寸接口
export interface ImageDimensions {
  width: number;   // 图片宽度（像素）
  height: number;  // 图片高度（像素）
}

// 缩略图结果接口
export interface ThumbnailResult {
  buffer: Buffer;  // 缩略图数据
  width: number;   // 缩略图宽度
  height: number;  // 缩略图高度
}

// 图片处理结果接口
export interface ProcessedImageResult {
  buffer: Buffer;              // 原始图片数据
  dimensions: ImageDimensions; // 图片尺寸
  thumbnail: ThumbnailResult;  // 缩略图
}

// 默认预设尺寸（当提取失败时使用）
const DEFAULT_DIMENSIONS: ImageDimensions = {
  width: 1024,
  height: 1024,
};

// 缩略图较长边的目标尺寸
const THUMBNAIL_MAX_SIZE = 400;

// 尺寸提取超时时间（毫秒）
const DIMENSION_TIMEOUT = 500;

class ImageDimensionService {
  /**
   * 从 Buffer 获取图片尺寸
   * @param buffer 图片数据
   * @returns 图片尺寸，失败时返回预设尺寸
   */
  async getDimensions(buffer: Buffer): Promise<ImageDimensions> {
    try {
      // 使用 Promise.race 实现超时控制
      const timeoutPromise = new Promise<ImageDimensions>((_, reject) => {
        setTimeout(() => reject(new Error('尺寸提取超时')), DIMENSION_TIMEOUT);
      });

      const extractPromise = this.extractDimensions(buffer);

      return await Promise.race([extractPromise, timeoutPromise]);
    } catch (error: any) {
      console.warn('获取图片尺寸失败，使用预设尺寸:', error.message);
      return DEFAULT_DIMENSIONS;
    }
  }

  /**
   * 实际提取尺寸的方法
   */
  private async extractDimensions(buffer: Buffer): Promise<ImageDimensions> {
    const metadata = await sharp(buffer).metadata();
    
    if (!metadata.width || !metadata.height) {
      throw new Error('无法获取图片尺寸');
    }

    return {
      width: metadata.width,
      height: metadata.height,
    };
  }

  /**
   * 生成缩略图（较长边 400px）
   * @param buffer 原始图片数据
   * @returns 缩略图结果
   */
  async generateThumbnail(buffer: Buffer): Promise<ThumbnailResult> {
    try {
      // 先获取原始尺寸
      const metadata = await sharp(buffer).metadata();
      
      if (!metadata.width || !metadata.height) {
        throw new Error('无法获取图片尺寸');
      }

      const { width, height } = metadata;
      
      // 计算缩略图尺寸（较长边为 400px，保持宽高比）
      let thumbWidth: number;
      let thumbHeight: number;

      if (width >= height) {
        // 宽度是较长边
        thumbWidth = THUMBNAIL_MAX_SIZE;
        thumbHeight = Math.round((height / width) * THUMBNAIL_MAX_SIZE);
      } else {
        // 高度是较长边
        thumbHeight = THUMBNAIL_MAX_SIZE;
        thumbWidth = Math.round((width / height) * THUMBNAIL_MAX_SIZE);
      }

      // 生成缩略图（使用 WebP 格式，比 JPEG 更小）
      const thumbnailBuffer = await sharp(buffer)
        .resize(thumbWidth, thumbHeight, {
          fit: 'inside',
          withoutEnlargement: true, // 如果原图比缩略图小，不放大
        })
        .webp({ quality: 75 }) // 使用 WebP 格式，质量 75%
        .toBuffer();

      // 获取实际生成的缩略图尺寸
      const thumbMetadata = await sharp(thumbnailBuffer).metadata();

      return {
        buffer: thumbnailBuffer,
        width: thumbMetadata.width || thumbWidth,
        height: thumbMetadata.height || thumbHeight,
      };
    } catch (error: any) {
      console.error('生成缩略图失败:', error.message);
      throw error;
    }
  }

  /**
   * 从 URL 下载图片并获取尺寸和缩略图
   * @param url 图片 URL
   * @returns 处理结果（包含原始数据、尺寸和缩略图）
   */
  async processImageFromUrl(url: string): Promise<ProcessedImageResult> {
    try {
      console.log('开始下载图片:', url);
      
      // 下载图片
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`下载图片失败: ${response.status} ${response.statusText}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      
      console.log('图片下载成功，大小:', buffer.length, 'bytes');

      // 并行获取尺寸和生成缩略图
      const [dimensions, thumbnail] = await Promise.all([
        this.getDimensions(buffer),
        this.generateThumbnail(buffer),
      ]);

      console.log('图片处理完成，尺寸:', dimensions, '缩略图尺寸:', thumbnail.width, 'x', thumbnail.height);

      return {
        buffer,
        dimensions,
        thumbnail,
      };
    } catch (error: any) {
      console.error('处理图片失败:', error.message);
      throw error;
    }
  }

  /**
   * 获取默认预设尺寸
   */
  getDefaultDimensions(): ImageDimensions {
    return { ...DEFAULT_DIMENSIONS };
  }
}

// 导出单例实例
export const imageDimensionService = new ImageDimensionService();

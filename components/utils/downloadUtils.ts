/**
 * 下载工具函数
 */

import { SavedImage } from '../../types';

/**
 * 将图片URL转换为Blob用于下载
 */
export const downloadImage = async (url: string, filename: string): Promise<void> => {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    
    const downloadUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    URL.revokeObjectURL(downloadUrl);
  } catch (error) {
    console.error('下载图片失败:', error);
    throw new Error('下载失败，请重试');
  }
};

/**
 * 批量下载图片为ZIP文件
 * 注意：这里需要引入 JSZip 库来创建 ZIP 文件
 * 暂时提供一个简化版本，后续可以完善
 */
export const downloadImagesAsZip = async (images: SavedImage[]): Promise<void> => {
  console.log('批量下载功能需要 JSZip 库支持');
  
  // 简化版：逐个下载
  for (let i = 0; i < images.length; i++) {
    const image = images[i];
    const filename = `${image.prompt.slice(0, 20).replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_')}_${image.id}.jpg`;
    await downloadImage(image.url, filename);
    
    // 添加延迟避免浏览器限制
    if (i < images.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
};
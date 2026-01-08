/**
 * 图片下载工具函数
 * 通过 fetch 获取图片 blob 后触发浏览器下载对话框
 */

/**
 * 下载图片到本地
 * @param url 图片 URL
 * @param filename 保存的文件名
 */
export async function downloadImage(url: string, filename: string): Promise<void> {
  try {
    // 通过 fetch 获取图片数据
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`下载失败: ${response.status}`);
    }
    
    // 转换为 blob
    const blob = await response.blob();
    
    // 创建临时 URL
    const blobUrl = URL.createObjectURL(blob);
    
    // 创建下载链接
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = filename;
    
    // 触发下载
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // 释放 blob URL
    URL.revokeObjectURL(blobUrl);
  } catch (error) {
    console.error('下载图片失败:', error);
    // 降级方案：直接打开图片
    window.open(url, '_blank');
  }
}

/**
 * 生成下载文件名
 * @param imageId 图片 ID
 * @param extension 文件扩展名
 */
export function generateDownloadFilename(imageId: string, extension: string = 'jpg'): string {
  return `nano-banana-${imageId}.${extension}`;
}

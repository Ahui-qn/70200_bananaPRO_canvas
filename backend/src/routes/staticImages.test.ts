/**
 * 静态图片服务路由单元测试
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'path';
import { validatePath, getMimeType } from './staticImages.js';

// 测试基础路径
const TEST_BASE_PATH = '/tmp/test-static-images';

describe('staticImages 路由', () => {
  describe('validatePath - 目录穿越防护', () => {
    it('应该接受正常的文件路径', () => {
      const result = validatePath(TEST_BASE_PATH, 'nano-banana/2024/01/02/image.jpg');
      expect(result).toBe(path.join(TEST_BASE_PATH, 'nano-banana/2024/01/02/image.jpg'));
    });

    it('应该接受根目录下的文件', () => {
      const result = validatePath(TEST_BASE_PATH, 'image.jpg');
      expect(result).toBe(path.join(TEST_BASE_PATH, 'image.jpg'));
    });

    it('应该拒绝包含 .. 的路径', () => {
      const result = validatePath(TEST_BASE_PATH, '../etc/passwd');
      expect(result).toBeNull();
    });

    it('应该拒绝包含多个 .. 的路径', () => {
      const result = validatePath(TEST_BASE_PATH, 'nano-banana/../../etc/passwd');
      expect(result).toBeNull();
    });

    it('应该拒绝包含 null 字符的路径', () => {
      const result = validatePath(TEST_BASE_PATH, 'image\0.jpg');
      expect(result).toBeNull();
    });

    it('应该拒绝尝试逃逸基础路径的路径', () => {
      // 即使没有 ..，也要确保路径在基础路径下
      const result = validatePath(TEST_BASE_PATH, '../../../etc/passwd');
      expect(result).toBeNull();
    });

    it('应该处理 Windows 风格的路径分隔符', () => {
      const result = validatePath(TEST_BASE_PATH, 'nano-banana\\..\\..\\etc\\passwd');
      // 在 Unix 系统上，反斜杠不是路径分隔符，但 .. 仍然会被检测到
      expect(result).toBeNull();
    });

    it('应该接受包含特殊字符的合法文件名', () => {
      const result = validatePath(TEST_BASE_PATH, 'nano-banana/2024/01/02/image_thumb.webp');
      expect(result).toBe(path.join(TEST_BASE_PATH, 'nano-banana/2024/01/02/image_thumb.webp'));
    });

    it('应该接受包含数字和下划线的文件名', () => {
      const result = validatePath(TEST_BASE_PATH, 'nano-banana/2024/01/02/1704182400000_abc123.jpg');
      expect(result).toBe(path.join(TEST_BASE_PATH, 'nano-banana/2024/01/02/1704182400000_abc123.jpg'));
    });
  });

  describe('getMimeType - MIME 类型检测', () => {
    it('应该返回 JPEG 的正确 MIME 类型', () => {
      expect(getMimeType('image.jpg')).toBe('image/jpeg');
      expect(getMimeType('image.jpeg')).toBe('image/jpeg');
    });

    it('应该返回 PNG 的正确 MIME 类型', () => {
      expect(getMimeType('image.png')).toBe('image/png');
    });

    it('应该返回 WebP 的正确 MIME 类型', () => {
      expect(getMimeType('image.webp')).toBe('image/webp');
    });

    it('应该返回 GIF 的正确 MIME 类型', () => {
      expect(getMimeType('image.gif')).toBe('image/gif');
    });

    it('应该处理大写扩展名', () => {
      expect(getMimeType('image.JPG')).toBe('image/jpeg');
      expect(getMimeType('image.PNG')).toBe('image/png');
      expect(getMimeType('image.WEBP')).toBe('image/webp');
    });

    it('应该为未知扩展名返回默认 MIME 类型', () => {
      expect(getMimeType('file.txt')).toBe('application/octet-stream');
      expect(getMimeType('file.pdf')).toBe('application/octet-stream');
    });

    it('应该处理没有扩展名的文件', () => {
      expect(getMimeType('filename')).toBe('application/octet-stream');
    });

    it('应该处理完整路径', () => {
      expect(getMimeType('/path/to/image.jpg')).toBe('image/jpeg');
      expect(getMimeType('nano-banana/2024/01/02/image.webp')).toBe('image/webp');
    });
  });
});

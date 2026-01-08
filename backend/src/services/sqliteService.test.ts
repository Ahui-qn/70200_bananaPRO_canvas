/**
 * SQLite 数据库服务单元测试
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { SQLiteServiceImpl } from './sqliteService';

// 测试数据库路径
const TEST_DB_PATH = './data/test-database.sqlite';

describe('SQLiteService 单元测试', () => {
  let sqliteService: SQLiteServiceImpl;

  beforeAll(async () => {
    // 确保测试目录存在
    const dbDir = path.dirname(TEST_DB_PATH);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

    // 创建新的服务实例
    sqliteService = new SQLiteServiceImpl();
    await sqliteService.connectSQLite({ path: TEST_DB_PATH });
  });

  afterAll(async () => {
    // 断开连接
    await sqliteService.disconnect();

    // 清理测试数据库文件
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }
    // 清理 WAL 文件
    const walPath = TEST_DB_PATH + '-wal';
    const shmPath = TEST_DB_PATH + '-shm';
    if (fs.existsSync(walPath)) fs.unlinkSync(walPath);
    if (fs.existsSync(shmPath)) fs.unlinkSync(shmPath);
  });

  describe('连接管理', () => {
    it('应该成功连接到 SQLite 数据库', () => {
      const status = sqliteService.getConnectionStatus();
      expect(status.isConnected).toBe(true);
      expect(status.error).toBeNull();
    });

    it('应该能够测试连接', async () => {
      const result = await sqliteService.testConnection();
      expect(result).toBe(true);
    });

    it('应该返回正确的连接状态', () => {
      const status = sqliteService.getConnectionStatus();
      expect(status.isConnected).toBe(true);
      expect(status.lastConnected).toBeInstanceOf(Date);
      expect(status.latency).toBeDefined();
    });
  });

  describe('表结构初始化', () => {
    it('应该创建 users 表', async () => {
      const result = await sqliteService.executeQuery(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='users'"
      );
      expect(result.length).toBe(1);
      expect(result[0].name).toBe('users');
    });

    it('应该创建 projects 表', async () => {
      const result = await sqliteService.executeQuery(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='projects'"
      );
      expect(result.length).toBe(1);
      expect(result[0].name).toBe('projects');
    });

    it('应该创建 images 表', async () => {
      const result = await sqliteService.executeQuery(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='images'"
      );
      expect(result.length).toBe(1);
      expect(result[0].name).toBe('images');
    });

    it('应该创建 user_configs 表', async () => {
      const result = await sqliteService.executeQuery(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='user_configs'"
      );
      expect(result.length).toBe(1);
      expect(result[0].name).toBe('user_configs');
    });

    it('应该创建 reference_images 表', async () => {
      const result = await sqliteService.executeQuery(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='reference_images'"
      );
      expect(result.length).toBe(1);
      expect(result[0].name).toBe('reference_images');
    });

    it('应该创建 sync_logs 表', async () => {
      const result = await sqliteService.executeQuery(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='sync_logs'"
      );
      expect(result.length).toBe(1);
      expect(result[0].name).toBe('sync_logs');
    });
  });

  describe('图片 CRUD 操作', () => {
    const testImage = {
      id: 'test-image-001',
      url: 'http://localhost:3000/api/static-images/2024/01/01/test.jpg',
      originalUrl: null,
      prompt: '测试提示词',
      model: 'test-model',
      aspectRatio: '1:1',
      imageSize: '1K',
      refImages: undefined,
      createdAt: new Date(),
      tags: ['测试', '图片'],
      favorite: false,
      ossKey: '2024/01/01/test.jpg',
      ossUploaded: true,
      userId: 'test-user',
      projectId: null,
      canvasX: 100,
      canvasY: 200,
      thumbnailUrl: 'http://localhost:3000/api/static-images/2024/01/01/test_thumb.webp',
      width: 1024,
      height: 1024,
      status: 'success' as const,
      failureReason: undefined
    };

    beforeEach(async () => {
      // 清理测试数据
      await sqliteService.executeQuery('DELETE FROM images WHERE id LIKE ?', ['test-%']);
    });

    it('应该能够保存图片', async () => {
      const result = await sqliteService.saveImage(testImage);
      expect(result.id).toBe(testImage.id);
      expect(result.prompt).toBe(testImage.prompt);
    });

    it('应该能够根据 ID 获取图片', async () => {
      await sqliteService.saveImage(testImage);
      const result = await sqliteService.getImageById(testImage.id);
      
      expect(result).not.toBeNull();
      expect(result!.id).toBe(testImage.id);
      expect(result!.prompt).toBe(testImage.prompt);
      expect(result!.model).toBe(testImage.model);
      expect(result!.canvasX).toBe(testImage.canvasX);
      expect(result!.canvasY).toBe(testImage.canvasY);
    });

    it('应该能够分页获取图片列表', async () => {
      // 保存多张图片
      for (let i = 0; i < 5; i++) {
        await sqliteService.saveImage({
          ...testImage,
          id: `test-image-${i.toString().padStart(3, '0')}`,
          prompt: `测试提示词 ${i}`
        });
      }

      const result = await sqliteService.getImages({
        page: 1,
        pageSize: 3,
        sortBy: 'created_at',
        sortOrder: 'DESC'
      });

      expect(result.data.length).toBe(3);
      expect(result.total).toBe(5);
      expect(result.totalPages).toBe(2);
      expect(result.hasNext).toBe(true);
      expect(result.hasPrev).toBe(false);
    });

    it('应该能够更新图片信息', async () => {
      await sqliteService.saveImage(testImage);
      
      const updated = await sqliteService.updateImage(testImage.id, {
        prompt: '更新后的提示词',
        favorite: true,
        canvasX: 300,
        canvasY: 400
      });

      expect(updated.prompt).toBe('更新后的提示词');
      expect(updated.favorite).toBe(true);
      expect(updated.canvasX).toBe(300);
      expect(updated.canvasY).toBe(400);
    });

    it('应该能够更新图片画布位置', async () => {
      await sqliteService.saveImage(testImage);
      
      const updated = await sqliteService.updateImageCanvasPosition(testImage.id, 500, 600);

      expect(updated.canvasX).toBe(500);
      expect(updated.canvasY).toBe(600);
    });

    it('应该能够删除图片', async () => {
      await sqliteService.saveImage(testImage);
      
      await sqliteService.deleteImage(testImage.id);
      
      const result = await sqliteService.getImageById(testImage.id);
      expect(result).toBeNull();
    });

    it('应该能够批量删除图片', async () => {
      const ids = ['test-batch-001', 'test-batch-002', 'test-batch-003'];
      
      for (const id of ids) {
        await sqliteService.saveImage({ ...testImage, id });
      }

      const result = await sqliteService.deleteImages(ids);
      
      expect(result.successful.length).toBe(3);
      expect(result.failed.length).toBe(0);
    });

    it('应该能够按项目 ID 筛选图片', async () => {
      const projectId = 'test-project-001';
      
      // 保存带项目 ID 的图片
      await sqliteService.saveImage({
        ...testImage,
        id: 'test-with-project',
        projectId
      });
      
      // 保存不带项目 ID 的图片
      await sqliteService.saveImage({
        ...testImage,
        id: 'test-without-project',
        projectId: null
      });

      const result = await sqliteService.getImages({
        page: 1,
        pageSize: 10,
        filters: { projectId }
      });

      expect(result.data.length).toBe(1);
      expect(result.data[0].projectId).toBe(projectId);
    });
  });

  describe('SQL 语法转换', () => {
    it('应该正确处理 SELECT 查询', async () => {
      const result = await sqliteService.executeQuery('SELECT 1 as value');
      expect(result[0].value).toBe(1);
    });

    it('应该正确处理 INSERT 操作', async () => {
      // 先清理
      await sqliteService.executeQuery('DELETE FROM sync_logs WHERE operation = ?', ['TEST']);
      
      const result = await sqliteService.executeQuery(
        'INSERT INTO sync_logs (operation, table_name, status) VALUES (?, ?, ?)',
        ['TEST', 'test_table', 'SUCCESS']
      );
      
      expect(result[0].affectedRows).toBe(1);
    });
  });
});

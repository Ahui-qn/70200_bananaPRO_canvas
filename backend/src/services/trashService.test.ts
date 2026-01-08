/**
 * 回收站服务测试
 * 使用 fast-check 进行属性测试
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';

// Mock databaseService
vi.mock('./databaseService', () => ({
  databaseService: {
    executeQuery: vi.fn()
  }
}));

// Mock storageManager（替代原来的 aliOssService）
vi.mock('./storageManager', () => ({
  storageManager: {
    isConfigured: vi.fn().mockReturnValue(true),
    deleteObject: vi.fn().mockResolvedValue(true),
    deleteObjects: vi.fn().mockResolvedValue({ success: 0, failed: 0 })
  }
}));

// Mock projectService
vi.mock('./projectService', () => ({
  projectService: {
    getProjectById: vi.fn()
  }
}));

import { trashService } from './trashService';
import { databaseService } from './databaseService';
import { storageManager } from './storageManager';
import { projectService } from './projectService';

// 生成有效的 UUID
const validUuid = fc.uuid();

describe('TrashService 属性测试', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * 属性 8: 软删除记录删除信息
   * 对于任何软删除操作，被删除的记录应该设置 is_deleted 为 true，并记录 deleted_at 和 deleted_by
   */
  it('属性 8: 软删除记录删除信息', async () => {
    await fc.assert(
      fc.asyncProperty(validUuid, validUuid, async (imageId, deletedBy) => {
        vi.clearAllMocks();
        const executeQueryMock = vi.mocked(databaseService.executeQuery);
        executeQueryMock.mockResolvedValueOnce({ affectedRows: 1 });

        await trashService.softDeleteImage(imageId, deletedBy);

        // 验证 SQL 包含正确的字段
        const call = executeQueryMock.mock.calls[0];
        expect(call[0]).toContain('is_deleted = TRUE');
        expect(call[0]).toContain('deleted_at');
        expect(call[0]).toContain('deleted_by');
        expect(call[1]).toContain(deletedBy);
        expect(call[1]).toContain(imageId);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * 属性 10: 回收站内容正确
   * 对于任何回收站查询，返回的结果应该只包含 is_deleted 为 true 的记录
   */
  it('属性 10: 回收站内容正确', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            id: validUuid,
            name: fc.string({ minLength: 1 }),
            description: fc.option(fc.string()),
            coverImageUrl: fc.option(fc.webUrl()),
            createdBy: validUuid,
            creatorName: fc.string(),
            deletedAt: fc.date(),
            deletedBy: validUuid,
            deletedByName: fc.string(),
            imageCount: fc.nat()
          }),
          { minLength: 0, maxLength: 5 }
        ),
        fc.array(
          fc.record({
            id: validUuid,
            url: fc.webUrl(),
            prompt: fc.string(),
            model: fc.string(),
            projectId: fc.option(validUuid),
            projectName: fc.option(fc.string()),
            userId: validUuid,
            userName: fc.string(),
            ossKey: fc.option(fc.string()),
            deletedAt: fc.date(),
            deletedBy: validUuid,
            deletedByName: fc.string()
          }),
          { minLength: 0, maxLength: 5 }
        ),
        async (mockProjects, mockImages) => {
          vi.mocked(databaseService.executeQuery)
            .mockResolvedValueOnce(mockProjects)
            .mockResolvedValueOnce(mockImages);

          const trash = await trashService.getTrashItems();

          // 验证所有项目都有删除信息
          for (const project of trash.projects) {
            expect(project.deletedAt).toBeInstanceOf(Date);
            expect(project.deletedBy).toBeDefined();
          }

          // 验证所有图片都有删除信息
          for (const image of trash.images) {
            expect(image.deletedAt).toBeInstanceOf(Date);
            expect(image.deletedBy).toBeDefined();
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * 属性 11: 恢复操作正确
   * 对于任何恢复操作，被恢复的记录应该设置 is_deleted 为 false
   */
  it('属性 11: 恢复操作正确 - 恢复图片', async () => {
    await fc.assert(
      fc.asyncProperty(validUuid, validUuid, async (imageId, projectId) => {
        const executeQueryMock = vi.mocked(databaseService.executeQuery);
        executeQueryMock
          .mockResolvedValueOnce([{ projectId }])
          .mockResolvedValueOnce([{ id: projectId, isDeleted: false }])
          .mockResolvedValueOnce({ affectedRows: 1 });

        await trashService.restoreImage(imageId);

        const restoreCall = executeQueryMock.mock.calls[2];
        expect(restoreCall[0]).toContain('is_deleted = FALSE');
        expect(restoreCall[0]).toContain('deleted_at = NULL');
        expect(restoreCall[0]).toContain('deleted_by = NULL');
      }),
      { numRuns: 100 }
    );
  });

  /**
   * 属性 12: 项目恢复级联
   * 对于任何被恢复的项目，其下所有被级联删除的图片也应该被恢复
   */
  it('属性 12: 项目恢复级联', async () => {
    await fc.assert(
      fc.asyncProperty(validUuid, async (projectId) => {
        vi.clearAllMocks();
        const executeQueryMock = vi.mocked(databaseService.executeQuery);
        executeQueryMock
          .mockResolvedValueOnce({ affectedRows: 1 })
          .mockResolvedValueOnce({ affectedRows: 5 });

        vi.mocked(projectService.getProjectById).mockResolvedValueOnce({
          id: projectId,
          name: '测试项目',
          description: null,
          coverImageUrl: null,
          createdBy: 'user-1',
          createdAt: new Date(),
          updatedAt: new Date(),
          isDeleted: false,
          deletedAt: null,
          deletedBy: null
        });

        await trashService.restoreProject(projectId);

        expect(executeQueryMock).toHaveBeenCalledTimes(2);

        const firstCall = executeQueryMock.mock.calls[0];
        expect(firstCall[0]).toContain('projects');
        expect(firstCall[0]).toContain('is_deleted = FALSE');

        const secondCall = executeQueryMock.mock.calls[1];
        expect(secondCall[0]).toContain('images');
        expect(secondCall[0]).toContain('is_deleted = FALSE');
        expect(secondCall[1]).toContain(projectId);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * 属性 13: 图片恢复项目归属
   * 对于任何被恢复的图片，如果其原项目已删除，应该被归属到默认项目（设为 null）
   */
  it('属性 13: 图片恢复项目归属 - 原项目已删除时设为 null', async () => {
    await fc.assert(
      fc.asyncProperty(validUuid, validUuid, async (imageId, projectId) => {
        const executeQueryMock = vi.mocked(databaseService.executeQuery);
        executeQueryMock
          .mockResolvedValueOnce([{ projectId }])
          .mockResolvedValueOnce([{ id: projectId, isDeleted: true }])
          .mockResolvedValueOnce({ affectedRows: 1 });

        await trashService.restoreImage(imageId);

        const restoreCall = executeQueryMock.mock.calls[2];
        expect(restoreCall[1][0]).toBeNull();
      }),
      { numRuns: 100 }
    );
  });

  /**
   * 属性 14: 硬删除级联
   * 对于任何被硬删除的项目，其下所有已删除的图片也应该被硬删除
   */
  it('属性 14: 硬删除级联', async () => {
    await fc.assert(
      fc.asyncProperty(
        validUuid,
        fc.array(fc.record({ ossKey: fc.option(fc.string()) }), { minLength: 0, maxLength: 5 }),
        async (projectId, mockImages) => {
          vi.clearAllMocks();
          const executeQueryMock = vi.mocked(databaseService.executeQuery);
          executeQueryMock
            .mockResolvedValueOnce(mockImages)
            .mockResolvedValueOnce({ affectedRows: mockImages.length })
            .mockResolvedValueOnce({ affectedRows: 1 });

          await trashService.hardDeleteProject(projectId);

          expect(executeQueryMock).toHaveBeenCalledTimes(3);

          const deleteImagesCall = executeQueryMock.mock.calls[1];
          expect(deleteImagesCall[0]).toContain('DELETE FROM');
          expect(deleteImagesCall[0]).toContain('images');

          const deleteProjectCall = executeQueryMock.mock.calls[2];
          expect(deleteProjectCall[0]).toContain('DELETE FROM');
          expect(deleteProjectCall[0]).toContain('projects');
        }
      ),
      { numRuns: 100 }
    );
  });
});


describe('TrashService 单元测试', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('获取回收站内容应该返回已删除的项目和图片', async () => {
    vi.mocked(databaseService.executeQuery)
      .mockResolvedValueOnce([
        {
          id: 'project-1',
          name: '已删除项目',
          description: null,
          coverImageUrl: null,
          createdBy: 'user-1',
          creatorName: 'User 1',
          deletedAt: new Date(),
          deletedBy: 'user-2',
          deletedByName: 'User 2',
          imageCount: 5
        }
      ])
      .mockResolvedValueOnce([
        {
          id: 'image-1',
          url: 'https://example.com/image.jpg',
          prompt: '测试提示词',
          model: 'test-model',
          projectId: 'project-1',
          projectName: '已删除项目',
          userId: 'user-1',
          userName: 'User 1',
          ossKey: 'test-key',
          deletedAt: new Date(),
          deletedBy: 'user-2',
          deletedByName: 'User 2'
        }
      ]);

    const trash = await trashService.getTrashItems();

    expect(trash.projects).toHaveLength(1);
    expect(trash.images).toHaveLength(1);
    expect(trash.projects[0].name).toBe('已删除项目');
    expect(trash.images[0].prompt).toBe('测试提示词');
  });

  it('恢复不存在的项目应该抛出错误', async () => {
    vi.mocked(databaseService.executeQuery).mockResolvedValueOnce({ affectedRows: 0 });

    await expect(trashService.restoreProject('non-existent')).rejects.toThrow(
      '项目不存在或未被删除'
    );
  });

  it('恢复不存在的图片应该抛出错误', async () => {
    vi.mocked(databaseService.executeQuery).mockResolvedValueOnce([]);

    await expect(trashService.restoreImage('non-existent')).rejects.toThrow(
      '图片不存在或未被删除'
    );
  });

  it('硬删除项目应该删除存储文件', async () => {
    vi.mocked(databaseService.executeQuery)
      .mockResolvedValueOnce([{ ossKey: 'key-1' }, { ossKey: 'key-2' }])
      .mockResolvedValueOnce({ affectedRows: 2 })
      .mockResolvedValueOnce({ affectedRows: 1 });

    vi.mocked(storageManager.isConfigured).mockReturnValue(true);
    vi.mocked(storageManager.deleteObject).mockResolvedValue(true);

    await trashService.hardDeleteProject('project-1');

    // 验证调用了 storageManager.deleteObject 而不是 aliOssService.deleteFile
    expect(storageManager.deleteObject).toHaveBeenCalledTimes(2);
    expect(storageManager.deleteObject).toHaveBeenCalledWith('key-1');
    expect(storageManager.deleteObject).toHaveBeenCalledWith('key-2');
  });

  it('硬删除图片应该删除存储文件', async () => {
    vi.mocked(databaseService.executeQuery)
      .mockResolvedValueOnce([{ ossKey: 'image-key', thumbnailUrl: 'https://example.com/thumb.jpg' }])
      .mockResolvedValueOnce({ affectedRows: 1 });

    vi.mocked(storageManager.isConfigured).mockReturnValue(true);
    vi.mocked(storageManager.deleteObject).mockResolvedValue(true);

    await trashService.hardDeleteImage('image-1');

    // 验证调用了 storageManager.deleteObject
    expect(storageManager.deleteObject).toHaveBeenCalled();
    expect(storageManager.deleteObject).toHaveBeenCalledWith('image-key');
  });

  it('清空回收站应该删除所有已删除的项目和图片', async () => {
    vi.mocked(databaseService.executeQuery)
      .mockResolvedValueOnce([{ id: 'project-1' }])
      .mockResolvedValueOnce([{ ossKey: 'key-1' }])
      .mockResolvedValueOnce({ affectedRows: 1 })
      .mockResolvedValueOnce({ affectedRows: 1 });

    vi.mocked(storageManager.isConfigured).mockReturnValue(true);
    vi.mocked(storageManager.deleteObject).mockResolvedValue(true);

    const result = await trashService.emptyTrash();

    expect(result.deletedProjects).toBe(1);
    expect(result.deletedImages).toBe(1);
  });

  it('存储服务未配置时应该跳过文件删除', async () => {
    vi.mocked(databaseService.executeQuery)
      .mockResolvedValueOnce([{ ossKey: 'key-1' }])
      .mockResolvedValueOnce({ affectedRows: 1 })
      .mockResolvedValueOnce({ affectedRows: 1 });

    vi.mocked(storageManager.isConfigured).mockReturnValue(false);

    await trashService.hardDeleteProject('project-1');

    // 存储服务未配置，不应该调用 deleteObject
    expect(storageManager.deleteObject).not.toHaveBeenCalled();
  });
});

/**
 * 回收站服务
 * 负责已删除项目和图片的查询、恢复、永久删除等操作
 */

import { databaseService } from './databaseService';
import { aliOssService } from './aliOssService';
import { TABLE_NAMES } from '../config/constants';
import { projectService, Project } from './projectService';

// 已删除的图片
export interface DeletedImage {
  id: string;
  url: string;
  prompt: string;
  model: string;
  projectId: string | null;
  projectName: string | null;
  userId: string;
  userName: string | null;
  ossKey: string | null;
  deletedAt: Date;
  deletedBy: string;
  deletedByName: string | null;
}

// 已删除的项目
export interface DeletedProject {
  id: string;
  name: string;
  description: string | null;
  coverImageUrl: string | null;
  createdBy: string;
  creatorName: string | null;
  imageCount: number;
  deletedAt: Date;
  deletedBy: string;
  deletedByName: string | null;
}

// 回收站内容
export interface TrashContent {
  projects: DeletedProject[];
  images: DeletedImage[];
}

/**
 * 回收站服务类
 */
class TrashService {
  /**
   * 获取回收站内容
   */
  async getTrashItems(): Promise<TrashContent> {
    // 获取已删除的项目
    const projectsSql = `
      SELECT 
        p.id,
        p.name,
        p.description,
        p.cover_image_url as coverImageUrl,
        p.created_by as createdBy,
        u1.display_name as creatorName,
        p.deleted_at as deletedAt,
        p.deleted_by as deletedBy,
        u2.display_name as deletedByName,
        (SELECT COUNT(*) FROM ${TABLE_NAMES.IMAGES} WHERE project_id = p.id) as imageCount
      FROM ${TABLE_NAMES.PROJECTS} p
      LEFT JOIN ${TABLE_NAMES.USERS} u1 ON p.created_by = u1.id
      LEFT JOIN ${TABLE_NAMES.USERS} u2 ON p.deleted_by = u2.id
      WHERE p.is_deleted = TRUE
      ORDER BY p.deleted_at DESC
    `;
    const projectRows = await databaseService.executeQuery(projectsSql);

    // 获取已删除的图片（不包括因项目删除而级联删除的）
    const imagesSql = `
      SELECT 
        i.id,
        i.url,
        i.prompt,
        i.model,
        i.project_id as projectId,
        p.name as projectName,
        i.user_id as userId,
        u1.display_name as userName,
        i.oss_key as ossKey,
        i.deleted_at as deletedAt,
        i.deleted_by as deletedBy,
        u2.display_name as deletedByName
      FROM ${TABLE_NAMES.IMAGES} i
      LEFT JOIN ${TABLE_NAMES.PROJECTS} p ON i.project_id = p.id
      LEFT JOIN ${TABLE_NAMES.USERS} u1 ON i.user_id = u1.id
      LEFT JOIN ${TABLE_NAMES.USERS} u2 ON i.deleted_by = u2.id
      WHERE i.is_deleted = TRUE
      ORDER BY i.deleted_at DESC
    `;
    const imageRows = await databaseService.executeQuery(imagesSql);

    return {
      projects: this.mapRowsToDeletedProjects(projectRows as any[]),
      images: this.mapRowsToDeletedImages(imageRows as any[])
    };
  }

  /**
   * 恢复已删除的项目（级联恢复图片）
   */
  async restoreProject(projectId: string): Promise<Project> {
    // 恢复项目
    const projectSql = `
      UPDATE ${TABLE_NAMES.PROJECTS}
      SET is_deleted = FALSE, deleted_at = NULL, deleted_by = NULL, updated_at = ?
      WHERE id = ? AND is_deleted = TRUE
    `;
    const result = await databaseService.executeQuery(projectSql, [new Date(), projectId]);
    
    if ((result as any).affectedRows === 0) {
      throw new Error('项目不存在或未被删除');
    }

    // 级联恢复该项目下所有被删除的图片
    const imagesSql = `
      UPDATE ${TABLE_NAMES.IMAGES}
      SET is_deleted = FALSE, deleted_at = NULL, deleted_by = NULL
      WHERE project_id = ? AND is_deleted = TRUE
    `;
    await databaseService.executeQuery(imagesSql, [projectId]);

    const project = await projectService.getProjectById(projectId);
    if (!project) {
      throw new Error('恢复项目失败');
    }
    return project;
  }

  /**
   * 恢复已删除的图片
   */
  async restoreImage(imageId: string): Promise<void> {
    // 先获取图片信息
    const imageSql = `
      SELECT project_id as projectId FROM ${TABLE_NAMES.IMAGES}
      WHERE id = ? AND is_deleted = TRUE
    `;
    const imageRows = await databaseService.executeQuery(imageSql, [imageId]);
    
    if ((imageRows as any[]).length === 0) {
      throw new Error('图片不存在或未被删除');
    }

    const projectId = (imageRows as any[])[0].projectId;

    // 检查原项目是否存在且未被删除
    let targetProjectId = projectId;
    if (projectId) {
      const projectSql = `
        SELECT id, is_deleted as isDeleted FROM ${TABLE_NAMES.PROJECTS}
        WHERE id = ?
      `;
      const projectRows = await databaseService.executeQuery(projectSql, [projectId]);
      
      if ((projectRows as any[]).length === 0 || (projectRows as any[])[0].isDeleted) {
        // 原项目不存在或已删除，需要找一个默认项目
        // 这里我们将 project_id 设为 null，让前端处理
        targetProjectId = null;
      }
    }

    // 恢复图片
    const restoreSql = `
      UPDATE ${TABLE_NAMES.IMAGES}
      SET is_deleted = FALSE, deleted_at = NULL, deleted_by = NULL, project_id = ?
      WHERE id = ?
    `;
    await databaseService.executeQuery(restoreSql, [targetProjectId, imageId]);
  }

  /**
   * 永久删除项目（硬删除，级联删除图片和 OSS 文件）
   */
  async hardDeleteProject(projectId: string): Promise<void> {
    // 获取项目下所有图片的 OSS key
    const imagesSql = `
      SELECT id, oss_key as ossKey, thumbnail_url FROM ${TABLE_NAMES.IMAGES}
      WHERE project_id = ?
    `;
    const imageRows = await databaseService.executeQuery(imagesSql, [projectId]);

    // 收集所有需要删除的 OSS 文件
    const ossKeysToDelete: string[] = [];

    for (const row of imageRows as any[]) {
      // 原图 OSS key
      if (row.ossKey) {
        ossKeysToDelete.push(row.ossKey);
      }
      // 缩略图 OSS key
      if (row.thumbnail_url) {
        try {
          const thumbnailKey = this.extractOssKeyFromUrl(row.thumbnail_url);
          if (thumbnailKey) {
            ossKeysToDelete.push(thumbnailKey);
          }
        } catch (error) {
          console.warn(`提取缩略图 OSS key 失败: ${row.thumbnail_url}`);
        }
      }
    }

    // 尝试删除 OSS 文件
    if (ossKeysToDelete.length > 0) {
      try {
        // 检查 OSS 服务是否可用
        if (!aliOssService.isConfigured()) {
          throw new Error('OSS 服务未配置或不可用');
        }

        // 逐个删除 OSS 文件（避免使用批量删除，因为可能没有列表权限）
        let successCount = 0;
        let failedCount = 0;
        
        for (const ossKey of ossKeysToDelete) {
          try {
            const success = await aliOssService.deleteObject(ossKey);
            if (success) {
              successCount++;
            } else {
              failedCount++;
              console.warn(`OSS 文件删除失败: ${ossKey}`);
            }
          } catch (error) {
            failedCount++;
            console.warn(`OSS 文件删除异常: ${ossKey}`, error);
          }
        }
        
        console.log(`OSS 文件删除完成: 成功 ${successCount}, 失败 ${failedCount}`);
        
        if (failedCount > 0) {
          console.warn(`部分 OSS 文件删除失败，但继续执行数据库删除`);
        }
      } catch (error) {
        console.error(`删除项目 OSS 文件失败: ${error}`);
        // 不抛出错误，允许继续删除数据库记录
        console.warn('OSS 文件删除失败，但继续执行数据库删除');
      }
    }

    // 硬删除图片记录
    const deleteImagesSql = `DELETE FROM ${TABLE_NAMES.IMAGES} WHERE project_id = ?`;
    await databaseService.executeQuery(deleteImagesSql, [projectId]);

    // 硬删除项目记录
    const deleteProjectSql = `DELETE FROM ${TABLE_NAMES.PROJECTS} WHERE id = ?`;
    await databaseService.executeQuery(deleteProjectSql, [projectId]);
  }

  /**
   * 永久删除图片（硬删除，删除 OSS 文件）
   */
  async hardDeleteImage(imageId: string): Promise<void> {
    // 获取图片的 OSS key 和缩略图 URL
    const imageSql = `
      SELECT oss_key as ossKey, thumbnail_url as thumbnailUrl FROM ${TABLE_NAMES.IMAGES}
      WHERE id = ?
    `;
    const imageRows = await databaseService.executeQuery(imageSql, [imageId]);

    if ((imageRows as any[]).length === 0) {
      throw new Error('图片不存在');
    }

    const imageData = (imageRows as any[])[0];
    const ossKeysToDelete: string[] = [];

    // 收集需要删除的 OSS 文件
    if (imageData.ossKey) {
      ossKeysToDelete.push(imageData.ossKey);
    }
    if (imageData.thumbnailUrl) {
      try {
        const thumbnailKey = this.extractOssKeyFromUrl(imageData.thumbnailUrl);
        if (thumbnailKey) {
          ossKeysToDelete.push(thumbnailKey);
        }
      } catch (error) {
        console.warn(`提取缩略图 OSS key 失败: ${imageData.thumbnailUrl}`);
      }
    }

    // 尝试删除 OSS 文件
    if (ossKeysToDelete.length > 0) {
      try {
        // 检查 OSS 服务是否可用
        if (!aliOssService.isConfigured()) {
          throw new Error('OSS 服务未配置或不可用');
        }

        // 删除 OSS 文件
        for (const ossKey of ossKeysToDelete) {
          const success = await aliOssService.deleteObject(ossKey);
          if (!success) {
            console.warn(`OSS 文件删除失败: ${ossKey}`);
          }
        }
      } catch (error) {
        console.error(`删除图片 OSS 文件失败: ${error}`);
        // OSS 删除失败时，给用户明确提示
        throw new Error(`无法删除云存储文件，请检查网络连接或联系管理员。错误: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    // 硬删除图片记录
    const deleteSql = `DELETE FROM ${TABLE_NAMES.IMAGES} WHERE id = ?`;
    await databaseService.executeQuery(deleteSql, [imageId]);
  }

  /**
   * 清空回收站（仅管理员）
   */
  async emptyTrash(): Promise<{ deletedProjects: number; deletedImages: number; ossErrors: string[] }> {
    // 获取所有已删除项目的 ID
    const projectsSql = `SELECT id FROM ${TABLE_NAMES.PROJECTS} WHERE is_deleted = TRUE`;
    const projectRows = await databaseService.executeQuery(projectsSql);

    // 获取所有已删除图片的 OSS key 和缩略图
    const imagesSql = `
      SELECT oss_key as ossKey, thumbnail_url as thumbnailUrl 
      FROM ${TABLE_NAMES.IMAGES} 
      WHERE is_deleted = TRUE
    `;
    const imageRows = await databaseService.executeQuery(imagesSql);

    // 收集所有需要删除的 OSS 文件
    const ossKeysToDelete: string[] = [];
    const ossErrors: string[] = [];

    for (const row of imageRows as any[]) {
      if (row.ossKey) {
        ossKeysToDelete.push(row.ossKey);
      }
      if (row.thumbnailUrl) {
        try {
          const thumbnailKey = this.extractOssKeyFromUrl(row.thumbnailUrl);
          if (thumbnailKey) {
            ossKeysToDelete.push(thumbnailKey);
          }
        } catch (error) {
          ossErrors.push(`提取缩略图 OSS key 失败: ${row.thumbnailUrl}`);
        }
      }
    }

    // 尝试删除 OSS 文件
    if (ossKeysToDelete.length > 0) {
      try {
        if (aliOssService.isConfigured()) {
          // 逐个删除文件，避免批量删除可能的权限问题
          let successCount = 0;
          let failedCount = 0;
          
          for (const ossKey of ossKeysToDelete) {
            try {
              const success = await aliOssService.deleteObject(ossKey);
              if (success) {
                successCount++;
              } else {
                failedCount++;
              }
            } catch (error) {
              failedCount++;
              console.warn(`删除 OSS 文件失败: ${ossKey}`, error);
            }
          }
          
          if (failedCount > 0) {
            ossErrors.push(`部分 OSS 文件删除失败: 成功 ${successCount}, 失败 ${failedCount}`);
          }
        } else {
          ossErrors.push('OSS 服务未配置，跳过云存储文件删除');
        }
      } catch (error) {
        ossErrors.push(`OSS 文件删除失败: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    // 硬删除所有已删除的图片
    const deleteImagesSql = `DELETE FROM ${TABLE_NAMES.IMAGES} WHERE is_deleted = TRUE`;
    const imagesResult = await databaseService.executeQuery(deleteImagesSql);

    // 硬删除所有已删除的项目
    const deleteProjectsSql = `DELETE FROM ${TABLE_NAMES.PROJECTS} WHERE is_deleted = TRUE`;
    const projectsResult = await databaseService.executeQuery(deleteProjectsSql);

    return {
      deletedProjects: (projectsResult as any).affectedRows || 0,
      deletedImages: (imagesResult as any).affectedRows || 0,
      ossErrors
    };
  }

  /**
   * 从 URL 中提取 OSS key
   */
  private extractOssKeyFromUrl(url: string): string | null {
    try {
      const urlObj = new URL(url);
      // 移除开头的斜杠
      return urlObj.pathname.substring(1);
    } catch {
      return null;
    }
  }

  /**
   * 软删除图片
   */
  async softDeleteImage(imageId: string, deletedBy: string): Promise<void> {
    const now = new Date();
    const sql = `
      UPDATE ${TABLE_NAMES.IMAGES}
      SET is_deleted = TRUE, deleted_at = ?, deleted_by = ?
      WHERE id = ? AND is_deleted = FALSE
    `;
    const result = await databaseService.executeQuery(sql, [now, deletedBy, imageId]);
    
    if ((result as any).affectedRows === 0) {
      throw new Error('图片不存在或已被删除');
    }
  }

  /**
   * 将数据库行映射为已删除项目对象
   */
  private mapRowsToDeletedProjects(rows: any[]): DeletedProject[] {
    return rows.map(row => ({
      id: row.id,
      name: row.name,
      description: row.description,
      coverImageUrl: row.coverImageUrl,
      createdBy: row.createdBy,
      creatorName: row.creatorName,
      imageCount: row.imageCount || 0,
      deletedAt: new Date(row.deletedAt),
      deletedBy: row.deletedBy,
      deletedByName: row.deletedByName
    }));
  }

  /**
   * 将数据库行映射为已删除图片对象
   */
  private mapRowsToDeletedImages(rows: any[]): DeletedImage[] {
    return rows.map(row => ({
      id: row.id,
      url: row.url,
      prompt: row.prompt,
      model: row.model,
      projectId: row.projectId,
      projectName: row.projectName,
      userId: row.userId,
      userName: row.userName,
      ossKey: row.ossKey,
      deletedAt: new Date(row.deletedAt),
      deletedBy: row.deletedBy,
      deletedByName: row.deletedByName
    }));
  }
}

// 导出单例
export const trashService = new TrashService();

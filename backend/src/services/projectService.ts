/**
 * 项目服务
 * 负责项目的创建、查询、更新、删除等操作
 */

import { v4 as uuidv4 } from 'uuid';
import { databaseService } from './databaseService';
import { TABLE_NAMES } from '../config/constants';

// 项目接口
export interface Project {
  id: string;
  name: string;
  description: string | null;
  coverImageUrl: string | null;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  isDeleted: boolean;
  deletedAt: Date | null;
  deletedBy: string | null;
  imageCount?: number;        // 项目下的图片数量
  creatorName?: string;       // 创建者名称
}

// 创建项目请求
export interface CreateProjectRequest {
  name: string;
  description?: string;
  coverImageUrl?: string;
}

// 更新项目请求
export interface UpdateProjectRequest {
  name?: string;
  description?: string;
  coverImageUrl?: string;
}

/**
 * 项目服务类
 */
class ProjectService {
  /**
   * 创建项目
   */
  async createProject(userId: string, request: CreateProjectRequest): Promise<Project> {
    // 验证项目名称
    if (!request.name || request.name.trim().length === 0) {
      throw new Error('项目名称不能为空');
    }

    const projectId = uuidv4();
    const now = new Date();

    const sql = `
      INSERT INTO ${TABLE_NAMES.PROJECTS} 
      (id, name, description, cover_image_url, created_by, created_at, updated_at, is_deleted)
      VALUES (?, ?, ?, ?, ?, ?, ?, FALSE)
    `;

    await databaseService.executeQuery(sql, [
      projectId,
      request.name.trim(),
      request.description?.trim() || null,
      request.coverImageUrl || null,
      userId,
      now,
      now
    ]);

    return {
      id: projectId,
      name: request.name.trim(),
      description: request.description?.trim() || null,
      coverImageUrl: request.coverImageUrl || null,
      createdBy: userId,
      createdAt: now,
      updatedAt: now,
      isDeleted: false,
      deletedAt: null,
      deletedBy: null,
      imageCount: 0
    };
  }

  /**
   * 获取所有项目（不包括已删除的）
   */
  async getProjects(): Promise<Project[]> {
    const sql = `
      SELECT 
        p.id,
        p.name,
        p.description,
        p.cover_image_url as coverImageUrl,
        p.created_by as createdBy,
        p.created_at as createdAt,
        p.updated_at as updatedAt,
        p.is_deleted as isDeleted,
        p.deleted_at as deletedAt,
        p.deleted_by as deletedBy,
        u.display_name as creatorName,
        (SELECT COUNT(*) FROM ${TABLE_NAMES.IMAGES} WHERE project_id = p.id AND is_deleted = FALSE) as imageCount
      FROM ${TABLE_NAMES.PROJECTS} p
      LEFT JOIN ${TABLE_NAMES.USERS} u ON p.created_by = u.id
      WHERE p.is_deleted = FALSE
      ORDER BY p.updated_at DESC
    `;

    const rows = await databaseService.executeQuery(sql);
    return this.mapRowsToProjects(rows as any[]);
  }

  /**
   * 根据 ID 获取项目
   */
  async getProjectById(projectId: string): Promise<Project | null> {
    const sql = `
      SELECT 
        p.id,
        p.name,
        p.description,
        p.cover_image_url as coverImageUrl,
        p.created_by as createdBy,
        p.created_at as createdAt,
        p.updated_at as updatedAt,
        p.is_deleted as isDeleted,
        p.deleted_at as deletedAt,
        p.deleted_by as deletedBy,
        u.display_name as creatorName,
        (SELECT COUNT(*) FROM ${TABLE_NAMES.IMAGES} WHERE project_id = p.id AND is_deleted = FALSE) as imageCount
      FROM ${TABLE_NAMES.PROJECTS} p
      LEFT JOIN ${TABLE_NAMES.USERS} u ON p.created_by = u.id
      WHERE p.id = ?
    `;

    const rows = await databaseService.executeQuery(sql, [projectId]);
    const projects = this.mapRowsToProjects(rows as any[]);
    return projects.length > 0 ? projects[0] : null;
  }

  /**
   * 更新项目
   */
  async updateProject(projectId: string, request: UpdateProjectRequest): Promise<Project | null> {
    const updates: string[] = [];
    const values: any[] = [];

    if (request.name !== undefined) {
      if (!request.name || request.name.trim().length === 0) {
        throw new Error('项目名称不能为空');
      }
      updates.push('name = ?');
      values.push(request.name.trim());
    }

    if (request.description !== undefined) {
      updates.push('description = ?');
      values.push(request.description?.trim() || null);
    }

    if (request.coverImageUrl !== undefined) {
      updates.push('cover_image_url = ?');
      values.push(request.coverImageUrl || null);
    }

    if (updates.length === 0) {
      return this.getProjectById(projectId);
    }

    updates.push('updated_at = ?');
    values.push(new Date());
    values.push(projectId);

    const sql = `
      UPDATE ${TABLE_NAMES.PROJECTS}
      SET ${updates.join(', ')}
      WHERE id = ? AND is_deleted = FALSE
    `;

    await databaseService.executeQuery(sql, values);
    return this.getProjectById(projectId);
  }

  /**
   * 软删除项目（级联软删除图片）
   */
  async softDeleteProject(projectId: string, deletedBy: string): Promise<boolean> {
    const now = new Date();

    // 软删除项目
    const projectSql = `
      UPDATE ${TABLE_NAMES.PROJECTS}
      SET is_deleted = TRUE, deleted_at = ?, deleted_by = ?, updated_at = ?
      WHERE id = ? AND is_deleted = FALSE
    `;
    await databaseService.executeQuery(projectSql, [now, deletedBy, now, projectId]);

    // 级联软删除该项目下的所有图片
    const imagesSql = `
      UPDATE ${TABLE_NAMES.IMAGES}
      SET is_deleted = TRUE, deleted_at = ?, deleted_by = ?
      WHERE project_id = ? AND is_deleted = FALSE
    `;
    await databaseService.executeQuery(imagesSql, [now, deletedBy, projectId]);

    return true;
  }

  /**
   * 获取或创建默认项目
   */
  async getOrCreateDefaultProject(userId: string): Promise<Project> {
    // 先查找用户是否有当前项目
    const userSql = `SELECT current_project_id FROM ${TABLE_NAMES.USERS} WHERE id = ?`;
    const userRows = await databaseService.executeQuery(userSql, [userId]);
    
    if ((userRows as any[]).length > 0 && (userRows as any[])[0].current_project_id) {
      const currentProjectId = (userRows as any[])[0].current_project_id;
      const project = await this.getProjectById(currentProjectId);
      if (project && !project.isDeleted) {
        return project;
      }
    }

    // 查找用户最近使用的项目
    const recentSql = `
      SELECT id FROM ${TABLE_NAMES.PROJECTS}
      WHERE created_by = ? AND is_deleted = FALSE
      ORDER BY updated_at DESC
      LIMIT 1
    `;
    const recentRows = await databaseService.executeQuery(recentSql, [userId]);
    
    if ((recentRows as any[]).length > 0) {
      const projectId = (recentRows as any[])[0].id;
      await this.setCurrentProject(userId, projectId);
      return (await this.getProjectById(projectId))!;
    }

    // 查找任意可用项目
    const anySql = `
      SELECT id FROM ${TABLE_NAMES.PROJECTS}
      WHERE is_deleted = FALSE
      ORDER BY updated_at DESC
      LIMIT 1
    `;
    const anyRows = await databaseService.executeQuery(anySql);
    
    if ((anyRows as any[]).length > 0) {
      const projectId = (anyRows as any[])[0].id;
      await this.setCurrentProject(userId, projectId);
      return (await this.getProjectById(projectId))!;
    }

    // 没有项目，创建默认项目
    const defaultProject = await this.createProject(userId, {
      name: '默认项目',
      description: '自动创建的默认项目'
    });

    await this.setCurrentProject(userId, defaultProject.id);
    return defaultProject;
  }

  /**
   * 设置用户当前项目
   */
  async setCurrentProject(userId: string, projectId: string): Promise<void> {
    const sql = `
      UPDATE ${TABLE_NAMES.USERS}
      SET current_project_id = ?
      WHERE id = ?
    `;
    await databaseService.executeQuery(sql, [projectId, userId]);
  }

  /**
   * 获取用户当前项目 ID
   */
  async getCurrentProjectId(userId: string): Promise<string | null> {
    const sql = `SELECT current_project_id FROM ${TABLE_NAMES.USERS} WHERE id = ?`;
    const rows = await databaseService.executeQuery(sql, [userId]);
    
    if ((rows as any[]).length > 0) {
      return (rows as any[])[0].current_project_id;
    }
    return null;
  }

  /**
   * 切换项目
   */
  async switchProject(userId: string, projectId: string): Promise<Project> {
    const project = await this.getProjectById(projectId);
    if (!project) {
      throw new Error('项目不存在');
    }
    if (project.isDeleted) {
      throw new Error('项目已被删除');
    }

    await this.setCurrentProject(userId, projectId);

    // 更新项目的 updated_at 以便排序
    const updateSql = `
      UPDATE ${TABLE_NAMES.PROJECTS}
      SET updated_at = ?
      WHERE id = ?
    `;
    await databaseService.executeQuery(updateSql, [new Date(), projectId]);

    return project;
  }

  /**
   * 将数据库行映射为项目对象
   */
  private mapRowsToProjects(rows: any[]): Project[] {
    return rows.map(row => ({
      id: row.id,
      name: row.name,
      description: row.description,
      coverImageUrl: row.coverImageUrl,
      createdBy: row.createdBy,
      createdAt: new Date(row.createdAt),
      updatedAt: new Date(row.updatedAt),
      isDeleted: Boolean(row.isDeleted),
      deletedAt: row.deletedAt ? new Date(row.deletedAt) : null,
      deletedBy: row.deletedBy,
      imageCount: row.imageCount || 0,
      creatorName: row.creatorName
    }));
  }

  /**
   * 获取项目的画布状态
   * 用于持久化画布功能（需求 3.1, 3.2）
   */
  async getCanvasState(projectId: string): Promise<{ viewportX: number; viewportY: number; scale: number; lastUpdated: Date | null } | null> {
    const sql = `
      SELECT canvas_state 
      FROM ${TABLE_NAMES.PROJECTS} 
      WHERE id = ? AND is_deleted = FALSE
    `;
    
    const rows = await databaseService.executeQuery(sql, [projectId]);
    
    if ((rows as any[]).length === 0) {
      return null;
    }
    
    const canvasStateRaw = (rows as any[])[0].canvas_state;
    
    if (!canvasStateRaw) {
      return null;
    }
    
    try {
      const canvasState = typeof canvasStateRaw === 'string' 
        ? JSON.parse(canvasStateRaw) 
        : canvasStateRaw;
      
      return {
        viewportX: canvasState.viewportX || 0,
        viewportY: canvasState.viewportY || 0,
        scale: canvasState.scale || 1,
        lastUpdated: canvasState.lastUpdated ? new Date(canvasState.lastUpdated) : null
      };
    } catch (e) {
      console.warn('解析画布状态失败:', e);
      return null;
    }
  }

  /**
   * 保存项目的画布状态
   * 用于持久化画布功能（需求 3.1, 3.2）
   */
  async saveCanvasState(projectId: string, viewportX: number, viewportY: number, scale: number): Promise<boolean> {
    const canvasState = {
      viewportX,
      viewportY,
      scale,
      lastUpdated: new Date().toISOString()
    };
    
    const sql = `
      UPDATE ${TABLE_NAMES.PROJECTS}
      SET canvas_state = ?, updated_at = ?
      WHERE id = ? AND is_deleted = FALSE
    `;
    
    await databaseService.executeQuery(sql, [
      JSON.stringify(canvasState),
      new Date(),
      projectId
    ]);
    
    console.log(`画布状态保存成功: 项目 ${projectId} -> (${viewportX}, ${viewportY}, ${scale})`);
    return true;
  }

  /**
   * 获取项目的所有画布图片及画布状态
   * 用于持久化画布功能（需求 1.1, 1.2）
   */
  async getProjectCanvasImages(projectId: string): Promise<{
    images: Array<{
      id: string;
      url: string;
      thumbnailUrl: string | null;
      prompt: string;
      model: string;
      canvasX: number | null;
      canvasY: number | null;
      aspectRatio: string;
      imageSize: string;
      width: number | null;      // 图片实际宽度
      height: number | null;     // 图片实际高度
      status: string;            // 图片生成状态
      failureReason: string | null;  // 失败原因
      refImages: Array<{ url: string; id: string }> | null;  // 参考图片
      createdAt: Date;
    }>;
    canvasState: { viewportX: number; viewportY: number; scale: number; lastUpdated: Date | null } | null;
  }> {
    // 获取项目的所有未删除图片（包含 width、height、status、failure_reason、ref_images 字段）
    const imagesSql = `
      SELECT 
        id, url, thumbnail_url, prompt, model, 
        canvas_x, canvas_y, aspect_ratio, image_size, 
        width, height, status, failure_reason, ref_images, created_at
      FROM ${TABLE_NAMES.IMAGES}
      WHERE project_id = ? AND (is_deleted = FALSE OR is_deleted IS NULL)
      ORDER BY created_at DESC
    `;
    
    const imageRows = await databaseService.executeQuery(imagesSql, [projectId]);
    
    // 转换图片数据（包含实际尺寸、状态和参考图）
    const images = (imageRows as any[]).map(row => {
      // 安全解析 ref_images JSON 字段
      let refImages = null;
      if (row.ref_images) {
        try {
          refImages = typeof row.ref_images === 'string' ? JSON.parse(row.ref_images) : row.ref_images;
        } catch (e) {
          console.warn('解析 ref_images 失败:', e);
        }
      }
      
      return {
        id: row.id,
        url: row.url || '',  // 失败时可能为空
        thumbnailUrl: row.thumbnail_url || null,
        prompt: row.prompt,
        model: row.model,
        canvasX: row.canvas_x !== null && row.canvas_x !== undefined ? Number(row.canvas_x) : null,
        canvasY: row.canvas_y !== null && row.canvas_y !== undefined ? Number(row.canvas_y) : null,
        aspectRatio: row.aspect_ratio || 'auto',
        imageSize: row.image_size || '1K',
        width: row.width !== null && row.width !== undefined ? Number(row.width) : null,
        height: row.height !== null && row.height !== undefined ? Number(row.height) : null,
        status: row.status || 'success',
        failureReason: row.failure_reason || null,
        refImages,
        createdAt: new Date(row.created_at)
      };
    });
    
    // 获取画布状态
    const canvasState = await this.getCanvasState(projectId);
    
    return {
      images,
      canvasState
    };
  }
}

// 导出单例
export const projectService = new ProjectService();

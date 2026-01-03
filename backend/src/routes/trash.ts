/**
 * 回收站路由
 * 提供回收站的查看、恢复、永久删除等 API
 * 
 * 需求: 8.2, 8.3, 9.4
 */

import { Router, Request, Response } from 'express';
import { ApiResponse } from '@shared/types';
import { trashService } from '../services/trashService';
import { userService } from '../services/userService';

const router = Router();

/**
 * GET /api/trash
 * 获取回收站内容（已删除的项目和图片）
 */
router.get('/', async (_req: Request, res: Response) => {
  try {
    const trashContent = await trashService.getTrashItems();
    
    const response: ApiResponse = {
      success: true,
      data: trashContent
    };
    res.json(response);
  } catch (error: any) {
    console.error('获取回收站内容失败:', error);
    const response: ApiResponse = {
      success: false,
      error: error.message || '获取回收站内容失败'
    };
    res.status(500).json(response);
  }
});

/**
 * POST /api/trash/restore/project/:id
 * 恢复已删除的项目（级联恢复图片）
 */
router.post('/restore/project/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const project = await trashService.restoreProject(id);
    
    const response: ApiResponse = {
      success: true,
      data: project,
      message: '项目已恢复'
    };
    res.json(response);
  } catch (error: any) {
    console.error('恢复项目失败:', error);
    
    let statusCode = 500;
    if (error.message === '项目不存在或未被删除') {
      statusCode = 404;
    }
    
    const response: ApiResponse = {
      success: false,
      error: error.message || '恢复项目失败'
    };
    res.status(statusCode).json(response);
  }
});

/**
 * POST /api/trash/restore/image/:id
 * 恢复已删除的图片
 */
router.post('/restore/image/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await trashService.restoreImage(id);
    
    const response: ApiResponse = {
      success: true,
      message: '图片已恢复'
    };
    res.json(response);
  } catch (error: any) {
    console.error('恢复图片失败:', error);
    
    let statusCode = 500;
    if (error.message === '图片不存在或未被删除') {
      statusCode = 404;
    }
    
    const response: ApiResponse = {
      success: false,
      error: error.message || '恢复图片失败'
    };
    res.status(statusCode).json(response);
  }
});

/**
 * DELETE /api/trash/project/:id
 * 永久删除项目（仅管理员）
 */
router.delete('/project/:id', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      const response: ApiResponse = {
        success: false,
        error: '未授权'
      };
      return res.status(401).json(response);
    }

    // 检查是否为管理员
    const isAdmin = await userService.isAdmin(userId);
    if (!isAdmin) {
      const response: ApiResponse = {
        success: false,
        error: '权限不足，只有管理员可以永久删除'
      };
      return res.status(403).json(response);
    }

    const { id } = req.params;
    await trashService.hardDeleteProject(id);
    
    const response: ApiResponse = {
      success: true,
      message: '项目已永久删除'
    };
    res.json(response);
  } catch (error: any) {
    console.error('永久删除项目失败:', error);
    const response: ApiResponse = {
      success: false,
      error: error.message || '永久删除项目失败'
    };
    res.status(500).json(response);
  }
});

/**
 * DELETE /api/trash/image/:id
 * 永久删除图片（仅管理员）
 */
router.delete('/image/:id', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      const response: ApiResponse = {
        success: false,
        error: '未授权'
      };
      return res.status(401).json(response);
    }

    // 检查是否为管理员
    const isAdmin = await userService.isAdmin(userId);
    if (!isAdmin) {
      const response: ApiResponse = {
        success: false,
        error: '权限不足，只有管理员可以永久删除'
      };
      return res.status(403).json(response);
    }

    const { id } = req.params;
    await trashService.hardDeleteImage(id);
    
    const response: ApiResponse = {
      success: true,
      message: '图片已永久删除'
    };
    res.json(response);
  } catch (error: any) {
    console.error('永久删除图片失败:', error);
    const response: ApiResponse = {
      success: false,
      error: error.message || '永久删除图片失败'
    };
    res.status(500).json(response);
  }
});

/**
 * DELETE /api/trash/empty
 * 清空回收站（仅管理员）
 */
router.delete('/empty', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      const response: ApiResponse = {
        success: false,
        error: '未授权'
      };
      return res.status(401).json(response);
    }

    // 检查是否为管理员
    const isAdmin = await userService.isAdmin(userId);
    if (!isAdmin) {
      const response: ApiResponse = {
        success: false,
        error: '权限不足，只有管理员可以清空回收站'
      };
      return res.status(403).json(response);
    }

    const result = await trashService.emptyTrash();
    
    let message = `回收站已清空，删除了 ${result.deletedProjects} 个项目和 ${result.deletedImages} 张图片`;
    if (result.ossErrors.length > 0) {
      message += `\n注意：部分云存储文件删除失败，请联系管理员处理`;
    }
    
    const response: ApiResponse = {
      success: true,
      data: result,
      message
    };
    res.json(response);
  } catch (error: any) {
    console.error('清空回收站失败:', error);
    const response: ApiResponse = {
      success: false,
      error: error.message || '清空回收站失败'
    };
    res.status(500).json(response);
  }
});

export default router;

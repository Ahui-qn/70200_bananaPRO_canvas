/**
 * 项目管理路由
 * 提供项目的 CRUD 操作 API
 * 
 * 需求: 1.2, 2.3, 3.1, 6.2, 7.1
 */

import { Router, Request, Response } from 'express';
import { ApiResponse } from '@shared/types';
import { projectService, CreateProjectRequest, UpdateProjectRequest } from '../services/projectService';

const router = Router();

/**
 * GET /api/projects
 * 获取所有项目列表（不包括已删除的）
 */
router.get('/', async (_req: Request, res: Response) => {
  try {
    const projects = await projectService.getProjects();
    
    const response: ApiResponse = {
      success: true,
      data: projects
    };
    res.json(response);
  } catch (error: any) {
    console.error('获取项目列表失败:', error);
    const response: ApiResponse = {
      success: false,
      error: error.message || '获取项目列表失败'
    };
    res.status(500).json(response);
  }
});

/**
 * GET /api/projects/current
 * 获取当前用户的当前项目（如果没有则自动创建默认项目）
 */
router.get('/current', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      const response: ApiResponse = {
        success: false,
        error: '未授权'
      };
      return res.status(401).json(response);
    }

    const project = await projectService.getOrCreateDefaultProject(userId);
    
    const response: ApiResponse = {
      success: true,
      data: project
    };
    res.json(response);
  } catch (error: any) {
    console.error('获取当前项目失败:', error);
    const response: ApiResponse = {
      success: false,
      error: error.message || '获取当前项目失败'
    };
    res.status(500).json(response);
  }
});

/**
 * GET /api/projects/:id
 * 获取单个项目详情
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const project = await projectService.getProjectById(id);
    
    if (!project) {
      const response: ApiResponse = {
        success: false,
        error: '项目不存在'
      };
      return res.status(404).json(response);
    }

    if (project.isDeleted) {
      const response: ApiResponse = {
        success: false,
        error: '项目已被删除'
      };
      return res.status(410).json(response);
    }
    
    const response: ApiResponse = {
      success: true,
      data: project
    };
    res.json(response);
  } catch (error: any) {
    console.error('获取项目详情失败:', error);
    const response: ApiResponse = {
      success: false,
      error: error.message || '获取项目详情失败'
    };
    res.status(500).json(response);
  }
});

/**
 * POST /api/projects
 * 创建新项目
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      const response: ApiResponse = {
        success: false,
        error: '未授权'
      };
      return res.status(401).json(response);
    }

    const { name, description, coverImageUrl } = req.body;
    
    if (!name || name.trim().length === 0) {
      const response: ApiResponse = {
        success: false,
        error: '项目名称不能为空'
      };
      return res.status(400).json(response);
    }

    const request: CreateProjectRequest = {
      name,
      description,
      coverImageUrl
    };

    const project = await projectService.createProject(userId, request);
    
    // 自动切换到新创建的项目
    await projectService.setCurrentProject(userId, project.id);
    
    const response: ApiResponse = {
      success: true,
      data: project,
      message: '项目创建成功'
    };
    res.status(201).json(response);
  } catch (error: any) {
    console.error('创建项目失败:', error);
    const response: ApiResponse = {
      success: false,
      error: error.message || '创建项目失败'
    };
    res.status(500).json(response);
  }
});

/**
 * PUT /api/projects/:id
 * 更新项目信息
 */
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, description, coverImageUrl } = req.body;

    const request: UpdateProjectRequest = {};
    if (name !== undefined) request.name = name;
    if (description !== undefined) request.description = description;
    if (coverImageUrl !== undefined) request.coverImageUrl = coverImageUrl;

    const project = await projectService.updateProject(id, request);
    
    if (!project) {
      const response: ApiResponse = {
        success: false,
        error: '项目不存在或已被删除'
      };
      return res.status(404).json(response);
    }
    
    const response: ApiResponse = {
      success: true,
      data: project,
      message: '项目更新成功'
    };
    res.json(response);
  } catch (error: any) {
    console.error('更新项目失败:', error);
    const response: ApiResponse = {
      success: false,
      error: error.message || '更新项目失败'
    };
    res.status(500).json(response);
  }
});

/**
 * DELETE /api/projects/:id
 * 软删除项目
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      const response: ApiResponse = {
        success: false,
        error: '未授权'
      };
      return res.status(401).json(response);
    }

    const { id } = req.params;
    
    // 检查是否是当前项目
    const currentProjectId = await projectService.getCurrentProjectId(userId);
    
    await projectService.softDeleteProject(id, userId);
    
    // 如果删除的是当前项目，自动切换到其他项目
    if (currentProjectId === id) {
      await projectService.getOrCreateDefaultProject(userId);
    }
    
    const response: ApiResponse = {
      success: true,
      message: '项目已移入回收站'
    };
    res.json(response);
  } catch (error: any) {
    console.error('删除项目失败:', error);
    const response: ApiResponse = {
      success: false,
      error: error.message || '删除项目失败'
    };
    res.status(500).json(response);
  }
});

/**
 * PUT /api/projects/:id/switch
 * 切换到指定项目
 */
router.put('/:id/switch', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      const response: ApiResponse = {
        success: false,
        error: '未授权'
      };
      return res.status(401).json(response);
    }

    const { id } = req.params;
    const project = await projectService.switchProject(userId, id);
    
    const response: ApiResponse = {
      success: true,
      data: project,
      message: '已切换到项目'
    };
    res.json(response);
  } catch (error: any) {
    console.error('切换项目失败:', error);
    
    let statusCode = 500;
    if (error.message === '项目不存在') {
      statusCode = 404;
    } else if (error.message === '项目已被删除') {
      statusCode = 410;
    }
    
    const response: ApiResponse = {
      success: false,
      error: error.message || '切换项目失败'
    };
    res.status(statusCode).json(response);
  }
});

/**
 * GET /api/projects/:id/canvas-state
 * 获取项目的画布状态（视口位置和缩放比例）
 * 需求: 3.1, 3.2
 */
router.get('/:id/canvas-state', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const canvasState = await projectService.getCanvasState(id);
    
    const response: ApiResponse = {
      success: true,
      data: canvasState
    };
    res.json(response);
  } catch (error: any) {
    console.error('获取画布状态失败:', error);
    const response: ApiResponse = {
      success: false,
      error: error.message || '获取画布状态失败'
    };
    res.status(500).json(response);
  }
});

/**
 * PUT /api/projects/:id/canvas-state
 * 保存项目的画布状态（视口位置和缩放比例）
 * 需求: 3.1, 3.2
 */
router.put('/:id/canvas-state', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { viewportX, viewportY, scale } = req.body;
    
    // 验证参数
    if (typeof viewportX !== 'number' || typeof viewportY !== 'number' || typeof scale !== 'number') {
      const response: ApiResponse = {
        success: false,
        error: '无效的画布状态参数'
      };
      return res.status(400).json(response);
    }
    
    // 验证缩放比例范围
    if (scale < 0.1 || scale > 3.0) {
      const response: ApiResponse = {
        success: false,
        error: '缩放比例必须在 0.1 到 3.0 之间'
      };
      return res.status(400).json(response);
    }
    
    await projectService.saveCanvasState(id, viewportX, viewportY, scale);
    
    const response: ApiResponse = {
      success: true,
      message: '画布状态保存成功'
    };
    res.json(response);
  } catch (error: any) {
    console.error('保存画布状态失败:', error);
    const response: ApiResponse = {
      success: false,
      error: error.message || '保存画布状态失败'
    };
    res.status(500).json(response);
  }
});

/**
 * GET /api/projects/:id/canvas-images
 * 获取项目的所有画布图片及画布状态
 * 需求: 1.1, 1.2
 */
router.get('/:id/canvas-images', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    // 检查项目是否存在
    const project = await projectService.getProjectById(id);
    if (!project) {
      const response: ApiResponse = {
        success: false,
        error: '项目不存在'
      };
      return res.status(404).json(response);
    }
    
    if (project.isDeleted) {
      const response: ApiResponse = {
        success: false,
        error: '项目已被删除'
      };
      return res.status(410).json(response);
    }
    
    const result = await projectService.getProjectCanvasImages(id);
    
    const response: ApiResponse = {
      success: true,
      data: result
    };
    res.json(response);
  } catch (error: any) {
    console.error('获取项目画布图片失败:', error);
    const response: ApiResponse = {
      success: false,
      error: error.message || '获取项目画布图片失败'
    };
    res.status(500).json(response);
  }
});

export default router;

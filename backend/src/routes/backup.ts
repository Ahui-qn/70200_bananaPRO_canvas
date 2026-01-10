/**
 * 数据库备份 API 路由
 */

import express from 'express';
import { databaseBackupService } from '../services/databaseBackupService.js';
import { ApiResponse } from '@shared/types';

const router = express.Router();

/**
 * GET /api/backup/list
 * 获取备份列表
 */
router.get('/list', async (_req, res) => {
  try {
    const backups = databaseBackupService.getBackupList();
    const lastBackupTime = databaseBackupService.getLastBackupTime();
    
    const response: ApiResponse = {
      success: true,
      data: {
        backups: backups.map(b => ({
          name: b.name,
          size: b.size,
          sizeFormatted: formatFileSize(b.size),
          time: b.time.toISOString(),
        })),
        lastBackupTime: lastBackupTime?.toISOString() || null,
        backupDir: databaseBackupService.getBackupDir(),
      },
    };
    
    res.json(response);
  } catch (error: any) {
    const response: ApiResponse = {
      success: false,
      error: error.message || '获取备份列表失败',
    };
    res.status(500).json(response);
  }
});

/**
 * POST /api/backup/create
 * 手动创建备份
 */
router.post('/create', async (req, res) => {
  try {
    const reason = req.body.reason || 'manual';
    const backupPath = await databaseBackupService.backup(reason);
    
    if (backupPath) {
      const response: ApiResponse = {
        success: true,
        message: '备份创建成功',
        data: { backupPath },
      };
      res.json(response);
    } else {
      const response: ApiResponse = {
        success: false,
        error: '备份创建失败',
      };
      res.status(500).json(response);
    }
  } catch (error: any) {
    const response: ApiResponse = {
      success: false,
      error: error.message || '备份创建失败',
    };
    res.status(500).json(response);
  }
});

/**
 * POST /api/backup/restore
 * 从备份恢复数据库
 */
router.post('/restore', async (req, res) => {
  try {
    const { backupName } = req.body;
    
    if (!backupName) {
      const response: ApiResponse = {
        success: false,
        error: '请指定备份文件名',
      };
      return res.status(400).json(response);
    }
    
    const success = await databaseBackupService.restore(backupName);
    
    if (success) {
      const response: ApiResponse = {
        success: true,
        message: '数据库恢复成功，请重启服务以应用更改',
      };
      res.json(response);
    } else {
      const response: ApiResponse = {
        success: false,
        error: '数据库恢复失败',
      };
      res.status(500).json(response);
    }
  } catch (error: any) {
    const response: ApiResponse = {
      success: false,
      error: error.message || '数据库恢复失败',
    };
    res.status(500).json(response);
  }
});

/**
 * 格式化文件大小
 */
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export default router;

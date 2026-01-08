/**
 * 回收站组件
 * 展示已删除的项目和图片，支持恢复和永久删除
 * 
 * 需求: 8.1, 8.2, 8.3, 9.1, 9.2, 9.3
 */

import React, { useState, useEffect, useCallback } from 'react';
import { TrashContent, DeletedProject, DeletedImage, ApiResponse } from '@shared/types';
import { getAuthHeaders } from '../contexts/AuthContext';
import { useAuth } from '../contexts/AuthContext';
import { useProject } from '../contexts/ProjectContext';

// API 基础地址
const API_BASE_URL = '/api';

// 标签页类型
type TabType = 'projects' | 'images';

// 确认弹框组件
interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  isDanger?: boolean;
}

const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  message,
  confirmText = '确定',
  cancelText = '取消',
  onConfirm,
  onCancel,
  isDanger = false
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative w-full max-w-sm bg-gradient-to-br from-slate-800/95 to-slate-900/95 rounded-2xl border border-white/10 shadow-2xl p-6">
        <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
        <p className="text-sm text-white/60 mb-6 whitespace-pre-line">{message}</p>
        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white/80 text-sm transition-colors"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            className={`px-4 py-2 rounded-lg text-sm transition-colors ${
              isDanger 
                ? 'bg-red-500/20 hover:bg-red-500/30 text-red-400' 
                : 'bg-violet-500/20 hover:bg-violet-500/30 text-violet-400'
            }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

// 已删除项目卡片
interface DeletedProjectCardProps {
  project: DeletedProject;
  isAdmin: boolean;
  onRestore: () => void;
  onHardDelete: () => void;
}

const DeletedProjectCard: React.FC<DeletedProjectCardProps> = ({
  project,
  isAdmin,
  onRestore,
  onHardDelete
}) => {
  const formatDate = (date: Date) => {
    return new Date(date).toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="p-4 rounded-xl bg-white/10 border border-white/20">
      {/* 封面图片 */}
      <div className="w-full h-24 rounded-lg bg-gradient-to-br from-red-500/20 to-orange-500/20 mb-3 overflow-hidden">
        {project.coverImageUrl ? (
          <img 
            src={project.coverImageUrl} 
            alt={project.name}
            className="w-full h-full object-cover opacity-50"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-white/30">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
          </div>
        )}
      </div>

      {/* 项目信息 */}
      <h3 className="text-white font-medium truncate mb-1">{project.name}</h3>
      {project.description && (
        <p className="text-white/60 text-sm truncate mb-2">{project.description}</p>
      )}
      
      {/* 删除信息 */}
      <div className="text-xs text-white/40 mb-3 space-y-1">
        <div>删除时间: {formatDate(project.deletedAt)}</div>
        <div>删除者: {project.deletedByName || '未知'}</div>
        <div>包含 {project.imageCount} 张图片</div>
      </div>

      {/* 操作按钮 */}
      <div className="flex gap-2">
        <button
          onClick={onRestore}
          className="flex-1 px-3 py-2 rounded-lg bg-green-500/20 hover:bg-green-500/30 text-green-400 text-sm transition-colors"
        >
          恢复
        </button>
        {isAdmin && (
          <button
            onClick={onHardDelete}
            className="flex-1 px-3 py-2 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-400 text-sm transition-colors"
          >
            永久删除
          </button>
        )}
      </div>
    </div>
  );
};


// 已删除图片卡片
interface DeletedImageCardProps {
  image: DeletedImage;
  isAdmin: boolean;
  onRestore: () => void;
  onHardDelete: () => void;
}

const DeletedImageCard: React.FC<DeletedImageCardProps> = ({
  image,
  isAdmin,
  onRestore,
  onHardDelete
}) => {
  const formatDate = (date: Date) => {
    return new Date(date).toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="p-4 rounded-xl bg-white/10 border border-white/20">
      {/* 图片预览 */}
      <div className="w-full h-32 rounded-lg bg-black/20 mb-3 overflow-hidden">
        <img 
          src={image.url} 
          alt={image.prompt}
          className="w-full h-full object-cover opacity-50"
        />
      </div>

      {/* 图片信息 */}
      <p className="text-white text-sm truncate mb-1" title={image.prompt}>
        {image.prompt}
      </p>
      <div className="text-xs text-white/40 mb-1">
        模型: {image.model}
      </div>
      {image.projectName && (
        <div className="text-xs text-white/40 mb-1">
          项目: {image.projectName}
        </div>
      )}
      
      {/* 删除信息 */}
      <div className="text-xs text-white/40 mb-3 space-y-1">
        <div>删除时间: {formatDate(image.deletedAt)}</div>
        <div>删除者: {image.deletedByName || '未知'}</div>
      </div>

      {/* 操作按钮 */}
      <div className="flex gap-2">
        <button
          onClick={onRestore}
          className="flex-1 px-3 py-2 rounded-lg bg-green-500/20 hover:bg-green-500/30 text-green-400 text-sm transition-colors"
        >
          恢复
        </button>
        {isAdmin && (
          <button
            onClick={onHardDelete}
            className="flex-1 px-3 py-2 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-400 text-sm transition-colors"
          >
            永久删除
          </button>
        )}
      </div>
    </div>
  );
};

// 主组件
interface TrashBinProps {
  isOpen: boolean;
  onClose: () => void;
  onImageRestored?: () => void;  // 图片恢复后的回调，用于刷新画布
}

const TrashBin: React.FC<TrashBinProps> = ({ isOpen, onClose, onImageRestored }) => {
  const { user } = useAuth();
  const { refreshProjects } = useProject();
  const [activeTab, setActiveTab] = useState<TabType>('projects');
  const [trashContent, setTrashContent] = useState<TrashContent | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // 确认弹框状态
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {}
  });

  const isAdmin = user?.role === 'admin';

  // 获取回收站内容
  const fetchTrashContent = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/trash`, {
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json'
        }
      });

      const data: ApiResponse<TrashContent> = await response.json();
      
      if (!response.ok || !data.success) {
        throw new Error(data.error || '获取回收站内容失败');
      }

      setTrashContent(data.data || { projects: [], images: [] });
    } catch (err: any) {
      console.error('获取回收站内容失败:', err);
      setError(err.message || '获取回收站内容失败');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 打开时加载数据
  useEffect(() => {
    if (isOpen) {
      fetchTrashContent();
    }
  }, [isOpen, fetchTrashContent]);

  // 恢复项目
  const handleRestoreProject = async (projectId: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/trash/restore/project/${projectId}`, {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json'
        }
      });

      const data: ApiResponse = await response.json();
      
      if (!response.ok || !data.success) {
        throw new Error(data.error || '恢复项目失败');
      }

      // 刷新回收站列表
      await fetchTrashContent();
      
      // 刷新项目列表，使项目切换器显示恢复的项目
      await refreshProjects();
    } catch (err: any) {
      console.error('恢复项目失败:', err);
      alert(err.message || '恢复项目失败');
    }
  };

  // 恢复图片
  const handleRestoreImage = async (imageId: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/trash/restore/image/${imageId}`, {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json'
        }
      });

      const data: ApiResponse = await response.json();
      
      if (!response.ok || !data.success) {
        throw new Error(data.error || '恢复图片失败');
      }

      // 刷新回收站列表
      await fetchTrashContent();
      
      // 通知父组件刷新画布图片
      if (onImageRestored) {
        onImageRestored();
      }
    } catch (err: any) {
      console.error('恢复图片失败:', err);
      alert(err.message || '恢复图片失败');
    }
  };

  // 永久删除项目
  const handleHardDeleteProject = async (project: DeletedProject) => {
    setConfirmDialog({
      isOpen: true,
      title: '永久删除项目',
      message: `确定要永久删除项目「${project.name}」吗？\n此操作不可恢复，项目下的所有图片也将被永久删除！`,
      onConfirm: async () => {
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
        try {
          const response = await fetch(`${API_BASE_URL}/trash/project/${project.id}`, {
            method: 'DELETE',
            headers: {
              ...getAuthHeaders(),
              'Content-Type': 'application/json'
            }
          });

          const data: ApiResponse = await response.json();
          
          if (!response.ok || !data.success) {
            throw new Error(data.error || '永久删除项目失败');
          }

          // 刷新列表
          await fetchTrashContent();
        } catch (err: any) {
          console.error('永久删除项目失败:', err);
          alert(err.message || '永久删除项目失败');
        }
      }
    });
  };

  // 永久删除图片
  const handleHardDeleteImage = async (image: DeletedImage) => {
    setConfirmDialog({
      isOpen: true,
      title: '永久删除图片',
      message: '确定要永久删除这张图片吗？\n此操作不可恢复！',
      onConfirm: async () => {
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
        try {
          const response = await fetch(`${API_BASE_URL}/trash/image/${image.id}`, {
            method: 'DELETE',
            headers: {
              ...getAuthHeaders(),
              'Content-Type': 'application/json'
            }
          });

          const data: ApiResponse = await response.json();
          
          if (!response.ok || !data.success) {
            throw new Error(data.error || '永久删除图片失败');
          }

          // 刷新列表
          await fetchTrashContent();
        } catch (err: any) {
          console.error('永久删除图片失败:', err);
          alert(err.message || '永久删除图片失败');
        }
      }
    });
  };

  // 清空回收站
  const handleEmptyTrash = async () => {
    setConfirmDialog({
      isOpen: true,
      title: '清空回收站',
      message: '确定要清空回收站吗？\n此操作不可恢复，所有已删除的项目和图片将被永久删除！',
      onConfirm: async () => {
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
        try {
          const response = await fetch(`${API_BASE_URL}/trash/empty`, {
            method: 'DELETE',
            headers: {
              ...getAuthHeaders(),
              'Content-Type': 'application/json'
            }
          });

          const data: ApiResponse = await response.json();
          
          if (!response.ok || !data.success) {
            throw new Error(data.error || '清空回收站失败');
          }

          // 刷新列表
          await fetchTrashContent();
        } catch (err: any) {
          console.error('清空回收站失败:', err);
          alert(err.message || '清空回收站失败');
        }
      }
    });
  };

  if (!isOpen) return null;

  const projectCount = trashContent?.projects.length || 0;
  const imageCount = trashContent?.images.length || 0;

  return (
    <>
      {/* 确认弹框 */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        confirmText="确定删除"
        cancelText="取消"
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
        isDanger={true}
      />
      
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* 背景遮罩 */}
        <div 
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        />
      
      {/* 弹窗内容 */}
      <div className="relative w-full max-w-4xl max-h-[85vh] bg-gradient-to-br from-slate-800/95 to-slate-900/95 rounded-2xl border border-white/10 shadow-2xl overflow-hidden">
        {/* 头部 */}
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <svg className="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            <h2 className="text-xl font-semibold text-white">回收站</h2>
          </div>
          <div className="flex items-center gap-2">
            {isAdmin && (projectCount > 0 || imageCount > 0) && (
              <button
                onClick={handleEmptyTrash}
                className="px-3 py-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-400 text-sm transition-colors"
              >
                清空回收站
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-white/10 text-white/60 hover:text-white transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* 标签页 */}
        <div className="flex border-b border-white/10">
          <button
            onClick={() => setActiveTab('projects')}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === 'projects'
                ? 'text-purple-400 border-b-2 border-purple-400'
                : 'text-white/60 hover:text-white'
            }`}
          >
            项目 ({projectCount})
          </button>
          <button
            onClick={() => setActiveTab('images')}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === 'images'
                ? 'text-purple-400 border-b-2 border-purple-400'
                : 'text-white/60 hover:text-white'
            }`}
          >
            图片 ({imageCount})
          </button>
        </div>

        {/* 内容区域 */}
        <div className="p-4 overflow-y-auto max-h-[calc(85vh-140px)]">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-purple-500 border-t-transparent" />
            </div>
          ) : error ? (
            <div className="text-center py-12 text-red-400">
              {error}
            </div>
          ) : activeTab === 'projects' ? (
            projectCount > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {trashContent?.projects.map(project => (
                  <DeletedProjectCard
                    key={project.id}
                    project={project}
                    isAdmin={isAdmin}
                    onRestore={() => handleRestoreProject(project.id)}
                    onHardDelete={() => handleHardDeleteProject(project)}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-white/40">
                回收站中没有已删除的项目
              </div>
            )
          ) : (
            imageCount > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {trashContent?.images.map(image => (
                  <DeletedImageCard
                    key={image.id}
                    image={image}
                    isAdmin={isAdmin}
                    onRestore={() => handleRestoreImage(image.id)}
                    onHardDelete={() => handleHardDeleteImage(image)}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-white/40">
                回收站中没有已删除的图片
              </div>
            )
          )}
        </div>
      </div>
      </div>
    </>
  );
};

export default TrashBin;

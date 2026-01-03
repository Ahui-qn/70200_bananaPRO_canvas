/**
 * 项目切换器组件
 * 显示当前项目名称，点击展开项目列表弹窗
 * 
 * 需求: 2.1, 2.2, 2.3, 2.4, 2.5, 3.2, 3.3, 6.1, 7.1
 */

import React, { useState } from 'react';
import { useProject } from '../contexts/ProjectContext';
import { Project, CreateProjectRequest } from '@shared/types';

// 项目卡片组件
interface ProjectCardProps {
  project: Project;
  isActive: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

const ProjectCard: React.FC<ProjectCardProps> = ({
  project,
  isActive,
  onSelect,
  onEdit,
  onDelete
}) => {
  return (
    <div
      className={`
        relative p-4 rounded-xl cursor-pointer transition-all duration-200
        ${isActive 
          ? 'bg-purple-500/30 border-2 border-purple-400' 
          : 'bg-white/10 border border-white/20 hover:bg-white/20'
        }
      `}
      onClick={onSelect}
    >
      {/* 封面图片 */}
      <div className="w-full h-24 rounded-lg bg-gradient-to-br from-purple-500/30 to-pink-500/30 mb-3 overflow-hidden">
        {project.coverImageUrl ? (
          <img 
            src={project.coverImageUrl} 
            alt={project.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-white/40">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
        )}
      </div>

      {/* 项目信息 */}
      <h3 className="text-white font-medium truncate mb-1">{project.name}</h3>
      {project.description && (
        <p className="text-white/60 text-sm truncate mb-2">{project.description}</p>
      )}
      
      {/* 元信息 */}
      <div className="flex items-center justify-between text-xs text-white/40">
        <div className="flex items-center gap-1">
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
          <span>{project.creatorName || '未知用户'}</span>
        </div>
        <div className="flex items-center gap-1">
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <span>{project.imageCount || 0} 张</span>
        </div>
      </div>

      {/* 操作按钮 */}
      <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={(e) => { e.stopPropagation(); onEdit(); }}
          className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white/60 hover:text-white transition-colors"
          title="编辑项目"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="p-1.5 rounded-lg bg-white/10 hover:bg-red-500/30 text-white/60 hover:text-red-400 transition-colors"
          title="删除项目"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>

      {/* 当前项目标记 */}
      {isActive && (
        <div className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-purple-500 text-white text-xs">
          当前
        </div>
      )}
    </div>
  );
};


// 创建/编辑项目表单
interface ProjectFormProps {
  project?: Project;
  onSubmit: (data: CreateProjectRequest) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

const ProjectForm: React.FC<ProjectFormProps> = ({
  project,
  onSubmit,
  onCancel,
  isLoading
}) => {
  const [name, setName] = useState(project?.name || '');
  const [description, setDescription] = useState(project?.description || '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSubmit({ name: name.trim(), description: description.trim() || undefined });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-white/80 text-sm mb-1">项目名称 *</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="输入项目名称"
          className="w-full px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder-white/40 focus:outline-none focus:border-purple-400"
          autoFocus
          disabled={isLoading}
        />
      </div>
      <div>
        <label className="block text-white/80 text-sm mb-1">项目描述</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="输入项目描述（可选）"
          rows={3}
          className="w-full px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder-white/40 focus:outline-none focus:border-purple-400 resize-none"
          disabled={isLoading}
        />
      </div>
      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 rounded-lg bg-white/10 text-white hover:bg-white/20 transition-colors"
          disabled={isLoading}
        >
          取消
        </button>
        <button
          type="submit"
          disabled={!name.trim() || isLoading}
          className="px-4 py-2 rounded-lg bg-purple-500 text-white hover:bg-purple-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? '保存中...' : (project ? '保存' : '创建')}
        </button>
      </div>
    </form>
  );
};

// 主组件
const ProjectSwitcher: React.FC = () => {
  const { currentProject, projects, isLoading, switchProject, createProject, updateProject, deleteProject } = useProject();
  const [isOpen, setIsOpen] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 处理项目选择
  const handleSelectProject = async (project: Project) => {
    if (project.id === currentProject?.id) return;
    try {
      await switchProject(project.id);
      setIsOpen(false);
    } catch (err) {
      console.error('切换项目失败:', err);
    }
  };

  // 处理创建项目
  const handleCreateProject = async (data: CreateProjectRequest) => {
    setIsSubmitting(true);
    try {
      await createProject(data);
      setShowForm(false);
      setIsOpen(false);
    } catch (err) {
      console.error('创建项目失败:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // 处理编辑项目
  const handleEditProject = async (data: CreateProjectRequest) => {
    if (!editingProject) return;
    setIsSubmitting(true);
    try {
      await updateProject(editingProject.id, data);
      setEditingProject(null);
    } catch (err) {
      console.error('更新项目失败:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // 处理删除项目
  const handleDeleteProject = async (project: Project) => {
    if (!confirm(`确定要删除项目"${project.name}"吗？\n项目将被移入回收站，可以稍后恢复。`)) return;
    try {
      await deleteProject(project.id);
    } catch (err) {
      console.error('删除项目失败:', err);
    }
  };

  return (
    <>
      {/* 触发按钮 */}
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
        </svg>
        <span className="max-w-32 truncate">{currentProject?.name || '选择项目'}</span>
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* 弹窗 */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* 背景遮罩 */}
          <div 
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => { setIsOpen(false); setShowForm(false); setEditingProject(null); }}
          />
          
          {/* 弹窗内容 */}
          <div className="relative w-full max-w-3xl max-h-[80vh] bg-gradient-to-br from-slate-800/95 to-slate-900/95 rounded-2xl border border-white/10 shadow-2xl overflow-hidden">
            {/* 头部 */}
            <div className="flex items-center justify-between p-4 border-b border-white/10">
              <h2 className="text-xl font-semibold text-white">
                {showForm ? '新建项目' : editingProject ? '编辑项目' : '选择项目'}
              </h2>
              <button
                onClick={() => { setIsOpen(false); setShowForm(false); setEditingProject(null); }}
                className="p-2 rounded-lg hover:bg-white/10 text-white/60 hover:text-white transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* 内容区域 */}
            <div className="p-4 overflow-y-auto max-h-[calc(80vh-120px)]">
              {showForm ? (
                <ProjectForm
                  onSubmit={handleCreateProject}
                  onCancel={() => setShowForm(false)}
                  isLoading={isSubmitting}
                />
              ) : editingProject ? (
                <ProjectForm
                  project={editingProject}
                  onSubmit={handleEditProject}
                  onCancel={() => setEditingProject(null)}
                  isLoading={isSubmitting}
                />
              ) : isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-2 border-purple-500 border-t-transparent" />
                </div>
              ) : (
                <>
                  {/* 新建项目按钮 */}
                  <button
                    onClick={() => setShowForm(true)}
                    className="w-full p-4 mb-4 rounded-xl border-2 border-dashed border-white/20 hover:border-purple-400 text-white/60 hover:text-purple-400 transition-colors flex items-center justify-center gap-2"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    新建项目
                  </button>

                  {/* 项目列表 */}
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {projects.map(project => (
                      <div key={project.id} className="group">
                        <ProjectCard
                          project={project}
                          isActive={project.id === currentProject?.id}
                          onSelect={() => handleSelectProject(project)}
                          onEdit={() => setEditingProject(project)}
                          onDelete={() => handleDeleteProject(project)}
                        />
                      </div>
                    ))}
                  </div>

                  {projects.length === 0 && (
                    <div className="text-center py-8 text-white/40">
                      暂无项目，点击上方按钮创建第一个项目
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ProjectSwitcher;

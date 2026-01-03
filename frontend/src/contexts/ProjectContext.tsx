/**
 * 项目上下文
 * 管理当前项目状态，提供项目切换和创建方法
 * 
 * 需求: 1.1, 1.2, 2.4
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Project, CreateProjectRequest, ApiResponse } from '@shared/types';
import { getAuthHeaders, useAuth } from './AuthContext';

// 项目上下文类型
interface ProjectContextType {
  currentProject: Project | null;           // 当前项目
  projects: Project[];                       // 所有项目列表
  isLoading: boolean;                        // 加载状态
  error: string | null;                      // 错误信息
  switchProject: (projectId: string) => Promise<void>;  // 切换项目
  createProject: (request: CreateProjectRequest) => Promise<Project>;  // 创建项目
  updateProject: (projectId: string, request: Partial<CreateProjectRequest>) => Promise<Project>;  // 更新项目
  deleteProject: (projectId: string) => Promise<void>;  // 删除项目（软删除）
  refreshProjects: () => Promise<void>;      // 刷新项目列表
  clearError: () => void;                    // 清除错误
}

// 本地存储键名
const CURRENT_PROJECT_KEY = 'current_project_id';

// 创建上下文
const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

// API 基础地址
const API_BASE_URL = '/api';

/**
 * 项目提供者组件
 */
export const ProjectProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // 获取认证状态
  const { isAuthenticated, isLoading: authLoading } = useAuth();

  /**
   * 获取项目列表
   */
  const fetchProjects = useCallback(async (): Promise<Project[]> => {
    const response = await fetch(`${API_BASE_URL}/projects`, {
      headers: {
        ...getAuthHeaders(),
        'Content-Type': 'application/json'
      }
    });

    const data: ApiResponse<Project[]> = await response.json();
    
    if (!response.ok || !data.success) {
      throw new Error(data.error || '获取项目列表失败');
    }

    return data.data || [];
  }, []);

  /**
   * 获取当前项目（如果没有则自动创建默认项目）
   * 需求 1.1: 用户首次登录且没有任何项目时自动创建默认项目
   */
  const fetchCurrentProject = useCallback(async (): Promise<Project> => {
    const response = await fetch(`${API_BASE_URL}/projects/current`, {
      headers: {
        ...getAuthHeaders(),
        'Content-Type': 'application/json'
      }
    });

    const data: ApiResponse<Project> = await response.json();
    
    if (!response.ok || !data.success) {
      throw new Error(data.error || '获取当前项目失败');
    }

    return data.data!;
  }, []);


  /**
   * 初始化项目状态
   * 需求 1.2: 用户登录且已有项目时自动进入最近使用的项目
   * 
   * 只有在用户已认证且认证加载完成后才初始化项目
   */
  useEffect(() => {
    // 等待认证状态确定
    if (authLoading) {
      return;
    }
    
    // 未认证时不初始化项目
    if (!isAuthenticated) {
      setIsLoading(false);
      setCurrentProject(null);
      setProjects([]);
      return;
    }

    const initProjects = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // 获取项目列表
        const projectList = await fetchProjects();
        setProjects(projectList);

        // 获取当前项目（后端会自动处理默认项目创建）
        const current = await fetchCurrentProject();
        setCurrentProject(current);

        // 保存当前项目 ID 到本地存储
        localStorage.setItem(CURRENT_PROJECT_KEY, current.id);
      } catch (err: any) {
        console.error('初始化项目失败:', err);
        setError(err.message || '初始化项目失败');
      } finally {
        setIsLoading(false);
      }
    };

    initProjects();
  }, [fetchProjects, fetchCurrentProject, isAuthenticated, authLoading]);

  /**
   * 切换项目
   * 需求 2.4: 用户点击某个项目卡片时切换到该项目
   */
  const switchProject = useCallback(async (projectId: string) => {
    try {
      setError(null);

      const response = await fetch(`${API_BASE_URL}/projects/${projectId}/switch`, {
        method: 'PUT',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json'
        }
      });

      const data: ApiResponse<Project> = await response.json();
      
      if (!response.ok || !data.success) {
        throw new Error(data.error || '切换项目失败');
      }

      setCurrentProject(data.data!);
      localStorage.setItem(CURRENT_PROJECT_KEY, projectId);
    } catch (err: any) {
      console.error('切换项目失败:', err);
      setError(err.message || '切换项目失败');
      throw err;
    }
  }, []);

  /**
   * 创建项目
   * 需求 3.1, 3.3: 创建新项目并自动切换到新项目
   */
  const createProject = useCallback(async (request: CreateProjectRequest): Promise<Project> => {
    try {
      setError(null);

      const response = await fetch(`${API_BASE_URL}/projects`, {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(request)
      });

      const data: ApiResponse<Project> = await response.json();
      
      if (!response.ok || !data.success) {
        throw new Error(data.error || '创建项目失败');
      }

      const newProject = data.data!;
      
      // 更新项目列表
      setProjects(prev => [...prev, newProject]);
      
      // 自动切换到新项目
      setCurrentProject(newProject);
      localStorage.setItem(CURRENT_PROJECT_KEY, newProject.id);

      return newProject;
    } catch (err: any) {
      console.error('创建项目失败:', err);
      setError(err.message || '创建项目失败');
      throw err;
    }
  }, []);

  /**
   * 更新项目
   * 需求 6.2, 6.3: 更新项目信息
   */
  const updateProject = useCallback(async (
    projectId: string, 
    request: Partial<CreateProjectRequest>
  ): Promise<Project> => {
    try {
      setError(null);

      const response = await fetch(`${API_BASE_URL}/projects/${projectId}`, {
        method: 'PUT',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(request)
      });

      const data: ApiResponse<Project> = await response.json();
      
      if (!response.ok || !data.success) {
        throw new Error(data.error || '更新项目失败');
      }

      const updatedProject = data.data!;
      
      // 更新项目列表
      setProjects(prev => prev.map(p => p.id === projectId ? updatedProject : p));
      
      // 如果是当前项目，更新当前项目状态
      if (currentProject?.id === projectId) {
        setCurrentProject(updatedProject);
      }

      return updatedProject;
    } catch (err: any) {
      console.error('更新项目失败:', err);
      setError(err.message || '更新项目失败');
      throw err;
    }
  }, [currentProject]);

  /**
   * 删除项目（软删除）
   * 需求 7.1: 删除项目时移入回收站
   */
  const deleteProject = useCallback(async (projectId: string) => {
    try {
      setError(null);

      const response = await fetch(`${API_BASE_URL}/projects/${projectId}`, {
        method: 'DELETE',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json'
        }
      });

      const data: ApiResponse = await response.json();
      
      if (!response.ok || !data.success) {
        throw new Error(data.error || '删除项目失败');
      }

      // 从项目列表中移除
      setProjects(prev => prev.filter(p => p.id !== projectId));
      
      // 如果删除的是当前项目，重新获取当前项目
      if (currentProject?.id === projectId) {
        const newCurrent = await fetchCurrentProject();
        setCurrentProject(newCurrent);
        localStorage.setItem(CURRENT_PROJECT_KEY, newCurrent.id);
      }
    } catch (err: any) {
      console.error('删除项目失败:', err);
      setError(err.message || '删除项目失败');
      throw err;
    }
  }, [currentProject, fetchCurrentProject]);

  /**
   * 刷新项目列表
   */
  const refreshProjects = useCallback(async () => {
    try {
      setError(null);
      const projectList = await fetchProjects();
      setProjects(projectList);
    } catch (err: any) {
      console.error('刷新项目列表失败:', err);
      setError(err.message || '刷新项目列表失败');
      throw err;
    }
  }, [fetchProjects]);

  /**
   * 清除错误
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const value: ProjectContextType = {
    currentProject,
    projects,
    isLoading,
    error,
    switchProject,
    createProject,
    updateProject,
    deleteProject,
    refreshProjects,
    clearError
  };

  return (
    <ProjectContext.Provider value={value}>
      {children}
    </ProjectContext.Provider>
  );
};

/**
 * 使用项目上下文的 Hook
 */
export const useProject = (): ProjectContextType => {
  const context = useContext(ProjectContext);
  if (context === undefined) {
    throw new Error('useProject must be used within a ProjectProvider');
  }
  return context;
};

/**
 * 获取当前项目 ID
 */
export const getCurrentProjectId = (): string | null => {
  return localStorage.getItem(CURRENT_PROJECT_KEY);
};

export default ProjectContext;

/**
 * 数据冲突解决服务
 * 实现基于时间戳的冲突检测和解决机制
 */

import { SavedImage, ApiConfig, OSSConfig, OperationLog } from '../types';

/**
 * 冲突类型枚举
 */
export enum ConflictType {
  IMAGE_UPDATE = 'IMAGE_UPDATE',
  CONFIG_UPDATE = 'CONFIG_UPDATE',
  CONCURRENT_OPERATION = 'CONCURRENT_OPERATION'
}

/**
 * 冲突信息接口
 */
export interface ConflictInfo {
  type: ConflictType;
  recordId: string;
  tableName: string;
  localData: any;
  remoteData: any;
  localTimestamp: Date;
  remoteTimestamp: Date;
  conflictFields: string[];
  detectedAt: Date;
}

/**
 * 冲突解决结果接口
 */
export interface ConflictResolution {
  resolved: boolean;
  finalData: any;
  strategy: ConflictResolutionStrategy;
  conflictInfo: ConflictInfo;
  resolvedAt: Date;
  message: string;
}

/**
 * 冲突解决策略枚举
 */
export enum ConflictResolutionStrategy {
  LATEST_WINS = 'LATEST_WINS',           // 最新时间戳优先（默认策略）
  LOCAL_WINS = 'LOCAL_WINS',             // 本地数据优先
  REMOTE_WINS = 'REMOTE_WINS',           // 远程数据优先
  MERGE_FIELDS = 'MERGE_FIELDS',         // 字段级合并
  USER_CHOICE = 'USER_CHOICE'            // 用户选择
}

/**
 * 冲突解决器类
 */
export class ConflictResolver {
  private conflictLogs: ConflictInfo[] = [];
  private maxLogSize = 100;

  /**
   * 检测数据冲突
   * @param localData 本地数据
   * @param remoteData 远程数据
   * @param recordId 记录ID
   * @param tableName 表名
   * @returns 冲突信息，如果没有冲突返回null
   */
  detectConflict(
    localData: any,
    remoteData: any,
    recordId: string,
    tableName: string
  ): ConflictInfo | null {
    // 如果任一数据为空，不存在冲突
    if (!localData || !remoteData) {
      return null;
    }

    // 获取时间戳字段
    const localTimestamp = this.extractTimestamp(localData);
    const remoteTimestamp = this.extractTimestamp(remoteData);

    // 如果时间戳相同，不存在冲突
    if (localTimestamp.getTime() === remoteTimestamp.getTime()) {
      return null;
    }

    // 检测字段级冲突
    const conflictFields = this.findConflictingFields(localData, remoteData);
    
    // 如果没有字段冲突，不存在冲突
    if (conflictFields.length === 0) {
      return null;
    }

    // 确定冲突类型
    const conflictType = this.determineConflictType(tableName);

    const conflictInfo: ConflictInfo = {
      type: conflictType,
      recordId,
      tableName,
      localData: { ...localData },
      remoteData: { ...remoteData },
      localTimestamp,
      remoteTimestamp,
      conflictFields,
      detectedAt: new Date()
    };

    // 记录冲突日志
    this.logConflict(conflictInfo);

    console.warn(`检测到数据冲突:`, {
      recordId,
      tableName,
      conflictFields,
      localTimestamp: localTimestamp.toISOString(),
      remoteTimestamp: remoteTimestamp.toISOString()
    });

    return conflictInfo;
  }

  /**
   * 解决数据冲突
   * @param conflictInfo 冲突信息
   * @param strategy 解决策略（可选，默认使用最新时间戳优先）
   * @returns 冲突解决结果
   */
  resolveConflict(
    conflictInfo: ConflictInfo,
    strategy: ConflictResolutionStrategy = ConflictResolutionStrategy.LATEST_WINS
  ): ConflictResolution {
    const startTime = Date.now();
    
    try {
      let finalData: any;
      let message: string;

      switch (strategy) {
        case ConflictResolutionStrategy.LATEST_WINS:
          finalData = this.resolveByLatestTimestamp(conflictInfo);
          message = `使用最新时间戳的数据 (${this.getWinnerTimestamp(conflictInfo).toISOString()})`;
          break;

        case ConflictResolutionStrategy.LOCAL_WINS:
          finalData = conflictInfo.localData;
          message = `使用本地数据 (${conflictInfo.localTimestamp.toISOString()})`;
          break;

        case ConflictResolutionStrategy.REMOTE_WINS:
          finalData = conflictInfo.remoteData;
          message = `使用远程数据 (${conflictInfo.remoteTimestamp.toISOString()})`;
          break;

        case ConflictResolutionStrategy.MERGE_FIELDS:
          finalData = this.mergeConflictingFields(conflictInfo);
          message = `合并冲突字段，优先使用最新时间戳的字段值`;
          break;

        default:
          throw new Error(`不支持的冲突解决策略: ${strategy}`);
      }

      const resolution: ConflictResolution = {
        resolved: true,
        finalData,
        strategy,
        conflictInfo,
        resolvedAt: new Date(),
        message
      };

      console.log(`冲突解决成功:`, {
        recordId: conflictInfo.recordId,
        strategy,
        message,
        duration: Date.now() - startTime
      });

      return resolution;

    } catch (error: any) {
      console.error(`冲突解决失败:`, error);
      
      return {
        resolved: false,
        finalData: conflictInfo.remoteData, // 默认使用远程数据
        strategy,
        conflictInfo,
        resolvedAt: new Date(),
        message: `冲突解决失败: ${error.message}，使用远程数据`
      };
    }
  }

  /**
   * 批量解决冲突
   * @param conflicts 冲突列表
   * @param strategy 解决策略
   * @returns 解决结果列表
   */
  resolveConflicts(
    conflicts: ConflictInfo[],
    strategy: ConflictResolutionStrategy = ConflictResolutionStrategy.LATEST_WINS
  ): ConflictResolution[] {
    console.log(`开始批量解决 ${conflicts.length} 个冲突...`);
    
    const resolutions: ConflictResolution[] = [];
    
    for (const conflict of conflicts) {
      try {
        const resolution = this.resolveConflict(conflict, strategy);
        resolutions.push(resolution);
      } catch (error: any) {
        console.error(`解决冲突失败 (${conflict.recordId}):`, error);
        
        // 创建失败的解决结果
        resolutions.push({
          resolved: false,
          finalData: conflict.remoteData,
          strategy,
          conflictInfo: conflict,
          resolvedAt: new Date(),
          message: `批量解决失败: ${error.message}`
        });
      }
    }
    
    const successCount = resolutions.filter(r => r.resolved).length;
    console.log(`批量冲突解决完成: 成功 ${successCount}/${conflicts.length}`);
    
    return resolutions;
  }

  /**
   * 获取冲突日志
   * @param limit 限制数量
   * @returns 冲突日志列表
   */
  getConflictLogs(limit?: number): ConflictInfo[] {
    const logs = [...this.conflictLogs].reverse(); // 最新的在前
    return limit ? logs.slice(0, limit) : logs;
  }

  /**
   * 清除冲突日志
   */
  clearConflictLogs(): void {
    this.conflictLogs = [];
    console.log('冲突日志已清除');
  }

  /**
   * 获取冲突统计信息
   */
  getConflictStats(): {
    total: number;
    byType: Record<ConflictType, number>;
    byTable: Record<string, number>;
    recent: number; // 最近1小时的冲突数
  } {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    
    const stats = {
      total: this.conflictLogs.length,
      byType: {} as Record<ConflictType, number>,
      byTable: {} as Record<string, number>,
      recent: 0
    };

    // 初始化计数器
    Object.values(ConflictType).forEach(type => {
      stats.byType[type] = 0;
    });

    // 统计冲突
    for (const conflict of this.conflictLogs) {
      // 按类型统计
      stats.byType[conflict.type]++;
      
      // 按表统计
      stats.byTable[conflict.tableName] = (stats.byTable[conflict.tableName] || 0) + 1;
      
      // 最近冲突统计
      if (conflict.detectedAt > oneHourAgo) {
        stats.recent++;
      }
    }

    return stats;
  }

  /**
   * 提取时间戳
   * @param data 数据对象
   * @returns 时间戳
   */
  private extractTimestamp(data: any): Date {
    // 优先使用 updated_at，其次 updatedAt，最后 created_at 或 createdAt
    const timestamp = data.updated_at || data.updatedAt || 
                     data.created_at || data.createdAt ||
                     new Date(0); // 如果都没有，使用最早时间
    
    return timestamp instanceof Date ? timestamp : new Date(timestamp);
  }

  /**
   * 查找冲突字段
   * @param localData 本地数据
   * @param remoteData 远程数据
   * @returns 冲突字段列表
   */
  private findConflictingFields(localData: any, remoteData: any): string[] {
    const conflictFields: string[] = [];
    const excludeFields = ['id', 'created_at', 'createdAt', 'updated_at', 'updatedAt'];
    
    // 获取所有字段
    const allFields = new Set([
      ...Object.keys(localData),
      ...Object.keys(remoteData)
    ]);

    for (const field of allFields) {
      // 跳过排除字段
      if (excludeFields.includes(field)) {
        continue;
      }

      const localValue = localData[field];
      const remoteValue = remoteData[field];

      // 比较字段值
      if (!this.isEqual(localValue, remoteValue)) {
        conflictFields.push(field);
      }
    }

    return conflictFields;
  }

  /**
   * 深度比较两个值是否相等
   * @param a 值A
   * @param b 值B
   * @returns 是否相等
   */
  private isEqual(a: any, b: any): boolean {
    if (a === b) return true;
    if (a == null || b == null) return a === b;
    if (typeof a !== typeof b) return false;
    
    if (typeof a === 'object') {
      if (Array.isArray(a) !== Array.isArray(b)) return false;
      
      if (Array.isArray(a)) {
        if (a.length !== b.length) return false;
        return a.every((item, index) => this.isEqual(item, b[index]));
      }
      
      const keysA = Object.keys(a);
      const keysB = Object.keys(b);
      if (keysA.length !== keysB.length) return false;
      
      return keysA.every(key => this.isEqual(a[key], b[key]));
    }
    
    return false;
  }

  /**
   * 确定冲突类型
   * @param tableName 表名
   * @returns 冲突类型
   */
  private determineConflictType(tableName: string): ConflictType {
    switch (tableName) {
      case 'images':
        return ConflictType.IMAGE_UPDATE;
      case 'user_configs':
        return ConflictType.CONFIG_UPDATE;
      default:
        return ConflictType.CONCURRENT_OPERATION;
    }
  }

  /**
   * 使用最新时间戳解决冲突
   * @param conflictInfo 冲突信息
   * @returns 解决后的数据
   */
  private resolveByLatestTimestamp(conflictInfo: ConflictInfo): any {
    const { localData, remoteData, localTimestamp, remoteTimestamp } = conflictInfo;
    
    // 比较时间戳，返回最新的数据
    if (localTimestamp > remoteTimestamp) {
      return { ...localData };
    } else {
      return { ...remoteData };
    }
  }

  /**
   * 获取获胜者的时间戳
   * @param conflictInfo 冲突信息
   * @returns 获胜者时间戳
   */
  private getWinnerTimestamp(conflictInfo: ConflictInfo): Date {
    const { localTimestamp, remoteTimestamp } = conflictInfo;
    return localTimestamp > remoteTimestamp ? localTimestamp : remoteTimestamp;
  }

  /**
   * 合并冲突字段
   * @param conflictInfo 冲突信息
   * @returns 合并后的数据
   */
  private mergeConflictingFields(conflictInfo: ConflictInfo): any {
    const { localData, remoteData, localTimestamp, remoteTimestamp, conflictFields } = conflictInfo;
    
    // 从较新的数据开始
    const baseData = localTimestamp > remoteTimestamp ? { ...localData } : { ...remoteData };
    const otherData = localTimestamp > remoteTimestamp ? remoteData : localData;
    
    // 对于冲突字段，使用最新时间戳的数据
    // 这里的逻辑与 LATEST_WINS 相同，但为字段级合并预留了扩展空间
    for (const field of conflictFields) {
      // 可以在这里实现更复杂的字段级合并逻辑
      // 例如：数组字段合并、数值字段取最大值等
      
      // 当前实现：保持基础数据的字段值（已经是最新的）
      // baseData[field] = baseData[field];
    }
    
    return baseData;
  }

  /**
   * 记录冲突日志
   * @param conflictInfo 冲突信息
   */
  private logConflict(conflictInfo: ConflictInfo): void {
    this.conflictLogs.push(conflictInfo);
    
    // 限制日志大小
    if (this.conflictLogs.length > this.maxLogSize) {
      this.conflictLogs = this.conflictLogs.slice(-this.maxLogSize);
    }
  }
}

// 创建单例实例
export const conflictResolver = new ConflictResolver();
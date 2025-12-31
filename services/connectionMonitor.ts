/**
 * 数据库连接状态监控服务
 * 提供实时连接状态更新、状态变化通知和连接质量监控功能
 */

import { ConnectionStatus, DatabaseService } from '../types';

// 连接质量等级
export enum ConnectionQuality {
  EXCELLENT = 'EXCELLENT',  // 延迟 < 50ms
  GOOD = 'GOOD',           // 延迟 50-200ms
  FAIR = 'FAIR',           // 延迟 200-500ms
  POOR = 'POOR',           // 延迟 500-1000ms
  VERY_POOR = 'VERY_POOR'  // 延迟 > 1000ms
}

// 连接状态变化事件
export interface ConnectionStatusChangeEvent {
  previousStatus: ConnectionStatus;
  currentStatus: ConnectionStatus;
  timestamp: Date;
  quality: ConnectionQuality;
  changeType: 'CONNECTED' | 'DISCONNECTED' | 'QUALITY_CHANGED' | 'ERROR_OCCURRED' | 'ERROR_CLEARED';
}

// 连接质量统计
export interface ConnectionQualityStats {
  averageLatency: number;
  minLatency: number;
  maxLatency: number;
  successRate: number;
  totalTests: number;
  failedTests: number;
  lastTestTime: Date | null;
  qualityTrend: ConnectionQuality[];
}

// 状态变化监听器类型
export type ConnectionStatusListener = (event: ConnectionStatusChangeEvent) => void;

/**
 * 连接状态监控器类
 */
export class ConnectionMonitor {
  private databaseService: DatabaseService;
  private listeners: Set<ConnectionStatusListener> = new Set();
  private monitoringInterval: NodeJS.Timeout | null = null;
  private isMonitoring = false;
  private monitoringIntervalMs = 30000; // 30秒检查一次
  private qualityTestIntervalMs = 60000; // 1分钟测试一次连接质量
  
  // 状态历史
  private statusHistory: ConnectionStatusChangeEvent[] = [];
  private maxHistorySize = 100;
  
  // 质量统计
  private qualityStats: ConnectionQualityStats = {
    averageLatency: 0,
    minLatency: Infinity,
    maxLatency: 0,
    successRate: 100,
    totalTests: 0,
    failedTests: 0,
    lastTestTime: null,
    qualityTrend: []
  };
  
  // 上一次的连接状态
  private lastStatus: ConnectionStatus | null = null;
  
  constructor(databaseService: DatabaseService) {
    this.databaseService = databaseService;
  }

  /**
   * 开始监控连接状态
   */
  startMonitoring(): void {
    if (this.isMonitoring) {
      console.log('连接状态监控已在运行中');
      return;
    }

    console.log('开始连接状态监控...');
    this.isMonitoring = true;
    
    // 立即检查一次状态
    this.checkConnectionStatus();
    
    // 设置定期检查
    this.monitoringInterval = setInterval(() => {
      this.checkConnectionStatus();
    }, this.monitoringIntervalMs);
    
    console.log(`连接状态监控已启动，检查间隔: ${this.monitoringIntervalMs}ms`);
  }

  /**
   * 停止监控连接状态
   */
  stopMonitoring(): void {
    if (!this.isMonitoring) {
      console.log('连接状态监控未在运行');
      return;
    }

    console.log('停止连接状态监控...');
    this.isMonitoring = false;
    
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    
    console.log('连接状态监控已停止');
  }

  /**
   * 检查连接状态
   */
  private async checkConnectionStatus(): Promise<void> {
    try {
      const currentStatus = this.databaseService.getConnectionStatus();
      const quality = this.calculateConnectionQuality(currentStatus);
      
      // 检查状态是否发生变化
      if (this.hasStatusChanged(currentStatus)) {
        const changeEvent: ConnectionStatusChangeEvent = {
          previousStatus: this.lastStatus || {
            isConnected: false,
            lastConnected: null,
            error: null
          },
          currentStatus: { ...currentStatus },
          timestamp: new Date(),
          quality,
          changeType: this.determineChangeType(this.lastStatus, currentStatus)
        };
        
        // 记录状态变化
        this.recordStatusChange(changeEvent);
        
        // 通知所有监听器
        this.notifyListeners(changeEvent);
        
        console.log(`连接状态变化: ${changeEvent.changeType}`, {
          isConnected: currentStatus.isConnected,
          quality,
          latency: currentStatus.latency,
          error: currentStatus.error
        });
      }
      
      // 更新质量统计
      this.updateQualityStats(currentStatus, quality);
      
      // 保存当前状态
      this.lastStatus = { ...currentStatus };
      
    } catch (error) {
      console.error('检查连接状态时出错:', error);
    }
  }

  /**
   * 计算连接质量
   */
  private calculateConnectionQuality(status: ConnectionStatus): ConnectionQuality {
    if (!status.isConnected || status.error) {
      return ConnectionQuality.VERY_POOR;
    }
    
    const latency = status.latency || Infinity;
    
    if (latency < 50) {
      return ConnectionQuality.EXCELLENT;
    } else if (latency < 200) {
      return ConnectionQuality.GOOD;
    } else if (latency < 500) {
      return ConnectionQuality.FAIR;
    } else if (latency < 1000) {
      return ConnectionQuality.POOR;
    } else {
      return ConnectionQuality.VERY_POOR;
    }
  }

  /**
   * 检查状态是否发生变化
   */
  private hasStatusChanged(currentStatus: ConnectionStatus): boolean {
    if (!this.lastStatus) {
      return true; // 第一次检查
    }
    
    return (
      this.lastStatus.isConnected !== currentStatus.isConnected ||
      this.lastStatus.error !== currentStatus.error ||
      Math.abs((this.lastStatus.latency || 0) - (currentStatus.latency || 0)) > 100 // 延迟变化超过100ms
    );
  }

  /**
   * 确定状态变化类型
   */
  private determineChangeType(
    previousStatus: ConnectionStatus | null, 
    currentStatus: ConnectionStatus
  ): ConnectionStatusChangeEvent['changeType'] {
    if (!previousStatus) {
      return currentStatus.isConnected ? 'CONNECTED' : 'DISCONNECTED';
    }
    
    // 连接状态变化
    if (previousStatus.isConnected !== currentStatus.isConnected) {
      return currentStatus.isConnected ? 'CONNECTED' : 'DISCONNECTED';
    }
    
    // 错误状态变化
    if (previousStatus.error !== currentStatus.error) {
      return currentStatus.error ? 'ERROR_OCCURRED' : 'ERROR_CLEARED';
    }
    
    // 质量变化
    const previousQuality = this.calculateConnectionQuality(previousStatus);
    const currentQuality = this.calculateConnectionQuality(currentStatus);
    if (previousQuality !== currentQuality) {
      return 'QUALITY_CHANGED';
    }
    
    return 'QUALITY_CHANGED'; // 默认为质量变化
  }

  /**
   * 记录状态变化
   */
  private recordStatusChange(event: ConnectionStatusChangeEvent): void {
    this.statusHistory.push(event);
    
    // 限制历史记录大小
    if (this.statusHistory.length > this.maxHistorySize) {
      this.statusHistory = this.statusHistory.slice(-this.maxHistorySize);
    }
  }

  /**
   * 通知所有监听器
   */
  private notifyListeners(event: ConnectionStatusChangeEvent): void {
    this.listeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        console.error('连接状态监听器执行出错:', error);
      }
    });
  }

  /**
   * 更新质量统计
   */
  private updateQualityStats(status: ConnectionStatus, quality: ConnectionQuality): void {
    this.qualityStats.totalTests++;
    this.qualityStats.lastTestTime = new Date();
    
    if (status.isConnected && status.latency !== undefined) {
      // 更新延迟统计
      this.qualityStats.minLatency = Math.min(this.qualityStats.minLatency, status.latency);
      this.qualityStats.maxLatency = Math.max(this.qualityStats.maxLatency, status.latency);
      
      // 计算平均延迟（简单移动平均）
      const alpha = 0.1; // 平滑因子
      if (this.qualityStats.averageLatency === 0) {
        this.qualityStats.averageLatency = status.latency;
      } else {
        this.qualityStats.averageLatency = 
          alpha * status.latency + (1 - alpha) * this.qualityStats.averageLatency;
      }
    } else {
      this.qualityStats.failedTests++;
    }
    
    // 更新成功率
    this.qualityStats.successRate = 
      ((this.qualityStats.totalTests - this.qualityStats.failedTests) / this.qualityStats.totalTests) * 100;
    
    // 更新质量趋势（保留最近20个记录）
    this.qualityStats.qualityTrend.push(quality);
    if (this.qualityStats.qualityTrend.length > 20) {
      this.qualityStats.qualityTrend = this.qualityStats.qualityTrend.slice(-20);
    }
  }

  /**
   * 添加状态变化监听器
   */
  addStatusListener(listener: ConnectionStatusListener): void {
    this.listeners.add(listener);
    console.log(`已添加连接状态监听器，当前监听器数量: ${this.listeners.size}`);
  }

  /**
   * 移除状态变化监听器
   */
  removeStatusListener(listener: ConnectionStatusListener): void {
    const removed = this.listeners.delete(listener);
    if (removed) {
      console.log(`已移除连接状态监听器，当前监听器数量: ${this.listeners.size}`);
    }
  }

  /**
   * 清除所有监听器
   */
  clearAllListeners(): void {
    const count = this.listeners.size;
    this.listeners.clear();
    console.log(`已清除所有连接状态监听器，共移除 ${count} 个监听器`);
  }

  /**
   * 获取连接质量统计
   */
  getQualityStats(): ConnectionQualityStats {
    return { ...this.qualityStats };
  }

  /**
   * 获取状态变化历史
   */
  getStatusHistory(limit?: number): ConnectionStatusChangeEvent[] {
    const history = [...this.statusHistory];
    return limit ? history.slice(-limit) : history;
  }

  /**
   * 清除状态历史
   */
  clearStatusHistory(): void {
    this.statusHistory = [];
    console.log('已清除连接状态历史记录');
  }

  /**
   * 获取当前连接质量
   */
  getCurrentQuality(): ConnectionQuality {
    const currentStatus = this.databaseService.getConnectionStatus();
    return this.calculateConnectionQuality(currentStatus);
  }

  /**
   * 手动触发连接测试
   */
  async triggerConnectionTest(): Promise<{
    success: boolean;
    latency?: number;
    quality: ConnectionQuality;
    error?: string;
  }> {
    try {
      const startTime = Date.now();
      const success = await this.databaseService.testConnection();
      const latency = Date.now() - startTime;
      
      const mockStatus: ConnectionStatus = {
        isConnected: success,
        lastConnected: success ? new Date() : null,
        error: success ? null : '连接测试失败',
        latency: success ? latency : undefined
      };
      
      const quality = this.calculateConnectionQuality(mockStatus);
      
      return {
        success,
        latency: success ? latency : undefined,
        quality,
        error: success ? undefined : '连接测试失败'
      };
      
    } catch (error: any) {
      return {
        success: false,
        quality: ConnectionQuality.VERY_POOR,
        error: error.message
      };
    }
  }

  /**
   * 设置监控间隔
   */
  setMonitoringInterval(intervalMs: number): void {
    if (intervalMs < 5000) {
      throw new Error('监控间隔不能小于5秒');
    }
    
    this.monitoringIntervalMs = intervalMs;
    
    // 如果正在监控，重新启动以应用新间隔
    if (this.isMonitoring) {
      this.stopMonitoring();
      this.startMonitoring();
    }
    
    console.log(`监控间隔已设置为: ${intervalMs}ms`);
  }

  /**
   * 获取监控状态
   */
  getMonitoringStatus(): {
    isMonitoring: boolean;
    intervalMs: number;
    listenersCount: number;
    historySize: number;
    uptime: number;
  } {
    return {
      isMonitoring: this.isMonitoring,
      intervalMs: this.monitoringIntervalMs,
      listenersCount: this.listeners.size,
      historySize: this.statusHistory.length,
      uptime: this.qualityStats.totalTests * this.monitoringIntervalMs
    };
  }

  /**
   * 重置质量统计
   */
  resetQualityStats(): void {
    this.qualityStats = {
      averageLatency: 0,
      minLatency: Infinity,
      maxLatency: 0,
      successRate: 100,
      totalTests: 0,
      failedTests: 0,
      lastTestTime: null,
      qualityTrend: []
    };
    console.log('连接质量统计已重置');
  }

  /**
   * 获取连接质量描述
   */
  getQualityDescription(quality: ConnectionQuality): string {
    switch (quality) {
      case ConnectionQuality.EXCELLENT:
        return '优秀 - 连接延迟极低，响应迅速';
      case ConnectionQuality.GOOD:
        return '良好 - 连接稳定，响应正常';
      case ConnectionQuality.FAIR:
        return '一般 - 连接可用，但可能有轻微延迟';
      case ConnectionQuality.POOR:
        return '较差 - 连接延迟较高，可能影响使用体验';
      case ConnectionQuality.VERY_POOR:
        return '很差 - 连接不稳定或已断开';
      default:
        return '未知';
    }
  }
}

/**
 * 创建连接监控器实例
 */
export function createConnectionMonitor(databaseService: DatabaseService): ConnectionMonitor {
  return new ConnectionMonitor(databaseService);
}
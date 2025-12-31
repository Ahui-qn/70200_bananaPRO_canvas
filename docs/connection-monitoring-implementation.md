# 连接状态监控实现文档

## 概述

连接状态监控功能为阿里云数据库集成提供了实时的连接状态跟踪、质量监控和状态变化通知能力。该功能确保应用能够及时发现连接问题，提供更好的用户体验。

## 核心功能

### 1. 实时连接状态监控

- **自动检测**: 定期检查数据库连接状态
- **状态跟踪**: 记录连接状态变化历史
- **质量评估**: 基于延迟计算连接质量等级

### 2. 连接质量分级

| 质量等级 | 延迟范围 | 描述 | 用户体验 |
|---------|---------|------|---------|
| EXCELLENT | < 50ms | 优秀 | 响应迅速，用户体验极佳 |
| GOOD | 50-200ms | 良好 | 响应正常，用户体验良好 |
| FAIR | 200-500ms | 一般 | 轻微延迟，基本可用 |
| POOR | 500-1000ms | 较差 | 明显延迟，影响体验 |
| VERY_POOR | > 1000ms | 很差 | 严重延迟或连接断开 |

### 3. 状态变化通知

支持以下类型的状态变化事件：

- `CONNECTED`: 数据库连接建立
- `DISCONNECTED`: 数据库连接断开
- `QUALITY_CHANGED`: 连接质量发生变化
- `ERROR_OCCURRED`: 发生连接错误
- `ERROR_CLEARED`: 连接错误已清除

## 架构设计

### 核心组件

```typescript
// 连接监控器
class ConnectionMonitor {
  // 监控控制
  startMonitoring(): void
  stopMonitoring(): void
  
  // 状态监听
  addStatusListener(listener: ConnectionStatusListener): void
  removeStatusListener(listener: ConnectionStatusListener): void
  
  // 质量统计
  getQualityStats(): ConnectionQualityStats
  getCurrentQuality(): ConnectionQuality
  
  // 手动测试
  triggerConnectionTest(): Promise<TestResult>
}
```

### 数据结构

```typescript
// 连接状态变化事件
interface ConnectionStatusChangeEvent {
  previousStatus: ConnectionStatus;
  currentStatus: ConnectionStatus;
  timestamp: Date;
  quality: ConnectionQuality;
  changeType: 'CONNECTED' | 'DISCONNECTED' | 'QUALITY_CHANGED' | 'ERROR_OCCURRED' | 'ERROR_CLEARED';
}

// 连接质量统计
interface ConnectionQualityStats {
  averageLatency: number;      // 平均延迟
  minLatency: number;          // 最小延迟
  maxLatency: number;          // 最大延迟
  successRate: number;         // 成功率
  totalTests: number;          // 总测试次数
  failedTests: number;         // 失败次数
  lastTestTime: Date | null;   // 最后测试时间
  qualityTrend: ConnectionQuality[]; // 质量趋势
}
```

## 使用方法

### 1. 基础使用

```typescript
import { databaseService } from '../services/databaseService';

// 启动监控
databaseService.startConnectionMonitoring();

// 添加状态监听器
const listener = (event) => {
  console.log('连接状态变化:', event.changeType);
};
databaseService.addConnectionStatusListener(listener);

// 获取当前质量
const quality = databaseService.getCurrentConnectionQuality();
console.log('当前连接质量:', quality);
```

### 2. 高级配置

```typescript
// 设置监控间隔（建议30-60秒）
databaseService.setConnectionMonitoringInterval(30000);

// 获取质量统计
const stats = databaseService.getConnectionQualityStats();
console.log('平均延迟:', stats.averageLatency);
console.log('成功率:', stats.successRate);

// 查看状态历史
const history = databaseService.getConnectionStatusHistory(10);
history.forEach(event => {
  console.log(`${event.timestamp}: ${event.changeType}`);
});
```

### 3. UI 集成

在 `DatabaseConfig` 组件中已集成了监控功能：

- **实时状态显示**: 显示当前连接状态和质量
- **监控开关**: 用户可以手动开启/关闭监控
- **质量指示器**: 图标和颜色表示连接质量
- **统计信息**: 显示延迟、成功率等统计数据

## 实现细节

### 1. 监控机制

```typescript
// 定期检查连接状态
private async checkConnectionStatus(): Promise<void> {
  const currentStatus = this.databaseService.getConnectionStatus();
  const quality = this.calculateConnectionQuality(currentStatus);
  
  // 检查状态变化
  if (this.hasStatusChanged(currentStatus)) {
    const changeEvent = {
      previousStatus: this.lastStatus,
      currentStatus,
      timestamp: new Date(),
      quality,
      changeType: this.determineChangeType(this.lastStatus, currentStatus)
    };
    
    // 记录并通知
    this.recordStatusChange(changeEvent);
    this.notifyListeners(changeEvent);
  }
  
  // 更新统计
  this.updateQualityStats(currentStatus, quality);
}
```

### 2. 质量计算

```typescript
private calculateConnectionQuality(status: ConnectionStatus): ConnectionQuality {
  if (!status.isConnected || status.error) {
    return ConnectionQuality.VERY_POOR;
  }
  
  const latency = status.latency || Infinity;
  
  if (latency < 50) return ConnectionQuality.EXCELLENT;
  if (latency < 200) return ConnectionQuality.GOOD;
  if (latency < 500) return ConnectionQuality.FAIR;
  if (latency < 1000) return ConnectionQuality.POOR;
  return ConnectionQuality.VERY_POOR;
}
```

### 3. 统计更新

使用指数移动平均计算延迟统计：

```typescript
private updateQualityStats(status: ConnectionStatus, quality: ConnectionQuality): void {
  this.qualityStats.totalTests++;
  
  if (status.isConnected && status.latency !== undefined) {
    // 指数移动平均
    const alpha = 0.1;
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
    ((this.qualityStats.totalTests - this.qualityStats.failedTests) / 
     this.qualityStats.totalTests) * 100;
}
```

## 性能考虑

### 1. 监控间隔

- **推荐间隔**: 30-60秒
- **最小间隔**: 5秒（系统限制）
- **考虑因素**: 平衡实时性和资源消耗

### 2. 内存管理

- **历史记录限制**: 最多保留100条状态变化记录
- **质量趋势**: 最多保留20个质量记录
- **自动清理**: 超出限制时自动删除旧记录

### 3. 错误处理

- **监听器异常**: 单个监听器异常不影响其他监听器
- **网络异常**: 自动重试和错误恢复
- **资源清理**: 停止监控时自动清理定时器

## 最佳实践

### 1. 监控配置

```typescript
// 生产环境推荐配置
databaseService.setConnectionMonitoringInterval(60000); // 1分钟

// 开发环境可以更频繁
databaseService.setConnectionMonitoringInterval(10000); // 10秒
```

### 2. 状态监听

```typescript
// 推荐的监听器实现
const connectionListener = (event: ConnectionStatusChangeEvent) => {
  switch (event.changeType) {
    case 'CONNECTED':
      showSuccessNotification('数据库连接已建立');
      break;
    case 'DISCONNECTED':
      showErrorNotification('数据库连接已断开');
      break;
    case 'QUALITY_CHANGED':
      if (event.quality === ConnectionQuality.POOR || 
          event.quality === ConnectionQuality.VERY_POOR) {
        showWarningNotification('连接质量较差，可能影响使用体验');
      }
      break;
  }
};
```

### 3. 资源管理

```typescript
// 组件卸载时清理资源
useEffect(() => {
  return () => {
    databaseService.stopConnectionMonitoring();
    databaseService.removeConnectionStatusListener(listener);
  };
}, []);
```

## 故障排除

### 常见问题

1. **监控不工作**
   - 检查是否调用了 `startConnectionMonitoring()`
   - 确认数据库服务已初始化

2. **状态变化频繁**
   - 检查网络稳定性
   - 适当增加监控间隔

3. **质量统计不准确**
   - 等待足够的采样时间
   - 检查网络延迟是否正常

### 调试方法

```typescript
// 获取监控状态
const status = databaseService.getConnectionMonitoringStatus();
console.log('监控状态:', status);

// 手动触发测试
const testResult = await databaseService.triggerConnectionTest();
console.log('连接测试:', testResult);

// 查看详细统计
const stats = databaseService.getConnectionQualityStats();
console.log('质量统计:', stats);
```

## 总结

连接状态监控功能为数据库集成提供了全面的连接状态管理能力，包括：

- ✅ **实时监控**: 自动检测连接状态变化
- ✅ **质量评估**: 基于延迟的连接质量分级
- ✅ **状态通知**: 灵活的事件监听机制
- ✅ **统计分析**: 详细的连接质量统计
- ✅ **UI 集成**: 用户友好的状态显示界面
- ✅ **性能优化**: 合理的资源使用和内存管理

该功能满足了需求 6.1 中关于连接状态监控的所有要求，为用户提供了透明、可靠的数据库连接体验。
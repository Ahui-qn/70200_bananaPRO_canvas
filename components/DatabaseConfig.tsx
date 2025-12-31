import React, { useState, useEffect } from 'react';
import { DatabaseConfig, ConnectionStatus } from '../types';
import { databaseService } from '../services/databaseService';
import { ConnectionQuality } from '../services/connectionMonitor';
import { 
  X, 
  Save, 
  TestTube, 
  Eye, 
  EyeOff,
  CheckCircle,
  XCircle,
  AlertCircle,
  Database,
  Settings,
  RefreshCw,
  Cloud,
  Activity,
  Wifi,
  WifiOff,
  Signal
} from 'lucide-react';

interface DatabaseConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfigChange?: (config: DatabaseConfig | null) => void;
}

export const DatabaseConfigModal: React.FC<DatabaseConfigModalProps> = ({ 
  isOpen, 
  onClose, 
  onConfigChange 
}) => {
  const [config, setConfig] = useState<DatabaseConfig>({
    host: '',
    port: 3306,
    database: '',
    username: '',
    password: '',
    ssl: true,
    enabled: false
  });
  
  const [showPassword, setShowPassword] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null);
  const [saving, setSaving] = useState(false);
  const [initializing, setInitializing] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>({
    isConnected: false,
    lastConnected: null,
    error: null
  });
  const [connectionQuality, setConnectionQuality] = useState<ConnectionQuality | null>(null);
  const [qualityStats, setQualityStats] = useState<any>(null);
  const [isMonitoring, setIsMonitoring] = useState(false);

  // 加载已保存的配置和状态
  useEffect(() => {
    if (isOpen) {
      loadCurrentConfig();
      updateConnectionInfo();
    }
  }, [isOpen]);

  // 加载当前配置
  const loadCurrentConfig = async () => {
    try {
      // 从数据库服务获取连接状态
      const status = databaseService.getConnectionStatus();
      setConnectionStatus(status);
      
      // 如果有连接，尝试获取配置（这里需要从某个地方获取当前配置）
      // 注意：实际实现中可能需要将配置保存到 localStorage 或其他地方
      const savedConfigStr = localStorage.getItem('database-config');
      if (savedConfigStr) {
        const savedConfig = JSON.parse(savedConfigStr);
        setConfig(savedConfig);
      }
    } catch (error) {
      console.error('加载配置失败:', error);
    }
  };

  // 更新连接信息
  const updateConnectionInfo = () => {
    try {
      const status = databaseService.getConnectionStatus();
      setConnectionStatus(status);
      
      // 获取连接质量信息
      const quality = databaseService.getCurrentConnectionQuality();
      setConnectionQuality(quality);
      
      const stats = databaseService.getConnectionQualityStats();
      setQualityStats(stats);
      
      const monitoringStatus = databaseService.getConnectionMonitoringStatus();
      setIsMonitoring(monitoringStatus.isMonitoring);
    } catch (error) {
      console.error('获取连接信息失败:', error);
    }
  };

  // 处理配置变更
  const handleConfigChange = (field: keyof DatabaseConfig, value: string | number | boolean) => {
    setConfig(prev => ({
      ...prev,
      [field]: value
    }));
    setTestResult(null); // 清除测试结果
  };

  // 测试数据库连接
  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);

    try {
      // 使用新的数据库服务测试连接
      const success = await databaseService.connect(config);
      
      setTestResult(success ? 'success' : 'error');
      
      if (success) {
        updateConnectionInfo();
      }
    } catch (error) {
      console.error('测试连接失败:', error);
      setTestResult('error');
    } finally {
      setTesting(false);
    }
  };

  // 初始化数据库表
  const handleInitializeTables = async () => {
    setInitializing(true);
    
    try {
      await databaseService.initializeTables();
      alert('数据库表初始化成功！');
    } catch (error) {
      console.error('初始化数据库表失败:', error);
      alert(`初始化失败：${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setInitializing(false);
    }
  };

  // 保存配置
  const handleSave = async () => {
    setSaving(true);
    
    try {
      // 保存到 localStorage（临时方案）
      localStorage.setItem('database-config', JSON.stringify(config));
      
      if (onConfigChange) {
        onConfigChange(config);
      }
      
      // 显示成功提示
      setTestResult('success');
      
      // 延迟关闭弹窗
      setTimeout(() => {
        onClose();
      }, 1000);
      
    } catch (error) {
      console.error('保存配置失败:', error);
      setTestResult('error');
    } finally {
      setSaving(false);
    }
  };

  // 清除配置
  const handleClear = async () => {
    if (confirm('确定要清除数据库配置吗？这将禁用云端同步功能。')) {
      try {
        // 断开数据库连接
        await databaseService.disconnect();
        
        // 清除本地配置
        localStorage.removeItem('database-config');
        
        setConfig({
          host: '',
          port: 3306,
          database: '',
          username: '',
          password: '',
          ssl: true,
          enabled: false
        });
        
        if (onConfigChange) {
          onConfigChange(null);
        }
        
        setTestResult(null);
        setConnectionStatus({
          isConnected: false,
          lastConnected: null,
          error: null
        });
        setConnectionQuality(null);
        setQualityStats(null);
        setIsMonitoring(false);
      } catch (error) {
        console.error('清除配置失败:', error);
      }
    }
  };

  // 切换连接监控
  const handleToggleMonitoring = () => {
    try {
      if (isMonitoring) {
        databaseService.stopConnectionMonitoring();
        setIsMonitoring(false);
      } else {
        databaseService.startConnectionMonitoring();
        setIsMonitoring(true);
      }
    } catch (error) {
      console.error('切换连接监控失败:', error);
      alert('切换连接监控失败');
    }
  };

  // 获取连接质量颜色
  const getQualityColor = (quality: ConnectionQuality | null): string => {
    switch (quality) {
      case ConnectionQuality.EXCELLENT:
        return 'text-green-400';
      case ConnectionQuality.GOOD:
        return 'text-green-300';
      case ConnectionQuality.FAIR:
        return 'text-yellow-400';
      case ConnectionQuality.POOR:
        return 'text-orange-400';
      case ConnectionQuality.VERY_POOR:
        return 'text-red-400';
      default:
        return 'text-zinc-500';
    }
  };

  // 获取连接质量图标
  const getQualityIcon = (quality: ConnectionQuality | null) => {
    switch (quality) {
      case ConnectionQuality.EXCELLENT:
      case ConnectionQuality.GOOD:
        return <Wifi className="w-4 h-4" />;
      case ConnectionQuality.FAIR:
      case ConnectionQuality.POOR:
        return <Signal className="w-4 h-4" />;
      case ConnectionQuality.VERY_POOR:
        return <WifiOff className="w-4 h-4" />;
      default:
        return <WifiOff className="w-4 h-4" />;
    }
  };

  // 获取连接质量描述
  const getQualityDescription = (quality: ConnectionQuality | null): string => {
    switch (quality) {
      case ConnectionQuality.EXCELLENT:
        return '优秀';
      case ConnectionQuality.GOOD:
        return '良好';
      case ConnectionQuality.FAIR:
        return '一般';
      case ConnectionQuality.POOR:
        return '较差';
      case ConnectionQuality.VERY_POOR:
        return '很差';
      default:
        return '未知';
    }
  };

  // 检查配置是否完整
  const isConfigComplete = config.host && config.database && config.username && config.password;

  // 检查配置是否有变更
  const hasChanges = () => {
    const savedConfigStr = localStorage.getItem('database-config');
    if (!savedConfigStr) return isConfigComplete;
    
    try {
      const savedConfig = JSON.parse(savedConfigStr);
      return JSON.stringify(config) !== JSON.stringify(savedConfig);
    } catch {
      return isConfigComplete;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* 背景遮罩 */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* 弹窗内容 */}
      <div className="relative w-full max-w-2xl mx-4 bg-zinc-900/95 backdrop-blur-xl border border-zinc-700 rounded-2xl shadow-2xl">
        
        {/* 头部 */}
        <div className="flex items-center justify-between p-6 border-b border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-600/20 rounded-xl flex items-center justify-center">
              <Database className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-zinc-100">数据库配置</h2>
              <p className="text-sm text-zinc-500">配置 MySQL 数据库，实现云端数据同步</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 连接状态和质量显示 */}
        {config.enabled && (
          <div className="p-6 border-b border-zinc-800">
            <div className="space-y-4">
              {/* 基础连接状态 */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${connectionStatus.isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
                    <span className="text-sm text-zinc-300">
                      {connectionStatus.isConnected ? '数据库连接正常' : '数据库连接断开'}
                    </span>
                  </div>
                  
                  {connectionStatus.lastConnected && (
                    <div className="flex items-center gap-2 text-sm text-zinc-500">
                      <RefreshCw className="w-4 h-4" />
                      <span>最后连接: {connectionStatus.lastConnected.toLocaleString()}</span>
                    </div>
                  )}
                </div>

                {/* 监控开关 */}
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-zinc-400" />
                  <span className="text-sm text-zinc-400">实时监控</span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isMonitoring}
                      onChange={handleToggleMonitoring}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-zinc-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>
              </div>

              {/* 连接质量信息 */}
              {connectionQuality && (
                <div className="flex items-center justify-between bg-zinc-800/50 rounded-lg p-3">
                  <div className="flex items-center gap-3">
                    <div className={`${getQualityColor(connectionQuality)}`}>
                      {getQualityIcon(connectionQuality)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-zinc-200">连接质量</span>
                        <span className={`text-sm font-medium ${getQualityColor(connectionQuality)}`}>
                          {getQualityDescription(connectionQuality)}
                        </span>
                      </div>
                      {qualityStats && qualityStats.averageLatency > 0 && (
                        <div className="text-xs text-zinc-500">
                          平均延迟: {Math.round(qualityStats.averageLatency)}ms | 
                          成功率: {Math.round(qualityStats.successRate)}%
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {qualityStats && (
                    <div className="text-right">
                      <div className="text-xs text-zinc-400">
                        测试次数: {qualityStats.totalTests}
                      </div>
                      {qualityStats.lastTestTime && (
                        <div className="text-xs text-zinc-500">
                          {qualityStats.lastTestTime.toLocaleTimeString()}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* 连接错误信息 */}
              {connectionStatus.error && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                  <div className="flex items-start gap-3">
                    <XCircle className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />
                    <div className="text-sm text-red-200">
                      <p className="font-medium mb-1">连接错误</p>
                      <p>{connectionStatus.error}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 配置表单 */}
        <div className="p-6 space-y-6">
          
          {/* 启用开关 */}
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-medium text-zinc-200">启用数据库同步</h3>
              <p className="text-sm text-zinc-500">开启后将自动同步数据到云端数据库</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={config.enabled}
                onChange={(e) => handleConfigChange('enabled', e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-zinc-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
            </label>
          </div>

          {config.enabled && (
            <>
              {/* 基础配置 */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium text-zinc-200 flex items-center gap-2">
                  <Settings className="w-5 h-5" />
                  连接配置
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-zinc-300 mb-2">
                      主机地址 *
                    </label>
                    <input
                      type="text"
                      value={config.host}
                      onChange={(e) => handleConfigChange('host', e.target.value)}
                      placeholder="rm-xxx.mysql.rds.aliyuncs.com"
                      className="w-full bg-zinc-800/50 border border-zinc-700 rounded-lg px-3 py-2 text-zinc-200 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-green-500/50"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-zinc-300 mb-2">
                      端口
                    </label>
                    <input
                      type="number"
                      value={config.port}
                      onChange={(e) => handleConfigChange('port', parseInt(e.target.value) || 3306)}
                      placeholder="3306"
                      className="w-full bg-zinc-800/50 border border-zinc-700 rounded-lg px-3 py-2 text-zinc-200 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-green-500/50"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-zinc-300 mb-2">
                      数据库名称 *
                    </label>
                    <input
                      type="text"
                      value={config.database}
                      onChange={(e) => handleConfigChange('database', e.target.value)}
                      placeholder="your_database_name"
                      className="w-full bg-zinc-800/50 border border-zinc-700 rounded-lg px-3 py-2 text-zinc-200 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-green-500/50"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-zinc-300 mb-2">
                      用户名 *
                    </label>
                    <input
                      type="text"
                      value={config.username}
                      onChange={(e) => handleConfigChange('username', e.target.value)}
                      placeholder="username"
                      className="w-full bg-zinc-800/50 border border-zinc-700 rounded-lg px-3 py-2 text-zinc-200 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-green-500/50"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-2">
                    密码 *
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={config.password}
                      onChange={(e) => handleConfigChange('password', e.target.value)}
                      placeholder="请输入数据库密码"
                      className="w-full bg-zinc-800/50 border border-zinc-700 rounded-lg px-3 py-2 pr-10 text-zinc-200 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-green-500/50"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-200"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="ssl"
                    checked={config.ssl}
                    onChange={(e) => handleConfigChange('ssl', e.target.checked)}
                    className="w-4 h-4 rounded border-zinc-600 bg-zinc-800/80 text-green-600 focus:ring-green-500/50"
                  />
                  <label htmlFor="ssl" className="text-sm text-zinc-300">
                    使用 SSL 连接（推荐）
                  </label>
                </div>
              </div>

              {/* 安全提示 */}
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-amber-400 mt-0.5 flex-shrink-0" />
                  <div className="text-sm text-amber-200">
                    <p className="font-medium mb-1">安全提示</p>
                    <p>数据库凭证将存储在本地浏览器中。建议使用专用的数据库用户，并定期更换密码。</p>
                  </div>
                </div>
              </div>

              {/* 测试结果 */}
              {testResult && (
                <div className={`flex items-center gap-3 p-4 rounded-lg ${
                  testResult === 'success' 
                    ? 'bg-green-500/10 border border-green-500/20 text-green-300' 
                    : 'bg-red-500/10 border border-red-500/20 text-red-300'
                }`}>
                  {testResult === 'success' ? (
                    <CheckCircle className="w-5 h-5" />
                  ) : (
                    <XCircle className="w-5 h-5" />
                  )}
                  <span className="text-sm font-medium">
                    {testResult === 'success' ? '数据库连接测试成功！' : '数据库连接测试失败，请检查配置'}
                  </span>
                </div>
              )}
            </>
          )}
        </div>

        {/* 底部操作 */}
        <div className="flex items-center justify-between p-6 border-t border-zinc-800">
          <button
            onClick={handleClear}
            className="px-4 py-2 text-sm text-zinc-400 hover:text-red-400 transition-colors"
          >
            清除配置
          </button>
          
          <div className="flex items-center gap-3">
            {config.enabled && isConfigComplete && (
              <>
                <button
                  onClick={handleTestConnection}
                  disabled={testing}
                  className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 disabled:bg-zinc-800/50 disabled:text-zinc-500 text-zinc-200 rounded-lg text-sm transition-colors"
                >
                  <TestTube className="w-4 h-4" />
                  {testing ? '测试中...' : '测试连接'}
                </button>
                
                <button
                  onClick={handleInitializeTables}
                  disabled={initializing || testResult !== 'success'}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-600/50 disabled:text-blue-300 text-white rounded-lg text-sm transition-colors"
                >
                  <Database className="w-4 h-4" />
                  {initializing ? '初始化中...' : '初始化表'}
                </button>
              </>
            )}
            
            <button
              onClick={handleSave}
              disabled={(!config.enabled || !isConfigComplete || !hasChanges()) || saving}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-green-600/50 disabled:text-green-300 text-white rounded-lg text-sm transition-colors"
            >
              <Save className="w-4 h-4" />
              {saving ? '保存中...' : '保存配置'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
import React, { useState, useEffect } from 'react';
import { DatabaseConfig } from '../services/databaseStorage';
import { loadDatabaseConfig, saveDatabaseConfig, clearDatabaseConfig, databaseStorage } from '../services/databaseStorage';
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
  Cloud
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
  const [syncStatus, setSyncStatus] = useState(databaseStorage.getSyncStatus());

  // 加载已保存的配置
  useEffect(() => {
    if (isOpen) {
      const savedConfig = loadDatabaseConfig();
      if (savedConfig) {
        setConfig(savedConfig);
      }
      // 更新同步状态
      setSyncStatus(databaseStorage.getSyncStatus());
    }
  }, [isOpen]);

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
      // 临时设置配置进行测试
      databaseStorage.setConfig(config);
      const success = await databaseStorage.testConnection();
      
      setTestResult(success ? 'success' : 'error');
      
      if (success) {
        setSyncStatus(databaseStorage.getSyncStatus());
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
      const result = await databaseStorage.initializeTables();
      
      if (result.success) {
        alert('数据库表初始化成功！');
      } else {
        alert(`初始化失败：${result.error}`);
      }
    } catch (error) {
      console.error('初始化数据库表失败:', error);
      alert('初始化失败，请检查配置');
    } finally {
      setInitializing(false);
    }
  };

  // 保存配置
  const handleSave = async () => {
    setSaving(true);
    
    try {
      saveDatabaseConfig(config);
      
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
  const handleClear = () => {
    if (confirm('确定要清除数据库配置吗？这将禁用云端同步功能。')) {
      clearDatabaseConfig();
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
      setSyncStatus(databaseStorage.getSyncStatus());
    }
  };

  // 检查配置是否完整
  const isConfigComplete = config.host && config.database && config.username && config.password;

  // 检查配置是否有变更
  const hasChanges = () => {
    const savedConfig = loadDatabaseConfig();
    if (!savedConfig) return isConfigComplete;
    
    return JSON.stringify(config) !== JSON.stringify(savedConfig);
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

        {/* 同步状态显示 */}
        {config.enabled && (
          <div className="p-6 border-b border-zinc-800">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${syncStatus.isOnline ? 'bg-green-500' : 'bg-red-500'}`}></div>
                <span className="text-sm text-zinc-300">
                  {syncStatus.isOnline ? '数据库连接正常' : '数据库连接断开'}
                </span>
              </div>
              
              {syncStatus.lastSync && (
                <div className="flex items-center gap-2 text-sm text-zinc-500">
                  <RefreshCw className="w-4 h-4" />
                  <span>最后同步: {syncStatus.lastSync.toLocaleString()}</span>
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
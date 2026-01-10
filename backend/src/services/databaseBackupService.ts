/**
 * 数据库备份服务
 * 
 * 功能：
 * - 自动备份 SQLite 数据库到 NAS 存储
 * - 保留最近 N 份备份
 * - 支持手动触发备份
 * - 定时自动备份
 */

import fs from 'fs';
import path from 'path';

// 备份配置
interface BackupConfig {
  // SQLite 数据库路径
  sqlitePath: string;
  // 备份目标目录（NAS 路径）
  backupDir: string;
  // 保留的备份数量
  maxBackups: number;
  // 自动备份间隔（毫秒），0 表示禁用
  autoBackupInterval: number;
}

class DatabaseBackupService {
  private config: BackupConfig;
  private autoBackupTimer: NodeJS.Timeout | null = null;
  private lastBackupTime: Date | null = null;
  private isInitialized: boolean = false;

  constructor() {
    // 从环境变量读取配置
    const localStoragePath = process.env.LOCAL_STORAGE_PATH || '/Users/ahui/Desktop/nano-banana-images';
    const sqlitePath = process.env.SQLITE_PATH || './data/database.sqlite';
    
    this.config = {
      sqlitePath: path.resolve(sqlitePath),
      backupDir: path.join(localStoragePath, 'database-backups'),
      maxBackups: parseInt(process.env.DB_BACKUP_MAX_COUNT || '10', 10),
      autoBackupInterval: parseInt(process.env.DB_BACKUP_INTERVAL || '3600000', 10), // 默认 1 小时
    };
  }

  /**
   * 初始化备份服务
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // 确保备份目录存在
      if (!fs.existsSync(this.config.backupDir)) {
        fs.mkdirSync(this.config.backupDir, { recursive: true });
        console.log(`📁 创建数据库备份目录: ${this.config.backupDir}`);
      }

      // 启动自动备份
      if (this.config.autoBackupInterval > 0) {
        this.startAutoBackup();
      }

      // 启动时执行一次备份
      await this.backup('startup');

      this.isInitialized = true;
      console.log('✅ 数据库备份服务初始化成功');
      console.log(`   备份目录: ${this.config.backupDir}`);
      console.log(`   保留备份数: ${this.config.maxBackups}`);
      console.log(`   自动备份间隔: ${this.config.autoBackupInterval / 1000}秒`);
    } catch (error) {
      console.error('❌ 数据库备份服务初始化失败:', error);
    }
  }

  /**
   * 执行数据库备份
   * @param reason 备份原因（用于日志和文件名）
   */
  async backup(reason: string = 'manual'): Promise<string | null> {
    try {
      // 检查源数据库文件是否存在
      if (!fs.existsSync(this.config.sqlitePath)) {
        console.warn('⚠️ 数据库文件不存在，跳过备份');
        return null;
      }

      // 生成备份文件名：database_YYYYMMDD_HHMMSS_reason.sqlite
      const now = new Date();
      const timestamp = now.toISOString()
        .replace(/[-:]/g, '')
        .replace('T', '_')
        .slice(0, 15);
      const backupFileName = `database_${timestamp}_${reason}.sqlite`;
      const backupPath = path.join(this.config.backupDir, backupFileName);

      // 复制数据库文件
      // 使用 copyFileSync 确保完整复制
      fs.copyFileSync(this.config.sqlitePath, backupPath);

      // 同时备份 WAL 和 SHM 文件（如果存在）
      const walPath = this.config.sqlitePath + '-wal';
      const shmPath = this.config.sqlitePath + '-shm';
      
      if (fs.existsSync(walPath)) {
        fs.copyFileSync(walPath, backupPath + '-wal');
      }
      if (fs.existsSync(shmPath)) {
        fs.copyFileSync(shmPath, backupPath + '-shm');
      }

      this.lastBackupTime = now;
      console.log(`💾 数据库备份成功: ${backupFileName}`);

      // 清理旧备份
      await this.cleanupOldBackups();

      return backupPath;
    } catch (error) {
      console.error('❌ 数据库备份失败:', error);
      return null;
    }
  }

  /**
   * 清理旧备份，只保留最近 N 份
   */
  private async cleanupOldBackups(): Promise<void> {
    try {
      const files = fs.readdirSync(this.config.backupDir)
        .filter(f => f.startsWith('database_') && f.endsWith('.sqlite'))
        .map(f => ({
          name: f,
          path: path.join(this.config.backupDir, f),
          time: fs.statSync(path.join(this.config.backupDir, f)).mtime.getTime(),
        }))
        .sort((a, b) => b.time - a.time); // 按时间降序排列

      // 删除超出数量限制的旧备份
      const toDelete = files.slice(this.config.maxBackups);
      for (const file of toDelete) {
        fs.unlinkSync(file.path);
        // 同时删除关联的 WAL 和 SHM 文件
        const walPath = file.path + '-wal';
        const shmPath = file.path + '-shm';
        if (fs.existsSync(walPath)) fs.unlinkSync(walPath);
        if (fs.existsSync(shmPath)) fs.unlinkSync(shmPath);
        console.log(`🗑️ 删除旧备份: ${file.name}`);
      }
    } catch (error) {
      console.error('清理旧备份失败:', error);
    }
  }

  /**
   * 启动自动备份定时器
   */
  private startAutoBackup(): void {
    if (this.autoBackupTimer) {
      clearInterval(this.autoBackupTimer);
    }

    this.autoBackupTimer = setInterval(async () => {
      await this.backup('auto');
    }, this.config.autoBackupInterval);

    console.log(`⏰ 自动备份已启动，间隔: ${this.config.autoBackupInterval / 1000}秒`);
  }

  /**
   * 停止自动备份
   */
  stopAutoBackup(): void {
    if (this.autoBackupTimer) {
      clearInterval(this.autoBackupTimer);
      this.autoBackupTimer = null;
      console.log('⏹️ 自动备份已停止');
    }
  }

  /**
   * 获取备份列表
   */
  getBackupList(): Array<{ name: string; size: number; time: Date }> {
    try {
      if (!fs.existsSync(this.config.backupDir)) {
        return [];
      }

      return fs.readdirSync(this.config.backupDir)
        .filter(f => f.startsWith('database_') && f.endsWith('.sqlite'))
        .map(f => {
          const filePath = path.join(this.config.backupDir, f);
          const stats = fs.statSync(filePath);
          return {
            name: f,
            size: stats.size,
            time: stats.mtime,
          };
        })
        .sort((a, b) => b.time.getTime() - a.time.getTime());
    } catch (error) {
      console.error('获取备份列表失败:', error);
      return [];
    }
  }

  /**
   * 恢复数据库（从备份）
   * @param backupName 备份文件名
   */
  async restore(backupName: string): Promise<boolean> {
    try {
      const backupPath = path.join(this.config.backupDir, backupName);
      
      if (!fs.existsSync(backupPath)) {
        console.error('备份文件不存在:', backupName);
        return false;
      }

      // 先备份当前数据库
      await this.backup('before-restore');

      // 恢复数据库
      fs.copyFileSync(backupPath, this.config.sqlitePath);

      // 恢复 WAL 和 SHM 文件（如果存在）
      const walBackup = backupPath + '-wal';
      const shmBackup = backupPath + '-shm';
      
      if (fs.existsSync(walBackup)) {
        fs.copyFileSync(walBackup, this.config.sqlitePath + '-wal');
      } else {
        // 删除现有的 WAL 文件
        const currentWal = this.config.sqlitePath + '-wal';
        if (fs.existsSync(currentWal)) fs.unlinkSync(currentWal);
      }
      
      if (fs.existsSync(shmBackup)) {
        fs.copyFileSync(shmBackup, this.config.sqlitePath + '-shm');
      } else {
        // 删除现有的 SHM 文件
        const currentShm = this.config.sqlitePath + '-shm';
        if (fs.existsSync(currentShm)) fs.unlinkSync(currentShm);
      }

      console.log(`✅ 数据库已从备份恢复: ${backupName}`);
      return true;
    } catch (error) {
      console.error('恢复数据库失败:', error);
      return false;
    }
  }

  /**
   * 获取最后备份时间
   */
  getLastBackupTime(): Date | null {
    return this.lastBackupTime;
  }

  /**
   * 获取备份目录路径
   */
  getBackupDir(): string {
    return this.config.backupDir;
  }
}

// 导出单例
export const databaseBackupService = new DatabaseBackupService();
export default databaseBackupService;

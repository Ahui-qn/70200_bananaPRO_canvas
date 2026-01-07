#!/usr/bin/env node
/**
 * 用户管理命令行工具
 * 
 * 用法：
 *   npm run user:create -- --username=zhangsan --password=123456 --name="张三"
 *   npm run user:list
 *   npm run user:disable -- --username=zhangsan
 *   npm run user:enable -- --username=zhangsan
 * 
 * 需求: 3.1, 3.2, 3.4
 */

import dotenv from 'dotenv';
import { databaseService } from '../services/databaseService.js';
import { userService } from '../services/userService.js';

// 加载环境变量
dotenv.config();

/**
 * 解析命令行参数
 */
function parseArgs(): Record<string, string> {
  const args: Record<string, string> = {};
  
  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith('--')) {
      const [key, ...valueParts] = arg.substring(2).split('=');
      args[key] = valueParts.join('=') || 'true';
    }
  }
  
  return args;
}

/**
 * 连接数据库
 */
async function connectDatabase(): Promise<boolean> {
  const dbHost = process.env.DB_HOST;
  const dbPort = process.env.DB_PORT;
  const dbDatabase = process.env.DB_DATABASE;
  const dbUsername = process.env.DB_USERNAME;
  const dbPassword = process.env.DB_PASSWORD;
  const dbSsl = process.env.DB_SSL;

  if (!dbHost || !dbDatabase || !dbUsername || !dbPassword) {
    console.error('❌ 数据库配置不完整，请检查 .env 文件');
    return false;
  }

  try {
    const dbConfig = {
      host: dbHost,
      port: parseInt(dbPort || '3306', 10),
      database: dbDatabase,
      username: dbUsername,
      password: dbPassword,
      ssl: dbSsl === 'true',
      enabled: true
    };

    const connected = await databaseService.connect(dbConfig);
    return connected;
  } catch (error: any) {
    console.error('❌ 数据库连接失败:', error.message);
    return false;
  }
}

/**
 * 创建用户
 */
async function createUser(args: Record<string, string>): Promise<void> {
  const { username, password, name } = args;

  if (!username || !password || !name) {
    console.error('❌ 缺少必要参数');
    console.log('用法: npm run user:create -- --username=用户名 --password=密码 --name=显示名称');
    process.exit(1);
  }

  try {
    const user = await userService.createUser(username, password, name);
    console.log('✅ 用户创建成功');
    console.log(`   ID: ${user.id}`);
    console.log(`   用户名: ${user.username}`);
    console.log(`   显示名称: ${user.displayName}`);
    console.log(`   创建时间: ${user.createdAt.toLocaleString()}`);
  } catch (error: any) {
    console.error('❌ 创建用户失败:', error.message);
    process.exit(1);
  }
}

/**
 * 列出所有用户
 */
async function listUsers(): Promise<void> {
  try {
    const users = await userService.listUsers();
    
    if (users.length === 0) {
      console.log('📋 暂无用户');
      return;
    }

    console.log(`📋 用户列表 (共 ${users.length} 个用户):`);
    console.log('─'.repeat(100));
    console.log('ID'.padEnd(40) + '用户名'.padEnd(15) + '显示名称'.padEnd(15) + '角色'.padEnd(10) + '最后登录');
    console.log('─'.repeat(100));
    
    for (const user of users) {
      const lastLogin = user.lastLoginAt 
        ? user.lastLoginAt.toLocaleString() 
        : '从未登录';
      console.log(
        user.id.padEnd(40) + 
        user.username.padEnd(15) + 
        user.displayName.padEnd(15) + 
        user.role.padEnd(10) + 
        lastLogin
      );
    }
    
    console.log('─'.repeat(100));
  } catch (error: any) {
    console.error('❌ 获取用户列表失败:', error.message);
    process.exit(1);
  }
}

/**
 * 禁用用户
 */
async function disableUser(args: Record<string, string>): Promise<void> {
  const { username } = args;

  if (!username) {
    console.error('❌ 缺少用户名参数');
    console.log('用法: npm run user:disable -- --username=用户名');
    process.exit(1);
  }

  try {
    const user = await userService.getUserByUsername(username);
    if (!user) {
      console.error(`❌ 用户不存在: ${username}`);
      process.exit(1);
    }

    await userService.disableUser(user.id);
    console.log(`✅ 用户已禁用: ${username}`);
  } catch (error: any) {
    console.error('❌ 禁用用户失败:', error.message);
    process.exit(1);
  }
}

/**
 * 启用用户
 */
async function enableUser(args: Record<string, string>): Promise<void> {
  const { username } = args;

  if (!username) {
    console.error('❌ 缺少用户名参数');
    console.log('用法: npm run user:enable -- --username=用户名');
    process.exit(1);
  }

  try {
    const user = await userService.getUserByUsername(username);
    if (!user) {
      console.error(`❌ 用户不存在: ${username}`);
      process.exit(1);
    }

    await userService.enableUser(user.id);
    console.log(`✅ 用户已启用: ${username}`);
  } catch (error: any) {
    console.error('❌ 启用用户失败:', error.message);
    process.exit(1);
  }
}

/**
 * 修改用户角色
 */
async function setUserRole(args: Record<string, string>): Promise<void> {
  const { username, role } = args;

  if (!username) {
    console.error('❌ 缺少用户名参数');
    console.log('用法: npm run user:set-role -- --username=用户名 --role=角色');
    process.exit(1);
  }

  if (!role) {
    console.error('❌ 缺少角色参数');
    console.log('用法: npm run user:set-role -- --username=用户名 --role=角色');
    console.log('可用角色: admin, user');
    process.exit(1);
  }

  if (!['admin', 'user'].includes(role)) {
    console.error('❌ 无效的角色，可用角色: admin, user');
    process.exit(1);
  }

  try {
    const user = await userService.getUserByUsername(username);
    if (!user) {
      console.error(`❌ 用户不存在: ${username}`);
      process.exit(1);
    }

    // 直接更新数据库中的用户角色
    await databaseService.executeQuery(
      'UPDATE users SET role = ? WHERE id = ?',
      [role, user.id]
    );

    console.log(`✅ 用户角色已更新: ${username} -> ${role}`);
  } catch (error: any) {
    console.error('❌ 修改用户角色失败:', error.message);
    process.exit(1);
  }
}

/**
 * 重置用户密码
 */
async function resetPassword(args: Record<string, string>): Promise<void> {
  const { username, password } = args;

  if (!username) {
    console.error('❌ 缺少用户名参数');
    console.log('用法: npm run user:reset-password -- --username=用户名 --password=新密码');
    process.exit(1);
  }

  if (!password) {
    console.error('❌ 缺少密码参数');
    console.log('用法: npm run user:reset-password -- --username=用户名 --password=新密码');
    process.exit(1);
  }

  try {
    const user = await userService.getUserByUsername(username);
    if (!user) {
      console.error(`❌ 用户不存在: ${username}`);
      process.exit(1);
    }

    await userService.resetPassword(user.id, password);
    console.log(`✅ 用户密码已重置: ${username}`);
  } catch (error: any) {
    console.error('❌ 重置密码失败:', error.message);
    process.exit(1);
  }
}

/**
 * 显示帮助信息
 */
function showHelp(): void {
  console.log(`
用户管理命令行工具

用法:
  npm run user:create -- --username=用户名 --password=密码 --name=显示名称
  npm run user:list
  npm run user:disable -- --username=用户名
  npm run user:enable -- --username=用户名
  npm run user:set-role -- --username=用户名 --role=角色
  npm run user:reset-password -- --username=用户名 --password=新密码

命令:
  create          创建新用户
  list            列出所有用户
  disable         禁用用户
  enable          启用用户
  set-role        修改用户角色
  reset-password  重置用户密码

参数:
  --username    用户名（登录时使用）
  --password    密码（至少6位）
  --name        显示名称
  --role        用户角色（admin 或 user）

示例:
  npm run user:create -- --username=zhangsan --password=123456 --name="张三"
  npm run user:list
  npm run user:disable -- --username=zhangsan
  npm run user:set-role -- --username=admin --role=admin
  npm run user:reset-password -- --username=zhangsan --password=newpass123
`);
}

/**
 * 主函数
 */
async function main(): Promise<void> {
  const command = process.argv[2];
  const args = parseArgs();

  if (!command || command === 'help' || command === '--help' || command === '-h') {
    showHelp();
    process.exit(0);
  }

  // 连接数据库
  console.log('正在连接数据库...');
  const connected = await connectDatabase();
  if (!connected) {
    process.exit(1);
  }
  console.log('✅ 数据库连接成功\n');

  try {
    switch (command) {
      case 'create':
        await createUser(args);
        break;
      case 'list':
        await listUsers();
        break;
      case 'disable':
        await disableUser(args);
        break;
      case 'enable':
        await enableUser(args);
        break;
      case 'set-role':
        await setUserRole(args);
        break;
      case 'reset-password':
        await resetPassword(args);
        break;
      default:
        console.error(`❌ 未知命令: ${command}`);
        showHelp();
        process.exit(1);
    }
  } finally {
    // 断开数据库连接
    await databaseService.disconnect();
  }
}

// 运行主函数
main().catch(error => {
  console.error('❌ 程序执行失败:', error);
  process.exit(1);
});

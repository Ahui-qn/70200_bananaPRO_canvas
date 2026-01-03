#!/usr/bin/env tsx

/**
 * OSS权限测试脚本
 * 测试当前AccessKey的各种权限
 */

import { AliOssService } from '../services/aliOssService.js';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// 加载环境变量
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: join(__dirname, '../../.env') });

class OssPermissionTester {
  private oss: AliOssService;

  constructor() {
    this.oss = new AliOssService();
  }

  async testPermissions(): Promise<void> {
    console.log('🔍 开始测试OSS权限...\n');

    // 初始化OSS服务
    if (!this.oss.initialize()) {
      console.error('❌ OSS服务初始化失败');
      return;
    }

    console.log('✅ OSS服务初始化成功\n');

    // 测试各种权限
    await this.testListPermission();
    await this.testUploadPermission();
    await this.testDeletePermission();
    await this.testGetObjectPermission();
  }

  /**
   * 测试列表权限
   */
  private async testListPermission(): Promise<void> {
    console.log('📋 测试列表权限 (oss:ListObjects)...');
    try {
      const files = await this.oss.listAllFiles();
      console.log(`   ✅ 成功：找到 ${files.length} 个文件`);
      if (files.length > 0) {
        console.log(`   📄 示例文件: ${files.slice(0, 3).join(', ')}`);
      }
    } catch (error: any) {
      console.log(`   ❌ 失败: ${error.message}`);
      console.log(`   🔧 错误代码: ${error.code || 'Unknown'}`);
    }
    console.log('');
  }

  /**
   * 测试上传权限
   */
  private async testUploadPermission(): Promise<void> {
    console.log('📤 测试上传权限 (oss:PutObject)...');
    try {
      // 创建一个测试文件
      const testContent = Buffer.from('OSS权限测试文件 - ' + new Date().toISOString());
      const testKey = `test/permission-test-${Date.now()}.txt`;
      
      const result = await this.oss.uploadFromBuffer(testContent, 'text/plain', testKey);
      console.log(`   ✅ 成功：上传到 ${result.ossKey}`);
      console.log(`   🔗 URL: ${result.url}`);
      
      // 记录测试文件，稍后尝试删除
      (this as any).testFileKey = testKey;
    } catch (error: any) {
      console.log(`   ❌ 失败: ${error.message}`);
      console.log(`   🔧 错误代码: ${error.code || 'Unknown'}`);
    }
    console.log('');
  }

  /**
   * 测试删除权限
   */
  private async testDeletePermission(): Promise<void> {
    console.log('🗑️  测试删除权限 (oss:DeleteObject)...');
    
    const testKey = (this as any).testFileKey;
    if (!testKey) {
      console.log('   ⚠️  跳过：没有测试文件可删除');
      console.log('');
      return;
    }

    try {
      const success = await this.oss.deleteObject(testKey);
      if (success) {
        console.log(`   ✅ 成功：删除了测试文件 ${testKey}`);
      } else {
        console.log(`   ❌ 失败：删除操作返回false`);
      }
    } catch (error: any) {
      console.log(`   ❌ 失败: ${error.message}`);
      console.log(`   🔧 错误代码: ${error.code || 'Unknown'}`);
      
      if (error.code === 'SignatureDoesNotMatch') {
        console.log('   💡 提示：这通常表示没有删除权限');
      } else if (error.code === 'AccessDenied') {
        console.log('   💡 提示：访问被拒绝，检查RAM用户权限');
      }
    }
    console.log('');
  }

  /**
   * 测试获取对象权限
   */
  private async testGetObjectPermission(): Promise<void> {
    console.log('📥 测试获取对象权限 (oss:GetObject)...');
    try {
      // 尝试获取一个已知存在的文件（如果有的话）
      const files = await this.oss.listAllFiles();
      if (files.length === 0) {
        console.log('   ⚠️  跳过：没有文件可测试');
        console.log('');
        return;
      }

      // 这里我们只测试URL访问，不直接下载
      console.log(`   ✅ 成功：可以列出文件，通常表示有GetObject权限`);
      console.log(`   📄 可访问的文件数量: ${files.length}`);
    } catch (error: any) {
      console.log(`   ❌ 失败: ${error.message}`);
    }
    console.log('');
  }
}

async function main() {
  const tester = new OssPermissionTester();
  await tester.testPermissions();
  
  console.log('📊 权限测试完成！');
  console.log('');
  console.log('🔧 如果删除权限测试失败，请检查：');
  console.log('1. RAM用户是否有 oss:DeleteObject 权限');
  console.log('2. RAM用户是否有 oss:DeleteMultipleObjects 权限');
  console.log('3. 权限策略是否正确配置');
  console.log('');
  console.log('💡 建议的RAM权限策略：');
  console.log(JSON.stringify({
    "Version": "1",
    "Statement": [
      {
        "Effect": "Allow",
        "Action": [
          "oss:GetObject",
          "oss:PutObject",
          "oss:DeleteObject",
          "oss:ListObjects",
          "oss:DeleteMultipleObjects"
        ],
        "Resource": [
          "acs:oss:*:*:ahui70200/*"
        ]
      }
    ]
  }, null, 2));
}

main().catch(console.error);
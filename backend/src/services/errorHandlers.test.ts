/**
 * 错误处理器测试
 * 测试网络错误处理器和数据库错误处理器的功能
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { 
  NetworkErrorHandlerImpl, 
  NetworkError,
  createNetworkErrorHandler,
  fetchWithNetworkRetry
} from './networkErrorHandler';
import { 
  DatabaseErrorHandlerImpl,
  DatabaseErrorType,
  createDatabaseErrorHandler,
  handleDatabaseError
} from './databaseErrorHandler';

describe('NetworkErrorHandler', () => {
  let handler: NetworkErrorHandlerImpl;

  beforeEach(() => {
    handler = new NetworkErrorHandlerImpl(2, 100, 1000); // 最多2次重试，基础延迟100ms
  });

  describe('错误重试判断', () => {
    it('应该正确识别可重试的网络错误', () => {
      const retryableErrors = [
        { code: 'NETWORK_ERROR' },
        { code: 'TIMEOUT' },
        { code: 'ECONNREFUSED' },
        { code: 'ETIMEDOUT' },
        { statusCode: 500 },
        { statusCode: 502 },
        { statusCode: 503 },
        { statusCode: 429 }
      ];

      retryableErrors.forEach(error => {
        expect(handler.shouldRetry(error)).toBe(true);
      });
    });

    it('应该正确识别不可重试的错误', () => {
      const nonRetryableErrors = [
        { name: 'AbortError' },
        { statusCode: 400 },
        { statusCode: 401 },
        { statusCode: 403 },
        { statusCode: 404 },
        new NetworkError('测试错误', 'TEST_ERROR', false)
      ];

      nonRetryableErrors.forEach(error => {
        expect(handler.shouldRetry(error)).toBe(false);
      });
    });
  });

  describe('重试机制', () => {
    it('应该在操作成功时不重试', async () => {
      let callCount = 0;
      const operation = async () => {
        callCount++;
        return '成功';
      };

      const result = await handler.executeWithRetry(operation);
      
      expect(result).toBe('成功');
      expect(callCount).toBe(1);
      expect(handler.getCurrentRetryCount()).toBe(0);
    });

    it('应该在可重试错误时进行重试', async () => {
      let callCount = 0;
      const operation = async () => {
        callCount++;
        if (callCount < 2) {
          const error = new Error('网络错误');
          (error as any).code = 'NETWORK_ERROR';
          throw error;
        }
        return '成功';
      };

      const result = await handler.executeWithRetry(operation);
      
      expect(result).toBe('成功');
      expect(callCount).toBe(2);
    });

    it('应该在达到最大重试次数后抛出错误', async () => {
      let callCount = 0;
      const operation = async () => {
        callCount++;
        const error = new Error('持续网络错误');
        (error as any).code = 'NETWORK_ERROR';
        throw error;
      };

      await expect(handler.executeWithRetry(operation)).rejects.toThrow();
      expect(callCount).toBe(2); // 初始调用 + 1次重试（因为maxRetries=2意味着最多2次调用）
    });
  });

  describe('错误创建', () => {
    it('应该创建标准化的网络错误', async () => {
      const operation = async () => {
        const error = new Error('连接被拒绝');
        (error as any).code = 'ECONNREFUSED';
        throw error;
      };

      try {
        await handler.executeWithRetry(operation);
      } catch (error) {
        expect(error).toBeInstanceOf(NetworkError);
        expect((error as NetworkError).code).toBe('ECONNREFUSED');
        expect((error as NetworkError).message).toContain('连接被拒绝');
      }
    });
  });
});

describe('DatabaseErrorHandler', () => {
  let handler: DatabaseErrorHandlerImpl;

  beforeEach(() => {
    handler = new DatabaseErrorHandlerImpl(100); // 最多保存100条日志
  });

  describe('错误分析', () => {
    it('应该正确分析连接错误', () => {
      const error = { code: 'ECONNREFUSED', message: '连接被拒绝' };
      const dbError = handler.handleError(error, {
        operation: 'CONNECT',
        tableName: 'database'
      });

      expect(dbError.code).toBe('ECONNREFUSED');
      expect(dbError.message).toContain('连接');
      expect((dbError as any).type).toBe(DatabaseErrorType.CONNECTION);
      expect((dbError as any).retryable).toBe(true);
      expect((dbError as any).suggestions).toBeInstanceOf(Array);
    });

    it('应该正确分析认证错误', () => {
      const error = { code: 'ER_ACCESS_DENIED_ERROR', message: '访问被拒绝' };
      const dbError = handler.handleError(error, {
        operation: 'CONNECT',
        tableName: 'database'
      });

      expect(dbError.code).toBe('ER_ACCESS_DENIED_ERROR');
      expect((dbError as any).type).toBe(DatabaseErrorType.AUTHENTICATION);
      expect((dbError as any).retryable).toBe(false);
    });

    it('应该正确分析约束违反错误', () => {
      const error = { code: 'ER_DUP_ENTRY', message: '重复条目' };
      const dbError = handler.handleError(error, {
        operation: 'INSERT',
        tableName: 'images'
      });

      expect(dbError.code).toBe('ER_DUP_ENTRY');
      expect((dbError as any).type).toBe(DatabaseErrorType.CONSTRAINT);
      expect((dbError as any).retryable).toBe(false);
    });
  });

  describe('错误日志', () => {
    it('应该记录错误到日志', () => {
      const error = { code: 'TEST_ERROR', message: '测试错误' };
      
      handler.handleError(error, {
        operation: 'TEST',
        tableName: 'test_table',
        recordId: 'test-123'
      });

      const logs = handler.getErrorLog(1);
      expect(logs).toHaveLength(1);
      expect(logs[0].operation).toBe('TEST');
      expect(logs[0].tableName).toBe('test_table');
      expect(logs[0].recordId).toBe('test-123');
      expect(logs[0].status).toBe('FAILED');
    });

    it('应该提供错误统计信息', () => {
      // 添加一些测试错误
      handler.handleError({ code: 'ECONNREFUSED' }, { operation: 'CONNECT' });
      handler.handleError({ code: 'ER_ACCESS_DENIED_ERROR' }, { operation: 'AUTH' });
      handler.handleError({ code: 'ECONNREFUSED' }, { operation: 'CONNECT' });

      const stats = handler.getErrorStats();
      expect(stats.total).toBe(3);
      expect(stats.byCode['ECONNREFUSED']).toBe(2);
      expect(stats.byCode['ER_ACCESS_DENIED_ERROR']).toBe(1);
    });

    it('应该能够清除错误日志', () => {
      handler.handleError({ code: 'TEST_ERROR' }, { operation: 'TEST' });
      expect(handler.getErrorLog()).toHaveLength(1);

      handler.clearErrorLog();
      expect(handler.getErrorLog()).toHaveLength(0);
    });
  });

  describe('辅助方法', () => {
    it('应该正确判断错误是否可重试', () => {
      expect(handler.isRetryable({ code: 'ECONNREFUSED' })).toBe(true);
      expect(handler.isRetryable({ code: 'ER_ACCESS_DENIED_ERROR' })).toBe(false);
    });

    it('应该提供错误建议', () => {
      const suggestions = handler.getSuggestions({ code: 'ECONNREFUSED' });
      expect(suggestions).toBeInstanceOf(Array);
      expect(suggestions.length).toBeGreaterThan(0);
    });

    it('应该格式化用户友好的错误消息', () => {
      const message = handler.formatUserMessage({ code: 'ER_ACCESS_DENIED_ERROR' });
      expect(message).toContain('访问被拒绝');
    });
  });
});

describe('便捷函数', () => {
  describe('createNetworkErrorHandler', () => {
    it('应该创建配置正确的网络错误处理器', () => {
      const handler = createNetworkErrorHandler(5, 200, 5000);
      expect(handler.getMaxRetries()).toBe(5);
    });
  });

  describe('createDatabaseErrorHandler', () => {
    it('应该创建数据库错误处理器', () => {
      const handler = createDatabaseErrorHandler(50);
      expect(handler).toBeInstanceOf(DatabaseErrorHandlerImpl);
    });
  });

  describe('handleDatabaseError', () => {
    it('应该抛出处理后的数据库错误', () => {
      const error = { code: 'TEST_ERROR', message: '测试错误' };
      
      expect(() => {
        handleDatabaseError(error, { operation: 'TEST' });
      }).toThrow();
    });
  });
});
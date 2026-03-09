/**
 * 流式协议测试
 *
 * 测试范围：
 * 1. 流式消息组装
 * 2. 增量内容追加
 * 3. 流式超时处理
 * 4. 断线清理
 *
 * @see docs/private_docs/Tech/3.3.流式协议.md
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { SessionPayload } from '../types';

// 导入实际实现
import { StreamHandler } from '../../src/utils/streamHandler';

// 类型定义（用于类型检查）
type StreamHandlerInterface = InstanceType<typeof StreamHandler>;

// ============ 测试数据工厂 ============

/**
 * 创建流式首帧消息
 */
function createStreamStartMessage(
  streamId: string,
  sessionId: string,
  initialContent: string
): SessionPayload {
  return {
    session_id: sessionId,
    chat_type: 'private',
    is_streaming: true,
    stream_id: streamId,
    message: {
      sender_id: 'agent_001',
      sender_type: 'assistant',
      content: initialContent,
    },
  };
}

/**
 * 创建流式增量消息
 */
function createStreamDeltaMessage(
  streamId: string,
  sessionId: string,
  deltaContent: string,
  isFinished: boolean = false
): SessionPayload {
  return {
    session_id: sessionId,
    chat_type: 'private',
    is_streaming: true,
    stream_id: streamId,
    is_finished: isFinished,
    delta: { content: deltaContent },
    message: {
      sender_id: 'agent_001',
      sender_type: 'assistant',
      content: '',
    },
  };
}

// ============ 测试用例 ============

describe('流式消息处理器', () => {
  let handler: StreamHandler;

  beforeEach(() => {
    // 使用实际实现
    handler = new StreamHandler();
  });

  afterEach(() => {
    handler.clearAll();
  });

  // ============ 流式消息组装测试 ============

  describe('流式消息组装', () => {
    it('应该正确处理流式首帧', () => {
      const streamId = 'str_001';
      const message = createStreamStartMessage(streamId, 'sess_001', '你好');

      handler.handle(message);

      expect(handler.hasStream(streamId)).toBe(true);
      expect(handler.getContent(streamId)).toBe('你好');
    });

    it('应该正确追加增量内容', () => {
      const streamId = 'str_001';

      handler.handle(createStreamStartMessage(streamId, 'sess_001', '你好'));
      handler.handle(createStreamDeltaMessage(streamId, 'sess_001', '，'));
      handler.handle(createStreamDeltaMessage(streamId, 'sess_001', '我是助手'));

      expect(handler.getContent(streamId)).toBe('你好，我是助手');
    });

    it('应该在流结束时返回完整消息', () => {
      const streamId = 'str_001';

      handler.handle(createStreamStartMessage(streamId, 'sess_001', '你好'));
      handler.handle(createStreamDeltaMessage(streamId, 'sess_001', '，'));
      const result = handler.handle(createStreamDeltaMessage(streamId, 'sess_001', '世界！', true));

      expect(result).toBe('你好，世界！');
    });

    it('应该在流结束后清理流', () => {
      const streamId = 'str_001';

      handler.handle(createStreamStartMessage(streamId, 'sess_001', '你好'));
      handler.handle(createStreamDeltaMessage(streamId, 'sess_001', '！', true));

      expect(handler.hasStream(streamId)).toBe(false);
    });

    it('应该正确处理多个并发流', () => {
      const streamId1 = 'str_001';
      const streamId2 = 'str_002';

      handler.handle(createStreamStartMessage(streamId1, 'sess_001', '流1开始'));
      handler.handle(createStreamStartMessage(streamId2, 'sess_002', '流2开始'));

      handler.handle(createStreamDeltaMessage(streamId1, 'sess_001', '流1继续'));
      handler.handle(createStreamDeltaMessage(streamId2, 'sess_002', '流2继续'));

      expect(handler.getContent(streamId1)).toBe('流1开始流1继续');
      expect(handler.getContent(streamId2)).toBe('流2开始流2继续');
      expect(handler.getActiveCount()).toBe(2);
    });
  });

  // ============ 边界情况测试 ============

  describe('边界情况', () => {
    it('应该处理空增量内容', () => {
      const streamId = 'str_001';

      handler.handle(createStreamStartMessage(streamId, 'sess_001', '你好'));
      handler.handle(createStreamDeltaMessage(streamId, 'sess_001', ''));

      expect(handler.getContent(streamId)).toBe('你好');
    });

    it('应该处理只有首帧的流', () => {
      const streamId = 'str_001';

      handler.handle(createStreamStartMessage(streamId, 'sess_001', '你好'));

      expect(handler.hasStream(streamId)).toBe(true);
      expect(handler.getContent(streamId)).toBe('你好');
    });

    it('应该处理首帧为空的情况', () => {
      const streamId = 'str_001';

      handler.handle(createStreamStartMessage(streamId, 'sess_001', ''));

      expect(handler.getContent(streamId)).toBe('');
    });

    it('应该处理Unicode增量', () => {
      const streamId = 'str_001';

      handler.handle(createStreamStartMessage(streamId, 'sess_001', '你好'));
      handler.handle(createStreamDeltaMessage(streamId, 'sess_001', '🌏'));
      handler.handle(createStreamDeltaMessage(streamId, 'sess_001', '！'));

      expect(handler.getContent(streamId)).toBe('你好🌏！');
    });

    it('应该处理换行符', () => {
      const streamId = 'str_001';

      handler.handle(createStreamStartMessage(streamId, 'sess_001', '第一行'));
      handler.handle(createStreamDeltaMessage(streamId, 'sess_001', '\n'));
      handler.handle(createStreamDeltaMessage(streamId, 'sess_001', '第二行'));

      expect(handler.getContent(streamId)).toBe('第一行\n第二行');
    });

    it('应该处理Markdown内容', () => {
      const streamId = 'str_001';

      handler.handle(createStreamStartMessage(streamId, 'sess_001', '```'));
      handler.handle(createStreamDeltaMessage(streamId, 'sess_001', 'typescript'));
      handler.handle(createStreamDeltaMessage(streamId, 'sess_001', '\nconst x = 1;'));
      handler.handle(createStreamDeltaMessage(streamId, 'sess_001', '\n```'));

      expect(handler.getContent(streamId)).toBe('```typescript\nconst x = 1;\n```');
    });
  });

  // ============ 超时清理测试 ============

  describe('超时清理', () => {
    it('应该清理超时的流', async () => {
      const streamId = 'str_001';
      const shortTimeout = 100; // 100ms

      handler.handle(createStreamStartMessage(streamId, 'sess_001', '开始'));

      // 等待超时
      await new Promise(resolve => setTimeout(resolve, shortTimeout + 50));

      const cleaned = handler.cleanup(shortTimeout);

      expect(cleaned).toContain(streamId);
      expect(handler.hasStream(streamId)).toBe(false);
    });

    it('不应该清理未超时的流', () => {
      const streamId = 'str_001';
      const longTimeout = 30000; // 30秒

      handler.handle(createStreamStartMessage(streamId, 'sess_001', '开始'));

      const cleaned = handler.cleanup(longTimeout);

      expect(cleaned).not.toContain(streamId);
      expect(handler.hasStream(streamId)).toBe(true);
    });

    it('应该清理所有超时的流', async () => {
      const shortTimeout = 100;

      handler.handle(createStreamStartMessage('str_001', 'sess_001', '流1'));
      handler.handle(createStreamStartMessage('str_002', 'sess_002', '流2'));

      await new Promise(resolve => setTimeout(resolve, shortTimeout + 50));

      const cleaned = handler.cleanup(shortTimeout);

      expect(cleaned).toHaveLength(2);
      expect(handler.getActiveCount()).toBe(0);
    });
  });

  // ============ 异常处理测试 ============

  describe('异常处理', () => {
    it('应该忽略未知stream_id的增量消息', () => {
      const result = handler.handle(createStreamDeltaMessage('unknown_stream', 'sess_001', '内容'));

      expect(result).toBeNull();
      expect(handler.hasStream('unknown_stream')).toBe(false);
    });

    it('应该处理重复的首帧（覆盖）', () => {
      const streamId = 'str_001';

      handler.handle(createStreamStartMessage(streamId, 'sess_001', '第一次'));
      handler.handle(createStreamStartMessage(streamId, 'sess_001', '第二次'));

      expect(handler.getContent(streamId)).toBe('第二次');
    });

    it('应该正确清理所有流', () => {
      handler.handle(createStreamStartMessage('str_001', 'sess_001', '流1'));
      handler.handle(createStreamStartMessage('str_002', 'sess_002', '流2'));
      handler.handle(createStreamStartMessage('str_003', 'sess_003', '流3'));

      handler.clearAll();

      expect(handler.getActiveCount()).toBe(0);
    });
  });

  // ============ 性能测试 ============

  describe('性能测试', () => {
    it('应该高效处理大量增量', () => {
      const streamId = 'str_001';
      const iterations = 1000;

      handler.handle(createStreamStartMessage(streamId, 'sess_001', ''));

      const startTime = performance.now();
      for (let i = 0; i < iterations; i++) {
        handler.handle(createStreamDeltaMessage(streamId, 'sess_001', `增量${i}`));
      }
      const endTime = performance.now();

      // 1000次增量处理应该在100ms内完成
      expect(endTime - startTime).toBeLessThan(100);
    });

    it('应该高效处理大量并发流', () => {
      const streamCount = 100;

      for (let i = 0; i < streamCount; i++) {
        handler.handle(createStreamStartMessage(`str_${i}`, `sess_${i}`, `流${i}`));
      }

      expect(handler.getActiveCount()).toBe(streamCount);

      // 获取内容应该快速
      const startTime = performance.now();
      for (let i = 0; i < streamCount; i++) {
        handler.getContent(`str_${i}`);
      }
      const endTime = performance.now();

      // 100次获取应该在10ms内完成
      expect(endTime - startTime).toBeLessThan(10);
    });
  });
});

// ============ 测试总结 ============
/**
 * 测试覆盖：
 * - 流式消息组装：5个用例
 * - 边界情况：6个用例
 * - 超时清理：3个用例
 * - 异常处理：3个用例
 * - 性能测试：2个用例
 *
 * 总计：19个测试用例
 *
 * 关键实现要点：
 * 1. 使用Map存储流状态，以stream_id为键
 * 2. 每个流需要记录：内容、创建时间、最后更新时间
 * 3. cleanup方法需要遍历所有流，检查是否超时
 * 4. 处理增量时需要检查stream_id是否存在
 */

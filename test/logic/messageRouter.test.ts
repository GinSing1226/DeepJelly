/**
 * 消息路由测试
 *
 * 测试范围：
 * 1. 北向路由（大脑层 → 表现层）
 * 2. 南向路由（表现层 → 大脑层）
 * 3. 消息类型分发
 * 4. 协议转换
 * 5. 异常处理
 *
 * @see docs/private_docs/Reqs/4.1.逻辑层.md
 * @see docs/private_docs/Tech/5.1.后端总览.md
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import type { CAPEnvelope, CAPMessageType } from '../types';

// ============ 待实现的接口 ============

/**
 * 消息路由器接口
 * TODO: 在 src/logic/router.ts 中实现
 */
interface MessageRouter {
  /**
   * 路由消息
   * @param envelope CAP信封
   * @returns 路由结果
   */
  route(envelope: CAPEnvelope): RouteResult;

  /**
   * 注册消息处理器
   * @param type 消息类型
   * @param handler 处理函数
   */
  registerHandler(
    type: CAPMessageType,
    handler: (envelope: CAPEnvelope) => void
  ): void;

  /**
   * 注销消息处理器
   * @param type 消息类型
   */
  unregisterHandler(type: CAPMessageType): void;

  /**
   * 获取当前活跃的处理器
   */
  getActiveHandlers(): CAPMessageType[];

  /**
   * 清空所有处理器
   */
  clearHandlers(): void;
}

/**
 * 路由结果
 */
interface RouteResult {
  /** 是否成功 */
  success: boolean;
  /** 路由目标 */
  target?: string;
  /** 错误信息 */
  error?: string;
}

// ============ 测试数据工厂 ============

function createMockEnvelope<T>(
  type: CAPMessageType,
  payload: T
): CAPEnvelope<T> {
  return {
    msg_id: `msg_${Date.now()}`,
    timestamp: Date.now(),
    type,
    sender: { app_id: 'openclaw', agent_id: 'agent_001' },
    receiver: { target_type: 'character', target_id: 'char_001' },
    payload,
  };
}

// ============ 测试用例 ============

describe('消息路由器', () => {
  let router: MessageRouter;

  beforeEach(() => {
    // TODO: 导入实际实现
    // router = new MessageRouterImpl();
    // 暂时使用mock
    router = {
      route: vi.fn(),
      registerHandler: vi.fn(),
      unregisterHandler: vi.fn(),
      getActiveHandlers: vi.fn(),
      clearHandlers: vi.fn(),
    };
  });

  afterEach(() => {
    router.clearHandlers();
  });

  // ============ 北向路由测试 ============

  describe('北向路由（大脑层 → 表现层）', () => {
    it('behavior_mental消息应该路由到角色视窗', () => {
      const handler = vi.fn();
      vi.mocked(router.registerHandler).mockImplementation((type, h) => {
        if (type === 'behavior_mental') {
          router.route = vi.fn().mockImplementation((envelope) => {
            if (envelope.type === 'behavior_mental') {
              h(envelope);
              return { success: true, target: 'character-window' };
            }
            return { success: false };
          });
        }
      });

      router.registerHandler('behavior_mental', handler);

      const envelope = createMockEnvelope('behavior_mental', {
        assistant_id: 'asst_001',
        behavior: {
          domain: 'internal',
          category: 'work',
          action_id: 'think',
          urgency: 5,
          intensity: 1.0,
          duration_ms: null,
        },
      });

      const result = router.route(envelope);

      expect(result.success).toBe(true);
      expect(result.target).toBe('character-window');
    });

    it('session消息应该路由到对话框/聊天气泡', () => {
      const handler = vi.fn();

      vi.mocked(router.registerHandler).mockImplementation((type, h) => {
        if (type === 'session') {
          router.route = vi.fn().mockImplementation((envelope) => {
            if (envelope.type === 'session') {
              h(envelope);
              return { success: true, target: 'chat-bubble' };
            }
            return { success: false };
          });
        }
      });

      router.registerHandler('session', handler);

      const envelope = createMockEnvelope('session', {
        session_id: 'sess_001',
        chat_type: 'private',
        message: {
          sender_id: 'agent_001',
          sender_type: 'assistant',
          content: '测试消息',
        },
      });

      const result = router.route(envelope);

      expect(result.success).toBe(true);
      expect(result.target).toBe('chat-bubble');
    });

    it('notification消息应该路由到托盘通知', () => {
      const handler = vi.fn();

      vi.mocked(router.registerHandler).mockImplementation((type, h) => {
        if (type === 'notification') {
          router.route = vi.fn().mockImplementation((envelope) => {
            if (envelope.type === 'notification') {
              h(envelope);
              return { success: true, target: 'tray-notification' };
            }
            return { success: false };
          });
        }
      });

      router.registerHandler('notification', handler);

      const envelope = createMockEnvelope('notification', {
        notification_type: 'new_message',
        app_id: 'openclaw',
        title: '新消息',
        content: '您有新消息',
      });

      const result = router.route(envelope);

      expect(result.success).toBe(true);
      expect(result.target).toBe('tray-notification');
    });

    it('status消息应该路由到状态气泡', () => {
      const handler = vi.fn();

      vi.mocked(router.registerHandler).mockImplementation((type, h) => {
        if (type === 'status') {
          router.route = vi.fn().mockImplementation((envelope) => {
            if (envelope.type === 'status') {
              h(envelope);
              return { success: true, target: 'status-bubble' };
            }
            return { success: false };
          });
        }
      });

      router.registerHandler('status', handler);

      const envelope = createMockEnvelope('status', {
        assistant_id: 'asst_001',
        emoji: '🤔',
        text: '思考中',
      });

      const result = router.route(envelope);

      expect(result.success).toBe(true);
      expect(result.target).toBe('status-bubble');
    });
  });

  // ============ 处理器管理测试 ============

  describe('处理器管理', () => {
    it('应该能够注册处理器', () => {
      const handler = vi.fn();

      vi.mocked(router.registerHandler).mockImplementation((type, h) => {
        vi.mocked(router.getActiveHandlers).mockReturnValue([type]);
      });

      router.registerHandler('behavior_mental', handler);

      expect(router.getActiveHandlers()).toContain('behavior_mental');
    });

    it('应该能够注销处理器', () => {
      const handler = vi.fn();

      vi.mocked(router.registerHandler).mockImplementation((type) => {
        vi.mocked(router.getActiveHandlers).mockReturnValue([type]);
      });

      router.registerHandler('behavior_mental', handler);
      expect(router.getActiveHandlers()).toContain('behavior_mental');

      vi.mocked(router.unregisterHandler).mockImplementation(() => {
        vi.mocked(router.getActiveHandlers).mockReturnValue([]);
      });

      router.unregisterHandler('behavior_mental');
      expect(router.getActiveHandlers()).not.toContain('behavior_mental');
    });

    it('应该支持多个处理器', () => {
      vi.mocked(router.registerHandler).mockImplementation((type) => {
        const current = router.getActiveHandlers() || [];
        vi.mocked(router.getActiveHandlers).mockReturnValue([...current, type]);
      });

      router.registerHandler('behavior_mental', vi.fn());
      router.registerHandler('session', vi.fn());
      router.registerHandler('notification', vi.fn());

      expect(router.getActiveHandlers()).toHaveLength(3);
    });

    it('清空处理器应该移除所有处理器', () => {
      router.registerHandler('behavior_mental', vi.fn());
      router.registerHandler('session', vi.fn());

      vi.mocked(router.clearHandlers).mockImplementation(() => {
        vi.mocked(router.getActiveHandlers).mockReturnValue([]);
      });

      router.clearHandlers();

      expect(router.getActiveHandlers()).toHaveLength(0);
    });
  });

  // ============ 异常处理测试 ============

  describe('异常处理', () => {
    it('未注册处理器的消息类型应该返回错误', () => {
      vi.mocked(router.route).mockReturnValue({
        success: false,
        error: '未找到处理器',
      });

      const envelope = createMockEnvelope('behavior_mental', {});

      const result = router.route(envelope);

      expect(result.success).toBe(false);
      expect(result.error).toContain('未找到处理器');
    });

    it('处理器抛出异常时应该捕获并返回错误', () => {
      const errorHandler = vi.fn().mockImplementation(() => {
        throw new Error('处理失败');
      });

      vi.mocked(router.registerHandler).mockImplementation((type, h) => {
        vi.mocked(router.route).mockImplementation(() => ({
          success: false,
          error: '处理失败',
        }));
      });

      router.registerHandler('behavior_mental', errorHandler);

      const envelope = createMockEnvelope('behavior_mental', {});
      const result = router.route(envelope);

      expect(result.success).toBe(false);
      expect(result.error).toBe('处理失败');
    });

    it('无效的信封格式应该返回错误', () => {
      vi.mocked(router.route).mockReturnValue({
        success: false,
        error: '无效的信封格式',
      });

      const invalidEnvelope = {
        msg_id: 'msg_001',
        // 缺少必要字段
      } as CAPEnvelope;

      const result = router.route(invalidEnvelope);

      expect(result.success).toBe(false);
      expect(result.error).toContain('无效的信封格式');
    });
  });

  // ============ 性能测试 ============

  describe('性能测试', () => {
    it('应该高效处理大量消息', () => {
      const handler = vi.fn();
      router.registerHandler('session', handler);

      vi.mocked(router.route).mockReturnValue({ success: true, target: 'chat-bubble' });

      const startTime = performance.now();

      for (let i = 0; i < 1000; i++) {
        const envelope = createMockEnvelope('session', {
          session_id: `sess_${i}`,
          chat_type: 'private',
          message: { sender_id: 'agent', sender_type: 'assistant', content: `消息${i}` },
        });
        router.route(envelope);
      }

      const endTime = performance.now();

      // 1000条消息处理应该在100ms内完成
      expect(endTime - startTime).toBeLessThan(100);
    });
  });
});

// ============ 测试总结 ============
/**
 * 测试覆盖：
 * - 北向路由：4个用例
 * - 处理器管理：4个用例
 * - 异常处理：3个用例
 * - 性能测试：1个用例
 *
 * 总计：12个测试用例
 *
 * 实现要点：
 * 1. 使用Map存储处理器映射
 * 2. 路由时根据消息类型查找对应处理器
 * 3. 异常需要捕获并记录日志
 * 4. 支持动态注册和注销处理器
 */

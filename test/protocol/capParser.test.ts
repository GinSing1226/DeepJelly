/**
 * CAP协议解析器测试
 *
 * 测试范围：
 * 1. 信封格式校验
 * 2. 消息类型解析
 * 3. 协议字段验证
 * 4. 异常处理
 *
 * @see docs/private_docs/Tech/3.1.协议总览.md
 * @see docs/private_docs/Tech/3.2.消息类型.md
 */

import { describe, it, expect, beforeEach } from 'vitest';
import type {
  CAPEnvelope,
  CAPMessageType,
  BehaviorMentalPayload,
  SessionPayload,
  NotificationPayload,
  StatusPayload,
} from '../types';

// 导入实际实现
import { CAPParser } from '../../src/utils/capParser';

// ============ 测试数据工厂 ============

/**
 * 创建有效的CAP信封
 * 遵循协议文档 docs/private_docs/Tech/3.1.协议总览.md
 */
function createValidEnvelope<T>(
  type: CAPMessageType,
  payload: T
): CAPEnvelope<T> {
  return {
    msg_id: `msg_${Date.now()}_${Math.random().toString(36).substring(7)}`,
    timestamp: Date.now(),
    type,
    sender: {
      id: 'agent_001',
      type: 'assistant',
    },
    receiver: {
      id: 'ui_core',
      type: 'assistant',
    },
    payload,
  };
}

/**
 * 创建有效的行为/心理负载
 */
function createValidBehaviorMentalPayload(): BehaviorMentalPayload {
  return {
    assistant_id: 'asst_001',
    behavior: {
      domain: 'internal',
      category: 'work',
      action_id: 'think',
      urgency: 5,
      intensity: 1.0,
      duration_ms: null,
    },
    mental: {
      emoji: '🤔',
      text: '思考中',
      duration_ms: 3000,
    },
  };
}

/**
 * 创建有效的会话负载
 */
function createValidSessionPayload(): SessionPayload {
  return {
    session_id: 'sess_001',
    chat_type: 'private',
    is_streaming: true,
    stream_id: 'str_10a29',
    is_finished: false,
    message: {
      msg_id: 'msg_001',
      sender_id: 'agent_001',
      sender_type: 'assistant',
      sender_name: '助手小明',
      content: '我正在帮你整理文档...',
      timestamp: Date.now(),
    },
  };
}

/**
 * 创建有效的通知负载
 */
function createValidNotificationPayload(): NotificationPayload {
  return {
    notification_type: 'new_message',
    app_id: 'openclaw',
    agent_id: 'agent_002',
    session_id: 'sess_002',
    title: '新消息',
    content: '助手小红发来了新消息',
  };
}

/**
 * 创建有效的状态负载
 */
function createValidStatusPayload(): StatusPayload {
  return {
    assistant_id: 'asst_001',
    emoji: '😴',
    text: '空闲中',
    duration_ms: null,
  };
}

// ============ 测试用例 ============

describe('CAP协议解析器', () => {
  let parser: CAPParser;

  beforeEach(() => {
    // 使用实际实现
    parser = new CAPParser();
  });

  // ============ 信封格式校验测试 ============

  describe('信封格式校验', () => {
    it('应该接受合法的信封格式', () => {
      // RED: 测试将失败，因为实现不存在
      const envelope = createValidEnvelope('behavior_mental', createValidBehaviorMentalPayload());
      const result = parser.validate(envelope);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('应该拒绝缺少msg_id的信封', () => {
      const invalidEnvelope = {
        timestamp: Date.now(),
        type: 'behavior_mental',
        sender: { app_id: 'openclaw' },
        receiver: { target_type: 'character' },
        payload: {},
      };

      const result = parser.validate(invalidEnvelope);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('缺少必填字段: msg_id');
    });

    it('应该拒绝缺少timestamp的信封', () => {
      const invalidEnvelope = {
        msg_id: 'msg_001',
        type: 'behavior_mental',
        sender: { app_id: 'openclaw' },
        receiver: { target_type: 'character' },
        payload: {},
      };

      const result = parser.validate(invalidEnvelope);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('缺少必填字段: timestamp');
    });

    it('应该拒绝缺少type的信封', () => {
      const invalidEnvelope = {
        msg_id: 'msg_001',
        timestamp: Date.now(),
        sender: { app_id: 'openclaw' },
        receiver: { target_type: 'character' },
        payload: {},
      };

      const result = parser.validate(invalidEnvelope);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('缺少必填字段: type');
    });

    it('应该拒绝无效的type值', () => {
      const invalidEnvelope = createValidEnvelope('invalid_type' as CAPMessageType, {});

      const result = parser.validate(invalidEnvelope);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('无效的消息类型'))).toBe(true);
    });

    it('应该拒绝timestamp不是数字的信封', () => {
      const invalidEnvelope = {
        ...createValidEnvelope('behavior_mental', {}),
        timestamp: 'not_a_number',
      };

      const result = parser.validate(invalidEnvelope);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('timestamp必须是数字');
    });

    it('应该拒绝缺少sender的信封', () => {
      const invalidEnvelope = {
        msg_id: 'msg_001',
        timestamp: Date.now(),
        type: 'behavior_mental',
        receiver: { target_type: 'character' },
        payload: {},
      };

      const result = parser.validate(invalidEnvelope);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('缺少必填字段: sender');
    });

    it('应该拒绝缺少receiver的信封', () => {
      const invalidEnvelope = {
        msg_id: 'msg_001',
        timestamp: Date.now(),
        type: 'behavior_mental',
        sender: { app_id: 'openclaw' },
        payload: {},
      };

      const result = parser.validate(invalidEnvelope);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('缺少必填字段: receiver');
    });

    it('应该拒绝缺少payload的信封', () => {
      const invalidEnvelope = {
        msg_id: 'msg_001',
        timestamp: Date.now(),
        type: 'behavior_mental',
        sender: { app_id: 'openclaw' },
        receiver: { target_type: 'character' },
      };

      const result = parser.validate(invalidEnvelope);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('缺少必填字段: payload');
    });
  });

  // ============ JSON解析测试 ============

  describe('JSON解析', () => {
    it('应该正确解析合法的JSON字符串', () => {
      const envelope = createValidEnvelope('behavior_mental', createValidBehaviorMentalPayload());
      const raw = JSON.stringify(envelope);

      const result = parser.parse(raw);

      expect(result).not.toBeInstanceOf(Error);
      expect((result as CAPEnvelope).msg_id).toBe(envelope.msg_id);
    });

    it('应该拒绝非法的JSON字符串', () => {
      const invalidJson = '{ not valid json }';

      const result = parser.parse(invalidJson);

      expect(result).toBeInstanceOf(Error);
      expect((result as Error).message).toContain('JSON解析失败');
    });

    it('应该拒绝空字符串', () => {
      const result = parser.parse('');

      expect(result).toBeInstanceOf(Error);
      expect((result as Error).message).toContain('JSON解析失败');
    });

    it('应该拒绝非对象类型的JSON', () => {
      const result = parser.parse('"just a string"');

      expect(result).toBeInstanceOf(Error);
      expect((result as Error).message).toContain('信封必须是对象');
    });

    it('应该拒绝JSON数组', () => {
      const result = parser.parse('[]');

      expect(result).toBeInstanceOf(Error);
      expect((result as Error).message).toContain('信封必须是对象');
    });
  });

  // ============ 消息类型解析测试 ============

  describe('消息类型解析', () => {
    it('应该正确获取behavior_mental类型', () => {
      const envelope = createValidEnvelope('behavior_mental', createValidBehaviorMentalPayload());

      expect(parser.getMessageType(envelope)).toBe('behavior_mental');
    });

    it('应该正确获取session类型', () => {
      const envelope = createValidEnvelope('session', createValidSessionPayload());

      expect(parser.getMessageType(envelope)).toBe('session');
    });

    it('应该正确获取notification类型', () => {
      const envelope = createValidEnvelope('notification', createValidNotificationPayload());

      expect(parser.getMessageType(envelope)).toBe('notification');
    });

    it('应该正确获取status类型', () => {
      const envelope = createValidEnvelope('status', createValidStatusPayload());

      expect(parser.getMessageType(envelope)).toBe('status');
    });
  });

  // ============ 行为/心理消息解析测试 ============

  describe('行为/心理消息解析', () => {
    it('应该正确解析行为指令', () => {
      const payload = createValidBehaviorMentalPayload();
      const envelope = createValidEnvelope('behavior_mental', payload);

      const result = parser.parseBehaviorMental(envelope);

      expect(result.assistant_id).toBe(payload.assistant_id);
      expect(result.behavior.domain).toBe('internal');
      expect(result.behavior.category).toBe('work');
      expect(result.behavior.action_id).toBe('think');
      expect(result.behavior.urgency).toBe(5);
      expect(result.behavior.intensity).toBe(1.0);
      expect(result.behavior.duration_ms).toBeNull();
    });

    it('应该正确解析心理状态', () => {
      const payload = createValidBehaviorMentalPayload();
      const envelope = createValidEnvelope('behavior_mental', payload);

      const result = parser.parseBehaviorMental(envelope);

      expect(result.mental).toBeDefined();
      expect(result.mental?.emoji).toBe('🤔');
      expect(result.mental?.text).toBe('思考中');
      expect(result.mental?.duration_ms).toBe(3000);
    });

    it('应该处理没有心理状态的消息', () => {
      const payload = { ...createValidBehaviorMentalPayload(), mental: undefined };
      const envelope = createValidEnvelope('behavior_mental', payload);

      const result = parser.parseBehaviorMental(envelope);

      expect(result.mental).toBeUndefined();
    });

    it('应该拒绝urgency超出范围的行为指令', () => {
      const payload = {
        ...createValidBehaviorMentalPayload(),
        behavior: { ...createValidBehaviorMentalPayload().behavior, urgency: 15 },
      };
      const envelope = createValidEnvelope('behavior_mental', payload);

      expect(() => parser.parseBehaviorMental(envelope)).toThrow('urgency必须在1-10之间');
    });

    it('应该拒绝intensity超出范围的行为指令', () => {
      const payload = {
        ...createValidBehaviorMentalPayload(),
        behavior: { ...createValidBehaviorMentalPayload().behavior, intensity: 1.5 },
      };
      const envelope = createValidEnvelope('behavior_mental', payload);

      expect(() => parser.parseBehaviorMental(envelope)).toThrow('intensity必须在0-1之间');
    });
  });

  // ============ 会话消息解析测试 ============

  describe('会话消息解析', () => {
    it('应该正确解析普通会话消息', () => {
      const payload = createValidSessionPayload();
      const envelope = createValidEnvelope('session', payload);

      const result = parser.parseSession(envelope);

      expect(result.session_id).toBe(payload.session_id);
      expect(result.chat_type).toBe('private');
      expect(result.message.content).toBe(payload.message.content);
    });

    it('应该正确解析流式消息', () => {
      const payload: SessionPayload = {
        session_id: 'sess_001',
        chat_type: 'private',
        is_streaming: true,
        stream_id: 'str_10a29',
        is_finished: false,
        delta: { content: '帮您整理' },
        message: { sender_id: 'agent_001', sender_type: 'assistant', content: '' },
      };
      const envelope = createValidEnvelope('session', payload);

      const result = parser.parseSession(envelope);

      expect(result.is_streaming).toBe(true);
      expect(result.stream_id).toBe('str_10a29');
      expect(result.is_finished).toBe(false);
      expect(result.delta?.content).toBe('帮您整理');
    });

    it('应该正确解析流式结束消息', () => {
      const payload: SessionPayload = {
        session_id: 'sess_001',
        chat_type: 'private',
        is_streaming: true,
        stream_id: 'str_10a29',
        is_finished: true,
        delta: { content: '。' },
        message: { sender_id: 'agent_001', sender_type: 'assistant', content: '' },
      };
      const envelope = createValidEnvelope('session', payload);

      const result = parser.parseSession(envelope);

      expect(result.is_finished).toBe(true);
    });

    it('应该拒绝无效的chat_type', () => {
      const payload = { ...createValidSessionPayload(), chat_type: 'invalid' as 'private' };
      const envelope = createValidEnvelope('session', payload);

      expect(() => parser.parseSession(envelope)).toThrow('无效的chat_type');
    });

    it('应该拒绝缺少session_id的消息', () => {
      const payload = { ...createValidSessionPayload(), session_id: '' };
      const envelope = createValidEnvelope('session', payload);

      expect(() => parser.parseSession(envelope)).toThrow('缺少session_id');
    });
  });

  // ============ 通知消息解析测试 ============

  describe('通知消息解析', () => {
    it('应该正确解析新消息通知', () => {
      const payload = createValidNotificationPayload();
      const envelope = createValidEnvelope('notification', payload);

      const result = parser.parseNotification(envelope);

      expect(result.notification_type).toBe('new_message');
      expect(result.app_id).toBe('openclaw');
      expect(result.session_id).toBe('sess_002');
      expect(result.title).toBe('新消息');
    });

    it('应该正确解析系统通知', () => {
      const payload: NotificationPayload = {
        notification_type: 'system',
        app_id: 'deepjelly',
        title: '系统更新',
        content: '有新版本可用',
      };
      const envelope = createValidEnvelope('notification', payload);

      const result = parser.parseNotification(envelope);

      expect(result.notification_type).toBe('system');
    });

    it('应该拒绝无效的notification_type', () => {
      const payload = { ...createValidNotificationPayload(), notification_type: 'invalid' as 'new_message' };
      const envelope = createValidEnvelope('notification', payload);

      expect(() => parser.parseNotification(envelope)).toThrow('无效的notification_type');
    });
  });

  // ============ 状态消息解析测试 ============

  describe('状态消息解析', () => {
    it('应该正确解析状态消息', () => {
      const payload = createValidStatusPayload();
      const envelope = createValidEnvelope('status', payload);

      const result = parser.parseStatus(envelope);

      expect(result.assistant_id).toBe('asst_001');
      expect(result.emoji).toBe('😴');
      expect(result.text).toBe('空闲中');
      expect(result.duration_ms).toBeNull();
    });

    it('应该正确解析带持续时间的状态消息', () => {
      const payload: StatusPayload = {
        assistant_id: 'asst_001',
        emoji: '🤔',
        text: '思考中',
        duration_ms: 5000,
      };
      const envelope = createValidEnvelope('status', payload);

      const result = parser.parseStatus(envelope);

      expect(result.duration_ms).toBe(5000);
    });

    it('应该拒绝缺少emoji的状态消息', () => {
      const payload = { ...createValidStatusPayload(), emoji: '' };
      const envelope = createValidEnvelope('status', payload);

      expect(() => parser.parseStatus(envelope)).toThrow('缺少emoji');
    });

    it('应该拒绝缺少text的状态消息', () => {
      const payload = { ...createValidStatusPayload(), text: '' };
      const envelope = createValidEnvelope('status', payload);

      expect(() => parser.parseStatus(envelope)).toThrow('缺少text');
    });
  });

  // ============ 边界情况测试 ============

  describe('边界情况', () => {
    it('应该处理空负载', () => {
      const envelope = createValidEnvelope('behavior_mental', null);

      const result = parser.validate(envelope);

      // 根据协议定义，空负载可能被视为无效
      expect(result.valid).toBe(false);
    });

    it('应该处理超大消息', () => {
      const largePayload = {
        ...createValidBehaviorMentalPayload(),
        behavior: {
          ...createValidBehaviorMentalPayload().behavior,
          // 创建一个超大的数据
          data: 'x'.repeat(1024 * 1024),
        },
      };
      const envelope = createValidEnvelope('behavior_mental', largePayload);
      const raw = JSON.stringify(envelope);

      // 应该能够处理，但可能有大小限制
      const result = parser.parse(raw);
      expect(result).toBeDefined();
    });

    it('应该处理Unicode字符', () => {
      const payload: StatusPayload = {
        assistant_id: 'asst_001',
        emoji: '😊',
        text: '欢迎使用DeepJelly！这是中文测试。日本語テスト。',
      };
      const envelope = createValidEnvelope('status', payload);

      const result = parser.parseStatus(envelope);

      expect(result.text).toContain('中文');
      expect(result.text).toContain('日本語');
    });

    it('应该处理特殊字符转义', () => {
      const payload: SessionPayload = {
        session_id: 'sess_001',
        chat_type: 'private',
        message: {
          sender_id: 'user_001',
          sender_type: 'user',
          content: '包含"引号"和\\反斜杠\n换行符',
        },
      };
      const envelope = createValidEnvelope('session', payload);
      const raw = JSON.stringify(envelope);

      const result = parser.parse(raw);
      expect((result as CAPEnvelope<SessionPayload>).payload.message.content).toContain('引号');
    });
  });
});

// ============ 测试总结 ============
/**
 * 测试覆盖：
 * - 信封格式校验：8个用例
 * - JSON解析：5个用例
 * - 消息类型解析：4个用例
 * - 行为/心理消息解析：5个用例
 * - 会话消息解析：5个用例
 * - 通知消息解析：3个用例
 * - 状态消息解析：4个用例
 * - 边界情况：4个用例
 *
 * 总计：38个测试用例
 *
 * 下一步：
 * 1. 在 src/utils/capParser.ts 中实现 CAPParser 接口
 * 2. 运行测试，确保所有测试通过（GREEN阶段）
 * 3. 重构代码，优化性能
 */

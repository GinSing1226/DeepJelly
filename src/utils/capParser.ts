/**
 * CAP 协议解析器
 *
 * 提供CAP协议消息的验证和解析功能。
 * 遵循 TDD 测试契约 test/protocol/capParser.test.ts
 *
 * @module utils/capParser
 * @see docs/private_docs/Tech/3.1.协议总览.md
 * @see docs/private_docs/Tech/3.2.消息类型.md
 */

import type {
  CAPMessage,
  CAPEnvelope,
  CAPMessageType,
  CAPParticipantType,
  CAPSourceApp,
  BehaviorMentalPayload,
  SessionPayload,
  NotificationPayload,
  StatusPayload,
  EventPayload,
  TypedCAPMessage,
} from '@/types/cap';

// ============ 有效的枚举值 ============

const VALID_MESSAGE_TYPES: CAPMessageType[] = [
  'behavior_mental',
  'session',
  'notification',
  'event',
  'status',
];

const VALID_PARTICIPANT_TYPES: CAPParticipantType[] = [
  'user',
  'assistant',
  'visitor',
];

const VALID_SOURCE_APPS: CAPSourceApp[] = [
  'openclaw',
  'deepjelly',
];

const VALID_BEHAVIOR_DOMAINS = ['internal', 'social'];
const VALID_BEHAVIOR_CATEGORIES = ['base', 'work', 'result', 'emotion', 'physics'];
const VALID_CHAT_TYPES = ['private', 'group'];

// ============ 基础验证函数 ============

/**
 * 验证信封格式是否合法
 * @param envelope 信封对象
 * @returns 验证结果
 */
export function validateMessageEnvelope(
  envelope: unknown
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // 检查 null/undefined
  if (envelope === null || envelope === undefined) {
    errors.push('信封不能为空');
    return { valid: false, errors };
  }

  // 检查是否为对象
  if (typeof envelope !== 'object' || Array.isArray(envelope)) {
    errors.push('信封必须是对象');
    return { valid: false, errors };
  }

  const msg = envelope as Record<string, unknown>;

  // 检查必填字段
  const requiredFields = ['msg_id', 'timestamp', 'type', 'sender', 'receiver', 'payload'];
  for (const field of requiredFields) {
    if (!(field in msg)) {
      errors.push(`缺少必填字段: ${field}`);
    }
  }

  // 如果缺少必填字段，直接返回
  if (errors.length > 0) {
    return { valid: false, errors };
  }

  // 验证 msg_id
  if (typeof msg.msg_id !== 'string' || msg.msg_id.trim() === '') {
    errors.push('msg_id必须是非空字符串');
  }

  // 验证 timestamp
  if (typeof msg.timestamp !== 'number') {
    errors.push('timestamp必须是数字');
  }

  // 验证 type
  if (typeof msg.type !== 'string' || !VALID_MESSAGE_TYPES.includes(msg.type as CAPMessageType)) {
    errors.push(`无效的消息类型: ${msg.type}`);
  }

  // 验证 sender
  if (typeof msg.sender !== 'object' || msg.sender === null) {
    errors.push('sender必须是对象');
  } else {
    const sender = msg.sender as Record<string, unknown>;
    if (typeof sender.id !== 'string') {
      errors.push('sender.id必须是字符串');
    }
    if (typeof sender.type !== 'string' || !VALID_PARTICIPANT_TYPES.includes(sender.type as CAPParticipantType)) {
      errors.push(`无效的sender.type: ${sender.type}`);
    }
    if (typeof sender.source_app !== 'string' || !VALID_SOURCE_APPS.includes(sender.source_app as CAPSourceApp)) {
      errors.push(`无效的sender.source_app: ${sender.source_app}`);
    }
  }

  // 验证 receiver
  if (typeof msg.receiver !== 'object' || msg.receiver === null) {
    errors.push('receiver必须是对象');
  } else {
    const receiver = msg.receiver as Record<string, unknown>;
    if (typeof receiver.id !== 'string') {
      errors.push('receiver.id必须是字符串');
    }
    if (typeof receiver.type !== 'string' || !VALID_PARTICIPANT_TYPES.includes(receiver.type as CAPParticipantType)) {
      errors.push(`无效的receiver.type: ${receiver.type}`);
    }
    if (typeof receiver.source_app !== 'string' || !VALID_SOURCE_APPS.includes(receiver.source_app as CAPSourceApp)) {
      errors.push(`无效的receiver.source_app: ${receiver.source_app}`);
    }
  }

  // 验证 payload 不能为 null 或 undefined
  if (msg.payload === null || msg.payload === undefined) {
    errors.push('payload不能为空');
  }

  return { valid: errors.length === 0, errors };
}

// ============ CAPParser 类（符合测试接口）============

/**
 * CAP协议解析器
 */
export class CAPParser {
  /**
   * 解析JSON字符串为CAP信封
   * @param raw 原始JSON字符串
   * @returns 解析后的信封或错误
   */
  parse(raw: string): CAPEnvelope | Error {
    try {
      if (!raw || raw.trim() === '') {
        return new Error('JSON解析失败: 空字符串');
      }

      const parsed = JSON.parse(raw);

      if (typeof parsed !== 'object' || Array.isArray(parsed)) {
        return new Error('信封必须是对象');
      }

      const result = this.validate(parsed);
      if (!result.valid) {
        return new Error(`验证失败: ${result.errors.join(', ')}`);
      }

      return parsed as CAPEnvelope;
    } catch (e) {
      return new Error(`JSON解析失败: ${(e as Error).message}`);
    }
  }

  /**
   * 验证信封格式是否合法
   * @param envelope 信封对象
   * @returns 验证结果
   */
  validate(envelope: unknown): { valid: boolean; errors: string[] } {
    return validateMessageEnvelope(envelope);
  }

  /**
   * 获取消息类型
   * @param envelope 信封对象
   * @returns 消息类型
   */
  getMessageType(envelope: CAPEnvelope): CAPMessageType {
    return envelope.type;
  }

  /**
   * 解析行为/心理消息
   * @param envelope 信封对象
   * @returns 行为/心理负载
   */
  parseBehaviorMental(envelope: CAPEnvelope): BehaviorMentalPayload {
    const payload = envelope.payload as BehaviorMentalPayload;

    // 验证 behavior 字段
    if (payload.behavior) {
      const { urgency, intensity } = payload.behavior;
      if (urgency !== undefined && (urgency < 1 || urgency > 10)) {
        throw new Error('urgency必须在1-10之间');
      }
      if (intensity !== undefined && (intensity < 0 || intensity > 1)) {
        throw new Error('intensity必须在0-1之间');
      }
    }

    return payload;
  }

  /**
   * 解析会话消息
   * @param envelope 信封对象
   * @returns 会话负载
   */
  parseSession(envelope: CAPEnvelope): SessionPayload {
    const payload = envelope.payload as SessionPayload;

    if (!payload.session_id) {
      throw new Error('缺少session_id');
    }

    const validChatTypes = ['private', 'group'];
    if (!validChatTypes.includes(payload.chat_type)) {
      throw new Error(`无效的chat_type: ${payload.chat_type}`);
    }

    return payload;
  }

  /**
   * 解析通知消息
   * @param envelope 信封对象
   * @returns 通知负载
   */
  parseNotification(envelope: CAPEnvelope): NotificationPayload {
    const payload = envelope.payload as NotificationPayload;

    const validNotificationTypes = ['new_message', 'assistant_join', 'system', 'error'];
    if (!validNotificationTypes.includes(payload.notification_type as string)) {
      throw new Error(`无效的notification_type: ${payload.notification_type}`);
    }

    return payload;
  }

  /**
   * 解析状态消息
   * @param envelope 信封对象
   * @returns 状态负载
   */
  parseStatus(envelope: CAPEnvelope): StatusPayload {
    const payload = envelope.payload as StatusPayload;

    if (!payload.emoji) {
      throw new Error('缺少emoji');
    }
    if (!payload.text) {
      throw new Error('缺少text');
    }

    return payload;
  }
}

/**
 * 创建CAP解析器实例
 */
export function createCAPParser(): CAPParser {
  return new CAPParser();
}

// ============ 保留原有函数（向后兼容）============

/**
 * 解析并验证CAP消息
 * @param raw 原始输入
 * @returns 验证后的CAPMessage或null
 */
export function parseCAPMessage(raw: unknown): CAPMessage | null {
  const result = validateMessageEnvelope(raw);
  if (!result.valid) {
    return null;
  }
  return raw as CAPMessage;
}

/**
 * 类型守卫：behavior_mental消息
 */
export function isBehaviorMentalMessage(
  msg: CAPMessage | unknown
): msg is TypedCAPMessage<'behavior_mental'> {
  if (!msg || typeof msg !== 'object' || !('type' in msg)) {
    return false;
  }
  return (msg as CAPMessage).type === 'behavior_mental';
}

/**
 * 类型守卫：session消息
 */
export function isSessionMessage(
  msg: CAPMessage | unknown
): msg is TypedCAPMessage<'session'> {
  if (!msg || typeof msg !== 'object' || !('type' in msg)) {
    return false;
  }
  return (msg as CAPMessage).type === 'session';
}

/**
 * 类型守卫：notification消息
 */
export function isNotificationMessage(
  msg: CAPMessage | unknown
): msg is TypedCAPMessage<'notification'> {
  if (!msg || typeof msg !== 'object' || !('type' in msg)) {
    return false;
  }
  return (msg as CAPMessage).type === 'notification';
}

/**
 * 类型守卫：event消息
 */
export function isEventMessage(
  msg: CAPMessage | unknown
): msg is TypedCAPMessage<'event'> {
  if (!msg || typeof msg !== 'object' || !('type' in msg)) {
    return false;
  }
  return (msg as CAPMessage).type === 'event';
}

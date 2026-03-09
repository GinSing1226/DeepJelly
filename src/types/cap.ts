/**
 * CAP Protocol Type Definitions
 *
 * CAP (Cyber-Avatar Protocol) 是DeepJelly内部使用的消息协议。
 * 遵循协议文档 docs/private_docs/Tech/3.1.协议总览.md
 *
 * @module types/cap
 * @see docs/private_docs/Tech/3.1.协议总览.md
 * @see docs/private_docs/Tech/3.2.消息类型.md
 */

/**
 * CAP角色类型
 */
export type CAPRole = 'user' | 'assistant' | 'visitor';

/**
 * CAP来源应用类型
 */
export type CAPSourceApp = 'openclaw' | 'deepjelly';

/**
 * CAP消息类型枚举
 */
export type CAPMessageType = 'behavior_mental' | 'session' | 'notification' | 'event' | 'status';

/**
 * CAP协议路由信息
 */
export interface CAPRouting {
  /** 会话密钥，格式: agent:{assistantId}:{sessionId} */
  sessionKey?: string;
}

/**
 * CAP协议参与者信息
 * 遵循协议文档 3.1.协议总览.md
 */
export interface CAPParticipant {
  /** 实体ID（agentId/ui_core等） */
  id: string;
  /** 参与者类型：user/assistant/visitor */
  type: CAPParticipantType;
  /** 来源应用：openclaw/deepjelly */
  source_app: CAPSourceApp;
  /** 路由信息（可选） */
  routing?: CAPRouting;
}

/**
 * CAP参与者类型
 */
export type CAPParticipantType = 'user' | 'assistant' | 'visitor';

/**
 * 全局CAP消息信封
 * 所有CAP消息共享此通用结构
 * 遵循协议文档 3.1.协议总览.md
 */
export interface CAPMessage<T = unknown> {
  /** 消息唯一ID */
  msg_id: string;
  /** 消息时间戳（秒） */
  timestamp: number;
  /** 消息类型 */
  type: CAPMessageType;
  /** 发送者标识 */
  sender: CAPParticipant;
  /** 接收者标识 */
  receiver: CAPParticipant;
  /** 业务数据负载 */
  payload: T;
}

/**
 * CAP信封类型别名（与test/types保持一致）
 */
export type CAPEnvelope<T = unknown> = CAPMessage<T>;

/**
 * Behavior domain types
 */
export type BehaviorDomain = 'internal' | 'social';

/**
 * Behavior category types
 */
export type BehaviorCategory = 'base' | 'work' | 'result' | 'emotion' | 'physics';

/**
 * Behavior object for behavior_mental messages
 */
export interface Behavior {
  domain: BehaviorDomain;
  category: BehaviorCategory;
  action_id: string;
  urgency: number; // 1-10, higher priority interrupts current animation
  intensity: number; // 0.0-1.0, animation intensity
  duration_ms: number | null; // null means loop
}

/**
 * Mental state object for behavior_mental messages
 */
export interface Mental {
  show_bubble: boolean;
  thought_text: string;
  emotion_icon: string;
}

/**
 * Payload for behavior_mental message type
 * Controls character animation and mental state
 */
export interface BehaviorMentalPayload {
  behavior: Behavior;
  mental: Mental;
}

/**
 * Chat type for session messages
 */
export type ChatType = 'private' | 'group';

/**
 * Display mode for session messages
 */
export type DisplayMode = 'bubble_only' | 'panel_only' | 'bubble_and_panel';

/**
 * Message role for session messages
 */
export type MessageRole = 'user' | 'assistant' | 'system';

/**
 * Message type for session messages
 */
export type MessageType = 'text' | 'image' | 'audio' | 'file';

/**
 * Message content in session messages
 */
export interface SessionMessage {
  role: MessageRole;
  type: MessageType;
  content: string;
}

/**
 * App parameters for session messages
 */
export interface AppParams {
  hookType?: 'agent_start' | 'agent_end' | 'message_start' | 'message_end';
}

/**
 * Payload for session message type
 * Used for chat conversations
 */
export interface SessionPayload {
  session_id: string;
  chat_type: ChatType;
  display_mode: DisplayMode;
  is_streaming: boolean;
  message: SessionMessage;
  app_params?: AppParams;
}

/**
 * Notification urgency levels
 */
export type NotificationUrgency = 'low' | 'medium' | 'high';

/**
 * Notification type
 */
export type NotificationType = 'info' | 'success' | 'warning' | 'error';

/**
 * Notification content
 */
export interface NotificationContent {
  title: string;
  summary: string;
}

/**
 * Notification action configuration
 */
export interface NotificationAction {
  on_click_command: string;
  target_session_id?: string;
}

/**
 * Payload for notification message type
 * Used for tray notifications
 */
export interface NotificationPayload {
  urgency: NotificationUrgency;
  type: NotificationType;
  content: NotificationContent;
  action: NotificationAction;
}

/**
 * Event type for event messages (future use)
 */
export interface EventPayload {
  event_type: string;
  event_name: string;
  context: Record<string, unknown>;
}

/**
 * Type-guarded CAP message with typed payload
 */
export interface TypedCAPMessage<T extends CAPMessageType> {
  msg_id: string;
  timestamp: number;
  type: T;
  sender: CAPParticipant;
  receiver: CAPParticipant;
  payload: T extends 'behavior_mental' ? BehaviorMentalPayload :
           T extends 'session' ? SessionPayload :
           T extends 'notification' ? NotificationPayload :
           T extends 'event' ? EventPayload :
           never;
}

/**
 * Union type of all typed CAP messages
 */
export type AnyTypedCAPMessage =
  | TypedCAPMessage<'behavior_mental'>
  | TypedCAPMessage<'session'>
  | TypedCAPMessage<'notification'>
  | TypedCAPMessage<'event'>;

/**
 * Tauri event name for CAP messages
 */
export const CAP_EVENT_NAME = 'cap:message';

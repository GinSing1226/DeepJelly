/**
 * Application Configuration Types
 *
 * Types for AI app binding and onboarding flow
 * @module types/appConfig
 */

/**
 * AI应用适配器类型
 */
export type AIAppType = 'openclaw' | 'claude' | 'chatgpt';

/**
 * AI应用集成配置
 * 代表一个 AI 应用的连接配置（如某个 OpenClaw 实例）
 */
export interface AppIntegration {
  /** DeepJelly 内部实例 ID (16 chars, 随机字符串) */
  id: string;
  /** 给 AI 应用的身份标识 (16 chars, 随机字符串) */
  applicationId: string;
  /** AI应用提供商标识 */
  provider: AIAppType;
  /** 用户自定义名称 */
  name: string;
  /** 应用描述 */
  description?: string;
  /** WebSocket 地址 */
  endpoint: string;
  /** 认证令牌（如需要） */
  authToken?: string;
  /** 绑定的助手ID列表 */
  assistant?: string[];
  /** 是否启用 */
  enabled?: boolean;
  /** 绑定时间戳 */
  createdAt?: number;
}

/**
 * AI应用集成参数
 * 用于存储与各个AI应用绑定的具体参数
 */
export interface AssistantIntegration {
  /** AI应用提供商标识 */
  provider: string;  // "openclaw", "claude-api", etc.
  /** 集成参数（动态结构，不同provider有不同参数） */
  params: Record<string, any>;
  /** 是否启用 */
  enabled?: boolean;
  /** 绑定时间戳 */
  createdAt?: number;
}

/**
 * OpenClaw 集成参数类型定义
 */
export interface OpenClawIntegrationParams {
  /** DeepJelly 应用ID（用于区分多个OpenClaw实例） */
  applicationId: string;
  /** OpenClaw Agent ID */
  agentId: string;
  /** Session Keys（支持多个会话，MVP阶段为单选） */
  sessionKeys?: string[];
}

/**
 * 绑定的助手信息
 */
export interface BoundAssistant {
  /** DeepJelly 助手 ID (16 chars, 随机字符串) */
  id: string;
  /** 助手名称 */
  name: string;
  /** 助手描述 */
  description?: string;
  /** AI应用集成参数列表（未来可扩展多个AI应用） */
  integrations: AssistantIntegration[];
}

/**
 * 引导步骤
 */
export type OnboardingStep =
  | 'welcome'           // 欢迎页
  | 'select_app'        // 选择AI应用
  | 'show_prompt'       // 显示提示词
  | 'input_endpoint'    // 输入IP地址
  | 'binding_confirm'   // 绑定确认
  | 'complete';         // 完成

/**
 * 绑定的应用配置
 */
export interface BoundApp {
  /** DeepJelly 应用实例 ID (16 chars, 内部标识) */
  applicationId: string;
  /** 应用类型 */
  appType: AIAppType;
  /** WebSocket地址 */
  endpoint: string;
  /** 认证令牌（可选） */
  authToken?: string;
  /** 绑定的助手ID */
  assistantId: string;
  /** 助手名称 */
  assistantName: string;
  /** OpenClaw Agent ID */
  agentId: string;
  /** Session Key */
  sessionKey?: string;
}

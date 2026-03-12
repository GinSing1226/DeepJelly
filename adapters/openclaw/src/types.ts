/**
 * DeepJelly OpenClaw Plugin - Type Definitions
 *
 * This file defines all types for the plugin, including:
 * - CAP (Character Animation Protocol) message types
 * - BrainAdapter interface types
 * - Plugin configuration types
 * - Agent tool parameter types
 */

// ============================================================================
// Configuration Types
// ============================================================================

export interface DeepJellyConfig {
  enabled: boolean;
  serverPort: number;
  serverHost: string;
  autoStart: boolean;
  characterId?: string;
  appearanceId?: string;
  animationMappings?: AnimationMappings;
  /**
   * DeepJelly application ID
   * 用于标识发送方应用
   */
  applicationId?: string;
  /**
   * Account mappings for session routing
   * Maps session keys to assistant and character IDs
   */
  accounts?: Record<string, AccountMapping>;
  /**
   * Gateway authentication token
   * 客户端连接时需要携带此 token 进行认证
   * 从 OpenClaw 的 gateway.token 配置中读取
   */
  gatewayToken?: string;
  /**
   * Agents list from OpenClow config
   * 从 OpenClaw 的 agents.list 配置中读取
   */
  gatewayPort?: number;
  agents?: any[];
  /**
   * Path to OpenClaw CLI executable
   * If not specified, will try to find 'openclaw' in PATH
   */
  openclawPath?: string;
}

/**
 * Account mapping for a session key
 */
export interface AccountMapping {
  /** Assistant ID in DeepJelly */
  assistantId: string;
  /** Character ID for message routing */
  characterId: string;
}

export interface AnimationMappings {
  [state: string]: AnimationMapping;
}

export interface AnimationMapping {
  animation_id: string;
  urgency?: number;
  intensity?: number;
  show_bubble?: boolean;
  emotion_icon?: string;
  thought_text?: string;
}

// ============================================================================
// CAP Protocol Types
// ============================================================================

export interface CAPMessage {
  msg_id: string;
  timestamp: number;
  type: CAPMessageType;
  sender: CAPParticipant;
  receiver: CAPParticipant;
  payload: any;
}

export type CAPMessageType =
  | "behavior_mental"
  | "session"
  | "notification"
  | "event";

export type CAPSourceApp = "openclaw" | "deepjelly";

export interface CAPParticipant {
  id: string;
  type: "user" | "assistant" | "visitor";
  source_app: CAPSourceApp;
  /** 路由参数 - 不同 AI 应用使用不同参数进行路由 */
  routing?: {
    /** OpenClaw 的路由参数：sessionKey */
    sessionKey?: string;
    /** 其他 AI 应用的路由参数可在此扩展 */
    [key: string]: any;
  };
}

// behavior_mental payload
export interface BehaviorMentalPayload {
  behavior: {
    domain: "internal" | "social";
    category: "base" | "work" | "result" | "emotion" | "physics";
    action_id: string;
    urgency: number; // 1-10
    intensity: number; // 0-1
    duration_ms: number | null;
  };
  mental: {
    show_bubble: boolean;
    thought_text: string;
    emotion_icon: string;
  };
  /** AI 应用特定的业务参数 */
  app_params?: {
    [key: string]: any;
  };
}

// session payload
export interface SessionPayload {
  session_id: string;
  chat_type: "private" | "group";
  display_mode: "bubble_only" | "panel_only" | "bubble_and_panel";
  is_streaming: boolean;
  message: {
    role: "user" | "assistant" | "system";
    type: "text" | "image" | "file";
    content: string;
  };
  /** AI 应用特定的业务参数 */
  app_params?: {
    [key: string]: any;
  };
}

// notification payload
export interface NotificationPayload {
  urgency: "low" | "medium" | "high";
  type: "info" | "success" | "warning" | "error";
  content: {
    title: string;
    summary: string;
  };
  action?: {
    on_click_command: string;
    target_session_id?: string;
  };
}

// ============================================================================
// BrainAdapter Interface Types (JSON-RPC 2.0)
// ============================================================================

export interface JSONRPCRequest {
  jsonrpc: "2.0";
  id: string | number;
  method: string;
  params?: any;
}

export interface JSONRPCResponse {
  jsonrpc: "2.0";
  id: string | number;
  result?: any;
  error?: JSONRPCError;
}

export interface JSONRPCError {
  code: number;
  message: string;
  data?: any;
}

export interface Assistant {
  id: string;
  name: string;
  description?: string;
  status: "idle" | "thinking" | "working";
  model?: string;
  avatar?: string;
  created_at?: number;
  sessions_count?: number;
}

export interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
  metadata?: {
    model?: string;
    usage?: {
      input_tokens: number;
      output_tokens: number;
    };
  };
}

export interface SessionState {
  session_id: string;
  status: "idle" | "thinking" | "responding" | "tool_executing" | "error";
  current_action?: string;
  tool_execution?: {
    tool_name: string;
    status: string;
    progress?: number;
  };
}

// ============================================================================
// Agent Tool Types
// ============================================================================

export interface SendMessageParams {
  content: string;
  session_id?: string;
  display_mode?: "bubble_only" | "panel_only" | "bubble_and_panel";
  chat_type?: "private" | "group";
}

export interface PlayAnimationParams {
  animation_id: string;
  domain?: "internal" | "social";
  category?: "base" | "work" | "result" | "emotion" | "physics";
  urgency?: number;
  intensity?: number;
  loop?: boolean;
}

export interface ShowEmotionParams {
  emotion_icon: string;
  thought_text?: string;
  duration_ms?: number;
  show_bubble?: boolean;
}

export interface SetAppearanceParams {
  character_id: string;
  appearance_id?: string;
}

export interface ShowNotificationParams {
  title: string;
  content: string;
  urgency?: "low" | "medium" | "high";
  type?: "info" | "success" | "warning" | "error";
}

// ============================================================================
// Server Types
// ============================================================================

export interface ConnectedClient {
  id: string;
  ws: any; // WebSocket
  connectedAt: number;
  lastPing: number;
}

export interface ServerStatus {
  running: boolean;
  port: number;
  host: string;
  connected_clients: number;
  clients: ConnectedClientInfo[];
}

export interface ConnectedClientInfo {
  id: string;
  connected_at: number;
  connected_duration: string;
}

// ============================================================================
// Utility Types
// ============================================================================

export type CAPEvent = CAPMessage;
export type AnimationRequest = PlayAnimationParams & {
  show_bubble?: boolean;
  thought_text?: string;
  emotion_icon?: string;
};
export type NotificationRequest = ShowNotificationParams;

// ============================================================================
// OpenClaw Plugin API Types (用于双向通信)
// ============================================================================

/**
 * OpenClaw Channel Plugin API
 * 参考 feishu-china 插件的实现
 */
export interface OpenClawPluginAPI {
  registerChannel: (opts: { plugin: unknown }) => void;
  registerTool?: (tool: unknown, options?: { optional?: boolean }) => void;
  registerGatewayMethod?: (name: string, handler: unknown) => void;
  registerCli?: (
    handler: (ctx: { program: unknown; config?: unknown }) => void | Promise<void>,
    opts?: { commands?: string[] }
  ) => void;
  registerService?: (service: unknown) => void;
  logger?: {
    info?: (...args: unknown[]) => void;
    warn?: (...args: unknown[]) => void;
    error?: (...args: unknown[]) => void;
    debug?: (...args: unknown[]) => void;
  };
  runtime?: OpenClawRuntime;
  config?: any;
}

/**
 * OpenClaw Runtime - 包含核心 API
 * 参考 feishu-china 的 core.channel.reply 接口
 */
export interface OpenClawRuntime {
  channel?: {
    routing?: {
      /**
       * 解析 Agent 路由
       * 返回 sessionKey 和 agentId
       */
      resolveAgentRoute?: (params: {
        cfg?: any;
        channel: string;
        peer: {
          id: string;
          kind: "dm" | "group" | "direct" | "channel";
        };
      }) => {
        sessionKey: string;
        accountId: string;
        agentId: string;
      };
    };
    reply?: {
      /**
       * 从配置分发回复（带缓冲）
       * 这是飞书插件使用的主要分发方式
       */
      dispatchReplyWithBufferedBlockDispatcher?: (opts: {
        ctx: InboundContext;
        cfg?: any;
        dispatcherOptions?: {
          deliver?: (payload: DeliverPayload, info?: DeliverInfo) => Promise<boolean>;
        };
      }) => Promise<any>;

      /**
       * 从配置分发回复
       */
      dispatchReplyFromConfig?: (opts: {
        ctx: InboundContext;
        cfg?: any;
        dispatcherOptions?: {
          deliver?: (payload: DeliverPayload, info?: DeliverInfo) => Promise<boolean>;
        };
      }) => Promise<any>;

      /**
       * 创建回复分发器
       */
      createReplyDispatcher?: () => any;
      createReplyDispatcherWithTyping?: () => any;

      /**
       * 最终确定入站上下文
       */
      finalizeInboundContext?: (ctx: InboundContext) => InboundContext;
    };
    text?: {
      chunkTextWithMode?: (text: string, limit: number, mode: string) => string[];
      resolveTextChunkLimit?: (params: { cfg?: any; channel: string; defaultLimit: number }) => number;
      resolveChunkMode?: (cfg: any, channel: string) => string;
    };
  };
}

/**
 * DeepJelly 入站消息上下文
 * 对应飞书的 InboundContext 结构
 */
export interface InboundContext {
  /** 消息内容 */
  Body: string;
  /** 原始消息内容 */
  RawBody: string;
  /** 命令体（处理后的） */
  CommandBody: string;
  /** 发送给 Agent 的内容 */
  BodyForAgent?: string;
  /** 发送给命令的内容 */
  BodyForCommands?: string;
  /** 发送者 */
  From: string;
  /** 接收者 */
  To: string;
  /** 会话密钥 */
  SessionKey: string;
  /** 账户 ID */
  AccountId: string;
  /** 聊天类型 */
  ChatType: "direct" | "group";
  /** 群组主题 */
  GroupSubject?: string;
  /** 发送者名称 */
  SenderName?: string;
  /** 发送者 ID */
  SenderId: string;
  /** 提供商 */
  Provider: "deepjelly";
  /** 消息 ID */
  MessageSid: string;
  /** 时间戳 */
  Timestamp: number;
  /** 是否被提及 */
  WasMentioned: boolean;
  /** 命令是否授权 */
  CommandAuthorized: boolean;
  /** 来源渠道 */
  OriginatingChannel: "deepjelly";
  /** 原始目标 */
  OriginatingTo: string;
  /** 消息类型 */
  ContentType?: "text" | "image" | "file";
}

/**
 * 分发载荷
 */
export interface DeliverPayload {
  /** 文本内容 */
  text?: string;
  /** 媒体 URL */
  mediaUrl?: string;
  /** 多个媒体 URL */
  mediaUrls?: string[];
}

/**
 * 分发信息
 */
export interface DeliverInfo {
  /** 类型 */
  kind?: "final" | "intermediate" | "tool";
}

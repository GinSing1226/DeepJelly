/**
 * MessageGateway - CAP 消息网关
 *
 * Meta-Name: CAP Message Gateway
 * Meta-Description: 大脑层消息网关，负责接收 Tauri 事件并使用 MessageRouter 路由到正确的角色
 *
 * 职责：
 * 1. 监听 Tauri 后端发送的 CAP 消息事件
 * 2. 使用 MessageRouter 进行路由决策
 * 3. 将消息分发到按角色隔离的 Store
 * 4. 处理动画队列、状态气泡、会话队列的分发
 *
 * @module logic/gateway/MessageGateway
 */

import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { parseCAPMessage } from '@/utils/capParser';
import { resolveEmojiSync } from '@/utils/emojiResolver';
import { CAP_EVENT_NAME, type AnyTypedCAPMessage } from '@/types/cap';
import {
  MessageRouter,
  type BindingStore,
  type RoutingDecision,
} from '@/logic/router/MessageRouter';
// NEW: Character-isolated stores (routed by MessageGateway)
import {
  animationQueueStore,
  sessionQueueStore,
  statusBubbleStore,
} from '@/stores/characterStores';

/**
 * 消息网关配置
 */
export interface GatewayConfig {
  /** 是否自动启动 */
  autoStart?: boolean;
  /** 消息处理前的回调 */
  onBeforeRoute?: (message: AnyTypedCAPMessage) => void;
  /** 路由后的回调 */
  onAfterRoute?: (message: AnyTypedCAPMessage, decision: RoutingDecision) => void;
  /** 错误回调 */
  onError?: (error: Error, rawMessage: unknown) => void;
}

/**
 * 消息网关状态
 */
export interface GatewayState {
  isRunning: boolean;
  messageCount: number;
  errorCount: number;
  lastMessageTime?: number;
}

/**
 * CAP 消息网关
 *
 * 单例模式，整个应用只有一个网关实例
 */
export class MessageGateway {
  private router: MessageRouter;
  private config: GatewayConfig;
  private state: GatewayState = {
    isRunning: false,
    messageCount: 0,
    errorCount: 0,
  };
  private unlisten?: UnlistenFn;

  constructor(router: MessageRouter, config: GatewayConfig = {}) {
    this.router = router;
    this.config = config;
  }

  /**
   * 启动网关，开始监听 CAP 消息
   */
  async start(): Promise<void> {
    if (this.state.isRunning) {
      console.warn('[MessageGateway] Already running');
      return;
    }
    try {
      this.unlisten = await listen(CAP_EVENT_NAME, (event) => {
        this.handleRawMessage(event.payload);
      });

      this.state.isRunning = true;
    } catch (error) {
      console.error('[MessageGateway] Failed to start:', error);
      throw error;
    }
  }

  /**
   * 停止网关
   */
  stop(): void {
    if (!this.state.isRunning) {
      return;
    }
    this.unlisten?.();
    this.unlisten = undefined;
    this.state.isRunning = false;
  }

  /**
   * 获取当前状态
   */
  getState(): GatewayState {
    return { ...this.state };
  }

  /**
   * 处理原始消息
   */
  private handleRawMessage(rawMessage: unknown): void {
    // 1. 解析消息
    const message = parseCAPMessage(rawMessage);
    if (!message) {
      console.error('[MessageGateway] Failed to parse message:', rawMessage);
      this.state.errorCount++;
      this.config.onError?.(new Error('Failed to parse CAP message'), rawMessage);
      return;
    }
    // 2. 预处理回调
    this.config.onBeforeRoute?.(message as AnyTypedCAPMessage);

    // 3. 路由消息
    const decision = this.router.route(message as AnyTypedCAPMessage);

    // 4. 路由后回调
    this.config.onAfterRoute?.(message as AnyTypedCAPMessage, decision);

    // 5. 根据决策处理消息
    if (decision.action === 'deliver' && decision.target) {
      // Cast to AnyTypedCAPMessage since we've validated the message type
      this.dispatchToCharacter(message as AnyTypedCAPMessage, decision.target);
    } else if (decision.action === 'drop') {
    }

    // 6. 更新统计
    this.state.messageCount++;
    this.state.lastMessageTime = Date.now();
  }

  /**
   * 分发消息到指定角色
   */
  private dispatchToCharacter(
    message: AnyTypedCAPMessage,
    target: RoutingDecision['target'] & {}
  ): void {
    const { characterId } = target;
    // 根据消息类型分发到不同的 Store
    switch (message.type) {
      case 'behavior_mental':
        this.dispatchBehaviorMental(characterId, message);
        break;

      case 'session':
        this.dispatchSession(characterId, message);
        break;

      case 'notification':
        this.dispatchNotification(characterId, message);
        break;

      case 'event':
        this.dispatchEvent(characterId, message);
        break;

      default:
        // TypeScript knows this is unreachable, but we keep it for runtime safety
        console.warn('[MessageGateway] Unknown message type:', (message as any).type);
    }
  }

  /**
   * 分发 behavior_mental 消息
   */
  private dispatchBehaviorMental(
    characterId: string,
    message: AnyTypedCAPMessage & { type: 'behavior_mental' }
  ): void {
    const { behavior, mental } = message.payload;
    // 1. 处理动画
    if (behavior) {
      // 构建动画资源 ID: {domain}-{category}-{action_id}
      // 例如: internal-work-execute
      const animationId = `${behavior.domain}-${behavior.category}-${behavior.action_id}`;
      animationQueueStore.getState().enqueue(characterId, {
        animationId,
        urgency: this.mapUrgency(behavior.urgency),
        intensity: behavior.intensity,
        duration: behavior.duration_ms ?? undefined,
      });

      // 验证动画是否成功入队
      animationQueueStore.getState().getQueue(characterId);
    }

    // 2. 处理状态气泡
    if (mental?.show_bubble) {
      const emoji = this.mapEmojiName(mental.emotion_icon);
      statusBubbleStore.getState().setStatus(characterId, {
        emoji,
        text: mental.thought_text || '',
        // 状态气泡无持续时间，无限循环显示直到被新状态替换或被session/agent_end清空
        duration: undefined,
      });

      // 验证状态气泡是否成功设置
      statusBubbleStore.getState().getStatus(characterId);
    }
  }

  /**
   * 分发 session 消息
   */
  private dispatchSession(
    characterId: string,
    message: AnyTypedCAPMessage & { type: 'session' }
  ): void {
    const { payload } = message;

    // 检查是否是 agent_end 消息
    payload.app_params?.hookType === 'agent_end';
    // 1. 清空状态气泡（session消息到达时清空）
    statusBubbleStore.getState().clearStatus(characterId);
    // 2. 添加到 sessionQueueStore
    sessionQueueStore.getState().addSession(characterId, {
      sessionId: payload.session_id,
      receiverId: characterId,
      sender: payload.message.role,
      content: payload.message.content,
      timestamp: message.timestamp,
      displayMode: payload.display_mode,
      _raw: message, // 保留原始消息供后续使用
    });

    // 3. 插入 speak 动画（urgency=9, duration=10s）
    // speak 是高优先级动画，会打断当前正在播放的动画
    // speak 播放完成后会自动播放 idle
    animationQueueStore.getState().enqueue(characterId, {
      animationId: 'internal-work-speak',
      urgency: 'high', // urgency=9
      intensity: 1,
      duration: 10000, // 10秒
    });
  }

  /**
   * 分发 notification 消息
   */
  private dispatchNotification(
    _characterId: string,
    _message: AnyTypedCAPMessage & { type: 'notification' }
  ): void {
    // TODO: 实现通知分发
  }

  /**
   * 分发 event 消息
   */
  private dispatchEvent(
    _characterId: string,
    _message: AnyTypedCAPMessage & { type: 'event' }
  ): void {
    // TODO: 实现事件分发
  }

  /**
   * 映射 urgency 数值到优先级
   */
  private mapUrgency(urgency: number): 'low' | 'normal' | 'high' {
    if (urgency <= 3) return 'low';
    if (urgency <= 7) return 'normal';
    return 'high';
  }

  /**
   * 映射 emoji 名称到实际 emoji（使用 node-emoji 自动转换）
   */
  private mapEmojiName(name: string): string {
    return resolveEmojiSync(name);
  }
}

/**
 * 创建默认网关
 */
export function createDefaultGateway(
  bindingStore: BindingStore,
  config?: GatewayConfig
): MessageGateway {
  const router = new MessageRouter(bindingStore);
  return new MessageGateway(router, config);
}

/**
 * 从文件创建网关
 */
export async function createGatewayFromFile(
  filePath: string,
  config?: GatewayConfig
): Promise<MessageGateway> {
  // 动态导入以避免循环依赖
  const { FileBindingStore } = await import('@/logic/router/FileBindingStore');
  const bindingStore = new FileBindingStore(filePath);
  return createDefaultGateway(bindingStore, config);
}

/**
 * 全局网关实例
 */
let globalGateway: MessageGateway | null = null;

/**
 * 初始化全局网关
 */
export async function initMessageGateway(
  bindingStore: BindingStore,
  config?: GatewayConfig
): Promise<MessageGateway> {
  if (globalGateway) {
    console.warn('[MessageGateway] Already initialized');
    return globalGateway;
  }

  globalGateway = createDefaultGateway(bindingStore, config);
  await globalGateway.start();
  return globalGateway;
}

/**
 * 获取全局网关实例
 */
export function getMessageGateway(): MessageGateway | null {
  return globalGateway;
}

/**
 * 停止全局网关
 */
export function stopMessageGateway(): void {
  globalGateway?.stop();
  globalGateway = null;
}

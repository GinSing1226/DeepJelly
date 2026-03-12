/**
 * MessageRouter - CAP 消息路由核心
 *
 * Meta-Name: CAP Message Router
 * Meta-Description: 大脑层消息路由器，负责将 CAP 消息路由到正确的角色窗口
 *
 * 职责：
 * 1. 从 CAP 消息中提取路由定位信息（sender.id + routing.sessionKey）
 * 2. 查询 character_integrations.json 找到匹配的角色绑定
 * 3. 返回路由决策（哪个 characterId 应该接收这个消息）
 * 4. 处理多个 OpenClaw 实例的场景
 *
 * @module logic/router/MessageRouter
 */

import type {
  CAPMessage,
  CAPMessageType,
} from '@/types/cap';

/**
 * 应用定位信息 - 从 CAP 消息中提取
 */
export interface AppLocator {
  /** 应用类型：openclaw 等 */
  appType: string;
  /** 应用实例ID：对应 sender.id */
  appId: string;
  /** 会话标识：对应 sender.routing.sessionKey */
  sessionId?: string;
  /** 智能体标识（如从 sessionKey 提取的 agentId） */
  agentId?: string;
}

/**
 * 路由目标
 */
export interface RoutingTarget {
  /** 角色ID */
  characterId: string;
  /** 助手ID */
  assistantId: string;
  /** 会话标识 */
  sessionKey: string;
  /** 绑定ID */
  bindingId: string;
}

/**
 * 路由决策结果
 */
export interface RoutingDecision {
  /** 路由动作：deliver=投递, drop=丢弃, broadcast=广播 */
  action: 'deliver' | 'drop' | 'broadcast';
  /** 目标角色（action=deliver 时有效） */
  target?: RoutingTarget;
  /** 丢弃/广播原因 */
  reason?: string;
}

/**
 * 角色绑定数据结构（来自 character_integrations.json）
 */
export interface CharacterBinding {
  id: string;
  characterId: string;
  characterName: string;
  assistantId: string;
  assistantName: string;
  integration: {
    integrationId: string;
    provider: string;
    applicationId: string;
    agentId: string;
    params: {
      sessionKeys: string[];
      [key: string]: unknown;
    };
  };
  enabled: boolean;
}

/**
 * 绑定存储接口
 * 抽象存储层，便于测试和未来扩展
 */
export interface BindingStore {
  getBindings(): CharacterBinding[];
  getBindingByCharacterId(characterId: string): CharacterBinding | undefined;
  getBindingsByApplicationId(appId: string): CharacterBinding[];
}

/**
 * 路由策略接口
 * 支持不同应用类型的路由策略
 */
export interface RoutingStrategy {
  /** 从 CAP 消息提取定位信息 */
  extractLocator(message: CAPMessage): AppLocator;
  /** 判断消息是否匹配绑定 */
  matches(message: CAPMessage, binding: CharacterBinding): boolean;
}

/**
 * OpenClaw 路由策略
 */
export class OpenClawRoutingStrategy implements RoutingStrategy {
  extractLocator(message: CAPMessage): AppLocator {
    const sessionKey = message.sender.routing?.sessionKey || '';
    // 从 sessionKey 提取 agentId: agent:{agentId}:{sessionId}
    const parts = sessionKey.split(':');
    const agentId = parts.length >= 2 ? parts[1] : undefined;

    return {
      appType: message.sender.source_app,
      appId: message.sender.id,
      sessionId: sessionKey,
      agentId,
    };
  }

  matches(message: CAPMessage, binding: CharacterBinding): boolean {
    // 1. 检查 provider 匹配
    if (binding.integration.provider !== 'openclaw') {
      return false;
    }

    // 2. 检查应用实例ID匹配
    if (binding.integration.applicationId !== message.sender.id) {
      return false;
    }

    // 3. 检查 sessionKey 匹配（必须匹配才能路由）
    const sessionKey = message.sender.routing?.sessionKey;
    if (!sessionKey) {
      // 没有 sessionKey 时，不能进行精确路由，拒绝匹配
      // 这避免了多个角色共享同一个 applicationId 时的路由混乱
      return false;
    }

    const boundSessionKeys = binding.integration.params.sessionKeys || [];
    return boundSessionKeys.includes(sessionKey);
  }
}

/**
 * 消息路由器核心类
 */
export class MessageRouter {
  private strategies: Map<string, RoutingStrategy> = new Map();
  private bindingStore: BindingStore;

  constructor(bindingStore: BindingStore) {
    this.bindingStore = bindingStore;
    // 注册默认策略
    this.registerStrategy('openclaw', new OpenClawRoutingStrategy());
  }

  /**
   * 注册路由策略
   */
  registerStrategy(appType: string, strategy: RoutingStrategy): void {
    this.strategies.set(appType, strategy);
  }

  /**
   * 获取路由策略
   */
  getStrategy(appType: string): RoutingStrategy | undefined {
    return this.strategies.get(appType);
  }

  /**
   * 路由 CAP 消息
   * @returns 路由决策
   */
  route<T extends CAPMessageType>(
    message: CAPMessage<unknown> & { type: T }
  ): RoutingDecision {
    // 1. 获取应用类型
    const appType = message.sender.source_app;

    // 2. 获取对应策略
    const strategy = this.strategies.get(appType);
    if (!strategy) {
      return {
        action: 'drop',
        reason: `No routing strategy for app type: ${appType}`,
      };
    }

    // 3. 提取定位信息
    const locator = strategy.extractLocator(message);

    // 4. 查找匹配的绑定
    const bindings = this.bindingStore.getBindings();
    const matchedBinding = bindings.find((binding) => {
      // 只匹配启用的绑定
      if (!binding.enabled) return false;
      return strategy.matches(message, binding);
    });

    if (!matchedBinding) {
      return {
        action: 'drop',
        reason: `No binding found for appId=${locator.appId}, sessionId=${locator.sessionId}`,
      };
    }

    // 5. 返回路由决策
    return {
      action: 'deliver',
      target: {
        characterId: matchedBinding.characterId,
        assistantId: matchedBinding.assistantId,
        sessionKey: locator.sessionId || '',
        bindingId: matchedBinding.id,
      },
    };
  }

  /**
   * 批量路由多个消息
   */
  routeBatch<T extends CAPMessageType>(
    messages: (CAPMessage<unknown> & { type: T })[]
  ): RoutingDecision[] {
    return messages.map((msg) => this.route(msg));
  }
}

// FileBindingStore moved to separate file to avoid Tauri import issues in tests
// See: src/logic/router/FileBindingStore.ts

/**
 * 内存绑定存储实现（用于测试）
 */
export class MemoryBindingStore implements BindingStore {
  constructor(private bindings: CharacterBinding[] = []) {}

  getBindings(): CharacterBinding[] {
    return this.bindings;
  }

  getBindingByCharacterId(characterId: string): CharacterBinding | undefined {
    return this.bindings.find((b) => b.characterId === characterId);
  }

  getBindingsByApplicationId(appId: string): CharacterBinding[] {
    return this.bindings.filter(
      (b) => b.integration.applicationId === appId
    );
  }

  setBindings(bindings: CharacterBinding[]): void {
    this.bindings = bindings;
  }

  addBinding(binding: CharacterBinding): void {
    this.bindings.push(binding);
  }

  clear(): void {
    this.bindings = [];
  }
}

/**
 * 全局路由器实例
 */
let globalRouter: MessageRouter | null = null;

/**
 * 初始化全局路由器
 */
export function initMessageRouter(bindingStore: BindingStore): MessageRouter {
  globalRouter = new MessageRouter(bindingStore);
  return globalRouter;
}

/**
 * 获取全局路由器实例
 */
export function getMessageRouter(): MessageRouter | null {
  return globalRouter;
}

/**
 * 重置全局路由器（用于测试）
 */
export function resetMessageRouter(): void {
  globalRouter = null;
}

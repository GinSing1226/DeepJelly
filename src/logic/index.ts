/**
 * Logic Layer Index
 *
 * Meta-Name: Logic Layer Index
 * Meta-Description: 大脑层逻辑入口，统一导出路由和网关功能
 *
 * @module logic
 */

// Router exports
export {
  MessageRouter,
  OpenClawRoutingStrategy,
  MemoryBindingStore,
  initMessageRouter,
  getMessageRouter,
  resetMessageRouter,
} from './router/MessageRouter';

// FileBindingStore exported separately to avoid test issues
export { FileBindingStore } from './router/FileBindingStore';

export type {
  AppLocator,
  RoutingTarget,
  RoutingDecision,
  CharacterBinding,
  BindingStore,
  RoutingStrategy,
} from './router/MessageRouter';

// Gateway exports
export {
  MessageGateway,
  createDefaultGateway,
  createGatewayFromFile,
  initMessageGateway,
  getMessageGateway,
  stopMessageGateway,
} from './gateway/MessageGateway';

export type {
  GatewayConfig,
  GatewayState,
} from './gateway/MessageGateway';

/**
 * 初始化完整的消息路由系统
 * 在 App 启动时调用
 */
export async function initMessageRoutingSystem(
  bindingStorePath?: string,
  config?: import('./gateway/MessageGateway').GatewayConfig
): Promise<void> {
  const { FileBindingStore } = await import('./router/FileBindingStore');
  const { MemoryBindingStore } = await import('./router/MessageRouter');
  const { initMessageGateway } = await import('./gateway/MessageGateway');

  // 使用文件存储或内存存储
  const bindingStore = bindingStorePath
    ? new FileBindingStore(bindingStorePath)
    : new MemoryBindingStore([]);

  // 初始化网关（会自动启动监听）
  await initMessageGateway(bindingStore, config);
}

/**
 * 停止消息路由系统
 * 在 App 关闭时调用
 */
export function stopMessageRoutingSystem(): void {
  const { stopMessageGateway } = require('./gateway/MessageGateway');
  stopMessageGateway();
}

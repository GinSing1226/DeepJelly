/**
 * Assistant Helper Utilities
 *
 * 提供助手集成参数的便捷访问方法
 * @module utils/assistantHelper
 */

import type { AssistantIntegration, OpenClawIntegrationParams } from '@/types/appConfig';

/**
 * 获取指定Provider的集成配置
 */
export function getIntegration(
  integrations: AssistantIntegration[],
  provider: string
): AssistantIntegration | undefined {
  return integrations.find(i => i.provider === provider && i.enabled !== false);
}

/**
 * 检查是否已绑定某个Provider
 */
export function hasIntegration(
  integrations: AssistantIntegration[],
  provider: string
): boolean {
  return getIntegration(integrations, provider) !== undefined;
}

/**
 * 获取 OpenClaw 参数（类型安全）
 */
export function getOpenClawParams(
  integrations: AssistantIntegration[]
): OpenClawIntegrationParams | undefined {
  const integration = getIntegration(integrations, 'openclaw');
  if (!integration) return undefined;

  return {
    applicationId: integration.params?.applicationId,
    agentId: integration.params?.agentId,
    sessionKeys: integration.params?.sessionKeys,
  } as OpenClawIntegrationParams;
}

/**
 * 设置 OpenClaw 参数
 */
export function setOpenClawParams(
  integrations: AssistantIntegration[],
  params: OpenClawIntegrationParams
): AssistantIntegration[] {
  // 移除旧的 openclaw 集成（如果有）
  const filtered = integrations.filter(i => i.provider !== 'openclaw');

  // 添加新的集成
  return [
    ...filtered,
    {
      provider: 'openclaw',
      params,
      enabled: true,
      createdAt: Date.now(),
    },
  ];
}

/**
 * 从集成参数中提取 Session Key
 * MVP阶段：返回第一个 sessionKey
 */
export function getSessionKey(integrations: AssistantIntegration[]): string | undefined {
  const openclawParams = getOpenClawParams(integrations);
  // sessionKeys 是数组，MVP阶段返回第一个
  return openclawParams?.sessionKeys?.[0];
}

/**
 * 从集成参数中提取 Agent ID
 */
export function getAgentId(integrations: AssistantIntegration[]): string | undefined {
  const openclawParams = getOpenClawParams(integrations);
  return openclawParams?.agentId;
}

/**
 * 从集成参数中提取 Application ID
 */
export function getApplicationId(integrations: AssistantIntegration[]): string | undefined {
  const openclawParams = getOpenClawParams(integrations);
  return openclawParams?.applicationId;
}

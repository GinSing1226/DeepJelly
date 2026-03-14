/**
 * FileBindingStore - 基于文件的绑定存储实现
 *
 * Meta-Name: File Binding Store
 * Meta-Description: 从文件加载角色绑定数据的存储实现
 *
 * 注意：此文件单独存放以避免测试时的 Tauri 导入问题
 */

import { invoke } from '@tauri-apps/api/core';
import type { BindingStore, CharacterBinding } from './MessageRouter';

/**
 * 基于文件的绑定存储实现
 * 使用 Tauri invoke 来获取数据，避免生产打包后 fetch 失败的问题
 */
export class FileBindingStore implements BindingStore {
  private bindings: CharacterBinding[] = [];
  private lastLoadTime = 0;
  private readonly CACHE_TTL = 5000; // 5秒缓存
  private loadPromise: Promise<void> | null = null;

  constructor(private filePath: string) {
    // 开始异步加载数据
    this.loadBindings();
  }

  /**
   * 加载绑定数据
   * 使用 Tauri invoke 调用后端命令，避免生产环境 fetch 失败
   */
  private async loadBindings(): Promise<void> {
    // 防止并发加载
    if (this.loadPromise) {
      return this.loadPromise;
    }

    this.loadPromise = (async () => {
      try {
        // 在 Tauri 环境中，使用 invoke 获取角色集成数据
        // 注意：这里使用 get_character_integrations 命令
        const data = await invoke<CharacterIntegration[]>('get_character_integrations');

        // 将 CharacterIntegration 转换为 CharacterBinding
        this.bindings = data.map((integration) => {
          // 处理 params 字段，确保包含 sessionKeys 数组
          const integrationParams = integration.integration.params ?? {};

          // 如果有 sessionKey（单数），转换为 sessionKeys（复数）数组
          const sessionKeys: string[] = [];
          const sessionKey = integrationParams.sessionKey as string | undefined;
          if (sessionKey) {
            sessionKeys.push(sessionKey);
          }

          // 如果 integrationParams 中已经有 sessionKeys，使用它而不是空数组
          if (integrationParams.sessionKeys && Array.isArray(integrationParams.sessionKeys)) {
            sessionKeys.length = 0;  // 清空
            sessionKeys.push(...integrationParams.sessionKeys as string[]);
          }

          const params: { sessionKeys: string[]; [key: string]: unknown } = {
            sessionKeys,
            ...integrationParams,
          };

          const binding = {
            id: integration.id,
            characterId: integration.characterId,
            characterName: integration.characterName,
            assistantId: integration.assistantId,
            assistantName: integration.assistantName,
            integration: {
              integrationId: integration.integration.integrationId,
              provider: integration.integration.provider,
              applicationId: integration.integration.applicationId,
              agentId: integration.integration.agentId,
              params,
            },
            enabled: integration.enabled ?? true,
          };

          return binding;
        });

        this.lastLoadTime = Date.now();
        console.log('[FileBindingStore] Loaded bindings:', this.bindings.length);
        console.log('[FileBindingStore] Bindings data:', this.bindings);
        // Log first binding in detail
        if (this.bindings.length > 0) {
          console.log('[FileBindingStore] First binding:', {
            id: this.bindings[0].id,
            characterId: this.bindings[0].characterId,
            assistantId: this.bindings[0].assistantId,
            applicationId: this.bindings[0].integration.applicationId,
            agentId: this.bindings[0].integration.agentId,
            sessionKeys: this.bindings[0].integration.params.sessionKeys,
          });
        }
      } catch (error) {
        console.error('[FileBindingStore] Failed to load bindings:', error);
        this.bindings = [];
      } finally {
        this.loadPromise = null;
      }
    })();

    return this.loadPromise;
  }

  /**
   * 检查是否需要刷新缓存
   */
  private checkRefresh(): void {
    if (Date.now() - this.lastLoadTime > this.CACHE_TTL) {
      this.loadBindings();
    }
  }

  getBindings(): CharacterBinding[] {
    this.checkRefresh();
    return this.bindings;
  }

  getBindingByCharacterId(characterId: string): CharacterBinding | undefined {
    this.checkRefresh();
    return this.bindings.find((b) => b.characterId === characterId);
  }

  getBindingsByApplicationId(appId: string): CharacterBinding[] {
    this.checkRefresh();
    return this.bindings.filter(
      (b) => b.integration.applicationId === appId
    );
  }
}

/**
 * Tauri CharacterIntegration 类型定义
 * 与后端返回的类型匹配
 * 注意：Rust 使用 #[serde(rename = "characterId")] 序列化为 camelCase
 */
interface CharacterIntegration {
  id: string;
  characterId: string;  // not character_id
  characterName: string;  // not character_name
  assistantId: string;  // not assistant_id
  assistantName: string;  // not assistant_name
  integration: {
    integrationId: string;  // not integration_id
    provider: string;
    applicationId: string;  // not application_id
    agentId: string;  // not agent_id
    params?: Record<string, unknown>;
  };
  enabled?: boolean;
}

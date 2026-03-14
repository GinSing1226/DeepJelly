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
          const params: { sessionKeys: string[]; [key: string]: unknown } = {
            sessionKeys: [],
            ...integrationParams,
            ...integration.params,
          };

          // 如果有 sessionKey（单数），添加到 sessionKeys 数组
          const sessionKey = (integration.params?.sessionKey ?? integrationParams.sessionKey) as string | undefined;
          if (sessionKey) {
            params.sessionKeys = [sessionKey];
          }

          return {
            id: integration.id,
            characterId: integration.character_id,
            characterName: integration.character_name,
            assistantId: integration.assistant_id,
            assistantName: integration.assistant_name,
            integration: {
              integrationId: integration.integration.integration_id,
              provider: integration.integration.provider,
              applicationId: integration.integration.application_id,
              agentId: integration.integration.agent_id,
              params,
            },
            enabled: integration.enabled,
          };
        });

        this.lastLoadTime = Date.now();
        console.log('[FileBindingStore] Loaded bindings:', this.bindings.length);
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
 */
interface CharacterIntegration {
  id: string;
  character_id: string;
  character_name: string;
  assistant_id: string;
  assistant_name: string;
  integration: {
    integration_id: string;
    provider: string;
    application_id: string;
    agent_id: string;
    params?: Record<string, unknown>;
  };
  enabled: boolean;
  params?: Record<string, unknown>;
}

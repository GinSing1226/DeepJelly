/**
 * Integration Store
 *
 * 应用集成和角色集成的状态管理
 * Meta-Name: Integration Store
 * Meta-Description: State management for app integrations and character integrations
 */

import { create } from 'zustand';
import type {
  AppIntegration,
  CharacterIntegration,
  ProviderType,
  Assistant,
} from '@/types/character';

// Re-export CharacterIntegration type for external use
export type { CharacterIntegration };

// ============ DTO 类型 ============

export interface CreateAppIntegrationDTO {
  provider: ProviderType;
  name: string;
  description?: string;
  endpoint: string;
  authToken?: string;
  deepjellyToken?: string;
  enabled?: boolean;
}

export interface UpdateAppIntegrationDTO {
  name?: string;
  description?: string;
  endpoint?: string;
  authToken?: string;
  enabled?: boolean;
}

export interface CreateCharacterIntegrationDTO {
  characterId: string;
  characterName: string;
  assistantId: string;
  assistantName: string;
  integration: {
    integrationId: string;
    provider: ProviderType;
    applicationId: string;
    agentId: string;
    params: Record<string, any>;
  };
  enabled?: boolean;
}

export interface UpdateCharacterIntegrationDTO {
  integration?: {
    integrationId?: string;
    agentId?: string;
    params?: Record<string, any>;
  };
  enabled?: boolean;
}

// ============ Store 状态接口 ============

interface IntegrationState {
  // 数据状态
  appIntegrations: AppIntegration[];
  characterIntegrations: CharacterIntegration[];

  // UI 状态
  loading: boolean;
  error: string | null;

  // ========== Actions - 应用集成 ==========

  /** 加载所有应用集成 */
  loadAppIntegrations: () => Promise<void>;

  /** 添加应用集成 */
  addAppIntegration: (data: CreateAppIntegrationDTO) => Promise<AppIntegration>;

  /** 更新应用集成 */
  updateAppIntegration: (id: string, data: UpdateAppIntegrationDTO) => Promise<void>;

  /** 删除应用集成 */
  deleteAppIntegration: (id: string) => Promise<void>;

  /** 测试应用连接 */
  testAppConnection: (endpoint: string, authToken?: string) => Promise<boolean>;

  // ========== Actions - 角色集成 ==========

  /** 加载所有角色集成 */
  loadCharacterIntegrations: () => Promise<void>;

  /** 添加角色集成 */
  addCharacterIntegration: (data: CreateCharacterIntegrationDTO) => Promise<CharacterIntegration>;

  /** 更新角色集成 */
  updateCharacterIntegration: (id: string, data: UpdateCharacterIntegrationDTO) => Promise<void>;

  /** 删除角色集成 */
  deleteCharacterIntegration: (id: string) => Promise<void>;

  // ========== Selectors ==========

  /** 根据 ID 获取应用集成 */
  getAppIntegrationById: (id: string) => AppIntegration | undefined;

  /** 获取绑定到指定应用的所有助手 */
  getBoundAssistantsForApp: (appId: string, assistants: Assistant[]) => Assistant[];

  /** 根据助手 ID 获取角色集成 */
  getCharacterIntegrationsByAssistant: (assistantId: string) => CharacterIntegration[];

  /** 根据 ID 获取角色集成 */
  getCharacterIntegrationById: (id: string) => CharacterIntegration | undefined;
}

// ============ Store 实现 ============

export const useIntegrationStore = create<IntegrationState>((set, get) => ({
  // 初始状态
  appIntegrations: [],
  characterIntegrations: [],
  loading: false,
  error: null,

  // ========== 应用集成 Actions ==========

  loadAppIntegrations: async () => {
    set({ loading: true, error: null });
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const integrations = await invoke<AppIntegration[]>('get_app_integrations');
      set({ appIntegrations: integrations, loading: false });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      set({ error: errorMessage, loading: false });
      throw error;
    }
  },

  addAppIntegration: async (data) => {
    set({ loading: true, error: null });
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      // Generate temporary id and applicationId for the backend
      // The backend will generate proper values
      const integrationWithTempIds: AppIntegration = {
        id: crypto.randomUUID(),
        applicationId: crypto.randomUUID(),
        provider: data.provider,
        name: data.name,
        description: data.description,
        endpoint: data.endpoint,
        authToken: data.authToken,
        deepjellyToken: data.deepjellyToken,
        enabled: data.enabled ?? true,
      };
      const integration = await invoke<AppIntegration>('add_app_integration', { integration: integrationWithTempIds });
      set((state) => ({
        appIntegrations: [...state.appIntegrations, integration],
        loading: false,
      }));
      return integration;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      set({ error: errorMessage, loading: false });
      throw error;
    }
  },

  updateAppIntegration: async (id, data) => {
    set({ loading: true, error: null });
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      // Get the existing integration to construct a full object for the backend
      const existingIntegration = get().appIntegrations.find((i) => i.id === id);
      if (!existingIntegration) {
        throw new Error(`Integration with ID ${id} not found`);
      }
      // Merge partial updates with existing integration to create full object
      const fullUpdate: AppIntegration = {
        ...existingIntegration,
        ...data,
        // Ensure these fields are preserved
        id: existingIntegration.id,
        applicationId: existingIntegration.applicationId,
        provider: existingIntegration.provider,
      };
      await invoke('update_app_integration', {
        id,
        updates: fullUpdate,
      });
      set((state) => ({
        appIntegrations: state.appIntegrations.map((integration) =>
          integration.id === id ? { ...integration, ...data } : integration
        ),
        loading: false,
      }));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      set({ error: errorMessage, loading: false });
      throw error;
    }
  },

  deleteAppIntegration: async (id) => {
    set({ loading: true, error: null });
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('delete_app_integration', { id });
      set((state) => ({
        appIntegrations: state.appIntegrations.filter((integration) => integration.id !== id),
        loading: false,
      }));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      set({ error: errorMessage, loading: false });
      throw error;
    }
  },

  testAppConnection: async (endpoint, authToken) => {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const result = await invoke<boolean>('test_app_connection', {
        endpoint,
        authToken,
      });
      return result;
    } catch (error) {
      console.error('[IntegrationStore] Connection test failed:', error);
      return false;
    }
  },

  // ========== 角色集成 Actions ==========

  loadCharacterIntegrations: async () => {
    set({ loading: true, error: null });
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const integrations = await invoke<CharacterIntegration[]>('get_character_integrations');
      set({ characterIntegrations: integrations, loading: false });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      set({ error: errorMessage, loading: false });
      throw error;
    }
  },

  addCharacterIntegration: async (data) => {
    set({ loading: true, error: null });
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      // 添加空的 id 字段，后端会自动生成
      const binding = { id: '', ...data };
      const integration = await invoke<CharacterIntegration>('add_character_integration', {
        binding,
      });
      set((state) => ({
        characterIntegrations: [...state.characterIntegrations, integration],
        loading: false,
      }));
      return integration;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('[IntegrationStore] ❌ addCharacterIntegration failed:', {
        error,
        errorMessage,
        inputData: data,
      });
      set({ error: errorMessage, loading: false });
      throw error;
    }
  },

  updateCharacterIntegration: async (id, data) => {
    set({ loading: true, error: null });
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      // Get the existing integration to construct a full object for the backend
      const existingIntegration = get().characterIntegrations.find((i) => i.id === id);
      if (!existingIntegration) {
        throw new Error(`Character integration with ID ${id} not found`);
      }
      // Merge partial updates with existing integration to create full object
      const fullUpdate: CharacterIntegration = {
        ...existingIntegration,
        ...data,
        // Merge nested integration object if provided
        integration: data.integration
          ? { ...existingIntegration.integration, ...data.integration }
          : existingIntegration.integration,
        // Ensure these fields are preserved
        id: existingIntegration.id,
        characterId: existingIntegration.characterId,
        characterName: existingIntegration.characterName,
        assistantId: existingIntegration.assistantId,
        assistantName: existingIntegration.assistantName,
      };
      await invoke('update_character_integration', {
        id,
        updates: fullUpdate,
      });
      set((state) => ({
        characterIntegrations: state.characterIntegrations.map((integration) =>
          integration.id === id
            ? { ...integration, ...data, integration: { ...integration.integration, ...data.integration } }
            : integration
        ),
        loading: false,
      }));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      set({ error: errorMessage, loading: false });
      throw error;
    }
  },

  deleteCharacterIntegration: async (id) => {
    set({ loading: true, error: null });
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('delete_character_integration', { id });
      set((state) => ({
        characterIntegrations: state.characterIntegrations.filter((integration) => integration.id !== id),
        loading: false,
      }));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      set({ error: errorMessage, loading: false });
      throw error;
    }
  },

  // ========== Selectors ==========

  getAppIntegrationById: (id) => {
    return get().appIntegrations.find((integration) => integration.id === id);
  },

  getBoundAssistantsForApp: (appId, assistants) => {
    return assistants.filter((assistant) =>
      assistant.integrations?.some((integration) => integration.params.applicationId === appId)
    );
  },

  getCharacterIntegrationsByAssistant: (assistantId) => {
    return get().characterIntegrations.filter((integration) => integration.assistantId === assistantId);
  },

  getCharacterIntegrationById: (id) => {
    return get().characterIntegrations.find((integration) => integration.id === id);
  },
}));

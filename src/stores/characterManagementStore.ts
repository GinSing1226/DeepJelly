/**
 * Character Management Store
 *
 * Meta-Name: Character Management State Store
 * Meta-Description: 角色管理状态管理，包含助手、角色、形象的CRUD操作
 *
 * 遵循需求文档 docs/private_docs/Reqs/4.2.角色管理.md
 */

import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import type {
  AIApp,
  Assistant,
  Character,
  Appearance,
  DisplayConfig,
  AssistantTreeNode,
  CharacterCard,
  ResourceType,
} from '@/types/character';

// ============ Store 状态接口 ============

interface CharacterManagementState {
  // ============ 数据 ============
  /** AI应用列表 */
  apps: AIApp[];
  /** 助手列表 */
  assistants: Assistant[];
  /** 角色列表 (按助手ID分组) */
  characters: Record<string, Character[]>;
  /** 当前选中的助手ID */
  selectedAssistantId: string | null;
  /** 当前展示配置 */
  displayConfig: DisplayConfig | null;

  // ============ UI状态 ============
  /** 搜索关键词 */
  searchQuery: string;
  /** 是否正在加载 */
  isLoading: boolean;
  /** 错误信息 */
  error: string | null;

  // ============ Actions - AI应用 ============
  /** 加载AI应用列表 */
  loadApps: () => Promise<void>;
  /** 添加AI应用 */
  addApp: (app: Omit<AIApp, 'id'>) => Promise<void>;
  /** 删除AI应用 */
  deleteApp: (appId: string) => Promise<void>;

  // ============ Actions - 助手 ============
  /** 加载所有助手 */
  loadAssistants: () => Promise<void>;
  /** 添加助手 */
  addAssistant: (
    assistant: Omit<Assistant, 'id'>
  ) => Promise<Assistant>;
  /** 更新助手 */
  updateAssistant: (
    assistantId: string,
    updates: Partial<Omit<Assistant, 'id'>>
  ) => Promise<void>;
  /** 删除助手 */
  deleteAssistant: (assistantId: string) => Promise<void>;

  // ============ Actions - 角色 ============
  /** 加载所有角色 */
  loadAllCharacters: () => Promise<void>;
  /** 加载助手下的角色列表 */
  loadCharacters: (assistantId: string) => Promise<void>;
  /** 添加角色 */
  addCharacter: (
    assistantId: string,
    character: Omit<Character, 'id' | 'assistantId' | 'appearances'>
  ) => Promise<Character>;
  /** 更新角色 */
  updateCharacter: (
    characterId: string,
    updates: Partial<Omit<Character, 'id' | 'assistantId'>>
  ) => Promise<void>;
  /** 删除角色 */
  deleteCharacter: (characterId: string) => Promise<void>;

  // ============ Actions - 形象 ============
  /** 添加形象 */
  addAppearance: (
    characterId: string,
    appearance: Omit<Appearance, 'id' | 'characterId'>
  ) => Promise<Appearance>;
  /** 更新形象 */
  updateAppearance: (
    appearanceId: string,
    updates: Partial<Omit<Appearance, 'id' | 'characterId'>>
  ) => Promise<void>;
  /** 删除形象 */
  deleteAppearance: (appearanceId: string) => Promise<void>;
  /** 设置默认形象 */
  setDefaultAppearance: (
    characterId: string,
    appearanceId: string
  ) => Promise<void>;

  // ============ Actions - 展示配置 ============
  /** 设置当前展示配置 */
  setDisplayConfig: (config: DisplayConfig) => Promise<void>;
  /** 获取当前展示配置 */
  getDisplayConfig: () => Promise<DisplayConfig | null>;

  // ============ Actions - UI状态 ============
  /** 选中助手 */
  selectAssistant: (assistantId: string | null) => void;
  /** 设置搜索关键词 */
  setSearchQuery: (query: string) => void;
  /** 清除错误 */
  clearError: () => void;
  /** 重置状态 */
  reset: () => void;
}

// ============ 默认状态 ============

const DEFAULT_STATE = {
  apps: [
    { id: 'openclaw', name: 'OpenClaw', description: 'OpenClaw AI应用' },
  ] as AIApp[],
  assistants: [],
  characters: {},
  selectedAssistantId: null,
  displayConfig: null,
  searchQuery: '',
  isLoading: false,
  error: null,
};

// ============ 辅助函数 ============

/**
 * 构建助手树
 */
function buildAssistantTree(
  apps: AIApp[],
  assistants: Assistant[]
): AssistantTreeNode[] {
  return apps.map((app) => ({
    type: 'app' as const,
    id: app.id,
    name: app.name,
    description: app.description,
    children: assistants
      .filter((a) => a.appType === app.id)
      .map((assistant) => ({
        type: 'assistant' as const,
        id: assistant.id,
        name: assistant.name,
        description: assistant.description,
        appType: assistant.appType,
        agentLabel: assistant.agentLabel,
      })),
  }));
}

/**
 * 过滤助手树（按搜索关键词）
 */
function filterAssistantTree(
  tree: AssistantTreeNode[],
  query: string
): AssistantTreeNode[] {
  if (!query.trim()) return tree;

  const lowerQuery = query.toLowerCase();
  const result: AssistantTreeNode[] = [];

  for (const node of tree) {
    if (node.type === 'app' && node.children) {
      const filteredChildren = node.children.filter(
        (child) =>
          child.name.toLowerCase().includes(lowerQuery) ||
          child.description?.toLowerCase().includes(lowerQuery)
      );

      if (filteredChildren.length > 0) {
        result.push({
          ...node,
          children: filteredChildren,
        });
      }
    }
  }

  return result;
}

/**
 * 生成唯一ID
 */
function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * 后端角色配置类型（从 Rust 返回的原始数据）
 *
 * 注意：Rust 端使用了 #[serde(rename = "id")]，所以 JSON 字段名是 id 而不是 character_id
 * 注意：Rust 端使用了 #[serde(alias = "isDefault")]，所以 JSON 字段名是 isDefault 而不是 is_default
 */
interface BackendCharacterConfig {
  id: string;
  name: string;
  description?: string;
  assistant_id?: string;
  appearances: BackendAppearanceConfig[];
}

interface BackendAppearanceConfig {
  id: string;
  name: string;
  description?: string;
  isDefault: boolean;
  actions: Record<string, {
    type: string;
    resources: string[];
    fps?: number;
    loop?: boolean;
    description?: string;
  }>;
}

/**
 * 将后端角色配置转换为前端角色类型
 */
function convertBackendCharacter(backend: BackendCharacterConfig, assistantId: string): Character {
  const appearances: Appearance[] = backend.appearances.map((appr) => ({
    id: appr.id,
    name: appr.name,
    characterId: backend.id,
    isDefault: appr.isDefault,
    description: appr.description,
    actions: Object.fromEntries(
      Object.entries(appr.actions).map(([key, value]) => [
        key,
        {
          type: value.type as ResourceType,
          resources: value.resources,
          fps: value.fps,
          loop: value.loop ?? true,
          description: value.description,
        }
      ])
    ),
  }));

  // 找到默认形象
  const defaultAppearance = appearances.find(a => a.isDefault);
  const defaultAppearanceId = defaultAppearance?.id || appearances[0]?.id || '';

  return {
    id: backend.id,
    name: backend.name,
    description: backend.description,
    assistantId: backend.assistant_id || assistantId,
    appearances,
    defaultAppearanceId,
  };
}

// ============ Store 实现 ============

export const useCharacterManagementStore = create<CharacterManagementState>(
  (set, get) => ({
    ...DEFAULT_STATE,

    // ============ AI应用 Actions ============

    loadApps: async () => {
      set({ isLoading: true, error: null });
      try {
        // MVP阶段：使用默认应用列表
        // 未来可以从后端加载
        set({ isLoading: false });
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Failed to load apps';
        set({ error: errorMessage, isLoading: false });
      }
    },

    addApp: async (app) => {
      const newApp: AIApp = {
        id: generateId('app'),
        ...app,
      };
      set((state) => ({ apps: [...state.apps, newApp] }));
    },

    deleteApp: async (appId) => {
      set((state) => ({
        apps: state.apps.filter((app) => app.id !== appId),
        // 同时删除该应用下的所有助手
        assistants: state.assistants.filter((a) => a.appType !== appId),
      }));
    },

    // ============ 助手 Actions ============

    loadAssistants: async () => {
      console.log('[CharacterManagement] ========== loadAssistants START ==========');
      set({ isLoading: true, error: null });
      try {
        console.log('[CharacterManagement] Invoking get_all_assistants command...');
        const assistants = await invoke<Assistant[]>('get_all_assistants');
        console.log('[CharacterManagement] Raw assistants response:', {
          type: typeof assistants,
          isArray: Array.isArray(assistants),
          length: assistants?.length,
          data: assistants
        });
        set({ assistants, isLoading: false });
        console.log('[CharacterManagement] ========== loadAssistants COMPLETE ==========');
      } catch (error) {
        console.error('[CharacterManagement] ERROR in loadAssistants:', error);
        console.error('[CharacterManagement] Error details:', {
          message: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : 'No stack trace'
        });
        set({ assistants: [], isLoading: false });
      }
    },

    addAssistant: async (assistantData) => {
      try {
        // 调用后端创建助手
        const newAssistant = await invoke<Assistant>('create_assistant', {
          name: assistantData.name,
          description: assistantData.description || null,
          appType: assistantData.appType,
          agentLabel: assistantData.agentLabel || null,
        });

        set((state) => ({
          assistants: [...state.assistants, newAssistant],
        }));

        return newAssistant;
      } catch (error) {
        console.error('Failed to create assistant:', error);
        throw error;
      }
    },

    updateAssistant: async (assistantId, updates) => {
      console.log('[CharacterManagement] updateAssistant START:', { assistantId, updates });
      try {
        await invoke('update_assistant', {
          id: assistantId,
          updates,
        });
        console.log('[CharacterManagement] updateAssistant backend call SUCCESS');
      } catch (error) {
        console.error('[CharacterManagement] updateAssistant FAILED:', error);
        throw error;
      }

      set((state) => {
        const newAssistants = state.assistants.map((a) =>
          a.id === assistantId ? { ...a, ...updates } : a
        );
        console.log('[CharacterManagement] updateAssistant updating local state:', {
          old: state.assistants.find(a => a.id === assistantId),
          updates,
          new: newAssistants.find(a => a.id === assistantId)
        });
        return { assistants: newAssistants };
      });
      console.log('[CharacterManagement] updateAssistant COMPLETE');
    },

    deleteAssistant: async (assistantId) => {
      try {
        await invoke('delete_assistant', { id: assistantId });
      } catch (error) {
        console.error('Failed to delete assistant:', error);
        throw error;
      }

      set((state) => ({
        assistants: state.assistants.filter((a) => a.id !== assistantId),
        characters: { ...state.characters, [assistantId]: [] },
        // 如果删除的是当前选中的助手，清除选中状态
        selectedAssistantId:
          state.selectedAssistantId === assistantId
            ? null
            : state.selectedAssistantId,
      }));
    },

    // ============ 角色 Actions ============

    loadAllCharacters: async () => {
      console.log('[CharacterManagement] ========== loadAllCharacters START ==========');
      set({ isLoading: true, error: null });

      try {
        // 获取后端返回的原始角色配置
        console.log('[CharacterManagement] Invoking get_all_characters command...');
        const backendCharacters = await invoke<BackendCharacterConfig[]>('get_all_characters');
        console.log('[CharacterManagement] Raw backend response:', {
          type: typeof backendCharacters,
          isArray: Array.isArray(backendCharacters),
          length: backendCharacters?.length,
          data: backendCharacters
        });

        // 转换并按助手ID分组角色
        const grouped: Record<string, Character[]> = {};

        for (const backend of backendCharacters) {
          console.log('[CharacterManagement] Processing backend character:', JSON.stringify(backend, null, 2));

          // 使用 assistant_id 或默认助手 ID
          const assistantId = backend.assistant_id || 'unknown';
          console.log('[CharacterManagement] - Extracted assistantId:', assistantId, 'Type:', typeof backend.assistant_id);

          // 转换后端数据为前端类型
          const character = convertBackendCharacter(backend, assistantId);
          console.log('[CharacterManagement] - Converted character:', character);

          if (!grouped[assistantId]) {
            grouped[assistantId] = [];
          }
          grouped[assistantId].push(character);
        }

        console.log('[CharacterManagement] Final grouped characters:', grouped);
        console.log('[CharacterManagement] Character counts by assistant:',
          Object.fromEntries(Object.entries(grouped).map(([k, v]) => [k, v.length]))
        );
        set({ characters: grouped, isLoading: false });
        console.log('[CharacterManagement] ========== loadAllCharacters COMPLETE ==========');
      } catch (error) {
        console.error('[CharacterManagement] ERROR in loadAllCharacters:', error);
        console.error('[CharacterManagement] Error details:', {
          message: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : 'No stack trace'
        });
        set({ characters: {}, isLoading: false, error: String(error) });
      }
    },

    loadCharacters: async (assistantId) => {
      console.log(`[CharacterManagement] ========== loadCharacters START for assistant: ${assistantId} ==========`);
      set({ isLoading: true, error: null });

      try {
        // 获取后端返回的原始角色配置
        console.log(`[CharacterManagement] Invoking get_all_characters command for assistant: ${assistantId}...`);
        const backendCharacters = await invoke<BackendCharacterConfig[]>('get_all_characters');
        console.log('[CharacterManagement] Raw backend response:', {
          type: typeof backendCharacters,
          isArray: Array.isArray(backendCharacters),
          length: backendCharacters?.length,
          data: backendCharacters
        });

        // 过滤并转换角色
        const filtered: Character[] = [];
        for (const backend of backendCharacters) {
          const charAssistantId = backend.assistant_id || 'unknown';
          console.log(`[CharacterManagement] Checking character - target: ${assistantId}, actual: ${charAssistantId}`);
          if (charAssistantId === assistantId) {
            console.log('[CharacterManagement] - Match found, converting:', backend);
            const converted = convertBackendCharacter(backend, assistantId);
            console.log('[CharacterManagement] - Converted result:', converted);
            filtered.push(converted);
          }
        }

        console.log(`[CharacterManagement] Final filtered characters for ${assistantId}:`, filtered);
        set((state) => ({
          characters: { ...state.characters, [assistantId]: filtered },
          isLoading: false,
        }));
        console.log(`[CharacterManagement] ========== loadCharacters COMPLETE for assistant: ${assistantId} ==========`);
      } catch (error) {
        console.error('[CharacterManagement] ERROR in loadCharacters:', error);
        console.error('[CharacterManagement] Error details:', {
          message: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : 'No stack trace'
        });
        set((state) => ({
          characters: { ...state.characters, [assistantId]: [] },
          isLoading: false,
          error: String(error),
        }));
      }
    },

    addCharacter: async (assistantId, characterData) => {
      const newCharacter: Character = {
        id: generateId('char'),
        assistantId,
        appearances: [],
        defaultAppearanceId: characterData.defaultAppearanceId || '',
        name: characterData.name,
        description: characterData.description,
      };

      try {
        await invoke('add_character', { config: newCharacter });
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        set({ error: errorMsg });
        console.warn('Backend save failed:', error);
      }

      set((state) => ({
        characters: {
          ...state.characters,
          [assistantId]: [
            ...(state.characters[assistantId] || []),
            newCharacter,
          ],
        },
      }));

      return newCharacter;
    },

    updateCharacter: async (characterId, updates) => {
      const { characters } = get();
      const updatedCharacters: Record<string, Character[]> = {};

      for (const [assistantId, chars] of Object.entries(characters)) {
        const found = chars.find((c) => c.id === characterId);
        if (found) {
          updatedCharacters[assistantId] = chars.map((c) =>
            c.id === characterId ? { ...c, ...updates } : c
          );
          break;
        }
      }

      set((state) => ({
        characters: { ...state.characters, ...updatedCharacters },
      }));

      try {
        await invoke('update_character', {
          characterId,
          name: updates.name,
          description: updates.description,
        });
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        set({ error: errorMsg });
        console.warn('Backend update failed:', error);
      }
    },

    deleteCharacter: async (characterId) => {
      const { characters } = get();
      const updatedCharacters: Record<string, Character[]> = {};

      for (const [assistantId, chars] of Object.entries(characters)) {
        if (chars.find((c) => c.id === characterId)) {
          updatedCharacters[assistantId] = chars.filter(
            (c) => c.id !== characterId
          );
          break;
        }
      }

      set((state) => ({
        characters: { ...state.characters, ...updatedCharacters },
      }));

      try {
        await invoke('remove_character', { characterId });
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        set({ error: errorMsg });
        console.warn('Backend delete failed:', error);
      }
    },

    // ============ 形象 Actions ============

    addAppearance: async (characterId, appearanceData) => {
      const newAppearance: Appearance = {
        id: generateId('appr'),
        characterId,
        ...appearanceData,
      };

      const { characters } = get();
      const updatedCharacters: Record<string, Character[]> = {};

      for (const [assistantId, chars] of Object.entries(characters)) {
        const character = chars.find((c) => c.id === characterId);
        if (character) {
          updatedCharacters[assistantId] = chars.map((c) =>
            c.id === characterId
              ? {
                  ...c,
                  appearances: [...c.appearances, newAppearance],
                }
              : c
          );
          break;
        }
      }

      set((state) => ({
        characters: { ...state.characters, ...updatedCharacters },
      }));

      return newAppearance;
    },

    updateAppearance: async (appearanceId, updates) => {
      const { characters } = get();
      let characterId: string | null = null;

      // 找到包含该形象的角色
      for (const [assistantId, chars] of Object.entries(characters)) {
        const found = chars.find((c) =>
          c.appearances.find((a) => a.id === appearanceId)
        );
        if (found) {
          characterId = found.id;

          // 调用后端保存
          try {
            await invoke('update_appearance', {
              characterId: found.id,
              appearanceId,
              name: updates.name,
              description: updates.description,
            });
          } catch (error) {
            console.error('[CharacterManagement] Failed to update appearance:', error);
            throw error;
          }
          break;
        }
      }

      // 更新前端状态
      const updatedCharacters: Record<string, Character[]> = {};
      for (const [assistantId, chars] of Object.entries(characters)) {
        const found = chars.find((c) =>
          c.appearances.find((a) => a.id === appearanceId)
        );
        if (found) {
          updatedCharacters[assistantId] = chars.map((c) => ({
            ...c,
            appearances: c.appearances.map((a) =>
              a.id === appearanceId ? { ...a, ...updates } : a
            ),
          }));
          break;
        }
      }

      set((state) => ({
        characters: { ...state.characters, ...updatedCharacters },
      }));
    },

    deleteAppearance: async (appearanceId) => {
      const { characters } = get();
      const updatedCharacters: Record<string, Character[]> = {};

      for (const [assistantId, chars] of Object.entries(characters)) {
        const found = chars.find((c) =>
          c.appearances.find((a) => a.id === appearanceId)
        );
        if (found) {
          updatedCharacters[assistantId] = chars.map((c) => ({
            ...c,
            appearances: c.appearances.filter((a) => a.id !== appearanceId),
          }));
          break;
        }
      }

      set((state) => ({
        characters: { ...state.characters, ...updatedCharacters },
      }));
    },

    setDefaultAppearance: async (characterId: string, appearanceId: string) => {
      const { characters } = get();
      const updatedCharacters: Record<string, Character[]> = {};

      for (const [assistantId, chars] of Object.entries(characters)) {
        const character = chars.find((c) => c.id === characterId);
        if (character) {
          updatedCharacters[assistantId] = chars.map((c) =>
            c.id === characterId
              ? { ...c, defaultAppearanceId: appearanceId }
              : c
          );
          break;
        }
      }

      set((state) => ({
        characters: { ...state.characters, ...updatedCharacters },
      }));
    },

    // ============ 展示配置 Actions ============

    setDisplayConfig: async (config: DisplayConfig) => {
      set({ displayConfig: config });
    },

    getDisplayConfig: async () => {
      return null;
    },

    // ============ UI状态 Actions ============

    selectAssistant: (assistantId) => {
      console.log(`[CharacterManagement] ========== selectAssistant called with: ${assistantId} ==========`);
      console.log('[CharacterManagement] Current selectedAssistantId:', get().selectedAssistantId);
      set({ selectedAssistantId: assistantId });
      // 如果有选中的助手，加载其角色列表
      if (assistantId) {
        console.log(`[CharacterManagement] Triggering loadCharacters for: ${assistantId}`);
        get().loadCharacters(assistantId);
      } else {
        console.log('[CharacterManagement] No assistant selected, skipping loadCharacters');
      }
      console.log(`[CharacterManagement] ========== selectAssistant complete ==========`);
    },

    setSearchQuery: (query) => {
      set({ searchQuery: query });
    },

    clearError: () => {
      set({ error: null });
    },

    reset: () => {
      set(DEFAULT_STATE);
    },
  })
);

// ============ Selectors ============

/**
 * 获取助手树（带搜索过滤）
 */
export const selectAssistantTree = (
  state: CharacterManagementState
): AssistantTreeNode[] => {
  const tree = buildAssistantTree(state.apps, state.assistants);
  return filterAssistantTree(tree, state.searchQuery);
};

/**
 * 获取当前选中助手的角色列表
 */
export const selectCurrentCharacters = (
  state: CharacterManagementState
): Character[] => {
  if (!state.selectedAssistantId) return [];
  return state.characters[state.selectedAssistantId] || [];
};

/**
 * 获取当前选中的助手对象
 */
export const selectCurrentAssistant = (
  state: CharacterManagementState
): Assistant | null => {
  if (!state.selectedAssistantId) return null;
  return state.assistants.find(a => a.id === state.selectedAssistantId) || null;
};

/**
 * 将角色列表转换为卡片数据
 */
export const selectCharacterCards = (
  state: CharacterManagementState
): CharacterCard[] => {
  const characters = selectCurrentCharacters(state);
  return characters.map((char) => {
    const defaultAppearance = char.appearances.find(
      (a) => a.id === char.defaultAppearanceId
    );
    const idleAction = defaultAppearance?.actions['internal-base-idle'];

    return {
      id: char.id,
      name: char.name,
      description: char.description,
      // 图片资源路径（需要后续加载为实际URL）
      coverImage: idleAction?.resources?.[0],
      defaultAppearanceId: char.defaultAppearanceId,
      isDefault: true,
    };
  });
};

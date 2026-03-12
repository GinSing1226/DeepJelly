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
import { DEFAULT_ACTIONS } from '@/types/character';

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
    assistant: Omit<Assistant, 'id'> & { id?: string }
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
 *
 * 按应用类型分组助手，未绑定应用的助手归类到"未绑定"节点
 */
function buildAssistantTree(
  apps: AIApp[],
  assistants: Assistant[]
): AssistantTreeNode[] {
  // 按应用类型分组助手
  const grouped = new Map<string, Assistant[]>();
  const unbound: Assistant[] = [];

  assistants.forEach(assistant => {
    const appType = assistant.appType;
    if (appType && apps.some(app => app.id === appType)) {
      // 有绑定应用
      if (!grouped.has(appType)) {
        grouped.set(appType, []);
      }
      grouped.get(appType)!.push(assistant);
    } else {
      // 未绑定应用
      unbound.push(assistant);
    }
  });

  const tree: AssistantTreeNode[] = [];

  // 应用类型节点（放前面）
  apps.forEach(app => {
    const appAssistants = grouped.get(app.id);
    if (appAssistants && appAssistants.length > 0) {
      tree.push({
        type: 'app' as const,
        id: app.id,
        name: app.name,
        description: app.description,
        children: appAssistants.map(assistant => ({
          type: 'assistant' as const,
          id: assistant.id,
          name: assistant.name,
          description: assistant.description,
          appType: assistant.appType,
          agentLabel: assistant.agentLabel,
        })),
      });
    }
  });

  // 未绑定节点（固定排最后）
  if (unbound.length > 0) {
    tree.push({
      type: 'app' as const,
      id: 'unbound',
      name: '未绑定',
      description: '未绑定应用的助手',
      children: unbound.map(assistant => ({
        type: 'assistant' as const,
        id: assistant.id,
        name: assistant.name,
        description: assistant.description,
        appType: assistant.appType,
        agentLabel: assistant.agentLabel,
      })),
    });
  }
  return tree;
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
 * 字段名与 Rust serde rename 配置保持一致：
 * - assistantId (Rust: assistant_id with rename="assistantId")
 * - defaultAppearanceId (Rust: default_appearance_id with rename="defaultAppearanceId")
 * - isDefault (Rust: is_default with rename="isDefault")
 */
interface BackendCharacterConfig {
  id: string;
  name: string;
  description?: string;
  assistantId: string;
  defaultAppearanceId?: string;
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
    spritesheet?: {
      format: string;
      url: string;
      frameNames?: string[];
      grid?: {
        frame_width: number;
        frame_height: number;
        spacing?: number;
        margin?: number;
        rows: number;
        cols: number;
      };
    };
  }>;
}

/**
 * 将后端角色配置转换为前端角色类型
 */
function convertBackendCharacter(backend: BackendCharacterConfig, _assistantId: string): Character {
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
          spritesheet: value.spritesheet ? {
            format: value.spritesheet.format as any,
            url: value.spritesheet.url,
            frameNames: value.spritesheet.frameNames,
            grid: value.spritesheet.grid,
          } : undefined,
        }
      ])
    ),
  }));

  // 使用后端返回的 defaultAppearanceId，或自动选择第一个/默认形象
  const defaultAppearanceId = backend.defaultAppearanceId ||
    appearances.find(a => a.isDefault)?.id ||
    appearances[0]?.id ||
    '';

  return {
    id: backend.id,
    name: backend.name,
    description: backend.description,
    assistantId: backend.assistantId,
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
      set({ isLoading: true, error: null });
      try {
        const assistants = await invoke<Assistant[]>('get_all_assistants');
        set({ assistants, isLoading: false });
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
        // 调用后端创建助手，传递完整字段包括 integrations
        const newAssistant = await invoke<Assistant>('create_assistant', {
          id: assistantData.id || null,
          name: assistantData.name,
          description: assistantData.description || null,
          appType: assistantData.appType || null,
          agentLabel: assistantData.agentLabel || null,
          boundAgentId: assistantData.boundAgentId || null,
          sessionKey: assistantData.sessionKey || null,
          integrations: assistantData.integrations || null,
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
      try {
        await invoke('update_assistant', {
          id: assistantId,
          updates,
        });
      } catch (error) {
        console.error('[CharacterManagement] updateAssistant FAILED:', error);
        throw error;
      }

      set((state) => {
        const newAssistants = state.assistants.map((a) =>
          a.id === assistantId ? { ...a, ...updates } : a
        );
        
        return { assistants: newAssistants };
      });
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
      set({ isLoading: true, error: null });

      try {
        // 获取后端返回的原始角色配置 (NEW DATA MODEL)
        const backendCharacters = await invoke<BackendCharacterConfig[]>('data_get_all_characters');


        // 转换并按助手ID分组角色
        const grouped: Record<string, Character[]> = {};

        for (const backend of backendCharacters) {
          // 使用 assistantId 字段
          const assistantId = backend.assistantId || 'unknown';
          // 转换后端数据为前端类型
          const character = convertBackendCharacter(backend, assistantId);
          if (!grouped[assistantId]) {
            grouped[assistantId] = [];
          }
          grouped[assistantId].push(character);
        }
        
        set({ characters: grouped, isLoading: false });
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
      set({ isLoading: true, error: null });

      try {
        // 使用新命令：按助手ID获取角色 (NEW DATA MODEL)
        const backendCharacters = await invoke<BackendCharacterConfig[]>('data_get_characters_by_assistant', { assistantId });


        // 转换角色（后端已按 assistantId 过滤，直接转换即可）
        const filtered: Character[] = backendCharacters.map((backend) => {
          const converted = convertBackendCharacter(backend, assistantId);
          return converted;
        });
        set((state) => ({
          characters: { ...state.characters, [assistantId]: filtered },
          isLoading: false,
        }));
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
      // 生成16位随机ID (与后端一致)
      const generateDjId = (): string => {
        const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
        let result = '';
        for (let i = 0; i < 16; i++) {
          result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
      };

      const newId = generateDjId();

      // 乐观更新：先创建本地角色对象
      const newCharacter: Character = {
        id: newId,
        name: characterData.name,
        description: characterData.description,
        assistantId,
        appearances: characterData.defaultAppearanceId ? [{
          id: characterData.defaultAppearanceId,
          name: '默认形象',
          isDefault: true,
          actions: {},
        }] : [],
        defaultAppearanceId: characterData.defaultAppearanceId,
      };

      try {
        // 调用后端命令 (NEW DATA MODEL)
        const backendCharacter = await invoke<BackendCharacterConfig>('data_add_character', {
          assistantId,
          dto: {
            id: newId,
            name: characterData.name,
            description: characterData.description || null,
          },
        });

        // 使用后端返回的数据更新
        const converted = convertBackendCharacter(backendCharacter, assistantId);
        set((state) => ({
          characters: {
            ...state.characters,
            [assistantId]: [
              ...(state.characters[assistantId] || []),
              converted,
            ],
          },
        }));

        return converted;
      } catch (error) {
        // 后端失败时仍然更新本地状态（乐观更新）
        const errorMsg = error instanceof Error ? error.message : String(error);
        set({ error: errorMsg });
        console.warn('Backend save failed:', error);

        // 乐观更新：即使后端失败也添加到本地状态
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
      }
    },

    updateCharacter: async (characterId, updates) => {
      const { characters } = get();

      try {
        // 调用新命令 (NEW DATA MODEL)
        await invoke('data_update_character', {
          characterId,
          dto: {
            name: updates.name || null,
            description: updates.description || null,
          },
        });

        // 更新前端状态
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
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        set({ error: errorMsg });
        console.warn('Backend update failed:', error);
        throw error;
      }
    },

    deleteCharacter: async (characterId) => {
      const { characters } = get();

      // 乐观更新：先计算要删除的角色
      const updatedCharacters: Record<string, Character[]> = {};
      for (const [assistantId, chars] of Object.entries(characters)) {
        if (chars.find((c) => c.id === characterId)) {
          updatedCharacters[assistantId] = chars.filter(
            (c) => c.id !== characterId
          );
          break;
        }
      }

      try {
        // 调用新命令 (NEW DATA MODEL)
        await invoke('data_delete_character', { characterId });

        // 成功时更新前端状态
        set((state) => ({
          characters: { ...state.characters, ...updatedCharacters },
        }));
      } catch (error) {
        // 后端失败时仍然更新本地状态（乐观更新）
        const errorMsg = error instanceof Error ? error.message : String(error);
        set({ error: errorMsg });
        console.warn('Backend delete failed:', error);

        // 乐观更新：即使后端失败也更新本地状态
        set((state) => ({
          characters: { ...state.characters, ...updatedCharacters },
        }));
      }
    },

    // ============ 形象 Actions ============

    addAppearance: async (characterId, appearanceData) => {
      const { characters } = get();
      let targetCharacter: Character | null = null;
      let targetAssistantId: string | null = null;

      // 找到目标角色
      for (const [assistantId, chars] of Object.entries(characters)) {
        const character = chars.find((c) => c.id === characterId);
        if (character) {
          targetCharacter = character;
          targetAssistantId = assistantId;
          break;
        }
      }

      if (!targetCharacter) {
        throw new Error(`角色 ${characterId} 不存在`);
      }

      // 调用后端命令
      try {
        const newAppearance = await invoke<Appearance>('data_add_appearance', {
          characterId,
          dto: {
            id: generateId('appr'),
            name: appearanceData.name,
            description: appearanceData.description || null,
            is_default: appearanceData.isDefault ?? false,
            actions: JSON.parse(JSON.stringify(DEFAULT_ACTIONS)), // 使用预定义的默认动作列表
          },
        });

        // 更新前端状态
        set((state) => ({
          characters: {
            ...state.characters,
            [targetAssistantId!]: state.characters[targetAssistantId!].map((c) =>
              c.id === characterId
                ? { ...c, appearances: [...c.appearances, newAppearance] }
                : c
            ),
          },
        }));

        return newAppearance;
      } catch (error) {
        console.error('[CharacterManagement] Failed to add appearance:', error);
        throw error;
      }
    },

    updateAppearance: async (appearanceId, updates) => {
      const { characters } = get();

      // 找到包含该形象的角色
      for (const [, chars] of Object.entries(characters)) {
        const found = chars.find((c) =>
          c.appearances.find((a) => a.id === appearanceId)
        );
        if (found) {
          // 调用新命令 (NEW DATA MODEL)
          try {
            await invoke('data_update_appearance', {
              characterId: found.id,
              appearanceId,
              dto: {
                name: updates.name || null,
                description: updates.description || null,
                is_default: updates.isDefault ?? null,
              },
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

      // 找到包含该形象的角色
      for (const [, chars] of Object.entries(characters)) {
        const found = chars.find((c) =>
          c.appearances.find((a) => a.id === appearanceId)
        );
        if (found) {
          // 调用后端命令
          try {
            await invoke('data_delete_appearance', {
              characterId: found.id,
              appearanceId,
            });
          } catch (error) {
            console.error('[CharacterManagement] Failed to delete appearance:', error);
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
      set({ selectedAssistantId: assistantId });
      // 如果有选中的助手，加载其角色列表
      if (assistantId) {
        get().loadCharacters(assistantId);
      } else {
      }
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

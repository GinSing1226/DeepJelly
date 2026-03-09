/**
 * Character Store
 *
 * Meta-Name: Character State Store
 * Meta-Description: 角色状态管理，包括角色配置、动画、位置、缩放等
 */

import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import { CHARACTER_MIN_SCALE, CHARACTER_MAX_SCALE } from '@/config/constants';

// ============ 类型定义 ============

export interface Position {
  x: number;
  y: number;
}

export interface Animation {
  name: string;
  frames: string[];
  frameRate: number;
  loop: boolean;
}

/** 简化的角色信息（用于列表显示） */
export interface CharacterInfo {
  id: string;
  name: string;
  description?: string;
  defaultAppearanceId?: string;
}

/** 角色配置 */
export interface CharacterConfig {
  id: string;
  name: string;
  width: number;
  height: number;
  animations: Animation[];
  defaultAnimation: string;
}

/** 预设缩放选项 */
export type ScalePreset = '50%' | '100%' | '150%' | '200%';

/** 预设缩放值映射 */
const SCALE_PRESETS: Record<ScalePreset, number> = {
  '50%': 0.5,
  '100%': 1.0,
  '150%': 1.5,
  '200%': 2.0,
};

// ============ Store 状态接口 ============

interface CharacterState {
  // ============ 角色配置 ============
  /** 当前角色配置 */
  character: CharacterConfig | null;
  /** 可用角色列表 */
  characters: CharacterInfo[];
  /** 当前角色ID */
  currentCharacterId: string | null;
  /** 当前外观ID */
  currentAppearanceId: string | null;

  // ============ 动画 ============
  /** 当前动画 */
  currentAnimation: string;

  // ============ 位置和缩放 ============
  /** 位置 */
  position: Position;
  /** 缩放比例 */
  scale: number;
  /** 是否正在拖拽 */
  isDragging: boolean;

  // ============ 连接状态 ============
  /** 是否已连接 */
  isConnected: boolean;
  /** 当前会话ID */
  sessionId: string | null;
  /** 当前助手ID */
  assistantId: string | null;

  // ============ 交互模式 ============
  /** 穿透模式 */
  isPenetrationMode: boolean;

  // ============ 错误状态 ============
  /** 错误信息 */
  error: string | null;
  /** 是否正在加载 */
  isLoading: boolean;

  // ============ Actions ============
  setCharacter: (character: CharacterConfig) => void;
  setAnimation: (animation: string) => void;
  setPosition: (x: number, y: number) => void;
  setScale: (scale: number) => void;
  setScaleToPreset: (preset: ScalePreset) => void;
  setDragging: (dragging: boolean) => void;
  setConnected: (connected: boolean) => void;
  setSession: (sessionId: string | null) => void;
  setAssistant: (assistantId: string | null) => void;
  setPenetrationMode: (mode: boolean) => void;
  setError: (error: string | null) => void;

  // ============ 新增 Actions ============
  /** 加载角色列表 */
  loadCharacters: () => Promise<void>;
  /** 设置当前角色 */
  setCurrentCharacter: (characterId: string) => void;
  /** 设置当前外观 */
  setCurrentAppearance: (appearanceId: string) => Promise<void>;
  /** 重置状态 */
  reset: () => void;
}

// ============ 默认状态 ============

const DEFAULT_STATE = {
  character: null,
  characters: [],
  currentCharacterId: null,
  currentAppearanceId: null,
  currentAnimation: 'idle',
  position: { x: 100, y: 100 },
  scale: 1.0,
  isDragging: false,
  isConnected: false,
  sessionId: null,
  assistantId: null,
  isPenetrationMode: false,
  error: null,
  isLoading: false,
};

// ============ Store 实现 ============

export const useCharacterStore = create<CharacterState>((set, get) => ({
  ...DEFAULT_STATE,

  // ============ 基础 Actions ============

  setCharacter: (character) => set({ character }),

  setAnimation: (animation) => set({ currentAnimation: animation }),

  setPosition: (x, y) => set({ position: { x, y } }),

  setScale: (scale) =>
    set({
      scale: Math.max(CHARACTER_MIN_SCALE, Math.min(CHARACTER_MAX_SCALE, scale)),
    }),

  setScaleToPreset: (preset) => {
    const scale = SCALE_PRESETS[preset];
    if (scale !== undefined) {
      set({ scale });
    }
  },

  setDragging: (isDragging) => set({ isDragging }),

  setConnected: (isConnected) => set({ isConnected }),

  setSession: (sessionId) => set({ sessionId }),

  setAssistant: (assistantId) => set({ assistantId }),

  setPenetrationMode: (isPenetrationMode) => set({ isPenetrationMode }),

  setError: (error) => set({ error }),

  // ============ 角色/外观管理 Actions ============

  loadCharacters: async () => {
    set({ isLoading: true, error: null });

    try {
      const characters = await invoke<CharacterInfo[]>('get_all_characters');
      set({ characters, isLoading: false });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to load characters';
      set({ error: errorMessage, isLoading: false });
      throw error;
    }
  },

  setCurrentCharacter: (characterId) => {
    const { characters } = get();
    const character = characters.find((c) => c.id === characterId);

    if (character) {
      set({
        currentCharacterId: characterId,
        // 使用角色的默认外观，如果没有则使用 'default'
        currentAppearanceId: character.defaultAppearanceId || 'default',
      });
    } else {
      set({
        currentCharacterId: characterId,
        error: `Character not found: ${characterId}`,
      });
    }
  },

  setCurrentAppearance: async (appearanceId) => {
    const { currentCharacterId } = get();

    if (!currentCharacterId) {
      set({ error: 'No character selected' });
      return;
    }

    set({ isLoading: true });

    try {
      // 调用后端设置外观
      await invoke('set_current_appearance', {
        characterId: currentCharacterId,
        appearanceId,
      });

      set({
        currentAppearanceId: appearanceId,
        isLoading: false,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to set appearance';
      set({ error: errorMessage, isLoading: false });
    }
  },

  reset: () => set(DEFAULT_STATE),
}));

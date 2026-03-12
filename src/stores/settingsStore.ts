/**
 * 设置状态管理
 *
 * 管理应用设置，包括系统设置、勿扰模式、隐藏状态、积压消息等
 *
 * @module stores/settingsStore
 */

import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import { changeLocale } from '@/i18n/init';
import i18n from '@/i18n/config';
import type { BoundApp } from '@/types/appConfig';

/** 路由信息 */
export interface MessageRouting {
  sessionKey?: string; // 会话密钥，格式: agent:{assistantId}:{sessionId}
}

export interface QueuedMessage {
  id: string;
  content: string;
  type: 'chat' | 'status' | 'notification' | 'behavior';
  sender: 'user' | 'assistant' | 'system';
  timestamp: number;
  duration?: number; // 显示时长（毫秒），0表示永久显示
  receiverId?: string; // 接收者ID（用于过滤发给特定角色的消息）
  routing?: MessageRouting; // 路由信息（用于根据sessionKey过滤）
  emoji?: string; // emoji 图标（用于 status 类型消息）
  behavior?: {
    action_id: string;
    urgency: number;
    intensity: number;
    duration_ms: number | null;
  };
}

export interface AppSettings {
  // 系统设置
  autoLaunch: boolean;        // 开机自启动
  language: 'zh' | 'en' | 'ja';  // 界面语言
  brainUrl: string;           // AI应用地址

  // 绑定状态
  boundApp: BoundApp | null;  // 已绑定的AI应用

  // 运行时状态（不持久化）
  isDoNotDisturb: boolean;    // 勿扰模式
  isHidden: boolean;          // 隐藏角色
  queuedMessages: QueuedMessage[];  // 勿扰期间积压的消息
  dialogExplicitlyClosed: boolean;  // 用户主动关闭对话框标志
}

interface SettingsState extends AppSettings {
  // Computed
  isBound: boolean;

  // Settings Actions
  setAutoLaunch: (value: boolean) => Promise<void>;
  setLanguage: (language: 'zh' | 'en' | 'ja') => Promise<void>;
  setBrainUrl: (url: string) => void;

  // Binding Actions
  setBoundApp: (app: BoundApp) => void;
  clearBoundApp: () => void;

  // DND Actions
  toggleDoNotDisturb: () => void;
  setDoNotDisturb: (value: boolean) => void;

  // Hide Actions
  toggleHidden: () => void;
  setHidden: (value: boolean) => void;

  // Queue Actions
  queueMessage: (message: QueuedMessage) => void;
  clearQueue: () => void;
  getQueuedMessages: () => QueuedMessage[];

  // Dialog Actions
  setDialogExplicitlyClosed: (closed: boolean) => void;

  // Reset
  resetSettings: () => void;

  // Load settings from backend
  loadSettings: () => Promise<void>;
}

const defaultSettings: AppSettings = {
  autoLaunch: false,
  language: 'zh',
  brainUrl: 'ws://127.0.0.1:18790',
  boundApp: null,
  isDoNotDisturb: false,
  isHidden: false,
  queuedMessages: [],
  dialogExplicitlyClosed: false,
};

export const useSettingsStore = create<SettingsState>()((set, get) => ({
  ...defaultSettings,

  // Computed
  isBound: defaultSettings.boundApp !== null,

  // Settings Actions
  setAutoLaunch: async (autoLaunch) => {
    try {
      await invoke('set_auto_launch', { enabled: autoLaunch });
      set({ autoLaunch });
    } catch (error) {
      console.error('[SettingsStore] Failed to set auto-launch:', error);
    }
  },
  setLanguage: async (language) => {
    try {
      await changeLocale(language);
      set({ language });
    } catch (error) {
      console.error('[SettingsStore] Failed to change language:', error);
    }
  },
  setBrainUrl: (brainUrl) => set({ brainUrl }),

  // Binding Actions
  setBoundApp: (boundApp) => set({ boundApp, isBound: true }),
  clearBoundApp: () => set({ boundApp: null, isBound: false }),

  // DND Actions
  toggleDoNotDisturb: () => {
    const state = get();
    const newDndState = !state.isDoNotDisturb;

    set({ isDoNotDisturb: newDndState });
  },

  setDoNotDisturb: (isDoNotDisturb) => {
    set({ isDoNotDisturb });
  },

  // Hide Actions
  toggleHidden: () => set((state) => ({ isHidden: !state.isHidden })),
  setHidden: (isHidden) => set({ isHidden }),

  // Queue Actions
  queueMessage: (message) => {
    set((state) => ({
      queuedMessages: [...state.queuedMessages, message],
    }));
  },

  clearQueue: () => set({ queuedMessages: [] }),

  getQueuedMessages: () => get().queuedMessages,

  // Dialog Actions
  setDialogExplicitlyClosed: (dialogExplicitlyClosed) => set({ dialogExplicitlyClosed }),

  // Reset
  resetSettings: () => set({
    ...defaultSettings,
    // 保留语言设置
    language: get().language,
  }),

  // Load settings from i18n (which was already initialized from backend)
  loadSettings: async () => {
    try {
      // Read from i18n which was already initialized from backend via initI18n()
      // This avoids duplicate get_locale calls
      const currentLocale = i18n.language;
      if (['zh', 'en', 'ja'].includes(currentLocale)) {
        set({ language: currentLocale as 'zh' | 'en' | 'ja' });
      }
    } catch (error) {
      console.error('[SettingsStore] Failed to load settings:', error);
    }
  },
}));

/**
 * 获取屏幕中央位置
 */
export function getScreenCenter(): { x: number; y: number } {
  return {
    x: Math.floor(window.screen.width / 2),
    y: Math.floor(window.screen.height / 2),
  };
}

/**
 * 获取屏幕边缘位置（勿扰模式使用）
 */
export function getScreenEdge(): { x: number; y: number } {
  // 返回屏幕右下角位置
  return {
    x: window.screen.width - 100,
    y: window.screen.height - 100,
  };
}

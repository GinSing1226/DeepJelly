/**
 * App Integration Store
 *
 * 管理AI应用集成配置（AppIntegration）
 * 一个应用集成代表一个 AI 应用的连接配置（如某个 OpenClaw 实例）
 */

import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import type { AppIntegration } from '@/types/appConfig';

interface AppIntegrationState {
  integrations: AppIntegration[];
  currentIntegration: AppIntegration | null;
  pendingEditIntegrationId: string | null;  // 待编辑的集成ID（跨窗口通信）

  // Actions
  loadIntegrations: () => Promise<void>;
  addIntegration: (integration: Omit<AppIntegration, 'id' | 'applicationId' | 'createdAt'>) => Promise<AppIntegration>;
  updateIntegration: (id: string, updates: Partial<AppIntegration>) => Promise<void>;
  deleteIntegration: (id: string) => Promise<void>;
  getIntegration: (id: string) => AppIntegration | undefined;
  setCurrentIntegration: (integration: AppIntegration | null) => void;
  setPendingEditIntegrationId: (id: string | null) => void;
}

export const useAppIntegrationStore = create<AppIntegrationState>((set, get) => ({
  integrations: [],
  currentIntegration: null,
  pendingEditIntegrationId: null,

  /**
   * 加载所有应用集成配置
   */
  loadIntegrations: async () => {
    try {
      const integrations = await invoke<AppIntegration[]>('get_app_integrations');
      set({ integrations });
    } catch (error) {
      console.error('[AppIntegrationStore] Failed to load integrations:', error);
      throw error;
    }
  },

  /**
   * 添加新的应用集成配置
   * 自动生成 id 和 applicationId
   */
  addIntegration: async (integration) => {
    try {
      // 添加空的 id 和 applicationId，让后端自动生成
      const integrationWithIds: AppIntegration = {
        id: '',
        applicationId: '',
        createdAt: Date.now(),
        ...integration,
      };
      const newIntegration = await invoke<AppIntegration>('add_app_integration', { integration: integrationWithIds });
      set((state) => ({
        integrations: [...state.integrations, newIntegration],
      }));
      return newIntegration;
    } catch (error) {
      console.error('[AppIntegrationStore] Failed to add integration:', error);
      throw error;
    }
  },

  /**
   * 更新应用集成配置
   */
  updateIntegration: async (id, updates) => {
    try {
      await invoke('update_app_integration', { id, updates });
      set((state) => ({
        integrations: state.integrations.map((i) =>
          i.id === id ? { ...i, ...updates } : i
        ),
      }));
    } catch (error) {
      console.error('[AppIntegrationStore] Failed to update integration:', error);
      throw error;
    }
  },

  /**
   * 删除应用集成配置
   */
  deleteIntegration: async (id) => {
    try {
      await invoke('delete_app_integration', { id });
      set((state) => ({
        integrations: state.integrations.filter((i) => i.id !== id),
        currentIntegration: state.currentIntegration?.id === id ? null : state.currentIntegration,
      }));
    } catch (error) {
      console.error('[AppIntegrationStore] Failed to delete integration:', error);
      throw error;
    }
  },

  /**
   * 根据ID获取应用集成配置
   */
  getIntegration: (id) => {
    return get().integrations.find((i) => i.id === id);
  },

  /**
   * 设置当前应用集成
   */
  setCurrentIntegration: (integration) => {
    set({ currentIntegration: integration });
  },

  /**
   * 设置待编辑的集成ID（用于跨窗口通信）
   */
  setPendingEditIntegrationId: (id) => {
    set({ pendingEditIntegrationId: id });
  },
}));

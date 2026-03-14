/**
 * Brain Store (OpenClaw Connection)
 *
 * 管理与 OpenClaw 的连接状态和助手列表
 */

import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';

/**
 * 缓存项
 */
interface CacheItem<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
}

/**
 * 消息缓存配置
 */
const CACHE_CONFIG = {
  TTL: 5 * 60 * 1000, // 5分钟过期
  MAX_SESSIONS: 20, // 最多缓存20个会话
};

/**
 * 生成缓存键
 */
function getCacheKey(sessionId: string, limit: number, offset: number, beforeTimestamp?: number): string {
  const parts = [sessionId, limit, offset];
  if (beforeTimestamp !== undefined) {
    parts.push(beforeTimestamp);
  }
  return parts.join(':');
}

/**
 * 检查缓存是否有效
 */
function isCacheValid<T>(cache: CacheItem<T>): boolean {
  return Date.now() < cache.expiresAt;
}

/**
 * AI 助手信息
 */
export interface Assistant {
  id: string;
  name: string;
  description?: string;
  status: string;
  model?: string;
  avatar?: string;
}

/**
 * 会话消息
 */
export interface SessionMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: number;
  message_id?: string;
  status?: string;
}

/**
 * 会话信息
 */
export interface SessionInfo {
  sessionKey: string;
  key?: string; // 某些 API 使用 key 而不是 sessionKey
  kind?: string;
  label?: string;
  displayName?: string;
  messages?: SessionMessage[];
  createdAt?: number;
  updatedAt?: number;
}

/**
 * Brain adapter 配置
 */
export interface BrainAdapterSettings extends Record<string, unknown> {
  /**
   * OpenClaw Gateway 认证 Token
   * 用户从 OpenClaw 设置中获取并配置到 DeepJelly
   */
  auth_token?: string;
  type: string;
  url: string;
  protocol: string;
  reconnect_interval_ms: number;
  timeout_ms: number;
}

/**
 * Brain Store 状态
 */
interface BrainState {
  connected: boolean;
  connecting: boolean;
  url: string;
  assistants: Assistant[];
  config: BrainAdapterSettings | null;
  error: string | null;

  // 消息缓存
  messageCache: Map<string, CacheItem<SessionMessage[]>>;

  // Actions
  connect: (url?: string) => Promise<void>;
  connectAndSetConfig: (url: string, authToken: string) => Promise<void>;
  disconnect: () => Promise<void>;
  testConnection: (url?: string) => Promise<{ connected: boolean; error?: string }>;
  getAgents: () => Promise<void>;
  getConfig: () => Promise<void>;
  setConfig: (settings: BrainAdapterSettings) => Promise<void>;
  verifyConnection: () => Promise<boolean>;
  resetConnecting: () => void;

  // 消息相关 Actions
  sendMessage: (sessionId: string, content: string) => Promise<{ message_id: string; status: string; error?: string }>;
  getSessionHistory: (sessionId: string, limit?: number, offset?: number, beforeTimestamp?: number) => Promise<SessionMessage[]>;
  clearMessageCache: () => void;

  // 多会话相关 Actions
  getAllSessions: (limit?: number) => Promise<SessionInfo[]>;
  getAgentSessions: (agentId: string) => Promise<SessionInfo[]>;
  getSessionsByCharacterId: (characterId: string, limit?: number) => Promise<SessionInfo[]>;
}

export const useBrainStore = create<BrainState>((set, get) => ({
  connected: false,
  connecting: false,
  url: 'ws://127.0.0.1:18790',
  assistants: [],
  config: null,
  error: null,
  messageCache: new Map<string, CacheItem<SessionMessage[]>>(),

  /**
   * 验证连接是否真正可用
   * 检查WebSocket连接状态即可，不需要调用get_assistants
   * MVP阶段：通道建立后，用户在引导页选择助手并配置绑定
   */
  verifyConnection: async () => {
    try {
      const connected = await invoke<boolean>('is_brain_connected');
      return connected;
    } catch (error) {
      console.error('[BrainStore] Connection verification failed:', error);
      return false;
    }
  },

  /**
   * 重置连接状态（用于超时等异常情况）
   */
  resetConnecting: () => {
    set({ connecting: false });
  },

  /**
   * 连接到Brain，使用当前存储的URL
   */
  connect: async (url?: string) => {
    const targetUrl = url || get().url;
    set({ connecting: true, error: null });
    try {
      await invoke('connect_brain');

      // 连接建立后，验证连接是否真正可用
      const isValid = await get().verifyConnection();

      if (!isValid) {
        throw new Error('Connection established but verification failed');
      }

      set({ connected: true, connecting: false, url: targetUrl });
    } catch (error) {
      console.error('[BrainStore] Connection failed:', error);
      set({
        connected: false,
        connecting: false,
        error: String(error)
      });
      throw error;
    }
  },

  /**
   * 设置配置并连接（用户提供了 auth_token）
   */
  connectAndSetConfig: async (url: string, authToken: string) => {

    // 创建配置对象
    const settings: BrainAdapterSettings = {
      auth_token: authToken,
      type: 'websocket',
      url: url,
      protocol: 'jsonrpc',
      reconnect_interval_ms: 5000,
      timeout_ms: 30000,
    };

    try {
      await invoke('set_brain_config', { settings });
      set({ config: settings, url });
      await get().connect(url);
    } catch (error) {
      console.error('[BrainStore] connectAndSetConfig FAILED:', error);
      set({ error: String(error) });
      throw error;
    }
  },

  disconnect: async () => {
    try {
      await invoke('disconnect_brain');
      set({ connected: false, assistants: [] });
    } catch (error) {
      console.error('[BrainStore] Disconnect failed:', error);
      set({ error: String(error) });
      throw error;
    }
  },

  testConnection: async (url?: string) => {
    return await invoke('test_brain_connection', { url });
  },

  getAgents: async () => {
    try {
      const agents = await invoke<Assistant[]>('get_agents');
      set({ assistants: agents });
    } catch (error) {
      set({ error: String(error) });
      throw error;
    }
  },

  getConfig: async () => {
    try {
      const config = await invoke<BrainAdapterSettings>('get_brain_config');
      set({ config, url: config.url });
    } catch (error) {
      set({ error: String(error) });
      throw error;
    }
  },

  setConfig: async (settings: BrainAdapterSettings) => {
    try {
      await invoke('set_brain_config', { settings });
      set({ config: settings, url: settings.url });
    } catch (error) {
      set({ error: String(error) });
      throw error;
    }
  },

  /**
   * 发送消息到指定会话
   */
  sendMessage: async (sessionId, content) => {
    try {
      const params = { sessionId, content };
      const result = await invoke<{message_id: string; status: string; error?: string}>('send_message', params);

      if (result && result.status === 'failed') {
        const errorMsg = result.error || 'Unknown error';
        console.error('[BrainStore] Message send failed:', errorMsg);
        throw new Error(errorMsg);
      }

      // 发送成功后清除该会话的缓存，确保下次获取包含新消息
      const cache = get().messageCache;
      // 清除该 sessionId 的所有缓存项
      for (const [key] of cache.keys()) {
        if (key.startsWith(`${sessionId}:`)) {
          cache.delete(key);
        }
      }
      return result;
    } catch (error) {
      console.error('[BrainStore] Failed to send message:', error);
      const errorMsg = error instanceof Error ? error.message : String(error);
      set({ error: errorMsg });
      throw new Error(errorMsg);
    }
  },

  /**
   * 获取会话历史消息（带缓存）
   * 通过 OpenClaw Gateway API 获取，使用缓存减少重复请求
   */
  getSessionHistory: async (sessionId, limit = 50, offset = 0, beforeTimestamp?) => {
    const cacheKey = getCacheKey(sessionId, limit, offset, beforeTimestamp);
    const cache = get().messageCache;

    // 检查缓存
    const cached = cache.get(cacheKey);
    if (cached && isCacheValid(cached)) {
      return cached.data;
    }

    try {
      const rawResult = await invoke<unknown>('get_session_history', { sessionId, limit, offset, beforeTimestamp });

      // Handle different response formats from OpenClaw
      let messages: SessionMessage[] = [];

      if (Array.isArray(rawResult)) {
        messages = rawResult as SessionMessage[];
      } else if (rawResult && typeof rawResult === 'object' && 'result' in rawResult) {
        const result = (rawResult as any).result;
        if (result?.details?.messages && Array.isArray(result.details.messages)) {
          messages = result.details.messages as SessionMessage[];
        } else if (result?.messages && Array.isArray(result.messages)) {
          messages = result.messages as SessionMessage[];
        } else if (result?.sessions && Array.isArray(result.sessions)) {
          console.error('[BrainStore] ❌ Backend returned sessions instead of messages!');
          messages = [];
        }
      } else if (rawResult && typeof rawResult === 'object' && 'messages' in rawResult) {
        const msgs = (rawResult as any).messages;
        if (Array.isArray(msgs)) {
          messages = msgs as SessionMessage[];
        }
      } else if (rawResult && typeof rawResult === 'object' && 'data' in rawResult) {
        const data = (rawResult as any).data;
        if (Array.isArray(data)) {
          messages = data as SessionMessage[];
        }
      } else {
        console.warn('[BrainStore] Unexpected response format:', rawResult);
        messages = [];
      }

      // 存入缓存
      const now = Date.now();
      const cacheItem: CacheItem<SessionMessage[]> = {
        data: messages,
        timestamp: now,
        expiresAt: now + CACHE_CONFIG.TTL,
      };

      // 限制缓存大小
      if (cache.size >= CACHE_CONFIG.MAX_SESSIONS) {
        // 删除最旧的缓存项
        const firstKey = cache.keys().next().value;
        if (firstKey) {
          cache.delete(firstKey);
        }
      }
      cache.set(cacheKey, cacheItem);
      return messages;
    } catch (error) {
      console.error('[BrainStore] Failed to get session history:', error);
      set({ error: String(error) });
      throw error;
    }
  },

  /**
   * 清空消息缓存
   */
  clearMessageCache: () => {
    const cache = get().messageCache;
    cache.clear();
  },

  /**
   * 获取所有会话列表
   *
   * 使用 OpenClaw Gateway 的 sessions.list 方法
   *
   * @param limit - 最大返回会话数（默认：不限制）
   */
  getAllSessions: async (limit = 100) => {
    try {
      const rawResult = await invoke<unknown>('get_all_sessions', {
        limit,
      });
      // Handle different response formats
      let sessions: SessionInfo[] = [];

      if (Array.isArray(rawResult)) {
        sessions = rawResult as SessionInfo[];
      } else if (rawResult && typeof rawResult === 'object') {
        const result = rawResult as any;
        if (result.sessions && Array.isArray(result.sessions)) {
          sessions = result.sessions as SessionInfo[];
        } else if (result.result?.details?.sessions && Array.isArray(result.result.details.sessions)) {
          sessions = result.result.details.sessions as SessionInfo[];
        }
      }
      return sessions;
    } catch (error) {
      console.error('[BrainStore] Failed to get all sessions:', error);
      set({ error: String(error) });
      throw error;
    }
  },

  /**
   * 获取指定 Agent 的所有会话
   *
   * @param agentId - Agent ID (e.g., "christina", "assistant")
   * @returns 该 agent 关联的所有 session key
   */
  getAgentSessions: async (agentId: string) => {
    try {
      // 获取所有会话（不限制数量）
      const allSessions = await get().getAllSessions(10000);
      // 过滤出属于该 agent 的会话
      // Session key 格式: agent:<agentId>:main 或 agent:<agentId>:<channel>:<peerId>
      const agentSessions = allSessions.filter((session: SessionInfo) => {
        // 支持 sessionKey 和 key 两种字段名
        const sessionKey = session.sessionKey || session.key || '';
        if (!sessionKey) {
          console.warn('[BrainStore] Session missing sessionKey/key:', session);
          return false;
        }

        // sessionKey 格式: agent:<agentId>:...
        const parts = sessionKey.split(':');
        if (parts.length >= 2 && parts[0] === 'agent') {
          const sessionAgentId = parts[1];
          const matches = sessionAgentId.toLowerCase() === agentId.toLowerCase();
          if (!matches) {
          }
          // 使用小写比较（agent ID 是大小写不敏感的）
          return matches;
        }
        return false;
      });
      // 按 sessionKey 排序 (main 在前，其他按字母序)
      agentSessions.sort((a: SessionInfo, b: SessionInfo) => {
        const keyA = a.sessionKey || a.key || '';
        const keyB = b.sessionKey || b.key || '';
        // main 会话优先
        if (keyA.endsWith(':main')) return -1;
        if (keyB.endsWith(':main')) return 1;
        return keyA.localeCompare(keyB);
      });

      // 输出所有找到的 session key 用于调试
      // agentSessions.forEach((s: SessionInfo) => {
      //   console.log('[BrainStore] Found session:', s.sessionKey || s.key);
      // });

      return agentSessions;
    } catch (error) {
      console.error('[BrainStore] ❌ Failed to get agent sessions:', error);
      set({ error: String(error) });
      throw error;
    }
  },

  /**
   * 获取指定角色的会话列表
   *
   * @param characterId - Character ID
   * @param limit - 最大返回会话数（默认：100）
   * @returns 该角色绑定的 agent 的所有会话
   */
  getSessionsByCharacterId: async (characterId: string, limit = 100) => {
    try {
      const rawResult = await invoke<unknown>('get_all_sessions', {
        characterId,
        limit,
      });
      // Handle different response formats
      let sessions: SessionInfo[] = [];

      if (Array.isArray(rawResult)) {
        sessions = rawResult as SessionInfo[];
      } else if (rawResult && typeof rawResult === 'object') {
        const result = rawResult as any;
        if (result.sessions && Array.isArray(result.sessions)) {
          sessions = result.sessions as SessionInfo[];
        }
      }
      return sessions;
    } catch (error) {
      console.error('[BrainStore] ❌ Failed to get sessions by characterId:', error);
      set({ error: String(error) });
      throw error;
    }
  },
}));

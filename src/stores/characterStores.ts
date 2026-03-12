/**
 * Character-Isolated Stores
 *
 * Meta-Name: Character-Isolated Stores
 * Meta-Description: 按角色ID隔离的状态管理，每个角色有自己的动画队列、状态气泡、会话队列
 *
 * 这些 store 用于 MessageGateway 分发消息到正确的角色
 *
 * @module stores/characterStores
 */

import { create } from 'zustand';

// ============ 动画队列 Store ============

/** 动画请求 */
export interface AnimationRequest {
  animationId: string;
  urgency: 'low' | 'normal' | 'high';
  intensity: number;
  duration?: number;
}

/** 角色动画队列状态 */
interface CharacterAnimationState {
  /** 按角色ID分组的动画队列 */
  queues: Record<string, AnimationRequest[]>;
  /** 当前正在播放的动画 */
  currentAnimations: Record<string, AnimationRequest | null>;

  // Actions
  enqueue: (characterId: string, request: AnimationRequest) => void;
  dequeue: (characterId: string) => AnimationRequest | undefined;
  peek: (characterId: string) => AnimationRequest | undefined;
  clear: (characterId: string) => void;
  setCurrent: (characterId: string, request: AnimationRequest | null) => void;
  getCurrent: (characterId: string) => AnimationRequest | null;
  getQueue: (characterId: string) => AnimationRequest[];
}

export const animationQueueStore = create<CharacterAnimationState>((set, get) => ({
  queues: {},
  currentAnimations: {},

  enqueue: (characterId, request) => {
    set((state) => ({
      queues: {
        ...state.queues,
        [characterId]: [...(state.queues[characterId] || []), request],
      },
    }));
  },

  dequeue: (characterId) => {
    const queue = get().queues[characterId] || [];
    if (queue.length === 0) return undefined;

    const [first, ...rest] = queue;
    set((state) => ({
      queues: {
        ...state.queues,
        [characterId]: rest,
      },
    }));
    return first;
  },

  peek: (characterId) => {
    const queue = get().queues[characterId] || [];
    return queue[0];
  },

  clear: (characterId) => {
    set((state) => ({
      queues: {
        ...state.queues,
        [characterId]: [],
      },
      currentAnimations: {
        ...state.currentAnimations,
        [characterId]: null,
      },
    }));
  },

  setCurrent: (characterId, request) => {
    set((state) => ({
      currentAnimations: {
        ...state.currentAnimations,
        [characterId]: request,
      },
    }));
  },

  getCurrent: (characterId) => {
    return get().currentAnimations[characterId] || null;
  },

  getQueue: (characterId) => {
    return get().queues[characterId] || [];
  },
}));

// ============ 状态气泡 Store ============

/** 状态气泡数据 */
export interface CharacterStatus {
  emoji: string;
  text: string;
  /** 显示持续时间（毫秒），undefined 表示无限显示直到被新状态替换或清空 */
  duration?: number;
  timestamp: number;
}

/** 角色状态气泡状态 */
interface CharacterStatusState {
  /** 按角色ID分组的状态 */
  statuses: Record<string, CharacterStatus | null>;

  // Actions
  setStatus: (characterId: string, status: Omit<CharacterStatus, 'timestamp'>) => void;
  clearStatus: (characterId: string) => void;
  getStatus: (characterId: string) => CharacterStatus | null;
}

export const statusBubbleStore = create<CharacterStatusState>((set, get) => ({
  statuses: {},

  setStatus: (characterId, status) => {
    set((state) => ({
      statuses: {
        ...state.statuses,
        [characterId]: {
          ...status,
          timestamp: Date.now(),
        },
      },
    }));
  },

  clearStatus: (characterId) => {
    set((state) => ({
      statuses: {
        ...state.statuses,
        [characterId]: null,
      },
    }));
  },

  getStatus: (characterId) => {
    return get().statuses[characterId] || null;
  },
}));

// ============ 会话队列 Store ============

/** 会话消息 */
export interface CharacterSession {
  id: string;
  sessionId: string;
  receiverId: string;
  sender: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  displayMode: 'bubble_only' | 'panel_only' | 'bubble_and_panel';
  /** 原始 CAP 消息 */
  _raw?: unknown;
}

/** 角色会话队列状态 */
interface CharacterSessionState {
  /** 按角色ID分组的会话队列 */
  sessions: Record<string, CharacterSession[]>;

  // Actions
  addSession: (characterId: string, session: Omit<CharacterSession, 'id'>) => void;
  removeSession: (characterId: string, sessionId: string) => void;
  clearSessions: (characterId: string) => void;
  getSessions: (characterId: string) => CharacterSession[];
  getLatestSession: (characterId: string) => CharacterSession | null;
}

let sessionSeqNo = 0;

export const sessionQueueStore = create<CharacterSessionState>((set, get) => ({
  sessions: {},

  addSession: (characterId, session) => {
    const id = `session_${Date.now()}_${++sessionSeqNo}_${Math.random().toString(36).substr(2, 5)}`;
    set((state) => ({
      sessions: {
        ...state.sessions,
        [characterId]: [
          ...(state.sessions[characterId] || []),
          { ...session, id },
        ],
      },
    }));
  },

  removeSession: (characterId, sessionId) => {
    set((state) => ({
      sessions: {
        ...state.sessions,
        [characterId]: (state.sessions[characterId] || []).filter(
          (s) => s.id !== sessionId
        ),
      },
    }));
  },

  clearSessions: (characterId) => {
    set((state) => ({
      sessions: {
        ...state.sessions,
        [characterId]: [],
      },
    }));
  },

  getSessions: (characterId) => {
    return get().sessions[characterId] || [];
  },

  getLatestSession: (characterId) => {
    const sessions = get().sessions[characterId] || [];
    return sessions.length > 0 ? sessions[sessions.length - 1] : null;
  },
}));

// ============ 组合 Hook（用于组件订阅） ============

import { useCallback } from 'react';

/**
 * 使用指定角色的动画队列
 */
export function useCharacterAnimation(characterId: string) {
  const enqueue = useCallback(
    (request: AnimationRequest) => animationQueueStore.getState().enqueue(characterId, request),
    [characterId]
  );

  const dequeue = useCallback(
    () => animationQueueStore.getState().dequeue(characterId),
    [characterId]
  );

  const peek = useCallback(
    () => animationQueueStore.getState().peek(characterId),
    [characterId]
  );

  const clear = useCallback(
    () => animationQueueStore.getState().clear(characterId),
    [characterId]
  );

  const getCurrent = useCallback(
    () => animationQueueStore.getState().getCurrent(characterId),
    [characterId]
  );

  const getQueue = useCallback(
    () => animationQueueStore.getState().getQueue(characterId),
    [characterId]
  );

  return {
    enqueue,
    dequeue,
    peek,
    clear,
    getCurrent,
    getQueue,
  };
}

/**
 * 使用指定角色的状态气泡
 */
export function useCharacterStatus(characterId: string) {
  const setStatus = useCallback(
    (status: Omit<CharacterStatus, 'timestamp'>) =>
      statusBubbleStore.getState().setStatus(characterId, status),
    [characterId]
  );

  const clearStatus = useCallback(
    () => statusBubbleStore.getState().clearStatus(characterId),
    [characterId]
  );

  const getStatus = useCallback(
    () => statusBubbleStore.getState().getStatus(characterId),
    [characterId]
  );

  return {
    setStatus,
    clearStatus,
    getStatus,
  };
}

/**
 * 使用指定角色的会话队列
 */
export function useCharacterSessions(characterId: string) {
  const addSession = useCallback(
    (session: Omit<CharacterSession, 'id'>) =>
      sessionQueueStore.getState().addSession(characterId, session),
    [characterId]
  );

  const removeSession = useCallback(
    (sessionId: string) =>
      sessionQueueStore.getState().removeSession(characterId, sessionId),
    [characterId]
  );

  const clearSessions = useCallback(
    () => sessionQueueStore.getState().clearSessions(characterId),
    [characterId]
  );

  const getSessions = useCallback(
    () => sessionQueueStore.getState().getSessions(characterId),
    [characterId]
  );

  const getLatestSession = useCallback(
    () => sessionQueueStore.getState().getLatestSession(characterId),
    [characterId]
  );

  return {
    addSession,
    removeSession,
    clearSessions,
    getSessions,
    getLatestSession,
  };
}

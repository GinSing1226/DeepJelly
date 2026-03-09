/**
 * Session Store
 *
 * Manages conversation sessions for the dialog window.
 * Each session represents a conversation with an assistant or group.
 */

import { create } from 'zustand';

export interface SessionMessage {
  id: string;
  content: string;
  sender: 'user' | 'assistant' | 'system';
  timestamp: number;
  isStreaming?: boolean;
}

export interface Session {
  id: string;
  title: string;
  assistantId?: string;
  assistantName?: string;
  assistantAvatar?: string;
  lastMessage?: string;
  lastMessageTime?: number;
  unreadCount: number;
  isGroup: boolean;
  createdAt: number;
  updatedAt: number;
}

interface SessionState {
  // All sessions
  sessions: Session[];
  // Current active session ID
  currentSessionId: string | null;
  // Messages by session ID
  messagesBySession: Record<string, SessionMessage[]>;
  // Loading states
  isLoading: boolean;
  isSending: boolean;

  // Actions
  setSessions: (sessions: Session[]) => void;
  addSession: (session: Omit<Session, 'id' | 'createdAt' | 'updatedAt' | 'unreadCount'>) => string;
  updateSession: (id: string, updates: Partial<Session>) => void;
  removeSession: (id: string) => void;
  setCurrentSession: (id: string | null) => void;
  markAsRead: (id: string) => void;

  // Message actions
  getMessages: (sessionId: string) => SessionMessage[];
  addMessage: (sessionId: string, message: Omit<SessionMessage, 'id'>) => string;
  updateMessage: (sessionId: string, messageId: string, updates: Partial<SessionMessage>) => void;
  clearMessages: (sessionId: string) => void;

  // Loading states
  setLoading: (loading: boolean) => void;
  setSending: (sending: boolean) => void;
}

export const useSessionStore = create<SessionState>((set, get) => ({
  sessions: [],
  currentSessionId: null,
  messagesBySession: {},
  isLoading: false,
  isSending: false,

  setSessions: (sessions) => set({ sessions }),

  addSession: (sessionData) => {
    const id = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = Date.now();

    const newSession: Session = {
      ...sessionData,
      id,
      unreadCount: 0,
      createdAt: now,
      updatedAt: now,
    };

    set((state) => ({
      sessions: [newSession, ...state.sessions],
      messagesBySession: {
        ...state.messagesBySession,
        [id]: [],
      },
    }));

    return id;
  },

  updateSession: (id, updates) => {
    set((state) => ({
      sessions: state.sessions.map((s) =>
        s.id === id ? { ...s, ...updates, updatedAt: Date.now() } : s
      ),
    }));
  },

  removeSession: (id) => {
    set((state) => {
      const { [id]: _, ...remainingMessages } = state.messagesBySession;
      return {
        sessions: state.sessions.filter((s) => s.id !== id),
        messagesBySession: remainingMessages,
        currentSessionId: state.currentSessionId === id ? null : state.currentSessionId,
      };
    });
  },

  setCurrentSession: (id) => set({ currentSessionId: id }),

  markAsRead: (id) => {
    set((state) => ({
      sessions: state.sessions.map((s) =>
        s.id === id ? { ...s, unreadCount: 0 } : s
      ),
    }));
  },

  getMessages: (sessionId) => {
    const messages = get().messagesBySession[sessionId] || [];
    // 按时间戳升序排序（旧消息在前，新消息在后 - 传统IM方式）
    return [...messages].sort((a, b) => a.timestamp - b.timestamp);
  },

  addMessage: (sessionId, messageData) => {
    const id = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    // 使用传入的 timestamp（如果有），否则使用当前时间
    const timestamp = 'timestamp' in messageData ? (messageData as SessionMessage).timestamp : Date.now();
    const newMessage: SessionMessage = {
      ...messageData,
      id,
      timestamp,
    };

    set((state) => {
      const messages = state.messagesBySession[sessionId] || [];
      return {
        messagesBySession: {
          ...state.messagesBySession,
          [sessionId]: [...messages, newMessage],
        },
        sessions: state.sessions.map((s) =>
          s.id === sessionId
            ? {
                ...s,
                lastMessage: messageData.content.slice(0, 50),
                lastMessageTime: timestamp,
                updatedAt: timestamp,
                unreadCount: messageData.sender !== 'user' ? s.unreadCount + 1 : s.unreadCount,
              }
            : s
        ),
      };
    });

    return id;
  },

  updateMessage: (sessionId, messageId, updates) => {
    set((state) => {
      const messages = state.messagesBySession[sessionId] || [];
      return {
        messagesBySession: {
          ...state.messagesBySession,
          [sessionId]: messages.map((m) =>
            m.id === messageId ? { ...m, ...updates } : m
          ),
        },
      };
    });
  },

  clearMessages: (sessionId) => {
    set((state) => ({
      messagesBySession: {
        ...state.messagesBySession,
        [sessionId]: [],
      },
    }));
  },

  setLoading: (isLoading) => set({ isLoading }),
  setSending: (isSending) => set({ isSending }),
}));

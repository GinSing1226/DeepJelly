/**
 * Session Queue Store
 *
 * session类型的聊天消息队列
 * 与event队列分离
 * 在speak动画播放完成后移除
 */

import { create } from 'zustand';

/** 全局会话序列号计数器 */
let sessionSeqNo = 0;

/** 获取下一个会话序列号 */
function getNextSessionSeqNo(): number {
  return ++sessionSeqNo;
}

export interface SessionMessage {
  id: string;
  seqNo: number;
  sessionId: string;
  content: string;
  sender: 'user' | 'assistant' | 'system';
  displayMode: 'bubble_only' | 'panel_only' | 'bubble_and_panel';
  timestamp: number;
  receiverId?: string;
  // 标记speak动画是否播放完成
  speakCompleted: boolean;
  // agent_end标记
  isAgentEnd: boolean;
}

interface SessionQueueState {
  sessions: SessionMessage[];

  // 添加session消息
  addSession: (session: Omit<SessionMessage, 'id' | 'seqNo' | 'timestamp' | 'speakCompleted'>) => void;

  // 标记speak播放完成
  markSpeakCompleted: (id: string) => void;

  // 移除session（speak播放完成时）
  removeSession: (id: string) => void;

  // 获取指定角色的session
  getByReceiverId: (receiverId: string) => SessionMessage[];

  // 清空所有session
  clear: () => void;
}

export const useSessionQueueStore = create<SessionQueueState>((set, get) => ({
  sessions: [],

  addSession: (session) => {
    const seqNo = getNextSessionSeqNo();
    const id = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const newSession: SessionMessage = {
      ...session,
      id,
      seqNo,
      timestamp: Date.now(),
      speakCompleted: false,
    };

    set((state) => ({
      sessions: [...state.sessions, newSession],
    }));
  },

  markSpeakCompleted: (id) => {
    set((state) => {
      return {
        sessions: state.sessions.map(s =>
          s.id === id ? { ...s, speakCompleted: true } : s
        ),
      };
    });
  },

  removeSession: (id) => {
    set((state) => {
      return {
        sessions: state.sessions.filter(s => s.id !== id),
      };
    });
  },

  getByReceiverId: (receiverId) => {
    return get().sessions.filter(s => s.receiverId === receiverId);
  },

  clear: () => {
    set({ sessions: [] });
  },
}));

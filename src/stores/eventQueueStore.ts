/**
 * Event Queue Store
 *
 * behavior_mental类型的消费队列
 * 消费后立即移除，先进先出
 */

import { create } from 'zustand';

/** 全局事件序列号计数器 */
let eventSeqNo = 0;

/** 获取下一个事件序列号 */
function getNextEventSeqNo(): number {
  return ++eventSeqNo;
}

export interface EventMessage {
  id: string;
  seqNo: number;
  type: 'behavior' | 'mental' | 'agent_end';
  timestamp: number;
  receiverId?: string;
  // behavior类型
  behavior?: {
    domain: string;
    category: string;
    action_id: string;
    urgency: number;
    intensity: number;
    duration_ms: number | null;
  };
  // mental类型
  mental?: {
    show_bubble: boolean;
    thought_text: string;
    emotion_icon: string;
    duration_ms: number | null;
  };
}

interface EventQueueState {
  events: EventMessage[];

  // 添加事件到队列
  addEvent: (event: Omit<EventMessage, 'id' | 'seqNo' | 'timestamp'>) => string;

  // 消费事件（立即移除）
  consumeEvent: (id: string) => void;

  // 获取指定角色的最早未消费事件
  getFirstByReceiverId: (receiverId: string) => EventMessage | null;

  // 清空所有事件
  clear: () => void;
}

export const useEventQueueStore = create<EventQueueState>((set, get) => ({
  events: [],

  addEvent: (event) => {
    const seqNo = getNextEventSeqNo();
    const id = `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const newEvent: EventMessage = {
      ...event,
      id,
      seqNo,
      timestamp: Date.now(),
    };

    set((state) => ({
      events: [...state.events, newEvent],
    }));

    return id;
  },

  consumeEvent: (id) => {
    set((state) => {
      return {
        events: state.events.filter(e => e.id !== id),
      };
    });
  },

  getFirstByReceiverId: (receiverId) => {
    const events = get().events.filter(e => e.receiverId === receiverId);
    return events.length > 0 ? events[0] : null;
  },

  clear: () => {
    set({ events: [] });
  },
}));

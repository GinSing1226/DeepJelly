/**
 * Status Bubble Store
 *
 * 独立的状态气泡队列，与messageStore分离
 * 状态气泡无持续时间，无限循环，直到被打断/清空
 */

import { create } from 'zustand';

/** 全局状态气泡序列号计数器 */
let statusBubbleSeqNo = 0;

/** 获取下一个状态气泡序列号 */
function getNextStatusSeqNo(): number {
  return ++statusBubbleSeqNo;
}

export interface StatusBubble {
  id: string;
  seqNo: number;
  emoji: string;
  content: string;
  timestamp: number;
  receiverId?: string;
}

interface StatusBubbleState {
  bubbles: StatusBubble[];

  // 添加状态气泡
  addBubble: (bubble: Omit<StatusBubble, 'id' | 'seqNo' | 'timestamp'>) => void;

  // 清空所有状态气泡
  clear: () => void;

  // 清空指定角色的状态气泡
  clearByReceiverId: (receiverId: string) => void;

  // 获取指定角色的最新状态气泡
  getLatestByReceiverId: (receiverId: string) => StatusBubble | null;
}

export const useStatusBubbleStore = create<StatusBubbleState>((set, get) => ({
  bubbles: [],

  addBubble: (bubble) => {
    const seqNo = getNextStatusSeqNo();
    const id = `status_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const newBubble: StatusBubble = {
      ...bubble,
      id,
      seqNo,
      timestamp: Date.now(),
    };

    set((state) => {
      // 状态气泡规则：无持续时间，会被后来者立刻打断
      // 所以同一角色的新状态应该替换旧状态，而不是累积
      const filteredBubbles = bubble.receiverId
        ? state.bubbles.filter(b => b.receiverId !== bubble.receiverId)
        : state.bubbles;

      return {
        bubbles: [...filteredBubbles, newBubble],
      };
    });
  },

  clear: () => {
    set({ bubbles: [] });
  },

  clearByReceiverId: (receiverId) => {
    set((state) => {
      return {
        bubbles: state.bubbles.filter(b => b.receiverId !== receiverId),
      };
    });
  },

  getLatestByReceiverId: (receiverId) => {
    const bubbles = get().bubbles.filter(b => b.receiverId === receiverId);
    return bubbles.length > 0 ? bubbles[bubbles.length - 1] : null;
  },
}));

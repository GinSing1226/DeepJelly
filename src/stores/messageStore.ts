import { create } from 'zustand';

export type BubbleType = 'chat' | 'status' | 'emoji' | 'touch' | 'behavior';

export type ChatType = 'single' | 'group';

/** 全局消息序列号计数器 */
let messageSeqNo = 0;

/** 获取下一个消息序列号 */
function getNextSeqNo(): number {
  return ++messageSeqNo;
}

/** 路由信息 */
export interface MessageRouting {
  sessionKey?: string; // 会话密钥，格式: agent:{assistantId}:{sessionId}
}

/** 行为数据（用于 behavior 类型消息） */
export interface BehaviorData {
  domain: string;
  category: string;
  action_id: string;
  urgency: number;
  intensity: number;
  duration_ms: number | null;
}

export interface Message {
  id: string;
  seqNo: number; // 全局序列号，用于日志追踪
  content: string;
  type: BubbleType;
  sender: 'user' | 'assistant' | 'system';
  timestamp: number;
  duration?: number; // 显示时长（毫秒），0表示永久显示
  chatType?: ChatType; // 聊天类型：单聊或群聊
  isStreaming?: boolean; // 是否流式输出
  receiverId?: string; // 接收者ID（用于过滤发给特定角色的消息）
  routing?: MessageRouting; // 路由信息（用于根据sessionKey过滤）
  behavior?: BehaviorData; // 行为数据（用于 behavior 类型消息）
  emoji?: string; // emoji 图标（用于 status 类型消息）
}

interface MessageState {
  messages: Message[];
  currentBubble: Message | null;

  addMessage: (message: Omit<Message, 'id' | 'timestamp' | 'seqNo'>) => string;
  removeMessage: (id: string) => void;
  removeMessages: (type: BubbleType, receiverId?: string) => void;
  setCurrentBubble: (message: Message | null) => void;
  clearMessages: () => void;
}

export const useMessageStore = create<MessageState>((set, get) => ({
  messages: [],
  currentBubble: null,

  addMessage: (message) => {
    const seqNo = getNextSeqNo();
    const id = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const newMessage: Message = {
      ...message,
      id,
      seqNo,
      timestamp: Date.now(),
    };

    const typeTag = `[MSG#${String(seqNo).padStart(3, '0')}:${message.type}]`;
    console.log(`${typeTag} ADDED:`, {
      content: message.content?.substring(0, 50),
      emoji: message.emoji,
      behavior: message.behavior?.action_id,
      receiverId: message.receiverId,
    });

    set((state) => ({
      messages: [...state.messages, newMessage],
      // 不自动设置 currentBubble，由调用者决定
      currentBubble: state.currentBubble,
    }));

    // 自动移除临时气泡
    let duration = message.duration;
    if (message.type === 'behavior') {
      // behavior 消息只用于触发动画，快速移除
      duration = 100;
    } else if (message.type === 'chat') {
      // 聊天气泡：不指定时长时默认 10 秒
      if (!duration || duration === 0) {
        duration = 10000;
      }
    } else if (message.type === 'status') {
      // 状态气泡：不指定时长时永久显示
      if (!duration || duration === 0) {
        duration = undefined; // 不设置定时器
      }
    }

    if (duration && duration > 0) {
      setTimeout(() => {
        get().removeMessage(id);
      }, duration);
    }

    return id;
  },

  removeMessage: (id) => {
    set((state) => {
      const msgToRemove = state.messages.find(m => m.id === id);
      if (msgToRemove) {
        console.log(`[MSG#${String(msgToRemove.seqNo).padStart(3, '0')}:${msgToRemove.type}] REMOVED`);
      }
      const messages = state.messages.filter((m) => m.id !== id);
      const currentBubble =
        state.currentBubble?.id === id
          ? messages[messages.length - 1] || null
          : state.currentBubble;

      return { messages, currentBubble };
    });
  },

  removeMessages: (type, receiverId) => {
    set((state) => {
      const toRemove = state.messages.filter(m => {
        if (receiverId) {
          return m.type === type && m.receiverId === receiverId;
        }
        return m.type === type;
      });

      if (toRemove.length > 0) {
        const seqNos = toRemove.map(m => `#${String(m.seqNo).padStart(3, '0')}`).join(', ');
        console.log(`[MSG:${type}] BATCH REMOVE: ${seqNos} (receiverId: ${receiverId || 'all'})`);
      }

      const messages = state.messages.filter((m) => {
        // 如果指定了 receiverId，只删除匹配的
        if (receiverId) {
          return !(m.type === type && m.receiverId === receiverId);
        }
        // 否则删除指定类型的所有消息
        return m.type !== type;
      });
      const currentBubble =
        state.currentBubble?.type === type &&
        (!receiverId || state.currentBubble?.receiverId === receiverId)
          ? messages[messages.length - 1] || null
          : state.currentBubble;

      return { messages, currentBubble };
    });
  },

  setCurrentBubble: (message) => {
      console.log("[messageStore] setCurrentBubble called with:", message);
      const newState = { currentBubble: message };
      console.log("[messageStore] New state:", newState);
      set(newState);
    },

  clearMessages: () => set({ messages: [], currentBubble: null }),
}));

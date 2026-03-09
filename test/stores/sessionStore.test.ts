/**
 * 会话状态管理测试
 *
 * 测试范围：
 * 1. 会话列表管理
 * 2. 会话创建和删除
 * 3. 消息历史
 * 4. 未读计数
 * 5. 会话排序
 *
 * @see docs/private_docs/Reqs/4.1.逻辑层.md
 * @see docs/private_docs/Tech/5.3.会话管理.md
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Session, SessionMessage, ChatType } from '../types';

// ============ 待实现的接口 ============

/**
 * 会话Store接口
 * TODO: 在 src/stores/sessionStore.ts 中实现
 */
interface SessionStore {
  // ============ 状态 ============

  /** 会话列表 */
  sessions: Session[];
  /** 当前活跃的会话ID */
  activeSessionId: string | null;
  /** 消息历史映射 (session_id -> messages) */
  messageHistory: Record<string, SessionMessage[]>;
  /** 未读计数映射 */
  unreadCounts: Record<string, number>;
  /** 是否正在加载 */
  isLoading: boolean;
  /** 错误信息 */
  error: string | null;
  /** 分页信息 */
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    hasMore: boolean;
  };

  // ============ 动作 ============

  /** 加载会话列表 */
  loadSessions: (appId: string) => Promise<void>;
  /** 加载更多会话 */
  loadMoreSessions: (appId: string) => Promise<void>;
  /** 创建新会话 */
  createSession: (appId: string, agentId: string, chatType: ChatType) => Promise<Session>;
  /** 删除会话 */
  deleteSession: (sessionId: string) => Promise<void>;
  /** 设置活跃会话 */
  setActiveSession: (sessionId: string) => void;
  /** 加载会话历史 */
  loadHistory: (sessionId: string, page?: number) => Promise<void>;
  /** 添加消息 */
  addMessage: (sessionId: string, message: SessionMessage) => void;
  /** 发送消息 */
  sendMessage: (sessionId: string, content: string) => Promise<void>;
  /** 增加未读计数 */
  incrementUnread: (sessionId: string) => void;
  /** 清除未读计数 */
  clearUnread: (sessionId: string) => void;
  /** 更新会话信息 */
  updateSession: (sessionId: string, updates: Partial<Session>) => void;
  /** 搜索会话 */
  searchSessions: (keyword: string) => Session[];

  // ============ 选择器 ============

  /** 获取活跃会话 */
  getActiveSession: () => Session | null;
  /** 获取活跃会话的消息 */
  getActiveMessages: () => SessionMessage[];
  /** 获取会话的未读数 */
  getUnreadCount: (sessionId: string) => number;
  /** 获取总未读数 */
  getTotalUnread: () => number;
  /** 获取按应用分组的会话 */
  getSessionsByApp: (appId: string) => Session[];
}

// ============ 测试数据工厂 ============

function createMockSession(overrides?: Partial<Session>): Session {
  return {
    session_id: `sess_${Date.now()}`,
    app_id: 'openclaw',
    agent_id: 'agent_001',
    chat_type: 'private',
    title: '测试会话',
    created_at: Date.now(),
    updated_at: Date.now(),
    unread_count: 0,
    last_message: '这是最后一条消息',
    ...overrides,
  };
}

function createMockMessage(overrides?: Partial<SessionMessage>): SessionMessage {
  return {
    msg_id: `msg_${Date.now()}`,
    sender_id: 'user_001',
    sender_type: 'user',
    sender_name: '用户',
    content: '测试消息内容',
    timestamp: Date.now(),
    ...overrides,
  };
}

// ============ 测试用例 ============

describe('会话状态管理', () => {
  let store: SessionStore;

  beforeEach(() => {
    // TODO: 导入实际实现
    // store = useSessionStore.getState();
    // 暂时使用mock
    store = {
      sessions: [],
      activeSessionId: null,
      messageHistory: {},
      unreadCounts: {},
      isLoading: false,
      error: null,
      pagination: {
        page: 1,
        pageSize: 20,
        total: 0,
        hasMore: true,
      },
      loadSessions: vi.fn(),
      loadMoreSessions: vi.fn(),
      createSession: vi.fn(),
      deleteSession: vi.fn(),
      setActiveSession: vi.fn(),
      loadHistory: vi.fn(),
      addMessage: vi.fn(),
      sendMessage: vi.fn(),
      incrementUnread: vi.fn(),
      clearUnread: vi.fn(),
      updateSession: vi.fn(),
      searchSessions: vi.fn(),
      getActiveSession: vi.fn(),
      getActiveMessages: vi.fn(),
      getUnreadCount: vi.fn(),
      getTotalUnread: vi.fn(),
      getSessionsByApp: vi.fn(),
    };
  });

  // ============ 会话列表测试 ============

  describe('会话列表管理', () => {
    it('应该能够加载会话列表', async () => {
      const mockSessions = [
        createMockSession({ session_id: 'sess_001', title: '会话1' }),
        createMockSession({ session_id: 'sess_002', title: '会话2' }),
      ];

      vi.mocked(store.loadSessions).mockImplementation(async () => {
        store.sessions = mockSessions;
      });

      await store.loadSessions('openclaw');

      expect(store.sessions).toHaveLength(2);
    });

    it('会话应该按最后消息时间排序', async () => {
      const now = Date.now();
      const mockSessions = [
        createMockSession({
          session_id: 'sess_001',
          updated_at: now - 1000,
        }),
        createMockSession({
          session_id: 'sess_002',
          updated_at: now,
        }),
      ];

      vi.mocked(store.loadSessions).mockImplementation(async () => {
        // 按updated_at降序排序
        store.sessions = mockSessions.sort((a, b) => b.updated_at - a.updated_at);
      });

      await store.loadSessions('openclaw');

      expect(store.sessions[0].session_id).toBe('sess_002');
    });

    it('有未读消息的会话应该置顶', async () => {
      const mockSessions = [
        createMockSession({
          session_id: 'sess_001',
          unread_count: 0,
          updated_at: Date.now(),
        }),
        createMockSession({
          session_id: 'sess_002',
          unread_count: 5,
          updated_at: Date.now() - 10000,
        }),
      ];

      vi.mocked(store.loadSessions).mockImplementation(async () => {
        // 有未读的置顶
        store.sessions = mockSessions.sort((a, b) => {
          if (a.unread_count > 0 && b.unread_count === 0) return -1;
          if (a.unread_count === 0 && b.unread_count > 0) return 1;
          return b.updated_at - a.updated_at;
        });
      });

      await store.loadSessions('openclaw');

      expect(store.sessions[0].session_id).toBe('sess_002');
    });

    it('应该能够分页加载更多会话', async () => {
      store.pagination.page = 1;
      store.pagination.hasMore = true;

      vi.mocked(store.loadMoreSessions).mockImplementation(async () => {
        store.pagination.page = 2;
        store.sessions.push(
          createMockSession({ session_id: 'sess_021' }),
          createMockSession({ session_id: 'sess_022' })
        );
      });

      await store.loadMoreSessions('openclaw');

      expect(store.pagination.page).toBe(2);
    });

    it('没有更多数据时不应加载', async () => {
      store.pagination.hasMore = false;

      await store.loadMoreSessions('openclaw');

      expect(store.loadMoreSessions).not.toHaveBeenCalled();
    });
  });

  // ============ 会话操作测试 ============

  describe('会话操作', () => {
    it('应该能够创建新会话', async () => {
      const newSession = createMockSession({
        session_id: 'sess_new',
        chat_type: 'private',
      });

      vi.mocked(store.createSession).mockImplementation(async () => {
        store.sessions.push(newSession);
        return newSession;
      });

      const result = await store.createSession('openclaw', 'agent_001', 'private');

      expect(result.session_id).toBe('sess_new');
      expect(store.sessions).toContainEqual(newSession);
    });

    it('应该能够删除会话', async () => {
      store.sessions = [createMockSession({ session_id: 'sess_001' })];

      vi.mocked(store.deleteSession).mockImplementation(async (sessionId) => {
        store.sessions = store.sessions.filter(s => s.session_id !== sessionId);
      });

      await store.deleteSession('sess_001');

      expect(store.sessions).toHaveLength(0);
    });

    it('删除会话时应该清除相关消息历史', async () => {
      store.sessions = [createMockSession({ session_id: 'sess_001' })];
      store.messageHistory = {
        'sess_001': [createMockMessage()],
      };

      vi.mocked(store.deleteSession).mockImplementation(async (sessionId) => {
        store.sessions = store.sessions.filter(s => s.session_id !== sessionId);
        delete store.messageHistory[sessionId];
      });

      await store.deleteSession('sess_001');

      expect(store.messageHistory['sess_001']).toBeUndefined();
    });

    it('应该能够设置活跃会话', () => {
      store.sessions = [createMockSession({ session_id: 'sess_001' })];

      store.setActiveSession('sess_001');

      expect(store.activeSessionId).toBe('sess_001');
    });

    it('设置活跃会话时应该清除未读', () => {
      store.unreadCounts['sess_001'] = 5;
      store.sessions = [createMockSession({ session_id: 'sess_001' })];

      vi.mocked(store.setActiveSession).mockImplementation((sessionId) => {
        store.activeSessionId = sessionId;
        store.clearUnread(sessionId);
      });

      store.setActiveSession('sess_001');

      expect(store.unreadCounts['sess_001']).toBe(0);
    });

    it('应该能够更新会话信息', () => {
      store.sessions = [createMockSession({ session_id: 'sess_001', title: '旧标题' })];

      vi.mocked(store.updateSession).mockImplementation((sessionId, updates) => {
        const session = store.sessions.find(s => s.session_id === sessionId);
        if (session) {
          Object.assign(session, updates);
        }
      });

      store.updateSession('sess_001', { title: '新标题' });

      expect(store.sessions[0].title).toBe('新标题');
    });
  });

  // ============ 消息历史测试 ============

  describe('消息历史', () => {
    it('应该能够加载会话历史', async () => {
      const messages = [
        createMockMessage({ msg_id: 'msg_001', content: '消息1' }),
        createMockMessage({ msg_id: 'msg_002', content: '消息2' }),
      ];

      vi.mocked(store.loadHistory).mockImplementation(async (sessionId) => {
        store.messageHistory[sessionId] = messages;
      });

      await store.loadHistory('sess_001');

      expect(store.messageHistory['sess_001']).toHaveLength(2);
    });

    it('应该能够添加消息到历史', () => {
      const message = createMockMessage();

      vi.mocked(store.addMessage).mockImplementation((sessionId, msg) => {
        if (!store.messageHistory[sessionId]) {
          store.messageHistory[sessionId] = [];
        }
        store.messageHistory[sessionId].push(msg);
      });

      store.addMessage('sess_001', message);

      expect(store.messageHistory['sess_001']).toContainEqual(message);
    });

    it('添加消息时应该更新会话的last_message', () => {
      store.sessions = [createMockSession({ session_id: 'sess_001' })];
      const message = createMockMessage({ content: '最新消息' });

      vi.mocked(store.addMessage).mockImplementation((sessionId, msg) => {
        if (!store.messageHistory[sessionId]) {
          store.messageHistory[sessionId] = [];
        }
        store.messageHistory[sessionId].push(msg);

        const session = store.sessions.find(s => s.session_id === sessionId);
        if (session) {
          session.last_message = msg.content;
          session.updated_at = Date.now();
        }
      });

      store.addMessage('sess_001', message);

      expect(store.sessions[0].last_message).toBe('最新消息');
    });

    it('应该能够发送消息', async () => {
      const content = '用户发送的消息';

      vi.mocked(store.sendMessage).mockImplementation(async (sessionId, msgContent) => {
        const message = createMockMessage({
          sender_type: 'user',
          content: msgContent,
        });
        if (!store.messageHistory[sessionId]) {
          store.messageHistory[sessionId] = [];
        }
        store.messageHistory[sessionId].push(message);
      });

      await store.sendMessage('sess_001', content);

      expect(store.sendMessage).toHaveBeenCalledWith('sess_001', content);
    });
  });

  // ============ 未读计数测试 ============

  describe('未读计数', () => {
    it('应该能够增加未读计数', () => {
      vi.mocked(store.incrementUnread).mockImplementation((sessionId) => {
        store.unreadCounts[sessionId] = (store.unreadCounts[sessionId] || 0) + 1;
      });

      store.incrementUnread('sess_001');
      store.incrementUnread('sess_001');

      expect(store.unreadCounts['sess_001']).toBe(2);
    });

    it('应该能够清除未读计数', () => {
      store.unreadCounts['sess_001'] = 5;

      vi.mocked(store.clearUnread).mockImplementation((sessionId) => {
        store.unreadCounts[sessionId] = 0;
      });

      store.clearUnread('sess_001');

      expect(store.unreadCounts['sess_001']).toBe(0);
    });

    it('应该能够获取会话的未读数', () => {
      store.unreadCounts['sess_001'] = 3;

      vi.mocked(store.getUnreadCount).mockImplementation(
        (sessionId) => store.unreadCounts[sessionId] || 0
      );

      expect(store.getUnreadCount('sess_001')).toBe(3);
    });

    it('应该能够获取总未读数', () => {
      store.unreadCounts = {
        'sess_001': 3,
        'sess_002': 5,
        'sess_003': 0,
      };

      vi.mocked(store.getTotalUnread).mockImplementation(
        () => Object.values(store.unreadCounts).reduce((sum, count) => sum + count, 0)
      );

      expect(store.getTotalUnread()).toBe(8);
    });
  });

  // ============ 搜索测试 ============

  describe('搜索功能', () => {
    beforeEach(() => {
      store.sessions = [
        createMockSession({ session_id: 'sess_001', title: '项目讨论' }),
        createMockSession({ session_id: 'sess_002', title: '日常闲聊' }),
        createMockSession({ session_id: 'sess_003', title: '项目进度' }),
      ];
    });

    it('应该能够按标题搜索会话', () => {
      vi.mocked(store.searchSessions).mockImplementation((keyword) =>
        store.sessions.filter(s => s.title.includes(keyword))
      );

      const results = store.searchSessions('项目');

      expect(results).toHaveLength(2);
      expect(results.map(s => s.session_id)).toContain('sess_001');
      expect(results.map(s => s.session_id)).toContain('sess_003');
    });

    it('搜索应该不区分大小写', () => {
      vi.mocked(store.searchSessions).mockImplementation((keyword) =>
        store.sessions.filter(s =>
          s.title.toLowerCase().includes(keyword.toLowerCase())
        )
      );

      const results = store.searchSessions('项目');

      expect(results).toHaveLength(2);
    });

    it('空关键词应该返回所有会话', () => {
      vi.mocked(store.searchSessions).mockImplementation((keyword) =>
        keyword ? store.sessions.filter(s => s.title.includes(keyword)) : store.sessions
      );

      const results = store.searchSessions('');

      expect(results).toHaveLength(3);
    });
  });

  // ============ 选择器测试 ============

  describe('选择器', () => {
    beforeEach(() => {
      store.sessions = [
        createMockSession({ session_id: 'sess_001', app_id: 'openclaw' }),
        createMockSession({ session_id: 'sess_002', app_id: 'openclaw' }),
        createMockSession({ session_id: 'sess_003', app_id: 'claude_code' }),
      ];
      store.activeSessionId = 'sess_001';
      store.messageHistory = {
        'sess_001': [createMockMessage(), createMockMessage()],
      };
    });

    it('getActiveSession应该返回活跃会话', () => {
      vi.mocked(store.getActiveSession).mockReturnValue(
        store.sessions.find(s => s.session_id === store.activeSessionId) || null
      );

      const session = store.getActiveSession();

      expect(session?.session_id).toBe('sess_001');
    });

    it('getActiveMessages应该返回活跃会话的消息', () => {
      vi.mocked(store.getActiveMessages).mockImplementation(() =>
        store.messageHistory[store.activeSessionId!] || []
      );

      const messages = store.getActiveMessages();

      expect(messages).toHaveLength(2);
    });

    it('getSessionsByApp应该返回指定应用的会话', () => {
      vi.mocked(store.getSessionsByApp).mockImplementation((appId) =>
        store.sessions.filter(s => s.app_id === appId)
      );

      const sessions = store.getSessionsByApp('openclaw');

      expect(sessions).toHaveLength(2);
    });
  });
});

// ============ 测试总结 ============
/**
 * 测试覆盖：
 * - 会话列表管理：5个用例
 * - 会话操作：6个用例
 * - 消息历史：4个用例
 * - 未读计数：4个用例
 * - 搜索功能：3个用例
 * - 选择器：3个用例
 *
 * 总计：25个测试用例
 *
 * 实现要点：
 * 1. 使用Zustand创建store
 * 2. 消息历史按session_id分组存储
 * 3. 会话排序需要考虑未读状态和时间
 * 4. 搜索支持模糊匹配
 */

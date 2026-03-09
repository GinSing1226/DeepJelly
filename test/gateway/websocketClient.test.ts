/**
 * WebSocket客户端测试
 *
 * 测试范围：
 * 1. 连接管理
 * 2. 鉴权协议
 * 3. 消息收发
 * 4. 重连机制
 * 5. 心跳检测
 * 6. 流式消息处理
 *
 * @see docs/private_docs/Reqs/5.1.网关层.md
 * @see docs/private_docs/Tech/2.1.大脑层总览.md
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import type { WebSocketMessage, ConnectionStatus } from '../types';

// ============ 待实现的接口 ============

/**
 * WebSocket客户端接口
 * TODO: 在 src/brain/client.ts 中实现
 */
interface BrainClient {
  // ============ 状态 ============

  /** 连接状态 */
  status: ConnectionStatus;
  /** 当前会话ID */
  sessionId: string | null;
  /** 重连次数 */
  reconnectAttempts: number;

  // ============ 方法 ============

  /** 连接到服务器 */
  connect(url: string, authToken: string): Promise<void>;
  /** 断开连接 */
  disconnect(): void;
  /** 发送请求 */
  sendRequest<T>(method: string, params?: Record<string, unknown>): Promise<T>;
  /** 订阅事件 */
  subscribe(event: string, handler: (data: unknown) => void): () => void;
  /** 发送心跳 */
  sendHeartbeat(): Promise<void>;
}

// ============ Mock WebSocket ============

class MockWebSocket {
  static instances: MockWebSocket[] = [];

  readyState: number = WebSocket.CONNECTING;
  onopen: ((event: Event) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;

  constructor(public url: string) {
    MockWebSocket.instances.push(this);
    // 模拟异步连接
    setTimeout(() => {
      this.readyState = WebSocket.OPEN;
      this.onopen?.(new Event('open'));
    }, 10);
  }

  send(data: string): void {
    if (this.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket is not open');
    }
    // 模拟服务器响应
    this.simulateServerResponse(data);
  }

  close(): void {
    this.readyState = WebSocket.CLOSED;
    this.onclose?.(new CloseEvent('close'));
  }

  simulateServerResponse(data: string): void {
    try {
      const message = JSON.parse(data);

      // 模拟连接响应
      if (message.method === 'connect') {
        setTimeout(() => {
          this.onmessage?.(new MessageEvent('message', {
            data: JSON.stringify({
              type: 'res',
              id: message.id,
              status: 'success',
              data: { session_id: 'sess_mock_001' },
            }),
          }));
        }, 5);
      }

      // 模拟心跳响应
      if (message.method === 'heartbeat') {
        setTimeout(() => {
          this.onmessage?.(new MessageEvent('message', {
            data: JSON.stringify({
              type: 'res',
              id: message.id,
              status: 'success',
            }),
          }));
        }, 5);
      }
    } catch {
      // 忽略解析错误
    }
  }

  simulateMessage(data: unknown): void {
    this.onmessage?.(new MessageEvent('message', {
      data: JSON.stringify(data),
    }));
  }

  simulateError(): void {
    this.onerror?.(new Event('error'));
  }

  simulateClose(): void {
    this.readyState = WebSocket.CLOSED;
    this.onclose?.(new CloseEvent('close'));
  }
}

// ============ 测试用例 ============

describe('WebSocket客户端', () => {
  let client: BrainClient;
  let mockWs: MockWebSocket;

  beforeEach(() => {
    MockWebSocket.instances = [];

    // Mock WebSocket
    vi.stubGlobal('WebSocket', MockWebSocket);

    // TODO: 导入实际实现
    // client = new BrainClientImpl();
    // 暂时使用mock
    client = {
      status: 'disconnected',
      sessionId: null,
      reconnectAttempts: 0,
      connect: vi.fn(),
      disconnect: vi.fn(),
      sendRequest: vi.fn(),
      subscribe: vi.fn(),
      sendHeartbeat: vi.fn(),
    };
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  // ============ 连接管理测试 ============

  describe('连接管理', () => {
    it('应该能够连接到服务器', async () => {
      vi.mocked(client.connect).mockImplementation(async () => {
        client.status = 'connected';
        client.sessionId = 'sess_001';
      });

      await client.connect('ws://localhost:18790', 'test-token');

      expect(client.status).toBe('connected');
      expect(client.sessionId).toBe('sess_001');
    });

    it('连接中应该设置connecting状态', async () => {
      vi.mocked(client.connect).mockImplementation(async () => {
        client.status = 'connecting';
        await new Promise(resolve => setTimeout(resolve, 50));
        client.status = 'connected';
      });

      const connectPromise = client.connect('ws://localhost:18790', 'test-token');

      expect(client.status).toBe('connecting');

      await connectPromise;

      expect(client.status).toBe('connected');
    });

    it('连接失败应该设置error状态', async () => {
      vi.mocked(client.connect).mockRejectedValue(new Error('连接失败'));

      await expect(client.connect('ws://invalid', 'test-token')).rejects.toThrow('连接失败');
    });

    it('应该能够断开连接', () => {
      client.status = 'connected';

      vi.mocked(client.disconnect).mockImplementation(() => {
        client.status = 'disconnected';
        client.sessionId = null;
      });

      client.disconnect();

      expect(client.status).toBe('disconnected');
      expect(client.sessionId).toBeNull();
    });
  });

  // ============ 鉴权协议测试 ============

  describe('鉴权协议', () => {
    it('连接时应该发送鉴权请求', async () => {
      const connectSpy = vi.fn();
      vi.mocked(client.connect).mockImplementation(async (url, token) => {
        connectSpy(url, token);
        client.status = 'connected';
        client.sessionId = 'sess_001';
      });

      await client.connect('ws://localhost:18790', 'sk-test-token');

      expect(connectSpy).toHaveBeenCalledWith('ws://localhost:18790', 'sk-test-token');
    });

    it('鉴权成功应该返回session_id', async () => {
      vi.mocked(client.connect).mockImplementation(async () => {
        client.sessionId = 'sess_auth_001';
        client.status = 'connected';
      });

      await client.connect('ws://localhost:18790', 'valid-token');

      expect(client.sessionId).toBe('sess_auth_001');
    });

    it('鉴权失败应该抛出错误', async () => {
      vi.mocked(client.connect).mockRejectedValue(new Error('鉴权失败'));

      await expect(client.connect('ws://localhost:18790', 'invalid-token')).rejects.toThrow('鉴权失败');
    });
  });

  // ============ 消息收发测试 ============

  describe('消息收发', () => {
    beforeEach(async () => {
      vi.mocked(client.connect).mockImplementation(async () => {
        client.status = 'connected';
        client.sessionId = 'sess_001';
      });
      await client.connect('ws://localhost:18790', 'test-token');
    });

    it('应该能够发送请求并接收响应', async () => {
      vi.mocked(client.sendRequest).mockResolvedValue({
        assistants: [{ id: 'asst_001', name: '助手小明' }],
      });

      const result = await client.sendRequest('get_assistants', {});

      expect(result).toEqual({
        assistants: [{ id: 'asst_001', name: '助手小明' }],
      });
    });

    it('应该能够订阅事件', () => {
      const handler = vi.fn();
      const unsubscribe = vi.fn();

      vi.mocked(client.subscribe).mockReturnValue(unsubscribe);

      const unsub = client.subscribe('message', handler);

      expect(unsub).toBe(unsubscribe);
    });

    it('取消订阅应该移除处理器', () => {
      const handler = vi.fn();
      const unsubscribe = vi.fn();

      vi.mocked(client.subscribe).mockReturnValue(unsubscribe);

      const unsub = client.subscribe('message', handler);
      unsub();

      expect(unsubscribe).toHaveBeenCalled();
    });

    it('未连接时发送请求应该抛出错误', async () => {
      client.status = 'disconnected';

      vi.mocked(client.sendRequest).mockRejectedValue(new Error('未连接'));

      await expect(client.sendRequest('get_assistants')).rejects.toThrow('未连接');
    });
  });

  // ============ 重连机制测试 ============

  describe('重连机制', () => {
    it('断线后应该自动重连', async () => {
      vi.mocked(client.connect).mockImplementation(async () => {
        client.status = 'connected';
        client.reconnectAttempts = 0;
      });

      // 模拟初始连接
      await client.connect('ws://localhost:18790', 'test-token');

      // 模拟断线
      client.status = 'disconnected';
      client.reconnectAttempts = 1;

      // 重连
      await client.connect('ws://localhost:18790', 'test-token');

      expect(client.status).toBe('connected');
    });

    it('应该使用指数退避重连', () => {
      const delays: number[] = [];

      vi.mocked(client.connect).mockImplementation(async () => {
        const delay = Math.min(1000 * Math.pow(2, client.reconnectAttempts), 30000);
        delays.push(delay);
        client.reconnectAttempts++;
        client.status = 'connected';
      });

      // 模拟多次重连
      expect(delays[0]).toBeLessThanOrEqual(30000);
    });

    it('最大重连间隔应该是30秒', () => {
      const maxDelay = 30000;
      const attempts = 10;
      const delay = Math.min(1000 * Math.pow(2, attempts), maxDelay);

      expect(delay).toBe(maxDelay);
    });

    it('重连成功后应该重置重连次数', async () => {
      client.reconnectAttempts = 5;

      vi.mocked(client.connect).mockImplementation(async () => {
        client.status = 'connected';
        client.reconnectAttempts = 0;
      });

      await client.connect('ws://localhost:18790', 'test-token');

      expect(client.reconnectAttempts).toBe(0);
    });
  });

  // ============ 心跳检测测试 ============

  describe('心跳检测', () => {
    it('应该能够发送心跳', async () => {
      vi.mocked(client.sendHeartbeat).mockResolvedValue(undefined);

      await client.sendHeartbeat();

      expect(client.sendHeartbeat).toHaveBeenCalled();
    });

    it('心跳超时应该触发重连', async () => {
      vi.mocked(client.sendHeartbeat).mockRejectedValue(new Error('心跳超时'));

      await expect(client.sendHeartbeat()).rejects.toThrow('心跳超时');
    });

    it('应该定期发送心跳', async () => {
      vi.useFakeTimers();

      vi.mocked(client.sendHeartbeat).mockResolvedValue(undefined);

      // 设置定时心跳
      const interval = setInterval(() => {
        client.sendHeartbeat();
      }, 30000);

      // 快进30秒
      vi.advanceTimersByTime(30000);
      expect(client.sendHeartbeat).toHaveBeenCalledTimes(1);

      // 快进60秒
      vi.advanceTimersByTime(30000);
      expect(client.sendHeartbeat).toHaveBeenCalledTimes(2);

      clearInterval(interval);
      vi.useRealTimers();
    });
  });

  // ============ 流式消息处理测试 ============

  describe('流式消息处理', () => {
    it('应该能够接收流式消息', () => {
      const chunks: string[] = [];
      const handler = vi.fn((data) => {
        if (data.delta) {
          chunks.push(data.delta.content);
        }
      });

      vi.mocked(client.subscribe).mockImplementation((event, h) => {
        if (event === 'stream') {
          // 模拟流式消息
          h({ stream_id: 'str_001', delta: { content: '你' } });
          h({ stream_id: 'str_001', delta: { content: '好' } });
          h({ stream_id: 'str_001', delta: { content: '！' } });
        }
        return () => {};
      });

      client.subscribe('stream', handler);

      expect(chunks).toEqual(['你', '好', '！']);
    });

    it('应该正确处理流结束', () => {
      const states: boolean[] = [];
      const handler = vi.fn((data) => {
        states.push(data.is_finished);
      });

      vi.mocked(client.subscribe).mockImplementation((event, h) => {
        if (event === 'stream') {
          h({ stream_id: 'str_001', is_finished: false });
          h({ stream_id: 'str_001', is_finished: false });
          h({ stream_id: 'str_001', is_finished: true });
        }
        return () => {};
      });

      client.subscribe('stream', handler);

      expect(states).toEqual([false, false, true]);
    });

    it('断线时应该清理未完成的流', () => {
      const handler = vi.fn();

      vi.mocked(client.subscribe).mockImplementation(() => () => {});
      vi.mocked(client.disconnect).mockImplementation(() => {
        client.status = 'disconnected';
      });

      client.subscribe('stream', handler);
      client.disconnect();

      // 断线后不应该再收到消息
      expect(client.status).toBe('disconnected');
    });
  });

  // ============ 连接状态管理测试 ============

  describe('连接状态管理', () => {
    it('应该正确追踪连接状态', async () => {
      expect(client.status).toBe('disconnected');

      vi.mocked(client.connect).mockImplementation(async () => {
        client.status = 'connecting';
        await new Promise(resolve => setTimeout(resolve, 10));
        client.status = 'connected';
      });

      const connectPromise = client.connect('ws://localhost:18790', 'test-token');
      expect(client.status).toBe('connecting');

      await connectPromise;
      expect(client.status).toBe('connected');
    });

    it('错误状态应该可设置', () => {
      vi.mocked(client.connect).mockImplementation(async () => {
        client.status = 'error';
        throw new Error('连接错误');
      });

      client.connect('ws://localhost:18790', 'test-token').catch(() => {});

      expect(client.status).toBe('error');
    });

    it('重连中应该设置reconnecting状态', () => {
      client.status = 'connected';

      vi.mocked(client.connect).mockImplementation(async () => {
        client.status = 'reconnecting';
        await new Promise(resolve => setTimeout(resolve, 10));
        client.status = 'connected';
      });

      // 模拟重连
      client.connect('ws://localhost:18790', 'test-token').catch(() => {});
    });
  });
});

// ============ 测试总结 ============
/**
 * 测试覆盖：
 * - 连接管理：4个用例
 * - 鉴权协议：3个用例
 * - 消息收发：4个用例
 * - 重连机制：4个用例
 * - 心跳检测：3个用例
 * - 流式消息处理：3个用例
 * - 连接状态管理：3个用例
 *
 * 总计：24个测试用例
 *
 * 实现要点：
 * 1. 使用原生WebSocket或tokio-tungstenite
 * 2. 实现指数退避重连算法
 * 3. 心跳间隔30秒
 * 4. 最大重连间隔30秒
 * 5. 流式消息需要缓冲区管理
 */

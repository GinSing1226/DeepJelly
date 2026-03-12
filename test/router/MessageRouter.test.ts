/**
 * MessageRouter 测试
 *
 * Meta-Name: Message Router Tests
 * Meta-Description: 测试 CAP 消息路由核心逻辑
 *
 * 测试覆盖：
 * 1. 基本路由功能
 * 2. 多应用实例场景（多个 OpenClaw）
 * 3. 不同 sessionKey 的路由
 * 4. 边界情况
 */

import { describe, it, expect, beforeEach } from 'vitest';
// Import directly from source file to avoid Tauri dependency issues
import {
  MessageRouter,
  MemoryBindingStore,
  OpenClawRoutingStrategy,
} from '../../src/logic/router/MessageRouter';
import type { CharacterBinding, CAPMessage } from '../../src/logic/router/MessageRouter';

// ============ 测试数据工厂 ============

function createMockBinding(overrides: Partial<CharacterBinding> = {}): CharacterBinding {
  return {
    id: 'binding_001',
    characterId: 'char_001',
    characterName: '测试角色',
    assistantId: 'asst_001',
    assistantName: 'christina',
    integration: {
      integrationId: 'int_001',
      provider: 'openclaw',
      applicationId: 'app_001',
      agentId: 'christina',
      params: {
        sessionKeys: ['agent:christina:main'],
      },
    },
    enabled: true,
    ...overrides,
  };
}

function createMockCAPMessage<T>(
  type: string,
  payload: T,
  overrides: Partial<CAPMessage<T>> = {}
): CAPMessage<T> {
  return {
    msg_id: `msg_${Date.now()}`,
    timestamp: Math.floor(Date.now() / 1000),
    type: type as any,
    sender: {
      id: 'app_001',
      type: 'assistant',
      source_app: 'openclaw',
      routing: {
        sessionKey: 'agent:christina:main',
      },
    },
    receiver: {
      id: 'char_001',
      type: 'assistant',
      source_app: 'deepjelly',
    },
    payload,
    ...overrides,
  };
}

// ============ 测试套件 ============

describe('MessageRouter', () => {
  let bindingStore: MemoryBindingStore;
  let router: MessageRouter;

  beforeEach(() => {
    bindingStore = new MemoryBindingStore();
    router = new MessageRouter(bindingStore);
  });

  describe('基本路由功能', () => {
    it('应该将消息路由到正确的角色', () => {
      // 设置绑定
      bindingStore.addBinding(createMockBinding({
        characterId: 'char_christina',
        assistantId: 'asst_christina',
        integration: {
          integrationId: 'int_001',
          provider: 'openclaw',
          applicationId: 'app_openclaw_1',
          agentId: 'christina',
          params: {
            sessionKeys: ['agent:christina:main'],
          },
        },
      }));

      // 创建消息
      const message = createMockCAPMessage('behavior_mental', {
        behavior: { action_id: 'think' },
        mental: { show_bubble: true, thought_text: '测试中', emotion_icon: 'thinking' },
      }, {
        sender: {
          id: 'app_openclaw_1',
          type: 'assistant',
          source_app: 'openclaw',
          routing: { sessionKey: 'agent:christina:main' },
        },
      });

      // 路由消息
      const decision = router.route(message);

      // 验证
      expect(decision.action).toBe('deliver');
      expect(decision.target).toBeDefined();
      expect(decision.target?.characterId).toBe('char_christina');
      expect(decision.target?.assistantId).toBe('asst_christina');
      expect(decision.target?.sessionKey).toBe('agent:christina:main');
    });

    it('应该拒绝没有匹配绑定的消息', () => {
      // 不添加任何绑定

      const message = createMockCAPMessage('behavior_mental', {
        behavior: { action_id: 'think' },
        mental: { show_bubble: true, thought_text: '测试中', emotion_icon: 'thinking' },
      });

      const decision = router.route(message);

      expect(decision.action).toBe('drop');
      expect(decision.reason).toContain('No binding found');
    });

    it('应该跳过禁用的绑定', () => {
      bindingStore.addBinding(createMockBinding({
        enabled: false,
      }));

      const message = createMockCAPMessage('behavior_mental', {
        behavior: { action_id: 'think' },
        mental: { show_bubble: true, thought_text: '测试中', emotion_icon: 'thinking' },
      });

      const decision = router.route(message);

      expect(decision.action).toBe('drop');
    });
  });

  describe('多应用实例场景', () => {
    it('应该根据 appId 区分不同的 OpenClaw 实例', () => {
      // 两个不同的 OpenClaw 实例绑定到不同角色
      bindingStore.addBinding(createMockBinding({
        id: 'binding_1',
        characterId: 'char_christina',
        assistantId: 'asst_christina',
        integration: {
          integrationId: 'int_1',
          provider: 'openclaw',
          applicationId: 'app_instance_1', // 实例1
          agentId: 'christina',
          params: { sessionKeys: ['agent:christina:main'] },
        },
      }));

      bindingStore.addBinding(createMockBinding({
        id: 'binding_2',
        characterId: 'char_coder',
        assistantId: 'asst_coder',
        integration: {
          integrationId: 'int_2',
          provider: 'openclaw',
          applicationId: 'app_instance_2', // 实例2
          agentId: 'coder_1',
          params: { sessionKeys: ['agent:coder_1:main'] },
        },
      }));

      // 实例1 发送的消息
      const message1 = createMockCAPMessage('behavior_mental', {
        behavior: { action_id: 'think' },
        mental: { show_bubble: true, thought_text: '思考中', emotion_icon: 'thinking' },
      }, {
        sender: {
          id: 'app_instance_1',
          type: 'assistant',
          source_app: 'openclaw',
          routing: { sessionKey: 'agent:christina:main' },
        },
      });

      // 实例2 发送的消息
      const message2 = createMockCAPMessage('behavior_mental', {
        behavior: { action_id: 'code' },
        mental: { show_bubble: true, thought_text: '编码中', emotion_icon: 'coding' },
      }, {
        sender: {
          id: 'app_instance_2',
          type: 'assistant',
          source_app: 'openclaw',
          routing: { sessionKey: 'agent:coder_1:main' },
        },
      });

      const decision1 = router.route(message1);
      const decision2 = router.route(message2);

      // 验证消息路由到不同角色
      expect(decision1.action).toBe('deliver');
      expect(decision1.target?.characterId).toBe('char_christina');

      expect(decision2.action).toBe('deliver');
      expect(decision2.target?.characterId).toBe('char_coder');
    });

    it('不同实例使用相同 sessionKey 应该路由到不同角色', () => {
      // 两个实例有相同的 sessionKey 格式，但不同 appId
      bindingStore.addBinding(createMockBinding({
        id: 'binding_1',
        characterId: 'char_a',
        integration: {
          integrationId: 'int_1',
          provider: 'openclaw',
          applicationId: 'app_instance_a',
          agentId: 'agent1',
          params: { sessionKeys: ['agent:agent1:main'] },
        },
      }));

      bindingStore.addBinding(createMockBinding({
        id: 'binding_2',
        characterId: 'char_b',
        integration: {
          integrationId: 'int_2',
          provider: 'openclaw',
          applicationId: 'app_instance_b',
          agentId: 'agent1',
          params: { sessionKeys: ['agent:agent1:main'] },
        },
      }));

      const message = createMockCAPMessage('behavior_mental', {
        behavior: { action_id: 'think' },
        mental: { show_bubble: true, thought_text: '测试中', emotion_icon: 'thinking' },
      }, {
        sender: {
          id: 'app_instance_b', // 来自实例B
          type: 'assistant',
          source_app: 'openclaw',
          routing: { sessionKey: 'agent:agent1:main' },
        },
      });

      const decision = router.route(message);

      expect(decision.action).toBe('deliver');
      expect(decision.target?.characterId).toBe('char_b'); // 应该路由到 char_b
    });
  });

  describe('sessionKey 匹配', () => {
    it('应该正确匹配 sessionKey', () => {
      bindingStore.addBinding(createMockBinding({
        integration: {
          integrationId: 'int_001',
          provider: 'openclaw',
          applicationId: 'app_001',
          agentId: 'christina',
          params: {
            sessionKeys: [
              'agent:christina:main',
              'agent:christina:group:123',
            ],
          },
        },
      }));

      const message1 = createMockCAPMessage('session', {
        session_id: 'agent:christina:main',
        message: { content: '私聊消息' },
      }, {
        sender: {
          id: 'app_001',
          type: 'assistant',
          source_app: 'openclaw',
          routing: { sessionKey: 'agent:christina:main' },
        },
      });

      const message2 = createMockCAPMessage('session', {
        session_id: 'agent:christina:group:123',
        message: { content: '群聊消息' },
      }, {
        sender: {
          id: 'app_001',
          type: 'assistant',
          source_app: 'openclaw',
          routing: { sessionKey: 'agent:christina:group:123' },
        },
      });

      const decision1 = router.route(message1);
      const decision2 = router.route(message2);

      expect(decision1.action).toBe('deliver');
      expect(decision2.action).toBe('deliver');
    });

    it('不应该匹配不存在的 sessionKey', () => {
      bindingStore.addBinding(createMockBinding({
        integration: {
          integrationId: 'int_001',
          provider: 'openclaw',
          applicationId: 'app_001',
          agentId: 'christina',
          params: {
            sessionKeys: ['agent:christina:main'],
          },
        },
      }));

      const message = createMockCAPMessage('session', {
        session_id: 'agent:christina:other',
        message: { content: '其他会话' },
      }, {
        sender: {
          id: 'app_001',
          type: 'assistant',
          source_app: 'openclaw',
          routing: { sessionKey: 'agent:christina:other' }, // 未绑定的 sessionKey
        },
      });

      const decision = router.route(message);

      expect(decision.action).toBe('drop');
    });
  });

  describe('路由策略', () => {
    it('OpenClaw 策略应该正确提取 locator', () => {
      const strategy = new OpenClawRoutingStrategy();
      const message = createMockCAPMessage('behavior_mental', {}, {
        sender: {
          id: 'app_abc123',
          type: 'assistant',
          source_app: 'openclaw',
          routing: { sessionKey: 'agent:christina:main' },
        },
      });

      const locator = strategy.extractLocator(message);

      expect(locator.appType).toBe('openclaw');
      expect(locator.appId).toBe('app_abc123');
      expect(locator.sessionId).toBe('agent:christina:main');
      expect(locator.agentId).toBe('christina');
    });

    it('应该拒绝没有 sessionKey 的消息（避免多角色共享 applicationId 时的路由混乱）', () => {
      bindingStore.addBinding(createMockBinding({
        integration: {
          integrationId: 'int_001',
          provider: 'openclaw',
          applicationId: 'app_001',
          agentId: 'christina',
          params: { sessionKeys: [] },
        },
      }));

      const strategy = new OpenClawRoutingStrategy();
      const message = createMockCAPMessage('behavior_mental', {}, {
        sender: {
          id: 'app_001',
          type: 'assistant',
          source_app: 'openclaw',
          // 没有 routing，因此没有 sessionKey
        },
      });

      const locator = strategy.extractLocator(message);
      expect(locator.sessionId).toBe('');

      // 没有 sessionKey 时应该拒绝匹配，避免路由到错误的角色
      const matches = strategy.matches(message, bindingStore.getBindings()[0]);
      expect(matches).toBe(false);
    });

    it('应该拒绝未知 app 类型的消息', () => {
      const message = createMockCAPMessage('behavior_mental', {}, {
        sender: {
          id: 'app_001',
          type: 'assistant',
          source_app: 'unknown_app' as any, // 未知应用类型
        },
      });

      const decision = router.route(message);

      expect(decision.action).toBe('drop');
      expect(decision.reason).toContain('No routing strategy');
    });
  });
});

// ============ 测试总结 ============
/**
 * 测试覆盖：
 * - 基本路由：3个用例
 * - 多应用实例：2个用例
 * - sessionKey匹配：2个用例
 * - 路由策略：3个用例
 *
 * 总计：10个测试用例
 */

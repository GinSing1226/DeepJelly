/**
 * 角色状态管理测试
 *
 * 测试范围：
 * 1. 角色加载和切换
 * 2. 形象管理
 * 3. 动画状态
 * 4. 动画队列
 * 5. 消息队列
 *
 * @see docs/private_docs/Reqs/4.2.角色管理.md
 * @see docs/private_docs/Tech/5.2.角色管理.md
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type {
  Assistant,
  Character,
  Appearance,
  BehaviorInstruction,
  CharacterState,
  SessionMessage,
} from '../types';

// ============ 待实现的接口 ============

/**
 * 角色Store接口
 * TODO: 在 src/stores/characterStore.ts 中实现
 */
interface CharacterStore {
  // ============ 状态 ============

  /** 助手列表 */
  assistants: Assistant[];
  /** 角色列表 */
  characters: Character[];
  /** 当前选中的助手ID */
  currentAssistantId: string | null;
  /** 当前选中的角色ID */
  currentCharacterId: string | null;
  /** 当前选中的形象ID */
  currentAppearanceId: string | null;
  /** 角色状态映射 */
  characterStates: Record<string, CharacterState>;
  /** 是否正在加载 */
  isLoading: boolean;
  /** 错误信息 */
  error: string | null;

  // ============ 动作 ============

  /** 加载助手列表 */
  loadAssistants: () => Promise<void>;
  /** 加载角色列表 */
  loadCharacters: (assistantId: string) => Promise<void>;
  /** 切换当前助手 */
  setCurrentAssistant: (assistantId: string) => void;
  /** 切换当前角色 */
  setCurrentCharacter: (characterId: string) => void;
  /** 切换当前形象 */
  setCurrentAppearance: (appearanceId: string) => void;
  /** 播放动画 */
  playAnimation: (animation: BehaviorInstruction) => void;
  /** 停止当前动画 */
  stopAnimation: () => void;
  /** 添加动画到队列 */
  queueAnimation: (animation: BehaviorInstruction) => void;
  /** 播放下一个队列动画 */
  playNextAnimation: () => void;
  /** 添加消息到队列 */
  queueMessage: (assistantId: string, message: SessionMessage) => void;
  /** 获取下一条消息 */
  getNextMessage: (assistantId: string) => SessionMessage | null;
  /** 清空消息队列 */
  clearMessageQueue: (assistantId: string) => void;
  /** 更新心理状态 */
  updateMentalState: (assistantId: string, emoji: string, text: string) => void;
  /** 清除心理状态 */
  clearMentalState: (assistantId: string) => void;

  // ============ 选择器 ============

  /** 获取当前助手 */
  getCurrentAssistant: () => Assistant | null;
  /** 获取当前角色 */
  getCurrentCharacter: () => Character | null;
  /** 获取当前形象 */
  getCurrentAppearance: () => Appearance | null;
  /** 获取当前动画 */
  getCurrentAnimation: () => BehaviorInstruction | null;
  /** 获取当前角色状态 */
  getCurrentCharacterState: () => CharacterState | null;
}

// ============ 测试数据工厂 ============

function createMockAssistant(overrides?: Partial<Assistant>): Assistant {
  return {
    id: 'asst_001',
    name: '助手小明',
    description: '项目助手',
    app_id: 'openclaw',
    agent_id: 'agent_001',
    character_id: 'char_001',
    appearance_id: 'appr_001',
    created_at: Date.now(),
    updated_at: Date.now(),
    ...overrides,
  };
}

function createMockCharacter(overrides?: Partial<Character>): Character {
  return {
    id: 'char_001',
    name: '默认角色',
    description: '标准形象',
    assistant_id: 'asst_001',
    appearances: [createMockAppearance()],
    created_at: Date.now(),
    updated_at: Date.now(),
    ...overrides,
  };
}

function createMockAppearance(overrides?: Partial<Appearance>): Appearance {
  return {
    id: 'appr_001',
    name: '休闲装',
    character_id: 'char_001',
    is_default: true,
    actions: {
      'base_idle': {
        type: 'frames',
        resources: ['base_idle_001.png', 'base_idle_002.png'],
        fps: 12,
      },
      'work_think': {
        type: 'gif',
        resources: ['work_think.gif'],
      },
    },
    ...overrides,
  };
}

function createMockAnimation(overrides?: Partial<BehaviorInstruction>): BehaviorInstruction {
  return {
    domain: 'internal',
    category: 'work',
    action_id: 'think',
    urgency: 5,
    intensity: 1.0,
    duration_ms: null,
    ...overrides,
  };
}

function createMockMessage(overrides?: Partial<SessionMessage>): SessionMessage {
  return {
    msg_id: `msg_${Date.now()}`,
    sender_id: 'agent_001',
    sender_type: 'assistant',
    sender_name: '助手小明',
    content: '这是一条测试消息',
    timestamp: Date.now(),
    ...overrides,
  };
}

// ============ 测试用例 ============

describe('角色状态管理', () => {
  let store: CharacterStore;

  beforeEach(() => {
    // TODO: 导入实际实现
    // store = useCharacterStore.getState();
    // 暂时使用mock
    store = {
      assistants: [],
      characters: [],
      currentAssistantId: null,
      currentCharacterId: null,
      currentAppearanceId: null,
      characterStates: {},
      isLoading: false,
      error: null,
      loadAssistants: vi.fn(),
      loadCharacters: vi.fn(),
      setCurrentAssistant: vi.fn(),
      setCurrentCharacter: vi.fn(),
      setCurrentAppearance: vi.fn(),
      playAnimation: vi.fn(),
      stopAnimation: vi.fn(),
      queueAnimation: vi.fn(),
      playNextAnimation: vi.fn(),
      queueMessage: vi.fn(),
      getNextMessage: vi.fn(),
      clearMessageQueue: vi.fn(),
      updateMentalState: vi.fn(),
      clearMentalState: vi.fn(),
      getCurrentAssistant: vi.fn(),
      getCurrentCharacter: vi.fn(),
      getCurrentAppearance: vi.fn(),
      getCurrentAnimation: vi.fn(),
      getCurrentCharacterState: vi.fn(),
    };
  });

  // ============ 助手管理测试 ============

  describe('助手管理', () => {
    it('应该能够加载助手列表', async () => {
      const mockAssistants = [
        createMockAssistant({ id: 'asst_001' }),
        createMockAssistant({ id: 'asst_002', name: '助手小红' }),
      ];

      // 模拟Tauri invoke返回数据
      vi.mocked(store.loadAssistants).mockImplementation(async () => {
        store.assistants = mockAssistants;
      });

      await store.loadAssistants();

      expect(store.assistants).toHaveLength(2);
      expect(store.assistants[0].name).toBe('助手小明');
      expect(store.assistants[1].name).toBe('助手小红');
    });

    it('应该能够切换当前助手', () => {
      store.assistants = [createMockAssistant({ id: 'asst_001' })];

      store.setCurrentAssistant('asst_001');

      expect(store.currentAssistantId).toBe('asst_001');
    });

    it('切换助手时应该重置角色选择', () => {
      store.currentCharacterId = 'char_old';
      store.currentAppearanceId = 'appr_old';

      vi.mocked(store.setCurrentAssistant).mockImplementation((id) => {
        store.currentAssistantId = id;
        store.currentCharacterId = null;
        store.currentAppearanceId = null;
      });

      store.setCurrentAssistant('asst_001');

      expect(store.currentCharacterId).toBeNull();
      expect(store.currentAppearanceId).toBeNull();
    });

    it('切换到不存在的助手应该报错', () => {
      expect(() => store.setCurrentAssistant('non_existent')).toThrow('助手不存在');
    });
  });

  // ============ 角色管理测试 ============

  describe('角色管理', () => {
    it('应该能够加载指定助手的角色列表', async () => {
      const mockCharacters = [
        createMockCharacter({ id: 'char_001', assistant_id: 'asst_001' }),
        createMockCharacter({ id: 'char_002', name: '工作角色', assistant_id: 'asst_001' }),
      ];

      vi.mocked(store.loadCharacters).mockImplementation(async (assistantId) => {
        if (assistantId === 'asst_001') {
          store.characters = mockCharacters;
        }
      });

      await store.loadCharacters('asst_001');

      expect(store.characters).toHaveLength(2);
    });

    it('应该能够切换当前角色', () => {
      store.characters = [createMockCharacter({ id: 'char_001' })];

      store.setCurrentCharacter('char_001');

      expect(store.currentCharacterId).toBe('char_001');
    });

    it('切换角色时应该自动选择默认形象', () => {
      const character = createMockCharacter({
        id: 'char_001',
        appearances: [
          createMockAppearance({ id: 'appr_001', is_default: true }),
          createMockAppearance({ id: 'appr_002', is_default: false }),
        ],
      });
      store.characters = [character];

      vi.mocked(store.setCurrentCharacter).mockImplementation((id) => {
        store.currentCharacterId = id;
        const char = store.characters.find(c => c.id === id);
        const defaultAppearance = char?.appearances.find(a => a.is_default);
        if (defaultAppearance) {
          store.currentAppearanceId = defaultAppearance.id;
        }
      });

      store.setCurrentCharacter('char_001');

      expect(store.currentAppearanceId).toBe('appr_001');
    });
  });

  // ============ 形象管理测试 ============

  describe('形象管理', () => {
    it('应该能够切换当前形象', () => {
      store.currentCharacterId = 'char_001';
      store.characters = [createMockCharacter({
        id: 'char_001',
        appearances: [
          createMockAppearance({ id: 'appr_001' }),
          createMockAppearance({ id: 'appr_002', name: '工作装' }),
        ],
      })];

      store.setCurrentAppearance('appr_002');

      expect(store.currentAppearanceId).toBe('appr_002');
    });

    it('切换形象时应该重新加载动画资源', () => {
      // 切换形象后应该触发资源重新加载
      // 这个测试验证回调是否被正确触发
      const onAppearanceChange = vi.fn();

      vi.mocked(store.setCurrentAppearance).mockImplementation((id) => {
        store.currentAppearanceId = id;
        onAppearanceChange(id);
      });

      store.setCurrentAppearance('appr_002');

      expect(onAppearanceChange).toHaveBeenCalledWith('appr_002');
    });
  });

  // ============ 动画管理测试 ============

  describe('动画管理', () => {
    it('应该能够播放动画', () => {
      const animation = createMockAnimation();

      store.playAnimation(animation);

      const state = store.getCurrentCharacterState();
      expect(state?.current_animation).toEqual(animation);
    });

    it('高优先级动画应该打断当前动画', () => {
      const lowPriority = createMockAnimation({ urgency: 3, action_id: 'idle' });
      const highPriority = createMockAnimation({ urgency: 8, action_id: 'think' });

      store.playAnimation(lowPriority);
      store.playAnimation(highPriority);

      const state = store.getCurrentCharacterState();
      expect(state?.current_animation?.action_id).toBe('think');
    });

    it('低优先级动画应该加入队列', () => {
      const highPriority = createMockAnimation({ urgency: 8, action_id: 'think' });
      const lowPriority = createMockAnimation({ urgency: 3, action_id: 'idle' });

      vi.mocked(store.playAnimation).mockImplementation((animation) => {
        const current = store.getCurrentAnimation();
        if (current && animation.urgency <= current.urgency) {
          store.queueAnimation(animation);
        }
      });

      store.playAnimation(highPriority);
      store.playAnimation(lowPriority);

      const state = store.getCurrentCharacterState();
      expect(state?.animation_queue).toContainEqual(lowPriority);
    });

    it('应该能够停止当前动画', () => {
      const animation = createMockAnimation();
      store.playAnimation(animation);

      store.stopAnimation();

      const state = store.getCurrentCharacterState();
      expect(state?.current_animation).toBeNull();
    });

    it('停止动画后应该播放队列中的下一个', () => {
      const animation1 = createMockAnimation({ action_id: 'idle' });
      const animation2 = createMockAnimation({ action_id: 'think' });

      store.playAnimation(animation1);
      store.queueAnimation(animation2);

      store.stopAnimation();
      store.playNextAnimation();

      const state = store.getCurrentCharacterState();
      expect(state?.current_animation?.action_id).toBe('think');
    });
  });

  // ============ 消息队列测试 ============

  describe('消息队列', () => {
    it('应该能够添加消息到队列', () => {
      const message = createMockMessage();

      store.queueMessage('asst_001', message);

      const nextMessage = store.getNextMessage('asst_001');
      expect(nextMessage).toEqual(message);
    });

    it('应该按顺序获取消息', () => {
      const message1 = createMockMessage({ content: '消息1' });
      const message2 = createMockMessage({ content: '消息2' });

      store.queueMessage('asst_001', message1);
      store.queueMessage('asst_001', message2);

      expect(store.getNextMessage('asst_001')?.content).toBe('消息1');
      expect(store.getNextMessage('asst_001')?.content).toBe('消息2');
    });

    it('队列空时应该返回null', () => {
      expect(store.getNextMessage('asst_001')).toBeNull();
    });

    it('应该能够清空消息队列', () => {
      store.queueMessage('asst_001', createMockMessage());
      store.queueMessage('asst_001', createMockMessage());

      store.clearMessageQueue('asst_001');

      expect(store.getNextMessage('asst_001')).toBeNull();
    });

    it('消息队列最多保留10条消息', () => {
      for (let i = 0; i < 15; i++) {
        store.queueMessage('asst_001', createMockMessage({ content: `消息${i}` }));
      }

      const state = store.getCurrentCharacterState();
      expect(state?.message_queue.length).toBeLessThanOrEqual(10);
    });
  });

  // ============ 心理状态测试 ============

  describe('心理状态', () => {
    it('应该能够更新心理状态', () => {
      store.updateMentalState('asst_001', '🤔', '思考中');

      const state = store.getCurrentCharacterState();
      expect(state?.mental_state).toEqual({
        emoji: '🤔',
        text: '思考中',
      });
    });

    it('应该能够清除心理状态', () => {
      store.updateMentalState('asst_001', '🤔', '思考中');
      store.clearMentalState('asst_001');

      const state = store.getCurrentCharacterState();
      expect(state?.mental_state).toBeNull();
    });
  });

  // ============ 选择器测试 ============

  describe('选择器', () => {
    beforeEach(() => {
      store.assistants = [createMockAssistant({ id: 'asst_001' })];
      store.characters = [createMockCharacter({ id: 'char_001', assistant_id: 'asst_001' })];
      store.currentAssistantId = 'asst_001';
      store.currentCharacterId = 'char_001';
      store.currentAppearanceId = 'appr_001';
    });

    it('getCurrentAssistant应该返回当前助手', () => {
      vi.mocked(store.getCurrentAssistant).mockReturnValue(store.assistants[0]);

      const assistant = store.getCurrentAssistant();

      expect(assistant?.id).toBe('asst_001');
    });

    it('getCurrentCharacter应该返回当前角色', () => {
      vi.mocked(store.getCurrentCharacter).mockReturnValue(store.characters[0]);

      const character = store.getCurrentCharacter();

      expect(character?.id).toBe('char_001');
    });

    it('getCurrentAppearance应该返回当前形象', () => {
      vi.mocked(store.getCurrentAppearance).mockReturnValue(store.characters[0].appearances[0]);

      const appearance = store.getCurrentAppearance();

      expect(appearance?.id).toBe('appr_001');
    });

    it('没有选择时应该返回null', () => {
      store.currentAssistantId = null;

      vi.mocked(store.getCurrentAssistant).mockReturnValue(null);

      expect(store.getCurrentAssistant()).toBeNull();
    });
  });

  // ============ 错误处理测试 ============

  describe('错误处理', () => {
    it('加载失败时应该设置错误信息', async () => {
      vi.mocked(store.loadAssistants).mockImplementation(async () => {
        store.error = '网络错误';
      });

      await store.loadAssistants();

      expect(store.error).toBe('网络错误');
    });

    it('加载中应该设置isLoading标志', async () => {
      vi.mocked(store.loadAssistants).mockImplementation(async () => {
        store.isLoading = true;
        await new Promise(resolve => setTimeout(resolve, 100));
        store.isLoading = false;
      });

      const promise = store.loadAssistants();

      expect(store.isLoading).toBe(true);
      await promise;
      expect(store.isLoading).toBe(false);
    });
  });
});

// ============ 测试总结 ============
/**
 * 测试覆盖：
 * - 助手管理：4个用例
 * - 角色管理：3个用例
 * - 形象管理：2个用例
 * - 动画管理：5个用例
 * - 消息队列：5个用例
 * - 心理状态：2个用例
 * - 选择器：4个用例
 * - 错误处理：2个用例
 *
 * 总计：27个测试用例
 *
 * 实现要点：
 * 1. 使用Zustand创建store
 * 2. 角色状态按assistant_id分组存储
 * 3. 动画队列需要优先级排序
 * 4. 消息队列有最大长度限制
 */

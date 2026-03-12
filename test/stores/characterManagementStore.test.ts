/**
 * Character Management Store Tests
 *
 * Meta-Name: Character Management Store Test Suite
 * Meta-Description: TDD测试套件，验证角色管理状态管理功能
 *
 * 测试策略：
 * - 使用实际实现的集成测试，优先于 mock
 * - Mock 仅用于外部依赖（Tauri invoke API）
 * - 验证状态管理、CRUD操作、搜索过滤、树构建等核心功能
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { invoke } from '@tauri-apps/api/core';
import { useCharacterManagementStore } from '@/stores/characterManagementStore';
import type {
  Assistant,
  Character,
  Appearance,
  AIApp,
} from '@/types/character';

// ============ Mocks ============

// Mock Tauri invoke API
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

// ============ Test Data ============

const mockApps: AIApp[] = [
  { id: 'openclaw', name: 'OpenClaw', description: 'OpenClaw AI应用' },
  { id: 'claude', name: 'Claude', description: 'Claude AI' },
];

const mockAssistants: Assistant[] = [
  {
    id: 'ast_001',
    name: '工作助手',
    description: '工作相关助手',
    appType: 'openclaw',
    agentLabel: 'worker',
    createdAt: 1234567890000,
    characters: [],
  },
  {
    id: 'ast_002',
    name: '生活助手',
    description: '生活相关助手',
    appType: 'openclaw',
    agentLabel: 'life',
    createdAt: 1234567891000,
    characters: [],
  },
];

const mockCharacters: Character[] = [
  {
    id: 'char_001',
    assistantId: 'ast_001',
    name: '程序员',
    description: '程序员角色',
    appearances: [],
    defaultAppearanceId: 'appr_001',
  },
  {
    id: 'char_002',
    assistantId: 'ast_001',
    name: '产品经理',
    description: '产品经理角色',
    appearances: [],
    defaultAppearanceId: 'appr_002',
  },
];

const mockAppearances: Appearance[] = [
  {
    id: 'appr_001',
    name: '默认形象',
    characterId: 'char_001',
    isDefault: true,
    actions: {
      'internal-base-idle': {
        type: 'frames',
        resources: ['idle_01.png', 'idle_02.png'],
        fps: 10,
        loop: true,
      },
    },
  },
];

// ============ Helper Functions ============

/**
 * 重置 store 状态
 */
function resetStore() {
  useCharacterManagementStore.getState().reset();
}

/**
 * 等待异步操作完成
 */
async function waitForAct() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

// ============ Test Suite ============

describe('characterManagementStore', () => {
  beforeEach(() => {
    resetStore();
    vi.clearAllMocks();
  });

  // ============ 初始化状态测试 ============

  describe('初始状态', () => {
    it('应该有正确的默认状态', () => {
      const state = useCharacterManagementStore.getState();

      // apps 有默认值，不是空数组
      expect(state.apps.length).toBeGreaterThan(0);
      expect(state.assistants).toEqual([]);
      expect(state.characters).toEqual({});
      expect(state.selectedAssistantId).toBeNull();
      expect(state.displayConfig).toBeNull();
      expect(state.searchQuery).toBe('');
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
    });

    it('reset 应该重置所有状态到初始值', () => {
      const store = useCharacterManagementStore.getState();

      // 修改一些状态 (避免触发 loadCharacters)
      act(() => {
        store.setSearchQuery('test');
        useCharacterManagementStore.setState({
          selectedAssistantId: 'ast_001',
        });
      });

      // 重置
      act(() => {
        store.reset();
      });

      const state = useCharacterManagementStore.getState();
      expect(state.searchQuery).toBe('');
      expect(state.selectedAssistantId).toBeNull();
      expect(state.assistants).toEqual([]);
    });
  });

  // ============ 助手管理测试 ============

  describe('助手管理', () => {
    describe('loadAssistants', () => {
      it('应该成功加载助手列表', async () => {
        vi.mocked(invoke).mockResolvedValue(mockAssistants);

        const store = useCharacterManagementStore.getState();

        await act(async () => {
          await store.loadAssistants();
        });

        const state = useCharacterManagementStore.getState();
        expect(state.assistants).toEqual(mockAssistants);
        expect(state.isLoading).toBe(false);
        expect(invoke).toHaveBeenCalledWith('get_all_assistants');
      });

      it('加载失败时应该设置错误状态', async () => {
        vi.mocked(invoke).mockRejectedValue(new Error('Network error'));

        const store = useCharacterManagementStore.getState();

        await act(async () => {
          await store.loadAssistants();
        });

        const state = useCharacterManagementStore.getState();
        expect(state.assistants).toEqual([]);
        expect(state.isLoading).toBe(false);
      });
    });

    describe('addAssistant', () => {
      it('应该成功添加新助手', async () => {
        const newAssistant: Assistant = {
          id: 'ast_003',
          name: '新助手',
          description: '新创建的助手',
          appType: 'openclaw',
          createdAt: Date.now(),
          characters: [],
        };

        vi.mocked(invoke).mockResolvedValue(newAssistant);

        const store = useCharacterManagementStore.getState();

        // 先添加一些现有助手
        act(() => {
          useCharacterManagementStore.setState({
            assistants: mockAssistants,
          });
        });

        const result = await act(async () => {
          return await store.addAssistant(newAssistant);
        });

        const state = useCharacterManagementStore.getState();
        expect(state.assistants).toHaveLength(3);
        expect(state.assistants).toContainEqual(newAssistant);
        expect(result).toEqual(newAssistant);
      });

      it('添加失败时应该抛出错误', async () => {
        vi.mocked(invoke).mockRejectedValue(new Error('Create failed'));

        const store = useCharacterManagementStore.getState();
        const newAssistant = {
          name: '新助手',
          description: '描述',
          appType: 'openclaw',
        };

        await expect(
          act(async () => {
            await store.addAssistant(newAssistant);
          })
        ).rejects.toThrow('Create failed');
      });
    });

    describe('updateAssistant', () => {
      it('应该成功更新助手信息', async () => {
        vi.mocked(invoke).mockResolvedValue(undefined);

        const store = useCharacterManagementStore.getState();

        // 先添加助手
        act(() => {
          useCharacterManagementStore.setState({
            assistants: mockAssistants,
          });
        });

        await act(async () => {
          await store.updateAssistant('ast_001', {
            name: '更新后的名称',
            description: '更新后的描述',
          });
        });

        const state = useCharacterManagementStore.getState();
        const updated = state.assistants.find((a) => a.id === 'ast_001');

        expect(updated?.name).toBe('更新后的名称');
        expect(updated?.description).toBe('更新后的描述');
      });

      it('更新失败时应该抛出错误', async () => {
        vi.mocked(invoke).mockRejectedValue(new Error('Update failed'));

        const store = useCharacterManagementStore.getState();

        act(() => {
          useCharacterManagementStore.setState({
            assistants: mockAssistants,
          });
        });

        await expect(
          act(async () => {
            await store.updateAssistant('ast_001', { name: '新名称' });
          })
        ).rejects.toThrow('Update failed');
      });
    });

    describe('deleteAssistant', () => {
      it('应该成功删除助手', async () => {
        vi.mocked(invoke).mockResolvedValue(undefined);

        const store = useCharacterManagementStore.getState();

        act(() => {
          useCharacterManagementStore.setState({
            assistants: mockAssistants,
            selectedAssistantId: 'ast_001',
          });
        });

        await act(async () => {
          await store.deleteAssistant('ast_001');
        });

        const state = useCharacterManagementStore.getState();
        expect(state.assistants).toHaveLength(1);
        expect(state.assistants.find((a) => a.id === 'ast_001')).toBeUndefined();
        // 删除选中的助手应该清除选中状态
        expect(state.selectedAssistantId).toBeNull();
      });

      it('删除未选中的助手不应该影响选中状态', async () => {
        vi.mocked(invoke).mockResolvedValue(undefined);

        const store = useCharacterManagementStore.getState();

        act(() => {
          useCharacterManagementStore.setState({
            assistants: mockAssistants,
            selectedAssistantId: 'ast_002',
          });
        });

        await act(async () => {
          await store.deleteAssistant('ast_001');
        });

        const state = useCharacterManagementStore.getState();
        expect(state.selectedAssistantId).toBe('ast_002');
      });
    });
  });

  // ============ 角色管理测试 ============

  describe('角色管理', () => {
    describe('loadAllCharacters', () => {
      it('应该成功加载所有角色并按助手分组', async () => {
        const backendCharacters = [
          {
            id: 'char_001',
            name: '程序员',
            description: '程序员角色',
            assistantId: 'ast_001',
            appearances: [],
            defaultAppearanceId: undefined,
          },
          {
            id: 'char_002',
            name: '产品经理',
            description: '产品经理角色',
            assistantId: 'ast_001',
            appearances: [],
            defaultAppearanceId: undefined,
          },
        ];

        vi.mocked(invoke).mockResolvedValue(backendCharacters);

        const store = useCharacterManagementStore.getState();

        await act(async () => {
          await store.loadAllCharacters();
        });

        const state = useCharacterManagementStore.getState();
        expect(state.characters['ast_001']).toHaveLength(2);
        expect(state.isLoading).toBe(false);
      });

      it('加载失败时应该设置错误状态', async () => {
        vi.mocked(invoke).mockRejectedValue(new Error('Load failed'));

        const store = useCharacterManagementStore.getState();

        await act(async () => {
          await store.loadAllCharacters();
        });

        const state = useCharacterManagementStore.getState();
        expect(state.characters).toEqual({});
        expect(state.isLoading).toBe(false);
        expect(state.error).toBeTruthy();
      });
    });

    describe('loadCharacters', () => {
      it('应该成功加载指定助手的角色列表', async () => {
        const backendCharacters = [
          {
            id: 'char_001',
            name: '程序员',
            description: '程序员角色',
            assistantId: 'ast_001',
            appearances: [],
            defaultAppearanceId: undefined,
          },
        ];

        vi.mocked(invoke).mockResolvedValue(backendCharacters);

        const store = useCharacterManagementStore.getState();

        await act(async () => {
          await store.loadCharacters('ast_001');
        });

        const state = useCharacterManagementStore.getState();
        expect(state.characters['ast_001']).toHaveLength(1);
        expect(state.characters['ast_001'][0].name).toBe('程序员');
      });
    });

    describe('addCharacter', () => {
      it('应该成功添加新角色', async () => {
        // Mock返回完整的后端角色配置
        const backendResponse = {
          id: 'char_new_001',
          name: '设计师',
          description: '设计师角色',
          assistantId: 'ast_001',
          appearances: [],
          defaultAppearanceId: undefined,
        };
        vi.mocked(invoke).mockResolvedValue(backendResponse);

        const store = useCharacterManagementStore.getState();
        const newCharacterData = {
          name: '设计师',
          description: '设计师角色',
          defaultAppearanceId: 'appr_001',
        };

        act(() => {
          useCharacterManagementStore.setState({
            characters: {
              ast_001: mockCharacters,
            },
          });
        });

        await act(async () => {
          await store.addCharacter('ast_001', newCharacterData);
        });

        const state = useCharacterManagementStore.getState();
        expect(state.characters['ast_001']).toHaveLength(3);
        expect(
          state.characters['ast_001'].find((c) => c.name === '设计师')
        ).toBeDefined();
      });

      it('后端调用失败时应该仍然更新本地状态', async () => {
        vi.mocked(invoke).mockRejectedValue(new Error('Backend error'));

        const store = useCharacterManagementStore.getState();
        const newCharacterData = {
          name: '设计师',
          description: '设计师角色',
        };

        act(() => {
          useCharacterManagementStore.setState({
            characters: {
              ast_001: mockCharacters,
            },
          });
        });

        const result = await act(async () => {
          return await store.addCharacter('ast_001', newCharacterData);
        });

        const state = useCharacterManagementStore.getState();
        expect(state.characters['ast_001']).toHaveLength(3);
        expect(result.name).toBe('设计师');
      });
    });

    describe('updateCharacter', () => {
      it('应该成功更新角色信息', async () => {
        vi.mocked(invoke).mockResolvedValue(undefined);

        const store = useCharacterManagementStore.getState();

        act(() => {
          useCharacterManagementStore.setState({
            characters: {
              ast_001: mockCharacters,
            },
          });
        });

        await act(async () => {
          await store.updateCharacter('char_001', {
            name: '高级程序员',
            description: '资深开发',
          });
        });

        const state = useCharacterManagementStore.getState();
        const updated = state.characters['ast_001'].find(
          (c) => c.id === 'char_001'
        );

        expect(updated?.name).toBe('高级程序员');
        expect(updated?.description).toBe('资深开发');
      });
    });

    describe('deleteCharacter', () => {
      it('应该成功删除角色', async () => {
        vi.mocked(invoke).mockResolvedValue(undefined);

        const store = useCharacterManagementStore.getState();

        act(() => {
          useCharacterManagementStore.setState({
            characters: {
              ast_001: mockCharacters,
            },
          });
        });

        await act(async () => {
          await store.deleteCharacter('char_001');
        });

        const state = useCharacterManagementStore.getState();
        expect(state.characters['ast_001']).toHaveLength(1);
        expect(
          state.characters['ast_001'].find((c) => c.id === 'char_001')
        ).toBeUndefined();
      });

      it('后端调用失败时应该仍然更新本地状态', async () => {
        vi.mocked(invoke).mockRejectedValue(new Error('Backend error'));

        const store = useCharacterManagementStore.getState();

        act(() => {
          useCharacterManagementStore.setState({
            characters: {
              ast_001: mockCharacters,
            },
          });
        });

        await act(async () => {
          await store.deleteCharacter('char_001');
        });

        const state = useCharacterManagementStore.getState();
        expect(state.characters['ast_001']).toHaveLength(1);
        expect(state.error).toBeTruthy();
      });
    });
  });

  // ============ 形象管理测试 ============

  describe('形象管理', () => {
    describe('addAppearance', () => {
      it('应该成功添加新形象', async () => {
        const mockNewAppearance: Appearance = {
          id: 'appr_new_001',
          name: '休闲形象',
          characterId: 'char_001',
          isDefault: false,
          actions: {},
        };

        vi.mocked(invoke).mockResolvedValue(mockNewAppearance);

        const store = useCharacterManagementStore.getState();
        const newAppearanceData = {
          name: '休闲形象',
          isDefault: false,
          actions: {},
        };

        act(() => {
          useCharacterManagementStore.setState({
            characters: {
              ast_001: mockCharacters,
            },
          });
        });

        await act(async () => {
          await store.addAppearance('char_001', newAppearanceData);
        });

        const state = useCharacterManagementStore.getState();
        const character = state.characters['ast_001'].find(
          (c) => c.id === 'char_001'
        );

        expect(character?.appearances).toHaveLength(1);
        expect(character?.appearances[0].name).toBe('休闲形象');
      });
    });

    describe('updateAppearance', () => {
      it('应该成功更新形象信息', async () => {
        vi.mocked(invoke).mockResolvedValue(undefined);

        const store = useCharacterManagementStore.getState();

        const characterWithAppearances: Character = {
          ...mockCharacters[0],
          appearances: mockAppearances,
        };

        act(() => {
          useCharacterManagementStore.setState({
            characters: {
              ast_001: [characterWithAppearances],
            },
          });
        });

        await act(async () => {
          await store.updateAppearance('appr_001', {
            name: '更新后的形象',
          });
        });

        const state = useCharacterManagementStore.getState();
        const character = state.characters['ast_001'][0];
        const updated = character.appearances.find((a) => a.id === 'appr_001');

        expect(updated?.name).toBe('更新后的形象');
      });
    });

    describe('deleteAppearance', () => {
      it('应该成功删除形象', async () => {
        vi.mocked(invoke).mockResolvedValue(undefined);

        const store = useCharacterManagementStore.getState();

        const characterWithAppearances: Character = {
          ...mockCharacters[0],
          appearances: mockAppearances,
        };

        act(() => {
          useCharacterManagementStore.setState({
            characters: {
              ast_001: [characterWithAppearances],
            },
          });
        });

        await act(async () => {
          await store.deleteAppearance('appr_001');
        });

        const state = useCharacterManagementStore.getState();
        const character = state.characters['ast_001'][0];

        expect(character.appearances).toHaveLength(0);
      });
    });

    describe('setDefaultAppearance', () => {
      it('应该成功设置默认形象', async () => {
        const store = useCharacterManagementStore.getState();

        const characterWithAppearances: Character = {
          ...mockCharacters[0],
          appearances: mockAppearances,
        };

        act(() => {
          useCharacterManagementStore.setState({
            characters: {
              ast_001: [characterWithAppearances],
            },
          });
        });

        await act(async () => {
          await store.setDefaultAppearance('char_001', 'appr_001');
        });

        const state = useCharacterManagementStore.getState();
        const character = state.characters['ast_001'][0];

        expect(character.defaultAppearanceId).toBe('appr_001');
      });
    });
  });

  // ============ UI 状态管理测试 ============

  describe('UI状态管理', () => {
    describe('selectAssistant', () => {
      it('应该成功选中助手', () => {
        // Mock loadCharacters 返回空数组避免报错
        vi.mocked(invoke).mockResolvedValue([]);

        const store = useCharacterManagementStore.getState();

        act(() => {
          store.selectAssistant('ast_001');
        });

        const state = useCharacterManagementStore.getState();
        expect(state.selectedAssistantId).toBe('ast_001');
      });

      it('选中助手时应该触发加载角色列表', async () => {
        const backendCharacters = [
          {
            id: 'char_001',
            name: '程序员',
            description: '程序员角色',
            assistantId: 'ast_001',
            appearances: [],
            defaultAppearanceId: undefined,
          },
        ];

        vi.mocked(invoke).mockResolvedValue(backendCharacters);

        const store = useCharacterManagementStore.getState();

        await act(async () => {
          store.selectAssistant('ast_001');
          // 等待异步操作完成
          await new Promise((resolve) => setTimeout(resolve, 10));
        });

        const state = useCharacterManagementStore.getState();
        expect(state.selectedAssistantId).toBe('ast_001');
        expect(invoke).toHaveBeenCalledWith('data_get_characters_by_assistant', { assistantId: 'ast_001' });
      });

      it('应该支持取消选中', () => {
        const store = useCharacterManagementStore.getState();

        act(() => {
          store.selectAssistant('ast_001');
        });

        expect(useCharacterManagementStore.getState().selectedAssistantId).toBe('ast_001');

        act(() => {
          store.selectAssistant(null);
        });

        expect(useCharacterManagementStore.getState().selectedAssistantId).toBeNull();
      });
    });

    describe('setSearchQuery', () => {
      it('应该成功设置搜索关键词', () => {
        const store = useCharacterManagementStore.getState();

        act(() => {
          store.setSearchQuery('工作');
        });

        const state = useCharacterManagementStore.getState();
        expect(state.searchQuery).toBe('工作');
      });

      it('清空搜索关键词应该显示所有结果', () => {
        const store = useCharacterManagementStore.getState();

        act(() => {
          store.setSearchQuery('工作');
        });

        expect(useCharacterManagementStore.getState().searchQuery).toBe('工作');

        act(() => {
          store.setSearchQuery('');
        });

        expect(useCharacterManagementStore.getState().searchQuery).toBe('');
      });
    });

    describe('clearError', () => {
      it('应该成功清除错误信息', () => {
        const store = useCharacterManagementStore.getState();

        act(() => {
          useCharacterManagementStore.setState({
            error: 'Some error',
          });
          store.clearError();
        });

        const state = useCharacterManagementStore.getState();
        expect(state.error).toBeNull();
      });
    });
  });

  // ============ 应用管理测试 ============

  describe('应用管理', () => {
    describe('loadApps', () => {
      it('应该成功加载应用列表', async () => {
        const store = useCharacterManagementStore.getState();

        await act(async () => {
          await store.loadApps();
        });

        const state = useCharacterManagementStore.getState();
        expect(state.isLoading).toBe(false);
      });
    });

    describe('addApp', () => {
      it('应该成功添加新应用', async () => {
        const store = useCharacterManagementStore.getState();
        const newApp = {
          name: '新应用',
          description: '新AI应用',
        };

        await act(async () => {
          await store.addApp(newApp);
        });

        const state = useCharacterManagementStore.getState();
        expect(state.apps.length).toBeGreaterThan(0);
        expect(state.apps.find((a) => a.name === '新应用')).toBeDefined();
      });
    });

    describe('deleteApp', () => {
      it('应该成功删除应用及其关联的助手', async () => {
        const store = useCharacterManagementStore.getState();

        act(() => {
          useCharacterManagementStore.setState({
            apps: mockApps,
            assistants: mockAssistants,
          });
        });

        await act(async () => {
          await store.deleteApp('openclaw');
        });

        const state = useCharacterManagementStore.getState();
        expect(state.apps.find((a) => a.id === 'openclaw')).toBeUndefined();
        // 应该删除关联的助手
        expect(
          state.assistants.filter((a) => a.appType === 'openclaw')
        ).toHaveLength(0);
      });
    });
  });

  // ============ 派生状态测试 ============

  describe('派生状态', () => {
    describe('selectCurrentCharacters', () => {
      it('没有选中助手时应该返回空数组', () => {
        const store = useCharacterManagementStore.getState();

        act(() => {
          useCharacterManagementStore.setState({
            selectedAssistantId: null,
          });
        });

        const state = useCharacterManagementStore.getState();
        const characters = state.characters['ast_001'] || [];
        expect(characters).toEqual([]);
      });

      it('应该返回选中助手的角色列表', () => {
        const store = useCharacterManagementStore.getState();

        act(() => {
          useCharacterManagementStore.setState({
            selectedAssistantId: 'ast_001',
            characters: {
              ast_001: mockCharacters,
              ast_002: [],
            },
          });
        });

        const state = useCharacterManagementStore.getState();
        const characters = state.characters['ast_001'] || [];
        expect(characters).toEqual(mockCharacters);
      });
    });

    describe('selectCurrentAssistant', () => {
      it('没有选中助手时应该返回 null', () => {
        const store = useCharacterManagementStore.getState();

        act(() => {
          useCharacterManagementStore.setState({
            selectedAssistantId: null,
            assistants: mockAssistants,
          });
        });

        const state = useCharacterManagementStore.getState();
        const assistant =
          state.assistants.find((a) => a.id === state.selectedAssistantId) || null;
        expect(assistant).toBeNull();
      });

      it('应该返回选中的助手对象', () => {
        const store = useCharacterManagementStore.getState();

        act(() => {
          useCharacterManagementStore.setState({
            selectedAssistantId: 'ast_001',
            assistants: mockAssistants,
          });
        });

        const state = useCharacterManagementStore.getState();
        const assistant = state.assistants.find((a) => a.id === 'ast_001') || null;
        expect(assistant).toEqual(mockAssistants[0]);
      });
    });
  });

  // ============ 错误处理测试 ============

  describe('错误处理', () => {
    it('加载助手失败时应该设置错误状态并保持为空数组', async () => {
      vi.mocked(invoke).mockRejectedValue(new Error('Load failed'));

      const store = useCharacterManagementStore.getState();

      await act(async () => {
        await store.loadAssistants();
      });

      const state = useCharacterManagementStore.getState();
      expect(state.assistants).toEqual([]);
      expect(state.isLoading).toBe(false);
    });

    it('删除助手失败时应该抛出错误', async () => {
      vi.mocked(invoke).mockRejectedValue(new Error('Delete failed'));

      const store = useCharacterManagementStore.getState();

      act(() => {
        useCharacterManagementStore.setState({
          assistants: mockAssistants,
        });
      });

      await expect(
        act(async () => {
          await store.deleteAssistant('ast_001');
        })
      ).rejects.toThrow('Delete failed');
    });
  });
});

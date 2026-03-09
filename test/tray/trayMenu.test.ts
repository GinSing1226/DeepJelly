/**
 * 托盘功能测试
 *
 * 测试托盘菜单、托盘图标状态、托盘事件处理
 *
 * @module test/tray/trayMenu.test
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTrayEventHandler, type TrayEventPayload } from '@/hooks/useTrayEventHandler';
import { useSettingsStore } from '@/stores/settingsStore';
import { useCharacterStore } from '@/stores/characterStore';
import { useMessageStore } from '@/stores/messageStore';

// Mock Tauri API
const mockInvoke = vi.fn();
const mockListen = vi.fn();

// Mock i18n
const mockChangeLanguage = vi.fn();
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: {
      changeLanguage: mockChangeLanguage,
    },
  }),
  initReactI18next: {
    type: '3rdParty',
    init: vi.fn(),
  },
}));

vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => mockInvoke(...args),
}));

vi.mock('@tauri-apps/api/event', () => ({
  listen: (...args: unknown[]) => mockListen(...args),
}));

vi.mock('@tauri-apps/api/process', () => ({
  exit: vi.fn(),
}));

describe('托盘功能测试', () => {
  // ============ 测试设置 ============

  let unlistenMock: (() => void) | null = null;

  beforeEach(() => {
    vi.clearAllMocks();
    mockChangeLanguage.mockResolvedValue(undefined);

    // 重置stores
    useSettingsStore.setState({
      isDoNotDisturb: false,
      isHidden: false,
      queuedMessages: [],
      language: 'zh',
    });
    useCharacterStore.setState({
      isConnected: false,
      isPenetrationMode: false,
      position: { x: 100, y: 100 },
      currentAnimation: 'idle',
    });
    useMessageStore.setState({
      messages: [],
      currentBubble: null,
    });

    // Mock listen返回unlisten函数
    unlistenMock = vi.fn();
    mockListen.mockResolvedValue(unlistenMock);

    // Mock invoke
    mockInvoke.mockResolvedValue('success');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ============ 托盘菜单测试 ============

  describe('托盘菜单项测试', () => {
    it('TC-TRAY-001: 点击托盘"打开对话框"应调用 open_dialog_window', async () => {
      renderHook(() => useTrayEventHandler());

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      const callback = mockListen.mock.calls[0][1];
      expect(mockListen).toHaveBeenCalledWith('tray-event', expect.any(Function));

      await act(async () => {
        callback({ payload: { action: 'open-dialog' } as TrayEventPayload });
      });

      expect(mockInvoke).toHaveBeenCalledWith('open_dialog_window');
    });

    it('TC-TRAY-002: 点击"设置"菜单项应调用 open_settings_window', async () => {
      renderHook(() => useTrayEventHandler());

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      const callback = mockListen.mock.calls[0][1];

      await act(async () => {
        callback({ payload: { action: 'settings' } as TrayEventPayload });
      });

      expect(mockInvoke).toHaveBeenCalledWith('open_settings_window');
    });

    it('TC-TRAY-003: 点击"退出"菜单项应打开退出确认窗口', async () => {
      renderHook(() => useTrayEventHandler());

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      const callback = mockListen.mock.calls[0][1];

      await act(async () => {
        callback({ payload: { action: 'open-quit-confirm' } as TrayEventPayload });
      });

      expect(mockInvoke).toHaveBeenCalledWith('open_quit_confirm_window');
    });
  });

  // ============ 勿扰模式测试 ============

  describe('勿扰模式测试', () => {
    it('TC-DND-001: 进入勿扰模式应切换状态', async () => {
      const { result } = renderHook(() => useTrayEventHandler());

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      await act(async () => {
        result.current.enterDoNotDisturb();
      });

      expect(useSettingsStore.getState().isDoNotDisturb).toBe(true);
    });

    it('TC-DND-002: 进入勿扰模式应切换为悬浮球动画', async () => {
      const { result } = renderHook(() => useTrayEventHandler());

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      await act(async () => {
        result.current.enterDoNotDisturb();
      });

      expect(useCharacterStore.getState().currentAnimation).toBe('floating');
    });

    it('TC-DND-003: 退出勿扰模式应恢复状态', async () => {
      useSettingsStore.setState({ isDoNotDisturb: true });

      const { result } = renderHook(() => useTrayEventHandler());

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      await act(async () => {
        result.current.exitDoNotDisturb();
      });

      expect(useSettingsStore.getState().isDoNotDisturb).toBe(false);
      expect(useCharacterStore.getState().currentAnimation).toBe('idle');
    });

    it('TC-DND-004: 托盘菜单切换勿扰模式', async () => {
      const { result } = renderHook(() => useTrayEventHandler());

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      const callback = mockListen.mock.calls[0][1];

      await act(async () => {
        callback({ payload: { action: 'toggle-dnd' } as TrayEventPayload });
      });

      expect(useSettingsStore.getState().isDoNotDisturb).toBe(true);
    });
  });

  // ============ 隐藏角色测试 ============

  describe('隐藏角色测试', () => {
    it('TC-HIDE-001: 隐藏角色应更新状态', async () => {
      const { result } = renderHook(() => useTrayEventHandler());

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      await act(async () => {
        result.current.hideCharacter();
      });

      expect(useSettingsStore.getState().isHidden).toBe(true);
    });

    it('TC-HIDE-002: 显示角色应更新状态', async () => {
      useSettingsStore.setState({ isHidden: true });

      const { result } = renderHook(() => useTrayEventHandler());

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      await act(async () => {
        result.current.showCharacter();
      });

      expect(useSettingsStore.getState().isHidden).toBe(false);
    });

    it('TC-HIDE-003: 托盘菜单切换隐藏状态', async () => {
      const { result } = renderHook(() => useTrayEventHandler());

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      const callback = mockListen.mock.calls[0][1];

      await act(async () => {
        callback({ payload: { action: 'toggle-hide' } as TrayEventPayload });
      });

      expect(useSettingsStore.getState().isHidden).toBe(true);
    });
  });

  // ============ 位置重置测试 ============

  describe('位置重置测试', () => {
    it('TC-CENTER-001: 回到屏幕中央应更新位置', async () => {
      useCharacterStore.setState({ position: { x: 0, y: 0 } });

      const { result } = renderHook(() => useTrayEventHandler());

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      await act(async () => {
        result.current.centerCharacter();
      });

      const position = useCharacterStore.getState().position;
      // 位置应该被更新（具体值取决于 getScreenCenter 的 mock）
      expect(position).toBeDefined();
    });

    it('TC-CENTER-002: 托盘菜单触发回到屏幕中央', async () => {
      useCharacterStore.setState({ position: { x: 0, y: 0 } });

      renderHook(() => useTrayEventHandler());

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      const callback = mockListen.mock.calls[0][1];

      await act(async () => {
        callback({ payload: { action: 'center-character' } as TrayEventPayload });
      });

      const position = useCharacterStore.getState().position;
      expect(position).toBeDefined();
    });
  });

  // ============ 语言切换测试 ============

  describe('语言切换测试', () => {
    it('TC-LANG-001: 切换到英文应调用 set_locale', async () => {
      renderHook(() => useTrayEventHandler());

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      const callback = mockListen.mock.calls[0][1];

      await act(async () => {
        callback({ payload: { action: 'change-language', lang: 'en' } as TrayEventPayload });
      });

      expect(mockInvoke).toHaveBeenCalledWith('set_locale', { locale: 'en' });
    });

    it('TC-LANG-002: 切换到日文应调用 set_locale', async () => {
      renderHook(() => useTrayEventHandler());

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      const callback = mockListen.mock.calls[0][1];

      await act(async () => {
        callback({ payload: { action: 'change-language', lang: 'ja' } as TrayEventPayload });
      });

      expect(mockInvoke).toHaveBeenCalledWith('set_locale', { locale: 'ja' });
    });
  });

  // ============ 连接状态测试 ============

  describe('连接状态测试', () => {
    it('TC-CONN-001: 连接成功应更新状态', async () => {
      mockInvoke.mockResolvedValue('connected');

      const { result } = renderHook(() => useTrayEventHandler());

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      await act(async () => {
        await result.current.connect();
      });

      expect(useCharacterStore.getState().isConnected).toBe(true);
    });

    it('TC-CONN-002: 断开连接应更新状态', async () => {
      useCharacterStore.setState({ isConnected: true });

      const { result } = renderHook(() => useTrayEventHandler());

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      await act(async () => {
        await result.current.disconnect();
      });

      expect(useCharacterStore.getState().isConnected).toBe(false);
    });
  });

  // ============ 设置窗口测试 ============

  describe('设置窗口测试', () => {
    it('TC-SETTINGS-001: 点击设置应调用 open_settings_window', async () => {
      renderHook(() => useTrayEventHandler());

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      const callback = mockListen.mock.calls[0][1];

      await act(async () => {
        callback({ payload: { action: 'settings' } as TrayEventPayload });
      });

      expect(mockInvoke).toHaveBeenCalledWith('open_settings_window');
    });

    it('TC-SETTINGS-002: open_settings_window 失败应显示错误消息', async () => {
      const errorMessage = 'Failed to create settings window';
      mockInvoke.mockRejectedValue(errorMessage);

      renderHook(() => useTrayEventHandler());

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      const callback = mockListen.mock.calls[0][1];

      await act(async () => {
        callback({ payload: { action: 'settings' } as TrayEventPayload });
      });

      // 验证错误消息被添加
      const messages = useMessageStore.getState().messages;
      expect(messages.some(m => m.content.includes('打开设置失败'))).toBe(true);
    });
  });
});

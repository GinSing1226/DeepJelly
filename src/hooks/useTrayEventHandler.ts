/**
 * 托盘事件处理 Hook
 *
 * 处理系统托盘菜单的各种事件：打开对话框、设置、调试面板、切换角色/形象、
 * 隐藏/显示、回到屏幕中央、语言切换、退出确认等，通过 Tauri 事件通信。
 *
 * @module hooks/useTrayEventHandler
 */

import { useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { changeLocale } from '@/i18n/init';
import { useSettingsStore, getScreenCenter } from '@/stores/settingsStore';
import { useCharacterStore } from '@/stores/characterStore';
import { useMessageStore } from '@/stores/messageStore';

export interface TrayEventPayload {
  action: string;
  lang?: string;
  characterId?: string;
  appearanceId?: string;
}

export interface UseTrayEventHandlerOptions {
  // 预留扩展：onConfirmQuit 可作为退出确认对话框的回调在窗口组件处理
}

export function useTrayEventHandler(_options: UseTrayEventHandlerOptions = {}) {

  const { t } = useTranslation(['status', 'error', 'tray', 'common']);

  // 状态管理
  const {
    isDoNotDisturb,
    setDoNotDisturb,
    isHidden,
    setHidden,
    setLanguage,
    queuedMessages,
    clearQueue,
  } = useSettingsStore();


  const {
    setAnimation,
    setPosition,
  } = useCharacterStore();


  const { addMessage, setCurrentBubble } = useMessageStore();

  // ========== 打开对话框窗口 ==========

  const openDialogWindow = useCallback(async () => {
    try {
      await invoke('open_dialog_window');
    } catch (error) {
      console.error('Failed to open dialog window:', error);
      const errorMsg = error instanceof Error ? error.message : t('error:unknown');
      addMessage({
        content: `${t('error:open_dialog_failed')}: ${errorMsg}`,
        type: 'status',
        sender: 'system',
        duration: 3000,
      });
    }
  }, [addMessage]);

  // ========== 打开设置窗口 ==========

  const openSettingsWindow = useCallback(async (tab?: string) => {
    try {
      await invoke('open_settings_window', { tab });
    } catch (error) {
      console.error('Failed to open settings window:', error);
      const errorMsg = error instanceof Error ? error.message : t('error:unknown');
      addMessage({
        content: `${t('error:open_settings_failed')}: ${errorMsg}`,
        type: 'status',
        sender: 'system',
        duration: 3000,
      });
    }
  }, [addMessage]);

  // ========== 打开调试面板窗口 ==========
  // REMOVED: Debug panel feature
  /*
  const openDebugWindow = useCallback(async () => {
    console.log(`📱 [TRAY-EVENT-HOOK-${instanceIdRef.current}] openDebugWindow called`);
    try {
      await invoke('open_debug_window');
      console.log(`📱 [TRAY-EVENT-HOOK-${instanceIdRef.current}] openDebugWindow success`);
    } catch (error) {
      console.error('Failed to open debug window:', error);
      const errorMsg = error instanceof Error ? error.message : t('error:unknown');
      addMessage({
        content: `${t('error:open_debug_failed')}: ${errorMsg}`,
        type: 'status',
        sender: 'system',
        duration: 3000,
      });
    }
  }, [addMessage]);
  */

  // 防抖：防止重复打开退出确认窗口
  const openQuitConfirmWindowRef = useRef<{
    lastCall: number;
    opening: boolean;
  }>({ lastCall: 0, opening: false });

  const openQuitConfirmWindow = useCallback(async () => {
    const now = Date.now();
    // 防抖：500ms 内只允许一次调用
    if (now - openQuitConfirmWindowRef.current.lastCall < 500) {
      return;
    }
    // 防止并发调用
    if (openQuitConfirmWindowRef.current.opening) {
      return;
    }

    openQuitConfirmWindowRef.current.lastCall = now;
    openQuitConfirmWindowRef.current.opening = true;

    try {
      await invoke('open_quit_confirm_window');
    } catch (error) {
      console.error('Failed to open quit confirm window:', error);
      const errorMsg = error instanceof Error ? error.message : t('error:unknown');
      addMessage({
        content: `${t('error:open_quit_confirm_failed')}: ${errorMsg}`,
        type: 'status',
        sender: 'system',
        duration: 3000,
      });
    } finally {
      // 延迟重置标志，确保窗口创建完成
      setTimeout(() => {
        openQuitConfirmWindowRef.current.opening = false;
      }, 300);
    }
  }, [addMessage, t]);

  // ========== 勿扰模式 ==========

  const enterDoNotDisturb = useCallback(() => {
    setDoNotDisturb(true);
    // 切换为漂浮动画
    setAnimation('floating');
    // 移动到屏幕右下角
    const edge = { x: window.screen.width - 80, y: window.screen.height - 80 };
    setPosition(edge.x, edge.y);

    // 显示状态气泡
    addMessage({
      content: t('status:dnd_enabled'),
      type: 'status',
      sender: 'system',
      duration: 2000,
    });
  }, [setDoNotDisturb, setAnimation, setPosition, addMessage, t]);

  const exitDoNotDisturb = useCallback(() => {
    setDoNotDisturb(false);
    // 恢复默认动画
    setAnimation('idle');
    // 移动到屏幕中央
    const center = getScreenCenter();
    setPosition(center.x - 100, center.y - 100);

    // 显示过往消息摘要
    if (queuedMessages.length > 0) {
      const summary = t('status:queued_messages', { count: queuedMessages.length });
      addMessage({
        content: summary,
        type: 'status',
        sender: 'system',
        duration: 3000,
      });

      // 显示第一条过往消息
    if (queuedMessages[0]) {
        setCurrentBubble({
          id: `queued_${Date.now()}`,
          seqNo: Date.now(),
          content: queuedMessages[0].content,
          type: queuedMessages[0].type as 'chat' | 'status',
          sender: queuedMessages[0].sender,
          timestamp: Date.now(),
          duration: 0,
        });
      }

      // 清空队列
      clearQueue();
    } else {
      addMessage({
        content: t('status:dnd_disabled'),
        type: 'status',
        sender: 'system',
        duration: 2000,
      });
    }
  }, [
    setDoNotDisturb,
    setAnimation,
    setPosition,
    addMessage,
    setCurrentBubble,
    queuedMessages,
    clearQueue,
    t,
  ]);

  const toggleDoNotDisturb = useCallback(() => {
    if (isDoNotDisturb) {
      exitDoNotDisturb();
    } else {
      enterDoNotDisturb();
    }
  }, [isDoNotDisturb, enterDoNotDisturb, exitDoNotDisturb]);

  // ========== 隐藏/显示角色 ==========

  const hideCharacter = useCallback(async () => {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('hide_all_windows');
    } catch (error) {
      console.error('[useTrayEventHandler] Failed to hide all windows:', error);
    }

    setHidden(true);

    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const text = t('tray:showCharacter');
      await invoke('update_tray_item_text', { itemId: 'toggle_hide', text });
    } catch (error) {
      console.error('[useTrayEventHandler] Failed to update tray item text:', error);
    }

    addMessage({
      content: t('status:character_hidden'),
      type: 'status',
      sender: 'system',
      duration: 2000,
    });
  }, [setHidden, addMessage, t]);

  const showCharacter = useCallback(async () => {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('show_main_window');
    } catch (error) {
      console.error('[useTrayEventHandler] Failed to show main window:', error);
      // Don't update state if window show failed
      addMessage({
        content: t('error:show_failed'),
        type: 'status',
        sender: 'system',
        duration: 3000,
      });
      return;
    }

    setHidden(false);

    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const text = t('tray:hideCharacter');
      await invoke('update_tray_item_text', { itemId: 'toggle_hide', text });
    } catch (error) {
      console.error('[useTrayEventHandler] Failed to update tray item text:', error);
    }

    addMessage({
      content: t('status:character_shown'),
      type: 'status',
      sender: 'system',
      duration: 2000,
    });
  }, [setHidden, addMessage, t]);

  const toggleHidden = useCallback(() => {
    const currentIsHidden = useSettingsStore.getState().isHidden;
    if (currentIsHidden) {
      showCharacter();
    } else {
      hideCharacter();
    }
  }, [hideCharacter, showCharacter]);

  // ========== 位置管理 ==========

  const centerCharacter = useCallback(async () => {
    // Send center-character event, CharacterWindow will handle actual window movement
    try {
      const { emit } = await import('@tauri-apps/api/event');
      await emit('center-character');
    } catch (error) {
      console.error('[useTrayEventHandler] Failed to emit center-character event:', error);
    }

    addMessage({
      content: t('status:character_centered'),
      type: 'status',
      sender: 'system',
      duration: 1500,
    });
  }, [addMessage, t]);

  // ========== 语言切换 ==========

  const changeLanguage = useCallback(async (lang: string) => {
    // 使用导入的 changeLocale 函数，它会同时更新 i18n 和后端
    await changeLocale(lang);

    // 更新 settings store
    setLanguage(lang as 'zh' | 'en' | 'ja');

    addMessage({
      content: t('status:language_changed'),
      type: 'status',
      sender: 'system',
      duration: 2000,
    });
  }, [changeLocale, setLanguage, addMessage, t]);

  // ========== 角色切换 ==========

  const switchCharacter = useCallback(async (characterId: string, appearanceId: string) => {
    try {
      await invoke('set_current_appearance', { characterId, appearanceId });
      addMessage({
        content: t('status:character_switched'),
        type: 'status',
        sender: 'system',
        duration: 2000,
      });
    } catch (error) {
      console.error('Failed to switch character:', error);
      const errorMsg = error instanceof Error ? error.message : t('error:unknown');
      addMessage({
        content: `${t('error:switch_failed')}: ${errorMsg}`,
        type: 'status',
        sender: 'system',
        duration: 3000,
      });
    }
  }, [addMessage, t]);

  // ========== 事件监听器 ==========
  // 防御：使用 ref 来追踪监听器注册状态
  const unlistenRef = useRef<(() => void) | null>(null);
  const isListenerRegisteredRef = useRef<boolean>(false);

  useEffect(() => {
    if (isListenerRegisteredRef.current) {
      return;
    }

    const setupListener = async () => {
      try {
        // CRITICAL: Only the main window should handle global tray and settings events
        // Display slot windows (char-window-*) should not register these listeners
        // to prevent duplicate window creation when settings are opened.
        const currentWindow = getCurrentWindow();
        const windowLabel = currentWindow.label;

        if (windowLabel !== 'main') {
          return;
        }

  const { listen } = await import('@tauri-apps/api/event');

        // 监听来自托盘的事件
        const unlisten1 = await listen<TrayEventPayload>('tray-event', (event) => {
          const { action, lang, characterId, appearanceId } = event.payload;

          switch (action) {
            case 'open-dialog':
              openDialogWindow();
              break;

            case 'settings':
              openSettingsWindow();
              break;

            case 'display-management':
              openSettingsWindow('display');
              break;

            // REMOVED: Debug panel feature
            /*
            case 'debug-panel':
              openDebugWindow();
              break;
            */

            case 'open-quit-confirm':
              openQuitConfirmWindow();
              break;

            case 'toggle-dnd':
              toggleDoNotDisturb();
              break;

            case 'toggle-hide':
              const currentIsHidden = useSettingsStore.getState().isHidden;
              if (currentIsHidden) {
                showCharacter();
              } else {
                hideCharacter();
              }
              break;

            case 'center-character':
              centerCharacter();
              break;

            case 'switch-character':
              if (characterId && appearanceId) {
                switchCharacter(characterId, appearanceId);
              }
              break;

            case 'change-language':
              if (lang) {
                changeLanguage(lang);
              }
              break;

            default:
              break;
          }
        });

        const unlisten2 = await listen('open-settings', (event) => {
          try {
            const payload = event.payload as { tab?: string } | undefined;
            openSettingsWindow(payload?.tab);
          } catch (e) {
            console.error('[useTrayEventHandler] Error in openSettingsWindow:', e);
          }
        });

        const unlisten3 = await listen('toggle-dnd', () => {
          toggleDoNotDisturb();
        });

        const unlistenAll = () => {
          unlisten1();
          unlisten2();
          unlisten3();
        };

        unlistenRef.current = unlistenAll;
        isListenerRegisteredRef.current = true;
      } catch (error) {
        console.error('[useTrayEventHandler] Failed to setup tray event listener:', error);
      }
    };

    setupListener();

    return () => {
      if (unlistenRef.current) {
        unlistenRef.current();
        unlistenRef.current = null;
      }
      isListenerRegisteredRef.current = false;
    };
  }, []);

  return {
    // 状态
    isDoNotDisturb,
    isHidden,

    // 方法
    toggleDoNotDisturb,
    enterDoNotDisturb,
    exitDoNotDisturb,
    toggleHidden,
    hideCharacter,
    showCharacter,
    centerCharacter,
    switchCharacter,
    changeLanguage,
  };
}

import { useCallback, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { CharacterWindow } from '@/components/CharacterWindow';
import { FloatingBubble } from '@/components/Bubble';
import { OnboardingApp } from '@/components/OnboardingApp';
import { DialogApp } from '@/components/DialogApp';
import { SettingsApp } from '@/components/SettingsApp';
// REMOVED: Debug panel feature
// import { DebugPanelApp } from '@/components/DebugPanelApp';
import { QuitConfirmApp } from '@/components/QuitConfirmApp';
import { useMessageStore } from '@/stores/messageStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useBrainStore } from '@/stores/brainStore';
import { useEventQueueStore } from '@/stores/eventQueueStore';
import { useSessionQueueStore } from '@/stores/sessionQueueStore';
import { useStatusBubbleStore } from '@/stores/statusBubbleStore';
import { useLocaleStore } from '@/stores/localeStore';
import { useCharacterManagementStore } from '@/stores/characterManagementStore';
import { useTrayEventHandler } from '@/hooks/useTrayEventHandler';
import { useGlobalHotkeys } from '@/hooks/useGlobalHotkeys';
import { useCAPMessage } from '@/hooks/useCAPMessage';
import { useTheme } from '@/hooks/useTheme';
import type { AnyTypedCAPMessage, EventPayload } from '@/types/cap';
import './App.css';

function App() {
  // ========== 获取当前窗口标签（同步）==========
  const windowLabel = getCurrentWindow().label;

  // ========== 根据窗口标签渲染不同内容 ==========
  // 对话框窗口
  if (windowLabel === 'dialog') {
    return <DialogApp />;
  }

  // 设置窗口
  if (windowLabel === 'settings') {
    return <SettingsApp />;
  }

  // 引导窗口
  if (windowLabel === 'onboarding') {
    return <OnboardingApp />;
  }

  // REMOVED: Debug panel feature
  /*
  // 调试面板窗口
  if (windowLabel === 'debug-panel') {
    return <DebugPanelApp />;
  }
  */

  // 退出确认窗口
  if (windowLabel === 'quit-confirm') {
    return <QuitConfirmApp />;
  }

  // 主窗口 (main)
  // 继续执行下面的代码

  // Initialize theme system
  useTheme();

  // ========== Store状态 ==========
  const { addMessage } = useMessageStore();
  const { isHidden, isDoNotDisturb, queueMessage, boundApp, setDialogExplicitlyClosed } = useSettingsStore();
  const { getConfig, connect, connected, getSessionHistory } = useBrainStore();
  const { initializeLocale } = useLocaleStore();

  // Character management store
  const { loadAssistants, selectAssistant, selectedAssistantId, assistants } = useCharacterManagementStore();

  // ========== Initialize locale from backend ==========
  useEffect(() => {
    // Sync localeStore with i18n (loaded from backend)
    initializeLocale();
  }, [initializeLocale]);

  // 新的队列stores
  const addEvent = useEventQueueStore((s) => s.addEvent);
  const addStatusBubble = useStatusBubbleStore((s) => s.addBubble);
  const clearStatusBubbles = useStatusBubbleStore((s) => s.clear);
  const clearStatusBubblesByReceiverId = useStatusBubbleStore((s) => s.clearByReceiverId);

  // ========== Onboarding 状态 ==========
  // 首次启动时打开引导窗口，而不是在主窗口内显示引导
  useEffect(() => {
    const openOnboardingWindowIfNeeded = async () => {
      // 如果没有绑定助手，打开引导窗口
      if (!boundApp) {
        try {
          await invoke('open_onboarding_window');
        } catch (error) {
          console.error('[App] Failed to open onboarding window:', error);
        }
      }
    };

    openOnboardingWindowIfNeeded();
  }, [boundApp]);

  // ========== Auto-select first assistant on startup ==========
  // 确保角色窗口能正确加载角色
  useEffect(() => {
    const initializeAssistantSelection = async () => {
      // Load assistants if not already loaded
      if (assistants.length === 0) {
        await loadAssistants();
      }

      // Auto-select first assistant if none selected
      if (!selectedAssistantId && assistants.length > 0) {
        const firstAssistant = assistants[0];
        console.log('[App] Auto-selecting first assistant:', firstAssistant.id);
        selectAssistant(firstAssistant.id);
      }
    };

    initializeAssistantSelection();
  }, [assistants, selectedAssistantId, loadAssistants, selectAssistant]);

  // ========== Global hotkeys ==========
  useGlobalHotkeys({
    onEscapePress: useCallback(() => {
      // ESC key now only closes active windows, no action needed
    }, []),
  });

  // ========== 托盘事件处理 ==========
  useTrayEventHandler({});

  // ========== CAP消息处理 ==========
  useCAPMessage({
    // 处理behavior_mental消息 - 角色动画和心理状态
    onBehaviorMental: useCallback((message: AnyTypedCAPMessage & { type: 'behavior_mental' }) => {
      const payload = message.payload;
      const receiverId = message.receiver.id;

      // 将behavior添加到事件队列（消费队列，会被CharacterWindow消费）
      addEvent({
        type: 'behavior',
        receiverId,
        behavior: {
          domain: payload.behavior.domain || 'internal',
          category: payload.behavior.category || 'base',
          action_id: payload.behavior.action_id,
          urgency: payload.behavior.urgency,
          intensity: payload.behavior.intensity,
          duration_ms: payload.behavior.duration_ms,
        },
      });

      // 如果需要显示状态气泡（mental 信息）→ 添加到状态气泡队列
      if (payload.mental.show_bubble && payload.mental.thought_text) {
        addStatusBubble({
          emoji: payload.mental.emotion_icon,
          content: payload.mental.thought_text,
          receiverId,
        });
      }
    }, [addEvent, addStatusBubble]),

    // 处理session消息 - 聊天消息
    onSession: useCallback((message: AnyTypedCAPMessage & { type: 'session' }) => {
      const payload = message.payload;
      const { message: msgContent, display_mode, session_id, app_params } = payload;
      const receiverId = message.receiver.id;

      // 检测agent_end
      const isAgentEnd = app_params?.hookType === 'agent_end';

      // 后台触发会话历史更新
      if (session_id && connected) {
        getSessionHistory(session_id, 50, 0).catch(err => {
          console.warn('[App] Failed to update session history:', err);
          // 向用户显示错误通知
          addMessage({
            content: '获取会话历史失败，请检查连接',
            type: 'status',
            sender: 'system',
            duration: 3000,
          });
        });
      }

      // 添加到session队列
      try {
        useSessionQueueStore.getState().addSession({
          sessionId: session_id,
          content: msgContent.content,
          sender: msgContent.role,
          displayMode: display_mode,
          receiverId,
          isAgentEnd,
        });
      } catch (error) {
        console.error('[App] addSession error:', error);
      }

      // 清空状态气泡队列
      clearStatusBubbles();

      // 插入speak动画（最高优先级high，10秒）
      // speak完成后会自动播放idle，由animationQueue处理
      addEvent({
        type: 'behavior',
        receiverId,
        behavior: {
          domain: 'internal',
          category: 'work',
          action_id: 'speak',
          urgency: 9,
          intensity: 1.0,
          duration_ms: 10000,
        },
      });

      // agent_end特殊处理：清空状态
      if (isAgentEnd) {
        clearStatusBubblesByReceiverId(receiverId);
      }
    }, [clearStatusBubbles, clearStatusBubblesByReceiverId, addEvent, connected, getSessionHistory]),

    // 处理notification消息 - 托盘通知
    onNotification: useCallback((message: AnyTypedCAPMessage & { type: 'notification' }) => {
      const payload = message.payload;
      // 勿扰模式下存入队列
      if (isDoNotDisturb) {
        queueMessage({
          id: `notif_${Date.now()}`,
          content: `${payload.content.title}: ${payload.content.summary}`,
          type: 'notification',
          sender: 'system',
          timestamp: Date.now(),
        });
        return;
      }

      addMessage({
        content: `${payload.content.title}: ${payload.content.summary}`,
        type: 'status',
        sender: 'system',
        duration: payload.urgency === 'high' ? 5000 : 3000,
      });
    }, [addMessage, isDoNotDisturb, queueMessage]),

    // 错误处理
    onError: useCallback((error: Error, rawMessage: unknown) => {
      console.error('CAP message parsing error:', error, rawMessage);
      addMessage({
        content: `消息解析错误: ${error.message}`,
        type: 'status',
        sender: 'system',
        duration: 2000,
      });
    }, [addMessage]),

    // 处理event消息 - 监控agent_end事件
    onEvent: useCallback((message: AnyTypedCAPMessage & { type: 'event' }) => {
      const payload = message.payload as EventPayload & { app_params?: { hooktype?: string } };

      // 检查 app_params 中的 hooktype
      if (payload.app_params?.hooktype === 'agent_end') {
        const receiverId = message.receiver.id;

        // agent_end 主要作为保底，清除状态气泡
        // speak 和 idle 动画已在 session 消息中添加
        addMessage({
          content: '__CLEAR__',
          type: 'status',
          sender: 'system',
          duration: 0,
          receiverId,
        });
      }
    }, [addMessage]),
  });

  // ========== 监听设置面板的快速集成事件 ==========
  useEffect(() => {
    const unlistenPromise = (async () => {
      const { listen } = await import('@tauri-apps/api/event');
      return await listen('start-onboarding', async () => {
        // 打开引导窗口
        try {
          await invoke('open_onboarding_window');
        } catch (error) {
          console.error('[App] Failed to open onboarding window:', error);
        }
      });
    })();

    return () => {
      unlistenPromise.then(unlisten => unlisten()).catch(console.error);
    };
  }, []);

  // ========== 调试面板事件监听 ==========
  useEffect(() => {
    const unlistenPromise = (async () => {
      const { listen } = await import('@tauri-apps/api/event');
      return await listen('debug-add-message', (event) => {
        const message = event.payload as {
          content: string;
          type: 'status' | 'chat';
          sender: string;
          duration: number;
          chatType?: 'single' | 'group';
          isStreaming?: boolean;
        };
        addMessage({...message, sender: message.sender as 'user' | 'assistant' | 'system'});
      });
    })();

    return () => {
      unlistenPromise.then(unlisten => unlisten()).catch(console.error);
    };
  }, [addMessage]);

  // ========== 自动连接到 OpenClaw ==========
  useEffect(() => {
    // 如果已经连接或未绑定助手，跳过
    if (connected || !boundApp) {
      return;
    }

    const autoConnect = async () => {
      try {
        // 先加载保存的配置
        await getConfig();
        // 然后尝试连接
        await connect();
      } catch (error) {
        // 静默失败，不显示错误提示
        // 用户可以稍后手动连接
      }
    };

    autoConnect();
  }, [boundApp, connected, getConfig, connect]);

  // ========== 角色点击事件 ==========
  const handleCharacterClick = useCallback(async () => {
    // 如果在勿扰模式，点击悬浮球退出勿扰
    if (isDoNotDisturb) {
      useSettingsStore.getState().setDoNotDisturb(false);
      return;
    }
    // 打开独立对话框窗口，并重置"主动关闭"标志
    setDialogExplicitlyClosed(false);
    try {
      await invoke('open_dialog_window');
    } catch (error) {
      console.error('Failed to open dialog window:', error);
    }
  }, [isDoNotDisturb, setDialogExplicitlyClosed]);

  // ========== 隐藏状态处理 ==========
  if (isHidden) {
    return null; // 完全隐藏应用
  }

  return (
    <div className={`app ${isDoNotDisturb ? 'dnd-mode' : ''}`}>
      {/* 角色窗口 */}
      <div onClick={handleCharacterClick}>
        <CharacterWindow onOpenDialog={handleCharacterClick} />
      </div>

      {/* 浮动气泡（勿扰模式下不显示） */}
      {!isDoNotDisturb && <FloatingBubble />}
    </div>
  );
}

export default App;




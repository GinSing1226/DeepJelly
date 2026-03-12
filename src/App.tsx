import { useCallback, useEffect, useRef } from 'react';

// 🔒 模块级别的全局标志，防止在应用运行期间重复打开引导窗口
// 这个标志在模块级别保持，不受组件挂载/卸载影响
let globalOnboardingChecked = false;
let isChecking = false; // 防止同时进行多次检查
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { CharacterWindow } from '@/components/CharacterWindow';
import { FloatingBubble } from '@/components/Bubble';
import { OnboardingApp } from '@/components/OnboardingApp';
import ChatWindow from '@/components/ChatWindow';
import { SettingsApp } from '@/components/SettingsApp';
// REMOVED: Debug panel feature
// import { DebugPanelApp } from '@/components/DebugPanelApp';
import { QuitConfirmApp } from '@/components/QuitConfirmApp';
import { useMessageStore } from '@/stores/messageStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useBrainStore } from '@/stores/brainStore';
// REMOVED: Old stores - now handled by MessageGateway
// import { useSessionQueueStore } from '@/stores/sessionQueueStore';
// import { useStatusBubbleStore } from '@/stores/statusBubbleStore';
import { useLocaleStore } from '@/stores/localeStore';
import { useCharacterManagementStore } from '@/stores/characterManagementStore';
import { useTrayEventHandler } from '@/hooks/useTrayEventHandler';
import { useGlobalHotkeys } from '@/hooks/useGlobalHotkeys';
// NEW: Message Gateway for routing
import { initMessageGateway, FileBindingStore } from '@/logic';
import { useTheme } from '@/hooks/useTheme';
import './App.css';

function App() {
  // ========== 获取当前窗口标签（同步）==========
  const windowLabel = getCurrentWindow().label;

  // ========== 根据窗口标签渲染不同内容 ==========
  // 对话框窗口 - 使用新的 ChatWindow 组件
  if (windowLabel === 'dialog') {
    return <ChatWindow />;
  }

  // 保留旧的 DialogApp 作为备用（可以删除）
  // if (windowLabel === 'dialog') {
  //   return <DialogApp />;
  // }

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
  const { isHidden, isDoNotDisturb, boundApp, setDialogExplicitlyClosed } = useSettingsStore();
  const { getConfig, connect, connected } = useBrainStore();
  const { initializeLocale } = useLocaleStore();

  // Character management store
  const { loadAssistants, selectAssistant, selectedAssistantId, assistants } = useCharacterManagementStore();

  // ========== Initialize locale from backend ==========
  useEffect(() => {
    // Sync localeStore with i18n (loaded from backend)
    initializeLocale();
    // Fire-and-forget: load settings in background from i18n (already initialized)
    // Defaults are used immediately, this syncs the store state
    useSettingsStore.getState().loadSettings();
  }, [initializeLocale]);

  // ========== Onboarding 状态 ==========
  // 首次启动时打开引导窗口，而不是在主窗口内显示引导
  // 🔒 使用模块级别的全局标志防止重复打开（跨组件生命周期）
  useEffect(() => {
    const openOnboardingWindowIfNeeded = async () => {
      if (globalOnboardingChecked) {
        return;
      }
      if (isChecking) {
        return;
      }
      globalOnboardingChecked = true;
      isChecking = true;

      try {
        if (assistants.length === 0) {
          await loadAssistants();
        }

        const latestAssistants = useCharacterManagementStore.getState().assistants;

        const hasIntegratedAssistant = latestAssistants.some(
          (assistant) => assistant.integrations && assistant.integrations.length > 0
        );

        if (!boundApp && !hasIntegratedAssistant) {
          try {
            await invoke('open_onboarding_window');
          } catch (error) {
            console.error('[App] Failed to open onboarding window:', error);
          }
        }
      } finally {
        isChecking = false;
      }
    };

    openOnboardingWindowIfNeeded();
  }, []);

  // ========== Auto-select first assistant on startup ==========
  // 确保角色窗口能正确加载角色
  useEffect(() => {
    const initializeAssistantSelection = async () => {
      if (assistants.length === 0) {
        await loadAssistants();
      }

      if (!selectedAssistantId && assistants.length > 0) {
        const firstAssistant = assistants[0];
        selectAssistant(firstAssistant.id);
      }
    };

    initializeAssistantSelection();
  }, [assistants, selectedAssistantId, loadAssistants, selectAssistant]);

  // ========== 监听引导页完成事件 ==========
  // 当引导页完成后，重新加载助手数据
  useEffect(() => {
    const unlistenPromise = (async () => {
      const { listen } = await import('@tauri-apps/api/event');
      return await listen('onboarding:complete', async () => {
        await loadAssistants();
      });
    })();

    return () => {
      unlistenPromise.then(unlisten => unlisten()).catch(console.error);
    };
  }, [loadAssistants]);

  // ========== Global hotkeys ==========
  useGlobalHotkeys({
    onEscapePress: useCallback(() => {
      // ESC key now only closes active windows, no action needed
    }, []),
  });

  // ========== 托盘事件处理 ==========
  useTrayEventHandler({});

  // ========== NEW: Message Gateway 初始化 ==========
  // 使用 MessageGateway 统一管理 CAP 消息路由
  useEffect(() => {
    const initGateway = async () => {
      try {
        // 创建基于文件的绑定存储
        const bindingStore = new FileBindingStore('data/user/character_integrations.json');

        await initMessageGateway(bindingStore, {
          onBeforeRoute: (_message) => {
            // Message received
          },
          onAfterRoute: (_message, _decision) => {
            // Message routed
          },
          onError: (error, _rawMessage) => {
            console.error('[App] Gateway error:', error);
            addMessage({
              content: `消息路由错误: ${error.message}`,
              type: 'status',
              sender: 'system',
              duration: 2000,
            });
          },
        });

        // Debug: Expose stores to window for manual testing
        (window as any).animationQueueStore = (await import('@/stores/characterStores')).animationQueueStore;
        (window as any).statusBubbleStore = (await import('@/stores/characterStores')).statusBubbleStore;
        (window as any).sessionQueueStore = (await import('@/stores/characterStores')).sessionQueueStore;
      } catch (error) {
        console.error('[App] Failed to initialize Message Gateway:', error);
      }
    };

    initGateway();

    // 清理
    return () => {
      const { stopMessageGateway } = require('@/logic');
      stopMessageGateway();
    };
  }, []);

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
  const autoConnectRef = useRef(false);
  useEffect(() => {
    const autoConnect = async () => {
      // 如果已经连接或已尝试连接，跳过
      if (connected || autoConnectRef.current) {
        return;
      }
      autoConnectRef.current = true;

      // 稍等片刻，让数据加载完成
      await new Promise(resolve => setTimeout(resolve, 100));

      // 检查是否有绑定（内存或持久化数据）
      let hasBinding = !!boundApp;

      if (!hasBinding) {
        const latestAssistants = useCharacterManagementStore.getState().assistants;
        if (latestAssistants.length > 0) {
          hasBinding = latestAssistants.some(
            (assistant) => assistant.integrations && assistant.integrations.length > 0
          );
        }
      }

      // 如果没有绑定，跳过自动连接
      if (!hasBinding) {
        return;
      }

      try {
        // 先加载保存的配置
        await getConfig();
        // 然后尝试连接
        await connect();
      } catch (error) {
        // 静默失败，不显示错误提示
        // 用户可以稍后手动连接
        console.warn('[App] Auto-connect failed:', error);
      }
    };

    autoConnect();
  }, []); // 空依赖数组，只在组件挂载时执行一次

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




import { useRef, useEffect, useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import * as PIXI from 'pixi.js';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { emit } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
import { useCharacterStore } from '@/stores/characterStore';
import { useCharacterManagementStore } from '@/stores/characterManagementStore';
import { useLocaleStore } from '@/stores/localeStore';
import { useMessageStore } from '@/stores/messageStore';
// REMOVED: Old stores - now using character-isolated stores
// import { useStatusBubbleStore } from '@/stores/statusBubbleStore';
// import { useSessionQueueStore } from '@/stores/sessionQueueStore';
// NEW: Character-isolated stores for routed messages
import {
  animationQueueStore,
  statusBubbleStore,
  sessionQueueStore,
} from '@/stores/characterStores';
import { useSettingsStore } from '@/stores/settingsStore';
import { useBrainStore } from '@/stores/brainStore';
// REMOVED: useCAPMessage - now handled by MessageGateway
// import { useCAPMessage } from '@/hooks/useCAPMessage';
import { useBehaviorAnimation } from '@/hooks/useAnimationQueue';
import { usePenetrationMode } from '@/hooks/usePenetrationMode';
import { useCharacterResource } from './hooks/useCharacterResource';
import { SpriteManager } from '@/utils/spriteManager';
import { TouchDetector } from '@/utils/touchDetection';
import { getSessionKey } from '@/utils/assistantHelper';
import { getTouchZones } from '@/config/touchZones';
import { CHARACTER_DEFAULT_SIZE } from '@/config/constants';
import { ContextMenu, ContextMenuItem } from '@/components/ContextMenu';
import { StatusBubble, useStatusBubble } from '@/components/StatusBubble';
import { ChatBubble } from '@/components/ChatBubble';
import { SimpleInput } from './SimpleInput';

import '@/styles/design-system.css';
import './styles.css';
import './SimpleInput.css';

/**
 * Emoji 名称到 Unicode emoji 的映射表
 * 用于将后端发送的 emoji 名称转换为真正的 emoji 字符
 */
const EMOJI_NAME_MAP: Record<string, string> = {
  // 常用 emoji
  'bulb': '💡',
  'pencil': '✏️',
  'envelope': '✉️',
  'thinking': '🤔',
  'happy': '😊',
  'smile': '😄',
  'heart': '❤️',
  'star': '⭐',
  'fire': '🔥',
  'check': '✅',
  'cross': '❌',
  'question': '❓',
  'exclamation': '❗',
  'arrow_up': '⬆️',
  'arrow_down': '⬇️',
  'arrow_left': '⬅️',
  'arrow_right': '➡️',
  'ok': '👌',
  'thumbs_up': '👍',
  'thumbs_down': '👎',
  'wave': '👋',
  'point_up': '☝️',
  'rocket': '🚀',
  'sparkles': '✨',
  'zap': '⚡',
  'gear': '⚙️',
  'speech': '💬',
  'listen': '👂',
  'sleep': '💤',
  'error': '❌',
  'warning': '⚠️',
  'info': 'ℹ️',
  'keyboard': '⌨️',
};

/**
 * 将 emoji 名称转换为 Unicode emoji
 * @param name - emoji 名称（如 "bulb", "pencil"）
 * @returns Unicode emoji 字符，如果没有映射则返回原名称
 */
function mapEmojiName(name: string | undefined): string {
  if (!name) return '';
  // 如果已经是 emoji（包含代理对或常见 emoji 范围），直接返回
  if (/[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/u.test(name)) {
    return name;
  }
  // 查找映射
  return EMOJI_NAME_MAP[name] || name;
}

interface CharacterWindowProps {
  width?: number;
  height?: number;
  onOpenDialog?: () => void;
}

export function CharacterWindow({
  width = CHARACTER_DEFAULT_SIZE,
  height = CHARACTER_DEFAULT_SIZE,
  onOpenDialog,
}: CharacterWindowProps) {
  const { t } = useTranslation(['tray', 'common']);
  const containerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<PIXI.Application | null>(null);
  const spriteManagerRef = useRef<SpriteManager | null>(null);
  const touchDetectorRef = useRef<TouchDetector | null>(null);
  const hideGenerationRef = useRef(0);  // Version counter to prevent stale hide operations
  const removeSessionTimeoutRef = useRef<NodeJS.Timeout | null>(null);  // Cleanup ref for session removal timer
  const [bubbleText, setBubbleText] = useState<string | null>(null);
  const [hoveredZone, setHoveredZone] = useState<string | null>(null);
  const [contextMenuOpen, setContextMenuOpen] = useState(false);
  const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 });
  const [isInputVisible, setIsInputVisible] = useState(false);
  const [inputHasContent, setInputHasContent] = useState(false);
  const [isWaitingForResponse, setIsWaitingForResponse] = useState(false);

  // Window identity for parameter matching
  // 存储当前窗口的 assistantId 和 characterId，用于匹配 character:load 事件
  const [windowIdentity, setWindowIdentity] = useState<{
    assistantId: string | null;
    characterId: string | null;
  }>({ assistantId: null, characterId: null });

  // Status bubble management
  const { status, setCustomStatus, clearStatus: clearLocalStatus } = useStatusBubble();

  // ========== Character Data for CAP Filtering ==========
  // Get selected assistant for session key
  // 与 DialogApp 保持一致：优先使用选中的，如果没有则使用第一个可用的
  // 使用选择器分别订阅，确保能正确响应变化
  const selectedAssistantId = useCharacterManagementStore((s) => s.selectedAssistantId);
  const assistants = useCharacterManagementStore((s) => s.assistants);

  const selectedAssistant = selectedAssistantId
    ? assistants.find(a => a.id === selectedAssistantId) || null
    : (assistants.length > 0 ? assistants[0] : null);

  // Extract sessionKeys from the current assistant's integrations
  // These are used to filter CAP messages - only respond if sender.routing.sessionKey matches
  const currentSessionKeys = selectedAssistant?.integrations
    ?.flatMap(i => {
      console.log('[CharacterWindow] Processing integration:', {
        provider: i.provider,
        paramsKeys: Object.keys(i.params || {}),
        params: i.params,
      });
      const params = i.params as { sessionKeys?: string[] } | undefined;
      const sessionKeys = params?.sessionKeys || [];
      console.log('[CharacterWindow] Extracted sessionKeys:', sessionKeys);
      return sessionKeys;
    })
    .filter(key => key) || [];

  // Get the first character of the current assistant
  const currentCharacters = useCharacterManagementStore(state => {
    const selectedId = state.selectedAssistantId;
    if (!selectedId) return [];
    return state.characters[selectedId] || [];
  });
  const firstCharacter = currentCharacters[0];

  // Check if user has integrated character data (from platform binding)
  // CAP messages should only be processed when hasIntegratedCharacter is true
  const hasIntegratedCharacter = firstCharacter !== undefined;

  // ========== Character Resource Loading ==========
  // Always load a character (local default or integrated)
  // This ensures the character window is always visible
  const defaultCharacterId = firstCharacter?.id || 'default';
  const defaultAppearanceId = firstCharacter?.defaultAppearanceId || 'default';

  const {
    config,
    appearance,
    loadState,
    loadCharacter,
  } = useCharacterResource({
    defaultCharacterId,
    defaultAppearanceId,
    preloadAnimations: false,
  });

  // Get current character ID for message filtering
  // CAP protocol uses receiver.id = characterId
  const currentCharacterId = config?.id; // config.id should be characterId according to CAP protocol
  const currentAssistantId = config?.assistant_id; // This is for resource path

  // Debug logging for CAP filtering (after all variables are defined)
  console.log('[CharacterWindow] CAP Filter state:', {
    selectedAssistantId,
    selectedAssistantName: selectedAssistant?.name,
    currentSessionKeys,
    currentCharacterId,
    hasIntegratedCharacter,
  });

  // ========== NEW: Subscribe to routed stores ==========
  // MessageGateway 已将消息路由到按 characterId 隔离的 stores
  // CharacterWindow 只需订阅属于自己的那部分数据

  // Get characterId for subscribing to routed stores
  const characterIdForRouting = currentCharacterId || 'default';

  // Penetration mode hook
  const {
    isPenetrationMode,
    setPenetrationMode,
    handleMouseEnter: handlePenetrationMouseEnter,
    handleMouseLeave: handlePenetrationMouseLeave,
  } = usePenetrationMode();

  // 处理状态气泡关闭 - 同时清除本地状态和store状态
  const handleStatusDismiss = useCallback(() => {
    clearLocalStatus();
    if (characterIdForRouting) {
      statusBubbleStore.getState().clearStatus(characterIdForRouting);
    }
  }, [clearLocalStatus, characterIdForRouting]);

  // Sync penetration mode state to characterStore
  useEffect(() => {
    useCharacterStore.getState().setPenetrationMode(isPenetrationMode);
  }, [isPenetrationMode]);

  // Listen for window-shown event from Rust to reset isHidden state
  useEffect(() => {
    const unlistenPromise = (async () => {
      const { listen } = await import('@tauri-apps/api/event');
      return await listen('window-shown', () => {
        // Increment generation to invalidate any pending hide operations
        hideGenerationRef.current += 1;
        useSettingsStore.getState().setHidden(false);
      });
    })();

    return () => {
      // 清除 session removal 定时器，防止内存泄漏
      if (removeSessionTimeoutRef.current) {
        clearTimeout(removeSessionTimeoutRef.current);
        removeSessionTimeoutRef.current = null;
      }
      unlistenPromise.then(unlisten => unlisten()).catch(console.error);
    };
  }, []);

  // Listen for character:load event from display slot refresh
  // 全局监听 character:load 事件，通过参数匹配决定是否处理
  useEffect(() => {
    const windowLabel = getCurrentWindow().label;
    console.log('[CharacterWindow] ========== character:load listener SETUP ==========');
    console.log('[CharacterWindow] Window label:', windowLabel);
    console.log('[CharacterWindow] Current config:', config ? { id: config.id, assistant_id: config.assistant_id, name: config.name } : 'null');

    // Only display slot windows should listen for character:load events
    // Main window should not respond to this event
    if (!windowLabel.startsWith('char-window-')) {
      console.log('[CharacterWindow] Skipping character:load listener - not a display slot window');
      return;
    }

    console.log('[CharacterWindow] Setting up character:load listener...');

    const unlistenPromise = (async () => {
      const { listen } = await import('@tauri-apps/api/event');

      console.log('[CharacterWindow] Registering character:load listener for window:', windowLabel);

      // 全局监听 character:load 事件，通过参数匹配决定是否处理
      return await listen('character:load', async (event) => {
        const payload = event.payload as {
          slotId?: string;
          assistantId?: string;
          characterId?: string;
          appearanceId?: string;
        } | undefined;

        console.log('[CharacterWindow] ========== RECEIVED character:load ==========');
        console.log('[CharacterWindow] My window:', windowLabel);
        console.log('[CharacterWindow] My identity:', windowIdentity);
        console.log('[CharacterWindow] Event payload:', payload);

        // 参数匹配：只有当 payload 中的 assistantId 和 characterId 与当前窗口匹配时才处理
        if (!payload?.assistantId || !payload?.characterId) {
          console.warn('[CharacterWindow] Ignoring event - missing assistantId or characterId in payload');
          return;
        }

        // 如果 windowIdentity 还未设置（assistantId 为 null），说明这是初始化事件
        // 直接接受事件并更新 windowIdentity
        const isInitialLoad = !windowIdentity.assistantId;
        if (isInitialLoad) {
          console.log('[CharacterWindow] Initial load - setting window identity from event:', {
            assistantId: payload.assistantId,
            characterId: payload.characterId
          });
          setWindowIdentity({
            assistantId: payload.assistantId,
            characterId: payload.characterId
          });
        } else {
          // 检查是否匹配当前窗口
          const isMatch = payload.assistantId === windowIdentity.assistantId &&
                          payload.characterId === windowIdentity.characterId;

          if (!isMatch) {
            console.log('[CharacterWindow] Ignoring event - payload does not match window identity', {
              payload: { assistantId: payload.assistantId, characterId: payload.characterId },
              windowIdentity
            });
            return;
          }

          console.log('[CharacterWindow] Event matches window identity - processing character load');
        }

        if (payload?.appearanceId) {
          console.log('[CharacterWindow] Loading character from event:', {
            characterId: payload.characterId,
            appearanceId: payload.appearanceId,
            assistantId: payload.assistantId,
          });

          // Clear cached resources for this character to ensure fresh load
          const { globalCharacterLoader } = await import('./utils/characterLoader');
          console.log('[CharacterWindow] Clearing cache for characterId:', payload.characterId);
          globalCharacterLoader.clearCharacterCache(payload.characterId);

          // Load the correct character for this display slot
          console.log('[CharacterWindow] Calling loadCharacter with assistantId:', payload.assistantId);
          loadCharacter(payload.characterId, payload.appearanceId, payload.assistantId);
        } else {
          console.error('[CharacterWindow] Invalid character:load payload:', payload);
        }
      });  // <-- 注意：移除了 { target: windowLabel } 选项
    })();

    return () => {
      console.log('[CharacterWindow] ========== Cleaning up character:load listener ==========');
      console.log('[CharacterWindow] Window:', windowLabel);
      unlistenPromise.then(unlisten => unlisten()).catch(console.error);
    };
  }, [loadCharacter, windowIdentity]);

  // Track and save window position for display slot windows
  // This ensures windows are restored to their last position on app restart
  useEffect(() => {
    const windowLabel = getCurrentWindow().label;
    console.log('[CharacterWindow] Window position tracking setup:', windowLabel);

    // Only display slot windows should track position
    if (!windowLabel.startsWith('char-window-')) {
      console.log('[CharacterWindow] Skipping position tracking - not a display slot window');
      return;
    }

    // Extract slot ID from window label (format: char-window-slot_XXXXX)
    const slotId = windowLabel.replace('char-window-', '');
    console.log('[CharacterWindow] Tracking position for slot:', slotId);

    let saveTimeout: NodeJS.Timeout | null = null;

    const unlistenPromise = (async () => {
      const { getCurrentWindow } = await import('@tauri-apps/api/window');
      const { listen } = await import('@tauri-apps/api/event');
      const window = getCurrentWindow();

      // Listen for window move events (Tauri v2 uses tauri://move event pattern)
      return await listen('tauri://move', async () => {
        // Debounce position saves to avoid too frequent writes
        if (saveTimeout) {
          clearTimeout(saveTimeout);
        }

        saveTimeout = setTimeout(async () => {
          try {
            const position = await window.outerPosition();
            const x = position.x;
            const y = position.y;
            console.log('[CharacterWindow] Saving window position:', { slotId, x, y });

            await invoke('update_slot_position', {
              slotId,
              x,
              y,
            });
          } catch (error) {
            console.error('[CharacterWindow] Failed to save window position:', error);
          }
        }, 500); // Save 500ms after the last move event
      });
    })();

    return () => {
      if (saveTimeout) {
        clearTimeout(saveTimeout);
      }
      unlistenPromise.then(unlisten => unlisten()).catch(console.error);
    };
  }, []);

  // Handle window visibility based on isHidden state
  // Note: Window visibility is controlled by Rust backend (hide_all_windows / show_main_window)
  // This component only needs to track isHidden for UI rendering (App.tsx return null check)
  const isHidden = useSettingsStore((s) => s.isHidden);

  const {
    position,
    scale,
    setPosition,
    setAnimation,
    setScaleToPreset,
    sessionId,
  } = useCharacterStore();

  // 使用 brainStore 的连接状态（与 DialogApp 保持一致）
  const isConnected = useBrainStore((s) => s.connected);

  const addMessage = useMessageStore((s) => s.addMessage);
  const removeMessages = useMessageStore((s) => s.removeMessages);
  const { sendMessage } = useBrainStore();

  // Animation queue integration
  const [spriteManagerReady, setSpriteManagerReady] = useState(false);

  const { playBehaviorAnimation, playAnimation, pauseQueue, resumeQueue, isQueuePaused } = useBehaviorAnimation({
    spriteManager: spriteManagerReady ? spriteManagerRef.current : null,
    enabled: spriteManagerReady,
    onAnimationChange: (animationId) => {
      setAnimation(animationId);
    },
  });

  // ========== Subscribe to character-isolated stores ==========
  // These useEffect hooks depend on spriteManagerReady, so they must be defined after it

  console.log('[CharacterWindow] Store subscription setup:', {
    characterIdForRouting,
    spriteManagerReady,
    currentCharacterId,
    configId: config?.id,
    configName: config?.name,
    loadState,
    firstCharacterId: firstCharacter?.id,
  });

  // Listen to animation queue for this character
  // Bridge between animationQueueStore (from MessageGateway) and useBehaviorAnimation hook
  // Use polling instead of subscription to avoid re-entrancy issues
  useEffect(() => {
    console.log('[CharacterWindow] Animation queue polling useEffect:', {
      characterIdForRouting,
      spriteManagerReady,
    });

    if (!characterIdForRouting || !spriteManagerReady) return;

    console.log('[CharacterWindow] Starting animation queue polling for:', characterIdForRouting);

    // Poll the queue every 100ms
    const pollInterval = setInterval(() => {
      const queue = animationQueueStore.getState().getQueue(characterIdForRouting);
      const currentAnim = animationQueueStore.getState().getCurrent(characterIdForRouting);

      // Debug: log polling state
      if (queue.length > 0) {
        console.log('[CharacterWindow] Polling: queue has items, isQueuePaused:', isQueuePaused, 'queueLength:', queue.length);
      }

      if (queue.length > 0 && !isQueuePaused()) {
        const nextAnim = animationQueueStore.getState().dequeue(characterIdForRouting);
        if (nextAnim) {
          console.log('[CharacterWindow] Playing animation from queue:', nextAnim);
          try {
            playAnimation(nextAnim);
            console.log('[CharacterWindow] playAnimation call succeeded');
          } catch (err) {
            console.error('[CharacterWindow] playAnimation error:', err);
          }
        }
      }

      // Check for current animation (set directly, not from queue)
      if (currentAnim && queue.length === 0) {
        console.log('[CharacterWindow] Playing current animation:', currentAnim);
        playAnimation(currentAnim);
        // Clear it after playing to avoid re-playing
        animationQueueStore.getState().setCurrent(characterIdForRouting, null);
      }
    }, 100);

    return () => {
      clearInterval(pollInterval);
      console.log('[CharacterWindow] Stopped animation queue polling for:', characterIdForRouting);
    };
  }, [characterIdForRouting, spriteManagerReady, isQueuePaused, playAnimation]);

  // Listen to status bubble for this character
  useEffect(() => {
    console.log('[CharacterWindow] Status bubble useEffect:', {
      characterIdForRouting,
    });

    if (!characterIdForRouting) return;

    console.log('[CharacterWindow] Subscribing to status bubble for:', characterIdForRouting);

    const unsubscribe = statusBubbleStore.subscribe((state) => {
      const status = state.getStatus(characterIdForRouting);

      console.log('[CharacterWindow] Status bubble update:', {
        characterId: characterIdForRouting,
        status,
      });

      if (status) {
        const emoji = mapEmojiName(status.emoji);
        setCustomStatus(emoji, status.text, status.duration);
      } else {
        clearLocalStatus();
      }
    });

    return unsubscribe;
  }, [characterIdForRouting, setCustomStatus, clearLocalStatus]);

  // Listen to session queue for this character
  useEffect(() => {
    console.log('[CharacterWindow] Session queue useEffect:', {
      characterIdForRouting,
    });

    if (!characterIdForRouting) return;

    console.log('[CharacterWindow] Subscribing to session queue for:', characterIdForRouting);

    const unsubscribe = sessionQueueStore.subscribe((state) => {
      const sessions = state.getSessions(characterIdForRouting);
      const latestSession = sessions[sessions.length - 1];

      console.log('[CharacterWindow] Session queue update:', {
        characterId: characterIdForRouting,
        sessionCount: sessions.length,
        latestSession: latestSession ? {
          id: latestSession.id,
          sender: latestSession.sender,
          content: latestSession.content?.substring(0, 50),
        } : null,
      });

      // Note: Speak animation is triggered by MessageGateway when session messages arrive
      // No need to manually enqueue here
    });

    return unsubscribe;
  }, [characterIdForRouting]);

  console.log('[CharacterWindow] IDs:', {
    hasIntegratedCharacter,
    currentCharacterId,
    currentAssistantId,
    configId: config?.id,
    configAssistantId: config?.assistant_id,
    firstCharacterId: firstCharacter?.id,
  });

  // Debug: Log store states
  useEffect(() => {
    const logInterval = setInterval(() => {
      const animState = animationQueueStore.getState();
      const statusState = statusBubbleStore.getState();
      const sessionState = sessionQueueStore.getState();

      const myQueue = animState.getQueue(characterIdForRouting);
      const myStatus = statusState.getStatus(characterIdForRouting);
      const mySessions = sessionState.getSessions(characterIdForRouting);

      console.log('[CharacterWindow] Store states:', {
        characterId: characterIdForRouting,
        animationQueueSize: myQueue.length,
        currentAnimation: animState.getCurrent(characterIdForRouting),
        status: myStatus,
        sessionCount: mySessions.length,
        spriteManagerReady,
      });
    }, 5000); // Log every 5 seconds

    return () => clearInterval(logInterval);
  }, [characterIdForRouting]);

  // 监听 assistants 变化，确保数据已加载
  // 注意：App.tsx 中已有自动选择第一个助手的逻辑，这里不需要重复
  useEffect(() => {
    console.log('[CharacterWindow] 📊 State update:', {
      assistantsCount: assistants.length,
      selectedAssistantId,
      selectedAssistant: selectedAssistant ? {
        id: selectedAssistant.id,
        name: selectedAssistant.name,
        hasIntegrations: !!selectedAssistant.integrations,
        integrationsLength: selectedAssistant.integrations?.length,
        integrations: selectedAssistant.integrations,
        firstIntegration: selectedAssistant.integrations?.[0],
        sessionKeyFromHelper: getSessionKey(selectedAssistant.integrations ?? []),
      } : null,
      isConnected,
    });
  }, [assistants, selectedAssistantId, selectedAssistant, isConnected]);

  // Sync connection status with backend (same as DialogApp)
  // Each window has its own zustand store instance, so we need to check backend connection
  useEffect(() => {
    const checkConnection = async () => {
      try {
        const backendConnected = await invoke<boolean>('is_brain_connected');
        // console.log('[CharacterWindow] 🔍 Backend connection status:', backendConnected);
        if (backendConnected && !isConnected) {
          // console.log('[CharacterWindow] 🔄 Updating local store: connected = true');
          useBrainStore.setState({ connected: true });
        }
      } catch (error) {
        // console.error('[CharacterWindow] ❌ Failed to check connection:', error);
      }
    };

    // Check on mount
    checkConnection();

    // Also check when onboarding completes
    const unlistenPromise = (async () => {
      const { listen } = await import('@tauri-apps/api/event');
      return await listen('onboarding:complete', () => {
        // console.log('[CharacterWindow] 🎉 Onboarding complete, rechecking connection...');
        checkConnection();
      });
    })();

    return () => {
      unlistenPromise.then(unlisten => unlisten()).catch(console.error);
    };
  }, []); // Run once on mount, and listen for onboarding completion

  // 监听资源热更新事件
  useEffect(() => {
    const unlistenPromise = (async () => {
      const { listen } = await import('@tauri-apps/api/event');
      return await listen('resource-changed', (event: any) => {
        const payload = event.payload as { file: string; path: string };
        console.log('[CharacterWindow] 🔄 Resource changed:', payload);

        // 重新加载角色数据 - 使用当前选中的助手ID
        const state = useCharacterManagementStore.getState();
        const currentAssistantId = state.selectedAssistantId;
        if (currentAssistantId) {
          state.loadCharacters(currentAssistantId);
        }
      });
    })();

    return () => {
      unlistenPromise.then(unlisten => unlisten()).catch(console.error);
    };
  }, []);

  // REMOVED: Old statusBubbleStore subscription - now handled by the new subscription above
  // Status bubble is populated by MessageGateway and consumed by character-specific subscription

  // REMOVED: Old eventQueueStore subscription - now handled by MessageGateway
  // Animation queue is populated by MessageGateway and consumed by the new subscription above

  // Listen to new sessionQueueStore for waiting state management
  useEffect(() => {
    if (!characterIdForRouting) return;

    const unsubscribe = sessionQueueStore.subscribe((state) => {
      const sessions = state.getSessions(characterIdForRouting);

      if (!isWaitingForResponse) {
        return;
      }

      // Check if there's an assistant response for this character
      const hasAssistantResponse = sessions.some(s =>
        s.sender === 'assistant'
      );

      if (hasAssistantResponse) {
        setIsWaitingForResponse(false);
      }
    });
    return unsubscribe;
  }, [characterIdForRouting, isWaitingForResponse, setIsWaitingForResponse]);

  // Calculate actual size (with scale applied)
  const actualWidth = width * scale;
  const actualHeight = height * scale;

  // Direct animation play helper (bypasses queue for testing)
  const playAnimationDirect = useCallback((animationId: string) => {
    if (spriteManagerRef.current) {
      spriteManagerRef.current.play(animationId);
    }
  }, []);

  // Track if PIXI was initialized to prevent multiple initializations
  const pixiInitializedRef = useRef(false);

  // Initialize Pixi application (only once)
  useEffect(() => {
    // Skip if already initialized or container not ready
    if (pixiInitializedRef.current || !containerRef.current) {
      return;
    }

    let mounted = true;

    const initApp = async () => {
      const app = new PIXI.Application();
      await app.init({
        width: actualWidth,
        height: actualHeight - 60,
        backgroundAlpha: 0,
        antialias: true,
        resolution: 1, // 禁用高DPI缩放避免边缘问题
        autoDensity: false, // 禁用autoDensity
        clearBeforeRender: true,
      });

      if (!mounted || !containerRef.current) {
        console.warn('[CharacterWindow] Component unmounted during PIXI init');
        app.destroy(true);
        return;
      }

      containerRef.current.appendChild(app.canvas);
      appRef.current = app;

      const appHeight = actualHeight - 60;
      const container = new PIXI.Container();
      app.stage.addChild(container);
      container.x = actualWidth / 2;
      container.y = appHeight / 2 + 80;

      touchDetectorRef.current = new TouchDetector(CHARACTER_DEFAULT_SIZE, CHARACTER_DEFAULT_SIZE);
      touchDetectorRef.current.setZones(getTouchZones());

      const spriteManager = new SpriteManager(app, container);
      spriteManagerRef.current = spriteManager;

      pixiInitializedRef.current = true;
      setSpriteManagerReady(true);
    };

    initApp();

    return () => {
      mounted = false;
      pixiInitializedRef.current = false;
      setSpriteManagerReady(false);
      if (spriteManagerRef.current) {
        spriteManagerRef.current.destroy();
      }
      if (touchDetectorRef.current) {
        touchDetectorRef.current.clearHover();
      }
      if (appRef.current) {
        appRef.current.destroy(true);
        appRef.current = null;
      }
    };
  }, [actualWidth, actualHeight]); // Only depend on dimensions, not config/appearance

  useEffect(() => {
    const loadCharacterWhenReady = async () => {
      if (config && appearance && spriteManagerRef.current && spriteManagerReady && loadState.isLoaded) {
        const { invoke } = await import('@tauri-apps/api/core');
        const assistantId = config.assistant_id || config.id;
        const characterId = config.id;
        const appearanceId = appearance.id;

        console.log('[CharacterWindow] Loading character resources:', {
          assistantId,
          characterId,
          appearanceId,
          configAssistantId: config.assistant_id,
          configId: config.id
        });

        // Helper: Load resources based on action type
        const loadActionResources = async (actionKey: string, action: any): Promise<any | null> => {
          const actionType = action.type || 'frames'; // Default to frames for backward compatibility

          try {
            // For spritesheet type, load the spritesheet config file
            if (actionType === 'spritesheet') {
              // If no spritesheet config but has resources array, treat as frames type
              if (!action.spritesheet) {
                if (action.resources && Array.isArray(action.resources)) {
                  console.log(`[CharacterWindow] Spritesheet action ${actionKey} missing spritesheet config, treating as frames`);
                  // Fall through to frames handling below
                } else {
                  console.warn(`[CharacterWindow] Spritesheet action ${actionKey} missing spritesheet config and no resources`);
                  return null;
                }
              } else {
                const spritesheetConfig = action.spritesheet;
                // 新的目录结构: {character_id}/{appearance_id}/{action_key}/{resource}
                const resourceName = `${appearanceId}/${actionKey}/${spritesheetConfig.url}`;

                // Load spritesheet resource (JSON or PNG)
                const resourceUrl = await invoke<string>('load_character_resource', {
                  assistantId,
                  characterId,
                  resourceName,
                });

                // Return action with resolved resource URL
                return {
                  type: 'spritesheet',
                  spritesheet: {
                    ...spritesheetConfig,
                    url: resourceUrl,
                  },
                  fps: action.fps || 12,
                  loop: action.loop ?? true,
                };
              }
            }

            // For frames type (default), load all frame images
            const rawFrames = action.resources || action.frames;
            if (!rawFrames || !Array.isArray(rawFrames)) return null;

            // 新的目录结构: {character_id}/{appearance_id}/{action_key}/{frame}
            // 构建完整资源路径：appearanceId/actionKey/fileName
            const fullResourceNames = rawFrames.map((frame: string) => `${appearanceId}/${actionKey}/${frame}`);

            // Batch load: one IPC call for all frames
            const resourceMap = await invoke<Record<string, string>>('load_character_resources', {
              assistantId,
              characterId,
              resourceNames: fullResourceNames,
            });

            // Convert map to array in original order
            const framePaths = fullResourceNames
              .map(frame => resourceMap[frame])
              .filter((p): p is string => p !== undefined && p !== null);

            if (framePaths.length === 0) {
              console.warn(`[CharacterWindow] No frames loaded for ${actionKey}`);
              return null;
            }

            const frameRate = action.fps || action.frameRate || 12;
            const loop = action.loop ?? true;
            const loopStartFrame = action.loopStartFrame;

            return {
              type: 'frames',
              resources: framePaths,
              fps: frameRate,
              loop,
              loopStartFrame,
            };
          } catch (error) {
            console.error(`[CharacterWindow] Failed to load action ${actionKey}:`, error);
            return null;
          }
        };

        // Priority 1: Load idle animation first
        const idleAction = appearance.actions['internal-base-idle'];
        if (idleAction) {
          const idleData = await loadActionResources('internal-base-idle', idleAction);
          if (idleData && spriteManagerRef.current) {
            // Use unified loadFromAction interface
            await spriteManagerRef.current.loadFromAction('internal-base-idle', idleData);
            spriteManagerRef.current.play('internal-base-idle');
          }
        }

        // Priority 2: Load other animations in parallel
        const otherActions = Object.entries(appearance.actions)
          .filter(([key]) => key !== 'internal-base-idle');

        // Load all in parallel, don't await
        otherActions.forEach(async ([actionKey, action]) => {
          const actionData = await loadActionResources(actionKey, action);

          if (actionData && spriteManagerRef.current) {
            try {
              // Use unified loadFromAction interface
              await spriteManagerRef.current.loadFromAction(actionKey, actionData);
            } catch (error) {
              console.error(`[CharacterWindow] Failed: ${actionKey}`, error);
            }
          }
        });
      }
    };

    loadCharacterWhenReady();
  }, [config, appearance, spriteManagerReady, loadState]);

  // Drag handling
  const dragStartPosRef = useRef({ x: 0, y: 0 });
  const isDraggingRef = useRef(false);

  const handleMouseDown = useCallback(async (e: React.MouseEvent) => {
    if (isPenetrationMode) return;
    if (e.button !== 0) return;

    const target = e.target as HTMLElement;
    if (target.tagName === 'TEXTAREA' ||
        target.tagName === 'INPUT' ||
        target.closest('.simple-input') ||
        target.closest('button') ||
        target.closest('.context-menu')) {
      return;
    }

    dragStartPosRef.current = { x: e.clientX, y: e.clientY };
    isDraggingRef.current = false;

    pauseQueue();

    const hasDragAnimation = spriteManagerRef.current?.hasAnimation('internal-physics-drag');
    const targetAnimation = hasDragAnimation ? 'internal-physics-drag' : 'internal-base-idle';
    if (spriteManagerRef.current) {
      spriteManagerRef.current.play(targetAnimation);
    }

    try {
      const window = getCurrentWindow();
      await window.startDragging();
    } catch (error) {
      console.error('[CharacterWindow] Failed to start dragging:', error);
    }
    e.preventDefault();
  }, [isPenetrationMode, pauseQueue]);

  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    if (isPenetrationMode) return;

    // 只恢复队列，让队列自动处理后续动画
    // 不再直接播放 idle，避免覆盖队列中恢复的动画
    resumeQueue();
  }, [isPenetrationMode, resumeQueue]);

  // 拖拽结束检测 - 通过 mousemove 检测鼠标按键状态
  useEffect(() => {
    let isDragging = false;

    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging && e.buttons === 0) {
        // 鼠标按键已释放，恢复队列
        resumeQueue();
        isDragging = false;
      }
    };

    const handleMouseDown = (e: MouseEvent) => {
      // 只在左键按下且不是穿透模式时启动检测
      if (e.button === 0 && !isPenetrationMode) {
        isDragging = true;
      }
    };

    const handleMouseUp = () => {
      if (isDragging) {
        // 只恢复队列，让队列自动处理后续动画
        resumeQueue();
      }
      isDragging = false;
    };

    // 在 document 上监听，确保能捕获到所有事件
    document.addEventListener('mousemove', handleMouseMove, true);
    document.addEventListener('mousedown', handleMouseDown, true);
    document.addEventListener('mouseup', handleMouseUp, true);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove, true);
      document.removeEventListener('mousedown', handleMouseDown, true);
      document.removeEventListener('mouseup', handleMouseUp, true);
    };
  }, [isPenetrationMode, resumeQueue]);

  const handleWindowMouseEnter = useCallback(() => {
    setIsInputVisible(true);
    handlePenetrationMouseEnter();
  }, [handlePenetrationMouseEnter]);

  const handleWindowMouseLeave = useCallback(() => {
    // 需求文档 6.1: 隐藏条件是"鼠标离开视窗 + 输入框无内容"
    if (!inputHasContent) {
      setIsInputVisible(false);
    }
    handlePenetrationMouseLeave();
    if (touchDetectorRef.current) {
      touchDetectorRef.current.clearHover();
    }
  }, [inputHasContent, handlePenetrationMouseLeave]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!touchDetectorRef.current || !containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const scaledX = x / scale;
    const scaledY = y / scale;

    touchDetectorRef.current.updateMousePosition(scaledX, scaledY);

    const zone = touchDetectorRef.current.detectZone(scaledX, scaledY);
    setHoveredZone(zone?.name || null);
  }, [scale]);

  const handleClick = useCallback((e: React.MouseEvent) => {
    if (isPenetrationMode) return;

    // 检查点击目标是否是输入框、按钮、状态气泡、聊天气泡或右键菜单
    const target = e.target as HTMLElement;
    if (target.tagName === 'TEXTAREA' ||
        target.tagName === 'INPUT' ||
        target.closest('.simple-input') ||
        target.closest('button') ||
        target.closest('.status-bubble') ||
        target.closest('.chat-bubble') ||
        target.closest('.context-menu')) {
      return;
    }

    const dragThreshold = 5;
    const distance = Math.sqrt(
      Math.pow(e.clientX - dragStartPosRef.current.x, 2) +
      Math.pow(e.clientY - dragStartPosRef.current.y, 2)
    );

    if (distance > dragThreshold) return;

    if (!touchDetectorRef.current || !containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const scaledX = x / scale;
    const scaledY = y / scale;

    const zone = touchDetectorRef.current.detectZone(scaledX, scaledY);

    if (zone) {
      setBubbleText(zone.responseText);

      addMessage({
        content: `Touch: ${zone.name}`,
        type: 'touch',
        sender: 'user',
        duration: 0,
      });

      playAnimation({
        animationId: zone.animation,
        intensity: 0.6,
        duration: 2000,
      });

      e.stopPropagation();
    }
  }, [isPenetrationMode, scale, playAnimation, addMessage]);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    if (isPenetrationMode) return;
    e.preventDefault();
    setContextMenuPosition({ x: e.clientX, y: e.clientY });
    setContextMenuOpen(true);
  }, [isPenetrationMode]);

  // Get available characters for switching
  const charactersObj = useCharacterManagementStore((s) => s.characters);
  // REMOVED: switchCharacter method doesn't exist in CharacterManagementStore
  // TODO: Re-implement character switching functionality
  // const switchCharacter = useCharacterManagementStore((s) => s.switchCharacter);
  const currentLocale = useLocaleStore((s) => s.locale);
  const setLocale = useLocaleStore((s) => s.setLocale);
  const [isCharacterHidden, setIsCharacterHidden] = useState(false);

  // Flatten characters object to array
  const characters = Object.values(charactersObj).flat();

  // Build character switch submenu
  // TEMPORARILY DISABLED: switchCharacter method doesn't exist
  const characterSubmenu: ContextMenuItem[] = [{
    id: 'no-characters',
    label: '角色切换功能暂不可用',
    onClick: () => {},
    disabled: true,
  }];

  /*
  for (const character of characters) {
    if (character.appearances && character.appearances.length > 0) {
      for (const appearance of character.appearances) {
        characterSubmenu.push({
          id: `char-${character.id}-${appearance.id}`,
          label: `${character.name} - ${appearance.name}`,
          onClick: () => switchCharacter(character.id, appearance.id),
        });
      }
    }
  }

  // If no characters available
  if (characterSubmenu.length === 0) {
    characterSubmenu.push({
      id: 'no-characters',
      label: t('tray:noCharacters'),
      onClick: () => {},
      disabled: true,
    });
  }
  */

  const contextMenuItems: ContextMenuItem[] = [
    {
      id: 'open-dialog',
      label: t('tray:openDialog'),
      onClick: () => handleOpenDialog(),
    },
    {
      id: 'open-settings',
      label: t('tray:settings'),
      onClick: () => {
        emit('open-settings');
      },
    },
    {
      id: 'display-management',
      label: t('tray:displayManagement'),
      onClick: () => {
        emit('open-settings', { tab: 'display' });
      },
    },
    // TEMPORARILY DISABLED: Hide/show character and center features
    /*
    {
      id: 'toggle-hide',
      label: isCharacterHidden ? t('tray:showCharacter') : t('tray:hideCharacter'),
      onClick: () => {
        setIsCharacterHidden(!isCharacterHidden);
        emit('toggle-hide', { hidden: !isCharacterHidden });
      },
    },
    {
      id: 'center-character',
      label: t('tray:centerCharacter'),
      onClick: () => emit('center-character'),
    },
    */
    {
      id: 'divider-2',
      label: '',
      onClick: () => {},
      isDivider: true,
    },
    {
      id: 'language',
      label: t('tray:language'),
      onClick: () => {}, // Parent menu item with submenu doesn't need action
      submenu: [
        {
          id: 'lang-zh',
          label: t('common:localeNameZh'),
          checked: currentLocale === 'zh',
          onClick: () => setLocale('zh'),
        },
        {
          id: 'lang-en',
          label: t('common:localeNameEn'),
          checked: currentLocale === 'en',
          onClick: () => setLocale('en'),
        },
        {
          id: 'lang-ja',
          label: t('common:localeNameJa'),
          checked: currentLocale === 'ja',
          onClick: () => setLocale('ja'),
        },
      ],
    },
  ];

  // CAP 消息处理已在 App.tsx 中统一处理
  // CharacterWindow 通过订阅 messageStore 和 characterStore 来响应消息
  // 这样确保只有一个逻辑层接收和分发 CAP 消息

  // TEMPORARILY DISABLED: Center character feature
  /*
  // 监听回到屏幕中央事件
  useEffect(() => {
    const unlistenPromise = (async () => {
      const { listen } = await import('@tauri-apps/api/event');
      return await listen('center-character', async () => {
        try {
          const window = getCurrentWindow();
          await window.center();
        } catch (error) {
          console.error('[CharacterWindow] Failed to center window:', error);
        }
      });
    })();

    return () => {
      unlistenPromise.then(unlisten => unlisten()).catch(console.error);
    };
  }, []);
  */

  useEffect(() => {
    if (bubbleText) {
      const timer = setTimeout(() => setBubbleText(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [bubbleText]);

  const handleTouchStart = useCallback(async (e: React.TouchEvent) => {
    if (isPenetrationMode) return;

    const target = e.target as HTMLElement;
    if (target.tagName === 'TEXTAREA' ||
        target.tagName === 'INPUT' ||
        target.closest('.simple-input') ||
        target.closest('button')) {
      return;
    }

    pauseQueue();

    if (spriteManagerRef.current?.hasAnimation('internal-physics-drag')) {
      spriteManagerRef.current.play('internal-physics-drag');
    }

    try {
      const window = getCurrentWindow();
      await window.startDragging();
    } catch (error) {
      console.error('[CharacterWindow] Failed to start dragging (touch):', error);
    }
    e.preventDefault();
  }, [isPenetrationMode, pauseQueue]);

  const handleSend = useCallback(async (content: string) => {
    // 输入验证：忽略空消息或仅包含空白字符的消息
    const trimmed = content.trim();
    if (!trimmed) {
      return;
    }

    // 乐观更新：立即显示用户消息（3秒后消失）
    addMessage({
      content: trimmed,
      type: 'chat',
      sender: 'user',
      duration: 3000,
    });

    // 获取 session ID：优先使用角色视窗自己的配置中的 sessionKey
    // 如果角色视窗配置中有 assistantId，则从对应助手获取 sessionKey
    let sessionKeyToSend: string | undefined;

    if (config?.assistant_id || config?.id) {
      // 使用角色视窗自己的配置查找对应的助手
      const windowAssistantId = config?.assistant_id || config?.id;
      const windowAssistant = assistants.find(a => a.id === windowAssistantId);

      if (windowAssistant) {
        sessionKeyToSend = getSessionKey(windowAssistant.integrations ?? []);
        console.log('[CharacterWindow] Using config assistant for sessionKey:', {
          windowAssistantId,
          windowAssistantName: windowAssistant.name,
          sessionKeyToSend,
        });
      }
    }

    // 如果角色视窗配置中没有找到，回退到全局选中的助手
    if (!sessionKeyToSend && selectedAssistant) {
      sessionKeyToSend = getSessionKey(selectedAssistant.integrations ?? []);
      console.log('[CharacterWindow] Fallback to selectedAssistant for sessionKey:', {
        selectedAssistantId: selectedAssistant.id,
        sessionKeyToSend,
      });
    }

    if (!sessionKeyToSend) {
      addMessage({
        content: '请先在设置中绑定助手',
        type: 'status',
        sender: 'system',
        duration: 3000,
      });
      return;
    }

    if (!isConnected) {
      addMessage({
        content: '请先连接到 OpenClaw',
        type: 'status',
        sender: 'system',
        duration: 3000,
      });
      return;
    }

    // 设置等待状态
    setIsWaitingForResponse(true);

    try {
      const params = { sessionId: sessionKeyToSend, content: trimmed };
      await invoke('send_message', params);
    } catch (error) {
      console.error('[CharacterWindow] Failed to send:', error);
      addMessage({
        content: '发送失败，请检查连接',
        type: 'status',
        sender: 'system',
        duration: 3000,
      });
      // 发送失败时清除等待状态
      setIsWaitingForResponse(false);
    }
  }, [config, assistants, selectedAssistant, isConnected, addMessage, setIsWaitingForResponse]);

  const handleOpenDialog = useCallback(() => {
    onOpenDialog?.();
  }, [onOpenDialog]);

  const cursorStyle = hoveredZone ? 'pointer' : 'grab';

  return (
    <div
      className={`character-window ${isPenetrationMode ? 'penetration-mode' : ''} ${hoveredZone ? 'zone-hovered' : ''}`}
      style={{ cursor: cursorStyle }}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleMouseUp}
      onMouseEnter={handleWindowMouseEnter}
      onMouseLeave={handleWindowMouseLeave}
      onMouseMove={handleMouseMove}
      onClick={handleClick}
      onContextMenu={handleContextMenu}
    >
      <div ref={containerRef} className="character-canvas" />

      {bubbleText && (
        <div className="thought-bubble">
          <div className="bubble-content">{bubbleText}</div>
        </div>
      )}

      <StatusBubble
        status={status}
        onDismiss={handleStatusDismiss}
      />
      {/* ChatBubble without click-to-open-dialog for character windows */}
      {/* ChatBubble filters by sessionKeys AND characterId for proper routing */}
      <ChatBubble disableClick={true} assistantId={currentCharacterId} sessionKeys={currentSessionKeys} />

      <SimpleInput
        visible={isInputVisible}
        onSend={handleSend}
        maxRows={3}
        disabled={isPenetrationMode}
        onHasContentChange={setInputHasContent}
        isWaitingForResponse={isWaitingForResponse}
      />

      <ContextMenu
        isOpen={contextMenuOpen}
        position={contextMenuPosition}
        onClose={() => setContextMenuOpen(false)}
        items={contextMenuItems}
      />
    </div>
  );
}

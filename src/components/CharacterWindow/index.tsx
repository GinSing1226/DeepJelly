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
import { useEventQueueStore } from '@/stores/eventQueueStore';
import { useStatusBubbleStore } from '@/stores/statusBubbleStore';
import { useSessionQueueStore } from '@/stores/sessionQueueStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useBrainStore } from '@/stores/brainStore';
import { useCAPMessage } from '@/hooks/useCAPMessage';
import { useBehaviorAnimation } from '@/hooks/useAnimationQueue';
import { usePenetrationMode } from '@/hooks/usePenetrationMode';
import { useCharacterResource } from './hooks/useCharacterResource';
import { SpriteManager } from '@/utils/spriteManager';
import { TouchDetector } from '@/utils/touchDetection';
import { getTouchZones } from '@/config/touchZones';
import { CHARACTER_DEFAULT_SIZE } from '@/config/constants';
import { ContextMenu, ContextMenuItem } from '@/components/ContextMenu';
import { StatusBubble, useStatusBubble } from '@/components/StatusBubble';
import { ChatBubble } from '@/components/ChatBubble';
import { SimpleInput } from './SimpleInput';

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

  // Status bubble management
  const { status, statusType, setPresetStatus, setCustomStatus, clearStatus } = useStatusBubble();

  // Penetration mode hook
  const {
    isPenetrationMode,
    setPenetrationMode,
    handleMouseEnter: handlePenetrationMouseEnter,
    handleMouseLeave: handlePenetrationMouseLeave,
  } = usePenetrationMode();

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
  const { boundApp } = useSettingsStore();
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

  // Character resource loading
  // Get the first character of the current assistant
  const currentCharacters = useCharacterManagementStore(state => {
    const selectedId = state.selectedAssistantId;
    if (!selectedId) return [];
    return state.characters[selectedId] || [];
  });
  const firstCharacter = currentCharacters[0];
  const defaultCharacterId = firstCharacter?.id || 'default';

  const {
    config,
    appearance,
    loadState,
  } = useCharacterResource({
    defaultCharacterId,
    defaultAppearanceId: firstCharacter?.defaultAppearanceId || 'default',
    preloadAnimations: false,
  });

  // 监听 statusBubbleStore 中的状态气泡
  useEffect(() => {
    const unsubscribe = useStatusBubbleStore.subscribe((state) => {
      const currentAssistantId = config?.assistant_id || config?.id;

      if (!currentAssistantId) {
        clearStatus();
        return;
      }

      // 状态气泡规则：无持续时间，会被后来者立刻打断
      // 使用 getLatestByReceiverId 获取该角色的最新状态气泡
      const latestBubble = state.getLatestByReceiverId(currentAssistantId);

      if (latestBubble) {
        // 使用前端emoji映射
        const emoji = mapEmojiName(latestBubble.emoji);
        const content = latestBubble.content || '';

        if (emoji || content) {
          setCustomStatus(emoji, content, null);
        }
      } else {
        clearStatus();
      }
    });
    return unsubscribe;
  }, [setCustomStatus, clearStatus, config]);

  // 监听 eventQueueStore 中的 behavior 事件，触发动画
  useEffect(() => {
    const unsubscribe = useEventQueueStore.subscribe((state) => {
      const events = state.events;

      // 获取当前角色 ID
      const currentAssistantId = config?.assistant_id || config?.id;

      if (!currentAssistantId) {
        return;
      }

      // 获取当前角色的最早的未消费 behavior 事件（先进先出）
      const firstEvent = events.find(e =>
        e.type === 'behavior' &&
        e.receiverId === currentAssistantId
      );

      if (firstEvent?.behavior) {
        const animationId = `${firstEvent.behavior.domain}-${firstEvent.behavior.category}-${firstEvent.behavior.action_id}`;
        const isSpeak = firstEvent.behavior.action_id === 'speak';

        // 如果是 speak 动画，延迟移除 session
        // 给 ChatBubble 足够时间显示（ChatBubble 默认显示 10 秒）
        if (isSpeak) {
          // 清除之前的定时器，防止内存泄漏
          if (removeSessionTimeoutRef.current) {
            clearTimeout(removeSessionTimeoutRef.current);
          }

          const speakDuration = firstEvent.behavior.duration_ms || 10000;
          const bubbleDisplayTime = 10000; // ChatBubble 的默认显示时间
          const delay = Math.max(speakDuration, bubbleDisplayTime) + 500; // 多等 500ms 确保显示完成

          removeSessionTimeoutRef.current = setTimeout(() => {
            const sessions = useSessionQueueStore.getState().sessions;
            const currentSessions = sessions.filter(s => s.receiverId === currentAssistantId);
            if (currentSessions.length > 0) {
              currentSessions.forEach(s => {
                useSessionQueueStore.getState().removeSession(s.id);
              });
            }
            // 清除已执行的定时器引用
            removeSessionTimeoutRef.current = null;
          }, delay);
        }

        // 播放行为动画
        playBehaviorAnimation({
          domain: firstEvent.behavior.domain as any,
          category: firstEvent.behavior.category as any,
          action_id: firstEvent.behavior.action_id,
          urgency: firstEvent.behavior.urgency,
          intensity: firstEvent.behavior.intensity,
          duration_ms: firstEvent.behavior.duration_ms,
        });

        // 立即消费事件（从队列中移除）
        useEventQueueStore.getState().consumeEvent(firstEvent.id);
      }
    });
    return unsubscribe;
  }, [playBehaviorAnimation, config]);

  // 监听 sessionQueueStore，当收到 AI 回复时清除等待状态
  useEffect(() => {
    const unsubscribe = useSessionQueueStore.subscribe((state) => {
      const sessions = state.sessions;

      // 获取当前角色 ID
      const currentAssistantId = config?.assistant_id || config?.id;
      if (!currentAssistantId || !isWaitingForResponse) {
        return;
      }

      // 查找是否有来自该角色的 assistant 消息
      const hasAssistantResponse = sessions.some(s =>
        s.receiverId === currentAssistantId && s.sender === 'assistant'
      );

      if (hasAssistantResponse) {
        setIsWaitingForResponse(false);
      }
    });
    return unsubscribe;
  }, [config, isWaitingForResponse, setIsWaitingForResponse]);

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

        console.log('[CharacterWindow] Loading character resources:', { assistantId, characterId });

        // Helper: Load all resources for an action using batch API
        const loadActionResources = async (actionKey: string, action: any): Promise<{
          actionKey: string;
          framePaths: string[];
          frameRate: number;
          loop: boolean;
          loopStartFrame?: number;
        } | null> => {
          const rawFrames = action.resources || action.frames;
          if (!rawFrames || !Array.isArray(rawFrames)) return null;

          try {
            // 构建完整资源路径：actionKey/fileName
            // 例如: internal-base-idle/0001.png
            const fullResourceNames = rawFrames.map((frame: string) => `${actionKey}/${frame}`);

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

            return { actionKey, framePaths, frameRate, loop, loopStartFrame };
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
            await spriteManagerRef.current.loadFrameAnimation(
              idleData.actionKey,
              idleData.framePaths,
              idleData.frameRate,
              idleData.loop,
              idleData.loopStartFrame
            );
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
              await spriteManagerRef.current.loadFrameAnimation(
                actionData.actionKey,
                actionData.framePaths,
                actionData.frameRate,
                actionData.loop,
                actionData.loopStartFrame
              );

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

    resumeQueue();

    // 播放待机动画（如果队列没有其他动画要播放）
    if (spriteManagerRef.current && !isQueuePaused()) {
      spriteManagerRef.current.play('internal-base-idle');
    }
  }, [isPenetrationMode, resumeQueue, isQueuePaused]);

  // 拖拽结束检测 - 通过 mousemove 检测鼠标按键状态
  useEffect(() => {
    let isDragging = false;

    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging && e.buttons === 0 && spriteManagerRef.current) {
        const currentAnim = spriteManagerRef.current.getCurrentAnimation();
        if (currentAnim === 'internal-physics-drag') {
          spriteManagerRef.current.play('internal-base-idle');
          resumeQueue();
        }
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
      if (isDragging && spriteManagerRef.current) {
        const currentAnim = spriteManagerRef.current.getCurrentAnimation();
        if (currentAnim === 'internal-physics-drag') {
          spriteManagerRef.current.play('internal-base-idle');
          resumeQueue();
        }
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
  const switchCharacter = useCharacterManagementStore((s) => s.switchCharacter);
  const currentLocale = useLocaleStore((s) => s.locale);
  const setLocale = useLocaleStore((s) => s.setLocale);
  const [isCharacterHidden, setIsCharacterHidden] = useState(false);

  // Flatten characters object to array
  const characters = Object.values(charactersObj).flat();

  // Build character switch submenu
  const characterSubmenu: ContextMenuItem[] = [];
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

    // 获取 session ID：优先使用 sessionKey
    const sessionKeyToSend = boundApp?.sessionKey;
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
  }, [boundApp, isConnected, addMessage, setIsWaitingForResponse]);

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
        statusType={statusType}
        onDismiss={clearStatus}
      />
      <ChatBubble onOpenDialog={handleOpenDialog} assistantId={config?.assistant_id || config?.id} />

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

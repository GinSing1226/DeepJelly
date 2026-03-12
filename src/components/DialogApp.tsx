/**
 * DialogApp Component
 *
 * Main component for the independent dialog window.
 * Provides session list view and conversation view.
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { listen } from '@tauri-apps/api/event';
import { useSessionStore, SessionMessage, Session } from '@/stores/sessionStore';
import { useBrainStore } from '@/stores/brainStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useCharacterManagementStore } from '@/stores/characterManagementStore';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { getSessionKey } from '@/utils/assistantHelper';
import './DialogPanel/styles.css';
// Import enhanced styles for better UI (optional - remove to use default styles)
import './DialogPanel/enhanced.css';

type ViewMode = 'list' | 'chat';

export function DialogApp() {
  const { t } = useTranslation(['dialog', 'common', 'error']);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [searchQuery, setSearchQuery] = useState('');
  const [inputValue, setInputValue] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Pagination state for loading more messages
  const [loadedCount, setLoadedCount] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // Track if it's first time entering a chat (for scroll optimization)
  const [isFirstChatEntry, setIsFirstChatEntry] = useState(true);
  // Track initial loading state for skeleton screen
  const [isInitialLoading, setIsInitialLoading] = useState(true);

  // Store state
  const { boundApp } = useSettingsStore();
  // 分别订阅以确保正确响应变化
  const selectedAssistantId = useCharacterManagementStore((s) => s.selectedAssistantId);
  const assistants = useCharacterManagementStore((s) => s.assistants);
  const isLoadingAssistants = useCharacterManagementStore((s) => s.isLoading);

  // 计算 currentAssistant
  const currentAssistant = selectedAssistantId
    ? assistants.find(a => a.id === selectedAssistantId) || null
    : (assistants.length > 0 ? assistants[0] : null);
  const sessions = useSessionStore((s) => s.sessions);
  const currentSessionId = useSessionStore((s) => s.currentSessionId);
  const messagesBySession = useSessionStore((s) => s.messagesBySession);
  const isLoading = useSessionStore((s) => s.isLoading);
  const isSending = useSessionStore((s) => s.isSending);

  // Actions - use store directly for stable references
  const setCurrentSession = useSessionStore.getState().setCurrentSession;
  const addSession = useSessionStore.getState().addSession;
  const addMessage = useSessionStore.getState().addMessage;
  const updateMessage = useSessionStore.getState().updateMessage;
  const markAsRead = useSessionStore.getState().markAsRead;
  const setLoading = useSessionStore.getState().setLoading;
  const setSending = useSessionStore.getState().setSending;

  // Connection state from brain store
  const connected = useBrainStore((s) => s.connected);

  // Get current session and messages
  const currentSession = sessions.find((s) => s.id === currentSessionId);
  const currentMessages = currentSessionId ? messagesBySession[currentSessionId] || [] : [];

  // Debug logging for state
  useEffect(() => {
    // State update tracking - can be re-enabled for debugging
  }, [boundApp, currentAssistant, connected, sessions, currentSessionId, inputValue, isSending, selectedAssistantId, assistants.length, isLoadingAssistants]);

  // 主动查询连接状态（对话框窗口需要同步主窗口的连接状态）
  useEffect(() => {
    const checkConnection = async () => {
      try {
        const isConnected = await invoke<boolean>('is_brain_connected');
        // 如果后端已连接，更新本地 store 状态
        if (isConnected && !connected) {
          useBrainStore.setState({ connected: true });
        }
      } catch (error) {
        console.error('[DialogApp] Failed to check connection:', error);
      }
    };

    checkConnection();
  }, []); // 只在组件挂载时执行一次

  // Load assistants on mount (to get sessionKey)
  useEffect(() => {
    const loadAssistantsData = async () => {
      try {
        await useCharacterManagementStore.getState().loadAssistants();
      } catch (error) {
        console.error('[DialogApp] Failed to load assistants:', error);
      }
    };

    loadAssistantsData();
  }, []); // 只在组件挂载时执行一次

  // 监听资源热更新事件
  useEffect(() => {
    const unlistenPromise = (async () => {
      const { listen } = await import('@tauri-apps/api/event');
      return await listen('resource-changed', (_event: any) => {
        // 重新加载角色数据
        useCharacterManagementStore.getState().loadAllCharacters();
      });
    })();

    return () => {
      unlistenPromise.then(unlisten => unlisten()).catch(console.error);
    };
  }, []);

  // Load ALL session history when dialog opens or when connection is established (multi-character support)
  useEffect(() => {
    const loadAllSessionsHistory = async () => {
      // 如果 assistants 还在加载中，等待
      if (isLoadingAssistants) {
        return;
      }

      if (!connected) {
        return;
      }

      try {
        setLoading(true);
        setIsInitialLoading(true);

        // Get all sessions from brain backend
        const getAllSessions = useBrainStore.getState().getAllSessions;
        const allSessionInfos = await getAllSessions(100);

        // Collect all valid sessionKeys from assistants
        const assistantSessionKeys = new Map<string, { assistantId: string; assistantName: string }>();
        for (const assistant of assistants) {
          const sessionKey = getSessionKey(assistant.integrations ?? []);
          if (sessionKey) {
            assistantSessionKeys.set(sessionKey, {
              assistantId: assistant.id,
              assistantName: assistant.name,
            });
          }
        }

        // Process each session from brain
        let loadedCount = 0;
        for (const sessionInfo of allSessionInfos) {
          const sessionKey = sessionInfo.sessionKey || sessionInfo.key;
          if (!sessionKey) {
            continue;
          }

          // Find matching assistant
          const assistantInfo = assistantSessionKeys.get(sessionKey);
          const assistantName = assistantInfo?.assistantName || sessionInfo.displayName || sessionInfo.label || 'Unknown';

          // Check if session already exists (by assistantId which stores sessionKey)
          const existingSession = sessions.find(s => s.assistantId === sessionKey);
          if (existingSession) {
            // Load messages for existing session
            const getSessionHistory = useBrainStore.getState().getSessionHistory;
            try {
              const historyMessages = await getSessionHistory(sessionKey, 50, 0);
              for (const msg of historyMessages) {
                addMessage(existingSession.id, {
                  content: msg.content || '',
                  sender: msg.role === 'user' ? 'user' : 'assistant',
                  timestamp: msg.timestamp || Date.now(),
                  isStreaming: false,
                });
              }
              loadedCount += historyMessages.length;
            } catch (error) {
              console.error('[DialogApp] Failed to load messages for session', sessionKey, error);
            }
            continue;
          }

          // Create new session
          const newSessionId = addSession({
            title: assistantName,
            assistantId: sessionKey, // Store sessionKey as assistantId
            isGroup: sessionInfo.kind === 'group' || false,
            assistantName: assistantName,
            lastMessage: sessionInfo.messages?.[0]?.content,
            lastMessageTime: sessionInfo.updatedAt || sessionInfo.createdAt,
          });

          // Load history messages
          const getSessionHistory = useBrainStore.getState().getSessionHistory;
          try {
            const historyMessages = await getSessionHistory(sessionKey, 50, 0);
            // Add all history messages to the session
            for (const msg of historyMessages) {
              addMessage(newSessionId, {
                content: msg.content || '',
                sender: msg.role === 'user' ? 'user' : 'assistant',
                timestamp: msg.timestamp || Date.now(),
                isStreaming: false,
              });
            }
            loadedCount += historyMessages.length;
          } catch (error) {
            console.error('[DialogApp] Failed to load history for', sessionKey, error);
          }
        }
      } catch (error) {
        console.error('[DialogApp] Failed to load all sessions:', error);
      } finally {
        setLoading(false);
        setIsInitialLoading(false);
      }
    };

    loadAllSessionsHistory();
  }, [connected, assistants.length, isLoadingAssistants]); // Re-run when connected changes to true or when assistants are loaded

  // Listen for CAP messages from backend (Rust emits 'cap:message')
  // Note: Only register once, use ref to get latest currentSessionId
  useEffect(() => {
    const unlistenPromise = listen<any>('cap:message', (event) => {
      const capMessage = event.payload;

      // Parse CAP message - extract session message content
      if (capMessage.type === 'session' && capMessage.payload?.message) {
        const msgPayload = capMessage.payload.message;
        const content = msgPayload.content || '';
        const sender = msgPayload.role === 'user' ? 'user' : 'assistant';

        // Get the current session ID from store (not from closure)
        const sessionId = useSessionStore.getState().currentSessionId;

        // Add message to current session
        if (sessionId && content) {
          addMessage(sessionId, {
            content,
            sender,
            timestamp: Date.now(),
            isStreaming: false,
          });
        }
      }
    });

    unlistenPromise.then(() => {
      // Listener registered
    }).catch((e) => {
      console.error('[DialogApp] Failed to register cap:message listener:', e);
    });

    return () => {
      unlistenPromise.then((fn) => fn());
    };
  }, []); // Empty dependency array - only register once

  // 监听引导页完成事件，重新加载助手数据
  useEffect(() => {
    const unlistenPromise = (async () => {
      const { listen } = await import('@tauri-apps/api/event');
      return await listen('onboarding:complete', async (_event) => {
        // 重新加载助手列表
        const { loadAssistants, selectAssistant } = useCharacterManagementStore.getState();
        await loadAssistants();

        // 等待 store 更新
        setTimeout(() => {
          const updatedAssistants = useCharacterManagementStore.getState().assistants;
          if (updatedAssistants.length > 0) {
            const firstAssistant = updatedAssistants[0];
            selectAssistant(firstAssistant.id);
          }
        }, 100);
      });
    })();

    return () => {
      unlistenPromise.then(unlisten => unlisten()).catch(console.error);
    };
  }, []);

  // Filter sessions by search query
  const filteredSessions = sessions.filter((session) =>
    session.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Sort sessions: unread first, then by last message time
  const sortedSessions = [...filteredSessions].sort((a, b) => {
    if (a.unreadCount > 0 && b.unreadCount === 0) return -1;
    if (a.unreadCount === 0 && b.unreadCount > 0) return 1;
    return (b.lastMessageTime || 0) - (a.lastMessageTime || 0);
  });

  // Handle session selection
  const handleSelectSession = useCallback((sessionId: string) => {
    setCurrentSession(sessionId);
    markAsRead(sessionId);
    setViewMode('chat');
    setIsFirstChatEntry(true); // Reset first entry flag for scroll optimization
    setTimeout(() => inputRef.current?.focus(), 100);
  }, [setCurrentSession, markAsRead]);

  // Handle back to list
  const handleBackToList = useCallback(() => {
    setViewMode('list');
    setCurrentSession(null);
  }, [setCurrentSession]);

  // Handle refresh sessions - intelligent incremental refresh
  const handleRefreshSessions = useCallback(async () => {
    // 优先使用 currentAssistant（从 integrations 提取），如果没有则回退到 boundApp.sessionKey
    const sessionKey = getSessionKey(currentAssistant?.integrations ?? []) || boundApp?.sessionKey;
    if (!sessionKey) {
      return;
    }

    if (!connected) {
      return;
    }

    try {
      setLoading(true);

      // Find existing session
      const existingSession = sessions.find(s => s.assistantId === sessionKey);
      if (!existingSession) {
        setLoading(false);
        return;
      }

      const getSessionHistory = useBrainStore.getState().getSessionHistory;
      const localMessages = messagesBySession[existingSession.id] || [];
      const localLatestMsg = localMessages.length > 0 ? localMessages[localMessages.length - 1] : null;

      // Step 1: Get remote latest message to compare
      const remoteLatestBatch = await getSessionHistory(sessionKey, 1, 0);
      const remoteLatestMsg = remoteLatestBatch.length > 0 ? remoteLatestBatch[0] : null;

      if (!remoteLatestMsg) {
        setLoading(false);
        return;
      }

      // Step 2: Compare and decide sync strategy
      const localLatestTime = localLatestMsg?.timestamp || 0;
      const remoteLatestTime = remoteLatestMsg.timestamp || 0;
      const timeDiff = remoteLatestTime - localLatestTime;

      // Strategy 1: Full refresh if local is empty, too old (> 1 hour diff), or suspiciously small (< 10 messages)
      // This handles the case where initial load didn't get all messages
      if (!localLatestMsg || timeDiff > 3600000 || localMessages.length < 10) {
        // Reset pagination state
        setLoadedCount(0);
        setHasMore(true);

        // Clear and reload
        const { clearMessages } = useSessionStore.getState();
        clearMessages(existingSession.id);

        const historyMessages = await getSessionHistory(sessionKey, 50, 0);
        for (const msg of historyMessages) {
          addMessage(existingSession.id, {
            content: msg.content || '',
            sender: msg.role === 'user' ? 'user' : 'assistant',
            timestamp: msg.timestamp || Date.now(),
            isStreaming: false,
          });
        }

        setLoadedCount(historyMessages.length);
        setHasMore(historyMessages.length === 50);
      } else if (remoteLatestTime > localLatestTime) {
        // Strategy 2: Incremental sync - only fetch new messages
        // Estimate how many new messages to fetch
        // Fetch slightly more to be safe (max 20 at a time for refresh)
        const fetchLimit = Math.min(20, Math.max(5, Math.ceil(timeDiff / 60000))); // 1 msg per minute estimate

        const newMessagesBatch = await getSessionHistory(sessionKey, fetchLimit, 0);

        // Filter messages that are newer than local latest
        const trulyNewMessages = newMessagesBatch.filter(msg => (msg.timestamp || 0) > localLatestTime);

        // Add new messages (they will be sorted by timestamp automatically)
        for (const msg of trulyNewMessages) {
          addMessage(existingSession.id, {
            content: msg.content || '',
            sender: msg.role === 'user' ? 'user' : 'assistant',
            timestamp: msg.timestamp || Date.now(),
            isStreaming: false,
          });
        }
      }
    } catch (error) {
      console.error('[DialogApp] Failed to refresh session history:', error);
    } finally {
      setLoading(false);
    }
  }, [boundApp, connected, sessions, messagesBySession, addMessage, setLoading]);

  // Handle create new session
  const handleCreateSession = useCallback(async () => {
    if (!connected) {
      // Create a local session for demo
      const newSessionId = addSession({
        title: t('dialog:newConversation'),
        isGroup: false,
        assistantName: 'Assistant',
      });
      handleSelectSession(newSessionId);
      return;
    }

    try {
      setLoading(true);
      // Create local session directly (no backend session creation needed)
      const newSessionId = addSession({
        title: t('dialog:newConversation'),
        isGroup: false,
        assistantName: 'Assistant',
      });
      handleSelectSession(newSessionId);
    } catch (error) {
      console.error('Failed to create session:', error);
    } finally {
      setLoading(false);
    }
  }, [connected, addSession, handleSelectSession, setLoading, t]);

  // Handle send message
  const handleSendMessage = useCallback(async () => {
    if (!inputValue.trim() || !currentSessionId || isSending) {
      return;
    }

    const content = inputValue.trim();
    setInputValue('');

    // Add user message immediately
    addMessage(currentSessionId, {
      content,
      sender: 'user',
      timestamp: Date.now(),
    });

    if (!connected) {
      // Show offline message
      setTimeout(() => {
        addMessage(currentSessionId, {
          content: t('dialog:disconnected'),
          sender: 'system',
          timestamp: Date.now(),
        });
      }, 500);
      return;
    }

    try {
      setSending(true);

      // Add streaming placeholder for assistant response
      const assistantMsgId = addMessage(currentSessionId, {
        content: '',
        sender: 'assistant',
        isStreaming: true,
        timestamp: Date.now(),
      });

      // Send message to backend
      // 优先使用 currentAssistant（从 integrations 提取），如果没有则回退到 boundApp.sessionKey
      const sessionKeyToSend = getSessionKey(currentAssistant?.integrations ?? []) || boundApp?.sessionKey;
      if (!sessionKeyToSend) {
        throw new Error('No session key available');
      }
      // Tauri v2 uses camelCase for command parameters
      const params = { sessionId: sessionKeyToSend, content };
      await invoke('send_message', params);

      // Update message to complete (in real implementation, this would be updated by streaming events)
      setTimeout(() => {
        updateMessage(currentSessionId, assistantMsgId, {
          content: t('dialog:responsePlaceholder'),
          isStreaming: false,
        });
      }, 1000);
    } catch (error) {
      console.error('Failed to send message:', error);
      addMessage(currentSessionId, {
        content: t('sendMessageFailed', { error: String(error) }),
        sender: 'system',
        timestamp: Date.now(),
      });
    } finally {
      setSending(false);
    }
  }, [inputValue, currentSessionId, isSending, connected, currentSession, addMessage, updateMessage, setSending, t]);

  // Handle keyboard events
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Handle input change
  const handleInputChange = (value: string) => {
    setInputValue(value);
  };

  // Handle send button click
  const handleSendButtonClick = () => {
    handleSendMessage();
  };

  // Handle load more messages
  const handleLoadMore = useCallback(async () => {
    // 优先使用 currentAssistant（从 integrations 提取），如果没有则回退到 boundApp.sessionKey
    const sessionKey = getSessionKey(currentAssistant?.integrations ?? []) || boundApp?.sessionKey;
    if (!sessionKey || !currentSessionId || isLoadingMore || !hasMore) {
      return;
    }

    setIsLoadingMore(true);

    try {
      const getSessionHistory = useBrainStore.getState().getSessionHistory;
      const historyMessages = await getSessionHistory(sessionKey, 50, loadedCount);

      // Add messages WITH timestamps
      for (const msg of historyMessages) {
        addMessage(currentSessionId, {
          content: msg.content || '',
          sender: msg.role === 'user' ? 'user' : 'assistant',
          timestamp: msg.timestamp || Date.now(), // ✅ Pass timestamp from API
          isStreaming: false,
        });
      }

      // Update pagination state
      setLoadedCount(prev => prev + historyMessages.length);
      setHasMore(historyMessages.length === 50);
    } catch (error) {
      console.error('[DialogApp] Failed to load more messages:', error);
    } finally {
      setIsLoadingMore(false);
    }
  }, [boundApp, currentSessionId, loadedCount, isLoadingMore, hasMore, addMessage]);

  // Handle window close
  const handleClose = useCallback(async () => {
    // 标记对话框为用户主动关闭
    useSettingsStore.getState().setDialogExplicitlyClosed(true);

    try {
      await invoke('close_dialog_window');
    } catch (error) {
      console.error('[DialogApp] Failed to close dialog window via command:', error);
      // Fallback: close window via Tauri API
      const window = getCurrentWindow();
      await window.close();
    }
  }, []);

  // Handle window minimize
  const handleMinimize = useCallback(async () => {
    const window = getCurrentWindow();
    await window.minimize();
  }, []);

  // Handle header drag - programmatic drag for window
  const handleHeaderMouseDown = useCallback(async (e: React.MouseEvent) => {
    // Only respond to left mouse button
    if (e.button !== 0) return;

    // Don't drag if clicking on buttons
    const target = e.target as HTMLElement;
    if (target.tagName === 'BUTTON' || target.closest('button')) {
      return;
    }

    try {
      const window = getCurrentWindow();
      await window.startDragging();
    } catch (error) {
      console.error('[DialogApp] Failed to start dragging:', error);
    }
  }, []);

  return (
    <div className="dialog-app">
      {viewMode === 'list' ? (
        <SessionListView
          sessions={sortedSessions}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onSelectSession={handleSelectSession}
          onCreateSession={handleCreateSession}
          onRefreshSessions={handleRefreshSessions}
          isLoading={isLoading}
          isInitialLoading={isInitialLoading}
          connected={connected}
          onClose={handleClose}
          onMinimize={handleMinimize}
          onHeaderMouseDown={handleHeaderMouseDown}
          t={t}
        />
      ) : (
        <ChatView
          session={currentSession}
          messages={currentMessages}
          inputValue={inputValue}
          onInputChange={handleInputChange}
          onSendMessage={handleSendButtonClick}
          onBack={handleBackToList}
          onKeyDown={handleKeyDown}
          isSending={isSending}
          connected={connected}
          messagesEndRef={messagesEndRef}
          inputRef={inputRef}
          onClose={handleClose}
          onMinimize={handleMinimize}
          onHeaderMouseDown={handleHeaderMouseDown}
          onLoadMore={handleLoadMore}
          hasMore={hasMore}
          isLoadingMore={isLoadingMore}
          loadedCount={loadedCount}
          isFirstChatEntry={isFirstChatEntry}
          onScrollComplete={() => setIsFirstChatEntry(false)}
          t={t}
        />
      )}
    </div>
  );
}

// Session List View Component
interface SessionListViewProps {
  sessions: Session[];
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onSelectSession: (id: string) => void;
  onCreateSession: () => void;
  onRefreshSessions: () => void;
  isLoading: boolean;
  isInitialLoading: boolean;
  connected: boolean;
  onClose: () => void;
  onMinimize: () => void;
  onHeaderMouseDown?: (e: React.MouseEvent) => void;
  t: (key: string, options?: Record<string, unknown>) => string;
}

function SessionListView({
  sessions,
  searchQuery,
  onSearchChange,
  onSelectSession,
  onCreateSession: _onCreateSession,
  onRefreshSessions,
  isLoading,
  isInitialLoading,
  connected,
  onClose,
  onMinimize,
  onHeaderMouseDown,
  t,
}: SessionListViewProps) {
  return (
    <div className="dialog-panel">
      {/* Header */}
      <div className="dialog-header" onMouseDown={onHeaderMouseDown}>
        <div className="dialog-title">
          <span className="dialog-icon">🪼</span>
          <span>{t('dialog:sessionList')}</span>
        </div>
        <div className="dialog-status">
          <span className={`status-dot ${connected ? 'connected' : 'disconnected'}`} />
          <span>{connected ? t('common:connected') : t('dialog:disconnected')}</span>
        </div>
        <button
          className="dialog-refresh-btn"
          onClick={onRefreshSessions}
          disabled={isLoading || !connected}
          title={t('dialog:refresh') || '刷新'}
        >
          {isLoading ? '⏳' : '🔄'}
        </button>
        <div className="dialog-header-actions">
          <button className="dialog-header-btn" onClick={onMinimize} title={t('common:minimize')}>
            −
          </button>
          <button className="dialog-header-btn dialog-close-btn" onClick={onClose} title={t('common:close')}>
            ×
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="dialog-search">
        <input
          type="text"
          placeholder={t('dialog:searchPlaceholder')}
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="dialog-search-input"
        />
      </div>

      {/* Session List */}
      <div className="dialog-session-list">
        {isInitialLoading ? (
          // Loading skeleton
          <>
            <SessionCardSkeleton />
            <SessionCardSkeleton />
            <SessionCardSkeleton />
          </>
        ) : sessions.length === 0 ? (
          <div className="dialog-empty">
            <div className="dialog-empty-icon">💬</div>
            <div className="dialog-empty-text">{t('dialog:noSessions')}</div>
          </div>
        ) : (
          <>
            {sessions.map((session) => (
              <SessionCard
                key={session.id}
                session={session}
                onClick={() => onSelectSession(session.id)}
              />
            ))}
          </>
        )}
      </div>
    </div>
  );
}

// Session Card Skeleton Component (Loading Animation)
function SessionCardSkeleton() {
  return (
    <div className="session-card session-card-skeleton">
      <div className="session-avatar skeleton-shimmer"></div>
      <div className="session-info">
        <div className="session-header">
          <div className="skeleton-line skeleton-title"></div>
          <div className="skeleton-line skeleton-time"></div>
        </div>
        <div className="skeleton-line skeleton-preview"></div>
      </div>
    </div>
  );
}

// Session Card Component
interface SessionCardProps {
  session: Session;
  onClick: () => void;
}

function SessionCard({ session, onClick }: SessionCardProps) {
  const formatTime = (timestamp?: number) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();

    if (isToday) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  return (
    <div className="session-card" onClick={onClick}>
      <div className="session-avatar">
        {session.isGroup ? '👥' : (session.assistantAvatar || '🤖')}
      </div>
      <div className="session-info">
        <div className="session-header">
          <span className="session-title">
            {session.assistantName && session.assistantId
              ? `${session.assistantName} (${session.assistantId})`
              : session.title}
          </span>
          {session.lastMessageTime && (
            <span className="session-time">{formatTime(session.lastMessageTime)}</span>
          )}
        </div>
        <div className="session-preview">
          {session.lastMessage || '...'}
        </div>
      </div>
    </div>
  );
}

// Chat View Component
interface ChatViewProps {
  session?: Session;
  messages: SessionMessage[];
  inputValue: string;
  onInputChange: (value: string) => void;
  onSendMessage: () => void;
  onBack: () => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  isSending: boolean;
  connected: boolean;
  messagesEndRef: React.RefObject<HTMLDivElement>;
  inputRef: React.RefObject<HTMLTextAreaElement>;
  onClose: () => void;
  onMinimize: () => void;
  onHeaderMouseDown?: (e: React.MouseEvent) => void;
  onLoadMore: () => void;
  hasMore: boolean;
  isLoadingMore: boolean;
  loadedCount: number;
  isFirstChatEntry: boolean;
  onScrollComplete: () => void;
  t: (key: string, options?: Record<string, unknown>) => string;
}

function ChatView({
  session,
  messages,
  inputValue,
  onInputChange,
  onSendMessage,
  onBack,
  onKeyDown,
  isSending,
  connected,
  messagesEndRef,
  inputRef,
  onClose,
  onMinimize,
  onHeaderMouseDown,
  onLoadMore,
  hasMore,
  isLoadingMore,
  loadedCount: _loadedCount,
  isFirstChatEntry,
  onScrollComplete,
  t,
}: ChatViewProps) {
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const lastScrollHeight = useRef<number>(0);
  const previousMessageCount = useRef<number>(0);

  // Scroll to latest message with optimization
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    const messageCount = messages.length;

    // First time entering chat: jump to bottom instantly (no animation)
    if (isFirstChatEntry && messageCount > 0) {
      container.scrollTop = container.scrollHeight;
      onScrollComplete(); // Mark first entry as complete
      previousMessageCount.current = messageCount;
      return;
    }

    // New message arrived: smooth scroll to bottom
    if (messageCount > previousMessageCount.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      previousMessageCount.current = messageCount;
    }
  }, [messages.length, isFirstChatEntry, onScrollComplete, messagesEndRef]);

  // Infinite scroll - load more when scrolling to top
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container || !hasMore || isLoadingMore) return;

    const handleScroll = () => {
      // When scrolled near top (within 100px), load more messages
      if (container.scrollTop < 100 && hasMore && !isLoadingMore) {
        // Save current scroll height to restore position after loading
        lastScrollHeight.current = container.scrollHeight;
        onLoadMore();
      }
    };

    container.addEventListener('scroll', handleScroll);

    // Restore scroll position after new messages are loaded
    if (lastScrollHeight.current > 0 && container.scrollHeight !== lastScrollHeight.current) {
      const newScrollTop = container.scrollHeight - lastScrollHeight.current;
      container.scrollTop = newScrollTop > 0 ? newScrollTop : 0;
      lastScrollHeight.current = 0;
    }

    return () => {
      container.removeEventListener('scroll', handleScroll);
    };
  }, [hasMore, isLoadingMore, onLoadMore, messages.length]);
  return (
    <div className="dialog-panel">
      {/* Header */}
      <div className="dialog-header" onMouseDown={onHeaderMouseDown}>
        <button className="dialog-back-btn" onClick={onBack}>
          ←
        </button>
        <div className="dialog-title">
          <span>
            {session?.assistantName && session?.assistantId
              ? `${session.assistantName} (${session.assistantId})`
              : session?.title || t('dialog:conversation')}
          </span>
        </div>
        <div className="dialog-header-actions">
          <button className="dialog-header-btn" onClick={onMinimize} title={t('common:minimize')}>
            −
          </button>
          <button className="dialog-header-btn dialog-close-btn" onClick={onClose} title={t('common:close')}>
            ×
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="dialog-messages" ref={messagesContainerRef}>
        {messages.length === 0 ? (
          <div className="dialog-empty-messages">
            <div className="dialog-empty-icon">💬</div>
            <div className="dialog-empty-text">{t('dialog:startTyping')}</div>
          </div>
        ) : (
          <>
            {/* Loading indicator at top */}
            {isLoadingMore && (
              <div style={{
                textAlign: 'center',
                padding: '12px',
                color: '#94a3b8',
                fontSize: '14px',
              }}>
                ⏳ 加载更多消息中...
              </div>
            )}
            {messages.map((message) => (
              <MessageItem key={message.id} message={message} />
            ))}
          </>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="dialog-input">
        <textarea
          ref={inputRef}
          value={inputValue}
          onChange={(e) => {
            onInputChange(e.target.value);
          }}
          onKeyDown={onKeyDown}
          placeholder={connected ? t('dialog:inputPlaceholder') : t('dialog:disconnected')}
          disabled={!connected || isSending}
          rows={1}
          className="dialog-input-textarea"
        />
        <button
          className="send-button"
          onClick={() => {
            onSendMessage();
          }}
          disabled={!connected || isSending || !inputValue.trim()}
        >
          {isSending ? '...' : t('dialog:send')}
        </button>
      </div>
    </div>
  );
}

// Message Item Component
interface MessageItemProps {
  message: SessionMessage;
}

function MessageItem({ message }: MessageItemProps) {
  const isUser = message.sender === 'user';
  const isSystem = message.sender === 'system';

  // Format timestamp to show date + time (yyyy-mm-dd hh:mm:ss)
  const formatTimestamp = (timestamp?: number) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');

    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  };

  return (
    <div className={`message-item ${message.sender}`}>
      {!isUser && !isSystem && (
        <div className="message-avatar">🤖</div>
      )}
      <div className="message-content">
        <div className="message-bubble">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              p: ({ children }) => <p style={{ margin: '0.25em 0' }}>{children}</p>,
              code: ({ inline, children }: { inline?: boolean; children?: React.ReactNode }) => inline
                ? <code style={{
                    background: 'rgba(0,0,0,0.05)',
                    padding: '2px 4px',
                    borderRadius: '3px',
                    fontSize: '0.9em'
                  }}>{children}</code>
                : <code style={{
                    display: 'block',
                    background: 'rgba(0,0,0,0.05)',
                    padding: '8px',
                    borderRadius: '4px',
                    fontSize: '0.85em',
                    overflowX: 'auto'
                  }}>{children}</code>,
              pre: ({ children }) => <pre style={{
                background: 'rgba(0,0,0,0.05)',
                padding: '8px',
                borderRadius: '4px',
                overflowX: 'auto',
                margin: '0.5em 0'
              }}>{children}</pre>,
              ul: ({ children }) => <ul style={{ margin: '0.25em 0', paddingLeft: '1.5em' }}>{children}</ul>,
              ol: ({ children }) => <ol style={{ margin: '0.25em 0', paddingLeft: '1.5em' }}>{children}</ol>,
              li: ({ children }) => <li style={{ margin: '0.1em 0' }}>{children}</li>,
              strong: ({ children }) => <strong>{children}</strong>,
              em: ({ children }) => <em>{children}</em>,
              a: ({ href, children }) => <a href={href} target="_blank" rel="noopener noreferrer" style={{
                color: '#06b6d4',
                textDecoration: 'underline'
              }}>{children}</a>,
            }}
          >
            {message.content}
          </ReactMarkdown>
          {message.isStreaming && <span className="streaming-cursor">█</span>}
        </div>
        <div className="message-time">
          {formatTimestamp(message.timestamp)}
        </div>
      </div>
      {isUser && (
        <div className="message-avatar user">👤</div>
      )}
    </div>
  );
}

export default DialogApp;




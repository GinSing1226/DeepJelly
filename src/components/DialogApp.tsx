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
import './DialogPanel/styles.css';

type ViewMode = 'list' | 'chat';

/**
 * 从 assistant 中提取 sessionKey
 * 后端返回的数据结构是 integrations[0].params.sessionKeys[0]
 */
function extractSessionKey(assistant: ReturnType<typeof useCharacterManagementStore.getState>['assistants'][number] | null): string | undefined {
  if (!assistant?.integrations) return undefined;

  const openclawIntegration = assistant.integrations.find(i => i.provider === 'openclaw');
  if (openclawIntegration?.params?.sessionKeys && Array.isArray(openclawIntegration.params.sessionKeys)) {
    return openclawIntegration.params.sessionKeys[0];
  }

  // Fallback to top-level sessionKey if exists (for backward compatibility)
  return (assistant as any)?.sessionKey;
}

export function DialogApp() {
  // 组件挂载日志
  console.log('[DialogApp] =======================================');
  console.log('[DialogApp] 📱 DialogApp Component MOUNTED');

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
  const currentAssistant = useCharacterManagementStore((s) => {
    const selectedId = s.selectedAssistantId;
    if (selectedId) {
      return s.assistants.find(a => a.id === selectedId) || null;
    }
    // 如果没有选中，使用第一个可用的 assistant
    if (s.assistants.length > 0) {
      console.log('[DialogApp] 🔍 Auto-selecting first assistant:', s.assistants[0]);
      return s.assistants[0];
    }
    console.log('[DialogApp] ⚠️ No assistants available');
    return null;
  });
  const assistants = useCharacterManagementStore((s) => s.assistants);
  const selectedAssistantId = useCharacterManagementStore((s) => s.selectedAssistantId);
  const isLoadingAssistants = useCharacterManagementStore((s) => s.isLoading);
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
    const extractedSessionKey = extractSessionKey(currentAssistant);
    console.log('[DialogApp] =======================================');
    console.log('[DialogApp] 📊 State Update:');
    console.log('[DialogApp]   isLoadingAssistants:', isLoadingAssistants);
    console.log('[DialogApp]   selectedAssistantId:', selectedAssistantId);
    console.log('[DialogApp]   assistants.length:', assistants.length);
    console.log('[DialogApp]   boundApp:', boundApp);
    console.log('[DialogApp]   boundApp.sessionKey:', boundApp?.sessionKey);
    console.log('[DialogApp]   currentAssistant:', currentAssistant);
    console.log('[DialogApp]   currentAssistant.sessionKey (top-level):', currentAssistant?.sessionKey);
    console.log('[DialogApp]   extracted sessionKey from integrations:', extractedSessionKey);
    console.log('[DialogApp]   connected:', connected);
    console.log('[DialogApp]   sessions:', sessions.length);
    console.log('[DialogApp]   currentSessionId:', currentSessionId);
    console.log('[DialogApp]   inputValue:', inputValue);
    console.log('[DialogApp]   inputValue.trim():', inputValue.trim());
    console.log('[DialogApp]   isSending:', isSending);
    const buttonDisabled = !connected || isSending || !inputValue.trim();
    console.log('[DialogApp]   buttonDisabled:', buttonDisabled, '(connected=' + connected + ', isSending=' + isSending + ', hasInput=' + !!inputValue.trim() + ')');
  }, [boundApp, currentAssistant, connected, sessions, currentSessionId, inputValue, isSending, selectedAssistantId, assistants.length, isLoadingAssistants]);

  // 主动查询连接状态（对话框窗口需要同步主窗口的连接状态）
  useEffect(() => {
    const checkConnection = async () => {
      try {
        const isConnected = await invoke<boolean>('is_brain_connected');
        console.log('[DialogApp] 🔍 Backend connection status:', isConnected);

        // 如果后端已连接，更新本地 store 状态
        if (isConnected && !connected) {
          console.log('[DialogApp] 🔄 Updating local store: connected = true');
          useBrainStore.setState({ connected: true });
        }
      } catch (error) {
        console.error('[DialogApp] ❌ Failed to check connection:', error);
      }
    };

    checkConnection();
  }, []); // 只在组件挂载时执行一次

  // Load assistants on mount (to get sessionKey)
  useEffect(() => {
    const loadAssistantsData = async () => {
      try {
        console.log('[DialogApp] 📜 Loading assistants data...');
        await useCharacterManagementStore.getState().loadAssistants();
        console.log('[DialogApp] ✅ Assistants data loaded');
      } catch (error) {
        console.error('[DialogApp] ❌ Failed to load assistants:', error);
      }
    };

    loadAssistantsData();
  }, []); // 只在组件挂载时执行一次

  // Load session history when dialog opens or when connection is established
  useEffect(() => {
    const loadHistory = async () => {
      // 如果 assistants 还在加载中，等待
      if (isLoadingAssistants) {
        console.log('[DialogApp] ⏳ Assistants still loading, waiting...');
        return;
      }

      // 优先使用 currentAssistant（从 integrations 提取），如果没有则回退到 boundApp.sessionKey
      const sessionKey = extractSessionKey(currentAssistant) || boundApp?.sessionKey;
      const assistantName = currentAssistant?.name || boundApp?.assistantName || 'Assistant';

      if (!sessionKey) {
        console.log('[DialogApp] ⚠️ No sessionKey found (checked currentAssistant and boundApp), skipping history load');
        return;
      }

      if (!connected) {
        console.log('[DialogApp] ⚠️ Not connected, will retry when connected');
        return;
      }

      // Check if session already exists
      const existingSession = sessions.find(s => s.assistantId === sessionKey);
      if (existingSession) {
        console.log('[DialogApp] ℹ️ Session already exists, skipping load');
        return;
      }

      try {
        console.log('[DialogApp] 📜 Loading session history for:', sessionKey);
        setLoading(true);

        // Reset pagination state
        setLoadedCount(0);
        setHasMore(true);

        // Get history from brain store (load 50 initially)
        const getSessionHistory = useBrainStore.getState().getSessionHistory;
        const historyMessages = await getSessionHistory(sessionKey, 50, 0);

        console.log('[DialogApp] ✅ Loaded', historyMessages.length, 'messages from history (requested up to 50)');

        // If we got fewer messages than requested, there might be more on the server
        // or this is all the messages. Set hasMore based on whether we got a full batch.
        const gotFullBatch = historyMessages.length === 50;
        console.log('[DialogApp] 📊 Full batch received:', gotFullBatch, '-> hasMore =', gotFullBatch);

        // Create session with loaded messages
        const newSessionId = addSession({
          title: assistantName,
          assistantId: sessionKey,
          isGroup: false,
          assistantName: assistantName,
        });

        // Add all history messages to the session WITH timestamps
        for (const msg of historyMessages) {
          addMessage(newSessionId, {
            content: msg.content || '',
            sender: msg.role === 'user' ? 'user' : 'assistant',
            timestamp: msg.timestamp, // ✅ Pass timestamp from API
            isStreaming: false,
          });
        }

        // Update pagination state
        setLoadedCount(historyMessages.length);
        setHasMore(gotFullBatch); // If loaded a full batch, there might be more

        console.log('[DialogApp] ✅ Session created with history:', newSessionId);
        console.log('[DialogApp] 📊 Pagination: loadedCount=', historyMessages.length, 'hasMore=', gotFullBatch);
      } catch (error) {
        console.error('[DialogApp] ❌ Failed to load session history:', error);
      } finally {
        setLoading(false);
        setIsInitialLoading(false);
      }
    };

    loadHistory();
  }, [currentAssistant?.id, boundApp?.sessionKey, connected, assistants.length, selectedAssistantId, isLoadingAssistants]); // Re-run when connected changes to true or when assistants are loaded

  // Listen for CAP messages from backend (Rust emits 'cap:message')
  // Note: Only register once, use ref to get latest currentSessionId
  useEffect(() => {
    console.log('[DialogApp] =======================================');
    console.log('[DialogApp] 🎧 Registering cap:message listener...');
    const unlistenPromise = listen<any>('cap:message', (event) => {
      console.log('[DialogApp] =======================================');
      console.log('[DialogApp] 📨 Received cap:message event!');
      console.log('[DialogApp]   event.payload:', JSON.stringify(event.payload, null, 2));
      const capMessage = event.payload;

      // Parse CAP message - extract session message content
      if (capMessage.type === 'session' && capMessage.payload?.message) {
        const msgPayload = capMessage.payload.message;
        const content = msgPayload.content || '';
        const sender = msgPayload.role === 'user' ? 'user' : 'assistant';

        // Get the current session ID from store (not from closure)
        const sessionId = useSessionStore.getState().currentSessionId;
        console.log('[DialogApp] ✅ Parsed CAP message:', { content, sender, sessionId });

        // Add message to current session
        if (sessionId && content) {
          console.log('[DialogApp] 📝 Adding message to session:', sessionId);
          addMessage(sessionId, {
            content,
            sender,
            isStreaming: false,
          });
          console.log('[DialogApp] ✅ Message added');
        } else {
          console.log('[DialogApp] ⚠️ Cannot add message:', { hasSessionId: !!sessionId, hasContent: !!content });
        }
      } else {
        console.log('[DialogApp] ⚠️ CAP message is not session type or missing message:', {
          type: capMessage.type,
          hasPayload: !!capMessage.payload,
          hasMessage: !!capMessage.payload?.message
        });
      }
    });

    unlistenPromise.then(() => {
      console.log('[DialogApp] ✅ cap:message listener registered successfully');
    }).catch((e) => {
      console.error('[DialogApp] ❌ Failed to register cap:message listener:', e);
    });

    return () => {
      console.log('[DialogApp] 🛑 Unregistering cap:message listener...');
      unlistenPromise.then((fn) => fn());
    };
  }, []); // Empty dependency array - only register once

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
    console.log('[DialogApp] =======================================');
    console.log('[DialogApp] 🔄 Refresh button clicked (incremental mode)');

    // 优先使用 currentAssistant（从 integrations 提取），如果没有则回退到 boundApp.sessionKey
    const sessionKey = extractSessionKey(currentAssistant) || boundApp?.sessionKey;
    if (!sessionKey) {
      console.log('[DialogApp] ⚠️ No sessionKey, skipping refresh');
      return;
    }

    if (!connected) {
      console.log('[DialogApp] ⚠️ Not connected, cannot refresh');
      return;
    }

    try {
      console.log('[DialogApp] 📜 Refreshing session history for:', sessionKey);
      setLoading(true);

      // Find existing session
      const existingSession = sessions.find(s => s.assistantId === sessionKey);
      if (!existingSession) {
        console.log('[DialogApp] ℹ️ No session exists yet, will create new one');
        setLoading(false);
        return;
      }

      const getSessionHistory = useBrainStore.getState().getSessionHistory;
      const localMessages = messagesBySession[existingSession.id] || [];
      const localLatestMsg = localMessages.length > 0 ? localMessages[localMessages.length - 1] : null;

      console.log('[DialogApp] 📊 Local messages:', localMessages.length, 'latest timestamp:', localLatestMsg?.timestamp || 'none');

      // Step 1: Get remote latest message to compare
      const remoteLatestBatch = await getSessionHistory(sessionKey, 1, 0);
      const remoteLatestMsg = remoteLatestBatch.length > 0 ? remoteLatestBatch[0] : null;

      if (!remoteLatestMsg) {
        console.log('[DialogApp] ℹ️ No remote messages found');
        setLoading(false);
        return;
      }

      console.log('[DialogApp] 📊 Remote latest timestamp:', remoteLatestMsg.timestamp);

      // Step 2: Compare and decide sync strategy
      const localLatestTime = localLatestMsg?.timestamp || 0;
      const remoteLatestTime = remoteLatestMsg.timestamp || 0;
      const timeDiff = remoteLatestTime - localLatestTime;

      console.log('[DialogApp] ⏱️ Time difference:', timeDiff, 'ms (', Math.round(timeDiff / 1000), 's)');
      console.log('[DialogApp] 📊 Local message count:', localMessages.length);

      // Strategy 1: Full refresh if local is empty, too old (> 1 hour diff), or suspiciously small (< 10 messages)
      // This handles the case where initial load didn't get all messages
      if (!localLatestMsg || timeDiff > 3600000 || localMessages.length < 10) {
        console.log('[DialogApp] 🔄 Full refresh needed (local empty or too old)');

        // Reset pagination state
        setLoadedCount(0);
        setHasMore(true);

        // Clear and reload
        const { clearMessages } = useSessionStore.getState();
        clearMessages(existingSession.id);

        const historyMessages = await getSessionHistory(sessionKey, 50, 0);
        console.log('[DialogApp] ✅ Loaded', historyMessages.length, 'messages from history');

        for (const msg of historyMessages) {
          addMessage(existingSession.id, {
            content: msg.content || '',
            sender: msg.role === 'user' ? 'user' : 'assistant',
            timestamp: msg.timestamp,
            isStreaming: false,
          });
        }

        setLoadedCount(historyMessages.length);
        setHasMore(historyMessages.length === 50);

        console.log('[DialogApp] ✅ Full refresh complete');
      } else if (remoteLatestTime > localLatestTime) {
        // Strategy 2: Incremental sync - only fetch new messages
        console.log('[DialogApp] ➕ Incremental sync - fetching new messages only');

        // Estimate how many new messages to fetch
        // Fetch slightly more to be safe (max 20 at a time for refresh)
        const fetchLimit = Math.min(20, Math.max(5, Math.ceil(timeDiff / 60000))); // 1 msg per minute estimate

        console.log('[DialogApp] 📜 Fetching up to', fetchLimit, 'messages to check for new ones');

        const newMessagesBatch = await getSessionHistory(sessionKey, fetchLimit, 0);

        // Filter messages that are newer than local latest
        const trulyNewMessages = newMessagesBatch.filter(msg => (msg.timestamp || 0) > localLatestTime);

        console.log('[DialogApp] ✅ Found', trulyNewMessages.length, 'new messages to add');

        // Add new messages (they will be sorted by timestamp automatically)
        for (const msg of trulyNewMessages) {
          addMessage(existingSession.id, {
            content: msg.content || '',
            sender: msg.role === 'user' ? 'user' : 'assistant',
            timestamp: msg.timestamp,
            isStreaming: false,
          });
        }

        console.log('[DialogApp] ✅ Incremental sync complete');
      } else {
        console.log('[DialogApp] ✅ Already up to date, no refresh needed');
      }

      console.log('[DialogApp] ✅ Session refresh complete');
      console.log('[DialogApp] 📊 Final message count:', messagesBySession[existingSession.id]?.length || 0);
    } catch (error) {
      console.error('[DialogApp] ❌ Failed to refresh session history:', error);
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
    console.log('[DialogApp.tsx] =======================================');
    console.log('[DialogApp.tsx] 📤 handleSendMessage called');
    console.log('[DialogApp.tsx]   inputValue:', inputValue);
    console.log('[DialogApp.tsx]   inputValue.trim():', inputValue.trim());
    console.log('[DialogApp.tsx]   currentSessionId:', currentSessionId);
    console.log('[DialogApp.tsx]   connected:', connected);
    console.log('[DialogApp.tsx]   isSending:', isSending);

    if (!inputValue.trim() || !currentSessionId || isSending) {
      console.log('[DialogApp.tsx] ⚠️ Early return:', {
        hasInput: !!inputValue.trim(),
        hasSessionId: !!currentSessionId,
        isSending
      });
      return;
    }

    const content = inputValue.trim();
    console.log('[DialogApp.tsx] ✅ Passed validation, proceeding to send');
    setInputValue('');

    // Add user message immediately
    addMessage(currentSessionId, {
      content,
      sender: 'user',
    });

    if (!connected) {
      console.log('[DialogApp.tsx] ⚠️ Not connected, showing offline message');
      // Show offline message
      setTimeout(() => {
        addMessage(currentSessionId, {
          content: t('dialog:disconnected'),
          sender: 'system',
        });
      }, 500);
      return;
    }

    try {
      setSending(true);
      console.log('[DialogApp.tsx] 📡 Calling invoke send_message...');

      // Add streaming placeholder for assistant response
      const assistantMsgId = addMessage(currentSessionId, {
        content: '',
        sender: 'assistant',
        isStreaming: true,
      });

      // Send message to backend
      // 优先使用 currentAssistant（从 integrations 提取），如果没有则回退到 boundApp.sessionKey
      const sessionKeyToSend = extractSessionKey(currentAssistant) || boundApp?.sessionKey;
      if (!sessionKeyToSend) {
        throw new Error('No session key available');
      }
      console.log('[DialogApp.tsx] 📤 Sending message to session:', sessionKeyToSend);
      console.log('[DialogApp.tsx]   content:', content);
      // Tauri v2 uses camelCase for command parameters
      const params = { sessionId: sessionKeyToSend, content };
      console.log('[DialogApp.tsx]   params:', JSON.stringify(params));
      await invoke('send_message', params);
      console.log('[DialogApp.tsx] ✅ Message sent successfully');

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
      });
    } finally {
      setSending(false);
    }
  }, [inputValue, currentSessionId, isSending, connected, currentSession, addMessage, updateMessage, setSending, t]);

  // Handle keyboard events
  const handleKeyDown = (e: React.KeyboardEvent) => {
    console.log('[DialogApp.tsx] KeyDown event:', e.key);
    if (e.key === 'Enter' && !e.shiftKey) {
      console.log('[DialogApp.tsx] Enter detected, calling handleSendMessage');
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Handle input change
  const handleInputChange = (value: string) => {
    console.log('[DialogApp.tsx] Input changed:', value);
    setInputValue(value);
  };

  // Handle send button click
  const handleSendButtonClick = () => {
    console.log('[DialogApp.tsx] Send button clicked!');
    handleSendMessage();
  };

  // Handle load more messages
  const handleLoadMore = useCallback(async () => {
    // 优先使用 currentAssistant（从 integrations 提取），如果没有则回退到 boundApp.sessionKey
    const sessionKey = extractSessionKey(currentAssistant) || boundApp?.sessionKey;
    if (!sessionKey || !currentSessionId || isLoadingMore || !hasMore) {
      console.log('[DialogApp] ⚠️ Cannot load more:', { hasSessionKey: !!sessionKey, hasCurrentSessionId: !!currentSessionId, isLoadingMore, hasMore });
      return;
    }

    console.log('[DialogApp] 📜 Loading more messages, offset:', loadedCount);
    setIsLoadingMore(true);

    try {
      const getSessionHistory = useBrainStore.getState().getSessionHistory;
      const historyMessages = await getSessionHistory(sessionKey, 50, loadedCount);

      console.log('[DialogApp] ✅ Loaded', historyMessages.length, 'more messages');

      // Add messages WITH timestamps
      for (const msg of historyMessages) {
        addMessage(currentSessionId, {
          content: msg.content || '',
          sender: msg.role === 'user' ? 'user' : 'assistant',
          timestamp: msg.timestamp, // ✅ Pass timestamp from API
          isStreaming: false,
        });
      }

      // Update pagination state
      setLoadedCount(prev => prev + historyMessages.length);
      setHasMore(historyMessages.length === 50);

      console.log('[DialogApp] 📊 Updated pagination: loadedCount=', loadedCount + historyMessages.length, 'hasMore=', historyMessages.length === 50);
    } catch (error) {
      console.error('[DialogApp] ❌ Failed to load more messages:', error);
    } finally {
      setIsLoadingMore(false);
    }
  }, [boundApp, currentSessionId, loadedCount, isLoadingMore, hasMore, addMessage]);

  // Handle window close
  const handleClose = useCallback(async () => {
    console.log('[DialogApp] handleClose called');
    const start = Date.now();

    // 标记对话框为用户主动关闭
    useSettingsStore.getState().setDialogExplicitlyClosed(true);

    try {
      console.log('[DialogApp] Calling close_dialog_window command...');
      const invokeStart = Date.now();
      await invoke('close_dialog_window');
      console.log(`[DialogApp] close_dialog_window took ${Date.now() - invokeStart}ms`);
    } catch (error) {
      console.error('[DialogApp] Failed to close dialog window via command:', error);
      // Fallback: close window via Tauri API
      console.log('[DialogApp] Trying fallback: getCurrentWindow().close()');
      const fallbackStart = Date.now();
      const window = getCurrentWindow();
      await window.close();
      console.log(`[DialogApp] Fallback close took ${Date.now() - fallbackStart}ms`);
    }

    console.log(`[DialogApp] handleClose total: ${Date.now() - start}ms`);
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
  onCreateSession,
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
  loadedCount,
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
      console.log('[ChatView] 🚀 First chat entry, jumping to bottom');
      container.scrollTop = container.scrollHeight;
      onScrollComplete(); // Mark first entry as complete
      previousMessageCount.current = messageCount;
      return;
    }

    // New message arrived: smooth scroll to bottom
    if (messageCount > previousMessageCount.current) {
      console.log('[ChatView] 📜 New message arrived, smooth scrolling');
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
        console.log('[ChatView] 📜 Scrolled to top, loading more...');
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
            console.log('[DialogApp.tsx] Textarea onChange, value:', e.target.value);
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
            console.log('[DialogApp.tsx] Send button onClick fired!');
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
              code: ({ inline, children }) => inline
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




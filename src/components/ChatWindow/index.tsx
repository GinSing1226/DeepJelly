/**
 * ChatWindow Component
 *
 * Main entry point for the ChatWindow feature module.
 * Manages view switching and common operations.
 *
 * PERFORMANCE OPTIMIZED:
 * - Initial load: only 10 sessions with 10 messages each
 * - Lazy loading: triggered by scroll, not automatic
 * - Caching: avoids duplicate requests
 */

import { useEffect, useCallback, useState, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { useSessionStore } from '@/stores/sessionStore';
import { useBrainStore } from '@/stores/brainStore';
import { useCharacterManagementStore } from '@/stores/characterManagementStore';
import { useIntegrationStore } from '@/stores/integrationStore';
import { useChatWindow } from './shared/hooks';
import SessionList from './SessionList';
import Conversation from './Conversation';
import SearchView from './Search';
import { getAgentId } from '@/utils/assistantHelper';
import { DEFAULTS } from './shared/constants';
import type { Session } from './shared/types';
import { useDevToolsShortcut } from '@/hooks/useDevToolsShortcut';
import '@/styles/design-system.css';
import './ChatWindow.css';

function ChatWindow() {
  // Enable F12 shortcut for DevTools
  useDevToolsShortcut();
  // Component mount log
  // Log initial connection state immediately
  // Use chat window hook
  const {
    viewMode,
    handleClose,
    handleMinimize,
    handleHeaderMouseDown,
    goToList,
    toConversation,
    markInitialLoadComplete,
  } = useChatWindow();

  // Store state
  const sessions = useSessionStore((s) => s.sessions);
  const messagesBySession = useSessionStore((s) => s.messagesBySession);
  const currentSessionId = useSessionStore((s) => s.currentSessionId);
  const setCurrentSession = useSessionStore.getState().setCurrentSession;
  const connected = useBrainStore((s) => s.connected);

  // Pagination state for sessions
  const [sessionPagination, setSessionPagination] = useState({
    loadedCount: 0,
    hasMore: false,
    isLoading: false,
  });

  // Track loaded sessions for caching
  const loadedSessionsRef = useRef<Set<string>>(new Set());
  const isInitialLoadRef = useRef(true);
  const wasConnectedRef = useRef(false); // Track previous connection state

  // Assistant state
  const assistants = useCharacterManagementStore((s) => s.assistants);
  const selectedAssistantId = useCharacterManagementStore((s) => s.selectedAssistantId);

  // Integration state - get all integrated agentIds
  const characterIntegrations = useIntegrationStore((s) => s.characterIntegrations);
  const integratedAgentIds = useRef<Set<string>>(new Set());

  // Update integrated agentIds when characterIntegrations change
  useEffect(() => {
    integratedAgentIds.current = new Set(
      characterIntegrations
        .filter(binding => binding.enabled)
        .map(binding => binding.integration.agentId.toLowerCase())
    );
  }, [characterIntegrations]);

  // Get current assistant
  const currentAssistant = selectedAssistantId
    ? assistants.find(a => a.id === selectedAssistantId)
    : assistants[0] || null;

  // Get current session
  const currentSession: Session | undefined = sessions.find(s => s.id === currentSessionId);

  /**
   * Get agent ID from current assistant
   */
  const getCurrentAgentId = useCallback(() => {
    if (!currentAssistant?.integrations) return null;
    return getAgentId(currentAssistant.integrations);
  }, [currentAssistant]);

  /**
   * Get character name by agentId from character integrations
   * This ensures sessions show their actual character names, not just the current assistant
   */
  const getCharacterNameByAgentId = useCallback((agentId: string): string => {
    const binding = characterIntegrations.find(b =>
      b.enabled && b.integration.agentId.toLowerCase() === agentId.toLowerCase()
    );
    return binding?.characterName || binding?.assistantName || agentId;
  }, [characterIntegrations]);

  /**
   * Check connection status on mount and periodically sync
   * This ensures the local store stays in sync with the backend connection state
   */
  useEffect(() => {
    let checkInterval: NodeJS.Timeout | null = null;

    const checkConnection = async () => {
      try {
        const isConnected = await invoke<boolean>('is_brain_connected');
        const currentConnected = useBrainStore.getState().connected;
        if (isConnected && !currentConnected) {
          useBrainStore.setState({ connected: true });
        } else if (!isConnected && currentConnected) {
          useBrainStore.setState({ connected: false });
        }
      } catch (error) {
        console.error('[ChatWindow] Failed to check connection:', error);
      }
    };

    // Check immediately on mount
    checkConnection();

    // Then check every 2 seconds to stay in sync
    checkInterval = setInterval(checkConnection, 2000);

    return () => {
      if (checkInterval) clearInterval(checkInterval);
    };
  }, []);

  /**
   * Load assistants on mount
   */
  useEffect(() => {
    const loadAssistantsData = async () => {
      try {
        await useCharacterManagementStore.getState().loadAssistants();
      } catch (error) {
        console.error('[ChatWindow] Failed to load assistants:', error);
      }
    };

    loadAssistantsData();
  }, [assistants.length]);

  /**
   * Load character integrations on mount
   */
  useEffect(() => {
    const loadIntegrationsData = async () => {
      try {
        await useIntegrationStore.getState().loadCharacterIntegrations();
      } catch (error) {
        console.error('[ChatWindow] Failed to load character integrations:', error);
      }
    };

    loadIntegrationsData();
  }, []);

  /**
   * Load sessions with pagination - PERFORMANCE OPTIMIZED
   */
  useEffect(() => {
    const loadSessionsPaginated = async () => {
      // Check if connection state just changed from disconnected to connected
      const justConnected = !wasConnectedRef.current && connected;
      if (justConnected) {
        wasConnectedRef.current = true;
      }

      // Skip if not connected
      if (!connected) {
        return;
      }

      // Skip if we already have sessions loaded and this is not initial load AND connection didn't just change
      if (!isInitialLoadRef.current && sessions.length > 0 && !justConnected) {
        return;
      }

      // Log current assistant info
      // Try to get agent ID from assistant, but don't skip if not available
      try {
        setSessionPagination(prev => ({ ...prev, isLoading: true }));

        const getAllSessions = useBrainStore.getState().getAllSessions;
        const addSession = useSessionStore.getState().addSession;
        const addMessage = useSessionStore.getState().addMessage;
        const getSessionHistory = useBrainStore.getState().getSessionHistory;

        // Get ALL sessions from backend (not filtered by agent)
        // Limit to INITIAL_SESSION_LIMIT for performance
        const sessionInfos = await getAllSessions(DEFAULTS.INITIAL_SESSION_LIMIT);
        // Log current integrated agentIds for debugging
        // Temporary fallback: Show warning if no agents are integrated
        if (integratedAgentIds.current.size === 0) {
          console.warn('[ChatWindow] ⚠️ No integrated agents found - showing ALL sessions (fallback mode)');
        }

        // Process each session
        let processedCount = 0;
        let skippedCount = 0;
        for (const sessionInfo of sessionInfos) {
          const sKey = sessionInfo.sessionKey || sessionInfo.key;
          
          if (!sKey) {
            console.warn('[ChatWindow] Session missing sessionKey/key:', sessionInfo);
            continue;
          }

          // Extract agentId from sessionKey for filtering
          const parts = sKey.split(':');
          const sessionAgentId = parts.length >= 2 ? parts[1] : null;
          // Skip sessions without an agentId
          if (!sessionAgentId) {
            skippedCount++;
            continue;
          }

          // Only process sessions from integrated agents (those in character_integrations.json)
          // TEMPORARY FALLBACK: If no agents are integrated yet, show all sessions
          const hasAnyIntegrations = integratedAgentIds.current.size > 0;
          const sessionAgentIdLower = sessionAgentId.toLowerCase();
          if (hasAnyIntegrations && !integratedAgentIds.current.has(sessionAgentIdLower)) {
            skippedCount++;
            continue;
          }

          // NOTE: We DON'T filter by agentId here - the session list should show ALL sessions
          // from ALL integrated characters. Users can filter by character if needed in the UI.

          // Check if already loaded
          if (loadedSessionsRef.current.has(sKey)) {
            skippedCount++;
            continue;
          }

          // Mark as loaded
          loadedSessionsRef.current.add(sKey);
          processedCount++;

          // Generate a friendly name for the session
          const sessionAgentIdOrUnknown = sessionAgentId || 'unknown';
          const displayName = sessionInfo.displayName || sessionInfo.label || sessionAgentIdOrUnknown;

          // Get the actual character name for this session (from characterIntegrations)
          const characterName = getCharacterNameByAgentId(sessionAgentId);
          // Use character name as assistantName, fallback to displayName
          const assistantName = characterName || displayName;
          // Check if session already exists in store
          const existingSession = sessions.find(s => s.assistantId === sKey);
          const existingMessages = existingSession ? (messagesBySession[existingSession.id] || []) : [];

          let sessionId = existingSession?.id;

          // Create session if it doesn't exist
          if (!sessionId) {
            // Create new session
            sessionId = addSession({
              title: displayName,
              assistantId: sKey,  // CRITICAL: This stores the sessionKey (e.g., "agent:christina:main")
              isGroup: sessionInfo.kind === 'group' || false,
              assistantName: assistantName,  // Use the character name we computed
              lastMessage: sessionInfo.messages?.[0]?.content,
              lastMessageTime: sessionInfo.updatedAt || sessionInfo.createdAt || Date.now(),
            });
          } else {
          }

          // Load initial messages if session has no messages (new or empty session)
          if (existingMessages.length === 0) {
            try {
              const allMessages: Array<{content: string, sender: 'user' | 'assistant', timestamp: number}> = [];

              // First, load local messages (most recent)
              try {
                const localMessages = await invoke<any[]>('get_local_messages', { sessionKey: sKey });
                for (const msg of localMessages) {
                  allMessages.push({
                    content: msg.content,
                    sender: msg.sender,
                    timestamp: msg.timestamp,
                  });
                }
              } catch (error) {
              }

              // Then, load backend messages
              const historyMessages = await getSessionHistory(sKey, DEFAULTS.INITIAL_MESSAGE_LIMIT, 0);
              for (const msg of historyMessages) {
                allMessages.push({
                  content: msg.content || '',
                  sender: msg.role === 'user' ? 'user' : 'assistant',
                  timestamp: msg.timestamp || Date.now(),
                });
              }

              // Merge and deduplicate by timestamp
              const mergedMessages = Array.from(
                new Map(allMessages.map(m => [m.timestamp, m])).values()
              ).sort((a, b) => a.timestamp - b.timestamp);
              // Add merged messages to store
              for (const msg of mergedMessages) {
                addMessage(sessionId, {
                  content: msg.content,
                  sender: msg.sender,
                  timestamp: msg.timestamp,
                  isStreaming: false,
                });
              }
            } catch (error) {
              console.error(`[ChatWindow] Failed to load messages for ${sKey}:`, error);
            }
          } else {
          }
        }
        // Update pagination state
        setSessionPagination(prev => ({
          ...prev,
          loadedCount: sessionInfos.length,
          hasMore: sessionInfos.length >= DEFAULTS.INITIAL_SESSION_LIMIT,
          isLoading: false,
        }));
        markInitialLoadComplete();
      } catch (error) {
        console.error('[ChatWindow] Failed to load sessions:', error);
        setSessionPagination(prev => ({ ...prev, isLoading: false }));
        markInitialLoadComplete();
      }

      // Update connection ref after load attempt
      wasConnectedRef.current = connected;
    };

    loadSessionsPaginated();
  }, [
    connected,
    currentAssistant,
    getCurrentAgentId,
    markInitialLoadComplete,
    characterIntegrations,  // Re-load when integrations change
  ]);

  /**
   * Load more sessions when scrolling to bottom of list
   * Note: getAgentSessions returns all sessions at once, so this is a no-op
   */
  const onLoadMoreSessions = useCallback(async () => {
    // getAgentSessions returns all sessions for the agent, so no pagination needed
    return;
  }, []);

  /**
   * Listen for CAP messages
   * Only add messages to sessions that match the sessionKey
   */
  useEffect(() => {
    const unlistenPromise = listen<any>('cap:message', (event) => {
      const capMessage = event.payload;


      if (capMessage.type === 'session' && capMessage.payload?.message) {
        const msgPayload = capMessage.payload.message;
        const content = msgPayload.content || '';
        const sender = msgPayload.role === 'user' ? 'user' : 'assistant';
        const capSessionId = capMessage.payload?.session_id;

        // Get all sessions to find matching one
        const allSessions = useSessionStore.getState().sessions;

        

        // Also log the sender.routing.sessionKey if available
        const senderSessionKey = capMessage.sender?.routing?.sessionKey;
        // Find the session that matches this CAP message's sessionKey
        // Note: session.assistantId stores the sessionKey (e.g., "agent:christina:main")
        let targetSession = allSessions.find(s => s.assistantId === capSessionId);

        // Fallback: try sender.routing.sessionKey if payload.session_id didn't match
        if (!targetSession && senderSessionKey && senderSessionKey !== capSessionId) {
          targetSession = allSessions.find(s => s.assistantId === senderSessionKey);
        }

        if (targetSession && content) {
          const addMessage = useSessionStore.getState().addMessage;
          const timestamp = Date.now();
          const msgId = addMessage(targetSession.id, {
            content,
            sender: sender as 'user' | 'assistant' | 'system',
            timestamp,
            isStreaming: false,
          });

          // Save received message to local storage
          const sessionKey = targetSession.assistantId;
          invoke('save_local_message', {
            sessionKey,
            message: {
              id: msgId,
              content,
              sender,
              timestamp,
              isStreaming: false,
            },
          }).catch(err => console.error('[ChatWindow] Failed to save message locally:', err));
        } else {

        }
      }
    });

    return () => {
      unlistenPromise.then(fn => fn()).catch(console.error);
    };
  }, []);

  /**
   * Handle session selection
   * Loads messages if session is empty
   * Loads from local storage first, then backend
   */
  const handleSelectSession = useCallback(async (sessionId: string) => {
    // Check if session has messages, load if empty
    const sessionMessages = messagesBySession[sessionId] || [];
    if (sessionMessages.length === 0) {
      // Find the session to get its sessionKey
      const targetSession = sessions.find(s => s.id === sessionId);
      if (targetSession?.assistantId) {
        const sessionKey = targetSession.assistantId;
        try {
          const addMessage = useSessionStore.getState().addMessage;
          const allMessages: Array<{content: string, sender: 'user' | 'assistant', timestamp: number}> = [];

          // First, load local messages (most recent)
          try {
            const localMessages = await invoke<any[]>('get_local_messages', { sessionKey });
            for (const msg of localMessages) {
              allMessages.push({
                content: msg.content,
                sender: msg.sender,
                timestamp: msg.timestamp,
              });
            }
          } catch (error) {
          }

          // Then, load backend messages
          const historyMessages = await useBrainStore.getState().getSessionHistory(sessionKey, DEFAULTS.INITIAL_MESSAGE_LIMIT, 0);
          for (const msg of historyMessages) {
            allMessages.push({
              content: msg.content || '',
              sender: msg.role === 'user' ? 'user' : 'assistant',
              timestamp: msg.timestamp || Date.now(),
            });
          }

          // Merge and deduplicate by timestamp
          const mergedMessages = Array.from(
            new Map(allMessages.map(m => [m.timestamp, m])).values()
          ).sort((a, b) => a.timestamp - b.timestamp);
          // Add merged messages to store
          for (const msg of mergedMessages) {
            addMessage(sessionId, {
              content: msg.content,
              sender: msg.sender,
              timestamp: msg.timestamp,
              isStreaming: false,
            });
          }
        } catch (error) {
          console.error('[ChatWindow] Failed to load messages for session:', error);
        }
      }
    }

    setCurrentSession(sessionId);
    toConversation();
  }, [sessions, messagesBySession, setCurrentSession, toConversation]);

  /**
   * Handle session edit
   */
  const handleEditSession = useCallback((_sessionId: string) => {
    // TODO: Implement edit session dialog
  }, []);

  /**
   * Handle session delete
   */
  const handleDeleteSession = useCallback((_sessionId: string) => {
    // TODO: Implement delete confirmation
  }, []);

  return (
    <div className="chat-window">
      {viewMode === 'list' && (
        <SessionList
          onSelectSession={handleSelectSession}
          onEditSession={handleEditSession}
          onDeleteSession={handleDeleteSession}
          onLoadMoreSessions={onLoadMoreSessions}
          hasMoreSessions={sessionPagination.hasMore}
          isLoadingSessions={sessionPagination.isLoading}
          onClose={handleClose}
          onMinimize={handleMinimize}
          onHeaderMouseDown={handleHeaderMouseDown}
        />
      )}

      {viewMode === 'conversation' && (
        <Conversation
          session={currentSession}
          onBack={goToList}
          onClose={handleClose}
          onMinimize={handleMinimize}
          onHeaderMouseDown={handleHeaderMouseDown}
        />
      )}

      {viewMode === 'search' && (
        <SearchView
          onSelectSession={handleSelectSession}
          onBack={goToList}
          onClose={handleClose}
          onMinimize={handleMinimize}
          onHeaderMouseDown={handleHeaderMouseDown}
        />
      )}
    </div>
  );
}

export default ChatWindow;

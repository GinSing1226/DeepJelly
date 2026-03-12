/**
 * useMessages Hook
 *
 * Hook for managing message operations including sending and streaming.
 */

import { useCallback, useRef, useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useTranslation } from 'react-i18next';
import { useSessionStore } from '@/stores/sessionStore';
import { useBrainStore } from '@/stores/brainStore';
import { DEFAULTS } from '../constants';
import type { StreamingState } from '../types';

export function useMessages(sessionId: string | null) {
  const { t } = useTranslation(['dialog', 'common', 'error']);
  const messagesBySession = useSessionStore((s) => s.messagesBySession);
  const sessions = useSessionStore((s) => s.sessions);
  const isSending = useSessionStore((s) => s.isSending);
  const connected = useBrainStore((s) => s.connected);

  // Get the current session to access its assistantId (which contains the sessionKey)
  const currentSession = sessionId ? sessions.find(s => s.id === sessionId) : null;
  // session.assistantId stores the sessionKey (e.g., "agent:christina:main")
  const sessionKey = currentSession?.assistantId;

  // Streaming state
  const [streaming, setStreaming] = useState<StreamingState>({
    isStreaming: false,
    content: '',
  });

  // Track loaded message IDs to prevent duplicates
  const loadedMessageIdsRef = useRef<Set<string>>(new Set());

  // Store actions
  const addMessage = useSessionStore.getState().addMessage;
  const updateMessage = useSessionStore.getState().updateMessage;
  const setSending = useSessionStore.getState().setSending;

  // Current messages for the session
  const messages = sessionId ? (messagesBySession[sessionId] || []) : [];

  // Reset loaded message IDs when session changes
  useEffect(() => {
    if (sessionId) {
      loadedMessageIdsRef.current = new Set(messages.map(m => m.id));
    }
  }, [sessionId, messages]);

  /**
   * Save a message to local storage
   */
  const saveMessageLocally = useCallback(async (msgId: string, content: string, sender: 'user' | 'assistant' | 'system', timestamp: number) => {
    if (!sessionKey) return;

    try {
      await invoke('save_local_message', {
        sessionKey,
        message: {
          id: msgId,
          content,
          sender,
          timestamp,
          isStreaming: false,
        },
      });
    } catch (error) {
      console.error('[useMessages] Failed to save message locally:', error);
    }
  }, [sessionKey]);

  /**
   * Send a message
   */
  const sendMessage = useCallback(async (content: string, _assistantIntegrations?: any[]) => {
    if (!content.trim() || !sessionId || isSending) {
      return;
    }

    const trimmedContent = content.trim();
    const timestamp = Date.now();

    // Add user message immediately
    const userMsgId = addMessage(sessionId, {
      content: trimmedContent,
      sender: 'user',
      timestamp,
    });

    // Save user message to local storage
    saveMessageLocally(userMsgId, trimmedContent, 'user', timestamp);

    if (!connected) {
      // Show disconnected message
      setTimeout(() => {
        const msgId = addMessage(sessionId, {
          content: t('dialog:disconnected'),
          sender: 'system',
          timestamp: Date.now(),
        });
        saveMessageLocally(msgId, t('dialog:disconnected'), 'system', Date.now());
      }, 500);
      return;
    }

    if (!sessionKey) {
      console.error('[useMessages] No sessionKey available for session:', sessionId);
      const msgId = addMessage(sessionId, {
        content: t('error:noSessionKey'),
        sender: 'system',
        timestamp: Date.now(),
      });
      saveMessageLocally(msgId, t('error:noSessionKey'), 'system', Date.now());
      return;
    }

    try {
      setSending(true);

      // Add streaming placeholder for assistant response
      const assistantMsgId = addMessage(sessionId, {
        content: '',
        sender: 'assistant',
        isStreaming: true,
        timestamp: Date.now(),
      });

      // Send message to backend using sessionKey from session.assistantId
      await invoke('send_message', {
        sessionId: sessionKey,
        content: trimmedContent,
      });

      // Start streaming state
      setStreaming({
        isStreaming: true,
        content: '',
        messageId: assistantMsgId,
      });

      // Update message to complete (in real implementation, this would be updated by streaming events)
      setTimeout(() => {
        updateMessage(sessionId, assistantMsgId, {
          content: t('dialog:responsePlaceholder'),
          isStreaming: false,
        });
        setStreaming({ isStreaming: false, content: '' });
        // Save assistant response to local storage when complete
        saveMessageLocally(assistantMsgId, t('dialog:responsePlaceholder'), 'assistant', Date.now());
      }, 1000);
    } catch (error) {
      console.error('[useMessages] Failed to send message:', error);
      const msgId = addMessage(sessionId, {
        content: t('sendMessageFailed', { error: String(error) }),
        sender: 'system',
        timestamp: Date.now(),
      });
      saveMessageLocally(msgId, t('sendMessageFailed', { error: String(error) }), 'system', Date.now());
      setStreaming({ isStreaming: false, content: '' });
    } finally {
      setSending(false);
    }
  }, [sessionId, isSending, connected, addMessage, setSending, updateMessage, t, saveMessageLocally]);

  /**
   * Load more messages (pagination)
   */
  const loadMoreMessages = useCallback(async (
    _assistantIntegrations?: any[],
    offset = 0,
    limit = DEFAULTS.LOAD_MORE_MESSAGE_LIMIT
  ) => {
    if (!sessionId) return [];
    if (!sessionKey) {
      console.warn('[useMessages] No sessionKey available for loading messages');
      return [];
    }

    try {
      const getSessionHistory = useBrainStore.getState().getSessionHistory;
      const historyMessages = await getSessionHistory(sessionKey, limit, offset);
      // Add only new messages to store (avoid duplicates)
      const newMessages: any[] = [];
      for (const msg of historyMessages) {
        // Generate a unique ID for the message based on timestamp and content
        const timestamp = msg.timestamp || Date.now();
        const msgId = `${timestamp}_${msg.content?.substring(0, 50) || ''}`;
        if (!loadedMessageIdsRef.current.has(msgId)) {
          loadedMessageIdsRef.current.add(msgId);
          addMessage(sessionId, {
            content: msg.content || '',
            sender: msg.role === 'user' ? 'user' : 'assistant',
            timestamp,
            isStreaming: false,
          });
          newMessages.push(msg);
        }
      }
      return newMessages;
    } catch (error) {
      console.error('[useMessages] Failed to load more messages:', error);
      return [];
    }
  }, [sessionId, addMessage]);

  /**
   * Update streaming message content
   */
  const updateStreamingContent = useCallback((content: string) => {
    if (streaming.messageId && sessionId) {
      updateMessage(sessionId, streaming.messageId, {
        content,
        isStreaming: true,
      });
      setStreaming(prev => ({ ...prev, content }));
    }
  }, [sessionId, streaming, updateMessage]);

  /**
   * Complete streaming message
   */
  const completeStreaming = useCallback((finalContent?: string) => {
    if (streaming.messageId && sessionId) {
      updateMessage(sessionId, streaming.messageId, {
        content: finalContent || streaming.content,
        isStreaming: false,
      });
      setStreaming({ isStreaming: false, content: '' });
    }
  }, [sessionId, streaming, updateMessage]);

  return {
    // State
    messages,
    isSending,
    connected,
    streaming,

    // Actions
    sendMessage,
    loadMoreMessages,
    updateStreamingContent,
    completeStreaming,
  };
}

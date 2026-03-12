/**
 * useSessions Hook
 *
 * Hook for managing session list operations including CRUD.
 */

import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useSessionStore } from '@/stores/sessionStore';
import { useBrainStore } from '@/stores/brainStore';
import type { Session } from '../types';

export function useSessions() {
  const { t } = useTranslation(['dialog', 'common']);
  const sessions = useSessionStore((s) => s.sessions);
  const isLoading = useSessionStore((s) => s.isLoading);
  const connected = useBrainStore((s) => s.connected);

  // Store actions
  const addSession = useSessionStore.getState().addSession;
  const updateSession = useSessionStore.getState().updateSession;
  const removeSession = useSessionStore.getState().removeSession;
  const setCurrentSession = useSessionStore.getState().setCurrentSession;
  const markAsRead = useSessionStore.getState().markAsRead;
  const setLoading = useSessionStore.getState().setLoading;

  /**
   * Filter sessions by search query
   */
  const filterSessions = useCallback((sessions: Session[], query: string) => {
    if (!query.trim()) return sessions;
    const lowerQuery = query.toLowerCase();
    return sessions.filter((session) =>
      session.title.toLowerCase().includes(lowerQuery) ||
      session.lastMessage?.toLowerCase().includes(lowerQuery)
    );
  }, []);

  /**
   * Sort sessions: unread first, then by last message time
   */
  const sortSessions = useCallback((sessions: Session[]) => {
    return [...sessions].sort((a, b) => {
      // Unread sessions first
      if (a.unreadCount > 0 && b.unreadCount === 0) return -1;
      if (a.unreadCount === 0 && b.unreadCount > 0) return 1;
      // Then by last message time (descending)
      return (b.lastMessageTime || 0) - (a.lastMessageTime || 0);
    });
  }, []);

  /**
   * Create a new session
   */
  const createSession = useCallback(async () => {
    try {
      setLoading(true);
      const newSessionId = addSession({
        title: t('dialog:newConversation'),
        isGroup: false,
        assistantName: 'Assistant',
      });
      return newSessionId;
    } catch (error) {
      console.error('[useSessions] Failed to create session:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [addSession, setLoading, t]);

  /**
   * Update session title
   */
  const updateSessionTitle = useCallback(async (sessionId: string, newTitle: string) => {
    try {
      updateSession(sessionId, { title: newTitle });
    } catch (error) {
      console.error('[useSessions] Failed to update session title:', error);
      throw error;
    }
  }, [updateSession]);

  /**
   * Delete a session
   */
  const deleteSession = useCallback(async (sessionId: string) => {
    try {
      removeSession(sessionId);
    } catch (error) {
      console.error('[useSessions] Failed to delete session:', error);
      throw error;
    }
  }, [removeSession]);

  /**
   * Select a session and mark as read
   */
  const selectSession = useCallback((sessionId: string) => {
    setCurrentSession(sessionId);
    markAsRead(sessionId);
  }, [setCurrentSession, markAsRead]);

  /**
   * Refresh all sessions from backend
   */
  const refreshSessions = useCallback(async () => {
    try {
      setLoading(true);
      const getAllSessions = useBrainStore.getState().getAllSessions;
      const allSessionInfos = await getAllSessions(100);

      // Update sessions in store
      // This is a simplified version - full implementation would sync with backend
      return allSessionInfos;
    } catch (error) {
      console.error('[useSessions] Failed to refresh sessions:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [setLoading]);

  return {
    // State
    sessions,
    isLoading,
    connected,

    // Actions
    filterSessions,
    sortSessions,
    createSession,
    updateSessionTitle,
    deleteSession,
    selectSession,
    refreshSessions,

    // Store getters
    addSession,
    updateSession,
    removeSession,
  };
}

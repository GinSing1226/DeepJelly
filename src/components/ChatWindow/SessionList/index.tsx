/**
 * SessionList Component
 *
 * Main session list view with search and filtering.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import SessionCard from './SessionCard';
import SessionCardSkeleton from './SessionCardSkeleton';
import { useSessions } from '../shared/hooks';
import { debounce } from '../shared/utils/format';
import { DEFAULTS } from '../shared/constants';
import type { Session } from '../shared/types';
import './SessionList.css';

interface SessionListProps {
  onSelectSession: (sessionId: string) => void;
  onEditSession?: (sessionId: string) => void;
  onDeleteSession?: (sessionId: string) => void;
  onCreateSession?: () => void;
  onRefreshSessions?: () => void;
  // Pagination callbacks for lazy loading
  onLoadMoreSessions?: () => void;
  hasMoreSessions?: boolean;
  isLoadingSessions?: boolean;
  // Window control callbacks
  onClose: () => void;
  onMinimize: () => void;
  onHeaderMouseDown: (e: React.MouseEvent) => void;
}

function SessionList({
  onSelectSession,
  onEditSession,
  onDeleteSession,
  onCreateSession,
  onRefreshSessions,
  onLoadMoreSessions,
  hasMoreSessions = false,
  isLoadingSessions = false,
  onClose,
  onMinimize,
  onHeaderMouseDown,
}: SessionListProps) {
  const { t } = useTranslation(['dialog', 'common']);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredSessions, setFilteredSessions] = useState<Session[]>([]);

  // Use sessions hook
  const {
    sessions,
    isLoading,
    connected,
    filterSessions,
    sortSessions,
    createSession,
    deleteSession,
    refreshSessions,
  } = useSessions();

  // Debounced search
  const debouncedSearch = useCallback(
    debounce((query: string) => {
      const filtered = filterSessions(sessions, query);
      const sorted = sortSessions(filtered);
      setFilteredSessions(sorted);
    }, DEFAULTS.SEARCH_DEBOUNCE_MS),
    [sessions, filterSessions, sortSessions]
  );

  // Update filtered sessions when sessions or search query changes
  useEffect(() => {
    debouncedSearch(searchQuery);
  }, [searchQuery, sessions, debouncedSearch]);

  /**
   * Handle search input change
   */
  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  }, []);

  /**
   * Handle session card click
   */
  const handleSessionClick = useCallback((sessionId: string) => {
    onSelectSession(sessionId);
  }, [onSelectSession]);

  /**
   * Handle create new session
   */
  const handleCreateSession = useCallback(async () => {
    try {
      const newSessionId = await createSession();
      onCreateSession?.();
      onSelectSession(newSessionId);
    } catch (error) {
      console.error('[SessionList] Failed to create session:', error);
    }
  }, [createSession, onCreateSession, onSelectSession]);

  /**
   * Handle refresh
   */
  const handleRefresh = useCallback(async () => {
    try {
      await refreshSessions();
      onRefreshSessions?.();
    } catch (error) {
      console.error('[SessionList] Failed to refresh sessions:', error);
    }
  }, [refreshSessions, onRefreshSessions]);

  /**
   * Handle edit session
   */
  const handleEditSession = useCallback((sessionId: string) => {
    onEditSession?.(sessionId);
  }, [onEditSession]);

  /**
   * Handle delete session
   */
  const handleDeleteSession = useCallback(async (sessionId: string) => {
    try {
      await deleteSession(sessionId);
      onDeleteSession?.(sessionId);
    } catch (error) {
      console.error('[SessionList] Failed to delete session:', error);
    }
  }, [deleteSession, onDeleteSession]);

  /**
   * Handle keyboard shortcuts
   */
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Cmd/Ctrl + F to focus search
    if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
      e.preventDefault();
      searchInputRef.current?.focus();
    }
  }, []);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const listContentRef = useRef<HTMLDivElement>(null);

  // Scroll-triggered lazy loading for sessions
  useEffect(() => {
    const container = listContentRef.current;
    if (!container || !onLoadMoreSessions) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;

      // When scrolled near bottom (within 100px), load more sessions
      const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
      if (distanceFromBottom < 100 && hasMoreSessions && !isLoadingSessions) {
        onLoadMoreSessions();
      }
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, [hasMoreSessions, isLoadingSessions, onLoadMoreSessions]);

  return (
    <div className="session-list">
      {/* Header */}
      <div className="session-list-header" onMouseDown={onHeaderMouseDown}>
        <div className="session-list-title">
          <span className="session-list-icon">🪼</span>
          <span>{t('dialog:sessionList')}</span>
        </div>
        <div className="session-list-status">
          <span className={`status-dot ${connected ? 'connected' : 'disconnected'}`}></span>
          <span>{connected ? t('common:connected') : t('dialog:disconnected')}</span>
        </div>
        <button
          className="icon-button"
          onClick={handleRefresh}
          disabled={isLoading || !connected}
          title={t('dialog:refresh') || 'Refresh'}
        >
          {isLoading ? '⏳' : '🔄'}
        </button>
        <div className="session-list-actions">
          <button
            className="icon-button"
            onClick={onMinimize}
            title={t('common:minimize')}
          >
            −
          </button>
          <button
            className="icon-button close-button"
            onClick={onClose}
            title={t('common:close')}
          >
            ×
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="session-list-search">
        <input
          ref={searchInputRef}
          type="text"
          placeholder={t('dialog:searchPlaceholder')}
          value={searchQuery}
          onChange={handleSearchChange}
          className="search-input"
        />
        {searchQuery && (
          <button
            className="search-clear"
            onClick={() => setSearchQuery('')}
            title={t('common:clear') || 'Clear'}
          >
            ×
          </button>
        )}
      </div>

      {/* Session List */}
      <div className="session-list-content" ref={listContentRef}>
        {isLoading && filteredSessions.length === 0 ? (
          <div className="session-list-loading">
            <SessionCardSkeleton />
            <SessionCardSkeleton />
            <SessionCardSkeleton />
          </div>
        ) : filteredSessions.length === 0 ? (
          <div className="session-list-empty">
            <div className="empty-icon">💬</div>
            <div className="empty-text">
              {searchQuery ? t('dialog:noSearchResults') : t('dialog:noSessions')}
            </div>
            {!searchQuery && (
              <button
                className="empty-button"
                onClick={handleCreateSession}
                disabled={!connected}
              >
                {t('dialog:newConversation')}
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="session-list-items">
              {filteredSessions.map((session) => (
                <SessionCard
                  key={session.id}
                  session={session}
                  onClick={() => handleSessionClick(session.id)}
                  onEdit={handleEditSession}
                  onDelete={handleDeleteSession}
                />
              ))}
            </div>
            {/* Loading indicator for lazy loading */}
            {isLoadingSessions && hasMoreSessions && (
              <div className="session-list-loading-more">
                <div className="loading-spinner"></div>
                <span>{t('dialog:loadingMoreSessions') || 'Loading more...'}</span>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default SessionList;

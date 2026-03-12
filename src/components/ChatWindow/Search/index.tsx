/**
 * Search View Component
 *
 * Search view for filtering sessions and messages.
 */

import { useState, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useSessionStore } from '@/stores/sessionStore';
import SessionCard from '../SessionList/SessionCard';
import { debounce } from '../shared/utils/format';
import { DEFAULTS } from '../shared/constants';
import type { Session, SearchFilters } from '../shared/types';
import './Search.css';

interface SearchViewProps {
  onSelectSession: (sessionId: string) => void;
  onBack: () => void;
  // Window control callbacks
  onClose: () => void;
  onMinimize: () => void;
  onHeaderMouseDown: (e: React.MouseEvent) => void;
}

function SearchView({
  onSelectSession,
  onBack,
  onClose,
  onMinimize,
  onHeaderMouseDown,
}: SearchViewProps) {
  const { t } = useTranslation(['dialog', 'common']);
  const sessions = useSessionStore((s) => s.sessions);
  const [filters, setFilters] = useState<SearchFilters>({
    query: '',
  });
  const [results, setResults] = useState<Session[]>([]);

  /**
   * Perform search
   */
  const performSearch = useCallback((query: string) => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    const lowerQuery = query.toLowerCase();
    const filtered = sessions.filter((session) => {
      // Search in title
      if (session.title.toLowerCase().includes(lowerQuery)) {
        return true;
      }

      // Search in last message
      if (session.lastMessage?.toLowerCase().includes(lowerQuery)) {
        return true;
      }

      // Search in assistant name
      if (session.assistantName?.toLowerCase().includes(lowerQuery)) {
        return true;
      }

      return false;
    });

    // Sort by relevance (exact match first)
    const sorted = [...filtered].sort((a, b) => {
      const aExact = a.title.toLowerCase() === lowerQuery;
      const bExact = b.title.toLowerCase() === lowerQuery;
      if (aExact && !bExact) return -1;
      if (!aExact && bExact) return 1;
      return (b.lastMessageTime || 0) - (a.lastMessageTime || 0);
    });

    setResults(sorted);
  }, [sessions]);

  /**
   * Debounced search handler
   */
  const debouncedSearch = useMemo(
    () => debounce((query: string) => {
      performSearch(query);
    }, DEFAULTS.SEARCH_DEBOUNCE_MS),
    [performSearch]
  );

  /**
   * Handle search input change
   */
  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setFilters({ query });
    debouncedSearch(query);
  }, [debouncedSearch]);

  /**
   * Handle session click
   */
  const handleSessionClick = useCallback((sessionId: string) => {
    onSelectSession(sessionId);
  }, [onSelectSession]);

  return (
    <div className="search-view">
      {/* Header */}
      <div className="search-header" onMouseDown={onHeaderMouseDown}>
        <button className="back-button" onClick={onBack} title={t('common:back')}>
          ←
        </button>
        <div className="search-title">{t('dialog:search')}</div>
        <div className="search-actions">
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

      {/* Search Input */}
      <div className="search-input-wrapper">
        <input
          type="text"
          placeholder={t('dialog:searchPlaceholder')}
          value={filters.query}
          onChange={handleSearchChange}
          className="search-input-field"
          autoFocus
        />
        {filters.query && (
          <button
            className="search-clear"
            onClick={() => {
              setFilters({ query: '' });
              setResults([]);
            }}
            title={t('common:clear') || 'Clear'}
          >
            ×
          </button>
        )}
      </div>

      {/* Search Results */}
      <div className="search-results">
        {filters.query && results.length === 0 ? (
          <div className="search-empty">
            <div className="empty-icon">🔍</div>
            <div className="empty-text">{t('dialog:noSearchResults')}</div>
          </div>
        ) : !filters.query ? (
          <div className="search-empty">
            <div className="empty-icon">🔍</div>
            <div className="empty-text">{t('dialog:searchPrompt')}</div>
          </div>
        ) : (
          <div className="search-results-list">
            {results.map((session) => (
              <SessionCard
                key={session.id}
                session={session}
                onClick={() => handleSessionClick(session.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default SearchView;

import { useState, useCallback, useRef } from 'react';
import { useBrainStore } from '@/stores/brainStore';

export interface PaginatedMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: number;
  message_id?: string;
}

/**
 * Hook for paginated message loading with deduplication
 *
 * Manages message loading state and provides load more functionality.
 * Uses oldestLoadedTimestamp to load older messages in chunks.
 *
 * @param sessionKey - The session key to load messages from
 * @param initialLimit - Initial number of messages to load (default: 50)
 * @returns Message pagination state and controls
 */
export function useMessagePagination(sessionKey: string, initialLimit = 50) {
  const [messages, setMessages] = useState<PaginatedMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const oldestLoadedTimestamp = useRef<number | undefined>(undefined);
  const loadedMessageIds = useRef<Set<string>>(new Set());

  const { getSessionHistory } = useBrainStore();

  const loadMessages = useCallback(async (beforeTs?: number) => {
    if (isLoading) return;

    setIsLoading(true);
    try {
      console.log(`[useMessagePagination] Loading messages: sessionKey=${sessionKey}, beforeTs=${beforeTs}`);

      const newMessages = await getSessionHistory(sessionKey, initialLimit, 0, beforeTs);

      // Deduplicate by message_id or timestamp+content
      const uniqueMessages = newMessages.filter(msg => {
        const key = msg.message_id || `${msg.timestamp}_${msg.content.substring(0, 20)}`;
        if (loadedMessageIds.current.has(key)) return false;
        loadedMessageIds.current.add(key);
        return true;
      });

      if (uniqueMessages.length === 0) {
        setHasMore(false);
      } else {
        setMessages(prev => [...uniqueMessages, ...prev]);

        // Update oldest timestamp
        const oldest = uniqueMessages[0];
        if (oldest.timestamp && oldest.timestamp < (oldestLoadedTimestamp.current || Infinity)) {
          oldestLoadedTimestamp.current = oldest.timestamp;
        }
      }
    } catch (error) {
      console.error('[useMessagePagination] Failed to load messages:', error);
    } finally {
      setIsLoading(false);
    }
  }, [sessionKey, initialLimit, isLoading, getSessionHistory]);

  const loadMore = useCallback(() => {
    if (!hasMore || isLoading) return;
    loadMessages(oldestLoadedTimestamp.current);
  }, [hasMore, isLoading, loadMessages]);

  const refresh = useCallback(() => {
    // Clear and reload from latest
    loadedMessageIds.current.clear();
    oldestLoadedTimestamp.current = undefined;
    setHasMore(true);
    loadMessages(undefined);
  }, [loadMessages]);

  return {
    messages,
    isLoading,
    hasMore,
    loadMore,
    refresh,
  };
}

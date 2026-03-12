import { useEffect, useRef } from 'react';
import { useBrainStore } from '@/stores/brainStore';

interface UseSessionPollingOptions {
  characterId?: string;
  enabled?: boolean;
  interval?: number; // milliseconds, default 60000 (60 seconds)
  onSessionsUpdate?: (sessions: any[]) => void;
}

/**
 * Hook for polling session list updates
 *
 * Automatically fetches sessions for a character at regular intervals.
 * Useful for keeping the session list up-to-date with new activity.
 *
 * @param options - Polling configuration options
 */
export function useSessionPolling({
  characterId,
  enabled = true,
  interval = 60000,
  onSessionsUpdate,
}: UseSessionPollingOptions) {
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const { getSessionsByCharacterId } = useBrainStore();

  useEffect(() => {
    if (!enabled || !characterId) return;

    const pollSessions = async () => {
      try {
        console.log(`[useSessionPolling] Polling sessions for character: ${characterId}`);
        const sessions = await getSessionsByCharacterId(characterId);
        onSessionsUpdate?.(sessions);
      } catch (error) {
        console.error('[useSessionPolling] Failed to poll sessions:', error);
      }
    };

    // Initial fetch
    pollSessions();

    // Set up interval
    intervalRef.current = setInterval(pollSessions, interval);

    // Cleanup
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [characterId, enabled, interval, getSessionsByCharacterId]);

  return null;
}

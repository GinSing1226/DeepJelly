import { useState } from 'react';

/**
 * Status type for preset character states
 */
export type StatusType = 'idle' | 'listening' | 'thinking' | 'executing' | 'speaking' | 'network_error';

/**
 * Status data structure
 */
export interface StatusData {
  emoji?: string;
  text: string;
  duration?: number; // Display duration in milliseconds, undefined means show indefinitely
}

/**
 * Hook to manage status state with auto-hide functionality
 *
 * @param initialStatus - Optional initial status
 * @returns [currentStatus, setStatus] tuple
 */
export function useStatusBubble(initialStatus?: StatusData) {
  const [status, setStatus] = useState<StatusData | null>(initialStatus || null);
  const [statusType, setStatusType] = useState<StatusType | undefined>();

  /**
   * Set a preset status type
   */
  const setPresetStatus = (type: StatusType, duration?: number) => {
    setStatusType(type);
    setStatus({ text: '', duration });
  };

  /**
   * Set a custom status with emoji and text
   */
  const setCustomStatus = (emoji: string, text: string, duration?: number) => {
    setStatusType(undefined);
    setStatus({ emoji, text, duration });
  };

  /**
   * Clear the current status
   */
  const clearStatus = () => {
    // Set status to null to trigger fade-out animation in the component
    setStatus(null);
  };

  return {
    status,
    statusType,
    setStatus,
    setStatusType,
    setPresetStatus,
    setCustomStatus,
    clearStatus,
  };
}

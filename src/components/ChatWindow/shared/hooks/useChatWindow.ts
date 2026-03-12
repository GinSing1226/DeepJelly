/**
 * useChatWindow Hook
 *
 * Main hook for ChatWindow feature. Manages window state and common operations.
 */

import { useState, useCallback, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import type { ChatViewMode } from '../types';

interface UseChatWindowOptions {
  onClose?: () => void;
}

export function useChatWindow(options: UseChatWindowOptions = {}) {
  const [viewMode, setViewMode] = useState<ChatViewMode>('list');
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const firstLoadRef = useRef(true);

  /**
   * Handle window close
   */
  const handleClose = useCallback(async () => {
    try {
      await invoke('close_dialog_window');
      options.onClose?.();
    } catch (error) {
      console.error('[useChatWindow] Failed to close dialog:', error);
      // Fallback
      const window = getCurrentWindow();
      await window.close();
    }
  }, [options.onClose]);

  /**
   * Handle window minimize
   */
  const handleMinimize = useCallback(async () => {
    const window = getCurrentWindow();
    await window.minimize();
  }, []);

  /**
   * Handle header drag start
   */
  const handleHeaderMouseDown = useCallback(async (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.tagName === 'BUTTON' || target.closest('button')) {
      return;
    }
    try {
      const window = getCurrentWindow();
      await window.startDragging();
    } catch (error) {
      console.error('[useChatWindow] Failed to start dragging:', error);
    }
  }, []);

  /**
   * Navigate to list view
   */
  const goToList = useCallback(() => {
    setViewMode('list');
  }, []);

  /**
   * Navigate to conversation view
   */
  const toConversation = useCallback(() => {
    setViewMode('conversation');
  }, []);

  /**
   * Navigate to search view
   */
  const toSearch = useCallback(() => {
    setViewMode('search');
  }, []);

  /**
   * Mark initial load complete
   */
  const markInitialLoadComplete = useCallback(() => {
    if (firstLoadRef.current) {
      setIsInitialLoading(false);
      firstLoadRef.current = false;
    }
  }, []);

  return {
    // State
    viewMode,
    isInitialLoading,
    firstLoadRef,

    // Actions
    setViewMode,
    handleClose,
    handleMinimize,
    handleHeaderMouseDown,
    goToList,
    toConversation,
    toSearch,
    markInitialLoadComplete,
  };
}

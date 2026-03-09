/**
 * Global Hotkeys Hook
 *
 * Meta-Name: Global Keyboard Event Management Hook
 * Meta-Description: React hook for managing global keyboard shortcuts including penetration mode (Ctrl key) and dialog closure (Esc key).
 */

import { useEffect, useState, useCallback, useRef } from 'react';

export interface UseGlobalHotkeysOptions {
  onEscapePress?: (event: KeyboardEvent) => void;
  onCtrlToggle?: (isPressed: boolean) => void;
}

export interface UseGlobalHotkeysReturn {
  isCtrlPressed: boolean;
}

/**
 * Hook for managing global keyboard shortcuts
 *
 * @param options - Configuration options for callback functions
 * @returns Object containing current keyboard state
 *
 * @example
 * ```tsx
 * const { isCtrlPressed } = useGlobalHotkeys({
 *   onEscapePress: () => console.log('Escape pressed'),
 *   onCtrlToggle: (isPressed) => console.log('Ctrl:', isPressed),
 * });
 * ```
 */
export function useGlobalHotkeys(
  options: UseGlobalHotkeysOptions = {}
): UseGlobalHotkeysReturn {
  const { onEscapePress, onCtrlToggle } = options;

  const [isCtrlPressed, setIsCtrlPressed] = useState(false);

  // Use refs for callbacks to avoid stale closures
  const onEscapePressRef = useRef(onEscapePress);
  const onCtrlToggleRef = useRef(onCtrlToggle);

  // Use ref for isCtrlPressed to avoid race conditions in callbacks
  const isCtrlPressedRef = useRef(isCtrlPressed);

  // Update refs when state changes
  useEffect(() => {
    onEscapePressRef.current = onEscapePress;
    onCtrlToggleRef.current = onCtrlToggle;
    isCtrlPressedRef.current = isCtrlPressed;
  }, [onEscapePress, onCtrlToggle, isCtrlPressed]);

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    // Handle Ctrl key for penetration mode
    // Use ref to avoid stale state issues
    if (event.key === 'Control' && !isCtrlPressedRef.current) {
      setIsCtrlPressed(true);
      // Update ref immediately to prevent duplicate calls
      isCtrlPressedRef.current = true;
      onCtrlToggleRef.current?.(true);
    }

    // Handle Escape key for closing dialogs
    if (event.key === 'Escape') {
      onEscapePressRef.current?.(event);
    }
  }, []); // No dependencies - using refs for all state

  const handleKeyUp = useCallback((event: KeyboardEvent) => {
    // Handle Ctrl key release
    if (event.key === 'Control') {
      setIsCtrlPressed(false);
      // Update ref immediately
      isCtrlPressedRef.current = false;
      onCtrlToggleRef.current?.(false);
    }
  }, []);

  // Set up and clean up event listeners
  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [handleKeyDown, handleKeyUp]);

  return {
    isCtrlPressed,
  };
}

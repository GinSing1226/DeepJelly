/**
 * DevTools Shortcut Hook
 *
 * Meta-Name: DevTools Shortcut Hook
 * Meta-Description: Enable F12 shortcut to open DevTools in any window
 */

import { useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';

/**
 * Enable F12 shortcut to toggle DevTools
 * Works in both development and production builds
 */
export function useDevToolsShortcut() {
  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      // F12 key
      if (e.key === 'F12') {
        e.preventDefault();
        try {
          await invoke('toggle_devtools');
        } catch (error) {
          console.error('[useDevToolsShortcut] Failed to toggle DevTools:', error);
          console.log('[useDevToolsShortcut] Make sure "devtools" feature is enabled in Cargo.toml');
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);
}

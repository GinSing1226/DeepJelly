/**
 * Theme Management Hook
 *
 * Meta-Name: Theme Hook
 * Meta-Description: Custom React hook for managing application theme state (light/dark) and applying theme to DOM.
 */

import { useState, useEffect } from 'react';

export type Theme = 'light' | 'dark';

export interface UseThemeReturn {
  /** Current theme value */
  theme: Theme;
  /** Function to set a specific theme */
  setTheme: (theme: Theme) => void;
  /** Function to toggle between light and dark themes */
  toggleTheme: () => void;
}

/**
 * Hook for managing application theme
 *
 * Provides theme state management and applies the theme to the document element
 * via the data-theme attribute, which is used by CSS variables.
 *
 * @returns {UseThemeReturn} Theme state and control functions
 *
 * @example
 * ```tsx
 * function App() {
 *   const { theme, setTheme, toggleTheme } = useTheme();
 *
 *   return (
 *     <div>
 *       <p>Current theme: {theme}</p>
 *       <button onClick={toggleTheme}>Toggle Theme</button>
 *     </div>
 *   );
 * }
 * ```
 */
export function useTheme(): UseThemeReturn {
  const [theme, setThemeState] = useState<Theme>('light');

  /**
   * Apply theme to document element
   */
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  /**
   * Set a specific theme and update state
   */
  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
  };

  /**
   * Toggle between light and dark themes
   */
  const toggleTheme = () => {
    setThemeState((prevTheme) => (prevTheme === 'light' ? 'dark' : 'light'));
  };

  return {
    theme,
    setTheme,
    toggleTheme,
  };
}

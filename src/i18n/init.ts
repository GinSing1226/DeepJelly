/**
 * i18n Initialization
 *
 * Meta-Name: i18n Initialization
 * Meta-Description: Async initialization function for i18n with backend locale persistence
 */

import i18n from './config';

/**
 * Initialize i18n with persisted locale from backend
 *
 * This function should be called before rendering the app to ensure
 * the correct locale is loaded from the backend persistence layer.
 *
 * @returns Promise that resolves when initialization is complete
 *
 * @example
 * ```ts
 * import { initI18n } from '@/i18n/init';
 *
 * // In main.tsx
 * initI18n().then(() => {
 *   ReactDOM.createRoot(document.getElementById('app')!).render(
 *     <React.StrictMode>
 *       <App />
 *     </React.StrictMode>
 *   );
 * });
 * ```
 */
export async function initI18n(): Promise<void> {
  try {
    // Get persisted locale from backend
    const { invoke } = await import('@tauri-apps/api/core');
    const persistedLocale = await invoke<string>('get_locale');

    // Set the locale in i18n
    await i18n.changeLanguage(persistedLocale);
  } catch {
    // Fallback to browser detection or default locale
    // The i18n config already has fallback to 'zh' and browser detection
  }
}

/**
 * Change application locale and persist to backend
 *
 * @param locale - The locale code to set (e.g., 'zh', 'en', 'ja')
 * @returns Promise that resolves when the locale change is complete
 *
 * @example
 * ```ts
 * import { changeLocale } from '@/i18n/init';
 *
 * // Change to English
 * await changeLocale('en');
 * ```
 */
export async function changeLocale(locale: string): Promise<void> {
  // Change frontend locale
  await i18n.changeLanguage(locale);

  // Persist to backend
  const { invoke } = await import('@tauri-apps/api/core');
  await invoke('set_locale', { locale });
}

/**
 * Get the current locale
 *
 * @returns The current locale code
 *
 * @example
 * ```ts
 * import { getCurrentLocale } from '@/i18n/init';
 *
 * const locale = getCurrentLocale();
 * ```
 */
export function getCurrentLocale(): string {
  return i18n.language;
}

/**
 * Check if a locale is supported
 *
 * @param locale - The locale code to check
 * @returns true if the locale is supported, false otherwise
 *
 * @example
 * ```ts
 * import { isLocaleSupported } from '@/i18n/init';
 *
 * if (isLocaleSupported('en')) {
 *   // English is supported
 * }
 * ```
 */
export function isLocaleSupported(locale: string): boolean {
  return ['zh', 'en', 'ja'].includes(locale);
}

/**
 * Language Selector Component
 *
 * Meta-Name: Language Selector Component
 * Meta-Description: React component for switching application language/locale
 */

import { useTranslation } from 'react-i18next';
import { invoke } from '@tauri-apps/api/core';
import { SUPPORTED_LOCALES, LOCALE_NAMES, SupportedLocale } from '@/i18n/config';
import './styles.css';

/**
 * LanguageSelector Component
 *
 * Provides a dropdown interface for users to switch between supported languages.
 * Updates both frontend i18n state and synchronizes with backend Tauri application.
 *
 * Features:
 * - Globe emoji (🌐) as visual indicator
 * - Dropdown with all supported locales in their native names
 * - Pre-selects current locale
 * - Graceful error handling for backend communication failures
 */
export function LanguageSelector() {
  const { i18n } = useTranslation();

  /**
   * Handle language change
   * Updates frontend i18n and syncs to backend
   */
  const handleLanguageChange = async (event: React.ChangeEvent<HTMLSelectElement>) => {
    const newLocale = event.target.value as SupportedLocale;

    try {
      // Update frontend language immediately
      await i18n.changeLanguage(newLocale);

      // Sync to backend Tauri application
      await invoke('set_locale', { locale: newLocale });
    } catch (error) {
      // Log error but don't crash the UI
      console.error('Failed to update language:', error);

      // Optional: Show user feedback about the error
      // For now, we'll keep the frontend updated even if backend sync fails
      // The user can continue using the app in the selected language
    }
  };

  /**
   * Get current locale from i18n
   * Defaults to 'zh' if not set
   */
  const currentLocale = (i18n.language as SupportedLocale) || 'zh';

  return (
    <div className="language-selector">
      <label htmlFor="locale-select" className="language-selector-label">
        🌐
      </label>
      <select
        id="locale-select"
        className="language-selector-select"
        value={currentLocale}
        onChange={handleLanguageChange}
        aria-label="Select language"
      >
        {SUPPORTED_LOCALES.map((locale) => (
          <option key={locale} value={locale}>
            {LOCALE_NAMES[locale]}
          </option>
        ))}
      </select>
    </div>
  );
}

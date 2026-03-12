/**
 * i18n Configuration
 *
 * Meta-Name: i18n Configuration
 * Meta-Description: Internationalization configuration for DeepJelly application
 * Note: Optimized for Tauri environment
 */

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { resources } from './resources';

export type SupportedLocale = 'zh' | 'en' | 'ja';

export const SUPPORTED_LOCALES: SupportedLocale[] = ['zh', 'en', 'ja'];

export const LOCALE_NAMES: Record<SupportedLocale, string> = {
  zh: '简体中文',
  en: 'English',
  ja: '日本語'
};

/**
 * Initialize i18n instance with configuration
 * Optimized: no async backend calls, use default locale
 */
i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: 'zh',
    fallbackLng: 'zh',
    supportedLngs: SUPPORTED_LOCALES,
    defaultNS: 'common',
    ns: ['common', 'tray', 'settings', 'debug', 'confirm', 'status', 'error', 'about', 'dialog', 'onboarding'],
    keySeparator: '.',   // Use . for nested keys (e.g., tabs.character)
    nsSeparator: ':',     // Use : for namespace:key syntax
    react: {
      useSuspense: false
    },
    debug: (import.meta as any).env?.DEV || false
  });

export default i18n;
